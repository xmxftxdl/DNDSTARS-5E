import {expect,it} from 'vitest'
import { migrateMapsState } from '../../../store/maps'
import { planDnd5eMapResultApplication } from '../mapBridge'
import { captureDnd5eLinkedTargetPresentations, normalizeDnd5eLinkedTargetPresentation } from '../linkedTargetPresentation'
import { normalizeCharacter } from '../../../store/characters'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,commitDnd5eActivityExecution,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict,dnd5eActiveRevivalPrevented} from '../activeEffects'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {dnd5eActivityActorSnapshotFromCombatantV1 as snapshot} from './dnd5eActivityCombatAuthority'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'captivity',name:'Captivity',activation:{kind:'free'},
  target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),
  effects:[{schemaVersion:1,id:'controller',name:'Controller',duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-end',includeCreationTurn:true},stacking:'replace'},
    {schemaVersion:1,id:'blocked',name:'Bound',duration:{kind:'permanent'},stacking:'replace',sourceLink:{sourceRequiresEffect:'controller',sourceRequiresEffectSameApplication:true},modifiers:[{kind:'revival-prevention'}]}],
  outcomes:[{id:'bind',when:{kind:'always'},operations:[{id:'control',kind:'apply-effect',target:'actor',effectId:'controller'},{id:'block',kind:'apply-effect',target:'target',effectId:'blocked'}]}]}
function setup(){
  const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:'player',
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('revival-block',[make('source',20),make('target',10)])
  state.combatants.target.currentHp=0;state.combatants.target.deathSaves.dead=true
  state.combatants.target.classState.soulReturnStatus='free-willing'
  const resolution=resolveDnd5eActivity({activity,actor:snapshot(state.combatants.source),targets:[snapshot(state.combatants.target)],rolls:{}})
  const result=commitDnd5eActivityExecution(state,{actorId:'source',activityId:activity.id,targetIds:['target'],resolution,source:{kind:'spell',id:'captivity'}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  return JSON.parse(JSON.stringify(result.state)) as typeof state
}
it.each([true,false])('blocks resurrection independently of the free-willing requirement (%s), until the source effect expires',requiresFreeWillingSoul=>{
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const state=setup(),before=structuredClone(state)
  const revive=(current:typeof state)=>commitDnd5eActivityExecution(current,{actorId:'source',activityId:'revive',targetIds:['target'],
    resolution:{ok:true,status:'resolved',checks:[],consumptions:[],proposals:[{kind:'revive',operationId:'revive',targetId:'target',hitPoints:1,requiresFreeWillingSoul}]}})
  expect(dnd5eActiveRevivalPrevented(state.combatants.target.classState.activeEffects)).toBe(true)
  expect(revive(state).ok).toBe(false);expect(state).toEqual(before)
  const expired=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'source'})
  expect(expired.ok,JSON.stringify(expired)).toBe(true)
  expect(dnd5eActiveRevivalPrevented(expired.state.combatants.target.classState.activeEffects)).toBe(false)
  expect(expired.state.combatants.target.classState.soulReturnStatus).toBe('free-willing')
  expect(revive(expired.state).ok).toBe(true)
})
it('preserves the modifier on save and rejects malformed flags',()=>{
  const effects=setup().combatants.target.classState.activeEffects!
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  expect(dnd5eActiveRevivalPrevented(normalizeDnd5eActiveEffects(effects))).toBe(true)
  const corrupt=JSON.parse(JSON.stringify(effects));corrupt[0].modifiers.preventsRevival='yes'
  expect(validateDnd5eActiveEffectsStrict(corrupt).ok).toBe(false)
})
it('a magically suppressed blocking effect does not overwrite the underlying soul disposition',()=>{
  const state=setup(),effects=state.combatants.target.classState.activeEffects!
  expect(dnd5eActiveRevivalPrevented(effects.map(effect=>({...effect,suspendedBy:['antimagic']})))).toBe(false)
  expect(state.combatants.target.classState.soulReturnStatus).toBe('free-willing')
})

it('an older same-named controller cannot retain another captive when its own controller expires',()=>{
  const state=setup(),controller=state.combatants.source.classState.activeEffects![0]
  const bound=state.combatants.target.classState.activeEffects![0].removal!.sourceLink!
  expect(bound.sourceRequiresEffectInstanceId).toBe(controller.id)
  state.combatants.source.classState.activeEffects!.push({...structuredClone(controller),id:'older-controller',duration:{type:'permanent'}})
  const saved=JSON.parse(JSON.stringify(state))
  const ended=resolveDnd5eHeadlessAction(saved,{type:'end-turn',actorId:'source'})
  expect(ended.ok).toBe(true)
  expect(ended.state.combatants.source.classState.activeEffects?.some(e=>e.id==='older-controller')).toBe(true)
  expect(dnd5eActiveRevivalPrevented(ended.state.combatants.target.classState.activeEffects)).toBe(false)
})

