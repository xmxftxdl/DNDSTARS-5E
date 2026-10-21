import {resolveDnd5eHeadlessAction,dnd5eEffectiveWalkSpeed,type Dnd5eAction,type Dnd5eActionResult,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {planDnd5eWeaponHitPushAndFollow} from './weaponHitMovement'
import type {BattleMap} from '../../store/maps'
import type {GridCell} from '../../lib/gridCombat'

type Move=Extract<Dnd5eAction,{type:'move'}>
/** Host-only movement phase. The owning hit transaction must authorize the feature
 * and settle opportunity attacks before calling with the resulting state. */
export function resolveDnd5eHitFollowMovementAfterReactions(input:{
 state:Dnd5eHeadlessCombatState;map:BattleMap;actorId:string;targetId:string;cell:GridCell;
 rolls?:Pick<Move,'boundarySavingThrows'|'movementRepeatSavingThrows'|'fallingDamageRolls'|'fallingDamageRollsByCombatantId'>
}):Dnd5eActionResult|{ok:false;state:Dnd5eHeadlessCombatState;events:[];reason:string}{
 const reject=(reason:string)=>({ok:false as const,state:input.state,events:[] as [],reason})
 if(input.state.initiativeOrder[input.state.initiativeIndex]!==input.actorId)return reject('follow-own-turn-required')
 const plan=planDnd5eWeaponHitPushAndFollow({...input,maximumPushFeet:0,followCell:input.cell})
 if(!plan.ok)return reject(plan.reason)
 if(!plan.follow)return reject('follow-destination-required')
 const working=structuredClone(input.state),actor=working.combatants[input.actorId]
 const ordinary={remaining:actor.turn.movementRemaining,spent:actor.turn.movementSpent}
 actor.turn.movementRemaining=dnd5eEffectiveWalkSpeed(actor);actor.turn.movementSpent=0
 actor.turn.reactionAvailable=false
 const points=plan.follow.path
 const distance=points.slice(1).reduce((sum,point,index)=>sum+Math.max(Math.abs(point.x-points[index].x),Math.abs(point.y-points[index].y)),0)
  /input.map.gridSize*Math.max(1,input.map.feetPerCell??5)
 const result=resolveDnd5eHeadlessAction(working,{...input.rolls,type:'move',actorId:input.actorId,to:plan.follow.position,
  distance,movementCost:plan.follow.movementCostFeet,traversalMode:'walk',jumpPath:points,toElevationFeet:plan.follow.position.elevationFeet})
 if(!result.ok)return reject(result.reason)
 const moved=result.state.combatants[input.actorId]
 moved.turn.movementRemaining=ordinary.remaining;moved.turn.movementSpent=ordinary.spent
 return {...result,events:[{type:'turn-resource-spent',actorId:input.actorId,resource:'reaction'},...result.events]}
}
