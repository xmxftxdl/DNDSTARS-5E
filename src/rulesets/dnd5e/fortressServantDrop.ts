import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import type {Dnd5eTurnEconomyCounts} from '../../lib/sharedCombatTypes'
import {resolveDnd5eFortressServantControl} from './fortressServantControl'
import {normalizeDnd5eCompanionCarriedObjects,droppedDnd5eCompanionObjects} from './companionCarriedObjects'
import {spendDnd5eTurnResource} from './turnEconomy'

export function prepareDnd5eFortressServantDrop(input:{map:BattleMap;geometry:MapGeometryState;commanderTokenId:string;servantTokenId:string;
 worldMinute:number;carriedObjectId:string;expectedPickupReceipt:string;combatActive:boolean;combat?:{currentTokenId:string;turnEconomy:Dnd5eTurnEconomyCounts}}){
 const fail=(reason:string)=>({ok:false as const,reason})
 const control=resolveDnd5eFortressServantControl(input)
 if(!control||(control.servant.hp??0)<=0)return fail('fortress-drop-unauthorized')
 const held=normalizeDnd5eCompanionCarriedObjects(control.servant.dnd5eCarriedObjects)
 const item=held?.find(item=>item.id===input.carriedObjectId)
 if(!item||item.pickupReceipt!==input.expectedPickupReceipt)return fail('fortress-drop-item-changed')
 const dropped=droppedDnd5eCompanionObjects({...control.servant,dnd5eCarriedObjects:[item]})[0]
 if(!dropped||input.map.tokens.some(token=>token.id===dropped.id))return fail('fortress-drop-id-conflict')
 let turnEconomy:Dnd5eTurnEconomyCounts|undefined
 if(input.combatActive){
  if(!input.combat||input.combat.currentTokenId!==control.commander.id)return fail('drop-invalid-turn')
  const spent=spendDnd5eTurnResource(input.combat.turnEconomy,'bonusAction')
  if(!spent.ok)return fail('drop-action-unavailable')
  turnEconomy=spent.economy
 }
 const remaining=held!.filter(candidate=>candidate.id!==item.id)
 return {ok:true as const,turnEconomy,message:`${control.servant.label} 放下 ${item.label}。`,map:{...input.map,tokens:[
  ...input.map.tokens.map(token=>token.id===control.servant.id?{...token,dnd5eCarriedObjects:remaining.length?remaining:undefined}:token),dropped]}}
}
