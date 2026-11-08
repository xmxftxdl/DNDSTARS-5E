import{getRoomSession}from'../../lib/roomSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readOptionalDnd5eActualDamageZeroOriginalBoundary,readDnd5eActualDamageZeroOriginalBoundary,type Dnd5eDamageZeroOriginalRecord}from'./damageCommitSession'
import{dnd5eBountifulOriginalReadyOwners,type Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import type{DamageZeroSavingThrowFrame}from'./damageZeroSavingThrowCheckpoint'
declare const spellZeroOperation:unique symbol
export type Dnd5eSpellDamageZeroOriginalOperation={readonly[spellZeroOperation]:true}
type Input=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Pending={status:'pending-damage-zero-saving-throw';frame:Readonly<DamageZeroSavingThrowFrame>;snapshot:Dnd5eHeadlessCombatState}
const issued=new WeakMap<object,{roomId:string;memberId:string;result:object;sourceSignature:string;frameSignature:string}>(),byResult=new WeakMap<object,Dnd5eSpellDamageZeroOriginalOperation>()
const host=()=>{const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('spell-zero-original:actual-host-required');return session}
function actual(result:object){
 const boundary=readDnd5eActualDamageZeroOriginalBoundary(result)
 if(boundary.resolve!==resolvePreparedDnd5eSpellCast)throw Error('spell-zero-original:actual-spell-resolver-required')
 const input=boundary.input as Input,pending=result as Pending,frame=pending.frame
 if(pending.status!=='pending-damage-zero-saving-throw'||!frame||input.prepared.action.type!=='dnd5e-spell-cast'||input.prepared.action.id!==frame.parentId||input.prepared.actorToken.id!==frame.sourceId||!input.prepared.targetTokens.some(token=>token.id===frame.targetId)||input.prepared.state.combatants[frame.targetId]?.currentHp!==frame.hitPointsBefore||pending.snapshot.combatants[frame.targetId]?.currentHp!==0||frame.hitPointsBefore<=0||frame.hitPointDamage<=0||frame.damageTaken<=0||frame.critical||frame.ability!=='cha'||frame.dc!==5+frame.damageTaken)throw Error('spell-zero-original:actual-spell-zero-phase-required')
 return{input,frame,boundary}
}
/** A real zero-HP phase of this exact prepared spell; never an equipment or
 * attack-d20 permission. The source keeps every actual spell pool and cost. */
export function captureDnd5eSpellDamageZeroOriginalOperation(result:object):Dnd5eSpellDamageZeroOriginalOperation{
 const session=host(),facts=actual(result),previous=byResult.get(result)
 if(previous){readDnd5eSpellDamageZeroOriginalOperation(previous);return previous}
 const cap=Object.freeze({})as Dnd5eSpellDamageZeroOriginalOperation;issued.set(cap,{roomId:session.roomId,memberId:session.memberId,result,sourceSignature:JSON.stringify(facts.input),frameSignature:JSON.stringify(facts.frame)});byResult.set(result,cap);return cap
}
export function readDnd5eSpellDamageZeroOriginalOperation(cap:Dnd5eSpellDamageZeroOriginalOperation){
 const session=host(),record=issued.get(cap);if(!record||record.roomId!==session.roomId||record.memberId!==session.memberId)throw Error('spell-zero-original:exact-current-operation-required')
 const facts=actual(record.result);if(record.sourceSignature!==JSON.stringify(facts.input)||record.frameSignature!==JSON.stringify(facts.frame))throw Error('spell-zero-original:changed-native-operation')
 return{source:cloneDnd5eHostTransactionInput(facts.input),frame:structuredClone(facts.frame),effectTimestamp:facts.boundary.effectTimestamp,prefixSignature:JSON.stringify((record.result as Pending).snapshot)}
}
/** Typed choices are preserved only after the actual spell Session consumed
 * them. The original state and physical spell pools remain unchanged. */
export function buildDnd5eSpellDamageZeroOriginalSource(result:object){
 const boundary=readDnd5eActualDamageZeroOriginalBoundary(result)
 if(boundary.resolve!==resolvePreparedDnd5eSpellCast||boundary.operations.length===0)throw Error('spell-zero-original:completed-native-phase-required')
 const input=boundary.input as Input,operations=boundary.operations.map(record=>{const operation=captureDnd5eSpellDamageZeroOriginalOperation(record.origin),facts=readDnd5eSpellDamageZeroOriginalOperation(operation);if(facts.source.prepared.action.id!==input.prepared.action.id||JSON.stringify(record.frame)!==JSON.stringify(facts.frame))throw Error('spell-zero-original:foreign-completed-phase');return{operation,frame:structuredClone(record.frame),prefixSignature:record.prefixSignature,...(record.choice?{choice:structuredClone(record.choice)}:{})}})
 const records:readonly Dnd5eDamageZeroOriginalRecord[]=operations.map(({frame,prefixSignature,choice})=>({frame,prefixSignature,...(choice?{choice}:{})}));return{source:{...cloneDnd5eHostTransactionInput(input),hostDamageZeroSavingThrows:records},operations}
}
export function dnd5eSpellDamageZeroOriginalBountifulOwners(cap:Dnd5eSpellDamageZeroOriginalOperation){readDnd5eSpellDamageZeroOriginalOperation(cap);const row=issued.get(cap);if(!row)throw Error('spell-zero-original:exact-current-operation-required');const facts=actual(row.result),pending=row.result as Pending;return dnd5eBountifulOriginalReadyOwners(pending.snapshot,{actorId:facts.frame.targetId,kind:'saving-throw'})}

/** Optional Room port preserves unsupported and unauthenticated ordinary flows. */
export function captureOptionalDnd5eSpellDamageZeroOriginalOperation(result:object){const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)return undefined;const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result);if(!boundary||boundary.resolve!==resolvePreparedDnd5eSpellCast)return undefined;return captureDnd5eSpellDamageZeroOriginalOperation(result)}

export function hasActualDnd5eSpellDamageZeroAllyBoundary(result:object){const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result);return !!boundary&&boundary.resolve===resolvePreparedDnd5eSpellCast&&boundary.operations.length>0&&'status'in result&&result.status==='pending-ally-natural-one'}
