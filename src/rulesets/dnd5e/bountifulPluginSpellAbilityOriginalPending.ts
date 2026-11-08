import{readDnd5eActualOriginalAllyBoundary}from'./damageCommitSession'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{readActualInterruptedActivityAbilityPool}from'./activities/activityAbilityOriginalDice'
import{readBountifulPluginSpellAbilityOriginalQualification,type BountifulPluginSpellAbilityOriginalQualification}from'./bountifulPluginSpellAbilityOriginalBoundary'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{bountifulPluginSpellAbilityOriginalSourceFacts}from'../../../shared/bountiful-plugin-spell-ability-original.mjs'
import type{BountifulPluginSpellAbilityOriginalContinuationGateway}from'./bountifulPluginSpellAbilityOriginalContinuation'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
type Request=ReturnType<typeof readDnd5eActualOriginalAllyBoundary>['request']
const issued=new WeakMap<object,{source:Source;sourceSignature:string;qualification:BountifulPluginSpellAbilityOriginalQualification;receiptsSignature:string;resultSignature:string;request:Request;pool:NonNullable<ReturnType<typeof readActualInterruptedActivityAbilityPool>>;effectTimestamp:number;occurrence:number}>()
/** This is a completed observation of a real replay pause, not an initial
 * qualification, physical die, owner answer, or world-result capability. */
export function captureBountifulPluginSpellAbilityPendingOwnLucky(input:{stage:object;source:Source;qualification:BountifulPluginSpellAbilityOriginalQualification;receipts:readonly BountifulOriginalDieReceipt[]}){
 const qualified=readBountifulPluginSpellAbilityOriginalQualification(input.qualification,input.source),facts=readDnd5eActualOriginalAllyBoundary(input.stage),pool=readActualInterruptedActivityAbilityPool(facts.error),first=input.receipts[0],occurrence=(input.stage as{occurrence?:unknown}).occurrence,{hostOriginalD20Replay:_replay,...source}=facts.input as Source&{hostOriginalD20Replay?:unknown};void _replay
 if(facts.resolve!==resolvePreparedDnd5ePluginSpellCast||!Number.isSafeInteger(occurrence)||Number(occurrence)<1||Number(occurrence)!==input.receipts.length||!first||first.request.nativeLucky||!facts.request.nativeLucky||facts.request.kind!=='ability-check'||facts.request.actorId!==first.request.actorId||facts.request.skill!==first.request.skill||signature(facts.request.originalRolls)!==signature(first.request.originalRolls)||facts.request.originalRolls[facts.request.dieIndex]!==1||!pool||pool.actorId!==facts.request.actorId||signature(pool.values)!==signature(facts.request.originalRolls)||facts.effectTimestamp!==qualified.effectTimestamp||signature(source)!==signature(input.source)||input.receipts.some((row,index)=>row.identity.occurrence!==index||row.identity.parentId!==first.identity.parentId||row.consumed||signature(row.originalParent)!==signature(first.originalParent)||signature(row.rawIssuer)!==signature(first.rawIssuer)||row.request.actorId!==first.request.actorId||signature(row.request.originalRolls)!==signature(first.request.originalRolls)))throw Error('plugin-spell-ability-pending:actual-same-original-own-lucky-required')
 const value={status:'pending-record'as const,request:structuredClone(facts.request),snapshot:structuredClone(facts.snapshot),occurrence:Number(occurrence)}
 issued.set(value,{source:cloneDnd5eHostTransactionInput(input.source),sourceSignature:signature(input.source),qualification:input.qualification,receiptsSignature:signature(input.receipts),resultSignature:signature(value),request:structuredClone(facts.request),pool:structuredClone(pool),effectTimestamp:facts.effectTimestamp,occurrence:Number(occurrence)})
 return value
}
/** The driver supplies canonical rows just reread from the authenticated
 * source. A caller-authored replay transcript cannot replace those rows. */
export function readBountifulPluginSpellAbilityPendingOwnLucky(value:object,source:Source,qualification:BountifulPluginSpellAbilityOriginalQualification,receipts:readonly BountifulOriginalDieReceipt[]){
 const row=issued.get(value);if(!row||row.qualification!==qualification||row.sourceSignature!==signature(source)||row.receiptsSignature!==signature(receipts)||row.resultSignature!==signature(value))throw Error('plugin-spell-ability-pending:exact-private-native-pause-required')
 readBountifulPluginSpellAbilityOriginalQualification(qualification,source)
 return{source:cloneDnd5eHostTransactionInput(row.source),request:structuredClone(row.request),pool:structuredClone(row.pool),effectTimestamp:row.effectTimestamp,occurrence:row.occurrence}
}
/** Authenticated reads remain independent of the Native observation. Neither
 * a caller-authored book nor a prior transcript can authorize the next row. */
export async function readBountifulPluginSpellAbilityPendingOwnLuckyCurrent(value:object,source:Source,qualification:BountifulPluginSpellAbilityOriginalQualification,receipts:readonly BountifulOriginalDieReceipt[],gateway:BountifulPluginSpellAbilityOriginalContinuationGateway){
 const native=readBountifulPluginSpellAbilityPendingOwnLucky(value,source,qualification,receipts),first=receipts[0]
 if(!first?.rawIssuer)throw Error('plugin-spell-ability-pending:actual-first-original-required')
 const book=await gateway.loadBountifulPluginSpellAbilityOriginalSource({parentId:first.identity.parentId,mapId:first.identity.mapId,combatId:first.identity.combatId}),slot=book.rows.find(row=>row.requestId===first.rawIssuer?.rollId),current=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),rows=Object.values(current?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===first.identity.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),bookFacts=bountifulPluginSpellAbilityOriginalSourceFacts(book.source),sourceFacts=bountifulPluginSpellAbilityOriginalSourceFacts(encodeSecondChanceParentWire(source))
 if(book.parentId!==first.identity.parentId||book.mapId!==first.identity.mapId||book.combatId!==first.identity.combatId||book.roomId!==first.identity.roomId||book.hostMemberId!==first.identity.hostMemberId||book.effectTimestamp!==native.effectTimestamp||!slot?.raw||!slot.confirmed||slot.confirmed.memberId!==book.hostMemberId||slot.actorId!==native.request.actorId||slot.rollId!==native.pool.rollId||slot.checkId!==native.pool.checkId||slot.activityId!==native.pool.activityId||slot.mode!==native.pool.mode||slot.skill!==native.request.skill||slot.index+1!==first.rawIssuer.cursor||first.rawIssuer.mode!=='dm'||signature(slot.confirmed.values)!==signature(native.request.originalRolls)||book.rows.some(row=>!row.raw||!row.confirmed)||!bookFacts||!sourceFacts||signature(bookFacts.base)!==signature(sourceFacts.base)||signature(rows)!==signature(receipts))throw Error('plugin-spell-ability-pending:current-protected-original-required')
 readBountifulPluginSpellAbilityPendingOwnLucky(value,source,qualification,receipts)
 return{...native,rawIssuer:{...first.rawIssuer}}
}
