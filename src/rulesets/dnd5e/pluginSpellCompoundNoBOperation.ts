import{dnd5ePluginSpellCompoundForSource,projectDnd5ePluginSpellCompoundSource,readDnd5ePluginSpellCompoundQualification}from'./pluginSpellCompoundQualification'
import{createDnd5ePluginSpellSavingOriginalCollector,createDnd5ePluginSpellSavingOriginalCollectorFromBook}from'./pluginSpellSavingOriginalOperation'
import{createDnd5eAllyOriginalCollectionSession}from'./damageCommitSession'
import{resolvePreparedDnd5ePluginSpellCompound}from'./pluginSpellCompoundNative'
import{withActivityEffectOriginalMissing,readActivityEffectOriginalMissing,type ActivityEffectOriginalPool}from'./activities/activityEffectOriginalMissing'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{dnd5eRulesPluginRegistrySnapshot}from'./pluginApi'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{BountifulPluginSpellSavingOriginalBook}from'../../ports/dnd5ePluginSpellSavingOriginalTransport'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCompound>[0]
type Book=BountifulPluginSpellSavingOriginalBook
type Result=ReturnType<typeof resolvePreparedDnd5ePluginSpellCompound>
declare const noB:unique symbol
export type Dnd5ePluginSpellCompoundNoBOperation={readonly[noB]:true}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value)),issued=new WeakMap<object,{source:Source;book:Book;result?:Result;request?:Readonly<ActivityEffectOriginalPool>;guard:()=>void}>()
/** The complete original ledger is rediscovered through genuine fixed Native
 * missing pools. No first B receipt, replacement, or caller resolver is minted. */
