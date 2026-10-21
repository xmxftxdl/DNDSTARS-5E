import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { createDnd5eRegisteredDeathSaveSession, resolveDnd5eDeathSaveActivity, listDnd5eDeathSaveActivityCandidates, type Dnd5eDeathSaveActivitySelection } from './deathSaveActivity'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {normalizeCharacter} from '../../store/characters'
import {restoreClassResources,syncCharacterClassResources} from '../../lib/classResources'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'recovery',name:'Synthetic recovery',activation:{kind:'free'},
  invocation:{kind:'triggered',event:'before-death-save',confirmation:'actor-choice',retention:'single-event'},
  legacySource:{kind:'feature',id:'recovery'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},
  automation:automationCapabilityFromLegacyStatus('full'),
  consumption:[{kind:'resource',resourceId:'recovery-use',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
  effects:[{schemaVersion:1,id:'blind',name:'Blind',duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-end',includeCreationTurn:true},conditions:['blinded'],stacking:'replace'}],
  outcomes:[{id:'recover',when:{kind:'always'},operations:[
    {id:'heal',kind:'healing',target:'actor',amount:{kind:'floor',value:{kind:'multiply',values:[{kind:'reference',reference:{kind:'actor-max-hp'}},{kind:'constant',value:0.5}]}}},
    {id:'stand',kind:'remove-standard-condition',target:'actor',condition:'prone'},
    {id:'burst',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'dice',rollId:'burst',count:2,sides:8}},
    {id:'blind',kind:'apply-effect',target:'target',effectId:'blind'},
  ]}]}

function fixture(){
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',initiative:20,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  actor.pluginFeatureIds=['recovery'];actor.classResources['recovery-use']={current:1,max:1}
  let state=startDnd5eHeadlessCombat('recovery',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
  state.initiativeIndex=1
  const attack=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'enemy',targetId:'actor',attackModifier:5,d20:12,damage:{count:1,sides:20,rolls:[20],bonus:0,type:'slashing'}})
  expect(attack.ok).toBe(true)
  const turn=resolveDnd5eHeadlessAction(attack.state,{type:'end-turn',actorId:'enemy'})
  expect(turn.ok).toBe(true)
  turn.state.distanceFeetByCombatantPair={...turn.state.distanceFeetByCombatantPair,[dnd5eCombatantPairKey('actor','enemy')]:5}
  return turn.state
}

it('keeps recovery semantics through an exported and reinstalled module and rejects a second recovery in the same turn',async()=>{
  const namespace='test.archived-recovery'
  const resourceId=`${namespace}:recovery-use`
  const recipe=structuredClone(activity)
  recipe.consumption=[{kind:'resource',resourceId,amount:{kind:'constant',value:1},consumeOn:'resolve'}]
  const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
    manifest:{id:namespace,name:'Synthetic recovery',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},
    assets:[],definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'recovery',name:'Synthetic recovery',automation:activity.automation,
      activities:[recipe],payload:{id:'recovery',name:'Synthetic recovery',summary:'Synthetic',description:'Synthetic',automation:'full',
        resources:[{id:'recovery-use',label:'Recovery use',maximum:1,resetOn:'long-rest'}]}}]}
  const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try{
    const state=fixture()
    state.combatants.actor.pluginFeatureIds=[`${namespace}:recovery`]
    const character=syncCharacterClassResources(normalizeCharacter({id:'actor',name:'Actor',dnd5ePluginFeatureIds:[`${namespace}:recovery`]}))
    expect(character.classResources?.[resourceId]).toEqual({current:1,max:1})
    state.combatants.actor.classResources=structuredClone(character.classResources!)
    const session=createDnd5eRegisteredDeathSaveSession(state,{type:'death-save-turn',actorId:'actor',d20:0})
    const pending=session.run(state)
    expect(pending.status).toBe('pending');if(pending.status!=='pending')throw Error('missing checkpoint')
    const outcome=session.accept(state,pending.checkpoint,{combatRevision:1,confirmedBy:'actor',authoritativeRolls:{burst:{values:[3,3]}},
      command:{schemaVersion:1,commandId:'archive',actorId:'actor',packageId:namespace,packageVersion:'1.0.0',activityId:'recovery',targetIds:['enemy'],expectedRevision:1,
        triggerEventId:`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:actor`}})
    expect(outcome.status).toBe('resolved');if(outcome.status!=='resolved')throw Error('missing result')
    expect(outcome.result.ok).toBe(true)
    const next=JSON.parse(JSON.stringify(outcome.result.state)) as typeof state
    expect(next.combatants.actor.currentHp).toBe(10)
    expect(next.combatants.enemy.currentHp).toBe(14)
    expect(next.combatants.enemy.conditions).toContain('blinded')
    expect(next.combatants.actor.classResources[resourceId].current).toBe(0)
    const spent=normalizeCharacter({...character,classResources:next.combatants.actor.classResources})
    expect(restoreClassResources(spent,'short-rest').classResources?.[resourceId].current).toBe(0)
    expect(restoreClassResources(spent,'long-rest').classResources?.[resourceId].current).toBe(1)
    expect(next.combatants.actor.classState.deathSaveTurn?.resolved).toBe(true)
    // Replenishing an independent resource must not reset this turn's window.
    next.combatants.actor.currentHp=0
    next.combatants.actor.classResources[resourceId].current=1
    expect(listDnd5eDeathSaveActivityCandidates(next,'actor')).toEqual([])
    const repeated=createDnd5eRegisteredDeathSaveSession(next,{type:'death-save',actorId:'actor',d20:10}).run(next)
    expect(repeated.status).toBe('resolved')
    if(repeated.status==='resolved'){
      expect(repeated.result.ok).toBe(false)
      expect(repeated.result.state).toEqual(next)
    }
  }finally{dispose()}
})

