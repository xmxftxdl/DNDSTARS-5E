import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import type{BountifulMonsterDamageZeroOriginalRawLoader}from'./bountifulMonsterDamageZeroOriginalRaw'
import{validateBountifulOriginalParents}from'../../../shared/bountiful-luck-state.mjs'
import{validBountifulMonsterZeroCommand}from'../../../shared/bountiful-monster-zero-command.mjs'
import{validateBountifulLuckCommand}from'../../../shared/bountiful-luck-state.mjs'
import{recoverBountifulMonsterZeroOriginal}from'./bountifulMonsterZeroRecovery'
import{processBountifulMonsterZeroChoice}from'./bountifulMonsterZeroPersistentParent'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type Input={mapId:string;requestId:string}
const active=new Map<string,Promise<BountifulOriginalDieReceipt>>()
const host=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('monster-zero-response:actual-host-required');return{roomId:value.roomId,memberId:value.memberId}}
const sourceTails=new Map<string,Promise<void>>()
/** Ordering only: the operation inside still validates its own real private
 * book and Native lineage. The returned job retains every rejection. */
export function withBountifulMonsterZeroPrivateSource<T>(parentId:string,run:()=>Promise<T>):Promise<T>{const owner=host(),key=JSON.stringify([owner.roomId,owner.memberId,parentId]),before=sourceTails.get(key)??Promise.resolve(),job=before.then(()=>{const current=host();if(current.roomId!==owner.roomId||current.memberId!==owner.memberId)throw Error('monster-zero-response:changed-current-host');return run()}),tail=job.then(()=>undefined,()=>undefined);sourceTails.set(key,tail);void tail.then(()=>{if(sourceTails.get(key)===tail)sourceTails.delete(key)});return job}
/** Both real queue consumers share this private-source path. A public append
 * cannot choose a resolver; no queued attack parent or caller result is made. */
export function processBountifulMonsterZeroQueuedResponse(input:Input,gateway:Gateway,load:BountifulMonsterDamageZeroOriginalRawLoader){
 const owner=host(),key=JSON.stringify([owner.roomId,owner.memberId,input.mapId,input.requestId]),prior=active.get(key);if(prior)return prior
 const guard=()=>{const current=host();if(current.roomId!==owner.roomId||current.memberId!==owner.memberId)throw Error('monster-zero-response:changed-current-host')}
 const read=async()=>{const[combat,queue]=await Promise.all([gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),gateway.loadResource<{requests?:SharedPlayerActionState[]}>('player-action-requests')]);guard();const row=queue?.requests?.find(row=>row.id===input.requestId),scope=row?.bountifulLuck,receipt=scope&&combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',scope.parentId,scope.occurrence])]
  if(!row||row.type!=='dnd5e-bountiful-luck'||row.mapId!==input.mapId||!row.roomMemberId||!scope||!validateBountifulLuckCommand(scope)||!['native-lucky','reaction','roll','confirm'].includes(scope.command.phase)||!receipt||!validateBountifulOriginalParents(combat?.bountifulOriginalParents)||!validBountifulMonsterZeroCommand(receipt.originalRoomAction)||receipt.originalAdapterId!=='monster'||receipt.identity.parentId!==scope.parentId||receipt.identity.occurrence!==scope.occurrence||receipt.identity.roomId!==owner.roomId||receipt.identity.hostMemberId!==owner.memberId||receipt.identity.mapId!==input.mapId||row.combatId!==receipt.identity.combatId||row.round!==receipt.identity.round||row.initiativeIndex!==receipt.identity.initiativeIndex)throw Error('monster-zero-response:protected-authenticated-row-required')
  if(row.status==='done'){if(!receipt.processedRequestIds.includes(input.requestId))throw Error('monster-zero-response:exact-processed-row-required');return{row,receipt,scope,done:true as const}}
  if(row.status!=='pending')throw Error('monster-zero-response:pending-authenticated-row-required');return{row,receipt,scope,done:false as const}
 }
 let job:Promise<BountifulOriginalDieReceipt>;job=(async()=>{let current=await read();if(current.done)return structuredClone(current.receipt);const parentId=current.scope.parentId;return withBountifulMonsterZeroPrivateSource(parentId,async()=>{current=await read();if(current.scope.parentId!==parentId)throw Error('monster-zero-response:changed-current-parent');if(current.done)return structuredClone(current.receipt);const actual=await recoverBountifulMonsterZeroOriginal(parentId,gateway,load);guard();current=await read();if(current.scope.parentId!==parentId)throw Error('monster-zero-response:changed-current-parent');if(current.done)return structuredClone(current.receipt);return processBountifulMonsterZeroChoice(actual.qualification,actual.source,input.requestId,gateway)})})().finally(()=>{if(active.get(key)===job)active.delete(key)});active.set(key,job);return job
}
