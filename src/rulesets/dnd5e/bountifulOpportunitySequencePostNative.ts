import{stormFuryMoveRequiresCanonicalSequence}from'./stormFuryMoveRouting'
import{prepareStormFuryMoveNativePrefix,readStormFuryMoveNativePrefixResult,deriveStormFuryMoveNativeBaseCheckpoint,resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{resolveDnd5ePreparedWithMaterialDamageReactions}from'./damageReactionFlow'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readCapturedDnd5eOpportunitySequencePostNativeCheckpoint}from'./opportunityMoveSequence'
import{settleDnd5eConcentrationChecks as settleActualBase,bindDnd5eSequenceConcentrationOriginals,type Dnd5eSequenceConcentrationOriginal}from'../../pages/maps/settleDnd5eCombatResult'
import{readPostNativeActivitySettlementForStage,type PostNativeActivityStage}from'../../pages/maps/postNativeActivityParent'
import type{settleBountifulOpportunityPostNativePrefix}from'./bountifulOpportunityMoveAck'
type Fact=ReturnType<typeof readCapturedDnd5eOpportunitySequencePostNativeCheckpoint>
type Services=Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['services']
type Options=Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['options']
type Settled=Awaited<ReturnType<typeof settleActualBase>>
export interface BountifulOpportunitySequencePostNativeCompletion{readonly actualSequenceBaseCompletion:unique symbol}
const completed=new WeakMap<object,{furyChecked:boolean;fact:Fact;stage:PostNativeActivityStage;settled:Settled;signature:string;roomId:string;memberId:string;unchanged:()=>boolean}>()
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const prefix=(fact:Fact)=>({prepared:fact.source.prepared,request:fact.request,preceding:fact.preceding,rolls:fact.source.attacks[fact.request.actorTokenId],beforeState:fact.beforeState,resolved:fact.resolved})
/** Actual native mechanics only at this stage. The production room factory
 * must separately bind every service pool to its protected window journal. */
export async function settleBountifulOpportunitySequencePostNative(input:{checkpoint:object;services:Services;options:Options;resolveConcentrationOriginal?:(frame:Dnd5eSequenceConcentrationOriginal)=>Promise<readonly number[]|object|undefined>;resolveConcentrationResult?:(frame:Dnd5eSequenceConcentrationOriginal)=>Promise<object>}){
 const fact=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(input.checkpoint),host=getRoomSession()
 if(host?.role!=='dm'||!input.options.authorityUnchanged()||!fact.resolved.result.ok||!fact.resolved.application)throw Error('opportunity-sequence-post-native:actual-live-prefix-required')
 const transactionId=fact.resolved.result.transaction?.id
 if(transactionId!==fact.request.parentId+':sequence-opportunity:'+fact.request.windowIndex+':'+fact.request.actorTokenId)throw Error('opportunity-sequence-post-native:actual-native-transaction-required')
 let native=fact.resolved,furyChecked=false
 const attack=fact.resolved.result.events.find(event=>event.type==='attack-resolved'&&event.actorId===fact.request.actorTokenId&&event.opportunityAttack===true),candidate=attack?.type==='attack-resolved'&&stormFuryMoveRequiresCanonicalSequence(fact.resolved.result.state,attack.targetId)
 if(input.options.enableStormFuryHit&&candidate){const source=prepareStormFuryMoveNativePrefix(input.checkpoint),resolved=await resolveDnd5ePreparedWithMaterialDamageReactions({...input.options,replayEventBatchId:fact.request.parentId},source,resolveDnd5eOpportunityMoveSequenceOriginal);readStormFuryMoveNativePrefixResult(input.checkpoint,resolved);if(!resolved.result.ok||!resolved.application||!input.options.authorityUnchanged())throw Error('storm-fury-move-prefix:current-prefix-result-required');native=resolved;furyChecked=true}
 if(!native.result.ok||!native.application)throw Error('storm-fury-move-prefix:actual-successful-base-input-required')
 const nativeBaseCheckpoint=furyChecked?deriveStormFuryMoveNativeBaseCheckpoint(input.checkpoint,native as ReturnType<typeof resolveDnd5eOpportunityMoveSequenceOriginal>):input.checkpoint
 let stage:PostNativeActivityStage|undefined
  const baseInput:Parameters<typeof settleActualBase>[0]={...input.services,result:cloneDnd5eHostTransactionInput(native.result),priorState:cloneDnd5eHostTransactionInput(fact.beforeState),map:cloneDnd5eHostTransactionInput(native.application!.map),characters:cloneDnd5eHostTransactionInput(native.application!.characters),characterIdByCombatantId:fact.source.prepared.characterIdByCombatantId,priorApplication:cloneDnd5eHostTransactionInput(native.application),hostParentTransactionId:transactionId,followupTransactionNow:()=>fact.source.prepared.input.firstHostNow,damageReactions:input.options,settleActivityTriggers:async request=>{
  if(!request.stage)throw Error('opportunity-sequence-post-native:actual-base-stage-required')
  stage=request.stage
  return input.services.settleActivityTriggers(request)
  }}
  if(input.resolveConcentrationOriginal)bindDnd5eSequenceConcentrationOriginals(baseInput,nativeBaseCheckpoint,input.options.authorityUnchanged,input.resolveConcentrationOriginal,input.resolveConcentrationResult)
  const settled=await settleActualBase(baseInput)
 const current=getRoomSession()
 if(!stage||current?.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId||!input.options.authorityUnchanged())throw Error('opportunity-sequence-post-native:stale-native-prefix')
 readPostNativeActivitySettlementForStage(stage,settled)
 const completion=Object.freeze({})as BountifulOpportunitySequencePostNativeCompletion
 completed.set(completion,{furyChecked,fact,stage,settled,signature:signature(settled),roomId:host.roomId,memberId:host.memberId,unchanged:input.options.authorityUnchanged})
 return completion
}
/** The actual native replay supplies another real postfix checkpoint. A
 * caller graph can neither issue a completion nor replace its Base material. */
