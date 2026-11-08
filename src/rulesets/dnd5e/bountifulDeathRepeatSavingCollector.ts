import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{bountifulPreparedReplayFacts,bountifulOriginalDiePhase,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{createDnd5eDeathRepeatSavingOriginalSession,readDnd5eDeathRepeatSavingOriginal}from'./deathRepeatSavingOriginal'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
type Source=Parameters<typeof createDnd5eDeathRepeatSavingOriginalSession>[0]
type Identity={parentId:string;mapId:string;combatId:string}
export type BountifulDeathRepeatSavingBook={ok:true;present:true;parentId:string;mapId:string;combatId:string;roomId:string;hostMemberId:string;actorId:string;characterId:string;memberId:string;requestId:string;effectTimestamp:number;effectId:string;ability:string;dc:number;mode:'normal'|'advantage'|'disadvantage';count:1|2;sides:20;timing:'target-turn-end';stageSignature:string;originalSource:Parameters<typeof decodeSecondChanceParentWire>[0];originalRows:BountifulOriginalDieReceipt[];lateOriginalRows?:BountifulOriginalDieReceipt[];raw?:{memberId:string;values:number[]};confirmed?:{memberId:string;values:number[]};complete?:boolean}
export type BountifulDeathRepeatSavingLoader=(identity:Identity)=>Promise<BountifulDeathRepeatSavingBook>
declare const deathRepeatContinuation:unique symbol
export type BountifulDeathRepeatContinuation={readonly[deathRepeatContinuation]:true}
const continuations=new WeakMap<object,{source:Source;runtime:Source;book:BountifulDeathRepeatSavingBook;signature:string;load:BountifulDeathRepeatSavingLoader;identity:Identity}>()
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))

declare const deathRepeatPendingOriginal:unique symbol
export type BountifulDeathRepeatPendingOriginal={readonly[deathRepeatPendingOriginal]:true}
type RepeatWorker=ReturnType<typeof createDnd5eDeathRepeatSavingOriginalSession>
type RepeatPending=Extract<ReturnType<RepeatWorker['run']>,{status:'pending-ally-natural-one'}>
const pendingOriginals=new WeakMap<object,{worker:RepeatWorker;pending:RepeatPending;source:Source;book:BountifulDeathRepeatSavingBook}>()
/** Read the current actual Native end-save boundary only. A copied stage, finished worker or unrelated original pool cannot create this qualification. */
export function readBountifulDeathRepeatPendingOriginal(token:object,source:unknown){const row=pendingOriginals.get(token);if(!row)throw Error('death-repeat-pending:actual-private-qualification-required');const frame=row.worker.repeatPool(row.pending);if(signature(source)!==signature(row.source)||frame.actorId!==row.book.actorId||frame.effect.id!==row.book.effectId||frame.count!==row.book.count||frame.mode!==row.book.mode)throw Error('death-repeat-pending:changed-original-operation');return{source:cloneDnd5eHostTransactionInput(row.source),book:cloneDnd5eHostTransactionInput(row.book),pending:row.pending,frame}}
export function disposeBountifulDeathRepeatPendingOriginal(token:object){const row=pendingOriginals.get(token);if(!row)return;pendingOriginals.delete(token);row.worker.dispose()}