it('clears old dependents before an Activity recreates the same controller for another target',()=>{
  const state=setup()
  state.combatants.second={...structuredClone(state.combatants.target),id:'second',name:'Second',classState:{}}
  const replacement:Dnd5eActivityDefinitionV1={...activity,outcomes:[{id:'replace',when:{kind:'always'},operations:[
    {id:'clear',kind:'remove-effect',target:'actor',effectId:'controller',source:'self'},
    ...activity.outcomes[0].operations,
  ]}]}
  const resolution=resolveDnd5eActivity({activity:replacement,actor:snapshot(state.combatants.source),targets:[snapshot(state.combatants.second)],rolls:{}})
  const result=commitDnd5eActivityExecution(state,{actorId:'source',activityId:activity.id,targetIds:['second'],resolution,source:{kind:'spell',id:'captivity'}})
  expect(result.ok).toBe(true)
  expect(dnd5eActiveRevivalPrevented(result.state.combatants.target.classState.activeEffects)).toBe(false)
  expect(dnd5eActiveRevivalPrevented(result.state.combatants.second.classState.activeEffects)).toBe(true)
  expect(dnd5eActiveRevivalPrevented(state.combatants.target.classState.activeEffects)).toBe(true)
})

it('persists the exact captive identity without depending on the corpse remaining in the scene',()=>{
  const state=setup(),controller=state.combatants.source.classState.activeEffects![0]
  const dependent=state.combatants.target.classState.activeEffects![0]
  expect(controller.linkedTargetSnapshots).toEqual([{actorId:'target',effectId:dependent.id,name:state.combatants.target.name}])
  delete state.combatants.target
  const restored=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([controller])))
  expect(restored[0].linkedTargetSnapshots).toEqual(controller.linkedTargetSnapshots)
  expect(validateDnd5eActiveEffectsStrict(restored).ok).toBe(true)
  for(const bad of [[],[{actorId:'target',effectId:dependent.id,name:''}],[...controller.linkedTargetSnapshots!,...controller.linkedTargetSnapshots!]]) {
    expect(validateDnd5eActiveEffectsStrict([{...controller,linkedTargetSnapshots:bad}]).ok).toBe(false)
  }
})

it('captures captive presentation at the actual map result boundary and never replaces it with the caster or later corpse edits',()=>{
  const state=setup()
  const map=migrateMapsState({maps:[{id:'capture',width:500,height:500,gridSize:50,tokens:[
    {id:'source',type:'enemy',label:'Caster',x:25,y:25,size:1,emoji:'W',color:'#ff0000',hp:30,maxHp:30},
    {id:'target',type:'enemy',label:'Captive',x:75,y:25,size:2,emoji:'V',color:'#00ff00',poolId:'srd-5.1:bandit',tokenPortraitImageId:'captive-image',hp:0,maxHp:30},
  ]}]}).maps[0]
  const plan=planDnd5eMapResultApplication({state,map,characters:[],characterIdByCombatantId:{}})
  const controller=plan.map.tokens.find(token=>token.id==='source')!.dnd5eCombatState!.activeEffects![0]
  expect(controller.linkedTargetSnapshots?.[0].presentation).toEqual({emoji:'V',color:'#00ff00',size:2,poolId:'srd-5.1:bandit',tokenPortraitImageId:'captive-image'})
  const saved=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([controller])))
  expect(saved[0].linkedTargetSnapshots).toEqual(controller.linkedTargetSnapshots)
  state.combatants.source.classState.activeEffects=saved
  const noCorpse={...plan.map,tokens:plan.map.tokens.filter(token=>token.id!=='target')}
  delete state.combatants.target
  const next=planDnd5eMapResultApplication({state,map:noCorpse,characters:[],characterIdByCombatantId:{}})
  expect(next.map.tokens[0].dnd5eCombatState?.activeEffects?.[0].linkedTargetSnapshots).toEqual(saved[0].linkedTargetSnapshots)
  for(const extra of [{inventory:[]},{size:Infinity},{poolId:42}])expect(normalizeDnd5eLinkedTargetPresentation({emoji:'V',color:'#00ff00',size:1,...extra})).toBeUndefined()
  const characterState=setup()
  const character=normalizeCharacter({id:'captive-character',name:'Captive',avatar:'V',tokenPortrait:'https://example.invalid/captive.png'})
  const characterMap={...map,tokens:map.tokens.map(token=>token.id==='target'?{...token,characterId:character.id}:token)}
  captureDnd5eLinkedTargetPresentations(characterState,characterMap,[character])
  expect(characterState.combatants.source.classState.activeEffects![0].linkedTargetSnapshots?.[0].presentation?.tokenPortrait).toBe(character.tokenPortrait)
})

it('cannot attach a new captive to an old controller absent a controller application in this transaction',()=>{
  const state=setup(),before=structuredClone(state)
  const incomplete: Dnd5eActivityDefinitionV1={...activity,outcomes:[{id:'bind',when:{kind:'always'},operations:[{id:'block',kind:'apply-effect',target:'target',effectId:'blocked'}]}]}
  // Remove the previous dependent; only its older controller survives.
  state.combatants.target.classState.activeEffects=[]
  const resolution=resolveDnd5eActivity({activity:incomplete,actor:snapshot(state.combatants.source),targets:[snapshot(state.combatants.target)],rolls:{}})
  const result=commitDnd5eActivityExecution(state,{actorId:'source',activityId:activity.id,targetIds:['target'],resolution,source:{kind:'spell',id:'captivity'}})
  expect(result.ok).toBe(false)
  expect(state.combatants.source).toEqual(before.combatants.source)
  expect(state.combatants.target.classState.activeEffects).toEqual([])
})