export function readBountifulOpportunitySequencePostNativeCompletion(completion:object,checkpoint:object){
 const proof=completed.get(completion),current=getRoomSession(),fact=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint)
 if(!proof||current?.role!=='dm'||current.roomId!==proof.roomId||current.memberId!==proof.memberId||!proof.unchanged()||signature(proof.settled)!==proof.signature)throw Error('opportunity-sequence-post-native:exact-live-base-completion-required')
 if(proof.fact.request.parentId!==fact.request.parentId)throw Error('opportunity-sequence-post-native:foreign-original-parent')
 if(proof.fact.request.actorTokenId!==fact.request.actorTokenId||proof.fact.request.windowIndex!==fact.request.windowIndex)return undefined
 if(signature(prefix(proof.fact))!==signature(prefix(fact)))throw Error('opportunity-sequence-post-native:changed-actual-native-prefix')
 readPostNativeActivitySettlementForStage(proof.stage,proof.settled)
 return cloneDnd5eHostTransactionInput(proof.settled)
}

/** Data identifies a genuine already-issued Base cap; it cannot issue one. */
export function readBountifulOpportunitySequencePostNativeCompletionReplayFacts(completion:object){
 const proof=completed.get(completion),current=getRoomSession()
 if(!proof||current?.role!=='dm'||current.roomId!==proof.roomId||current.memberId!==proof.memberId||!proof.unchanged()||signature(proof.settled)!==proof.signature)throw Error('opportunity-sequence-post-native:exact-live-base-completion-required')
 readPostNativeActivitySettlementForStage(proof.stage,proof.settled)
 return{parentId:proof.fact.request.parentId,windowIndex:proof.fact.request.windowIndex,actorId:proof.fact.request.actorTokenId,prepared:signature(proof.fact.source.prepared)}
}

/** A read-only marker of a real checked prefix and real Base completion. */
export function stormFurySequencePostNativeChecked(completion:object){readBountifulOpportunitySequencePostNativeCompletionReplayFacts(completion);return completed.get(completion)!.furyChecked}
