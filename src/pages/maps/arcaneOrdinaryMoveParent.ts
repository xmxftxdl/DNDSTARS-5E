import{dnd5eTurnMovementSpent}from'../../rulesets/dnd5e/turnEconomy'
import{secondChanceParentDefinitionSignature as originalDefinitionSignature}from'../../lib/secondChanceParentSignature'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{SharedCombatState,SharedPlayerActionRequestQueueState}from'../../lib/sharedCombatTypes'
import type{BattleMap}from'../../store/maps'
import type{Character}from'../../types/character'
import{getRoomSession}from'../../lib/roomSession'
import{prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove}from'../../rulesets/dnd5e/playerMoveAction'
import{listRegisteredDnd5eActivityPackages}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import{validArcaneMovementOriginalJournal}from'../../../shared/arcane-movement-original.mjs'
import{sameArcaneNativeData}from'./arcaneNativeIdentity'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
type Revisioned={_sync?:{revision?:number}}
const names=['maps','characters','combat','map-geometry','campaign-time']as const
export interface ArcaneOrdinaryMoveParent{readonly arcaneOrdinaryMoveParent:unique symbol}
type Original={definitionSignature:string;serverParentId?:string;roomId:string;hostMemberId:string;firstHostNow:number;command:SharedPlayerActionRequestQueueState['requests'][number];dependencies:Record<string,number>;definitions:ReturnType<typeof listRegisteredDnd5eActivityPackages>;prepared:Extract<ReturnType<typeof prepareDnd5ePlayerMove>,{ok:true}>['prepared'];native:ReturnType<typeof resolvePreparedDnd5ePlayerMove>}
const issued=new WeakMap<object,Original>()
function revision(v:Revisioned|null){if(v===null)return 0;const n=v._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('arcane-move:original-revision-required');return n!}
/** This is the ordinary queued movement issuer, not an attack or BL capability.
 * Only an authenticated Host can reconstruct the canonical request and world.
 * It does not persist, roll, authorize a failed save, or publish an ACK. */
export async function captureArcaneOrdinaryMoveParent(requestId:string,gateway:Gateway):Promise<ArcaneOrdinaryMoveParent>{return captureUsingFirstHostClock(requestId,gateway,Date.now())}
async function captureUsingFirstHostClock(requestId:string,gateway:Gateway,firstHostNow:number):Promise<ArcaneOrdinaryMoveParent>{
 const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||session.roomId!==now.roomId||session.memberId!==now.memberId)throw Error('arcane-move:authenticated-host-required')};guard()
 const queue=await gateway.loadResource<SharedPlayerActionRequestQueueState&Revisioned>('player-action-requests');guard();const command=queue?.requests.find(row=>row.id===requestId)
 if(!command||command.type!=='move-token'||command.sourceMode!=='player'||command.status!=='pending'||!command.roomMemberId||!command.targetPosition||(command.dnd5eTraversalMode!=null&&command.dnd5eTraversalMode!=='walk'))throw Error('arcane-move:canonical-ordinary-move-required')
 const values=await Promise.all(names.map(name=>gateway.loadResource<Revisioned>(name)));guard()
 const maps=values[0]as(Revisioned&{maps:BattleMap[]})|null,characters=values[1]as(Revisioned&{characters:Character[]})|null,combat=values[2]as(SharedCombatState&Revisioned)|null,clock=values[4]as(Revisioned&{worldMinute?:number;worldSecondRemainder?:number})|null,map=maps?.maps.find(m=>m.id===command.mapId),character=characters?.characters.find(c=>c.id===command.characterId),token=map?.tokens.find(t=>t.id===command.actorTokenId)
 if(!map||!characters||!combat?.active||combat.mapId!==map.id||!combat.combatId||combat.combatId!==command.combatId||combat.round!==command.round||combat.initiativeIndex!==command.initiativeIndex||combat.initiativeOrder[combat.initiativeIndex]?.tokenId!==token?.id)throw Error('arcane-move:canonical-active-movement-parent-required')
 if(!token||token.type!=='player'||token.characterId!==character?.id||secondChanceCanonicalControllerMemberId(character,{roomId:session!.roomId,hostMemberId:session!.memberId})!==command.roomMemberId)throw Error('arcane-move:canonical-mover-controller-required')
 const turnEconomy=combat.dnd5eTurnEconomyByToken?.[token.id];if(!turnEconomy)throw Error('arcane-move:canonical-turn-economy-required')
 const result=prepareDnd5ePlayerMove({action:command,map,characters:characters.characters,initiativeOrder:combat.initiativeOrder,turnEconomy,worldMinute:clock?.worldMinute,worldSecondRemainder:clock?.worldSecondRemainder});if(!result.ok)throw Error('arcane-move:original-preparation-rejected:'+result.reason)
 if(!Number.isSafeInteger(firstHostNow)||firstHostNow<=0)throw Error('arcane-move:first-host-clock-required')
 for(const[id,actor]of Object.entries(result.prepared.state.combatants)){const pool=combat.dnd5eTurnEconomyByToken?.[id];if(pool)actor.turn={...actor.turn,actionAvailable:actor.turn.actionAvailable&&pool.action.current>0,bonusActionAvailable:actor.turn.bonusActionAvailable&&pool.bonusAction.current>0,reactionAvailable:actor.turn.reactionAvailable&&pool.reaction.current>0,objectInteractionAvailable:actor.turn.objectInteractionAvailable!==false&&(pool.objectInteraction?.current??1)>0,movementRemaining:pool.movement.current,movementSpent:dnd5eTurnMovementSpent(pool)}}
 const native=resolvePreparedDnd5ePlayerMove({prepared:result.prepared,transactionId:command.id},{now:firstHostNow});if(!native.result.ok||!native.application)throw Error('arcane-move:original-native-move-rejected')
 const definitionSignature=await originalDefinitionSignature(result.prepared.state);guard();const parent=Object.freeze({})as ArcaneOrdinaryMoveParent;issued.set(parent,{definitionSignature,roomId:session!.roomId,hostMemberId:session!.memberId,firstHostNow,command:structuredClone(command),dependencies:{...Object.fromEntries(names.map((name,index)=>[name,revision(values[index])])),'player-action-requests':revision(queue)},definitions:structuredClone(listRegisteredDnd5eActivityPackages()),prepared:result.prepared,native});return parent
}
export function readArcaneOrdinaryMoveParent(parent:ArcaneOrdinaryMoveParent){const data=issued.get(parent),session=getRoomSession();if(!data||!session||session.role!=='dm'||session.roomId!==data.roomId||session.memberId!==data.hostMemberId)throw Error('arcane-move:original-host-brand-required');if(!sameArcaneNativeData(data.definitions,listRegisteredDnd5eActivityPackages()))throw Error('arcane-move:original-definitions-changed');return structuredClone(data)}

