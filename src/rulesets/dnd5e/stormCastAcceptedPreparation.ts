import{restoreStormCastOriginalPreparation,type StormCastPreparationIdentity,type StormCastOriginalPreparationLoader}from'./stormCastOriginalPreparation'
import{createDnd5eOriginalD20Session,captureDnd5eStormCastOriginalOperation,readDnd5eStormCastOriginalOperation,bindDnd5eStormCastOriginalReplayInput}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import type{StormCastEruptionChoice}from'./stormCastCheckpoint'
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** The hint selects a true next native original operation; it is not a dice,
 * controller or outcome grant. A wrong hint fails before any raw issuance. */
export async function restoreAcceptedStormCastPreparation(identity:StormCastPreparationIdentity,load:StormCastOriginalPreparationLoader,hint:{actorId:string;kind:'attack'|'saving-throw'|'ability-check'}){
 const recovered=await restoreStormCastOriginalPreparation(identity,load),book=recovered.book as typeof recovered.book&{ownerDecision?:unknown},answer=book.ownerDecision
 if(!data(answer)||!same(Object.keys(answer).sort(),['decision','interruptIds'])||!Array.isArray(answer.interruptIds)||!answer.interruptIds.length||answer.interruptIds.some(id=>typeof id!=='string'||!id)||new Set(answer.interruptIds).size!==answer.interruptIds.length||!data(answer.decision))throw Error('storm-cast-choice:protected-owner-answer-required')
 const decision=answer.decision;let choice:StormCastEruptionChoice|undefined
 if(decision.kind==='decline'&&same(Object.keys(decision),['kind']))choice=undefined
 else if(decision.kind==='use'&&same(Object.keys(decision).sort(),['choice','kind'])&&data(decision.choice))choice=decision.choice as unknown as StormCastEruptionChoice
 else throw Error('storm-cast-choice:protected-owner-answer-required')
 const session=createDnd5eOriginalD20Session(recovered.source,resolvePreparedDnd5eSpellCast,hint.actorId,hint.kind)
 try{
  const pending=session.run(recovered.source.prepared.state)
  if(pending.status!=='pending-storm-cast'||!same(pending.frame,book.frame)||JSON.stringify(pending.snapshot)!==book.prefixSignature||pending.effectTimestamp!==book.effectTimestamp)throw Error('storm-cast-choice:actual-native-prefix-required')
  const operation=captureDnd5eStormCastOriginalOperation(pending),next=session.resumeStormCast(recovered.source.prepared.state,pending.frame,choice)
  if(next.status!=='original-d20-ready'||next.request.actorId!==hint.actorId||next.request.kind!==hint.kind)throw Error('storm-cast-choice:actual-next-original-required')
  const native=readDnd5eStormCastOriginalOperation(operation)
  if(native.records.length!==1||!same(native.records[0].frame,book.frame)||native.records[0].prefixSignature!==book.prefixSignature||!same(native.records[0].choice,choice))throw Error('storm-cast-choice:actual-accepted-prefix-required')
  const source=bindDnd5eStormCastOriginalReplayInput(operation,recovered.source)
  return{source,operation,book,next}
 }finally{session.cancel()}
}
