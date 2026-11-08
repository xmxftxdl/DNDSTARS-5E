import{readDnd5ePluginSpellCompoundAnsweredQualification}from'../../rulesets/dnd5e/pluginSpellCompoundQualification'
import{readDnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'../../rulesets/dnd5e/pluginSpellCompoundPrimaryAnsweredQualification'
import{withActivityEffectOriginalMissing,readActivityEffectOriginalMissing}from'../../rulesets/dnd5e/activities/activityEffectOriginalMissing'
import{dnd5ePluginSpellCompoundForSource,projectDnd5ePluginSpellCompoundSource,readDnd5ePluginSpellCompoundQualification}from'../../rulesets/dnd5e/pluginSpellCompoundQualification'
import{bountifulPluginSpellSavingBeforeForPrepared,projectBountifulPluginSpellSavingBeforeSource,restoreBountifulPluginSpellSavingBefore}from'./bountifulPluginSpellSavingBefore'
import{disposePluginTempestuousEarlyRoomPrelude}from'./pluginTempestuousEarlyRoomPrelude'
import{observeBountifulPluginSpellSavingEffects,readBountifulPluginSpellSavingEffectOperation}from'../../rulesets/dnd5e/bountifulPluginSpellSavingEffectOperation'
import{captureBountifulPluginSpellSavingEffectsQualification}from'../../rulesets/dnd5e/bountifulPluginSpellSavingEffectsQualification'
import{createBountifulPluginSpellSavingEffectRaw,readBountifulPluginSpellSavingEffectDiceRoute,type BountifulPluginSpellSavingEffectDiceRoute}from'./bountifulPluginSpellSavingEffectRaw'
import type{BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{createDnd5ePluginSpellSavingOriginalCollector,createDnd5ePluginSpellSavingOriginalCollectorFromBook,readDnd5ePluginSpellSavingOriginalOperation,captureDnd5ePluginSpellSavingOriginalQualification,type Dnd5ePluginSpellSavingOriginalQualification}from'../../rulesets/dnd5e/pluginSpellSavingOriginalOperation'
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{persistBountifulOriginalParent}from'../../rulesets/dnd5e/bountifulLuckPersistentHost'
import{createBountifulPluginSpellSavingOriginalRaw,readBountifulPluginSpellSavingOriginalDiceRoute,type BountifulPluginSpellSavingOriginalDiceRoute}from'./bountifulPluginSpellSavingOriginalRaw'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{restoreSecondChancePreparedHostFactsAsync}from'./secondChancePreparedHostFacts'
import type{BountifulPluginSpellSavingOriginalIdentity,BountifulPluginSpellSavingOriginalBook}from'../../ports/dnd5ePluginSpellSavingOriginalTransport'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'publishEvent'|'saveResourcesAtomically'>
type Loader=(identity:BountifulPluginSpellSavingOriginalIdentity)=>Promise<BountifulPluginSpellSavingOriginalBook>
type Spec=Awaited<ReturnType<typeof readBountifulPluginSpellSavingOriginalDiceRoute>>
const same=(a:unknown,b:unknown)=>JSON.stringify(encodeSecondChanceParentWire(a))===JSON.stringify(encodeSecondChanceParentWire(b))
const identity=(source:Source)=>({parentId:source.prepared.action.id,mapId:source.prepared.map.id,combatId:source.prepared.state.combatId})
/** Presence-only UI scheduling. No faces or permissions are produced, and the
 * genuine Native stage and Node source still independently decide eligibility. */
export function canObserveBountifulPluginSpellSavingOriginal(prepared:Source['prepared']){return prepared.activity?.checks?.length===1&&prepared.activity.checks[0].kind==='saving-throw'&&Object.values(prepared.state.combatants).some(actor=>actor.pluginFeatureIds.some(id=>{const feature=dnd5ePluginFeatureDefinition(id);return feature?.automation==='full'&&dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)&&feature.declarativeAbility?.mechanic?.kind==='ally-natural-one-reroll'}))}
async function optionalBook(id:BountifulPluginSpellSavingOriginalIdentity,load:Loader){try{return await load(id)}catch(error){if(error instanceof Error&&error.message==='plugin-spell-saving-original:current-private-book-required')return undefined;throw error}}
/** The Node loader authenticates current Room/world/source. A real fixed Native
 * frontier then checks its source and each already adopted saving slot. */
export async function restoreBountifulPluginSpellSavingInitialSource(prepared:Source['prepared'],load:Loader):Promise<Source|undefined>{
 if(!canObserveBountifulPluginSpellSavingOriginal(prepared))return
 const id={parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId},book=await optionalBook(id,load);if(!book)return
 let source=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(book.source))as Source
 if(!same(source.prepared.action,prepared.action))throw Error('plugin-spell-saving-original:changed-queued-declaration')
 const restoredBefore=book.beforeAnchor?await restoreBountifulPluginSpellSavingBefore(source,book,load):undefined;if(restoredBefore)source=restoredBefore.source
 try{
 const initial=createDnd5ePluginSpellSavingOriginalCollector(source)
 try{const stage=initial.run(),replay=createDnd5ePluginSpellSavingOriginalCollectorFromBook(initial.operation(stage),book,[],book.rows[book.rows.length-1]?.actorId);try{const current=replay.run();if(!['missing-activity-saving-original','pending-ally-natural-one','original-d20-ready'].includes(current.status)&&!(current.status==='resolved'&&current.result.result.ok))throw Error('plugin-spell-saving-original:actual-restored-frontier-required');return source}finally{replay.cancel()}}finally{initial.cancel()}
 }catch(error){if(restoredBefore)disposePluginTempestuousEarlyRoomPrelude(restoredBefore.early);throw error}
}
/** Owns the live initial saving worker until the actual Page publication/cancel.
 * It returns original adopted faces, never substitutes B rerolls into caller dice. */