/** Rebuild only a genuinely server-issued original record, with its first clock.
 * This does not trust saved native results, hazard states, dice or decisions. */
export async function restoreArcaneOrdinaryMoveParent(parentId:string,gateway:Gateway){
 const session=getRoomSession();if(!session||session.role!=='dm')throw Error('arcane-move:authenticated-host-required')
 const journal=await gateway.loadResource<Revisioned&{parents:Record<string,{roomId:string;hostMemberId:string;requestId:string;firstHostNow:number;definitionSignature:string;command:Original['command'];dependencies:Original['dependencies']}>}>('arcane-movement-parents')
 if(!validArcaneMovementOriginalJournal(journal)||!journal?.parents[parentId])throw Error('arcane-move:server-issued-original-required')
 const row=journal.parents[parentId];if(row.roomId!==session.roomId||row.hostMemberId!==session.memberId)throw Error('arcane-move:original-room-host-mismatch')
 const parent=await captureUsingFirstHostClock(row.requestId,gateway,row.firstHostNow),original=readArcaneOrdinaryMoveParent(parent)
 if(row.definitionSignature!==original.definitionSignature||!sameArcaneNativeData(row.command,original.command)||!sameArcaneNativeData(row.dependencies,original.dependencies))throw Error('arcane-move:server-issued-original-world-changed')
 issued.get(parent)!.serverParentId=parentId
 return parent
}

export async function assertArcaneOrdinaryMoveCurrent(parent:ArcaneOrdinaryMoveParent,gateway:Gateway){
 const data=readArcaneOrdinaryMoveParent(parent),values=await Promise.all([...names,'player-action-requests'].map(name=>gateway.loadResource<Revisioned>(name)));readArcaneOrdinaryMoveParent(parent)
 if(await originalDefinitionSignature(data.prepared.state)!==data.definitionSignature)throw Error('arcane-move:original-definitions-changed')
 if([...names,'player-action-requests'].some((name,index)=>revision(values[index])!==data.dependencies[name]))throw Error('arcane-move:original-world-changed')
 return data
}

/** The Host binds the actual current registered source at first begin. This
 * fingerprint is only a guard; it does not issue a capability or authorise use. */
export const arcaneOrdinaryMovementDefinitionSignature=originalDefinitionSignature
