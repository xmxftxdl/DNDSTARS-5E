import{captureBountifulActivityPendingOwnLucky}from'./bountifulActivityOriginalPending'
import{withActivityAbilityOriginalPoolObserver}from'./activities/activityAbilityOriginalDice'
import{readBountifulActivityOriginalContinuation,type BountifulActivityOriginalContinuation}from'./bountifulActivityOriginalContinuation'
import{readBountifulActivityOriginalQualification,readBountifulActivityOriginalOccurrence,type BountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{createBountifulActivityOriginalNativePort,withBountifulActivityOriginalNativePort,disposeBountifulActivityOriginalNativePort,resolveBountifulPreparedActivityOriginal}from'./bountifulActivityOriginalPort'
import{withTempestuousBeforePlainOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import{withStormCastPreparedOriginalReplay}from'./stormCastPreparedOriginalReplay'
import{StormCastOriginalPrefixPending}from'./stormCastBountifulOriginalPort'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{withBountifulOpportunitySequencePostNativeReplay}from'./bountifulOpportunitySequencePostNativeReplay'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import {bountifulConfirmedReplayFacts} from './bountifulConfirmedReplay'
import {encodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts} from '../../../src/pages/maps/secondChancePreparedHostFacts'
import {createDnd5eOriginalD20Session} from '../../../src/rulesets/dnd5e/damageCommitSession'
import type {Dnd5eHeadlessCombatState} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'

/** Structure only; the opaque issuer verifies the real prefix. */
function hasSequenceReplayAction<T extends{prepared:object}>(source:T):source is T&{prepared:{action:{id:string}}}{const prepared=source.prepared;return 'action'in prepared&&!!prepared.action&&typeof prepared.action==='object'&&'id'in prepared.action&&typeof prepared.action.id==='string'}

/** Pure continuation of the real frozen prepared facade. Storage/authority is
 * owned by the Host adapter; a missing explicit decision stays pending. */
function resumeBountifulOriginalParentCore<Input extends {prepared:{state:Dnd5eHeadlessCombatState}},Result>(input:{
 source:Input;resolve:(input:Input)=>Result;parentId:string;actorId:string
 kind:'attack'|'ability-check'|'saving-throw';receipts:readonly BountifulOriginalDieReceipt[];opportunitySequencePostNativeReplay?:object
},activityOriginalProbe?:Input,activityOriginalContinuation?:BountifulActivityOriginalContinuation,activityPendingRecord?:(stage:object)=>ReturnType<typeof captureBountifulActivityPendingOwnLucky>){
 const originalWire=JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(input.source)))
 const first=input.receipts[0],anchor=JSON.stringify(first?.originalParent),continued=first?.continuation&&first.continuation.hostMemberId===first.identity.hostMemberId?JSON.stringify(first.continuation.source):undefined
 const activitySource=activityOriginalContinuation?readBountifulActivityOriginalContinuation(activityOriginalContinuation,input.source as unknown as Parameters<typeof readBountifulActivityOriginalContinuation>[1],first):undefined
 if(input.receipts.some(receipt=>JSON.stringify(receipt.originalParent)!==anchor)||!!first&&(originalWire!==anchor&&originalWire!==continued&&(!activitySource||originalWire!==JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(activitySource.source))))))throw Error('bountiful-parent:changed-original-input')
 const state=input.source.prepared.state
 const actualAction='action'in input.source.prepared?input.source.prepared.action:undefined
 if((first?.postOriginalD20?.length||input.opportunitySequencePostNativeReplay!==undefined)&&(!actualAction||typeof actualAction!=='object'||!('id'in actualAction)||actualAction.id!==input.parentId))throw Error('bountiful-parent:actual-frozen-action-required')
 const source=first?.postOriginalD20?.length||input.opportunitySequencePostNativeReplay!==undefined?{...input.source,hostOriginalD20Replay:bountifulConfirmedReplayFacts({parentId:input.parentId,source:{prepared:{state,action:actualAction}},receipts:input.receipts})}:input.source
 if(activityOriginalProbe&&(first?.postOriginalD20?.length||input.opportunitySequencePostNativeReplay!==undefined))throw Error('activity-native-port:unsupported-post-original-continuation')
 let probeSource=activityOriginalProbe??source
 if(input.opportunitySequencePostNativeReplay!==undefined){const resolverIdentity:unknown=input.resolve;if(resolverIdentity!==resolveDnd5eOpportunityMoveSequenceOriginal||!hasSequenceReplayAction(source))throw Error('bountiful-parent:actual-sequence-post-native-replay-required');probeSource=withBountifulOpportunitySequencePostNativeReplay(source,input.opportunitySequencePostNativeReplay)}
 const session=createDnd5eOriginalD20Session(probeSource,input.resolve,input.actorId,input.kind)
 try{
  let result=session.run(state)
  if(result.status==='pending-storm-cast'&&(input.resolve as unknown)===resolvePreparedDnd5eSpellCast)throw new StormCastOriginalPrefixPending(result)
  for(let count=0;result.status==='pending-ally-natural-one'&&count<64;count++){
   const pending=result,receipt=input.receipts.find(row=>row.identity.parentId===input.parentId&&row.identity.occurrence===pending.occurrence)
   if(!receipt){if(pending.request.nativeLucky&&activityPendingRecord)return activityPendingRecord(pending);return {status:'pending-record' as const,request:pending.request,snapshot:pending.snapshot,occurrence:pending.occurrence}}
   if(receipt.identity.combatId!==state.combatId||receipt.identity.roller.tokenId!==pending.request.actorId)throw Error('bountiful-parent:wrong-frozen-parent')
   let decision:ReturnType<typeof decisionFromBountifulOriginalDieReceipt>
   try{decision=decisionFromBountifulOriginalDieReceipt(receipt,pending.request)}catch(error){
    if(error instanceof Error&&error.message==='bountiful-parent:decision-still-pending')return {status:'pending-decision' as const,receipt:structuredClone(receipt),request:pending.request,snapshot:pending.snapshot,occurrence:pending.occurrence}
    throw error
   }
   result=session.resumeAllyNaturalOne(state,pending.occurrence,pending.request,decision)
  }
  if(result.status!=='original-d20-ready')throw Error('bountiful-parent:original-boundary-not-reached:'+result.status)
  return result
 }finally{session.cancel()}
}

