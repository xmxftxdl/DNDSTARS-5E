import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,commitDnd5eActivityExecution,dnd5eCombatantPairKey,dnd5eDirectedCombatantPairKey} from './headlessCombatEngine'
import {dnd5eActivityTriggerContextsFromCombatEventV1,listDnd5eActivityTriggerWindowsV1} from './activities/dnd5eActivityTriggerWindows'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
function setup(){
  const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='killer'?'dm':'player',initiative,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,
    temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('death-trigger',[make('killer',20),make('victim',10),make('witness',5),make('blocked',4)])
  state.physicalLineOfSightBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('blocked','victim')]:true}
  return state
}
const attack=(damage:number)=>({type:'attack' as const,actorId:'killer',targetId:'victim',attackModifier:20,d20:15,
  damage:{count:1,sides:100,rolls:[damage],bonus:0,type:'bludgeoning' as const}})
it('distinguishes unconsciousness, fatal damage and rejected actions, preserving observed witnesses',()=>{
  for(const [damage,dead] of [[10,false],[30,true],[101,false]] as const){
    const state=setup()
    state.combatants.victim.usesDeathSaves=damage===10
    const before=structuredClone(state),result=resolveDnd5eHeadlessAction(state,attack(damage))
    expect(state).toEqual(before)
    const deaths=result.events.filter(e=>e.type==='creature-died')
    expect(deaths,JSON.stringify(result)).toHaveLength(dead?1:0)
    if(!dead)continue
    expect(result.ok).toBe(true)
    expect(deaths[0]).toMatchObject({targetId:'victim',witnessIds:['killer','witness']})
    const contexts=dnd5eActivityTriggerContextsFromCombatEventV1(result.state,deaths[0],0,'batch')
    expect(contexts.map(c=>c.eligibleActorIds)).toEqual([['killer'],['witness']])
    expect(new Set(contexts.map(c=>c.eventId)).size).toBe(2)
    expect(contexts.every(c=>c.event==='creature-died'&&c.eligibleTargetIds[0]==='victim')).toBe(true)
  }
})
it('emits actual third failed death save, not every failed save',()=>{
  for(const failures of [0,2]){
    const state=setup();state.initiativeIndex=state.initiativeOrder.indexOf('victim')
    Object.assign(state.combatants.victim,{currentHp:0,usesDeathSaves:true,deathSaves:{successes:0,failures,stable:false,dead:false}})
    const result=resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'victim',d20:5})
    expect(result.ok).toBe(true)
    expect(result.events.filter(e=>e.type==='creature-died')).toHaveLength(failures===2?1:0)
  }
})
it('committed instant-death Activity produces one window and later transactions do not reannounce the corpse',()=>{
  const state=setup()
  const result=commitDnd5eActivityExecution(state,{actorId:'killer',activityId:'kill',targetIds:['victim'],
    source:{kind:'spell',id:'test-death'},resolution:{ok:true,status:'resolved',checks:[],consumptions:[],
      proposals:[{kind:'instant-death',operationId:'kill',targetId:'victim'}]}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.filter(e=>e.type==='creature-died')).toHaveLength(1)
  const later=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'killer'})
  expect(later.ok).toBe(true)
  expect(later.events.filter(e=>e.type==='creature-died')).toHaveLength(0)
})
it('accepts the explicit death lifecycle in imported Activity declarations',()=>{
  expect(validateDnd5eActivityDefinitionV1({schemaVersion:1,id:'witness-death',name:'Witness',activation:{kind:'reaction'},
    invocation:{kind:'triggered',event:'creature-died',confirmation:'actor-choice',retention:'single-event'},
    target:{kind:'creature',relation:'any',rangeFeet:60,count:1},outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:1}}]}],automation:automationCapabilityFromLegacyStatus('full')})).toEqual([])
})

it('offers death reactions only to authorized witnesses with matching type, distance and available reaction',()=>{
  const packageId='test.death-witness'
  const registration=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[{
    schemaVersion:1,id:'capture',name:'Capture',activation:{kind:'reaction'},
    invocation:{kind:'triggered',event:'creature-died',confirmation:'actor-choice',retention:'single-event'},
    target:{kind:'creature',relation:'any',count:1,rangeFeet:60,requiresLineOfSight:true},
    requirements:[{kind:'creature-type',subject:'target',types:['humanoid']}],
    consumption:[{kind:'action-economy',economy:'reaction',amount:1,consumeOn:'resolve'}],
    outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:1}}]}],
    automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'capture'},
  }]})
  try{
    for(const scenario of ['valid','far','no-reaction','wrong-type','no-grant','blocked','unknown-distance'] as const){
      const state=setup();state.combatants.victim.deathSaves.dead=true;state.combatants.victim.currentHp=0
      state.combatants.victim.creatureType=scenario==='wrong-type'?'beast':'humanoid'
      state.distanceFeetByCombatantPair=scenario==='unknown-distance'?{}:{[dnd5eCombatantPairKey('witness','victim')]:scenario==='far'?65:60}
      if(scenario==='no-reaction')state.combatants.witness.turn.reactionAvailable=false
      if(scenario==='blocked')state.physicalLineOfSightBlockedByCombatantPair![dnd5eDirectedCombatantPairKey('witness','victim')]=true
      if(scenario!=='no-grant')state.combatants.witness.classState.activeEffects=[createDnd5eMechanicalEffect({id:'grant',definitionId:'grant',label:'Grant',targetId:'witness',source:{kind:'feature',pluginId:packageId},duration:{type:'permanent'},grantedActivities:['capture']})]
      const windows=listDnd5eActivityTriggerWindowsV1({state,eventBatchId:scenario,events:[{type:'creature-died',targetId:'victim',witnessIds:['witness']}]})
      expect(windows.flatMap(w=>w.available).filter(a=>a.packageId===packageId),scenario).toHaveLength(scenario==='valid'?1:0)
    }
  }finally{registration.dispose()}
})
