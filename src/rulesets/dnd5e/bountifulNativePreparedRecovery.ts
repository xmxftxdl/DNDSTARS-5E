import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {recoverBountifulHostOperation,readBountifulHostMonsterOriginalReady} from './bountifulHostOperationPersistent'
import {bountifulIssuedHostOperation,stripBountifulNativePreparedCapability} from './bountifulHostOperation'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {cloneDnd5eHostTransactionInput,dnd5eHostTransactionHasCapabilities} from './hostTransactionClone'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
/** Reconstruct only from the current protected native parent and real issuer.
 * Caller data, including any prepared state, never creates the capability. */
export async function readBountifulNativePreparedReplay(parentId:string,gateway:Gateway){
 await readBountifulHostMonsterOriginalReady(parentId,gateway)
 const cap=await recoverBountifulHostOperation(parentId,gateway,{includeDamage:true}),facts=bountifulIssuedHostOperation(cap),combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat')
 const rows=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),effectTimestamp=rows[0]?.identity.effectTimestamp
 if(!rows.length||rows.some(row=>row.consumed))throw Error('bountiful-native-recovery:protected-live-original-required')
 const source=facts.source,hostOriginalD20Replay={parentId,sourceKey:originalD20ReplaySourceKey(parentId,source.prepared.state,facts.operation,effectTimestamp),deferredD20Choices:rows[0]?.postOriginalD20??[],facts:rows.map(row=>({occurrence:row.identity.occurrence,request:row.request,decision:decisionFromBountifulOriginalDieReceipt(row,row.request)})),...(effectTimestamp===undefined?{}:{effectTimestamp})}
 return {...source,hostOriginalD20Replay}
}

export async function restoreBountifulNativePreparedRecovery(input:unknown,recovery:{parentId:string},gateway:Gateway){
 if(!recovery||Object.keys(recovery).length!==1||typeof recovery.parentId!=='string'||!recovery.parentId||dnd5eHostTransactionHasCapabilities(input))throw Error('bountiful-native-recovery:invalid-data-envelope')
 const source=await readBountifulNativePreparedReplay(recovery.parentId,gateway),copy=cloneDnd5eHostTransactionInput(source)
 if(!stripBountifulNativePreparedCapability(copy)||dnd5eHostTransactionHasCapabilities(copy)||JSON.stringify(encodeSecondChanceParentWire(input))!==JSON.stringify(encodeSecondChanceParentWire(copy)))throw Error('bountiful-native-recovery:changed-protected-original')
 return source
}
