import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eCombatEvent } from './headlessCombatEngine'
import { isDnd5eCompanionTask } from './companionTask'
type Order=NonNullable<NonNullable<Token['dnd5eCombatState']>['companionCommand']>
/** DM acknowledgement only; no dice, movement, action economy or ownership is granted. */
export function completeDnd5eCompanionTask(input:{map:BattleMap;tokenId:string;expectedOrder:Order;isDm:boolean}):{map:BattleMap;event:Dnd5eCombatEvent}|undefined {
 const token=input.map.tokens.find(token=>token.id===input.tokenId)
 const order=token?.dnd5eCombatState?.companionCommand
 if(!input.isDm || !token || !order || order.command!=='task' || !isDnd5eCompanionTask(order.task) ||
   JSON.stringify(order)!==JSON.stringify(input.expectedOrder) || !token.dnd5eSummon ||
   token.dnd5eSummon.sourceTokenId!==order.sourceOwnerId || token.dnd5eSummon.featureId!==order.sourceFeatureId ||
   token.dnd5eSummon.controlEnded && order.voluntaryForTokenId!==token.id) return undefined
 return {map:{...input.map,tokens:input.map.tokens.map(current=>current.id!==token.id?current:{...current,dnd5eCombatState:{...current.dnd5eCombatState,companionCommand:undefined}})},
  event:{type:'companion-order-completed',actorId:token.id,sourceOwnerId:order.sourceOwnerId,command:'task',taskDescription:order.task.description}}
}
