/** Pure shape/delta comparison, not an issuer. The allow-map is held only by
 * the concrete native Parent's private failed-cap/re-preparation WeakMaps. */
type ObjectValue=Record<string,unknown>
const object=(v:unknown):v is ObjectValue=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const keys=(v:ObjectValue,allowed:readonly string[])=>Object.keys(v).every(key=>allowed.includes(key))
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>[key,ordered(value)])):v
export const nativeWardLedgerSignature=(v:unknown)=>JSON.stringify(ordered(v))
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0
function rawRow(row:ObjectValue,descriptor:ObjectValue){
 if(!keys(row,[...Object.keys(descriptor),'issuedAt','phase','complete','raw','confirmed'])||!['issuedAt','phase','complete'].every(key=>Object.hasOwn(row,key))||!integer(row.issuedAt)||!['issued','raw','confirmed'].includes(String(row.phase))||typeof row.complete!=='boolean'||row.complete&&row.phase!=='confirmed')return false
 const faces=(v:unknown)=>Array.isArray(v)&&v.length===descriptor.count&&v.every(face=>Number.isSafeInteger(face)&&face>=1&&face<=Number(descriptor.sides))
 const pool=(v:unknown)=>object(v)&&keys(v,['memberId','values','submittedAt'])&&Object.keys(v).length===3&&v.memberId===descriptor.hostMemberId&&faces(v.values)&&integer(v.submittedAt)
 return(row.phase==='issued'?row.raw===undefined:pool(row.raw))&&(row.phase==='confirmed'?pool(row.confirmed):row.confirmed===undefined)
}
function actorRow(row:ObjectValue,descriptor:ObjectValue){
 if(!keys(row,[...Object.keys(descriptor),'issuedAt','phase','revision','answer'])||!['issuedAt','phase','revision'].every(key=>Object.hasOwn(row,key))||!integer(row.issuedAt)||!['waiting','answered'].includes(String(row.phase))||row.revision!==(row.phase==='waiting'?1:2))return false
 if(row.phase==='waiting')return row.answer===undefined
 const answer=row.answer;if(!object(answer)||!keys(answer,['choice','targetTokenId','memberId','submittedAt'])||answer.memberId!==descriptor.hostMemberId||!integer(answer.submittedAt))return false
 return answer.choice==='waste'?Object.keys(answer).length===3&&answer.targetTokenId===undefined:answer.choice==='retarget'&&Object.keys(answer).length===4&&Array.isArray(descriptor.retargetTokenIds)&&descriptor.retargetTokenIds.includes(answer.targetTokenId)
}
export function assertNativeWardLedgerDelta(before:Readonly<Record<string,unknown>>,revision:number,book:unknown,allowed:ReadonlyMap<string,ObjectValue>,kind:'raw'|'actor',resumable:ReadonlySet<string>=new Set()){
 const collection=kind==='raw'?'requests':'choices';if(!object(book)||!keys(book,['schemaVersion',collection,'updatedAt','_sync'])||book.schemaVersion!==1||!object(book[collection])||!object(book._sync)||!integer(book._sync.revision)||book._sync.revision<revision)throw Error('native-ward-chain:protected-ledger-required');const rows=book[collection]as ObjectValue;
 let progressed=0;
 for(const[id,prior]of Object.entries(before)){const current=rows[id];if(nativeWardLedgerSignature(current)===nativeWardLedgerSignature(prior))continue;const descriptor=allowed.get(id);if(!resumable.has(id)||!descriptor||!object(prior)||!object(current)||Object.entries(descriptor).some(([key,value])=>!Object.hasOwn(current,key)||nativeWardLedgerSignature(current[key])!==nativeWardLedgerSignature(value))||current.issuedAt!==prior.issuedAt||!(kind==='raw'?rawRow(current,descriptor):actorRow(current,descriptor)))throw Error('native-ward-chain:prior-ledger-row-changed');
  if(kind==='raw'){const rank=(v:unknown)=>['issued','raw','confirmed'].indexOf(String(v));if(rank(current.phase)<rank(prior.phase)||prior.complete===true&&current.complete!==true||prior.raw!==undefined&&nativeWardLedgerSignature(current.raw)!==nativeWardLedgerSignature(prior.raw)||prior.confirmed!==undefined&&nativeWardLedgerSignature(current.confirmed)!==nativeWardLedgerSignature(prior.confirmed))throw Error('native-ward-chain:locked-restored-pool-changed')}
  else if(prior.phase!=='waiting'||current.phase!=='answered'||prior.revision!==1||current.revision!==2||prior.answer!==undefined)throw Error('native-ward-chain:locked-restored-answer-changed');progressed++
 }
 const extra=Object.entries(rows).filter(([id])=>!Object.hasOwn(before,id));if(book._sync.revision===revision?extra.length+progressed>0:extra.length+progressed===0)throw Error('native-ward-chain:exact-ledger-cause-required');
 for(const[id,row]of extra){const descriptor=allowed.get(id);if(!descriptor||!object(row)||Object.entries(descriptor).some(([key,value])=>!Object.hasOwn(row,key)||nativeWardLedgerSignature(row[key])!==nativeWardLedgerSignature(value))||!(kind==='raw'?rawRow(row,descriptor):actorRow(row,descriptor)))throw Error('native-ward-chain:unissued-ledger-successor')}
}
