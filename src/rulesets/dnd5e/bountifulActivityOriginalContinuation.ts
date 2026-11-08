import {getRoomSession} from '../../lib/roomSession'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {bountifulActivityOriginalSourceFacts} from '../../../shared/bountiful-activity-original.mjs'
import {readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification} from './bountifulActivityOriginalQualification'
import {readBountifulActivityCompletedOriginal} from './bountifulActivityOriginalCompletion'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import type {BountifulActivityOriginalBook,BountifulActivityOriginalIdentity} from '../../ports/dnd5eActivityOriginalTransport'

type Source=Parameters<typeof readBountifulActivityOriginalQualification>[1]
interface Combat{active?:boolean;mapId?:string;combatId?:string;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:unknown;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
export interface BountifulActivityOriginalContinuationGateway{
 loadResource<T>(name:string):Promise<T|null>
 loadBountifulActivityOriginalSource(identity:BountifulActivityOriginalIdentity):Promise<BountifulActivityOriginalBook>
}
declare const activityOriginalContinuation:unique symbol
export type BountifulActivityOriginalContinuation={readonly[activityOriginalContinuation]:true}
type Row={source:Source;sourceSignature:string;bookSignature:string;scopeSignature:string;firstSignature:string;effectTimestamp:number;roomId:string;hostMemberId:string;qualification:BountifulActivityOriginalQualification;identity:BountifulActivityOriginalIdentity}
// These two closed DTOs cross ordinary JSON HTTP, which omits undefined keys.
// Prepared source/book/result graphs retain their exact wire comparison.
const sameDto=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const issued=new WeakMap<object,Row>(),signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value)),data=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const identity=(source:Source)=>({parentId:source.prepared.action.id,mapId:source.prepared.map.id,combatId:source.prepared.state.combatId})
function scopeSignature(book:BountifulActivityOriginalBook){
 const scope:unknown=Reflect.get(book,'scope'),names=['characters','maps','combat','map-geometry','campaign-time']
 if(!data(scope)||!data(scope.versions)||Object.keys(scope.versions).length!==names.length||names.some(name=>!Number.isSafeInteger((scope.versions as Record<string,unknown>)[name])||Number((scope.versions as Record<string,unknown>)[name])<0)||['mapSignature','charactersSignature','geometrySignature','clockSignature','combatSignature','actionSignature'].some(name=>typeof scope[name]!=='string'))throw Error('activity-continuation:fixed-private-book-scope-required')
 return signature(scope)
}
/** Data reconstruction only. The private HTTP reader supplies the authority. */
function completeSource(book:BountifulActivityOriginalBook):Source{
 const source=cloneDnd5eHostTransactionInput(decodeSecondChanceParentWire(book.source))as Source
 if(!source?.prepared||source.prepared.action.id!==book.parentId||source.prepared.map.id!==book.mapId||source.prepared.state.combatId!==book.combatId||'hostOriginalD20Replay'in source)throw Error('activity-continuation:matching-plain-source-required')
 source.rolls={...source.rolls};if(!book.rows.length||new Set(book.rows.map(row=>row.rollId)).size!==book.rows.length)throw Error('activity-continuation:complete-original-prefix-required')
 for(let index=0;index<book.rows.length;index++){
  const row=book.rows[index],count=row.mode==='normal'?1:2
  if(row.index!==index||row.count!==count||row.sides!==20||!row.raw||!row.confirmed||row.raw.memberId!==row.memberId||row.confirmed.memberId!==book.hostMemberId||[row.raw.values,row.confirmed.values].some(values=>values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>20)))throw Error('activity-continuation:complete-original-prefix-required')
  const prior=source.rolls[row.rollId];if(prior&&signature(prior.values)!==signature(row.confirmed.values))throw Error('activity-continuation:changed-adopted-prefix')
  source.rolls[row.rollId]=prior??{values:[...row.confirmed.values],modifier:0,total:row.confirmed.values.reduce((a,b)=>a+b,0)}
 }
 if(Object.keys(source.rolls).some(id=>!book.rows.some(row=>row.rollId===id)))throw Error('activity-continuation:extra-original-pool')
 return source
}
function firstFor(combat:Combat|null,id:BountifulActivityOriginalIdentity){const first=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',id.parentId,0])];if(!combat||!first||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||combat.active!==true||combat.mapId!==id.mapId||combat.combatId!==id.combatId||first.consumed||first.originalAdapterId!=='plugin-feature'||first.identity.parentId!==id.parentId||first.continuation||first.postOriginalD20?.length||first.postOriginalEquipmentD20!==undefined)throw Error('activity-continuation:actual-completed-prefix-required');decisionFromBountifulOriginalDieReceipt(first,first.request);return first}
function hostMatches(row:Pick<Row,'roomId'|'hostMemberId'>){const current=getRoomSession();if(current?.role!=='dm'||current.roomId!==row.roomId||current.memberId!==row.hostMemberId)throw Error('activity-continuation:actual-current-host-required')}
/** No stored source or revision is changed. Only genuine Native qualification
 * plus the current same-parent complete private input book can issue this token. */
export async function captureBountifulActivityOriginalContinuation(input:{source:Source;qualification:BountifulActivityOriginalQualification},gateway:BountifulActivityOriginalContinuationGateway){
 const facts=readBountifulActivityOriginalQualification(input.qualification,input.source),id=identity(input.source),combat=await gateway.loadResource<Combat>('combat'),first=firstFor(combat,id),book=await gateway.loadBountifulActivityOriginalSource(id),plain=completeSource(book),firstFacts=bountifulActivityOriginalSourceFacts(first.originalParent),fullFacts=bountifulActivityOriginalSourceFacts(encodeSecondChanceParentWire(plain))
 if(book.parentId!==id.parentId||book.mapId!==id.mapId||book.combatId!==id.combatId||book.effectTimestamp!==facts.effectTimestamp||first.identity.effectTimestamp!==facts.effectTimestamp||first.identity.roomId!==book.roomId||first.identity.hostMemberId!==book.hostMemberId||first.identity.round!==input.source.prepared.state.round||first.identity.initiativeIndex!==input.source.prepared.state.initiativeIndex||first.identity.reactionEconomySignature!==JSON.stringify(combat?.dnd5eTurnEconomyByToken??{})||!sameDto(first.originalRoomAction,input.source.prepared.action)||!sameDto(first.request,facts.request)||signature(first.rawIssuer)!==signature(facts.rawIssuer)||!firstFacts||!fullFacts||signature(firstFacts.base)!==signature(fullFacts.base)||signature(plain)!==signature(input.source))throw Error('activity-continuation:exact-current-original-source-required')
 const token=Object.freeze({})as BountifulActivityOriginalContinuation,row:Row={source:cloneDnd5eHostTransactionInput(input.source),sourceSignature:signature(input.source),bookSignature:signature(book),scopeSignature:scopeSignature(book),firstSignature:signature(first),effectTimestamp:facts.effectTimestamp,roomId:book.roomId,hostMemberId:book.hostMemberId,qualification:input.qualification,identity:id};hostMatches(row);issued.set(token,row);return token
}
/** Initial-use reader. An ended initial worker cannot drive another replay. */
export function readBountifulActivityOriginalContinuation(token:object,source?:Source,first?:BountifulOriginalDieReceipt,qualification?:BountifulActivityOriginalQualification){const row=issued.get(token);if(!row)throw Error('activity-continuation:actual-private-token-required');hostMatches(row);readBountifulActivityOriginalQualification(row.qualification,row.source);if(qualification&&qualification!==row.qualification||source&&signature(source)!==row.sourceSignature||first&&signature(first)!==row.firstSignature)throw Error('activity-continuation:changed-original-source');return{source:cloneDnd5eHostTransactionInput(row.source),effectTimestamp:row.effectTimestamp}}
/** Fresh private-book validation before replay or publication. The optional
 * final result must itself carry the independent real completed-facade proof;
 * no caller boolean can revive an ended initial worker. */
export async function assertBountifulActivityOriginalContinuationCurrent(token:object,gateway:BountifulActivityOriginalContinuationGateway,source:Source,completedResult?:object){
 const row=issued.get(token);if(!row)throw Error('activity-continuation:actual-private-token-required');hostMatches(row)
 if(completedResult){const completed=readBountifulActivityCompletedOriginal(completedResult,source);if(completed.effectTimestamp!==row.effectTimestamp)throw Error('activity-continuation:changed-completed-clock')}
 else readBountifulActivityOriginalContinuation(token,source)
 if(signature(source)!==row.sourceSignature)throw Error('activity-continuation:changed-original-source')
 const combat=await gateway.loadResource<Combat>('combat'),first=firstFor(combat,row.identity),book=await gateway.loadBountifulActivityOriginalSource(row.identity)
 if(signature(first)!==row.firstSignature||signature(book)!==row.bookSignature||scopeSignature(book)!==row.scopeSignature||book.effectTimestamp!==row.effectTimestamp||signature(completeSource(book))!==row.sourceSignature)throw Error('activity-continuation:changed-private-original-book')
 if(completedResult)readBountifulActivityCompletedOriginal(completedResult,source);else readBountifulActivityOriginalContinuation(token,source)
 const scope=Reflect.get(book,'scope')as{versions:Record<string,number>};const readRevisions=Object.fromEntries(['characters','maps','map-geometry','campaign-time'].map(name=>[name,scope.versions[name]]))
 hostMatches(row);return{readRevisions}
}