// Mechanism evidence only: this hand-authored recipe is not evidence that the
// original PDF was converted correctly. Exercise the whole numeric expression,
// rather than a constant half-HP result or damage with a zero ability modifier.
it.each([
  [21,8,9,30], [21,18,14,30], [37,20,15,5], [37,8,9,35],
] as const)('checks recovery expressions at max HP %i / CHA %i / damage %i / range %i',(maxHp,cha,damage,range)=>{
  const recipe=structuredClone(activity)
  recipe.outcomes[0].operations=recipe.outcomes[0].operations.map(operation=>operation.kind==='damage'
    ? {...operation,amount:{kind:'add',values:[operation.amount,{kind:'reference',reference:{kind:'actor-ability-modifier',ability:'cha'}}]}}
    : operation)
  const registration=registerDnd5eActivityPackage({packageId:'test.recovery-expressions',packageVersion:'1.0.0',activities:[recipe]})
  try{
    const state=fixture()
    state.combatants.actor.maxHp=maxHp
    state.combatants.actor.abilities.cha=cha
    state.combatants.enemy.currentHp=40;state.combatants.enemy.maxHp=40
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','enemy')]:range}
    const before=structuredClone(state)
    const session=createDnd5eRegisteredDeathSaveSession(state,{type:'death-save-turn',actorId:'actor',d20:0})
    const pending=session.run(state)
    expect(pending.status).toBe('pending');if(pending.status!=='pending')throw Error('missing checkpoint')
    const outcome=session.accept(state,pending.checkpoint,{combatRevision:1,confirmedBy:'actor',authoritativeRolls:{burst:{values:[4,6]}},
      command:{schemaVersion:1,commandId:'expressions',actorId:'actor',packageId:'test.recovery-expressions',packageVersion:'1.0.0',activityId:'recovery',targetIds:['enemy'],expectedRevision:1,
        triggerEventId:`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:actor`}})
    expect(outcome.status).toBe('resolved');if(outcome.status!=='resolved')throw Error('missing result')
    expect(state).toEqual(before)
    expect(outcome.result.ok).toBe(range<=30)
    if(range>30){expect(outcome.result.state).toEqual(before);return}
    const next=outcome.result.state
    expect(next.combatants.actor.currentHp).toBe(Math.floor(maxHp/2))
    expect(next.combatants.enemy.currentHp).toBe(40-damage)
    expect(next.combatants.enemy.conditions).toContain('blinded')
    expect(next.combatants.actor.classResources['recovery-use'].current).toBe(0)
    expect(next.initiativeIndex).toBe(state.initiativeIndex)
    expect(outcome.result.events.some(event=>event.type==='death-save-resolved')).toBe(false)
    const ended=resolveDnd5eHeadlessAction(next,{type:'end-turn',actorId:'actor'})
    expect(ended.ok).toBe(true)
    expect(ended.state.combatants.enemy.conditions).not.toContain('blinded')
  }finally{registration.dispose()}
})

