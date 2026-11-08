import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eActionResult} from "../../application/combat/dnd5eCombatRules"
import {restoreActivityDeathParent,readPublishedActivityDeathParent,type ActivityDeathParentIdentity,sameActivityParentData} from './postNativeActivityParent'

export type ActivityDeathMapsSettlement=
 |{kind:'activity-death-parent-pending';identity:ActivityDeathParentIdentity}
 |{kind:'activity-death-parent-published';identity:ActivityDeathParentIdentity;result:Extract<Dnd5eActionResult,{ok:true}>}

/** Suspends the original outer action. Pending must never reach its ordinary
 * accepted ACK or publish its stale pre-summon candidate. */
export class ActivityDeathMapsSettlementSignal extends Error{
 readonly settlement:ActivityDeathMapsSettlement
 constructor(settlement:ActivityDeathMapsSettlement){super(settlement.kind);this.name='ActivityDeathMapsSettlementSignal';this.settlement=settlement}
}

export async function verifyActivityDeathMapsSettlement(input:{settlement:ActivityDeathMapsSettlement;mapId:string;combatId?:string;parentTransactionId:string},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<ActivityDeathMapsSettlement>{
 const {settlement}=input,{identity}=settlement
 if(identity.mapId!==input.mapId||identity.parentTransactionId!==input.parentTransactionId||input.combatId!==identity.combatId)throw Error('activity-death-maps:original-parent-mismatch')
 if(settlement.kind==='activity-death-parent-pending'){
  // Only the protected real waiting record can suspend this exact action.
  await restoreActivityDeathParent(identity,gateway)
  return settlement
 }
 const published=await readPublishedActivityDeathParent(identity,gateway)
 if(!sameActivityParentData(published.settlement.result,settlement.result))throw Error('activity-death-maps:unverified-publication')
 return{...settlement,result:published.settlement.result}
}
