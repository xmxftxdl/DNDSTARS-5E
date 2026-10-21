import {dnd5eCombatantPairKey,dnd5eDirectedCombatantPairKey} from '../headlessCombatPrimitives'
import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {listDnd5eActivityTriggerWindowsV1} from './dnd5eActivityTriggerWindows'
import {settleDnd5eActivityTriggerWindowsV1} from './dnd5eActivityTriggerSettlement'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {dnd5eActivityAutomationAnalysisV1} from '../plugins/pluginMechanicsRegistry'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'

it.each([true,false])('preserves live rage in the compiled map action snapshot: %s',raging=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'rage-control',name:'Rage control',activation:{kind:'free'},target:{kind:'self'},requirements:[{kind:'rage-state',subject:'actor',active:true}],automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]}
 const registration=registerDnd5eActivityPackage({packageId:'test.rage-control',packageVersion:'1.0.0',activities:[activity]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.rage-control',name:'Rage control',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity));api.registerFeature({id:'rage-control',name:'Rage control',summary:'Fixture',description:'Fixture',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})}})
 try{
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['test.rage-control:rage-control']})
  actor.classState.raging=raging
  const opponent=createDnd5eCombatant({...actor,id:'opponent',controller:'dm',initiative:0})
  const state=startDnd5eHeadlessCombat('rage-control',[actor,opponent])
  const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.rage-control',actionId:activity.id,featureId:'test.rage-control:rage-control',actorId:'actor',targetId:'actor',targetIds:['actor'],rolls:{}})
  expect(result.ok, result.ok ? undefined : result.reason).toBe(raging)
  expect(result.state.combatants.actor.temporaryHp).toBe(raging?3:0)
  expect(result.state.combatants.actor.turn).toEqual(state.combatants.actor.turn)
 }finally{registration.dispose();dispose()}
})

it('dispatches an owned imported free pulse after Rage without spending a second bonus action',async()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'initial-pulse',name:'Synthetic rage pulse',activation:{kind:'free'},invocation:{kind:'triggered',event:'rage-start',confirmation:'automatic'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'initial-pulse'},outcomes:[{id:'pulse',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]}
 const registration=registerDnd5eActivityPackage({packageId:'test.rage-start',packageVersion:'1.0.0',activities:[JSON.parse(JSON.stringify(activity))]})
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classId:'barbarian',classLevels:{barbarian:3},classResources:{'dnd5e-rage':{current:2,max:2}},pluginFeatureIds:['initial-pulse']})
 try{
  const initial=startDnd5eHeadlessCombat('rage-start',[make('owner',20),make('other',10)])
  const rage=resolveDnd5eHeadlessAction(initial,{type:'barbarian-rage',actorId:'owner'})
  expect(rage.ok).toBe(true);if(!rage.ok)throw Error(rage.reason)
  const windows=listDnd5eActivityTriggerWindowsV1({state:rage.state,events:rage.events,eventBatchId:'rage-1'})
  expect(windows).toHaveLength(1)
  expect(windows[0].triggerContext).toMatchObject({event:'rage-start',eligibleActorIds:['owner']})
  const settled=await settleDnd5eActivityTriggerWindowsV1({state:rage.state,events:rage.events,eventBatchId:'rage-1',combatRevision:1,confirm:async()=>{throw Error('automatic pulse should not need approval')},roll:async()=>[]})
  expect(settled.diagnostics).toContainEqual(expect.objectContaining({activityId:'initial-pulse',status:'resolved'}))
  expect(settled.state.combatants.owner.temporaryHp).toBe(3)
  expect(settled.state.combatants.other.temporaryHp).toBe(0)
  expect(settled.state.combatants.owner.turn).toMatchObject({actionAvailable:true,bonusActionAvailable:false})
  expect(settled.state.combatants.owner.classResources['dnd5e-rage'].current).toBe(1)
  const afterDamage=structuredClone(settled.state);afterDamage.combatants.owner.temporaryHp=0
  const replay=await settleDnd5eActivityTriggerWindowsV1({state:afterDamage,events:rage.events,eventBatchId:'rage-1',combatRevision:2,confirm:async()=>false,roll:async()=>[]})
  expect(replay.state.combatants.owner.temporaryHp).toBe(0)
  expect(replay.diagnostics.some(entry=>entry.status==='resolved')).toBe(false)
  expect(initial.combatants.owner.classState.raging).not.toBe(true)
  const unowned=structuredClone(rage.state);unowned.combatants.owner.pluginFeatureIds=[]
  expect(listDnd5eActivityTriggerWindowsV1({state:unowned,events:rage.events,eventBatchId:'unowned'})).toEqual([])
  const ended=structuredClone(rage.state);ended.combatants.owner.classState.raging=false
  expect(listDnd5eActivityTriggerWindowsV1({state:ended,events:rage.events,eventBatchId:'ended'})).toEqual([])
  expect(listDnd5eActivityTriggerWindowsV1({state:rage.state,events:[{type:'class-state-changed',actorId:'owner',stateKey:'rage',active:false}],eventBatchId:'end-event'})).toEqual([])
 }finally{registration.dispose()}
})
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
it('requires live Rage and consumes one bonus action for later pulses',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'later-pulse',name:'Synthetic later pulse',activation:{kind:'bonus-action'},target:{kind:'self'},requirements:[{kind:'rage-state',subject:'actor',active:true}],consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'later-pulse'},outcomes:[{id:'pulse',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 // A supported rage gate must remain executable when imported into map controls.
 expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
 for(const bad of [{kind:'rage-state',subject:'actor',active:'true'},{kind:'rage-state',subject:'any',active:true},{kind:'rage-state',subject:'actor',active:true,override:true}])expect(validateDnd5eActivityDefinitionV1({...activity,requirements:[bad]} as any).length).toBeGreaterThan(0)
 const registration=registerDnd5eActivityPackage({packageId:'test.rage-later',packageVersion:'1.0.0',activities:[JSON.parse(JSON.stringify(activity))]})
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['later-pulse']})
 const run=(state:any)=>resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command:{schemaVersion:1,commandId:'pulse',actorId:'owner',packageId:'test.rage-later',packageVersion:'1.0.0',activityId:'later-pulse',targetIds:['owner'],expectedRevision:1},authoritativeRolls:{},confirmedBy:'actor'})
 try{
  const state=startDnd5eHeadlessCombat('later',[make('owner',20),make('other',10)])
  expect(run(state)).toMatchObject({phase:'resolve',result:{ok:false,reason:'requirement-failed'}})
  state.combatants.owner.classState.raging=true
  const result=run(state);expect(result.phase).toBe('commit')
  if(result.phase!=='commit'||!result.result.ok)throw Error(JSON.stringify(result))
  expect(result.result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
  expect(result.result.state.combatants.owner.temporaryHp).toBe(3)
  const repeat=run(result.result.state)
  expect(repeat.phase==='commit'&&repeat.result.ok).toBe(false)
  const ended=structuredClone(state);ended.combatants.owner.classState.raging=false
  expect(run(ended)).toMatchObject({phase:'resolve',result:{ok:false,reason:'requirement-failed'}})
 }finally{registration.dispose()}
})


