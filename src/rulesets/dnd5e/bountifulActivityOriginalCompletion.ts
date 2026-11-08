import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone';
import{captureBountifulActivityNativeBoundary}from'./bountifulActivityNativeBoundary';
import{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification';
import{resolveDnd5ePreparedNativeBoundaryWithMaterials,type Dnd5eDamageReactionFlowOptions}from'./damageReactionFlow';
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt';
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint';
import type{resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0];
const completed=new WeakMap<object,{source:Source;sourceSignature:string;resultSignature:string;effectTimestamp:number}>(),signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value));
/** A final proof is issued only after the real outer async facade completed.
 * It never revives the earlier worker or its initial qualification. */
export function readBountifulActivityCompletedOriginal(result:object,source:Source){const row=completed.get(result);if(!row)throw Error('activity-completion:actual-completed-facade-required');if(signature(result)!==row.resultSignature)throw Error('activity-completion:changed-actual-native-result');if(signature(source)!==row.sourceSignature)throw Error('activity-completion:changed-actual-completed-source');return{source:cloneDnd5eHostTransactionInput(row.source),effectTimestamp:row.effectTimestamp}}
/** Complete the original genuine async facade after its actual Native/material
 * boundary. Receipts are input evidence; the normal-ACK owner authenticates them. */
export async function completeBountifulActivityOriginal(input:{source:Source;activityOriginalQualification:BountifulActivityOriginalQualification;receipts:readonly BountifulOriginalDieReceipt[];options:Dnd5eDamageReactionFlowOptions}){
 const facts=readBountifulActivityOriginalQualification(input.activityOriginalQualification,input.source),boundary=captureBountifulActivityNativeBoundary(facts.source),first=input.receipts[0];if(!first||first.identity.parentId!==facts.source.prepared.action.id||first.identity.effectTimestamp!==facts.effectTimestamp||JSON.stringify(first.request)!==JSON.stringify(facts.request))throw Error('activity-completion:exact-initial-original-required');
 try{const source={...facts.source,hostOriginalD20Replay:{parentId:facts.source.prepared.action.id,sourceKey:originalD20ReplaySourceKey(facts.source.prepared.action.id,facts.source.prepared.state,facts.source.prepared.action,facts.effectTimestamp),effectTimestamp:facts.effectTimestamp,facts:[]}},settled=await resolveDnd5ePreparedNativeBoundaryWithMaterials({...input.options,chooseAllyNaturalOne:async pending=>{const occurrence=Number(pending.eventId.slice(pending.eventId.lastIndexOf(':')+1)),receipt=input.receipts.find(row=>row.identity.occurrence===occurrence);if(!Number.isSafeInteger(occurrence)||!receipt||JSON.stringify(receipt.request)!==JSON.stringify(pending.request))throw Error('activity-completion:exact-protected-original-required');return decisionFromBountifulOriginalDieReceipt(receipt,pending.request)}},source,value=>boundary.resolvePrepared(value),boundary.succeeded);const resolved=await boundary.complete(settled.result,settled.materialChanges);if(resolved.result.ok&&resolved.application)completed.set(resolved,{source:cloneDnd5eHostTransactionInput(facts.source),sourceSignature:signature(facts.source),resultSignature:signature(resolved),effectTimestamp:facts.effectTimestamp});return resolved}finally{await boundary.abort()}
}
