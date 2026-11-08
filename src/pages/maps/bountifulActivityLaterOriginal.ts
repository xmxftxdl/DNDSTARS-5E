import{bountifulOriginalParentReceiptId}from'../../rulesets/dnd5e/bountifulLuckPersistentHost'
import{getRoomSession}from'../../lib/roomSession'
import{readBountifulActivityOriginalOperation,readBountifulActivityOriginalActualStage,type BountifulActivityOriginalOperation}from'./bountifulActivityOriginalNative'
import{captureBountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'../../rulesets/dnd5e/bountifulActivityOriginalQualification'
import{readBountifulActivityOriginalContinuation,assertBountifulActivityOriginalContinuationCurrent,type BountifulActivityOriginalContinuation,type BountifulActivityOriginalContinuationGateway}from'../../rulesets/dnd5e/bountifulActivityOriginalContinuation'
import{createBountifulOriginalDieReceipt,decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt'
import{bountifulPreparedController,bountifulPreparedOriginalRoller}from'../../rulesets/dnd5e/bountifulPreparedController'
import{saveBountifulPhase}from'../../rulesets/dnd5e/bountifulPhaseCommit'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value)),revision=(v:unknown)=>{const n=(v as{_sync?:{revision?:number}}|null)?._sync?.revision;return Number.isSafeInteger(n)&&Number(n)>=0?Number(n):0}
type Gateway=BountifulActivityOriginalContinuationGateway&Pick<SharedRoomGatewayPort,'publishEvent'|'saveResourcesAtomically'>
/** A later regular original is issued only at its genuine authenticated Native
 * pause. Its immutable parent remains the first source; its raw issuer is the
 * distinct actual protected pool/die, never an Own-Lucky replacement pool. */
export async function persistBountifulActivityLaterOriginalParent(input:{operation:BountifulActivityOriginalOperation;qualification:BountifulActivityOriginalQualification;continuation:BountifulActivityOriginalContinuation},gateway:Gateway){
 const owner=getRoomSession();if(owner?.role!=='dm'||!owner.memberId||!owner.roomId)throw Error('activity-later-original:actual-host-required')
 const stage=readBountifulActivityOriginalActualStage(input.operation),facts=readBountifulActivityOriginalOperation(input.operation);if(stage.status!=='pending-ally-natural-one'||stage.request.nativeLucky||stage.request.kind!=='ability-check'||stage.occurrence<1)throw Error('activity-later-original:actual-regular-later-pause-required')
 const current=await captureBountifulActivityOriginalQualification(input.operation),later=readBountifulActivityOriginalQualification(current,facts.source);readBountifulActivityOriginalQualification(input.qualification,facts.source);readBountifulActivityOriginalContinuation(input.continuation,facts.source,undefined,input.qualification);await assertBountifulActivityOriginalContinuationCurrent(input.continuation,gateway,facts.source)
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>;dnd5eTurnEconomyByToken?:unknown}>('combat'),queue=await gateway.loadResource<unknown>('player-action-requests'),rows=Object.values(combat?.bountifulOriginalParents??{}).filter(r=>r.identity.parentId===facts.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),first=rows[0],id=bountifulOriginalParentReceiptId(facts.parentId,stage.occurrence),prior=combat?.bountifulOriginalParents?.[id]
 if(!first||first.identity.roomId!==owner.roomId||first.identity.hostMemberId!==owner.memberId||first.identity.effectTimestamp!==facts.effectTimestamp||first.originalAdapterId!=='plugin-feature')throw Error('activity-later-original:canonical-first-parent-required')
 readBountifulActivityOriginalContinuation(input.continuation,facts.source,first,input.qualification)
 if(prior){if(signature(prior.request)!==signature(stage.request)||signature(prior.rawIssuer)!==signature(later.rawIssuer)||signature(prior.originalParent)!==signature(first.originalParent)||prior.consumed)throw Error('activity-later-original:changed-issued-original');return structuredClone(prior)}
 if(rows.length!==stage.occurrence||rows.some((r,n)=>r.identity.occurrence!==n||r.consumed||r.identity.effectTimestamp!==facts.effectTimestamp||signature(r.originalParent)!==signature(first.originalParent)))throw Error('activity-later-original:exact-preceding-originals-required')
 for(const row of rows)decisionFromBountifulOriginalDieReceipt(row,row.request)
 const prepared=facts.source.prepared,request=facts.request,receipt=createBountifulOriginalDieReceipt({rawIssuer:later.rawIssuer,identity:{...first.identity,occurrence:stage.occurrence,roller:bountifulPreparedOriginalRoller(prepared,request.actorId,owner.memberId),effectTimestamp:facts.effectTimestamp,reactionEconomySignature:JSON.stringify(combat?.dnd5eTurnEconomyByToken??{})},originalCheckpoint:{actorId:request.actorId,kind:'ability-check'},originalAdapterId:'plugin-feature',originalRoomAction:first.originalRoomAction,originalParent:first.originalParent,request,controllers:Object.fromEntries(request.options.map(option=>[option.ownerId,bountifulPreparedController(prepared,option.ownerId,owner.memberId)]))})
 readBountifulActivityOriginalOperation(input.operation);await assertBountifulActivityOriginalContinuationCurrent(input.continuation,gateway,facts.source)
 if(getRoomSession()?.memberId!==owner.memberId||getRoomSession()?.roomId!==owner.roomId||getRoomSession()?.role!=='dm')throw Error('activity-later-original:changed-host')
 await gateway.publishEvent('bountiful-original-mint-dm-to-host',{id,receipt});await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat?.bountifulOriginalParents,[id]:receipt}}}],{transactionId:'bountiful-original-issue:'+id,readRevisions:{...receipt.identity.revisions,'player-action-requests':revision(queue)}})
 readBountifulActivityOriginalOperation(input.operation);return receipt
}
