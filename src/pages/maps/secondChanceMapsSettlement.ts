import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{Dnd5eActionResult}from"../../application/combat/dnd5eCombatRules"
import type{SecondChanceCombat}from'./secondChanceHostCommit'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import{getRoomSession}from'../../lib/roomSession'
import{secondChanceParentScopeMatches}from'./secondChanceParentScope'

export type SecondChanceMapsSettlement=
 |{kind:'second-chance-parent-pending';mapId:string;combatId:string;parentTransactionId:string;attackReceiptId:string}
 |{kind:'second-chance-parent-published';mapId:string;combatId:string;parentTransactionId:string;attackReceiptId:string;result:Dnd5eActionResult}
/** An explicit control-flow branch, never a successful action result. The Maps
 * outer boundary must verify persisted identity before discarding its old CAS. */
export class SecondChanceMapsSettlementSignal extends Error{
 readonly settlement:SecondChanceMapsSettlement
 constructor(settlement:SecondChanceMapsSettlement){super(settlement.kind);this.name='SecondChanceMapsSettlementSignal';this.settlement=settlement}
}
export async function verifySecondChanceMapsSettlement(input:{settlement:SecondChanceMapsSettlement;mapId:string;combatId?:string;parentTransactionId:string},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<SecondChanceMapsSettlement>{
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-maps:host-room-required')};guard()
 const s=input.settlement
 if(s.mapId!==input.mapId||input.combatId!==undefined&&s.combatId!==input.combatId||s.parentTransactionId!==input.parentTransactionId)throw Error('second-chance-maps:parent-identity-mismatch')
 const combat=await gateway.loadResource<SecondChanceCombat>('combat');guard()
 if(!combat||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))throw Error('second-chance-maps:invalid-persisted-parent')
 const receipt=combat.secondChanceAttacks?.[s.attackReceiptId]
 if(!receipt||!secondChanceParentScopeMatches(combat,receipt,input.mapId)||receipt.attack.transactionId!==s.parentTransactionId||receipt.attack.combatId!==s.combatId||input.combatId===undefined&&(!receipt.sceneScope||receipt.originalRoomAction?.combatId!==undefined)||receipt.sceneScope&&(receipt.sceneScope.hostMemberId!==session!.memberId||receipt.sceneScope.roomId!==session!.roomId))throw Error('second-chance-maps:parent-identity-mismatch')
 if(s.kind==='second-chance-parent-pending'){
  if(receipt.attack.phase!=='hit-confirmation'||receipt.parentContinuation?.phase==='consumed')throw Error('second-chance-maps:parent-no-longer-pending')
  return s
 }
 const done=receipt.parentContinuation
 if(receipt.attack.phase!=='damage-committed'||done?.phase!=='consumed'||done.transactionId!==s.parentTransactionId||!done.result?.ok||JSON.stringify(done.result)!==JSON.stringify(s.result))throw Error('second-chance-maps:unverified-publication')
 return{...s,result:done.result}
}