export function observeDnd5ePluginSpellCompoundNoB(input:{source:Source;book:Book}){
 const compound=dnd5ePluginSpellCompoundForSource(input.source);if(!compound)throw Error('ice-knife-no-b:actual-primary-required')
 const primary=readDnd5ePluginSpellCompoundQualification(compound),book=structuredClone(input.book),p=input.source.prepared,registry=dnd5eRulesPluginRegistrySnapshot()
 if(book.parentId!==p.action.id||book.mapId!==p.map.id||book.combatId!==p.state.combatId||book.effectTimestamp!==primary.primaryBook.effectTimestamp||signature(book.primaryAnchor?.book)!==signature(primary.primaryBook)||!book.rows.length||primary.primaryBook.rows.some(row=>!row.confirmed||row.confirmed.values.includes(1)))throw Error('ice-knife-no-b:exact-non1-primary-book-required')
 const first=createDnd5ePluginSpellSavingOriginalCollector(input.source),workers:[{cancel:()=>void}]=[first];let ended=false
 try{
  let stage=first.run();if(stage.status!=='missing-activity-saving-original')throw Error('ice-knife-no-b:actual-first-saving-missing-required');const frontier=first.operation(stage),full=createDnd5ePluginSpellSavingOriginalCollectorFromBook(frontier,book,[]);workers.push(full)
  for(const[index,row]of book.rows.entries()){
   if(stage.status!=='missing-activity-saving-original')throw Error('ice-knife-no-b:exact-next-saving-required');const r=stage.request
   if(row.index!==index||row.rollId!==r.rollId||row.activityId!==r.activityId||row.checkId!==r.checkId||row.actorId!==r.actorId||row.sourceActorId!==r.sourceActorId||row.ability!==r.ability||row.mode!==r.mode||row.count!==r.count||row.sides!==r.sides||!row.raw||!row.confirmed||row.raw.memberId!==row.memberId||row.confirmed.memberId!==book.hostMemberId||[row.raw.values,row.confirmed.values].some(values=>values.length!==row.count||values.some(value=>!Number.isInteger(value)||value<1||value>20))||row.confirmed.values.includes(1))throw Error('ice-knife-no-b:exact-native-confirmed-non1-saving-required')
   const worker=createDnd5ePluginSpellSavingOriginalCollectorFromBook(frontier,{...book,source:encodeSecondChanceParentWire(input.source),rows:book.rows.slice(0,index+1)},[]);workers.push(worker)
   try{stage=withActivityEffectOriginalMissing(()=>worker.run())}catch(error){if(index!==book.rows.length-1||!readActivityEffectOriginalMissing(error))throw error;break}
   if(stage.status==='pending-ally-natural-one')throw Error('ice-knife-no-b:actual-pending-is-not-no-b')
  }
  const original=cloneDnd5eHostTransactionInput(decodeSecondChanceParentWire(book.source))as Source;original.rolls={...original.rolls,activityRolls:{...original.rolls.activityRolls}};for(const row of book.rows){const prior=original.rolls.activityRolls![row.rollId];if(prior&&signature(prior.values)!==signature(row.confirmed!.values))throw Error('ice-knife-no-b:changed-locked-saving');original.rolls.activityRolls![row.rollId]=prior??{values:[...row.confirmed!.values],modifier:0,total:row.confirmed!.values.reduce((a,b)=>a+b,0)}}
  let source=projectDnd5ePluginSpellCompoundSource(compound,original),result:Result|undefined,request:Readonly<ActivityEffectOriginalPool>|undefined
  for(let index=0;index<=(book.effects??[]).length;index++){
   const native={...source,hostOriginalD20Replay:{parentId:book.parentId,effectTimestamp:book.effectTimestamp,sourceKey:originalD20ReplaySourceKey(book.parentId,p.state,p.action,book.effectTimestamp),facts:[]}},worker=createDnd5eAllyOriginalCollectionSession(native,resolvePreparedDnd5ePluginSpellCompound);workers.push(worker);request=undefined
   try{const current=withActivityEffectOriginalMissing(()=>worker.run(p.state));if(current.status!=='resolved'||!current.result.result.ok)throw Error('ice-knife-no-b:actual-complete-without-b-required');result=current.result}catch(error){request=readActivityEffectOriginalMissing(error);if(!request)throw error}
   const row=book.effects?.[index];if(!row){if(index!==(book.effects??[]).length)throw Error('ice-knife-no-b:effect-prefix-required');break}
   const recipe=request?.rolls.find(recipe=>recipe.rollId===row.rollId);if(result||row.index!==index||!recipe||request!.activityId!==row.activityId||request!.actorId!==row.actorId||recipe.count!==row.count||recipe.sides!==row.sides||recipe.modifier!==row.modifier||!row.raw||!row.confirmed||row.raw.memberId!==row.memberId||row.confirmed.memberId!==book.hostMemberId||[row.raw.values,row.confirmed.values].some(values=>values.length!==row.count||values.some(value=>!Number.isInteger(value)||value<1||value>row.sides))||Object.hasOwn(source.rolls.activityRolls!,row.rollId))throw Error('ice-knife-no-b:actual-next-adopted-formula-required')
   source=projectDnd5ePluginSpellCompoundSource(compound,{...source,rolls:{...source.rolls,activityRolls:{...source.rolls.activityRolls,[row.rollId]:{values:[...row.confirmed.values],modifier:row.modifier,total:row.confirmed.values.reduce((a,b)=>a+b,0)+row.modifier}}}})
  }
  if(result&&result.result.events.some(event=>event.type==='ally-natural-one-rerolled'))throw Error('ice-knife-no-b:foreign-b-result')
  const sourceSignature=signature(source),resultSignature=signature(result),bookSignature=signature(book),guard=()=>{if(ended||registry!==dnd5eRulesPluginRegistrySnapshot()||signature(source)!==sourceSignature||signature(result)!==resultSignature||signature(book)!==bookSignature)throw Error('ice-knife-no-b:current-unchanged-native-required');readDnd5ePluginSpellCompoundQualification(compound)}
  const operation=Object.freeze({})as Dnd5ePluginSpellCompoundNoBOperation;issued.set(operation,{source,book,result,request:request?structuredClone(request):undefined,guard});return{operation,close(){if(!ended){ended=true;for(const worker of workers)worker.cancel()}}}
 }catch(error){for(const worker of workers)worker.cancel();throw error}
}
export function readDnd5ePluginSpellCompoundNoBOperation(operation:Dnd5ePluginSpellCompoundNoBOperation){const value=issued.get(operation);if(!value)throw Error('ice-knife-no-b:actual-issued-native-required');value.guard();return{source:cloneDnd5eHostTransactionInput(value.source),book:structuredClone(value.book),...(value.result?{result:cloneDnd5eHostTransactionInput(value.result)}:{}),...(value.request?{request:structuredClone(value.request)}:{})}}
