import{dnd5eBountifulOriginalReadyOwners,type Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import {getRoomSession} from '../../lib/roomSession'
import {resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {readDnd5eActualDamageZeroOriginalBoundary,readOptionalDnd5eActualDamageZeroOriginalBoundary,type Dnd5eDamageZeroOriginalRecord} from './damageCommitSession'
import type {DamageZeroSavingThrowFrame} from './damageZeroSavingThrowCheckpoint'

declare const damageZeroOriginalOperation:unique symbol
/** An actual native stage reference, never a die or publication permission. */
export type Dnd5eDamageZeroOriginalOperation={readonly [damageZeroOriginalOperation]:true}
type EquipmentInput=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
type Pending={status:'pending-damage-zero-saving-throw';frame:Readonly<DamageZeroSavingThrowFrame>;snapshot:Dnd5eHeadlessCombatState}
const issued=new WeakMap<object,{roomId:string;memberId:string;result:object;sourceSignature:string;frameSignature:string}>(),byResult=new WeakMap<object,Dnd5eDamageZeroOriginalOperation>()
const host=()=>{const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('damage-zero-original:actual-host-required');return session}
function actual(result:object){
 const boundary=readDnd5eActualDamageZeroOriginalBoundary(result)
 if(boundary.resolve!==resolvePreparedDnd5eEquipmentAttack)throw Error('damage-zero-original:actual-equipment-resolver-required')
 const input=boundary.input as EquipmentInput,pending=result as Pending,frame=pending.frame
 if(pending.status!=='pending-damage-zero-saving-throw'||!frame||input.prepared.action.type!=='dnd5e-weapon-attack'||input.prepared.action.id!==frame.parentId||input.prepared.targetToken.id!==frame.targetId||input.prepared.actorToken.id!==frame.sourceId||input.prepared.state.combatants[frame.targetId]?.currentHp!==frame.hitPointsBefore||pending.snapshot.combatants[frame.targetId]?.currentHp!==0||frame.hitPointsBefore<=0||frame.hitPointDamage<=0||frame.damageTaken<=0||frame.critical||frame.ability!=='cha'||frame.dc!==5+frame.damageTaken)throw Error('damage-zero-original:actual-equipment-zero-phase-required')
 return{input,frame,boundary}
}
export function captureDnd5eDamageZeroOriginalOperation(result:object):Dnd5eDamageZeroOriginalOperation{
 const session=host(),facts=actual(result),previous=byResult.get(result)
 if(previous){readDnd5eDamageZeroOriginalOperation(previous);return previous}
 const capability=Object.freeze({}) as Dnd5eDamageZeroOriginalOperation
 issued.set(capability,{roomId:session.roomId,memberId:session.memberId,result,sourceSignature:JSON.stringify(facts.input),frameSignature:JSON.stringify(facts.frame)});byResult.set(result,capability)
 return capability
}
export function readDnd5eDamageZeroOriginalOperation(capability:Dnd5eDamageZeroOriginalOperation){
 const session=host(),record=issued.get(capability)
 if(!record||record.roomId!==session.roomId||record.memberId!==session.memberId)throw Error('damage-zero-original:exact-current-operation-required')
 const facts=actual(record.result)
 if(record.sourceSignature!==JSON.stringify(facts.input)||record.frameSignature!==JSON.stringify(facts.frame))throw Error('damage-zero-original:changed-native-operation')
 return{source:cloneDnd5eHostTransactionInput(facts.input),frame:structuredClone(facts.frame),effectTimestamp:facts.boundary.effectTimestamp,prefixSignature:JSON.stringify((record.result as Pending).snapshot)}
}
/** Complete typed choices are copied only after the real native Session has
 * validated and consumed them. Original source state remains pre-damage. */
export function buildDnd5eDamageZeroOriginalSource(result:object){
 const boundary=readDnd5eActualDamageZeroOriginalBoundary(result)
 if(boundary.resolve!==resolvePreparedDnd5eEquipmentAttack||boundary.operations.length===0)throw Error('damage-zero-original:completed-native-phase-required')
 const input=boundary.input as EquipmentInput,operations=boundary.operations.map(record=>{
  const operation=captureDnd5eDamageZeroOriginalOperation(record.origin),facts=readDnd5eDamageZeroOriginalOperation(operation)
  if(facts.source.prepared.action.id!==input.prepared.action.id||JSON.stringify(record.frame)!==JSON.stringify(facts.frame))throw Error('damage-zero-original:foreign-completed-phase')
  return{operation,frame:structuredClone(record.frame),prefixSignature:record.prefixSignature,...(record.choice?{choice:structuredClone(record.choice)}:{})}
 })
 const records:readonly Dnd5eDamageZeroOriginalRecord[]=operations.map(({frame,prefixSignature,choice})=>({frame,prefixSignature,...(choice?{choice}:{})}))
 return{source:{...cloneDnd5eHostTransactionInput(input),hostDamageZeroSavingThrows:records},operations}
}

/** A pure eligibility query over this actual pre-save native prefix. It neither
 * fabricates a d20 nor depends on whether a resulting save succeeds. */
export function dnd5eDamageZeroOriginalBountifulOwners(capability:Dnd5eDamageZeroOriginalOperation){
 readDnd5eDamageZeroOriginalOperation(capability)
 const record=issued.get(capability);if(!record)throw Error('damage-zero-original:exact-current-operation-required')
 const facts=actual(record.result),pending=record.result as Pending
 return dnd5eBountifulOriginalReadyOwners(pending.snapshot,{actorId:facts.frame.targetId,kind:'saving-throw'})
}

/** This optional producer never turns a cloned frame into an operation. */
export function captureOptionalDnd5eDamageZeroOriginalOperation(result:object){const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)return undefined;const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result);if(!boundary||boundary.resolve!==resolvePreparedDnd5eEquipmentAttack)return undefined;return captureDnd5eDamageZeroOriginalOperation(result)}
export function hasActualDnd5eDamageZeroAllyBoundary(result:object){const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result);return !!boundary&&boundary.resolve===resolvePreparedDnd5eEquipmentAttack&&boundary.operations.length>0&&'status'in result&&result.status==='pending-ally-natural-one'}
