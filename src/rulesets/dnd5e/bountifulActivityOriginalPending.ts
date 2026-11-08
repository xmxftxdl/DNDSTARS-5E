import{readDnd5eActualOriginalAllyBoundary}from'./damageCommitSession'
import{resolveBountifulPreparedActivityOriginal}from'./bountifulActivityOriginalPort'
import{readActualInterruptedActivityAbilityPool}from'./activities/activityAbilityOriginalDice'
import{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{bountifulActivityOriginalSourceFacts}from'../../../shared/bountiful-activity-original.mjs'
import type{BountifulActivityOriginalContinuationGateway}from'./bountifulActivityOriginalContinuation'
type Source=Parameters<typeof resolveBountifulPreparedActivityOriginal>[0]
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
type Request=ReturnType<typeof readDnd5eActualOriginalAllyBoundary>['request']
const issued=new WeakMap<object,{source:Source;sourceSignature:string;qualification:BountifulActivityOriginalQualification;receiptsSignature:string;resultSignature:string;request:Request;pool:NonNullable<ReturnType<typeof readActualInterruptedActivityAbilityPool>>;effectTimestamp:number;occurrence:number}>()
/** This is a completed observation of a real replay pause, not an initial
 * qualification, physical die, owner answer, or world-result capability. */
export function captureBountifulActivityPendingOwnLucky(input:{stage:object;source:Source;qualification:BountifulActivityOriginalQualification;receipts:readonly BountifulOriginalDieReceipt[]}){
 const qualified=readBountifulActivityOriginalQualification(input.qualification,input.source),facts=readDnd5eActualOriginalAllyBoundary(input.stage),pool=readActualInterruptedActivityAbilityPool(facts.error),first=input.receipts[0],occurrence=(input.stage as{occurrence?:unknown}).occurrence,{hostOriginalD20Replay:_replay,...source}=facts.input as Source&{hostOriginalD20Replay?:unknown};void _replay
 if(facts.resolve!==resolveBountifulPreparedActivityOriginal||!Number.isSafeInteger(occurrence)||Number(occurrence)<1||Number(occurrence)!==input.receipts.length||!first||first.request.nativeLucky===true&&(qualified.request.nativeLucky!==true||first.nativeLuckyChoiceVersion!==1)||!facts.request.nativeLucky||facts.request.kind!=='ability-check'||facts.request.originalRolls[facts.request.dieIndex]!==1||!pool||pool.actorId!==facts.request.actorId||signature(pool.values)!==signature(facts.request.originalRolls)||facts.effectTimestamp!==qualified.effectTimestamp||signature(source)!==signature(input.source)||input.receipts.some((row,index)=>row.identity.occurrence!==index||row.identity.parentId!==first.identity.parentId||row.consumed||signature(row.originalParent)!==signature(first.originalParent)||row.request.kind!=='ability-check'||row.identity.effectTimestamp!==qualified.effectTimestamp))throw Error('activity-pending:actual-same-original-own-lucky-required')
 const value={status:'pending-record'as const,request:structuredClone(facts.request),snapshot:structuredClone(facts.snapshot),occurrence:Number(occurrence)}
 issued.set(value,{source:cloneDnd5eHostTransactionInput(input.source),sourceSignature:signature(input.source),qualification:input.qualification,receiptsSignature:signature(input.receipts),resultSignature:signature(value),request:structuredClone(facts.request),pool:structuredClone(pool),effectTimestamp:facts.effectTimestamp,occurrence:Number(occurrence)})
 return value
}
/** The driver supplies canonical rows just reread from the authenticated
 * source. A caller-authored replay transcript cannot replace those rows. */
export function readBountifulActivityPendingOwnLucky(value:object,source:Source,qualification:BountifulActivityOriginalQualification,receipts:readonly BountifulOriginalDieReceipt[]){
 const row=issued.get(value);if(!row||row.qualification!==qualification||row.sourceSignature!==signature(source)||row.receiptsSignature!==signature(receipts)||row.resultSignature!==signature(value))throw Error('activity-pending:exact-private-native-pause-required')
 readBountifulActivityOriginalQualification(qualification,source)
 return{source:cloneDnd5eHostTransactionInput(row.source),request:structuredClone(row.request),pool:structuredClone(row.pool),effectTimestamp:row.effectTimestamp,occurrence:row.occurrence}
}
/** Authenticated reads remain independent of the Native observation. Neither
 * a caller-authored book nor a prior transcript can authorize the next row. */
export async function readBountifulActivityPendingOwnLuckyCurrent(value:object,source:Source,qualification:BountifulActivityOriginalQualification,receipts:readonly BountifulOriginalDieReceipt[],gateway:BountifulActivityOriginalContinuationGateway){
 const native=readBountifulActivityPendingOwnLucky(value,source,qualification,receipts),first=receipts[0]
 if(!first?.rawIssuer)throw Error('activity-pending:actual-first-original-required')
 const book=await gateway.loadBountifulActivityOriginalSource({parentId:first.identity.parentId,mapId:first.identity.mapId,combatId:first.identity.combatId}),slot=book.rows.find(row=>row.rollId===native.pool.rollId),current=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),rows=Object.values(current?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===first.identity.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),bookFacts=bountifulActivityOriginalSourceFacts(book.source),sourceFacts=bountifulActivityOriginalSourceFacts(encodeSecondChanceParentWire(source))
 if(book.parentId!==first.identity.parentId||book.mapId!==first.identity.mapId||book.combatId!==first.identity.combatId||book.roomId!==first.identity.roomId||book.hostMemberId!==first.identity.hostMemberId||book.effectTimestamp!==native.effectTimestamp||!slot?.raw||!slot.confirmed||slot.confirmed.memberId!==book.hostMemberId||slot.actorId!==native.request.actorId||slot.rollId!==native.pool.rollId||slot.checkId!==native.pool.checkId||slot.activityId!==native.pool.activityId||slot.mode!==native.pool.mode||slot.skill!==native.request.skill||!Number.isSafeInteger(slot.index)||slot.index<0||signature(slot.confirmed.values)!==signature(native.request.originalRolls)||book.rows.some(row=>!row.raw||!row.confirmed)||!bookFacts||!sourceFacts||signature(bookFacts.base)!==signature(sourceFacts.base)||signature(rows)!==signature(receipts))throw Error('activity-pending:current-protected-original-required')
 for(const previous of rows){const original=book.rows.find(row=>row.requestId===previous.rawIssuer?.rollId);if(!original?.raw||!original.confirmed||previous.rawIssuer?.mode!=='dm'||previous.rawIssuer.cursor!==original.index+1||previous.request.actorId!==original.actorId||previous.request.skill!==original.skill||signature(previous.request.originalRolls)!==signature(original.confirmed.values)||previous.identity.effectTimestamp!==book.effectTimestamp)throw Error('activity-pending:exact-preceding-slot-required');decisionFromBountifulOriginalDieReceipt(previous,previous.request)}
 readBountifulActivityPendingOwnLucky(value,source,qualification,receipts)
 return{...native,rawIssuer:{mode:'dm'as const,rollId:slot.requestId,cursor:slot.index+1}}
}
