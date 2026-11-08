import type{SharedRoomGatewayPort,SharedResourceTransactionWrite}from'../../ports/sharedRoomGateway'
import type{SharedPlayerActionState,SharedPlayerActionRequestQueueState,SharedPlayerActionProcessedState,SharedPlayerActionAckState}from'../../lib/sharedCombatTypes'
import{buildPlayerActionAck,buildPlayerActionProcessedState}from'../../lib/playerActionAck'
import{capturePlayerActionResultBaseline}from'../../lib/playerActionResult'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
type Versioned<T>=T&{_sync?:{revision?:number}}
const revision=(value:Versioned<object>|null)=>{const n=value?._sync?.revision??0;if(!Number.isSafeInteger(n)||n<0)throw Error('second-chance-ack:revision-required');return n}
/** Current queue identity is checked after all Activity waits and guarded in the same final CAS. */
export async function prepareSecondChanceSpecterPlayerAck(input:{action:SharedPlayerActionState;before:{characters:readonly Character[];map:BattleMap};after:{characters:readonly Character[];map:BattleMap};round:number;initiativeIndex:number},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<SharedResourceTransactionWrite[]>{
 const action=input.action
 if(action.sourceMode!=='player'||!action.roomMemberId||action.status!=='pending')throw Error('second-chance-ack:authenticated-original-required')
 const[queue,processed,ack]=await Promise.all([gateway.loadResource<Versioned<SharedPlayerActionRequestQueueState>>('player-action-requests'),gateway.loadResource<Versioned<SharedPlayerActionProcessedState>>('player-action-processed'),gateway.loadResource<Versioned<SharedPlayerActionAckState>>('player-action-ack')])
 if(!queue||JSON.stringify(queue.requests.find(row=>row.id===action.id))!==JSON.stringify(action)||processed?.actionIds.includes(action.id))throw Error('second-chance-ack:current-original-queue-required')
 const now=Date.now(),accepted=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,combatId:action.combatId,round:input.round,initiativeIndex:input.initiativeIndex,appliedAt:now,before:capturePlayerActionResultBaseline({...input.before,characters:[...input.before.characters]}),after:capturePlayerActionResultBaseline({...input.after,characters:[...input.after.characters]})})
 return[{name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.filter(row=>row.id!==action.id),updatedAt:now}},{name:'player-action-processed',expectedRevision:revision(processed),data:buildPlayerActionProcessedState({action,current:processed,updatedAt:now})},{name:'player-action-ack',expectedRevision:revision(ack),data:accepted}]
}

import{getRoomSession}from'../../lib/roomSession'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import type{SecondChanceCombat}from'./secondChanceHostCommit'
import type{SecondChanceMapsSettlement}from'./secondChanceMapsSettlement'
/** An actual matching consumed original and server-enriched same-batch ACK are
 * required; an unrelated processed ID never suppresses an outer write. */
export async function readCommittedSecondChanceSpecterPlayerAck(input:{action:SharedPlayerActionState;settlement:Extract<SecondChanceMapsSettlement,{kind:'second-chance-parent-published'}>},gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const session=getRoomSession(),{action,settlement}=input
 if(session?.role!=='dm'||action.sourceMode!=='player'||!action.roomMemberId||settlement.parentTransactionId!==action.id||settlement.mapId!==action.mapId)return undefined
 const[combat,ack,processed,queue,journal]=await Promise.all([gateway.loadResource<Versioned<SecondChanceCombat>>('combat'),gateway.loadResource<Versioned<SharedPlayerActionAckState>>('player-action-ack'),gateway.loadResource<Versioned<SharedPlayerActionProcessedState>>('player-action-processed'),gateway.loadResource<Versioned<SharedPlayerActionRequestQueueState>>('player-action-requests'),gateway.loadResource<{parents:Record<string,{parentTransactionId:string;mapId:string;combatId:string;phase:string;scParent?:unknown}>}>('activity-death-parents')])
 if(getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId||getRoomSession()?.role!=='dm')throw Error('second-chance-ack:host-session-changed')
 const relevant=Object.values(journal?.parents??{}).filter(row=>row.scParent&&row.parentTransactionId===action.id&&row.mapId===action.mapId&&row.combatId===settlement.combatId)
 if(!relevant.length)return undefined
 const row=combat?.secondChanceAttacks?.[settlement.attackReceiptId],done=row?.parentContinuation,versions=ack?.authorityRevisions
 if(!combat||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks)||combat.mapId!==action.mapId||combat.combatId!==settlement.combatId||!row||row.hostControllerMemberId!==session.memberId||JSON.stringify(row.originalRoomAction)!==JSON.stringify(action)||row.attack.transactionId!==action.id||done?.phase!=='consumed'||JSON.stringify(done.result)!==JSON.stringify(settlement.result)||relevant.some(record=>record.phase!=='consumed')||!ack||ack.status!=='accepted'||ack.actionId!==action.id||ack.mapId!==action.mapId||ack.combatId!==action.combatId||ack.recipientMemberId!==action.roomMemberId||processed?.mapId!==action.mapId||processed.combatId!==action.combatId||!processed.actionIds.includes(action.id)||!queue||queue.requests.some(request=>request.id===action.id)||!versions||versions.combat!==done.combatRevision!+1||versions.characters!==done.characterRevision!+1||versions.maps!==row.mapRevision+1||!Number.isSafeInteger(versions['activity-death-parents']))throw Error('second-chance-ack:matching-atomic-completion-required')
 return ack
}
