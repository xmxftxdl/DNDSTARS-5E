import type{restoreTempestuousBeforeAcceptedPreparation}from'./tempestuousBeforeAcceptedPreparation'
import{withTempestuousBeforePreparedOriginalReplay,withTempestuousBeforePlainOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import type{TempestuousBeforeOriginalPreparationLoader}from'./tempestuousBeforeOriginalPreparation'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{restoreStormCastOriginalPreparation}from'./stormCastOriginalPreparation'
import type{StormCastPreparationIdentity,StormCastOriginalPreparationLoader}from'./stormCastOriginalPreparation'
import{withDnd5eStormCastOriginalReplayScope,createDnd5eOriginalD20Session,captureDnd5eStormCastOriginalOperation,readDnd5eStormCastOriginalOperation,type Dnd5eStormCastOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import type{StormCastEruptionChoice}from'./stormCastCheckpoint'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Hint={actorId:string;kind:'attack'|'saving-throw'|'ability-check'}
type Recovery=Awaited<ReturnType<typeof restoreStormCastOriginalPreparation>>
const issued=new WeakMap<object,{roomId:string;memberId:string;book:Recovery['book'];choice?:StormCastEruptionChoice;operation:Dnd5eStormCastOriginalOperation;prepared:string;earlier:Record<string,unknown>;effectRolls:readonly number[];tempestuousBeforeReplay?:object}>()
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])])):value
const same=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
/** This opaque token carries only a checked native prefix/owner decision. It is
 * passed separately from the source and is never a raw or serialized permission. */
