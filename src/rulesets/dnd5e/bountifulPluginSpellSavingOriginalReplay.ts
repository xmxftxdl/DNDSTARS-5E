import{readDnd5ePluginSpellCompoundAnsweredQualification}from'./pluginSpellCompoundQualification'
import{readDnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'./pluginSpellCompoundPrimaryAnsweredQualification'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{readDnd5ePluginSpellSavingCompoundQualification,readDnd5ePluginSpellSavingBeforeQualification,createDnd5ePluginSpellSavingQualifiedD20Session}from'./pluginSpellSavingOriginalOperation'
import{assertDnd5ePluginSpellSavingOriginalPrefix}from'./pluginSpellSavingOriginalOperation'
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{withActivitySavingOriginalPoolObserver}from'./activities/activitySavingOriginalDice'
import{withActivitySavingOriginalMissing}from'./activities/activitySavingOriginalMissing'
import{captureBountifulPluginSpellSavingPending}from'./bountifulPluginSpellSavingOriginalPending'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{readDnd5ePluginSpellSavingOriginalQualification,type Dnd5ePluginSpellSavingOriginalQualification}from'./pluginSpellSavingOriginalOperation'
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
/** A fixed qualified saving replay retains every original pool and private
 * clock. Only a real later Native pause can yield another private-slot record. */
export function resumeBountifulPluginSpellSavingOriginalParent(input:{source:Source;resolve:typeof resolvePreparedDnd5ePluginSpellCast;parentId:string;actorId:string;kind:'saving-throw';receipts:readonly BountifulOriginalDieReceipt[];pluginSpellSavingOriginalQualification:Dnd5ePluginSpellSavingOriginalQualification}){
 const facts=readDnd5ePluginSpellSavingOriginalQualification(input.pluginSpellSavingOriginalQualification,input.source),first=input.receipts[0]
 if(input.resolve!==resolvePreparedDnd5ePluginSpellCast||input.kind!=='saving-throw'||input.actorId!==facts.request.actorId||input.parentId!==facts.source.prepared.action.id||!first||first.request.nativeLucky||first.originalAdapterId!=='plugin-spell'||first.identity.effectTimestamp!==facts.effectTimestamp)throw Error('plugin-spell-saving-replay:exact-qualified-original-required')
 const compound=readDnd5ePluginSpellSavingCompoundQualification(input.pluginSpellSavingOriginalQualification),answered=compound&&readDnd5ePluginSpellCompoundAnsweredQualification(compound),prefix=answered&&readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(answered)
 for(const receipt of input.receipts){if(prefix&&receipt.identity.occurrence<prefix.facts.length){if(JSON.stringify(encodeSecondChanceParentWire(receipt))!==JSON.stringify(encodeSecondChanceParentWire(prefix.receipts[receipt.identity.occurrence])))throw Error('ice-knife-compound:unchanged-authenticated-attack-receipt-prefix-required')}else assertDnd5ePluginSpellSavingOriginalPrefix(decodeSecondChanceParentWire(receipt.originalParent)as Source,input.source)}
 const source={...input.source,hostOriginalD20Replay:{parentId:input.parentId,effectTimestamp:facts.effectTimestamp,sourceKey:originalD20ReplaySourceKey(input.parentId,input.source.prepared.state,input.source.prepared.action,facts.effectTimestamp),facts:[]}}
 const session=(readDnd5ePluginSpellSavingBeforeQualification(input.pluginSpellSavingOriginalQualification)||readDnd5ePluginSpellSavingCompoundQualification(input.pluginSpellSavingOriginalQualification))?createDnd5ePluginSpellSavingQualifiedD20Session(input.pluginSpellSavingOriginalQualification,source,facts.lastOriginalActorId):createDnd5eOriginalD20Session(source,resolvePreparedDnd5ePluginSpellCast,facts.lastOriginalActorId,input.kind)
 try{return withActivitySavingOriginalPoolObserver(()=>{},()=>withActivitySavingOriginalMissing(()=>{
  let stage=session.run(source.prepared.state)
  for(let count=0;stage.status==='pending-ally-natural-one'&&count<64;count++){
   const pending=stage,receipt=input.receipts.find(row=>row.identity.parentId===input.parentId&&row.identity.occurrence===pending.occurrence)
   if(!receipt)return captureBountifulPluginSpellSavingPending({stage:pending,source:input.source,qualification:input.pluginSpellSavingOriginalQualification,receipts:input.receipts})
   if(receipt.identity.combatId!==source.prepared.state.combatId||receipt.identity.roller.tokenId!==pending.request.actorId)throw Error('bountiful-parent:wrong-frozen-parent')
   let decision:ReturnType<typeof decisionFromBountifulOriginalDieReceipt>
   try{decision=decisionFromBountifulOriginalDieReceipt(receipt,pending.request)}catch(error){if(error instanceof Error&&error.message==='bountiful-parent:decision-still-pending')return{status:'pending-decision'as const,receipt:structuredClone(receipt),request:pending.request,snapshot:pending.snapshot,occurrence:pending.occurrence};throw error}
   stage=session.resumeAllyNaturalOne(source.prepared.state,pending.occurrence,pending.request,decision)
  }
  if(stage.status!=='original-d20-ready')throw Error('bountiful-parent:original-boundary-not-reached:'+stage.status)
  readDnd5ePluginSpellSavingOriginalQualification(input.pluginSpellSavingOriginalQualification,input.source)
  return stage
 }))}finally{session.cancel()}
}
