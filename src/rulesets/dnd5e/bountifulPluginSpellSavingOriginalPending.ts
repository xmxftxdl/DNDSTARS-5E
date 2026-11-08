import{readDnd5ePluginSpellCompoundAnsweredQualification}from'./pluginSpellCompoundQualification'
import{readDnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'./pluginSpellCompoundPrimaryAnsweredQualification'
import{readDnd5ePluginSpellSavingQualifiedResolver,readDnd5ePluginSpellSavingCompoundQualification,assertDnd5ePluginSpellSavingOriginalPrefix}from'./pluginSpellSavingOriginalOperation'
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{readDnd5eActualOriginalAllyBoundary}from'./damageCommitSession'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{readActualInterruptedActivitySavingPool}from'./activities/activitySavingOriginalDice'
import{readDnd5ePluginSpellSavingOriginalQualification,readDnd5ePluginSpellSavingOriginalQualificationCurrent,type Dnd5ePluginSpellSavingOriginalQualification}from'./pluginSpellSavingOriginalOperation'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Request=ReturnType<typeof readDnd5eActualOriginalAllyBoundary>['request']
export type BountifulPluginSpellSavingPendingGateway=Pick<SharedRoomGatewayPort,'loadResource'>&{loadBountifulPluginSpellSavingOriginalSource:NonNullable<SharedRoomGatewayPort['loadBountifulPluginSpellSavingOriginalSource']>}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const issued=new WeakMap<object,{source:Source;sourceSignature:string;qualification:Dnd5ePluginSpellSavingOriginalQualification;receiptsSignature:string;resultSignature:string;request:Request;pool:NonNullable<ReturnType<typeof readActualInterruptedActivitySavingPool>>;effectTimestamp:number;occurrence:number}>()

/** Only a real replay pause of a confirmed protected saving pool may introduce
 * its next B or Own phase under the same original parent. This record supplies no die or world result. */
export function captureBountifulPluginSpellSavingPending(input:{stage:object;source:Source;qualification:Dnd5ePluginSpellSavingOriginalQualification;receipts:readonly BountifulOriginalDieReceipt[]}){
 const qualified=readDnd5ePluginSpellSavingOriginalQualification(input.qualification,input.source),facts=readDnd5eActualOriginalAllyBoundary(input.stage),pool=readActualInterruptedActivitySavingPool(facts.error),first=input.receipts[0],occurrence=(input.stage as{occurrence?:unknown}).occurrence
 const compound=readDnd5ePluginSpellSavingCompoundQualification(input.qualification),answered=compound&&readDnd5ePluginSpellCompoundAnsweredQualification(compound),prefix=answered&&readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(answered)
 const{hostOriginalD20Replay:_replay,...source}=facts.input as Source&{hostOriginalD20Replay?:unknown};void _replay
 if(facts.resolve!==(answered?readDnd5ePluginSpellSavingQualifiedResolver(input.qualification):resolvePreparedDnd5ePluginSpellCast)||!Number.isSafeInteger(occurrence)||Number(occurrence)<1||Number(occurrence)!==input.receipts.length||!first||first.request.nativeLucky||facts.request.kind!=='saving-throw'||facts.request.originalRolls[facts.request.dieIndex]!==1||!pool||pool.actorId!==facts.request.actorId||signature(pool.values)!==signature(facts.request.originalRolls)||facts.effectTimestamp!==qualified.effectTimestamp||signature(source)!==signature(input.source)||prefix&&input.receipts.length<prefix.facts.length||input.receipts.some((row,index)=>row.identity.occurrence!==index||row.identity.parentId!==first.identity.parentId||row.identity.effectTimestamp!==qualified.effectTimestamp||row.consumed||(prefix&&index<prefix.facts.length?signature(row)!==signature(prefix.receipts[index]):row.request.kind!=='saving-throw')))throw Error('plugin-spell-saving-pending:actual-same-original-phase-required')
 for(const[index,receipt]of input.receipts.entries())if(!prefix||index>=prefix.facts.length)assertDnd5ePluginSpellSavingOriginalPrefix(decodeSecondChanceParentWire(receipt.originalParent)as Source,input.source)
 const value={status:'pending-record'as const,request:structuredClone(facts.request),snapshot:structuredClone(facts.snapshot),occurrence:Number(occurrence)}
 issued.set(value,{source:cloneDnd5eHostTransactionInput(input.source),sourceSignature:signature(input.source),qualification:input.qualification,receiptsSignature:signature(input.receipts),resultSignature:signature(value),request:structuredClone(facts.request),pool:structuredClone(pool),effectTimestamp:facts.effectTimestamp,occurrence:Number(occurrence)})
 return value
}
export function readBountifulPluginSpellSavingPending(value:object,source:Source,qualification:Dnd5ePluginSpellSavingOriginalQualification,receipts:readonly BountifulOriginalDieReceipt[]){
 const row=issued.get(value)
 if(!row||row.qualification!==qualification||row.sourceSignature!==signature(source)||row.receiptsSignature!==signature(receipts)||row.resultSignature!==signature(value))throw Error('plugin-spell-saving-pending:exact-private-native-pause-required')
 readDnd5ePluginSpellSavingOriginalQualification(qualification,source)
 return{source:cloneDnd5eHostTransactionInput(row.source),request:structuredClone(row.request),pool:structuredClone(row.pool),effectTimestamp:row.effectTimestamp,occurrence:row.occurrence}
}
/** The independently authenticated Node book and canonical current receipt
 * rows remain necessary after the Native observation has been captured. */
export async function readBountifulPluginSpellSavingPendingCurrent(value:object,source:Source,qualification:Dnd5ePluginSpellSavingOriginalQualification,receipts:readonly BountifulOriginalDieReceipt[],gateway:BountifulPluginSpellSavingPendingGateway){
 const native=readBountifulPluginSpellSavingPending(value,source,qualification,receipts),first=receipts[0]
 if(!first?.rawIssuer)throw Error('plugin-spell-saving-pending:actual-first-original-required')
 const book=await gateway.loadBountifulPluginSpellSavingOriginalSource({parentId:first.identity.parentId,mapId:first.identity.mapId,combatId:first.identity.combatId}),slot=book.rows.find(row=>row.rollId===native.pool.rollId)
 const current=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),rows=Object.values(current?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===first.identity.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 if(book.parentId!==first.identity.parentId||book.mapId!==first.identity.mapId||book.combatId!==first.identity.combatId||book.roomId!==first.identity.roomId||book.hostMemberId!==first.identity.hostMemberId||book.effectTimestamp!==native.effectTimestamp||!slot?.raw||!slot.confirmed||slot.confirmed.memberId!==book.hostMemberId||slot.actorId!==native.request.actorId||slot.rollId!==native.pool.rollId||slot.checkId!==native.pool.checkId||slot.activityId!==native.pool.activityId||slot.mode!==native.pool.mode||slot.ability!==native.pool.ability||first.rawIssuer.mode!=='dm'||signature(slot.confirmed.values)!==signature(native.request.originalRolls)||book.rows.some(row=>!row.raw||!row.confirmed)||signature(rows)!==signature(receipts))throw Error('plugin-spell-saving-pending:current-protected-original-required')
 readDnd5ePluginSpellSavingOriginalQualificationCurrent(qualification,source,book)
 readBountifulPluginSpellSavingPending(value,source,qualification,receipts)
 return{...native,rawIssuer:{mode:'dm'as const,rollId:slot.requestId,cursor:slot.index+1}}
}
