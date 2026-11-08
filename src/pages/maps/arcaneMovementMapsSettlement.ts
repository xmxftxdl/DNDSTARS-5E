import type{SharedPlayerActionState,SharedPlayerActionAckState,SharedCombatState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{getRoomSession}from'../../lib/roomSession'
import{sameArcaneNativeData}from'./arcaneNativeIdentity'
import{restoreArcaneOrdinaryMoveParent}from'./arcaneOrdinaryMoveParent'
import{readArcaneOrdinaryMovementPublished}from'./publishArcaneOrdinaryMovement'
import type{readArcaneOrdinaryMovementReady}from'./arcaneMovementHazardCheckpoint'
import{projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{validArcaneMovementOriginalJournal}from'../../../shared/arcane-movement-original.mjs'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
type Plan=Awaited<ReturnType<typeof readArcaneOrdinaryMovementReady>>
type Rev={_sync?:{revision?:number}}
interface Parent{id:string;phase:string;roomId:string;hostMemberId:string;mapId:string;combatId:string;requestId:string;command:SharedPlayerActionState;dependencies:Record<string,number>;firstHostNow:number;definitionSignature:string;completed?:{schemaVersion:number;parentId:string;originalCommandId:string;firstHostNow:number;definitionSignature:string}}
const signals=new WeakMap<object,{parentId:string;action:SharedPlayerActionState}>()
export class ArcaneMovementMapsSettlementSignal extends Error{private constructor(){super('arcane-movement-original-settlement');this.name='ArcaneMovementMapsSettlementSignal'}static async issue(input:{parentId:string;action:SharedPlayerActionState},gateway:Gateway){await readFresh(input,gateway);const signal=new ArcaneMovementMapsSettlementSignal();signals.set(signal,structuredClone(input));return signal}}
const wire=(v:unknown)=>JSON.parse(JSON.stringify(v))as unknown
const strip=(v:SharedPlayerActionState)=>{const row={...v};delete row.roomMemberId;return row}
function revision(v:Rev|null){const value=v?._sync?.revision;if(!Number.isSafeInteger(value)||value!<0)throw Error('arcane-movement-maps:world-revision-required');return value!}
async function readFresh(input:{parentId:string;action:SharedPlayerActionState},gateway:Gateway){
 const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('arcane-movement-maps:authenticated-host-required')};guard()
 const journal=await gateway.loadResource<{parents:Record<string,Parent>}>('arcane-movement-parents');guard();const row=journal?.parents[input.parentId],action=input.action
 if(!validArcaneMovementOriginalJournal(journal)||!row||row.id!==input.parentId||row.roomId!==session!.roomId||row.hostMemberId!==session!.memberId||row.requestId!==action.id||row.mapId!==action.mapId||row.combatId!==action.combatId||row.command.sourceMode!=='player'||row.command.status!=='pending'||row.command.type!=='move-token'||!row.command.roomMemberId||!sameArcaneNativeData(strip(row.command),strip(action)))throw Error('arcane-movement-maps:matching-issued-original-required')
 if(row.phase==='waiting'){await restoreArcaneOrdinaryMoveParent(input.parentId,gateway);guard();return{kind:'pending' as const,parentId:row.id}}
 const published=await readArcaneOrdinaryMovementPublished(input.parentId,gateway);guard();const plan=published?.settlement as Partial<Pick<Plan,'result'|'acceptedMovement'>>|undefined,c=row.completed
 if(!published||row.phase!=='consumed'||!c||c.schemaVersion!==1||c.parentId!==row.id||c.originalCommandId!==action.id||c.firstHostNow!==row.firstHostNow||c.definitionSignature!==row.definitionSignature||!plan?.result?.state||plan.result.state.combatId!==row.combatId||plan.result.map?.id!==row.mapId||plan.result.application?.map?.id!==row.mapId||!Array.isArray(plan.result.application.characters)||!plan.acceptedMovement?.result.ok)throw Error('arcane-movement-maps:consumed-original-publication-required')
 const [maps,characters,combat,queue,ack,processed,geometry,clock]=await Promise.all([gateway.loadResource<Rev&{maps:typeof plan.result.map[]}>('maps'),gateway.loadResource<Rev&{characters:typeof plan.result.application.characters}>('characters'),gateway.loadResource<Rev&SharedCombatState>('combat'),gateway.loadResource<Rev&{requests:SharedPlayerActionState[]}>('player-action-requests'),gateway.loadResource<Rev&SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<Rev&{actionIds:string[]}>('player-action-processed'),gateway.loadResource<Rev>('map-geometry'),gateway.loadResource<Rev>('campaign-time')]);guard()
 const actor=plan.result.state.combatants[action.actorTokenId],position=plan.result.finalPositionByCombatantId[action.actorTokenId],map=maps?.maps.find(m=>m.id===row.mapId),token=map?.tokens.find(t=>t.id===action.actorTokenId)
 if(!maps||!characters||!combat||!queue||!ack||!processed||!actor||!position||!token||combat.mapId!==row.mapId||combat.combatId!==row.combatId||combat.round!==action.round||combat.initiativeIndex!==action.initiativeIndex||ack.actionId!==action.id||ack.status!=='accepted'||ack.recipientMemberId!==row.command.roomMemberId||!sameArcaneNativeData(ack.acceptedPosition,position)||!sameArcaneNativeData(actor.position,position)||token.x!==position.x||token.y!==position.y||(ack.acceptedElevationFeet??0)!==(actor.elevationFeet??0)||!processed.actionIds.includes(action.id)||queue.requests.some(v=>v.id===action.id)||!sameArcaneNativeData(wire(map),wire(plan.result.map))||!sameArcaneNativeData(wire(characters.characters),wire(plan.result.application.characters)))throw Error('arcane-movement-maps:matching-original-seven-write-witness-required')
 for(const [name,value]of [['maps',maps],['characters',characters],['combat',combat],['player-action-requests',queue]]as const)if(revision(value)!==row.dependencies[name]+1)throw Error('arcane-movement-maps:publication-world-version-required')
 if((geometry===null?0:revision(geometry))!==row.dependencies['map-geometry']||(clock===null?0:revision(clock))!==row.dependencies['campaign-time']||revision(ack)<1||revision(processed)<1)throw Error('arcane-movement-maps:publication-read-version-required')
 for(const[id,combatant]of Object.entries(plan.result.state.combatants)){const pool=combat.dnd5eTurnEconomyByToken?.[id];if(!pool||!sameArcaneNativeData(wire(pool),wire(projectDnd5eHeadlessTurnEconomy(pool,combatant.turn,combatant.speed))))throw Error('arcane-movement-maps:published-original-economy-required')}
 return{kind:'published' as const,parentId:row.id}
}
/** A control-flow exception alone grants no outcome: brand and all persisted facts are re-read. */
export async function verifyArcaneMovementMapsSettlement(input:{signal:ArcaneMovementMapsSettlementSignal;action:SharedPlayerActionState},gateway:Gateway){const issued=signals.get(input.signal);if(!issued||!sameArcaneNativeData(issued.action,input.action))throw Error('arcane-movement-maps:genuine-signal-required');return readFresh(issued,gateway)}