export async function issueStormCastPreparedOriginalReplay(identity:StormCastPreparationIdentity,load:StormCastOriginalPreparationLoader,loadTempestuousBefore?:TempestuousBeforeOriginalPreparationLoader,landing?:Parameters<typeof restoreTempestuousBeforeAcceptedPreparation>[2]){
 const host=getRoomSession();if(host?.role!=='dm')throw Error('storm-cast-probe:actual-host-required')
 const recovered=await restoreStormCastOriginalPreparation(identity,load,loadTempestuousBefore,landing),native=readDnd5eStormCastOriginalOperation(recovered.operation),source=native.source as Source&{hostOriginalD20Replay?:unknown},answer=(recovered.book as typeof recovered.book&{ownerDecision?:{decision?:{kind?:unknown;choice?:StormCastEruptionChoice};interruptIds?:unknown}}).ownerDecision
 const current=getRoomSession();if(current?.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('storm-cast-probe:changed-host')
 if(!answer||Object.keys(answer).some(key=>!['decision','interruptIds'].includes(key))||!Array.isArray(answer.interruptIds)||!answer.interruptIds.length||answer.interruptIds.some(id=>typeof id!=='string'||!id)||new Set(answer.interruptIds).size!==answer.interruptIds.length||!answer.decision)throw Error('storm-cast-probe:protected-owner-answer-required')
 const decision=answer.decision;let choice:StormCastEruptionChoice|undefined
 if(decision.kind==='decline'&&Object.keys(decision).length===1)choice=undefined
 else if(decision.kind==='use'&&Object.keys(decision).length===2){const selected=decision.choice;if(!selected||Object.keys(selected).some(key=>!['frameId','featureId','damageType','targetIds'].includes(key))||selected.frameId!==native.frame.id||!native.frame.options.some(option=>option.featureId===selected.featureId)||!['lightning','thunder'].includes(selected.damageType)||!Array.isArray(selected.targetIds)||new Set(selected.targetIds).size!==selected.targetIds.length||selected.targetIds.some(id=>!native.frame.targetIds.includes(id)))throw Error('storm-cast-probe:protected-owner-answer-required');choice=structuredClone(selected)}
 else throw Error('storm-cast-probe:protected-owner-answer-required')
 const earlier=Object.fromEntries(Object.entries(source).filter(([key])=>!['prepared','effectRolls','hostOriginalD20Replay'].includes(key))),token=Object.freeze({})
 issued.set(token,{roomId:host.roomId,memberId:host.memberId,book:structuredClone(recovered.book),choice,operation:recovered.operation,prepared:signature(source.prepared),earlier,effectRolls:[...source.effectRolls],tempestuousBeforeReplay:recovered.tempestuousBeforeReplay});return token
}
function proofFor(source:{prepared:unknown;effectRolls?:unknown},token:object){
 const row=issued.get(token),host=getRoomSession();if(!row||host?.role!=='dm'||host.roomId!==row.roomId||host.memberId!==row.memberId||signature(source.prepared)!==row.prepared)throw Error('storm-cast-probe:actual-same-prepared-source-required')
 readDnd5eStormCastOriginalOperation(row.operation)
 for(const[key,value]of Object.entries(row.earlier))if(!same((source as unknown as Record<string,unknown>)[key],value))throw Error('storm-cast-probe:changed-earlier-casting-context')
 if(row.effectRolls.length&&!same(row.effectRolls,source.effectRolls))throw Error('storm-cast-probe:changed-original-effect-pool')
 return row
}
/** Durable/captured source stays plain. Only the concrete native Session gets
 * the actual parent clock and replays the verified pause/owner choice. Existing
 * hostOriginalD20Replay is preserved and validated by the original native factory. */
export function stormCastPreparedOriginalInput<T extends{prepared:unknown}>(source:T,token:object):T{
 const row=proofFor(source,token),book=row.book,copy=cloneDnd5eHostTransactionInput(source),existing=(copy as T&{hostOriginalD20Replay?:{effectTimestamp?:number}}).hostOriginalD20Replay
 if(existing!==undefined&&existing?.effectTimestamp!==book.effectTimestamp)throw Error('storm-cast-probe:original-clock-required')
 const native=readDnd5eStormCastOriginalOperation(row.operation).source as Source
 const input=existing!==undefined?copy:{...copy,hostOriginalD20Replay:{parentId:book.parentId,sourceKey:originalD20ReplaySourceKey(book.parentId,native.prepared.state,native.prepared.action,book.effectTimestamp),effectTimestamp:book.effectTimestamp,facts:[]}}
 // The exact prepared graph above came from a real native Spell pause. Existing
 // replay data is still checked by the ordinary factory, never rewritten.
 const check=createDnd5eOriginalD20Session(input as unknown as Source,resolvePreparedDnd5eSpellCast,book.frame.actorId,'saving-throw');check.cancel();return input
}
export function stormCastPreparedOriginalClock(source:{prepared:unknown;effectRolls?:unknown},token:object){return proofFor(source,token).book.effectTimestamp}
export function stormCastPreparedOriginalChoice(operation:Dnd5eStormCastOriginalOperation,token:object){
 const native=readDnd5eStormCastOriginalOperation(operation),row=proofFor(native.source as Source,token),book=row.book
 if(!same(native.frame,book.frame)||JSON.stringify(native.snapshot)!==book.prefixSignature||native.effectTimestamp!==book.effectTimestamp||native.records.length)throw Error('storm-cast-probe:exact-native-prefix-required')
 return row.choice&&structuredClone(row.choice)
}
export function createStormCastPreparedOriginalProbe(source:Source,token:object,hint:Hint){
 const input=stormCastPreparedOriginalInput(source,token),session=createDnd5eOriginalD20Session(input,resolvePreparedDnd5eSpellCast,hint.actorId,hint.kind)
 try{const before=proofFor(input,token).tempestuousBeforeReplay,invoke=<T>(run:()=>T)=>before?withTempestuousBeforePreparedOriginalReplay(input,before,run):run();const pending=invoke(()=>session.run(input.prepared.state));if(pending.status!=='pending-storm-cast')throw Error('storm-cast-probe:actual-pending-prefix-required');const operation=captureDnd5eStormCastOriginalOperation(pending),stage=invoke(()=>session.resumeStormCast(input.prepared.state,pending.frame,stormCastPreparedOriginalChoice(operation,token)));if(stage.status==='rejected')throw Error('storm-cast-probe:actual-prefix-rejected:'+stage.reason);return{session,stage}}catch(error){session.cancel();throw error}
}

/** Only a synchronous, actually consumed native prefix is scoped. No source
 * decoration or replay-facts rewrite escapes this call. */
export function withStormCastPreparedOriginalReplay<T>(source:{prepared:unknown;effectRolls?:unknown;hostOriginalD20Replay?:unknown},token:object,run:()=>T):T{
 const row=proofFor(source,token),clock=(source as{hostOriginalD20Replay?:{effectTimestamp?:number}}).hostOriginalD20Replay?.effectTimestamp
 if(clock!==undefined&&clock!==row.book.effectTimestamp)throw Error('storm-cast-probe:original-clock-required')
 const invoke=()=>withDnd5eStormCastOriginalReplayScope(row.operation,row.choice,run);return row.tempestuousBeforeReplay?withTempestuousBeforePlainOriginalReplay(source as Source,row.tempestuousBeforeReplay,invoke):invoke()
}
