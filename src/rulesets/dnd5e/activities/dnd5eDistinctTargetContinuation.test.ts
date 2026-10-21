import {afterEach,expect,it} from 'vitest'
import {compileDnd5eActivityPatternV1 as compile} from './dnd5eActivityPatterns'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './dnd5eActivityRegistry'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {validateDnd5eActivityContinuationV1} from './dnd5eActivityContinuation'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from '../headlessCombatEngine'
import {dnd5eCombatantPairKey} from '../headlessCombatPrimitives'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

afterEach(clearDnd5eActivityRegistryForTests)
const packageId='local.distinct-chain'
function activities(){
 const spec={schemaVersion:1 as const,id:'root',name:'Synthetic chain',source:{kind:'feature' as const,id:'root'},
  target:{kind:'creature' as const,relation:'any' as const,count:1,includeSelf:true},
  pattern:'roll-effect' as const,result:{kind:'damage' as const,damageType:'force' as const,amount:{kind:'constant' as const,value:1}},
  continuation:{nextActivityId:'next',maximumSteps:'distinct-targets' as const,excludePreviousTargets:true,maximumDistanceFromPreviousTargetFeet:30}}
 return [compile(spec),compile({...spec,id:'next',requiresContinuationFrom:'root',activation:{kind:'free'}})]
}
function fixture(count:number){
 const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,level:8,
  abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},proficiencyBonus:3,armorClass:14,currentHp:30,maxHp:30,
  temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:[packageId+':root']})
 const targets=Array.from({length:count},(_,i)=>createDnd5eCombatant({...actor,id:'t'+i,name:'T'+i,controller:'dm',initiative:10}))
 const state=startDnd5eHeadlessCombat('distinct-chain',[actor,...targets])
 state.distanceFeetByCombatantPair={}
 for(const a of Object.keys(state.combatants))for(const b of Object.keys(state.combatants))if(a!==b)state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(a,b)]=5
 return state
}

it('settles more than64 distinct targets, survives serialization, and closes when every target is used',()=>{
 const definitions=activities()
 registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:definitions})
 let state=fixture(70)
 const run=(step:number,targetIds:string[],commandId='step-'+step)=>resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:step+1,confirmedBy:'actor',authoritativeRolls:{},command:{schemaVersion:1,commandId,actorId:'actor',packageId,packageVersion:'1.0.0',activityId:step?'next':'root',targetIds,expectedRevision:step+1,...(step?{continuationId:'step-0'}:{})}})
 for(let step=0;step<71;step++){
  const targetId=step<70?'t'+step:'actor'
  if(step===1){
   expect(run(step,['t0'])).toMatchObject({phase:'resolve',result:{ok:false}})
   expect(run(step,[])).toMatchObject({phase:'resolve',result:{ok:false}})
   expect(run(step,['missing'])).toMatchObject({phase:'resolve',result:{ok:false}})
   expect(run(step,['t1','t1'])).toMatchObject({phase:'resolve',result:{ok:false}})
   expect(run(step,['t1'],'step-0')).toMatchObject({phase:'resolve',result:{ok:false}})
   const pair=dnd5eCombatantPairKey('t0','t1')
   state.distanceFeetByCombatantPair![pair]=35
   expect(run(step,['t1'])).toMatchObject({phase:'resolve',result:{ok:false,details:['continuation-target-out-of-range']}})
   state.distanceFeetByCombatantPair![pair]=5
  }
  const result=run(step,[targetId])
  expect(result.phase,JSON.stringify(result)).toBe('commit')
  if(result.phase!=='commit'||!result.result.ok)throw Error(JSON.stringify(result))
  state=JSON.parse(JSON.stringify(result.result.state))
  expect(state.combatants[targetId].currentHp).toBe(29)
  const receipt=state.combatants.actor.classState.activityContinuations!['step-0']
  expect(receipt.steps).toBe(step+1)
  expect(receipt.distinctTargetsOnly).toBe(true)
  expect(receipt.nextActivityId).toBe(step<70?'next':undefined)
 }
 expect(run(71,['t0'])).toMatchObject({phase:'resolve',result:{ok:false}})
})

it('requires exclusion for a natural target bound and preserves ordinary numeric limits',()=>{
 const [root]=activities()
 expect(validateDnd5eActivityContinuationV1(root)).toEqual([])
 for(const rule of [
  {...root.continuation!,excludePreviousTargets:false},
  {...root.continuation!,maximumSteps:0},
  {...root.continuation!,maximumSteps:1},
  {...root.continuation!,nextActivityId:undefined,maximumSteps:2,finishActivityId:'finish'},
  {...root.continuation!,maximumSteps:65},
  {...root.continuation!,maximumSteps:'unlimited'},
 ])expect(validateDnd5eActivityContinuationV1({...root,continuation:rule} as Dnd5eActivityDefinitionV1)).toContain('invalid continuation bound')
 expect(validateDnd5eActivityContinuationV1({...root,continuation:{...root.continuation!,maximumSteps:2}})).toEqual([])
 expect(validateDnd5eActivityContinuationV1({...root,continuation:{maximumSteps:1,finishActivityId:'finish',excludePreviousTargets:false}})).toEqual([])
})

it('rejects a later stage that changes the root bound mode',()=>{
 const [root,next]=activities()
 next.continuation={...next.continuation!,maximumSteps:3}
 registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[root,next]})
 const state=fixture(3)
 const command={schemaVersion:1 as const,commandId:'first',actorId:'actor',packageId,packageVersion:'1.0.0',activityId:'root',targetIds:['t0'],expectedRevision:1}
 const first=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,confirmedBy:'actor',authoritativeRolls:{},command})
 if(first.phase!=='commit'||!first.result.ok)throw Error(JSON.stringify(first))
 const rejected=resolveRegisteredDnd5eActivityInCombatV1({state:first.result.state,combatRevision:2,confirmedBy:'actor',authoritativeRolls:{},command:{...command,commandId:'second',activityId:'next',targetIds:['t1'],expectedRevision:2,continuationId:'first'}})
 expect(rejected).toMatchObject({phase:'resolve',result:{ok:false,details:['continuation-bound-mismatch']}})
 expect(first.result.state.combatants.t1.currentHp).toBe(30)
})

it('closes a matching chain when only unreachable unused creatures remain',()=>{
 registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:activities()})
 let state=fixture(2)
 state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','t0')]=100
 state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','t1')]=100
 for(let step=0;step<2;step++){
  const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:step+1,confirmedBy:'actor',authoritativeRolls:{},command:{schemaVersion:1,commandId:'range-'+step,actorId:'actor',packageId,packageVersion:'1.0.0',activityId:step?'next':'root',targetIds:['t'+step],expectedRevision:step+1,...(step?{continuationId:'range-0'}:{})}})
  if(result.phase!=='commit'||!result.result.ok)throw Error(JSON.stringify(result))
  state=result.result.state
  expect(state.combatants.actor.classState.activityContinuations!['range-0'].nextActivityId).toBe(step===0?'next':undefined)
 }
 expect(state.combatants.actor.classState.activeEffects?.some(e=>e.grantedActivities?.includes('next'))).toBe(false)
})
