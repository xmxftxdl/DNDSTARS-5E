import {planDnd5eHitFollowContinuation} from './weaponHitFollowPlan'
import {planDnd5eMapResultApplication,refreshDnd5eMapSpatialRelations} from './mapBridge'
import {prepareDnd5eOpportunityAttack,resolvePreparedDnd5eOpportunityAttack,type Dnd5eOpportunityMovementWindow} from './opportunityAttackAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'

export interface Dnd5eHitFollowOpportunityReceipt {
 attackerId:string
 window:Pick<Dnd5eOpportunityMovementWindow,'pathSegmentIndex'|'position'|'trigger'>
 rolls:Omit<Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0],'prepared'>
}

/** Replay one attack at its Host-derived trigger point. The owning movement
 * transaction must settle the preceding path and combine movement events;
 * this result is not a complete follow or a room publication. */
export function replayDnd5eHitFollowOpportunity(input:Parameters<typeof planDnd5eHitFollowContinuation>[0]&{
 receipt:Dnd5eHitFollowOpportunityReceipt
}){
 const ready=prepareDnd5eHitFollowOpportunity({...input,attackerId:input.receipt.attackerId})
 if(!ready.ok)return ready
 const expected=ready.window,received=input.receipt.window
 if(!received||received.pathSegmentIndex!==expected.pathSegmentIndex||received.trigger!==expected.trigger||
  !received.position||received.position.x!==expected.position.x||received.position.y!==expected.position.y||
  received.position.elevationFeet!==expected.position.elevationFeet){
  return {ok:false as const,reason:'follow-opportunity-window-changed'}
 }
 // Keep prepared last: untrusted extra properties cannot replace the Host snapshot or weapon.
 const resolved=resolvePreparedDnd5eOpportunityAttack({...input.receipt.rolls,prepared:ready.prepared})
 if(!resolved.result.ok)return {ok:false as const,reason:resolved.result.reason}
 if(resolved.airborneFalls?.length)return {ok:false as const,reason:'follow-opportunity-fall-settlement-required'}
 return {ok:true as const,window:expected,result:resolved.result}
}

/** Host preview at the first legal opportunity window; does not publish movement or spend resources. */
export function prepareDnd5eHitFollowOpportunity(input:Parameters<typeof planDnd5eHitFollowContinuation>[0]&{attackerId:string}){
 const plan=planDnd5eHitFollowContinuation(input)
 if(!plan.ok)return plan
 const window=plan.opportunities.find(candidate=>candidate.attacker.id===input.attackerId)
 if(!window)return {ok:false as const,reason:'follow-opportunity-not-found'}
 const state=structuredClone(input.state),mover=state.combatants[input.actorId]
 mover.position={x:window.position.x,y:window.position.y};mover.elevationFeet=window.position.elevationFeet
 // The movement reaction is already committed before any opportunity can be taken.
 mover.turn.reactionAvailable=false
 const ready=prepareDnd5eHitFollowOpportunityAtCurrentPosition({...input,state,map:plan.map,characters:plan.characters})
 return ready.ok?{...ready,window}:ready
}

/** Host-only attack preparation at an already reached and separately authorized
 * window. Does not move the combatant or restore its spent movement reaction. */
export function prepareDnd5eHitFollowOpportunityAtCurrentPosition(input:Pick<Parameters<typeof planDnd5eHitFollowContinuation>[0],
 'state'|'map'|'characters'|'actorId'>&{attackerId:string}){
 const state=structuredClone(input.state)
 const characterIdByCombatantId=Object.fromEntries(input.map.tokens.flatMap(token=>token.characterId?[[token.id,token.characterId]]:[]))
 const projected=planDnd5eMapResultApplication({state,map:input.map,characters:input.characters,characterIdByCombatantId,events:[]})
 const economy=(id:string)=>{
  const actor=state.combatants[id],value=createDnd5eTurnEconomyCounts('hit-follow',actor.speed)
  value.action.current=actor.turn.actionAvailable?1:0;value.bonusAction.current=actor.turn.bonusActionAvailable?1:0
  value.reaction.current=actor.turn.reactionAvailable?1:0;value.movement.current=actor.turn.movementRemaining
  return value
 }
 const prepared=prepareDnd5eOpportunityAttack({initiativeIndex:state.initiativeIndex,combatId:state.combatId,round:state.round,map:projected.map,characters:projected.characters,
  initiativeOrder:state.initiativeOrder.flatMap(id=>{const token=projected.map.tokens.find(candidate=>candidate.id===id)
   return token?[{tokenId:id,label:token.label,emoji:token.emoji,color:token.color,roll:state.combatants[id].initiative}]:[]}),
  actorTokenId:input.attackerId,targetTokenId:input.actorId,turnEconomy:economy(input.attackerId),targetTurnEconomy:economy(input.actorId)})
 if(!prepared.ok)return prepared
 refreshDnd5eMapSpatialRelations(state,projected.map,[],{geometry:state.companionScene?.geometry})
 return {ok:true as const,prepared:{...prepared.prepared,state}}
}