it.each(['valid','low-level','wrong-subclass','unowned'] as const)('discovers registered subclass recovery with %s ownership', mode=>{
  const packageId='test.death-subclass'
  const dispose=registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Test',version:'1.0.0',apiVersion:2,
    rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    api.registerDeclarativeSubclass({schemaVersion:1,id:'patron',classId:'warlock',name:'Patron',summary:'Synthetic',abilities:[{
      schemaVersion:1,id:'recovery',name:'Recovery',description:'Synthetic entitlement',level:14,trigger:{kind:'active-use'},cost:{economy:'none'},
      targeting:{kind:'self'},effects:[],automation:'manual',
    }]})
  }})
  const recipe=structuredClone(activity)
  recipe.legacySource={kind:'subclass-ability',id:'patron:recovery'}
  const registration=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[recipe]})
  try{
    const state=fixture(),actor=state.combatants.actor
    actor.classId='warlock';actor.level=14;actor.classLevels={warlock:mode==='low-level'?13:14}
    actor.subclassId=`${packageId}:patron`;actor.subclassIds={warlock:mode==='wrong-subclass'?'fiend':actor.subclassId}
    actor.pluginFeatureIds=mode==='unowned'?[]:[`${packageId}:patron.recovery`]
    const candidates=listDnd5eDeathSaveActivityCandidates(state,'actor')
    expect(candidates).toHaveLength(mode==='valid'?1:0)
    if(mode==='valid'){
      candidates[0].activity.name='Caller mutation'
      expect(listDnd5eDeathSaveActivityCandidates(state,'actor')[0].activity.name).toBe(recipe.name)
    }
    const session=createDnd5eRegisteredDeathSaveSession(state,{type:'death-save',actorId:'actor',d20:10})
    const pending=session.run(state)
    expect(pending.status).toBe(mode==='valid'?'pending':'resolved')
    if(pending.status==='pending'){
      const result=session.accept(state,pending.checkpoint,{combatRevision:1,confirmedBy:'actor',authoritativeRolls:{burst:{values:[3,3]}},
        command:{schemaVersion:1,commandId:'recover',packageId,packageVersion:'1.0.0',activityId:'recovery',actorId:'actor',targetIds:['enemy'],expectedRevision:1,
          triggerEventId:`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:actor`}})
      expect(result.status).toBe('resolved')
      if(result.status==='resolved')expect(result.result.ok).toBe(true)
    }
  }finally{registration.dispose();dispose()}
})

it.each([['stand',0],['remain',0],['stand',2]] as const)('recovers with optional %s choice and %i victims',(stand,victims)=>{
  const recipe=structuredClone(activity)
  recipe.target={kind:'creature',relation:'any',count:256,minimumCount:0,rangeFeet:30}
  recipe.choices=[{id:'posture',label:'Posture',options:[{id:'stand',label:'Stand'},{id:'remain',label:'Remain prone'}]}]
  recipe.outcomes[0].operations=recipe.outcomes[0].operations.filter(operation=>operation.id!=='stand')
  recipe.outcomes=[...recipe.outcomes,{id:'posture',when:{kind:'choice',choiceId:'posture',optionId:'stand'},operations:[
    {id:'stand',kind:'remove-standard-condition',target:'actor',condition:'prone'}]}]
  const registration=registerDnd5eActivityPackage({packageId:'test.empty-recovery',packageVersion:'1.0.0',activities:[recipe]})
  try{
    const state=fixture()
    if(victims===2){
      state.combatants.other={...structuredClone(state.combatants.enemy),id:'other'}
      state.distanceFeetByCombatantPair={...state.distanceFeetByCombatantPair,[dnd5eCombatantPairKey('actor','other')]:10}
    }
    const session=createDnd5eRegisteredDeathSaveSession(state,{type:'death-save-turn',actorId:'actor',d20:0})
    const pending=session.run(state)
    expect(pending.status).toBe('pending');if(pending.status!=='pending')throw Error('not pending')
    const result=session.accept(state,pending.checkpoint,{combatRevision:1,confirmedBy:'actor',authoritativeRolls:victims?{burst:{values:[3,3]}}:{},
      command:{schemaVersion:1,commandId:'empty',packageId:'test.empty-recovery',packageVersion:'1.0.0',activityId:'recovery',actorId:'actor',targetIds:victims?['enemy','other']:[],expectedRevision:1,
        choices:{posture:stand},triggerEventId:`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:actor`}})
    expect(result.status).toBe('resolved');if(result.status!=='resolved')throw Error('not resolved')
    expect(result.result.ok).toBe(true)
    expect(result.result.state.combatants.actor.currentHp).toBe(10)
    expect(result.result.state.combatants.actor.conditions.includes('prone')).toBe(stand==='remain')
    expect(result.result.state.combatants.actor.classResources['recovery-use'].current).toBe(0)
    expect(result.result.state.combatants.enemy.currentHp).toBe(victims?14:20)
    if(victims)expect(result.result.state.combatants.other.currentHp).toBe(14)
    expect(result.result.events.filter(event=>event.type==='damage-applied')).toHaveLength(victims)
  }finally{registration.dispose()}
})