export function resumeBountifulOriginalParent<Input extends{prepared:{state:Dnd5eHeadlessCombatState}},Result>(input:Parameters<typeof resumeBountifulOriginalParentCore<Input,Result>>[0]&{stormCastPreparedReplay?:object;tempestuousBeforePreparedReplay?:object}){
 if(input.stormCastPreparedReplay!==undefined){if((input.resolve as unknown)!==resolvePreparedDnd5eSpellCast)throw Error('storm-cast-bountiful:actual-core-spell-resolver-required');return withStormCastPreparedOriginalReplay(input.source,input.stormCastPreparedReplay,()=>resumeBountifulOriginalParentCore(input))}if(input.tempestuousBeforePreparedReplay!==undefined){if((input.resolve as unknown)!==resolvePreparedDnd5eSpellCast)throw Error('tempestuous-original:actual-core-spell-required');return withTempestuousBeforePlainOriginalReplay(input.source as unknown as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],input.tempestuousBeforePreparedReplay,()=>resumeBountifulOriginalParentCore(input))}return resumeBountifulOriginalParentCore(input)
}

/** A genuine Activity worker is scoped around the entire actual Session replay.
 * Plain stored source equality is checked before its temporary clock input. */
export async function resumeBountifulActivityOriginalParent(input:Parameters<typeof resumeBountifulOriginalParentCore<Parameters<typeof resolveBountifulPreparedActivityOriginal>[0],ReturnType<typeof resolveBountifulPreparedActivityOriginal>>>[0]&{activityOriginalQualification:BountifulActivityOriginalQualification;activityOriginalPendingQualification?:BountifulActivityOriginalQualification;activityOriginalContinuation?:BountifulActivityOriginalContinuation}){
 if(input.activityOriginalContinuation)readBountifulActivityOriginalContinuation(input.activityOriginalContinuation,input.source,input.receipts[0],input.activityOriginalQualification)
 if(input.resolve!==resolveBountifulPreparedActivityOriginal)throw Error('bountiful-parent:actual-activity-original-required');const facts=readBountifulActivityOriginalQualification(input.activityOriginalQualification,input.source);if(input.kind!=='ability-check'||input.actorId!==facts.request.actorId||input.parentId!==facts.source.prepared.action.id)throw Error('bountiful-parent:actual-activity-original-required');let current=input;if(input.activityOriginalPendingQualification){const pending=readBountifulActivityOriginalQualification(input.activityOriginalPendingQualification,input.source),last=input.receipts[input.receipts.length-1],same=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v));const occurrence=readBountifulActivityOriginalOccurrence(input.activityOriginalPendingQualification,input.source),anchors=input.receipts.filter(row=>row.identity.occurrence===occurrence),anchor=anchors.length===1?anchors[0]:undefined,matchesCurrent=!!anchor&&JSON.stringify(anchor.request)===JSON.stringify(pending.request)&&same(anchor.rawIssuer)===same(pending.rawIssuer)&&anchor.identity.effectTimestamp===pending.effectTimestamp;if(!input.activityOriginalContinuation||occurrence<1||pending.request.kind!=='ability-check'||!last||last.identity.parentId!==input.parentId||(pending.request.nativeLucky?occurrence!==input.receipts.length&&!matchesCurrent:last.identity.occurrence<1||!matchesCurrent))throw Error('activity-replay:actual-current-original-qualification-required');current={...input,actorId:pending.request.actorId}}const port=createBountifulActivityOriginalNativePort(input.source,input.activityOriginalQualification);try{return withBountifulActivityOriginalNativePort(port,input.source,probe=>withActivityAbilityOriginalPoolObserver(()=>{},()=>resumeBountifulOriginalParentCore(current,probe,input.activityOriginalContinuation,stage=>captureBountifulActivityPendingOwnLucky({stage,source:input.source,qualification:input.activityOriginalQualification,receipts:input.receipts}))))}finally{await disposeBountifulActivityOriginalNativePort(port)}
}
