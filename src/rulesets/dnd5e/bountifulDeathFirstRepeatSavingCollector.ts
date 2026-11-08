import type{BountifulDeathFirstRepeatSavingBook,BountifulDeathFirstRepeatSavingLoader}from'../../ports/dnd5eDeathFirstRepeatTransport'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{bountifulPreparedReplayFacts,bountifulOriginalDiePhase,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{createDnd5eDeathRepeatSavingOriginalSession,readDnd5eDeathRepeatSavingOriginal}from'./deathRepeatSavingOriginal'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
type Source=Parameters<typeof createDnd5eDeathRepeatSavingOriginalSession>[0]
type Identity={parentId:string;mapId:string;combatId:string}
export type{BountifulDeathFirstRepeatSavingBook,BountifulDeathFirstRepeatSavingLoader}from'../../ports/dnd5eDeathFirstRepeatTransport'

declare const deathRepeatContinuation:unique symbol
export type BountifulDeathFirstRepeatContinuation={readonly[deathRepeatContinuation]:true}
const continuations=new WeakMap<object,{source:Source;runtime:Source;book:BountifulDeathFirstRepeatSavingBook;signature:string;completed:Extract<ReturnType<RepeatWorker['run']>,{status:'resolved'}>['result'];completedSignature:string;load:BountifulDeathFirstRepeatSavingLoader;identity:Identity}>()
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
const immutableBook=(book:BountifulDeathFirstRepeatSavingBook)=>{const{raw,announced,confirmed,complete,originalRows,...base}=book;return base}

declare const deathRepeatPendingOriginal:unique symbol
export type BountifulDeathFirstRepeatPendingOriginal={readonly[deathRepeatPendingOriginal]:true}
type RepeatWorker=ReturnType<typeof createDnd5eDeathRepeatSavingOriginalSession>
type RepeatPending=Extract<ReturnType<RepeatWorker['run']>,{status:'pending-ally-natural-one'}>
const pendingOriginals=new WeakMap<object,{worker:RepeatWorker;pending:RepeatPending;source:Source;book:BountifulDeathFirstRepeatSavingBook}>()
/** Read the current actual Native end-save boundary only. A copied stage, finished worker or unrelated original pool cannot create this qualification. */
export function readBountifulDeathFirstRepeatPendingOriginal(token:object,source:unknown){const row=pendingOriginals.get(token);if(!row)throw Error('death-first-repeat-pending:actual-private-qualification-required');const frame=row.worker.repeatPool(row.pending);if(signature(source)!==signature(row.source)||frame.actorId!==row.book.actorId||frame.effect.id!==row.book.effectId||frame.count!==row.book.count||frame.mode!==row.book.mode)throw Error('death-first-repeat-pending:changed-original-operation');return{source:cloneDnd5eHostTransactionInput(row.source),book:cloneDnd5eHostTransactionInput(row.book),pending:row.pending,frame}}
export function disposeBountifulDeathFirstRepeatPendingOriginal(token:object){const row=pendingOriginals.get(token);if(!row)return;pendingOriginals.delete(token);row.worker.dispose()}

/** Mechanical recovery only. load is the actual Host-only private source boundary; this module neither signs Node input nor authorizes final world publication. */
export async function recoverBountifulDeathFirstRepeatSavingOriginal(input:{identity:Identity;load:BountifulDeathFirstRepeatSavingLoader}){
 for(let attempt=0;attempt<3;attempt++){
 const book=await input.load(input.identity),source=decodeSecondChanceParentWire(book.originalSource)as Source,rows=book.originalRows
 if(!book.ok||!book.present||book.sourceKind!=='death-first-repeat-saving-v1'||book.preparation.sourceKind!=='death-first-ready-v1'||signature(book.preparation.source)!==signature(book.originalSource)||book.preparation.effectTimestamp!==book.effectTimestamp||signature(book.preparation.firstAdopted.values)!==signature([source.command.d20])||book.preparation.firstAdopted.memberId!==book.hostMemberId||source.command.d20<=1||source.command.d20>=20||source.command.d20Second!==undefined||!Array.isArray(rows)||rows.some((row,i)=>row.identity.occurrence!==i||row.consumed||row.originalAdapterId!=='death-save'||row.identity.parentId!==input.identity.parentId||row.identity.effectTimestamp!==book.effectTimestamp||signature(row.originalParent)!==signature(book.originalSource))||book.parentId!==input.identity.parentId||book.mapId!==input.identity.mapId||book.combatId!==input.identity.combatId||source.prepared.action.id!==book.parentId||source.prepared.map.id!==book.mapId||source.prepared.state.combatId!==book.combatId||book.timing!=='target-turn-end'||book.sides!==20)throw Error('death-first-repeat-collector:exact-private-source-required')
 const readyRows:BountifulOriginalDieReceipt[]=[];for(const row of rows){const phase=bountifulOriginalDiePhase(row);if(phase!=='ready'&&phase!=='declined')break;readyRows.push(row)}
 const fixed=signature(book),metadata=readyRows.length?bountifulPreparedReplayFacts({parentId:book.parentId,source,receipts:readyRows}):{parentId:book.parentId,sourceKey:originalD20ReplaySourceKey(book.parentId,source.prepared.state,source.prepared.action,book.effectTimestamp),effectTimestamp:book.effectTimestamp,facts:[]},worker=createDnd5eDeathRepeatSavingOriginalSession({...source,hostOriginalD20Replay:metadata})
 let keepPending=false
 try{const missing=worker.run();if(missing.status!=='missing-death-repeat-saving-original')throw Error('death-first-repeat-collector:actual-native-phase-required');const actual=readDnd5eDeathRepeatSavingOriginal(missing.operation),frame=actual.frame
 if(actual.effectTimestamp!==book.effectTimestamp||frame.actorId!==book.actorId||frame.effect.id!==book.effectId||frame.effect.repeatSave?.ability!==book.ability||frame.effect.repeatSave.dc!==book.dc||frame.mode!==book.mode||frame.count!==book.count||frame.sides!==book.sides||frame.timing!==book.timing)throw Error('death-first-repeat-collector:changed-native-frame')
 const latest=await input.load(input.identity);if(signature(latest)!==fixed){if(signature(immutableBook(latest))!==signature(immutableBook(book)))throw Error('death-first-repeat-collector:changed-live-book');continue}
 if(!book.raw||!book.confirmed||book.complete!==true)return{status:'missing-death-first-repeat-saving-original' as const,requestId:book.requestId,frame:cloneDnd5eHostTransactionInput(frame)}
 if(book.raw.memberId!==book.memberId||book.confirmed.memberId!==book.hostMemberId||book.raw.values.length!==book.count||book.confirmed.values.length!==book.count||[...book.raw.values,...book.confirmed.values].some(v=>!Number.isInteger(v)||v<1||v>20))throw Error('death-first-repeat-collector:complete-adopted-pool-required')
 const values={d20:book.confirmed.values[0],...(book.count===2?{d20Second:book.confirmed.values[1]}:{})},stage=worker.supply(missing.operation,values);if(stage.status==='pending-ally-natural-one'){const frame=worker.repeatPool(stage);if(stage.occurrence!==readyRows.length||frame.effect.id!==book.effectId||frame.actorId!==book.actorId)throw Error('death-first-repeat-collector:changed-late-native-pending');const qualification=Object.freeze({})as BountifulDeathFirstRepeatPendingOriginal;pendingOriginals.set(qualification,{worker,pending:stage,source:cloneDnd5eHostTransactionInput(source),book:cloneDnd5eHostTransactionInput(book)});keepPending=true;return{status:'pending-death-first-repeat-original' as const,qualification}}
 if(stage.status!=='resolved'||!stage.result.result.ok||!stage.result.application||readyRows.length!==rows.length)throw Error('death-first-repeat-collector:additional-native-stage-required')
 const token=Object.freeze({})as BountifulDeathFirstRepeatContinuation,runtime={...source,command:{...source.command,activeEffectSavingThrows:[{effectId:book.effectId,targetId:book.actorId,...values}]}};continuations.set(token,{source:cloneDnd5eHostTransactionInput(source),runtime:cloneDnd5eHostTransactionInput(runtime),book:cloneDnd5eHostTransactionInput(book),signature:fixed,completed:stage.result,completedSignature:signature(stage.result),load:input.load,identity:cloneDnd5eHostTransactionInput(input.identity)});return{status:'native-death-first-repeat-collected' as const,continuation:token}
 }finally{if(!keepPending)worker.dispose()}
 }
 return{status:'death-first-repeat-input-progress' as const,parentId:input.identity.parentId}
}

/** Only an actual same-source Native completion with a current complete authenticated private pool can supply the extra input to the fixed original resolver. */
export async function readBountifulDeathFirstRepeatContinuation(token:object,input:{source:unknown;receipts:readonly BountifulOriginalDieReceipt[];action:unknown}){
 const row=continuations.get(token);if(!row)throw Error('death-first-repeat-continuation:actual-private-completion-required')
 if(signature(input.source)!==signature(row.source)||signature(input.action)!==signature(row.source.prepared.action)||signature(input.receipts)!==signature(row.book.originalRows))throw Error('death-first-repeat-continuation:changed-original-source')
 const latest=await row.load(row.identity);if(signature(latest)!==row.signature)throw Error('death-first-repeat-continuation:changed-current-book')
 return cloneDnd5eHostTransactionInput(row.runtime)
}

/** A non-natural-one end save needs no B original. Return only its genuinely
 * collected input to the unchanged ordinary Death finisher; never a result or
 * a publication grant. A retained1 cannot silently take this no-B lane. */
export async function readBountifulDeathFirstRepeatUnclaimedInputs(token:BountifulDeathFirstRepeatContinuation,input:{source:unknown;action:unknown}){const row=continuations.get(token);if(!row||row.book.originalRows.length!==0||!row.book.confirmed||row.book.confirmed.values.some(value=>value===1))throw Error('death-first-repeat-continuation:actual-no-B-end-required');const runtime=await readBountifulDeathFirstRepeatContinuation(token,{...input,receipts:[]});return cloneDnd5eHostTransactionInput(runtime.command.activeEffectSavingThrows??[])}

/** Only the actual completed whole Native result, for the ordinary no-B tail.
 * This signs no Room result, receipt, local publication or world permission. */
export async function readBountifulDeathFirstRepeatUnclaimedNative(token:BountifulDeathFirstRepeatContinuation,input:{source:unknown;action:unknown}){await readBountifulDeathFirstRepeatUnclaimedInputs(token,input);const row=continuations.get(token)!;if(signature(row.completed)!==row.completedSignature)throw Error('death-first-repeat-continuation:changed-completed-native');return row.completed}
