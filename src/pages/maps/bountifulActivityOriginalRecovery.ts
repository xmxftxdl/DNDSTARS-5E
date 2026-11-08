import{getRoomSession}from'../../lib/roomSession';
import{loadBountifulActivityOriginalSource}from'../../composition/browserSharedRoomResources';
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{restoreSecondChancePreparedHostFactsAsync}from'./secondChancePreparedHostFacts';
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone';
import{createBountifulActivityOriginalNativeSessionFromBook,createBountifulActivityOriginalCollectorSessionFromBook}from'./bountifulActivityOriginalNative';
import type{resolvePreparedDnd5ePluginFeatureAction}from'../../rulesets/dnd5e/pluginFeatureAction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0];
import type{BountifulActivityOriginalIdentity,BountifulActivityOriginalBook}from'../../ports/dnd5eActivityOriginalTransport';
export type{BountifulActivityOriginalIdentity,BountifulActivityOriginalBook}from'../../ports/dnd5eActivityOriginalTransport';
type Row={roomId:string;memberId:string;source:Source;signature:string;effectTimestamp:number;book:BountifulActivityOriginalBook;bookSignature:string};const issued=new WeakMap<object,Row>();
const host=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('activity-recovery:actual-host-required');return value};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** A protected-book restore only. There is no caller registration of a source,
 * timestamp, pool or Native outcome; the HTTP loader authenticates the Host. */
export async function restoreBountifulActivityOriginalNativeSession(identity:BountifulActivityOriginalIdentity,actorId:string){return restore(identity,actorId)}
export async function restoreBountifulActivityOriginalCollectorSession(identity:BountifulActivityOriginalIdentity){return restore(identity,undefined)}
async function restore(identity:BountifulActivityOriginalIdentity,actorId:string|undefined){
 const owner=host(),loaded=await loadBountifulActivityOriginalSource(identity),book=structuredClone(loaded);
 if(book.roomId!==owner.roomId||book.hostMemberId!==owner.memberId||!same({parentId:book.parentId,mapId:book.mapId,combatId:book.combatId},identity)||!Number.isSafeInteger(book.effectTimestamp)||book.effectTimestamp<=0||!book.rows.length||book.rows.length>128||new Set(book.rows.map(r=>r.rollId)).size!==book.rows.length)throw Error('activity-recovery:protected-original-book-required');
 const restored=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(book.source)) as Source;
 if(!restored?.prepared||restored.prepared.action.id!==identity.parentId||restored.prepared.map.id!==identity.mapId||restored.prepared.state.combatId!==identity.combatId||'hostOriginalD20Replay'in restored&&restored.hostOriginalD20Replay!==undefined)throw Error('activity-recovery:matching-plain-source-required');
 const source=cloneDnd5eHostTransactionInput(restored);source.rolls={...source.rolls};let unfinished=false;
 for(let index=0;index<book.rows.length;index++){
  const row=book.rows[index];if(row.index!==index||row.request.rollId!==row.rollId||row.request.actorId!==row.actorId||row.sides!==20||row.count!==(row.mode==='normal'?1:2)||!/^bountiful-activity-original:[a-f0-9]{64}$/.test(row.requestId)||row.raw&&(row.raw.memberId!==row.memberId||row.raw.values.length!==row.count||row.raw.values.some(v=>!Number.isInteger(v)||v<1||v>20)))throw Error('activity-recovery:exact-protected-pool-required');
  if(!row.confirmed){unfinished=true;if(source.rolls[row.rollId]!==undefined)throw Error('activity-recovery:unconfirmed-source-pool');continue}
  if(unfinished||!row.raw||row.confirmed.memberId!==book.hostMemberId||row.confirmed.values.length!==row.count||row.confirmed.values.some(v=>!Number.isInteger(v)||v<1||v>20))throw Error('activity-recovery:confirmed-prefix-required');
  const prior=source.rolls[row.rollId];if(prior&&!same(prior.values,row.confirmed.values))throw Error('activity-recovery:changed-adopted-prefix');source.rolls[row.rollId]=prior??{values:[...row.confirmed.values],modifier:0,total:row.confirmed.values.reduce((a,b)=>a+b,0)};
 }
 if(Object.keys(source.rolls).some(id=>!book.rows.some(r=>r.rollId===id&&r.confirmed)))throw Error('activity-recovery:extra-source-pool');
 const proof=Object.freeze({});issued.set(proof,{roomId:owner.roomId,memberId:owner.memberId,source,signature:JSON.stringify(source),effectTimestamp:book.effectTimestamp,book,bookSignature:JSON.stringify(book)});
 return{...(actorId===undefined?createBountifulActivityOriginalCollectorSessionFromBook(proof):createBountifulActivityOriginalNativeSessionFromBook(proof,actorId)),originalBookProof:()=>proof};
}
/** Read-only private proof. JSON, a copied object and a caller clock cannot mint it. */
export function readBountifulActivityOriginalRecoveryProof(proof:object){const owner=host(),row=issued.get(proof);if(!row||row.roomId!==owner.roomId||row.memberId!==owner.memberId||row.signature!==JSON.stringify(row.source)||row.bookSignature!==JSON.stringify(row.book))throw Error('activity-recovery:actual-protected-book-proof-required');return{source:cloneDnd5eHostTransactionInput(row.source),effectTimestamp:row.effectTimestamp,book:structuredClone(row.book)}}
