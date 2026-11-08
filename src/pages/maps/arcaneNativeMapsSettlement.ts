import type {SharedPlayerActionState,SharedPlayerActionAckState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eActionResult} from '../../rulesets/dnd5e/headlessCombatEngine'
import {getRoomSession} from '../../lib/roomSession'
import {decodeSecondChanceParentWire,type SecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {sameArcaneNativeData} from './arcaneNativeIdentity'
import {restoreArcaneNativeIssuedParent} from './arcaneNativeRoomIssuer'
import type {Dnd5eMapResultPlan} from '../../application/combat/dnd5eCombatRules'

export interface ArcaneNativePublishedSettlement {result:Dnd5eActionResult;application:Dnd5eMapResultPlan}
export function readArcaneNativePublishedSettlement(value:unknown):ArcaneNativePublishedSettlement{
 const row=value as Partial<ArcaneNativePublishedSettlement>|null
 if(!row||!row.result?.ok||typeof row.result.state?.combatId!=='string'||!Array.isArray(row.result.events)||typeof row.application?.map?.id!=='string'||!Array.isArray(row.application.characters))throw Error('arcane-maps:invalid-completed-envelope')
 return row as ArcaneNativePublishedSettlement
}

export type ArcaneNativeMapsSettlement={kind:'arcane-native-parent-pending'|'arcane-native-parent-published';parentId:string;mapId:string;combatId:string;parentTransactionId:string;result?:Dnd5eActionResult}
export class ArcaneNativeMapsSettlementSignal extends Error{readonly settlement:ArcaneNativeMapsSettlement;constructor(settlement:ArcaneNativeMapsSettlement){super(settlement.kind);this.name='ArcaneNativeMapsSettlementSignal';this.settlement=settlement}}
/** A control-flow signal supplies no publication authority. Re-read the
 * private issued original before accepting either suspension or completion. */
export async function verifyArcaneNativeMapsSettlement(input:{settlement:ArcaneNativeMapsSettlement;mapId:string;combatId:string;parentTransactionId:string},gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('arcane-maps:authenticated-host-required')};guard()
 const s=input.settlement
 if(s.mapId!==input.mapId||s.combatId!==input.combatId||s.parentTransactionId!==input.parentTransactionId)throw Error('arcane-maps:original-identity-required')
 const journal=await gateway.loadResource<{parents:Record<string,{roomId:string;hostMemberId:string;mapId:string;combatId:string;parentTransactionId:string;phase:string;completed?:SecondChanceParentWire}>}>('arcane-native-parents');guard()
 const parent=journal?.parents[s.parentId]
 if(!parent||parent.roomId!==session!.roomId||parent.hostMemberId!==session!.memberId||parent.mapId!==s.mapId||parent.combatId!==s.combatId||parent.parentTransactionId!==s.parentTransactionId)throw Error('arcane-maps:original-private-parent-required')
 if(s.kind==='arcane-native-parent-pending'){
  if(parent.phase!=='arcane'&&parent.phase!=='shroud')throw Error('arcane-maps:parent-not-pending')
  await restoreArcaneNativeIssuedParent(s.parentId,{...gateway,saveResourcesAtomically:async()=>{throw Error('arcane-maps:read-only-verifier')}});guard();return s
 }
 if(parent.phase!=='consumed'||!parent.completed)throw Error('arcane-maps:unverified-publication')
 const completed=readArcaneNativePublishedSettlement(decodeSecondChanceParentWire(parent.completed));guard()
 if(completed.result.state.combatId!==s.combatId||completed.application.map.id!==s.mapId||!sameArcaneNativeData(completed.result,s.result))throw Error('arcane-maps:unverified-publication')
 return {...s,result:completed.result}
}

/** Publication already wrote this ACK in the same original-command CAS. */
export async function readCommittedArcaneNativePlayerAck(input:{action:SharedPlayerActionState;settlement:ArcaneNativeMapsSettlement},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<SharedPlayerActionAckState>{
 const session=getRoomSession(),{action,settlement}=input
 if(!session||session.role!=='dm'||!action.combatId||settlement.kind!=='arcane-native-parent-published')throw Error('arcane-maps:published-original-command-required')
 await verifyArcaneNativeMapsSettlement({settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},gateway)
 const [journal,ack,processed,queue]=await Promise.all([gateway.loadResource<{parents:Record<string,{originalRoomAction?:SharedPlayerActionState}>}>('arcane-native-parents'),gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<{actionIds:string[]}>('player-action-processed'),gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests')])
 const now=getRoomSession(),saved=journal?.parents[settlement.parentId]?.originalRoomAction,strip=(value:SharedPlayerActionState)=>{const row={...value};delete row.roomMemberId;return row}
 if(now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId||!saved?.roomMemberId||saved.sourceMode!=='player'||!sameArcaneNativeData(strip(saved),strip(action))||ack?.actionId!==action.id||ack.status!=='accepted'||ack.recipientMemberId!==saved.roomMemberId||!processed?.actionIds.includes(action.id)||!queue||queue.requests.some(row=>row.id===action.id))throw Error('arcane-maps:matching-original-atomic-ack-required')
 return ack
}
