import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
type Gateway=Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>
type Writes=Parameters<Gateway['saveResourcesAtomically']>[0]
type Options=NonNullable<Parameters<Gateway['saveResourcesAtomically']>[1]>
/** Only BL phase labels are encoded. Parent/request/die identities remain exact
 * in their protected source records. Every read guard is kept or transferred to
 * the same resource's expectedRevision before the real atomic gateway call. */
export async function saveBountifulPhase(gateway:Gateway,writes:Writes,options:Options){
 if(!options.transactionId?.trim())throw Error('bountiful-phase:explicit-transaction-required')
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(options.transactionId)),transactionId='bountiful-phase:'+Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
 const readRevisions={...options.readRevisions},guarded=writes.map(write=>{const read=readRevisions[write.name];if(read===undefined)return write;if(write.expectedRevision!==undefined&&write.expectedRevision!==read)throw Error('bountiful-phase:conflicting-same-resource-guard');delete readRevisions[write.name];return{...write,expectedRevision:read}})
 return gateway.saveResourcesAtomically(guarded,{...options,transactionId,readRevisions})
}
