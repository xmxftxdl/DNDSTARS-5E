import{getRoomSession}from'../../lib/roomSession';
import{loadBountifulPluginSpellAbilityOriginalSource}from'../../composition/browserSharedRoomResources';
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{restoreSecondChancePreparedHostFactsAsync}from'./secondChancePreparedHostFacts';
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone';
import{createBountifulPluginSpellAbilityOriginalNativeSessionFromBook,createBountifulPluginSpellAbilityOriginalCollectorSessionFromBook}from'./bountifulPluginSpellAbilityOriginalNative';
import type{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0];
import type{BountifulPluginSpellAbilityOriginalIdentity,BountifulPluginSpellAbilityOriginalBook}from'../../ports/dnd5ePluginSpellAbilityOriginalTransport';
export type{BountifulPluginSpellAbilityOriginalIdentity,BountifulPluginSpellAbilityOriginalBook}from'../../ports/dnd5ePluginSpellAbilityOriginalTransport';
type Row={roomId:string;memberId:string;source:Source;signature:string;effectTimestamp:number;book:BountifulPluginSpellAbilityOriginalBook;bookSignature:string};const issued=new WeakMap<object,Row>();
const host=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('plugin-spell-ability-recovery:actual-host-required');return value};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** A protected-book restore only. There is no caller registration of a source,
 * timestamp, pool or Native outcome; the HTTP loader authenticates the Host. */
export async function restoreBountifulPluginSpellAbilityOriginalNativeSession(identity:BountifulPluginSpellAbilityOriginalIdentity,actorId:string){return restore(identity,actorId)}
export async function restoreBountifulPluginSpellAbilityOriginalCollectorSession(identity:BountifulPluginSpellAbilityOriginalIdentity){return restore(identity,undefined)}
async function restore(identity:BountifulPluginSpellAbilityOriginalIdentity,actorId:string|undefined){
 const owner=host(),loaded=await loadBountifulPluginSpellAbilityOriginalSource(identity),book=structuredClone(loaded);
 if(book.roomId!==owner.roomId||book.hostMemberId!==owner.memberId||!same({parentId:book.parentId,mapId:book.mapId,combatId:book.combatId},identity)||!Number.isSafeInteger(book.effectTimestamp)||book.effectTimestamp<=0||!book.rows.length||book.rows.length>128||new Set(book.rows.map(r=>r.rollId)).size!==book.rows.length)throw Error('plugin-spell-ability-recovery:protected-original-book-required');
 const restored=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(book.source)) as Source;
 if(!restored?.prepared||restored.prepared.action.id!==identity.parentId||restored.prepared.map.id!==identity.mapId||restored.prepared.state.combatId!==identity.combatId||'hostOriginalD20Replay'in restored&&restored.hostOriginalD20Replay!==undefined)throw Error('plugin-spell-ability-recovery:matching-plain-source-required');
 const source=cloneDnd5eHostTransactionInput(restored);source.rolls={...source.rolls,activityRolls:{...source.rolls.activityRolls}};const rolls=source.rolls.activityRolls!;let unfinished=false;
 for(let index=0;index<book.rows.length;index++){
  const row=book.rows[index];if(row.index!==index||row.request.rollId!==row.rollId||row.request.actorId!==row.actorId||row.sides!==20||row.count!==(row.mode==='normal'?1:2)||!/^bountiful-plugin-spell-ability-original:[a-f0-9]{64}$/.test(row.requestId)||row.raw&&(row.raw.memberId!==row.memberId||row.raw.values.length!==row.count||row.raw.values.some(v=>!Number.isInteger(v)||v<1||v>20)))throw Error('plugin-spell-ability-recovery:exact-protected-pool-required');
  if(!row.confirmed){unfinished=true;if(rolls[row.rollId]!==undefined)throw Error('plugin-spell-ability-recovery:unconfirmed-source-pool');continue}
  if(unfinished||!row.raw||row.confirmed.memberId!==book.hostMemberId||row.confirmed.values.length!==row.count||row.confirmed.values.some(v=>!Number.isInteger(v)||v<1||v>20))throw Error('plugin-spell-ability-recovery:confirmed-prefix-required');
  const prior=rolls[row.rollId];if(prior&&!same(prior.values,row.confirmed.values))throw Error('plugin-spell-ability-recovery:changed-adopted-prefix');rolls[row.rollId]=prior??{values:[...row.confirmed.values],modifier:0,total:row.confirmed.values.reduce((a,b)=>a+b,0)};
 }
 if(Object.keys(rolls).some(id=>!book.rows.some(r=>r.rollId===id&&r.confirmed)))throw Error('plugin-spell-ability-recovery:extra-source-pool');
 const proof=Object.freeze({});issued.set(proof,{roomId:owner.roomId,memberId:owner.memberId,source,signature:JSON.stringify(source),effectTimestamp:book.effectTimestamp,book,bookSignature:JSON.stringify(book)});
 return{...(actorId===undefined?createBountifulPluginSpellAbilityOriginalCollectorSessionFromBook(proof):createBountifulPluginSpellAbilityOriginalNativeSessionFromBook(proof,actorId)),originalBookProof:()=>proof};
}
/** Read-only private proof. JSON, a copied object and a caller clock cannot mint it. */
export function readBountifulPluginSpellAbilityOriginalRecoveryProof(proof:object){const owner=host(),row=issued.get(proof);if(!row||row.roomId!==owner.roomId||row.memberId!==owner.memberId||row.signature!==JSON.stringify(row.source)||row.bookSignature!==JSON.stringify(row.book))throw Error('plugin-spell-ability-recovery:actual-protected-book-proof-required');return{source:cloneDnd5eHostTransactionInput(row.source),effectTimestamp:row.effectTimestamp,book:structuredClone(row.book)}}
