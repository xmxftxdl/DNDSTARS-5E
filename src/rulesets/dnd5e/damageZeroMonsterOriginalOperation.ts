import{readDnd5eMonsterDamageZeroOriginalContext}from'./monsterDamageZeroOriginalContext'
import{getRoomSession}from'../../lib/roomSession'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readOptionalDnd5eActualDamageZeroOriginalBoundary,readDnd5eActualDamageZeroOriginalBoundary,type Dnd5eDamageZeroOriginalRecord}from'./damageCommitSession'
import{dnd5eBountifulOriginalReadyOwners,type Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import type{DamageZeroSavingThrowFrame}from'./damageZeroSavingThrowCheckpoint'
declare const monsterZeroOperation:unique symbol
export type Dnd5eMonsterDamageZeroOriginalOperation={readonly[monsterZeroOperation]:true}
type Input=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Pending={status:'pending-damage-zero-saving-throw';frame:Readonly<DamageZeroSavingThrowFrame>;snapshot:Dnd5eHeadlessCombatState}
const issued=new WeakMap<object,{roomId:string;memberId:string;result:object;sourceSignature:string;frameSignature:string}>(),byResult=new WeakMap<object,Dnd5eMonsterDamageZeroOriginalOperation>()
const host=()=>{const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('monster-zero-original:actual-host-required');return session}
function actual(result:object){
 const boundary=readDnd5eActualDamageZeroOriginalBoundary(result)
 if(boundary.resolve!==resolvePreparedDnd5eMonsterAttack)throw Error('monster-zero-original:actual-monster-resolver-required')
 const input=boundary.input as Input,pending=result as Pending,frame=pending.frame
 const own=frame?.parentId===input.prepared.resourceAction.id?undefined:readDnd5eMonsterDamageZeroOriginalContext(input),nativeParent=frame?.parentId===input.prepared.resourceAction.id||!!own&&own.parentId===input.transactionId&&frame?.parentId===own.parentId&&own.command.actionId===input.prepared.resourceAction.id&&own.command.actorTokenId===frame.sourceId&&own.command.targetTokenId===frame.targetId
 if(pending.status!=='pending-damage-zero-saving-throw'||!frame||typeof input.transactionId!=='string'||!input.transactionId||!nativeParent||input.prepared.actorToken.id!==frame.sourceId||input.prepared.attacks.length!==1||input.rolls.length!==1||input.prepared.targetToken.id!==frame.targetId||input.prepared.state.combatants[frame.targetId]?.currentHp!==frame.hitPointsBefore||pending.snapshot.combatants[frame.targetId]?.currentHp!==0||frame.hitPointsBefore<=0||frame.hitPointDamage<=0||frame.damageTaken<=0||frame.critical||frame.ability!=='cha'||frame.dc!==5+frame.damageTaken)throw Error('monster-zero-original:actual-monster-zero-phase-required')
 return{input,frame,boundary}
}
/** A real zero-HP phase of this exact prepared monster attack; never an equipment or
 * attack-d20 permission. The source keeps every actual monster attack pool and cost. */
export function captureDnd5eMonsterDamageZeroOriginalOperation(result:object):Dnd5eMonsterDamageZeroOriginalOperation{
 const session=host(),facts=actual(result),previous=byResult.get(result)
 if(previous){readDnd5eMonsterDamageZeroOriginalOperation(previous);return previous}
 const cap=Object.freeze({})as Dnd5eMonsterDamageZeroOriginalOperation;issued.set(cap,{roomId:session.roomId,memberId:session.memberId,result,sourceSignature:JSON.stringify(facts.input),frameSignature:JSON.stringify(facts.frame)});byResult.set(result,cap);return cap
}
export function readDnd5eMonsterDamageZeroOriginalOperation(cap:Dnd5eMonsterDamageZeroOriginalOperation){
 const session=host(),record=issued.get(cap);if(!record||record.roomId!==session.roomId||record.memberId!==session.memberId)throw Error('monster-zero-original:exact-current-operation-required')
 const facts=actual(record.result);if(record.sourceSignature!==JSON.stringify(facts.input)||record.frameSignature!==JSON.stringify(facts.frame))throw Error('monster-zero-original:changed-native-operation')
 return{parentId:facts.input.transactionId!,source:cloneDnd5eHostTransactionInput(facts.input),frame:structuredClone(facts.frame),effectTimestamp:facts.boundary.effectTimestamp,prefixSignature:JSON.stringify((record.result as Pending).snapshot)}
}
/** Typed choices are preserved only after the actual monster attack Session consumed
 * them. The original state and physical monster attack pools remain unchanged. */
export function buildDnd5eMonsterDamageZeroOriginalSource(result:object){
 const boundary=readDnd5eActualDamageZeroOriginalBoundary(result)
 if(boundary.resolve!==resolvePreparedDnd5eMonsterAttack||boundary.operations.length===0)throw Error('monster-zero-original:completed-native-phase-required')
 const input=boundary.input as Input,operations=boundary.operations.map(record=>{const operation=captureDnd5eMonsterDamageZeroOriginalOperation(record.origin),facts=readDnd5eMonsterDamageZeroOriginalOperation(operation);if(facts.source.transactionId!==input.transactionId||JSON.stringify(record.frame)!==JSON.stringify(facts.frame))throw Error('monster-zero-original:foreign-completed-phase');return{operation,frame:structuredClone(record.frame),prefixSignature:record.prefixSignature,...(record.choice?{choice:structuredClone(record.choice)}:{})}})
 const records:readonly Dnd5eDamageZeroOriginalRecord[]=operations.map(({frame,prefixSignature,choice})=>({frame,prefixSignature,...(choice?{choice}:{})}));return{source:{...cloneDnd5eHostTransactionInput(input),hostDamageZeroSavingThrows:records},operations}
}
export function dnd5eMonsterDamageZeroOriginalBountifulOwners(cap:Dnd5eMonsterDamageZeroOriginalOperation){readDnd5eMonsterDamageZeroOriginalOperation(cap);const row=issued.get(cap);if(!row)throw Error('monster-zero-original:exact-current-operation-required');const facts=actual(row.result),pending=row.result as Pending;return dnd5eBountifulOriginalReadyOwners(pending.snapshot,{actorId:facts.frame.targetId,kind:'saving-throw'})}

/** Optional Room port preserves unsupported and unauthenticated ordinary flows. */
export function captureOptionalDnd5eMonsterDamageZeroOriginalOperation(result:object){const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)return undefined;const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result);if(!boundary||boundary.resolve!==resolvePreparedDnd5eMonsterAttack)return undefined;return captureDnd5eMonsterDamageZeroOriginalOperation(result)}

export function hasActualDnd5eMonsterDamageZeroAllyBoundary(result:object){const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result);return !!boundary&&boundary.resolve===resolvePreparedDnd5eMonsterAttack&&boundary.operations.length>0&&'status'in result&&result.status==='pending-ally-natural-one'}
