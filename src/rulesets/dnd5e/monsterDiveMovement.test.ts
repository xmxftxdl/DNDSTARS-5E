import {expect,it} from 'vitest'
import {advanceDnd5eMonsterDiveMovement,dnd5eMonsterDiveDistanceTowardTarget} from './monsterDiveMovement'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
const first = {turnKey:'combat:1:actor',from:{x:0,y:0},to:{x:10,y:0},fromElevationFeet:40,toElevationFeet:30,
  distanceFeet:15,flying:true,voluntary:true,straight:true}
it('rejects stale positions, old turns and movement away from the current target',()=>{
 const evidence=advanceDnd5eMonsterDiveMovement(undefined,first)!
 const target={x:20,y:0,z:20}
 expect(dnd5eMonsterDiveDistanceTowardTarget(evidence,first.turnKey,evidence.last,target)).toBe(15)
 expect(dnd5eMonsterDiveDistanceTowardTarget(evidence,'combat:2:actor',evidence.last,target)).toBe(0)
 expect(dnd5eMonsterDiveDistanceTowardTarget(evidence,first.turnKey,{...evidence.last,x:11},target)).toBe(0)
 expect(dnd5eMonsterDiveDistanceTowardTarget(evidence,first.turnKey,evidence.last,{x:-10,y:0,z:50})).toBe(0)
})
it('joins descending collinear flight after serialization and starts a new segment after turning',()=>{
 const prior=JSON.parse(JSON.stringify(advanceDnd5eMonsterDiveMovement(undefined,first)))
 const second={...first,from:{x:10,y:0},to:{x:20,y:0},fromElevationFeet:30,toElevationFeet:20}
 expect(advanceDnd5eMonsterDiveMovement(prior,second)).toMatchObject({distanceFeet:30,origin:{x:0,y:0,z:40}})
 for(const patch of [{to:{x:20,y:10}},{toElevationFeet:25},{turnKey:'combat:2:actor'},{from:{x:11,y:0}}])
  expect(advanceDnd5eMonsterDiveMovement(prior,{...second,...patch})?.distanceFeet).toBe(15)
})
it('rejects nonflight, ascent, level flight, curved paths, involuntary movement and missing height',()=>{
 const prior=advanceDnd5eMonsterDiveMovement(undefined,first)
 for(const patch of [{flying:false},{voluntary:false},{straight:false},{toElevationFeet:40},
  {toElevationFeet:50},{fromElevationFeet:undefined},{distanceFeet:NaN}])
  expect(advanceDnd5eMonsterDiveMovement(prior,{...first,...patch})).toBeUndefined()
})
it('records only committed Host flight moves and keeps their height evidence across reload',()=>{
 const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:13,proficiencyBonus:2,
  currentHp:33,maxHp:33,temporaryHp:0,speed:60,movementSpeeds:{walk:20,fly:60},concentrating:false,
  position:{x:0,y:0},elevationFeet:40,groundElevationFeet:0,airborne:true,traversalMode:'fly'})
 const enemy={...structuredClone(actor),id:'enemy',controller:'dm' as const,initiative:1,position:{x:100,y:100}}
 let state=startDnd5eHeadlessCombat('dive',[actor,enemy])
 for(const [x,z] of [[10,30],[20,20]]){
  const result=resolveDnd5eHeadlessAction(state,{type:'move',actorId:'actor',to:{x,y:0},toElevationFeet:z,
   toGroundElevationFeet:0,traversalMode:'fly',distance:15,straightLine:true})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  state=JSON.parse(JSON.stringify(result.state))
 }
 expect(state.combatants.actor.classState.monsterDiveMovement).toMatchObject({distanceFeet:30,origin:{x:0,y:0,z:40},last:{x:20,y:0,z:20}})
})
