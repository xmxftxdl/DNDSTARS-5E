import type{SharedRoomGatewayPort,SharedResourceTransactionWrite}from'../../ports/sharedRoomGateway'
import type{SharedCombatState,SharedPlayerActionState,SharedPlayerActionAckState,SharedPlayerActionProcessedState}from'../../lib/sharedCombatTypes'
import{getRoomSession}from'../../lib/roomSession'
import{buildPlayerActionAck,buildPlayerActionProcessedState}from'../../lib/playerActionAck'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{readArcaneOrdinaryMoveParent,assertArcaneOrdinaryMoveCurrent,type ArcaneOrdinaryMoveParent}from'./arcaneOrdinaryMoveParent'
import{readArcaneOrdinaryMovementReady,type ArcaneOrdinaryMovementReady}from'./arcaneMovementHazardCheckpoint'
import{sameArcaneNativeData}from'./arcaneNativeIdentity'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Rev={_sync?:{revision?:number}}
interface Row{phase:'waiting'|'consumed';roomId:string;hostMemberId:string;requestId:string;firstHostNow:number;definitionSignature:string;command:SharedPlayerActionState;dependencies:Record<string,number>;checkpoint?:{id:string};completed?:{settlement:SecondChanceParentWire}}
type Journal=Rev&{schemaVersion:1;parents:Record<string,Row>}
function revision(v:Rev|null){if(v===null)return 0;const n=v._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('arcane-move:current-revision-required');return n!}
function host(){const session=getRoomSession();if(!session||session.role!=='dm')throw Error('arcane-move:authenticated-host-required');return session}
export async function readArcaneOrdinaryMovementPublished(parentId:string,gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const session=host(),journal=await gateway.loadResource<Journal>('arcane-movement-parents'),row=journal?.parents[parentId];host();if(!row||row.phase!=='consumed')return undefined
 if(row.roomId!==session.roomId||row.hostMemberId!==session.memberId||!row.completed?.settlement)throw Error('arcane-move:published-parent-witness-required')
 const [queue,ack,processed]=await Promise.all([gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests'),gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<SharedPlayerActionProcessedState>('player-action-processed')]);host()
 if(!processed?.actionIds.includes(row.requestId)||queue?.requests.some(c=>c.id===row.requestId)||ack?.actionId===row.requestId&&(ack.status!=='accepted'||ack.recipientMemberId!==row.command.roomMemberId))throw Error('arcane-move:accepted-original-command-witness-required')
 return{status:'published' as const,alreadyPublished:true,settlement:decodeSecondChanceParentWire(row.completed.settlement)}
}
/** One original move publication. Raw/owner journals are consumed together with
 * maps, characters, counted pools and the real queued PC ACK, never separately. */
export async function publishArcaneOrdinaryMovement(parent:ArcaneOrdinaryMoveParent,ready:ArcaneOrdinaryMovementReady,gateway:Gateway){
 const original=readArcaneOrdinaryMoveParent(parent),id=original.serverParentId;if(!id)throw Error('arcane-move:server-issued-parent-required');const published=await readArcaneOrdinaryMovementPublished(id,gateway);if(published)return published
 const plan=await readArcaneOrdinaryMovementReady(parent,ready,gateway),journal=await gateway.loadResource<Journal>('arcane-movement-parents'),row=journal?.parents[id];await assertArcaneOrdinaryMoveCurrent(parent,gateway)
 if(!row||row.phase!=='waiting'||row.firstHostNow!==original.firstHostNow||row.definitionSignature!==original.definitionSignature||!sameArcaneNativeData(row.command,original.command)||row.checkpoint?.id!==plan.checkpointId)throw Error('arcane-move:original-waiting-parent-required')
 const [maps,characters,combat,queue,ack,processed]=await Promise.all([gateway.loadResource<Rev&{maps:typeof plan.result.map[]}>('maps'),gateway.loadResource<Rev&{characters:typeof plan.result.application.characters}>('characters'),gateway.loadResource<Rev&SharedCombatState>('combat'),gateway.loadResource<Rev&{requests:SharedPlayerActionState[]}>('player-action-requests'),gateway.loadResource<Rev&SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<Rev&SharedPlayerActionProcessedState>('player-action-processed')]);await assertArcaneOrdinaryMoveCurrent(parent,gateway)
 if(!maps||!characters||!combat||!queue||!original.native.result.ok||!sameArcaneNativeData(queue.requests.find(c=>c.id===original.command.id),original.command))throw Error('arcane-move:original-world-required')
 const baseline=original.native.result.state,economy={...combat.dnd5eTurnEconomyByToken};for(const [token,actor]of Object.entries(plan.result.state.combatants)){const beforeActor=baseline.combatants[token];if(!beforeActor)throw Error('arcane-move:unknown-parent-combatant');const active=combat.initiativeOrder[combat.initiativeIndex],turnKey=`${combat.combatId}:${combat.round}:${active?.tokenId===token?active.slotId??token:token}`,before=economy[token]??projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(turnKey,beforeActor.speed),beforeActor.turn,beforeActor.speed);economy[token]=projectDnd5eHeadlessTurnEconomy(before,actor.turn,actor.speed)}
 const now=Date.now(),position=plan.result.finalPositionByCombatantId[original.command.actorTokenId],settlement={native:original.native,movementPrefix:plan.movementPrefix,acceptedMovement:plan.acceptedMovement,children:plan.children,result:plan.result},completed={schemaVersion:1,parentId:id,originalCommandId:row.requestId,firstHostNow:row.firstHostNow,definitionSignature:row.definitionSignature,requestIds:plan.requestIds,checkpointId:plan.checkpointId,settlement:encodeSecondChanceParentWire(settlement)},writes:SharedResourceTransactionWrite[]=[
 {name:'maps',expectedRevision:revision(maps),data:{...maps,maps:maps.maps.map(m=>m.id===plan.result.map.id?plan.result.map:m),updatedAt:now}},
 {name:'characters',expectedRevision:revision(characters),data:{...characters,characters:plan.result.application.characters,updatedAt:now}},
 {name:'combat',expectedRevision:revision(combat),data:{...combat,dnd5eTurnEconomyByToken:economy,updatedAt:now}},
 {name:'arcane-movement-parents',expectedRevision:revision(journal),data:{...journal,parents:{...journal!.parents,[id]:{...row,phase:'consumed',completed}}}},
 {name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.filter(c=>c.id!==row.requestId),updatedAt:now}},
 {name:'player-action-processed',expectedRevision:revision(processed),data:buildPlayerActionProcessedState({action:original.command,current:processed,updatedAt:now})},
 {name:'player-action-ack',expectedRevision:revision(ack),data:buildPlayerActionAck({action:original.command,status:'accepted',mapId:plan.result.map.id,combatId:combat.combatId,round:combat.round,initiativeIndex:combat.initiativeIndex,appliedAt:now,acceptedPosition:position,acceptedElevationFeet:plan.result.state.combatants[original.command.actorTokenId]?.elevationFeet})}]
 await assertArcaneOrdinaryMoveCurrent(parent,gateway)
 try{await gateway.saveResourcesAtomically(writes,{transactionId:'arcane-move-publish:'+id,readRevisions:{'map-geometry':original.dependencies['map-geometry'],'campaign-time':original.dependencies['campaign-time']}})}catch(error){const receipt=await readArcaneOrdinaryMovementPublished(id,gateway);if(receipt)return receipt;throw error}
 const receipt=await readArcaneOrdinaryMovementPublished(id,gateway);if(!receipt)throw Error('arcane-move:final-publication-witness-required');return{...receipt,alreadyPublished:false}
}
