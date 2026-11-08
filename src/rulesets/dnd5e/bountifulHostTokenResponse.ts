import {saveBountifulPhase} from './bountifulPhaseCommit'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {applyBountifulStampedDieResponse,type BountifulOriginalDieCommand,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
type Command=Extract<BountifulOriginalDieCommand,{phase:'roll'|'confirm'}>
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>;_sync?:{revision?:number}}
/** A separate token response has no fabricated character envelope. The server
 * authenticates the exact current Host/token/phase and writes a private command
 * fact before accepting this same-parent phase CAS. */
export async function submitBountifulHostTokenResponse(input:{mapId:string;parentId:string;occurrence:number;command:Command},gateway:Gateway){
 const host=getRoomSession();if(host?.role!=='dm'||!gateway.publishEvent)throw Error('bountiful-token:host-event-required')
 const combat=await gateway.loadResource<Combat>('combat'),id=bountifulOriginalParentReceiptId(input.parentId,input.occurrence),receipt=combat?.bountifulOriginalParents?.[id]
 if(!combat||!receipt||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||receipt.consumed||receipt.identity.roomId!==host.roomId||receipt.identity.hostMemberId!==host.memberId||receipt.identity.mapId!==input.mapId||receipt.identity.roller.kind!=='host-token'||receipt.identity.roller.characterId!==undefined||receipt.identity.roller.memberId!==host.memberId)throw Error('bountiful-token:current-host-token-parent-required')
 await assertBountifulOriginalSceneScope(combat,receipt.identity,gateway)
 const response={id:JSON.stringify(['bountiful-token-response',input.parentId,input.occurrence,input.command.phase]),roomId:host.roomId,mapId:input.mapId,combatId:receipt.identity.combatId,roomMemberId:host.memberId,sourceMode:'dm' as const,actorTokenId:receipt.identity.roller.tokenId,parentId:input.parentId,occurrence:input.occurrence,command:input.command}
 const next=applyBountifulStampedDieResponse(receipt,response)
 if(JSON.stringify(next)===JSON.stringify(receipt))return receipt
 await gateway.publishEvent('bountiful-original-token-command-dm-to-host',{id:response.id,mapId:input.mapId,combatId:response.combatId,roomMemberId:host.memberId,sourceMode:'dm',status:'pending',type:'dnd5e-bountiful-luck',actorTokenId:response.actorTokenId,round:receipt.identity.round,initiativeIndex:receipt.identity.initiativeIndex,bountifulLuck:{parentId:input.parentId,occurrence:input.occurrence,command:input.command}})
 const revision=combat._sync?.revision;if(!Number.isSafeInteger(revision)||revision!<0)throw Error('bountiful-token:revision-required')
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision!,data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:next}}}],{transactionId:response.id,readRevisions:receipt.identity.revisions})
 return next
}
