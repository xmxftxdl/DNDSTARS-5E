import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{driveBountifulOriginalParent}from'./bountifulLuckPersistentRoomDriver'
import{resolveDnd5eOpportunityMoveSequenceOriginal,captureDnd5eOpportunitySequenceNativeAttack}from'./opportunityMoveSequence'
import{previewDnd5eOpportunityAttack}from'./opportunityAttackAction'
import{resumeBountifulOriginalParent}from'./bountifulLuckPersistedReplay'
type Source=Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
export interface BountifulOpportunitySequenceWindow{readonly nativeSequenceOriginalWindow:unique symbol}
type Proof={roomId:string;memberId:string;source:Source;actorId:string;damage:{count:number;sides:number};hit:boolean;critical:boolean;unchanged:()=>boolean}
const windows=new WeakMap<object,Proof>()
/** Discover only an already-answered, actual native original window. This
 * invokes the existing private driver; no caller may supply its ready result,
 * state, attack preparer or retained faces. Pending real choices stay pending. */
export async function captureBountifulOpportunitySequenceWindow(input:{mapId:string;parentId:string;actorId:string;authorityUnchanged:()=>boolean},gateway:Gateway):Promise<BountifulOpportunitySequenceWindow>{
 const host=getRoomSession();if(host?.role!=='dm'||!input.authorityUnchanged())throw Error('opportunity-sequence-window:actual-host-required')
 const ready=await driveBountifulOriginalParent({mapId:input.mapId,parentId:input.parentId,originalScope:{actorId:input.actorId,kind:'attack'}},gateway,{showChoice:async()=>{throw Error('Real original owner decision is pending')},requestRoll:async()=>{throw Error('Real original roller is pending')}})
 if((ready.resolve as unknown)!==resolveDnd5eOpportunityMoveSequenceOriginal||ready.request.actorId!==input.actorId||ready.request.kind!=='attack')throw Error('opportunity-sequence-window:actual-native-original-required')
 const source=ready.source as unknown as Source
 const prepared=captureDnd5eOpportunitySequenceNativeAttack(input.parentId,input.actorId,()=>resumeBountifulOriginalParent({source,resolve:resolveDnd5eOpportunityMoveSequenceOriginal,parentId:input.parentId,actorId:'__native-preparation-observer__',kind:'attack',receipts:ready.receipts}))
 const preview=previewDnd5eOpportunityAttack(prepared,ready.request.values[0]!,ready.request.values[1])
 if(getRoomSession()?.roomId!==host.roomId||getRoomSession()?.memberId!==host.memberId||!input.authorityUnchanged())throw Error('opportunity-sequence-window:host-changed')
 const window=Object.freeze({})as BountifulOpportunitySequenceWindow;windows.set(window,{roomId:host.roomId,memberId:host.memberId,source,actorId:input.actorId,hit:preview.hit,critical:preview.critical,damage:{count:prepared.damage.count*(preview.critical?2:1),sides:prepared.damage.sides},unchanged:input.authorityUnchanged});return window
}
export function readBountifulOpportunitySequenceWindow(window:object){
 const proof=windows.get(window),host=getRoomSession();if(!proof||host?.role!=='dm'||host.roomId!==proof.roomId||host.memberId!==proof.memberId||!proof.unchanged())throw Error('opportunity-sequence-window:exact-native-window-required')
 return{action:structuredClone(proof.source.prepared.action),actorId:proof.actorId,hit:proof.hit,critical:proof.critical,damage:{...proof.damage}}
}