export function createBountifulPluginSpellSavingRoomCollector(input:{source:Source;gateway:Gateway;load:Loader;settlePending:(pending:{parentId:string;source:Source;qualification:Dnd5ePluginSpellSavingOriginalQualification})=>Promise<void>;roll:(spec:Spec,route:BountifulPluginSpellSavingOriginalDiceRoute)=>Promise<readonly number[]>;rollEffect?:(spec:Awaited<ReturnType<typeof readBountifulPluginSpellSavingEffectDiceRoute>>,route:BountifulPluginSpellSavingEffectDiceRoute,visibility:'dm'|'public')=>Promise<readonly number[]>}){
 const compound=dnd5ePluginSpellCompoundForSource(input.source),before=bountifulPluginSpellSavingBeforeForPrepared(input.source.prepared),source=before?projectBountifulPluginSpellSavingBeforeSource(before,input.source):compound?projectDnd5ePluginSpellCompoundSource(compound,input.source):cloneDnd5eHostTransactionInput(input.source)
 const answered=compound&&readDnd5ePluginSpellCompoundAnsweredQualification(compound),firstSavingOccurrence=answered?readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(answered).facts.length:0
 let ended=false,retained:{source:Source;qualification:Dnd5ePluginSpellSavingOriginalQualification}|undefined
 const effectWorkers=new Set<{close:()=>void}>();let effectQualification:Awaited<ReturnType<typeof captureBountifulPluginSpellSavingEffectsQualification>>|undefined
 const effectIds=((compound?readDnd5ePluginSpellCompoundQualification(compound).header.activity:source.prepared.activity)?.outcomes??[]).flatMap(outcome=>outcome.operations.flatMap(operation=>operation.kind==='damage'&&operation.amount.kind==='dice'?[operation.amount.rollId]:[]))
 const isEffectDeclaration=(declaration:{id:string;d20RollKind?:string})=>declaration.d20RollKind===undefined&&effectIds.some(id=>declaration.id===id||declaration.id.startsWith(id+':'))
 const effectGateway={...input.gateway,loadBountifulPluginSpellSavingOriginalSource:input.load}
 const workers=new Set<ReturnType<typeof createDnd5ePluginSpellSavingOriginalCollector>>()
 const guard=()=>{if(ended)throw Error('plugin-spell-saving-collector:current-live-worker-required')}
 return{get hasOriginal(){guard();return!!retained},original(){guard();return retained?{...retained,effects:effectQualification?.qualification}:undefined},isEffectDeclaration(declaration:{id:string;d20RollKind?:string}){guard();return isEffectDeclaration(declaration)},async planEffects<T extends {id:string;count:number;sides:number;modifier?:number;d20RollKind?:string}>(declarations:readonly T[]){guard();if(!retained||declarations.some(declaration=>!isEffectDeclaration(declaration)))return declarations;const observed=await observeBountifulPluginSpellSavingEffects({...retained,gateway:effectGateway});effectWorkers.add(observed);const facts=await readBountifulPluginSpellSavingEffectOperation(observed.operation,effectGateway);guard();if(facts.complete)return declarations.filter(declaration=>(facts.book.effects??[]).some(row=>row.rollId===declaration.id&&row.count===declaration.count&&row.sides===declaration.sides&&row.modifier===(declaration.modifier??0)));const missing=facts.request!.rolls;return declarations.filter(declaration=>missing.some(recipe=>recipe.rollId===declaration.id&&recipe.count===declaration.count&&recipe.sides===declaration.sides&&recipe.modifier===(declaration.modifier??0)))},async collectEffect(declaration:{id:string;count:number;sides:number;modifier?:number;visibility?:'dm'|'public'},label:string){guard();if(!retained||!input.rollEffect)throw Error('plugin-spell-saving-effect:actual-original-and-presenter-required');const current=await input.load(identity(source)),existing=current.effects?.find(row=>row.rollId===declaration.id),observed=await observeBountifulPluginSpellSavingEffects({...retained,gateway:effectGateway,...(existing?{prefixCount:existing.index}:{})});effectWorkers.add(observed);const raw=await createBountifulPluginSpellSavingEffectRaw(observed.operation,{...declaration,modifier:declaration.modifier??0},label,effectGateway);try{const spec=await readBountifulPluginSpellSavingEffectDiceRoute(raw.route),values=spec.values??await input.rollEffect(spec,raw.route,declaration.visibility??'public'),confirmed=await readBountifulPluginSpellSavingEffectDiceRoute(raw.route);if(!confirmed.rawValues||!confirmed.values||!same(values,confirmed.values))throw Error('plugin-spell-saving-effect:actual-physical-adoption-required');effectQualification?.close();effectQualification=await captureBountifulPluginSpellSavingEffectsQualification({...retained,gateway:effectGateway});return[...confirmed.values]}finally{raw.close()}},async collect(declaration:{id:string;count:number;sides:number;rollerTokenId?:string;d20RollMode?:string},label:string){
  guard();const id=identity(source),initial=createDnd5ePluginSpellSavingOriginalCollector(source);workers.add(initial);let stage=initial.run(),worker=initial,book=await optionalBook(id,input.load),postSavingEffect=false;const firstFrontier=initial.operation(stage)
  const replayCurrent=async()=>{if(!book)throw Error('plugin-spell-saving-collector:current-private-book-required');const anchor=createDnd5ePluginSpellSavingOriginalCollectorFromBook(firstFrontier,book,[],declaration.rollerTokenId);workers.add(anchor);const first=anchor.run();if(first.status==='pending-ally-natural-one'&&!first.request.nativeLucky&&first.occurrence===firstSavingOccurrence){const op=anchor.operation(first),facts=readDnd5ePluginSpellSavingOriginalOperation(op);if(facts.kind!=='pending')throw Error('plugin-spell-saving-collector:actual-first-anchor-required');retained={source:facts.source,qualification:captureDnd5ePluginSpellSavingOriginalQualification(op,book)}}const current=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),receipts=Object.values(current?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===id.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence);worker=createDnd5ePluginSpellSavingOriginalCollectorFromBook(firstFrontier,book,receipts,declaration.rollerTokenId);workers.add(worker);try{stage=compound?withActivityEffectOriginalMissing(()=>worker.run()):worker.run()}catch(error){if(!compound||!readActivityEffectOriginalMissing(error))throw error;postSavingEffect=true}};if(book)await replayCurrent()
  for(let turn=0;turn<8;turn++){
   guard()
   // A genuine advance to the next missing pool completes only this Page
   // declaration. The following declaration must request its own private raw.
   if(stage.status==='missing-activity-saving-original'&&stage.request.rollId!==declaration.id&&book){
    const slot=book.rows.find(row=>row.rollId===declaration.id)
    if(!slot?.raw||!slot.confirmed||slot.actorId!==declaration.rollerTokenId||slot.count!==declaration.count||slot.sides!==declaration.sides||slot.mode!==(declaration.d20RollMode??'normal'))throw Error('plugin-spell-saving-collector:exact-locked-original-required')
    return[...slot.confirmed.values]
   }
   if(stage.status==='missing-activity-saving-original'){
    const op=worker.operation(stage),facts=readDnd5ePluginSpellSavingOriginalOperation(op);if(facts.kind!=='missing')throw Error('plugin-spell-saving-collector:actual-missing-operation-required');const request=facts.request
    if(request.rollId!==declaration.id||request.actorId!==(declaration.rollerTokenId??source.prepared.actorToken.id)||request.count!==declaration.count||request.sides!==declaration.sides||request.mode!==(declaration.d20RollMode??'normal'))throw Error('plugin-spell-saving-collector:exact-page-declaration-required')
    const raw=await createBountifulPluginSpellSavingOriginalRaw(op,input.gateway,input.load,label)
    try{const spec=await readBountifulPluginSpellSavingOriginalDiceRoute(raw.route),values=spec.values??await input.roll(spec,raw.route),confirmed=await readBountifulPluginSpellSavingOriginalDiceRoute(raw.route);if(!confirmed.rawValues||!confirmed.values||!same(values,confirmed.values))throw Error('plugin-spell-saving-collector:actual-physical-adoption-required')}finally{raw.close()}
    book=await input.load(id);await replayCurrent();continue
   }
   if(!book)throw Error('plugin-spell-saving-collector:current-private-book-required')
   const slot=book.rows.find(row=>row.rollId===declaration.id);if(!slot?.raw||!slot.confirmed||slot.actorId!==declaration.rollerTokenId||slot.count!==declaration.count||slot.sides!==declaration.sides||slot.mode!==(declaration.d20RollMode??'normal'))throw Error('plugin-spell-saving-collector:exact-locked-original-required')
   if(postSavingEffect)return[...slot.confirmed.values]
   if(stage.status==='pending-ally-natural-one'){
    if(!retained){if(stage.request.nativeLucky||stage.occurrence!==firstSavingOccurrence)throw Error('plugin-spell-saving-collector:actual-first-anchor-required');const op=worker.operation(stage),facts=readDnd5ePluginSpellSavingOriginalOperation(op);if(facts.kind!=='pending')throw Error('plugin-spell-saving-collector:actual-saving-pause-required');retained={source:facts.source,qualification:captureDnd5ePluginSpellSavingOriginalQualification(op,book)}}
    const combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,unknown>}>('combat'),receiptId=JSON.stringify(['bountiful-original-parent',id.parentId,0]);if(!combat?.bountifulOriginalParents?.[receiptId])await persistBountifulOriginalParent({parentId:id.parentId,source:retained.source,resolve:resolvePreparedDnd5ePluginSpellCast,actorId:stage.request.actorId,kind:'saving-throw',pluginSpellSavingOriginalQualification:retained.qualification},input.gateway)
    await input.settlePending({parentId:id.parentId,...retained});guard();return[...slot.confirmed.values]
   }
   if(stage.status!=='original-d20-ready'&&!(stage.status==='resolved'&&stage.result.result.ok))throw Error('plugin-spell-saving-collector:actual-original-ready-required')
   return[...slot.confirmed.values]
  }throw Error('plugin-spell-saving-collector:bounded-frontier-exceeded')
 },close(){if(!ended){ended=true;for(const worker of workers)worker.cancel();workers.clear();for(const worker of effectWorkers)worker.close();effectWorkers.clear();effectQualification?.close();effectQualification=undefined;retained=undefined}}}
}