it.each(['valid','spent-turn-resources','unowned','spent','invalid-dice','changed-definition','out-of-range','wrong-trigger','empty-without-permission'] as const)('runs registered death-save replacement with %s authority',mode=>{
  const registration=registerDnd5eActivityPackage({packageId:'test.death-save',packageVersion:'1.0.0',activities:[activity]})
  let changed:ReturnType<typeof registerDnd5eActivityPackage>|undefined
  try{
    const state=fixture()
    expect(state.combatants.actor.currentHp).toBe(0)
    if(mode==='unowned')state.combatants.actor.pluginFeatureIds=[]
    if(mode==='spent')state.combatants.actor.classResources['recovery-use'].current=0
    if(mode==='spent-turn-resources'){
      state.combatants.actor.turn.reactionAvailable=false
      state.combatants.actor.turn.movementSpent=10
    }
    if(mode==='out-of-range')state.distanceFeetByCombatantPair={...state.distanceFeetByCombatantPair,[dnd5eCombatantPairKey('actor','enemy')]:35}
    const before=structuredClone(state)
    const selection:Dnd5eDeathSaveActivitySelection={combatRevision:1,confirmedBy:'actor',
      command:{schemaVersion:1,commandId:'recover',actorId:'actor',packageId:'test.death-save',packageVersion:'1.0.0',activityId:'recovery',targetIds:['enemy'],expectedRevision:1,
        triggerEventId:`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:actor`},
      authoritativeRolls:{burst:{values:mode==='invalid-dice'?[99,3]:[3,3]}},
    }
    if(mode==='wrong-trigger')selection.command.triggerEventId='death-save:other'
    if(mode==='empty-without-permission')selection.command.targetIds=[]
    // Outside the actual checkpoint, a forged event cannot authorize an unconscious actor.
    expect(resolveDnd5eDeathSaveActivity(state,selection).ok).toBe(false)
    const session=createDnd5eRegisteredDeathSaveSession(state,{type:'death-save-turn',actorId:'actor',d20:0},()=>true)
    const pending=session.run(state);expect(pending.status).toBe('pending');if(pending.status!=='pending')throw Error('not pending')
    if(mode==='changed-definition'){
      registration.dispose()
      changed=registerDnd5eActivityPackage({packageId:'test.death-save',packageVersion:'1.0.0',activities:[{...activity,name:'Changed'}]})
    }
    const result=session.accept(state,pending.checkpoint,selection)
    expect(result.status).toBe('resolved');if(result.status!=='resolved')throw Error('not resolved')
    const valid=mode==='valid'||mode==='spent-turn-resources'
    expect(result.result.ok,JSON.stringify(result)).toBe(valid)
    expect(state).toEqual(before)
    if(!valid){expect(result.result.state).toEqual(before);return}
    const next=result.result.state
    expect(next.combatants.actor.currentHp).toBe(10)
    expect(next.combatants.actor.turn.movementRemaining).toBe(mode==='spent-turn-resources'?20:30)
    expect(next.combatants.actor.turn.reactionAvailable).toBe(mode!=='spent-turn-resources')
    expect(next.combatants.actor.classResources['recovery-use'].current).toBe(0)
    expect(next.combatants.enemy.currentHp).toBe(14)
    expect(next.combatants.actor.conditions).not.toContain('unconscious')
    expect(next.combatants.actor.conditions).not.toContain('prone')
    expect(next.combatants.enemy.conditions).toContain('blinded')
    expect(next.initiativeIndex).toBe(state.initiativeIndex)
    expect(result.result.events.some(event=>event.type==='death-save-resolved')).toBe(false)
    expect(result.result.events.filter(event=>event.type==='damage-applied')).toHaveLength(1)
    expect(session.accept(state,pending.checkpoint,selection)).toEqual({status:'rejected',reason:'session-ended'})
    const ended=resolveDnd5eHeadlessAction(next,{type:'end-turn',actorId:'actor'})
    expect(ended.ok).toBe(true)
    expect(ended.state.combatants.enemy.conditions).not.toContain('blinded')
    const nextTurn=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'enemy'})
    expect(nextTurn.ok).toBe(true)
    const expired=resolveDnd5eHeadlessAction(nextTurn.state,{type:'end-turn',actorId:'actor'})
    expect(expired.ok).toBe(true)
    expect(expired.state.combatants.enemy.conditions).not.toContain('blinded')
  }finally{changed?.dispose();registration.dispose()}
})
