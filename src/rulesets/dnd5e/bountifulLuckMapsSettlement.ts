import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {Dnd5eActionResult} from './headlessCombatEngine'
import {BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {readConsumedBountifulParent} from './bountifulLuckParentPublish'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {getRoomSession} from '../../lib/roomSession'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
export class BountifulOriginalParentPublished extends Error{
 readonly parentId:string;readonly mapId:string
 constructor(parentId:string,mapId:string){super('bountiful-original-parent-published');this.parentId=parentId;this.mapId=mapId}
}
/** Signals never authorize themselves. The coordinator rereads the private Host
 * parent and its original room command before withholding ACK or accepting it. */
export async function verifyBountifulMapsSettlement(input:{error:BountifulOriginalParentPending|BountifulOriginalParentPublished;action:SharedPlayerActionState},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<{kind:'pending'}|{kind:'published';result:Dnd5eActionResult}>{
 const {action,error}=input,host=getRoomSession(),combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat')
 const receipt=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,0)]
 if(!host||host.role!=='dm'||error.parentId!==action.id||!receipt||receipt.identity.roomId!==host.roomId||receipt.identity.hostMemberId!==host.memberId||receipt.identity.mapId!==action.mapId||receipt.identity.combatId!==action.combatId||JSON.stringify(action)!==JSON.stringify(receipt.originalRoomAction)||!validateBountifulOriginalParents(combat!.bountifulOriginalParents))throw Error('bountiful-maps:original-parent-mismatch')
 if(error instanceof BountifulOriginalParentPending){
  if(receipt.consumed||!combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,error.occurrence)])throw Error('bountiful-maps:pending-original-die-missing')
  return {kind:'pending'}
 }
 if(error.mapId!==action.mapId)throw Error('bountiful-maps:published-map-mismatch')
 const consumed=await readConsumedBountifulParent({mapId:action.mapId,parentId:action.id},gateway)
 if(!consumed?.result.ok)throw Error('bountiful-maps:consumed-original-parent-missing')
 return {kind:'published',result:consumed.result}
}
