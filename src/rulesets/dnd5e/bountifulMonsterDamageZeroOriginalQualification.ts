import{getRoomSession}from'../../lib/roomSession'
import{buildDnd5eMonsterDamageZeroOriginalSource,readDnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
import{bindDnd5eMonsterDamageZeroCompletedContext,readDnd5eMonsterDamageZeroOriginalContext,stripDnd5eMonsterDamageZeroOriginalContext}from'./monsterDamageZeroOriginalContext'
import{readBountifulMonsterDamageZeroOriginalRawHandle}from'./bountifulMonsterDamageZeroOriginalRaw'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{Dnd5eDamageZeroOriginalRecord}from'./damageCommitSession'
import type{AllyNaturalOneRequest}from'./allyNaturalOneCheckpoint'
declare const qualification:unique symbol
export type BountifulMonsterDamageZeroOriginalQualification={readonly[qualification]:true}
type Source=ReturnType<typeof bindDnd5eMonsterDamageZeroCompletedContext>&{hostDamageZeroSavingThrows:readonly Dnd5eDamageZeroOriginalRecord[]}
const issued=new WeakMap<object,{roomId:string;memberId:string;result:object;handle:object;signature:string;source:Source;request:AllyNaturalOneRequest;rawIssuer:{mode:'dm';rollId:string;cursor:number}}>()
const host=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('monster-zero-qualified:actual-host-required');return value},equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** No caller phase, source or snapshot is registered. Both the actual Native
 * choice and its independently locked physical transport must match exactly. */
export async function captureBountifulMonsterDamageZeroOriginalQualification(result:object,handle:object){
 const session=host(),completed=buildDnd5eMonsterDamageZeroOriginalSource(result),transport=await readBountifulMonsterDamageZeroOriginalRawHandle(handle),operation=completed.operations[0]
 if(completed.operations.length!==1||!operation?.choice||operation.operation!==transport.operation)throw Error('monster-zero-qualified:exact-actual-operation-required')
 const allowed=['frameId','featureId','rolls','blessRoll','baneRoll'];if(Object.entries(operation.choice).some(([key,value])=>value!==undefined&&!allowed.includes(key)&&!(key==='legendaryResistance'&&value===false)))throw Error('monster-zero-qualified:uncollected-saving-late-input-required')
 const actual=readDnd5eMonsterDamageZeroOriginalOperation(operation.operation),book=transport.book,row=book.rows.find(r=>r.key==='original')
 if(!row?.raw||!row.confirmed||book.rows.some(r=>!r.raw||!r.confirmed)||!equal(operation.frame,book.frame)||operation.prefixSignature!==book.prefixSignature||actual.effectTimestamp!==book.effectTimestamp||!equal(operation.choice.rolls,row.confirmed.values))throw Error('monster-zero-qualified:actual-adopted-original-required')
 for(const key of['bless','bane']as const){const slot=book.rows.find(r=>r.key===key),value=operation.choice[key==='bless'?'blessRoll':'baneRoll'];if(slot?!equal(slot.confirmed?.values,[value]):value!==undefined)throw Error('monster-zero-qualified:actual-prefix-pool-required')}
 const pending=result as{status?:string;request?:AllyNaturalOneRequest};if(pending.status!=='pending-ally-natural-one'||pending.request?.kind!=='saving-throw'||pending.request.actorId!==book.frame.targetId||!equal(pending.request.originalRolls,row.confirmed.values))throw Error('monster-zero-qualified:actual-natural-one-required')
 const source=bindDnd5eMonsterDamageZeroCompletedContext(result)as Source,context=readDnd5eMonsterDamageZeroOriginalContext(source);if(!context||context.parentId!==book.parentId||source.hostOriginalD20Replay.effectTimestamp!==book.effectTimestamp)throw Error('monster-zero-qualified:exact-actual-parent-required')
 const cap=Object.freeze({})as BountifulMonsterDamageZeroOriginalQualification;issued.set(cap,{roomId:session.roomId,memberId:session.memberId,result,handle,signature:JSON.stringify(completed),source,request:structuredClone(pending.request),rawIssuer:{mode:'dm',rollId:row.requestId,cursor:row.index+1}});return{qualification:cap,source:cloneDnd5eHostTransactionInput(source)}
}
/** This live read grants no receipt or result: later parent publication must
 * still authenticate owner decisions and use the original actual Native CAS. */
export async function readBountifulMonsterDamageZeroOriginalQualification(cap:BountifulMonsterDamageZeroOriginalQualification,source:unknown,request?:AllyNaturalOneRequest){
 const session=host(),record=issued.get(cap);if(!record||record.roomId!==session.roomId||record.memberId!==session.memberId)throw Error('monster-zero-qualified:exact-current-qualification-required')
 if(!readDnd5eMonsterDamageZeroOriginalContext(source)||!equal(source,record.source)||request&&!equal(request,record.request)||JSON.stringify(buildDnd5eMonsterDamageZeroOriginalSource(record.result))!==record.signature)throw Error('monster-zero-qualified:changed-actual-source')
 const transport=await readBountifulMonsterDamageZeroOriginalRawHandle(record.handle),row=transport.book.rows.find(r=>r.requestId===record.rawIssuer.rollId),current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId||!row?.raw||!row.confirmed||!equal(row.confirmed.values,record.request.originalRolls))throw Error('monster-zero-qualified:current-adopted-original-required')
 return{source:cloneDnd5eHostTransactionInput(record.source),parentId:transport.book.parentId,effectTimestamp:transport.book.effectTimestamp,request:structuredClone(record.request),rawIssuer:{...record.rawIssuer}}
}
export async function encodeBountifulMonsterDamageZeroOriginalQualification(cap:BountifulMonsterDamageZeroOriginalQualification,source:unknown){const facts=await readBountifulMonsterDamageZeroOriginalQualification(cap,source),plain=cloneDnd5eHostTransactionInput(facts.source);if(!stripDnd5eMonsterDamageZeroOriginalContext(plain))throw Error('monster-zero-qualified:actual-context-required');return encodeSecondChanceParentWire(plain)}
