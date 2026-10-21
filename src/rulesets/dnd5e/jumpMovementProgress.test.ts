import {expect,it} from 'vitest'
import {createDnd5eCombatant,resolveDnd5eHeadlessAction,startDnd5eHeadlessCombat} from './headlessCombatEngine'

it.each(['long-jump-standing','long-jump-running'] as const)('keeps cumulative distance through a serialized %s',traversalMode=>{
 const actor=createDnd5eCombatant({id:'mover',name:'Mover',controller:'player',initiative:20,
  abilities:{str:16,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 actor.classState.runningJumpApproachFeet=10
 const state=startDnd5eHeadlessCombat('jump-checkpoint',[actor,{...structuredClone(actor),id:'other',initiative:1,position:{x:100,y:100}}])
 state.combatants.mover.classState.runningJumpApproachFeet=10
 const distance=traversalMode==='long-jump-running'?8:4
 const first=resolveDnd5eHeadlessAction(state,{type:'move',actorId:'mover',to:{x:distance,y:0},distance,traversalMode,jumpSegment:'continue'})
 expect(first.ok,first.ok?'':first.reason).toBe(true)
 const saved=JSON.parse(JSON.stringify(first.state)) as typeof state
 expect(saved.combatants.mover.classState.runningJumpApproachFeet).toBe(0)
 expect(saved.combatants.mover.classState.jumpMovementProgress?.distanceFeet).toBe(distance)
 const finish={type:'move' as const,actorId:'mover',to:{x:distance*2,y:0},distance,traversalMode,jumpSegment:'finish' as const}
 const second=resolveDnd5eHeadlessAction(saved,finish)
 expect(second.ok).toBe(true)
 expect(second.state.combatants.mover.classState.jumpMovementProgress).toBeUndefined()
 expect(second.state.combatants.mover.turn.movementRemaining).toBe(30-distance*2)
 const tooFar=resolveDnd5eHeadlessAction(saved,{...finish,to:{x:distance*2+1,y:0},distance:distance+1})
 expect(tooFar.ok).toBe(false)
 expect(tooFar.state).toEqual(saved)
 for(const mutation of ['turn','position','elevation','mode'] as const){
  const stale=structuredClone(saved)
  if(mutation==='turn')stale.round++
  if(mutation==='position')stale.combatants.mover.position.y=1
  if(mutation==='elevation')stale.combatants.mover.elevationFeet=1
  const result=resolveDnd5eHeadlessAction(stale,{...finish,traversalMode:mutation==='mode'?(traversalMode==='long-jump-standing'?'long-jump-running':'long-jump-standing'):traversalMode})
  expect(result.ok,mutation).toBe(false)
 }
})

it('does not reset the high-jump limit at an intermediate checkpoint',()=>{
 const actor=createDnd5eCombatant({id:'mover',name:'Mover',controller:'player',initiative:20,
  abilities:{str:16,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('jump-height',[actor,{...structuredClone(actor),id:'other',initiative:1,position:{x:100,y:100}}])
 const first=resolveDnd5eHeadlessAction(state,{type:'move',actorId:'mover',to:{x:2,y:0},distance:2,toElevationFeet:1,traversalMode:'long-jump-standing',jumpSegment:'continue'})
 expect(first.ok,first.ok?'':first.reason).toBe(true)
 const second=resolveDnd5eHeadlessAction(first.state,{type:'move',actorId:'mover',to:{x:4,y:0},distance:2,toElevationFeet:4,traversalMode:'long-jump-standing',jumpSegment:'finish'})
 expect(second.ok).toBe(false)
})


