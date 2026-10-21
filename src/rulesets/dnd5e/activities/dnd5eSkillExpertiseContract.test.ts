import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict} from '../activeEffects'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {dnd5eActivityAutomationAnalysisV1} from '../plugins/pluginMechanicsRegistry'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it('applies temporary expertise using current proficiency without stacking or granting proficiency',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'expertise',name:'Expertise',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'expertise'},automation:automationCapabilityFromLegacyStatus('full'),
 requirements:[{kind:'skill-proficiency',subject:'actor',skill:'stealth',rank:1}],
 effects:[{schemaVersion:1,id:'training',name:'training',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace',modifiers:[{kind:'skill-expertise',skill:'stealth'}]}],
 outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'apply',kind:'apply-effect',target:'actor',effectId:'training'}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
 expect(validateDnd5eActivityDefinitionV1({...activity,effects:[{...activity.effects![0],modifiers:[{kind:'skill-expertise',skill:'invented'}]}]}).length).toBeGreaterThan(0)
 const id='test.skill-expertise'
 const dispose=registerDnd5eRulesPlugin({manifest:{id,name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))}})
 try{
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:14,con:10,int:10,wis:10,cha:10},proficiencyBonus:3,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,skillProficiencies:['stealth']})
  const state=startDnd5eHeadlessCombat('expertise',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
  const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
  expect(snapshot.skillProficiencyRanks?.stealth).toBe(1)
  expect(resolveDnd5eActivity({activity,actor:{...snapshot,skillProficiencyRanks:undefined},targets:[snapshot],rolls:{}}).ok).toBe(false)
  const cast=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:id,actionId:activity.id,actorId:'actor',targetIds:['actor'],rolls:{}})
  expect(cast.ok,cast.ok?'':cast.reason).toBe(true)
  expect(dnd5eActivityActorSnapshotFromCombatantV1(cast.state.combatants.actor).skillProficiencyRanks?.stealth).toBe(2)
  expect(resolveDnd5eHeadlessAction(cast.state,{type:'plugin',pluginId:id,actionId:activity.id,actorId:'actor',targetIds:['actor'],rolls:{}}).ok).toBe(false)
  const untrained=structuredClone(state);untrained.combatants.actor.skillProficiencies=[]
  expect(resolveDnd5eHeadlessAction(untrained,{type:'plugin',pluginId:id,actionId:activity.id,actorId:'actor',targetIds:['actor'],rolls:{}}).ok).toBe(false)
  const effects=JSON.parse(JSON.stringify(cast.state.combatants.actor.classState.activeEffects))
  expect(normalizeDnd5eActiveEffects(effects)[0].modifiers?.skillExpertise).toEqual(['stealth'])
  expect(validateDnd5eActiveEffectsStrict([{...effects[0],modifiers:{skillExpertise:['invented']}}]).ok).toBe(false)
  const total=(input:typeof state)=>{
   const result=resolveDnd5eHeadlessAction(input,{type:'ability-check',actorId:'actor',ability:'dex',skill:'stealth',d20:10,spendAction:false})
   expect(result.ok,result.ok?'':result.reason).toBe(true)
   return result.events.find(e=>e.type==='ability-check-resolved')
  }
  expect(total(cast.state)).toMatchObject({total:18})
  const changed=structuredClone(cast.state);changed.combatants.actor.proficiencyBonus=4
  expect(total(changed)).toMatchObject({total:20})
  changed.combatants.actor.classSelections.expertise=['stealth']
  expect(total(changed)).toMatchObject({total:20})
  changed.combatants.actor.classSelections.expertise=[];changed.combatants.actor.skillProficiencies=[]
  expect(total(changed)).toMatchObject({total:12})
  const suspended=structuredClone(cast.state)
  suspended.combatants.actor.classState.activeEffects![0].suspendedBy=['antimagic']
  expect(total(suspended)).toMatchObject({total:15})
  let ended=resolveDnd5eHeadlessAction(cast.state,{type:'end-turn',actorId:'actor'})
  ended=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'enemy'})
  expect(total(ended.state)).toMatchObject({total:18})
  ended=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'actor'})
  ended=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'enemy'})
  expect(total(ended.state)).toMatchObject({total:15})
 }finally{dispose()}
})
