import{sameArcaneNativeData}from'./arcaneNativeIdentity'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{captureArcaneOrdinaryMoveParent,readArcaneOrdinaryMoveParent,restoreArcaneOrdinaryMoveParent}from'./arcaneOrdinaryMoveParent'
import{settleArcaneOrdinaryMovementHazard,ArcaneMovementRollPending,ArcaneMovementOwnerChoicePending}from'./arcaneMovementHazardCheckpoint'
import{publishArcaneOrdinaryMovement,readArcaneOrdinaryMovementPublished}from'./publishArcaneOrdinaryMovement'
import{requestSharedArcaneMovement}from"../../composition/browserSharedRoomResources"
import{arcaneMovementTransport,readArcaneMovementDiceRequest}from'./arcaneMovementDiceTransport'
import type{Dnd5eMovementHazardsProducer}from'./movementHazardsProducer'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export interface ArcaneOrdinaryMovementUi{roll(request:{requestId:string;rollerTokenId:string;rollerCharacterId:string;sides:number;count:number}):Promise<readonly number[]>;confirmStored(values:readonly number[],request:{requestId:string;rollerTokenId:string;rollerCharacterId:string;sides:number;count:number}):Promise<readonly number[]>}
/** Only the canonical queued original ID is accepted. UI return values never authorize rolls. */
export async function driveArcaneOrdinaryMovement(requestId:string,producer:Dnd5eMovementHazardsProducer,gateway:Gateway,ui:ArcaneOrdinaryMovementUi){
 const journal=await gateway.loadResource<{parents:Record<string,{id:string;requestId:string;phase:string}>}>('arcane-movement-parents'),matches=Object.values(journal?.parents??{}).filter(row=>row.requestId===requestId)
 if(matches.length>1)throw Error('arcane-move:unique-original-required')
 let parentId=matches[0]?.id
 if(parentId){const saved=await readArcaneOrdinaryMovementPublished(parentId,gateway);if(saved)return{...saved,parentId}}
 else{const captured=readArcaneOrdinaryMoveParent(await captureArcaneOrdinaryMoveParent(requestId,gateway));try{parentId=(await requestSharedArcaneMovement<{parentId:string}>('begin',{requestId,definitionSignature:captured.definitionSignature})).parentId}catch(error){
  // A lost reply never licenses a second begin POST or an invented local ID.
  const saved=await gateway.loadResource<{parents:Record<string,{id:string;requestId:string;definitionSignature:string}>}>('arcane-movement-parents'),rows=Object.values(saved?.parents??{}).filter(row=>row.requestId===requestId&&row.definitionSignature===captured.definitionSignature)
  if(rows.length!==1)throw error
  const restored=readArcaneOrdinaryMoveParent(await restoreArcaneOrdinaryMoveParent(rows[0].id,gateway));if(restored.serverParentId!==rows[0].id||restored.command.id!==requestId)throw error;parentId=rows[0].id
 }}
 const ports:typeof arcaneMovementTransport={...arcaneMovementTransport,
  issue:async input=>{try{return await arcaneMovementTransport.issue(input)}catch(error){const saved=await gateway.loadResource<{parents:Record<string,{requests:Record<string,{id:string;ordinal:number;areaId:string;purpose:string}>}>}>('arcane-movement-parents'),rows=Object.values(saved?.parents[input.parentId]?.requests??{}).filter(row=>row.ordinal===input.ordinal&&row.areaId===input.areaId&&row.purpose===input.purpose);if(rows.length!==1)throw error;return{requestId:rows[0].id}}},
  checkpoint:async input=>{try{return await arcaneMovementTransport.checkpoint(input)}catch(error){const saved=await gateway.loadResource<{parents:Record<string,{checkpoint?:{id:string;areaId:string;phase:string;featureId:string;stateSignature:string;facts:unknown;requestIds:string[]}}>}>('arcane-movement-parents'),row=saved?.parents[input.parentId]?.checkpoint;if(!row||row.areaId!==input.areaId||row.featureId!==input.featureId||row.stateSignature!==input.stateSignature||!sameArcaneNativeData(row.facts,input.facts)||!sameArcaneNativeData(row.requestIds,input.requestIds)||!(row.phase===input.phase||input.phase==='arcane'&&row.phase==='shroud'))throw error;return{checkpointId:row.id}}},
 }
 for(let attempt=0;attempt<3;attempt++){
  const parent=await restoreArcaneOrdinaryMoveParent(parentId,gateway)
  try{const ready=await settleArcaneOrdinaryMovementHazard(parent,producer,gateway,ports);return{...await publishArcaneOrdinaryMovement(parent,ready,gateway),parentId}}
  catch(error){if(error instanceof ArcaneMovementOwnerChoicePending)return{status:'pending-owner-choice' as const,parentId};if(!(error instanceof ArcaneMovementRollPending))throw error
   const row=await readArcaneMovementDiceRequest(error.request.requestId);if(!row)throw Error('arcane-move:issued-die-required')
   try{if(!row.raw)await ui.roll(row);else if(!row.confirmed)await ui.confirmStored(row.raw,row)}catch(cancel){if(cancel instanceof Error&&cancel.message==='combat-dice-cancelled')return{status:'pending-original-die' as const,parentId};throw cancel}
   const saved=await readArcaneMovementDiceRequest(row.requestId);if(!saved?.confirmed)return{status:'pending-original-die' as const,parentId}
  }
 }
 return{status:'pending-original-die' as const,parentId}
}
