import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readBountifulMonsterSavingLateDiceHandle}from'./bountifulMonsterSavingLateDice'
import{readBountifulMonsterDamageZeroCollectedSavingLate,deriveBountifulMonsterDamageZeroCollectedSavingLate,type BountifulMonsterDamageZeroCollectedSavingLate}from'./bountifulMonsterDamageZeroSavingLateCheckpoint'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{stripDnd5eMonsterDamageZeroOriginalContext}from'./monsterDamageZeroOriginalContext'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
declare const completion:unique symbol
export type BountifulMonsterSavingLateCompletion={readonly[completion]:true}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
type Source=ReturnType<typeof deriveBountifulMonsterDamageZeroCollectedSavingLate>
const issued=new WeakMap<object,{handle:object;collected:BountifulMonsterDamageZeroCollectedSavingLate;source:Source;wire:unknown;signature:string}>()
/** An actual ready, real selected input, independently adopted private late die
 * and immutable protected prefix jointly permit this family's continuation.
 * This is no Native result or permission to commit a caller world. */
export async function completeBountifulMonsterSavingLate(handle:object,collected:BountifulMonsterDamageZeroCollectedSavingLate,gateway:Pick<SharedRoomGatewayPort,'publishEvent'>){
 const before=await readBountifulMonsterSavingLateDiceHandle(handle),facts=readBountifulMonsterDamageZeroCollectedSavingLate(collected),late=before.book.savingLate
 if(!same(readBountifulMonsterDamageZeroCollectedSavingLate(collected),facts)||!same(facts.frame,before.book.frame)||facts.prefixSignature!==before.book.prefixSignature||facts.effectTimestamp!==before.book.effectTimestamp||!late?.complete||late.slots.length!==1||!late.slots[0].raw||!late.slots[0].confirmed||facts.choice.bardicInspirationRoll!==late.slots[0].confirmed.values[0])throw Error('monster-save-late:actual-confirmed-collected-input-required')
 const source=deriveBountifulMonsterDamageZeroCollectedSavingLate(collected),plain=cloneDnd5eHostTransactionInput(source);if(!stripDnd5eMonsterDamageZeroOriginalContext(plain))throw Error('monster-save-late:actual-context-required');const wire=encodeSecondChanceParentWire(plain),identity={parentId:facts.frame.parentId,mapId:source.prepared.map.id,combatId:source.prepared.state.combatId}
 await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'monster-saving-late-v1',phase:'append',...identity,source:wire})
 const current=await readBountifulMonsterSavingLateDiceHandle(handle)
 if(!same(current.book.savingLate?.continuationSource,wire))throw Error('monster-save-late:authenticated-continuation-required')
 const cap=Object.freeze({})as BountifulMonsterSavingLateCompletion;issued.set(cap,{handle,collected,source,wire,signature:JSON.stringify(source)});return cap
}
export async function readBountifulMonsterSavingLateCompletion(cap:BountifulMonsterSavingLateCompletion){
 const row=issued.get(cap);if(!row||JSON.stringify(row.source)!==row.signature)throw Error('monster-save-late:actual-unchanged-completion-required')
 const current=await readBountifulMonsterSavingLateDiceHandle(row.handle),facts=readBountifulMonsterDamageZeroCollectedSavingLate(row.collected)
 if(!same(current.book.savingLate?.continuationSource,row.wire)||facts.frame.parentId!==current.book.parentId)throw Error('monster-save-late:changed-completed-book')
 return{source:cloneDnd5eHostTransactionInput(row.source),parentId:current.book.parentId,effectTimestamp:facts.effectTimestamp}
}

/** Retires only this caller's genuinely issued local continuation; retained
 * physical inputs remain immutable for a fresh authenticated recovery. */
export function cancelBountifulMonsterSavingLateCompletion(cap:BountifulMonsterSavingLateCompletion){return issued.delete(cap)}
