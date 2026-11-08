import{observeDnd5ePluginSpellCompoundAnsweredCompletion,readDnd5ePluginSpellCompoundAnsweredCompletion,type Dnd5ePluginSpellCompoundAnsweredCompletion}from'../../rulesets/dnd5e/pluginSpellCompoundAnsweredCompletion'
import{readDnd5ePluginSpellCompoundAnsweredQualification}from'../../rulesets/dnd5e/pluginSpellCompoundQualification'
import{createBountifulPluginSpellCompoundAnsweredEffectRaw,createBountifulPluginSpellCompoundNoBEffectRaw,readBountifulPluginSpellSavingEffectDiceRoute}from'./bountifulPluginSpellSavingEffectRaw'
import{observeDnd5ePluginSpellCompoundNoB,readDnd5ePluginSpellCompoundNoBOperation,type Dnd5ePluginSpellCompoundNoBOperation}from'../../rulesets/dnd5e/pluginSpellCompoundNoBOperation'
import{createDnd5ePluginSpellSavingOriginalCollector,createDnd5ePluginSpellSavingOriginalCollectorFromBook}from'../../rulesets/dnd5e/pluginSpellSavingOriginalOperation'
import{withActivityEffectOriginalMissing,readActivityEffectOriginalMissing}from'../../rulesets/dnd5e/activities/activityEffectOriginalMissing'
import{observeBountifulPluginSpellSavingEffects,readBountifulPluginSpellSavingEffectOperation}from'../../rulesets/dnd5e/bountifulPluginSpellSavingEffectOperation'
import type{BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt'
import{dnd5ePluginSpellCompoundForSource}from'../../rulesets/dnd5e/pluginSpellCompoundQualification'
import{createBountifulPluginSpellSavingRoomCollector}from'./bountifulPluginSpellSavingOriginalCollector'
type Input=Parameters<typeof createBountifulPluginSpellSavingRoomCollector>[0]
/** Requests are obtained from the actual Native frontier. Authored target lists,
 * caller dice arrays and primary raw routes cannot manufacture a saving slot. */
export function createBountifulPluginSpellCompoundBurstRoom(input:Input){
 if(!dnd5ePluginSpellCompoundForSource(input.source))throw Error('ice-knife-burst:actual-qualified-primary-required')
 const collector=createBountifulPluginSpellSavingRoomCollector(input),workers=new Set<ReturnType<typeof createDnd5ePluginSpellSavingOriginalCollector>>(),identity={parentId:input.source.prepared.action.id,mapId:input.source.prepared.map.id,combatId:input.source.prepared.state.combatId};let completionWorker:ReturnType<typeof observeDnd5ePluginSpellCompoundAnsweredCompletion>|undefined,completionOperation:Dnd5ePluginSpellCompoundAnsweredCompletion|undefined;let closed=false,noBWorker:ReturnType<typeof observeDnd5ePluginSpellCompoundNoB>|undefined,noBOperation:Dnd5ePluginSpellCompoundNoBOperation|undefined
 const guard=()=>{if(closed)throw Error('ice-knife-burst:current-live-page-required')}
 async function collectOriginals(label:string,allowNoB:boolean){guard();for(let turn=0;turn<12;turn++){
  const initial=createDnd5ePluginSpellSavingOriginalCollector(input.source);workers.add(initial);let stage=initial.run(),worker=initial
  let book:Awaited<ReturnType<Input['load']>>|undefined;try{book=await input.load(identity)}catch(error){if(!(error instanceof Error)||error.message!=='plugin-spell-saving-original:current-private-book-required')throw error}
  if(book){const combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),receipts=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===identity.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence);worker=createDnd5ePluginSpellSavingOriginalCollectorFromBook(initial.operation(stage),book,receipts);workers.add(worker);try{stage=withActivityEffectOriginalMissing(()=>worker.run())}catch(error){if(!readActivityEffectOriginalMissing(error))throw error;break}}
  guard();if(stage.status==='missing-activity-saving-original'){const r=stage.request;await collector.collect({id:r.rollId,count:r.count,sides:r.sides,rollerTokenId:r.actorId,d20RollMode:r.mode},label);continue}
  if(stage.status==='pending-ally-natural-one'){const rows=book?.rows.filter(row=>row.actorId===stage.request.actorId&&JSON.stringify(row.confirmed?.values)===JSON.stringify(stage.request.originalRolls)),row=rows?.length===1?rows[0]:undefined;if(!row)throw Error('ice-knife-burst:exact-pending-private-slot-required');await collector.collect({id:row.rollId,count:row.count,sides:row.sides,rollerTokenId:row.actorId,d20RollMode:row.mode},label);continue}
  if(stage.status==='resolved'&&stage.result.result.ok)break
  throw Error('ice-knife-burst:actual-missing-saving-or-complete-required')
 }
 const retained=collector.original();if(!retained){
  if(!allowNoB)throw Error('ice-knife-burst:actual-b-saving-qualification-required')
  const compound=dnd5ePluginSpellCompoundForSource(input.source)!
  if(readDnd5ePluginSpellCompoundAnsweredQualification(compound)){
   for(let phase=0;phase<4;phase++){
    const book=await input.load(identity);guard();completionWorker?.close();completionWorker=observeDnd5ePluginSpellCompoundAnsweredCompletion({source:input.source as Parameters<typeof observeDnd5ePluginSpellCompoundAnsweredCompletion>[0]['source'],book})
    const facts=readDnd5ePluginSpellCompoundAnsweredCompletion(completionWorker.operation)
    if(facts.result?.result.ok&&!facts.request){completionOperation=completionWorker.operation;return undefined}
    if(!facts.request||!input.rollEffect)throw Error('ice-knife-burst:actual-answered-effect-presenter-required')
    for(const recipe of facts.request.rolls){const raw=await createBountifulPluginSpellCompoundAnsweredEffectRaw(completionWorker.operation,{id:recipe.rollId,count:recipe.count,sides:recipe.sides,modifier:recipe.modifier},label,{...input.gateway,loadBountifulPluginSpellSavingOriginalSource:input.load});try{const spec=await readBountifulPluginSpellSavingEffectDiceRoute(raw.route),values=spec.values??await input.rollEffect(spec,raw.route,'public'),adopted=await readBountifulPluginSpellSavingEffectDiceRoute(raw.route);guard();if(!adopted.rawValues||!adopted.values||JSON.stringify(values)!==JSON.stringify(adopted.values))throw Error('ice-knife-burst:actual-answered-effect-physical-adoption-required')}finally{raw.close()}}
   }
   throw Error('ice-knife-burst:bounded-answered-effect-frontier-required')
  }
  for(let phase=0;phase<4;phase++){
   const book=await input.load(identity);guard();noBWorker?.close();noBWorker=observeDnd5ePluginSpellCompoundNoB({source:input.source as Parameters<typeof observeDnd5ePluginSpellCompoundNoB>[0]['source'],book});const facts=readDnd5ePluginSpellCompoundNoBOperation(noBWorker.operation)
   if(facts.result?.result.ok&&!facts.request){noBOperation=noBWorker.operation;return undefined}
   if(!facts.request||!input.rollEffect)throw Error('ice-knife-burst:actual-no-b-effect-presenter-required')
   for(const recipe of facts.request.rolls){const raw=await createBountifulPluginSpellCompoundNoBEffectRaw(noBWorker.operation,{id:recipe.rollId,count:recipe.count,sides:recipe.sides,modifier:recipe.modifier},label,{...input.gateway,loadBountifulPluginSpellSavingOriginalSource:input.load});try{const spec=await readBountifulPluginSpellSavingEffectDiceRoute(raw.route),values=spec.values??await input.rollEffect(spec,raw.route,'public'),adopted=await readBountifulPluginSpellSavingEffectDiceRoute(raw.route);guard();if(!adopted.rawValues||!adopted.values||JSON.stringify(values)!==JSON.stringify(adopted.values))throw Error('ice-knife-burst:actual-no-b-physical-adoption-required')}finally{raw.close()}}
  }
  throw Error('ice-knife-burst:bounded-no-b-effect-required')
 }
 const gateway={...input.gateway,loadBountifulPluginSpellSavingOriginalSource:input.load}
 for(let turn=0;turn<4;turn++){guard();const observed=await observeBountifulPluginSpellSavingEffects({...retained,gateway});try{const facts=await readBountifulPluginSpellSavingEffectOperation(observed.operation,gateway);if(facts.complete)return collector.original()!;for(const roll of facts.request!.rolls)await collector.collectEffect({id:roll.rollId,count:roll.count,sides:roll.sides,modifier:roll.modifier,visibility:'public'},label)}finally{observed.close()}}
 throw Error('ice-knife-burst:bounded-effect-frontier-required')
 }
 return{collector,async collect(label:string){const result=await collectOriginals(label,false);if(!result)throw Error('ice-knife-burst:actual-b-saving-qualification-required');return result},async collectIncludingNoB(label:string){await collectOriginals(label,true)},answeredOriginal(){guard();if(completionOperation)readDnd5ePluginSpellCompoundAnsweredCompletion(completionOperation);return completionOperation},noBOriginal(){guard();if(noBOperation)readDnd5ePluginSpellCompoundNoBOperation(noBOperation);return noBOperation},close(){if(!closed){closed=true;collector.close();noBWorker?.close();completionWorker?.close();for(const worker of workers)worker.cancel();workers.clear()}}}
}
