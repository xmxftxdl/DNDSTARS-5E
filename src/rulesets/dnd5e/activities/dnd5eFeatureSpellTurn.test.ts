import {expect,it} from 'vitest'
import {dnd5eCombatantPairKey} from '../headlessCombatPrimitives'
import {createDnd5eMechanicalEffect} from '../activeEffects'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from '../unifiedContent'
import {exportDnd5eStarMod,readDnd5eStarMod} from '../starModAdapter'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,dnd5eHeadlessTurnKey,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'

it('commits an invoked core spell once and enforces the bonus-action spell restriction in the registered route',async()=>{
 const ns='test.feature-spell-turn',automation=automationCapabilityFromLegacyStatus('full')
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
  manifest:{id:ns,name:'Invocation fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],
  definitions:[{schemaVersion:1,namespace:ns,version:'1.0.0',kind:'feature',id:'invoke',name:'Invocation fixture',automation,
   payload:{id:'invoke',name:'Invocation fixture',summary:'Synthetic',description:'Synthetic',automation:'full'},
   activities:[{schemaVersion:1,id:'invoke',name:'Invocation fixture',automation,legacySource:{kind:'feature',id:'invoke'},activation:{kind:'bonus-action'},target:{kind:'self'},
    spellInvocation:{spellId:'burning-hands',castAtLevel:2,operationIds:['marker']},
    consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'},{kind:'resource',resourceId:'dnd5e-ki',amount:{kind:'constant',value:3},consumeOn:'resolve'}],
    outcomes:[{id:'marker',when:{kind:'always'},operations:[{id:'marker',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:1}},{id:'independent',kind:'healing',target:'actor',amount:{kind:'constant',value:2}}]}]}]}]}
 const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try{
  const actors=['actor','target'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:i?'dm':'player',initiative:20-i,
   abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:i*5,y:0},concentrating:false,
   pluginFeatureIds:i?[]:[ns+':invoke']}))
  Object.assign(actors[0],{classId:'monk',classLevels:{monk:6},level:6})
  actors[0].classResources['dnd5e-ki']={current:6,max:6}
  const state=startDnd5eHeadlessCombat('invocation',actors)
  const run=(snapshot:typeof state, checkpoint:Pick<Parameters<typeof resolveRegisteredDnd5eActivityInCombatV1>[0],'counterspellReaction'|'spellcastingSavingThrows'|'sourceActionInterruptionReaction'>={})=>resolveRegisteredDnd5eActivityInCombatV1({...checkpoint,state:snapshot,combatRevision:1,authoritativeRolls:{},command:{schemaVersion:1,commandId:'cast',packageId:ns,packageVersion:'1.0.0',activityId:'invoke',actorId:'actor',targetIds:['actor'],expectedRevision:1}})
  const before=structuredClone(state),result=run(state)
  expect(result.result.ok,JSON.stringify(result)).toBe(true)
  if(!result.result.ok||result.phase!=='commit')throw Error('commit failed')
  expect(state).toEqual(before)
  const actor=result.result.state.combatants.actor
  expect(actor.classResources['dnd5e-ki'].current).toBe(3)
  expect(actor.turn.bonusActionAvailable).toBe(false)
  expect(actor.classState.bonusActionSpellTurnKey).toBe(dnd5eHeadlessTurnKey(state,'actor'))
  expect(result.result.events.filter(e=>e.type==='spell-cast')).toEqual([expect.objectContaining({spellId:'burning-hands',slotLevel:2,slotConsumed:false})])
  const countered=structuredClone(state)
  Object.assign(countered.combatants.target,{classId:'wizard',level:5,classSelections:{'spell-prepared':['counterspell']}})
  countered.combatants.target.classResources['dnd5e-spell-slot-3']={current:1,max:1}
  countered.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:5}
  const counterBefore=structuredClone(countered)
  const interrupted=run(countered,{counterspellReaction:{actorId:'target',slotLevel:3}})
  expect(interrupted.result.ok,JSON.stringify(interrupted)).toBe(true)
  if(interrupted.phase!=='commit'||!interrupted.result.ok)throw Error('counterspell commit failed')
  expect(countered).toEqual(counterBefore)
  expect(interrupted.result.state.combatants.actor.temporaryHp).toBe(0)
  expect(interrupted.result.state.combatants.actor.classResources['dnd5e-ki'].current).toBe(3)
  expect(interrupted.result.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
  expect(interrupted.result.state.combatants.target.classResources['dnd5e-spell-slot-3'].current).toBe(0)
  expect(interrupted.result.state.combatants.target.turn.reactionAvailable).toBe(false)
  expect(interrupted.result.events.filter(e=>e.type==='counterspell-resolved')).toEqual([expect.objectContaining({success:true})])
  const invalid=run(countered,{counterspellReaction:{actorId:'missing',slotLevel:3}})
  expect(invalid.result.ok).toBe(false)
  if(invalid.phase==='commit')expect(invalid.result.state).toEqual(counterBefore)
  const interruptFeatureId='test.invocation-interrupt:watcher.stop'
  const interruptUses='test.invocation-interrupt:decl-watcher-stop-uses'
  const disposeInterrupt=registerDnd5eRulesPlugin({manifest:{id:'test.invocation-interrupt',name:'Interruption',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
   api.registerDeclarativeSubclass({schemaVersion:1,id:'watcher',classId:'ranger',name:'Watcher',summary:'Synthetic',abilities:[{
    schemaVersion:1,id:'stop',name:'Stop',description:'Synthetic',level:11,trigger:{kind:'before-spell-effect'},cost:{economy:'reaction',uses:1},targeting:{kind:'self'},limits:{uses:{kind:'fixed',value:1},reset:'short-rest'},effects:[],
    mechanic:{kind:'source-action-interruption',events:['spell-cast','teleport'],rangeFeet:60,saveAbility:'wis',dcAbility:'wis'},automation:'full',
   }]})
  }})
  try {
   for(const withCounter of [false,true])for(const route of ['direct','compiled'] as const)for(const die of [1,20,21]){
    const snapshot=structuredClone(state)
    Object.assign(snapshot.combatants.target,{classId:'ranger',level:11,classLevels:{ranger:11},subclassIds:{ranger:'test.invocation-interrupt:watcher'},pluginFeatureIds:[interruptFeatureId]})
    snapshot.combatants.target.classResources[interruptUses]={current:1,max:1}
    snapshot.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:30}
    if(withCounter){
     const counter=structuredClone(snapshot.combatants.actor)
     Object.assign(counter,{id:'counter',name:'Counter',controller:'dm',classId:'wizard',classLevels:{wizard:5},level:5,
      pluginFeatureIds:[],classSelections:{'spell-prepared':['counterspell']},classResources:{'dnd5e-spell-slot-3':{current:1,max:1}}})
     snapshot.combatants.counter=counter
     snapshot.distanceFeetByCombatantPair[dnd5eCombatantPairKey('actor','counter')]=30
    }
    snapshot.combatants.actor.currentHp=10
    const snapshotBefore=structuredClone(snapshot)
    const reaction={actorId:'target',featureId:interruptFeatureId,savingThrowD20:die}
    const counterspellReaction=withCounter?{actorId:'counter',slotLevel:3}:undefined
    const resolved=route==='direct'?run(snapshot,{sourceActionInterruptionReaction:reaction,counterspellReaction}):undefined
    const committed=route==='compiled'?resolveDnd5eHeadlessAction(snapshot,{type:'plugin',pluginId:ns,actionId:'invoke',featureId:ns+':invoke',actorId:'actor',targetId:'actor',targetIds:['actor'],rolls:{},sourceActionInterruptionReaction:reaction,counterspellReaction}):resolved!.result
    expect(committed.ok,JSON.stringify({route,die,ok:committed.ok,reason:committed.ok?undefined:committed.reason})).toBe(die!==21)
    expect(snapshot).toEqual(snapshotBefore)
    if(!committed.ok)continue
    if(!('state' in committed))throw Error('expected committed state')
    expect(committed.state.combatants.actor.currentHp).toBe(12)
    expect(committed.state.combatants.actor.temporaryHp).toBe(die===20&&!withCounter?1:0)
    if(withCounter){
     expect(committed.state.combatants.counter.classResources['dnd5e-spell-slot-3'].current).toBe(die===20?0:1)
     expect(committed.state.combatants.counter.turn.reactionAvailable).toBe(die!==20)
     expect(committed.events.filter(e=>e.type==='source-action-interrupted'||e.type==='counterspell-resolved').map(e=>e.type))
      .toEqual(die===20?['source-action-interrupted','counterspell-resolved']:['source-action-interrupted'])
    }
    expect(committed.state.combatants.actor.classResources['dnd5e-ki'].current).toBe(3)
    expect(committed.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(committed.state.combatants.target.classResources[interruptUses].current).toBe(0)
    expect(committed.state.combatants.target.turn.reactionAvailable).toBe(false)
    expect(committed.events.filter(e=>e.type==='source-action-interrupted')).toHaveLength(1)
    expect(committed.events.filter(e=>e.type==='spell-cast'&&e.spellId==='burning-hands')).toHaveLength(1)
    expect(committed.events.filter(e=>e.type==='spell-cast'&&e.spellId==='counterspell')).toHaveLength(withCounter&&die===20?1:0)
   }
  }finally{disposeInterrupt()}
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'actor',source:{kind:'spell',actorId:'target'},spellcastingSave:{ability:'con',dc:18}})
  const restricted=structuredClone(state)
  restricted.combatants.actor.classState.activeEffects=[pain]
  for(const d20 of [1,20]){
   const restrictedResult=run(restricted,{spellcastingSavingThrows:[{effectId:pain.id,d20}]})
   expect(restrictedResult.result.ok,JSON.stringify(restrictedResult)).toBe(true)
   if(restrictedResult.phase!=='commit'||!restrictedResult.result.ok)throw Error('casting save failed')
   expect(restrictedResult.result.state.combatants.actor.temporaryHp).toBe(d20===20?1:0)
   expect(restrictedResult.result.state.combatants.actor.classResources['dnd5e-ki'].current).toBe(3)
  }
  const blocked=structuredClone(state)
  blocked.combatants.actor.classState.leveledSpellTurnKey=dnd5eHeadlessTurnKey(blocked,'actor')
  expect(run(blocked).result.ok).toBe(false)
  expect(blocked.combatants.actor.classResources['dnd5e-ki'].current).toBe(6)
  expect(blocked.combatants.actor.turn.bonusActionAvailable).toBe(true)
 }finally{dispose()}
})