/** Mechanical recovery only. load is the actual Host-only private source boundary; this module neither signs Node input nor authorizes final world publication. */
export async function recoverBountifulDeathRepeatSavingOriginal(input:{identity:Identity;load:BountifulDeathRepeatSavingLoader}){
 const book=await input.load(input.identity),source=decodeSecondChanceParentWire(book.originalSource)as Source,rows=[...book.originalRows,...(book.lateOriginalRows??[])]
 if(!book.ok||!book.present||!rows?.length||rows.some((row,i)=>row.identity.occurrence!==i||row.consumed||row.originalAdapterId!=='death-save'||row.identity.parentId!==input.identity.parentId||row.identity.effectTimestamp!==book.effectTimestamp||signature(row.originalParent)!==signature(book.originalSource))||book.parentId!==input.identity.parentId||book.mapId!==input.identity.mapId||book.combatId!==input.identity.combatId||source.prepared.action.id!==book.parentId||source.prepared.map.id!==book.mapId||source.prepared.state.combatId!==book.combatId||book.timing!=='target-turn-end'||book.sides!==20)throw Error('death-repeat-collector:exact-private-source-required')
 const readyRows:BountifulOriginalDieReceipt[]=[];for(const row of rows){const phase=bountifulOriginalDiePhase(row);if(phase!=='ready'&&phase!=='declined')break;readyRows.push(row)}
 const fixed=signature(book),metadata=bountifulPreparedReplayFacts({parentId:book.parentId,source,receipts:readyRows}),worker=createDnd5eDeathRepeatSavingOriginalSession({...source,hostOriginalD20Replay:metadata})
 let keepPending=false
 try{const missing=worker.run();if(missing.status!=='missing-death-repeat-saving-original')throw Error('death-repeat-collector:actual-native-phase-required');const actual=readDnd5eDeathRepeatSavingOriginal(missing.operation),frame=actual.frame
 if(actual.effectTimestamp!==book.effectTimestamp||frame.actorId!==book.actorId||frame.effect.id!==book.effectId||frame.effect.repeatSave?.ability!==book.ability||frame.effect.repeatSave.dc!==book.dc||frame.mode!==book.mode||frame.count!==book.count||frame.sides!==book.sides||frame.timing!==book.timing)throw Error('death-repeat-collector:changed-native-frame')
 const latest=await input.load(input.identity);if(signature(latest)!==fixed)throw Error('death-repeat-collector:changed-live-book')
 if(!book.raw||!book.confirmed||book.complete!==true)return{status:'missing-death-repeat-saving-original' as const,requestId:book.requestId,frame:cloneDnd5eHostTransactionInput(frame)}
 if(book.raw.memberId!==book.memberId||book.confirmed.memberId!==book.hostMemberId||book.raw.values.length!==book.count||book.confirmed.values.length!==book.count||[...book.raw.values,...book.confirmed.values].some(v=>!Number.isInteger(v)||v<1||v>20))throw Error('death-repeat-collector:complete-adopted-pool-required')
 const values={d20:book.confirmed.values[0],...(book.count===2?{d20Second:book.confirmed.values[1]}:{})},stage=worker.supply(missing.operation,values);if(stage.status==='pending-ally-natural-one'){const frame=worker.repeatPool(stage);if(stage.occurrence!==readyRows.length||frame.effect.id!==book.effectId||frame.actorId!==book.actorId)throw Error('death-repeat-collector:changed-late-native-pending');const qualification=Object.freeze({})as BountifulDeathRepeatPendingOriginal;pendingOriginals.set(qualification,{worker,pending:stage,source:cloneDnd5eHostTransactionInput(source),book:cloneDnd5eHostTransactionInput(book)});keepPending=true;return{status:'pending-death-repeat-original' as const,qualification}}
 if(stage.status!=='resolved'||!stage.result.result.ok||!stage.result.application||readyRows.length!==rows.length)throw Error('death-repeat-collector:additional-native-stage-required')
 const token=Object.freeze({})as BountifulDeathRepeatContinuation,runtime={...source,command:{...source.command,activeEffectSavingThrows:[{effectId:book.effectId,targetId:book.actorId,...values}]}};continuations.set(token,{source:cloneDnd5eHostTransactionInput(source),runtime:cloneDnd5eHostTransactionInput(runtime),book:cloneDnd5eHostTransactionInput(book),signature:fixed,load:input.load,identity:cloneDnd5eHostTransactionInput(input.identity)});return{status:'native-death-repeat-collected' as const,continuation:token}
 }finally{if(!keepPending)worker.dispose()}
}

/** Only an actual same-source Native completion with a current complete authenticated private pool can supply the extra input to the fixed original resolver. */
export async function readBountifulDeathRepeatContinuation(token:object,input:{source:unknown;receipts:readonly BountifulOriginalDieReceipt[];action:unknown}){
 const row=continuations.get(token);if(!row)throw Error('death-repeat-continuation:actual-private-completion-required')
 if(signature(input.source)!==signature(row.source)||signature(input.action)!==signature(row.source.prepared.action)||signature(input.receipts)!==signature([...row.book.originalRows,...(row.book.lateOriginalRows??[])]))throw Error('death-repeat-continuation:changed-original-source')
 const latest=await row.load(row.identity);if(signature(latest)!==row.signature)throw Error('death-repeat-continuation:changed-current-book')
 return cloneDnd5eHostTransactionInput(row.runtime)
}
