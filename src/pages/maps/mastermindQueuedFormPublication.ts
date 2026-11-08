import type {SharedPlayerActionAckState,SharedPlayerActionProcessedState} from '../../lib/sharedCombatTypes'
import {buildPlayerActionAck,buildPlayerActionProcessedState} from '../../lib/playerActionAck'
import {publishPlayerActionAckWithSnapshots} from '../../lib/playerActionAckPublish'
import {loadSharedResource,saveSharedResourcesAtomically,publishSharedEvent} from "../../composition/browserSharedRoomResources"
import {getRoomSession} from '../../lib/roomSession'
import {readMastermindQueuedFormCompleted} from './mastermindQueuedFormParent'

type Gateway={loadResource:typeof loadSharedResource;saveResourcesAtomically:typeof saveSharedResourcesAtomically;session:()=>{roomId:string;memberId:string;role:string}|null;publishAck:(ack:SharedPlayerActionAckState)=>Promise<void>}
const defaultGateway:Gateway={loadResource:loadSharedResource,saveResourcesAtomically:saveSharedResourcesAtomically,session:getRoomSession,publishAck:ack=>publishSharedEvent('player-action-dm-to-player',ack)}
type View=Awaited<ReturnType<typeof readMastermindQueuedFormCompleted>>
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const plans=new WeakMap<object,{view:View;gateway:Gateway;hostMemberId:string;appliedAt:number;ack:SharedPlayerActionAckState;processed:SharedPlayerActionProcessedState;expected:Record<string,number>;snapshotSignature:string}>()

/** The existing normal publisher receives only this actual Base completion's
 * fixed snapshots. This is the original queued action, with no Host surrogate. */
export async function publishMastermindQueuedFormCompleted(completed:object,gateway:Gateway=defaultGateway){
 let plan=plans.get(completed)
 const session=gateway.session();if(session?.role!=='dm')throw Error('mastermind-queued-form-publication:current-Host-required')
 if(!plan){
  const view=await readMastermindQueuedFormCompleted(completed)
  if(session.roomId!==view.roomId||session.memberId!==view.hostMemberId)throw Error('mastermind-queued-form-publication:current-room-required')
  const [processed,ack]=await Promise.all([gateway.loadResource<SharedPlayerActionProcessedState&{_sync?:{revision:number}}>('player-action-processed'),gateway.loadResource<SharedPlayerActionAckState&{_sync?:{revision:number}}>('player-action-ack')]),appliedAt=Date.now()
  const expected={...view.expectedRevisions,'player-action-processed':processed?._sync?.revision??0,'player-action-ack':ack?._sync?.revision??0}
  if(Object.values(expected).some(value=>!Number.isSafeInteger(value)||value<0))throw Error('mastermind-queued-form-publication:original-versions-required')
  plan={view,gateway,hostMemberId:session.memberId,appliedAt,expected,ack:buildPlayerActionAck({action:view.action,status:'accepted',mapId:view.action.mapId,combatId:view.action.combatId,round:view.snapshots.combat.round,initiativeIndex:view.snapshots.combat.initiativeIndex,appliedAt}),processed:buildPlayerActionProcessedState({action:view.action,current:processed,updatedAt:appliedAt}),snapshotSignature:JSON.stringify(view.snapshots)}
  plans.set(completed,plan)
 }
 if(plan.gateway!==gateway||session.roomId!==plan.view.roomId||session.memberId!==plan.hostMemberId||JSON.stringify(plan.view.snapshots)!==plan.snapshotSignature)throw Error('mastermind-queued-form-publication:same-fixed-plan-required')
 const priorAck=await gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),priorProcessed=await gateway.loadResource<SharedPlayerActionProcessedState>('player-action-processed')
 if(priorAck?.actionId===plan.view.action.id&&priorProcessed?.actionIds.includes(plan.view.action.id)){
  const authorityRevisions=Object.fromEntries(['characters','maps','combat','player-action-processed','player-action-ack'].map(name=>[name,plan.expected[name]+1]))
  if(!same({...priorAck,_sync:undefined,authorityRevisions:undefined},{...plan.ack,_sync:undefined,authorityRevisions:undefined})||!same(priorAck.authorityRevisions,authorityRevisions)||priorProcessed.mapId!==plan.view.action.mapId||priorProcessed.combatId!==plan.view.action.combatId||priorProcessed.actionIds.filter(id=>id===plan!.view.action.id).length!==1)throw Error('mastermind-queued-form-publication:committed-original-mismatch')
  return
 }
 await readMastermindQueuedFormCompleted(completed)
 await publishPlayerActionAckWithSnapshots({ack:plan.ack,processed:plan.processed,snapshots:{...plan.view.snapshots,updatedAt:plan.appliedAt},expectedRevisions:plan.expected,saveSharedResource:async()=>{throw Error('mastermind-queued-form-publication:atomic-required')},commitSharedResources:gateway.saveResourcesAtomically,loadSharedResource:gateway.loadResource,publishAck:gateway.publishAck})
}
