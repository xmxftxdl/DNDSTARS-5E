import{getRoomSession}from'../../lib/roomSession'
import{buildDnd5eDamageZeroOriginalSource,readDnd5eDamageZeroOriginalOperation}from'./damageZeroOriginalOperation'
import{readBountifulDamageZeroOriginalRawHandle}from'./bountifulDamageZeroOriginalRaw'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import type{AllyNaturalOneRequest}from'./allyNaturalOneCheckpoint'
declare const qualification:unique symbol
export type BountifulDamageZeroOriginalQualification={readonly[qualification]:true}
type Complete=ReturnType<typeof buildDnd5eDamageZeroOriginalSource>
type QualifiedSource=Complete['source']&{hostOriginalD20Replay:{parentId:string;sourceKey:string;effectTimestamp:number;facts:[]}}
const issued=new WeakMap<object,{roomId:string;memberId:string;result:object;handle:object;signature:string;source:QualifiedSource;rawIssuer:{mode:'dm';rollId:string;cursor:number};request:AllyNaturalOneRequest}>()
const host=()=>{const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('damage-zero-qualified:actual-host-required');return session}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** Actual native validation and an actual private transport handle must agree.
 * No caller source/frame/result/book can stand in for either issuer. */
export async function captureBountifulDamageZeroOriginalQualification(result:object,handle:object){
 const session=host(),completed=buildDnd5eDamageZeroOriginalSource(result),transport=await readBountifulDamageZeroOriginalRawHandle(handle),operation=completed.operations[0]
 if(completed.operations.length!==1||!operation?.choice||operation.operation!==transport.operation)throw Error('damage-zero-qualified:exact-native-original-operation-required')
 const actual=readDnd5eDamageZeroOriginalOperation(operation.operation),book=transport.book,row=book.rows.find(row=>row.key==='original')
 if(!row?.raw||!row.confirmed||book.rows.some(row=>!row.raw||!row.confirmed)||!equal(operation.frame,book.frame)||operation.prefixSignature!==book.prefixSignature||actual.effectTimestamp!==book.effectTimestamp||!equal(operation.choice.rolls,row.confirmed.values))throw Error('damage-zero-qualified:actual-adopted-native-original-required')
 for(const key of ['bless','bane']as const){const slot=book.rows.find(row=>row.key===key),value=operation.choice[key==='bless'?'blessRoll':'baneRoll'];if(slot?!equal(slot.confirmed?.values,[value]):value!==undefined)throw Error('damage-zero-qualified:actual-native-prefix-pool-required')}
 const pending=result as{status?:string;request?:AllyNaturalOneRequest};if(pending.status!=='pending-ally-natural-one'||pending.request?.kind!=='saving-throw'||pending.request.actorId!==book.frame.targetId||!equal(pending.request.originalRolls,row.confirmed.values))throw Error('damage-zero-qualified:actual-natural-one-boundary-required')
 const parentId=completed.source.prepared.action.id,effectTimestamp=actual.effectTimestamp,source:QualifiedSource={...cloneDnd5eHostTransactionInput(completed.source),hostOriginalD20Replay:{parentId,sourceKey:originalD20ReplaySourceKey(parentId,completed.source.prepared.state,completed.source.prepared.action,effectTimestamp),effectTimestamp,facts:[]}},capability=Object.freeze({})as BountifulDamageZeroOriginalQualification
 issued.set(capability,{roomId:session.roomId,memberId:session.memberId,result,handle,signature:JSON.stringify(completed),source,rawIssuer:{mode:'dm',rollId:row.requestId,cursor:row.index+1},request:structuredClone(pending.request)});return{qualification:capability,source:cloneDnd5eHostTransactionInput(source)}
}
/** The final authority remains the same actual native resolver and original CAS. */
export function readBountifulDamageZeroOriginalQualification(capability:BountifulDamageZeroOriginalQualification,source:unknown,request?:AllyNaturalOneRequest){
 const session=host(),record=issued.get(capability);if(!record||record.roomId!==session.roomId||record.memberId!==session.memberId)throw Error('damage-zero-qualified:exact-current-qualification-required')
 const completed=buildDnd5eDamageZeroOriginalSource(record.result);if(JSON.stringify(completed)!==record.signature||!equal(source,record.source)||request&&!equal(request,record.request))throw Error('damage-zero-qualified:changed-native-original-source')
 return{source:cloneDnd5eHostTransactionInput(record.source),effectTimestamp:record.source.hostOriginalD20Replay.effectTimestamp,rawIssuer:{...record.rawIssuer},request:structuredClone(record.request)}
}