it('does not offer rage reactions after rage ends or the reaction is spent', () => {
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'rage-hit',name:'Synthetic rage reaction',
   activation:{kind:'reaction',cost:1,reactionEvent:'after a hit'},invocation:{kind:'triggered',event:'attack-hit',confirmation:'actor-choice'},
   target:{kind:'self'},requirements:[{kind:'rage-state',subject:'actor',active:true}],
   automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'rage-hit'},
   outcomes:[{id:'pulse',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:1}}]}]}
 const registration=registerDnd5eActivityPackage({packageId:'test.rage-reaction',packageVersion:'1.0.0',activities:[JSON.parse(JSON.stringify(activity))]})
 try{
   const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['rage-hit']})
   for(const raging of [false,true])for(const reactionAvailable of [false,true]){
     const state=startDnd5eHeadlessCombat('rage-reaction',[make('owner'),make('target')])
     state.combatants.owner.classState.raging=raging
     state.combatants.owner.turn.reactionAvailable=reactionAvailable
     const windows=listDnd5eActivityTriggerWindowsV1({state,eventBatchId:'hit',events:[{type:'attack-resolved',actorId:'owner',targetId:'target',attackMode:'melee',d20:15,total:20,armorClass:10,hit:true,critical:false}]})
     expect(windows.flatMap(w=>w.available).some(a=>a.activity.id==='rage-hit')).toBe(raging&&reactionAvailable)
   }
 }finally{registration.dispose()}
})


it('checks total cover before requesting dice for a triggered creature target', async () => {
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'covered-reaction',name:'Synthetic cover reaction',
   activation:{kind:'reaction',cost:1,reactionEvent:'after a hit'},invocation:{kind:'triggered',event:'attack-hit',confirmation:'actor-choice'},
   target:{kind:'creature',relation:'any',count:1,rangeFeet:10,requiresLineOfEffect:true},
   checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'str',scope:'per-target',dc:{kind:'constant',value:12}}],
   automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'covered-reaction'},
   outcomes:[{id:'pulse',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'target',amount:{kind:'constant',value:1}}]}]}
 const registration=registerDnd5eActivityPackage({packageId:'test.cover-reaction',packageVersion:'1.0.0',activities:[JSON.parse(JSON.stringify(activity))]})
 try{
   const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['covered-reaction']})
   for(const blocked of [false,true]){
     const state=startDnd5eHeadlessCombat('cover-reaction',[make('owner'),make('target')])
     state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('owner','target')]:5}
     state.lineOfEffectBlockedByCombatantPair=blocked?{[dnd5eDirectedCombatantPairKey('owner','target')]:true}:{}
     let rolls=0
     const result=await settleDnd5eActivityTriggerWindowsV1({state,eventBatchId:'hit',combatRevision:1,confirm:async()=>true,roll:async()=>{rolls++;return [1]},events:[{type:'attack-resolved',actorId:'owner',targetId:'target',attackMode:'melee',d20:15,total:20,armorClass:10,hit:true,critical:false}]})
     expect(rolls).toBe(blocked?0:1)
     expect(result.state.combatants.target.temporaryHp).toBe(blocked?0:1)
   }
 }finally{registration.dispose()}
})

