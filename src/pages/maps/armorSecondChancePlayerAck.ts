import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{SharedPlayerActionState,SharedPlayerActionAckState,SharedPlayerActionProcessedState,SharedPlayerActionRequestQueueState}from'../../lib/sharedCombatTypes'
import{getRoomSession}from'../../lib/roomSession'
import{decodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{sameActivityParentData}from'./postNativeActivityParent'
import{verifySecondChanceMapsSettlement,type SecondChanceMapsSettlement}from'./secondChanceMapsSettlement'
import type{SecondChanceCombat}from'./secondChanceHostCommit'
type Revisioned<T>=T&{_sync?:{revision?:number}}
/** Both independently persisted parents AND the exact original player ACK must
 * agree. This only witnesses an existing CAS; it can never publish one. */
export async function readCommittedSecondChanceArmorPlayerAck(input:{action:SharedPlayerActionState;settlement:Extract<SecondChanceMapsSettlement,{kind:'second-chance-parent-published'}>},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<SharedPlayerActionAckState|undefined>{
 const session=getRoomSession(),{action,settlement}=input
 if(session?.role!=='dm'||action.sourceMode!=='player'||!action.combatId)return undefined
 const journal=await gateway.loadResource<Revisioned<{parents:Record<string,{roomId:string;hostMemberId:string;mapId:string;combatId:string;parentTransactionId:string;phase:string;prepared:unknown;completed?:SecondChanceParentWire;originalRoomAction?:SharedPlayerActionState}>}>>('armor-native-parents')
 const rows=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===action.id&&row.mapId===action.mapId&&row.combatId===action.combatId)
 if(!rows.length)return undefined
 const verified=await verifySecondChanceMapsSettlement({settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},gateway)
 if(verified.kind!=='second-chance-parent-published')throw Error('armor-sc-ack:published-original-required')
 const[combat,ack,processed,queue]=await Promise.all([gateway.loadResource<Revisioned<SecondChanceCombat>>('combat'),gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<SharedPlayerActionProcessedState>('player-action-processed'),gateway.loadResource<SharedPlayerActionRequestQueueState>('player-action-requests')])
 if(getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId||getRoomSession()?.role!=='dm')throw Error('armor-sc-ack:authenticated-host-required')
 const sc=combat?.secondChanceAttacks?.[settlement.attackReceiptId],done=sc?.parentContinuation,versions=ack?.authorityRevisions,strip=(value:SharedPlayerActionState)=>{const copy={...value};delete copy.roomMemberId;return copy},json=(value:unknown)=>JSON.parse(JSON.stringify(value))
 for(const row of rows){const wire=row.completed&&decodeSecondChanceParentWire(row.completed)as{result:unknown;application:{map:{id:string}}}|undefined;if(row.roomId!==session.roomId||row.hostMemberId!==session.memberId||row.phase!=='consumed'||!row.originalRoomAction?.roomMemberId||!sameActivityParentData(strip(row.originalRoomAction),strip(action))||!sameActivityParentData(row.originalRoomAction,sc?.originalRoomAction)||!sameActivityParentData(row.prepared,sc?.parentInput?.prepared)||!wire||wire.application.map.id!==action.mapId||!sameActivityParentData(json(wire.result),done?.result))throw Error('armor-sc-ack:matching-private-original-required')}
 const member=rows[0].originalRoomAction!.roomMemberId
 if(!sc||done?.phase!=='consumed'||sc.attack.transactionId!==action.id||!ack||ack.actionId!==action.id||ack.status!=='accepted'||ack.recipientMemberId!==member||ack.mapId!==action.mapId||ack.combatId!==action.combatId||processed?.mapId!==action.mapId||processed.combatId!==action.combatId||!processed.actionIds.includes(action.id)||!queue||queue.requests.some(row=>row.id===action.id)||!versions||versions.combat!==done.combatRevision!+1||versions.characters!==done.characterRevision!+1||versions.maps!==sc.mapRevision+1||!Number.isSafeInteger(versions['armor-native-parents'])||versions['armor-native-parents']!<1||versions['armor-native-parents']!>journal!._sync!.revision!)throw Error('armor-sc-ack:matching-atomic-ack-required')
 return ack
}
