import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'
import {validateSecondChanceAttackReceipts} from './second-chance-state.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),integer=v=>Number.isSafeInteger(v)&&v>=0,id=v=>typeof v==='string'&&v.length>0&&v.length<=180,digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export const scBasePrefixCanonical=v=>v===undefined?{$undefined:true}:Array.isArray(v)?v.map(scBasePrefixCanonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,scBasePrefixCanonical(v[k])])):v
const same=(a,b)=>JSON.stringify(scBasePrefixCanonical(a))===JSON.stringify(scBasePrefixCanonical(b)),pool=(v,count,sides)=>Array.isArray(v)&&v.length===count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=sides),worldNames=['maps','characters','combat','map-geometry','campaign-time']
const validDependencies=v=>object(v)&&Object.keys(v).length===5&&worldNames.every(k=>integer(v[k]))
export function validScBasePrefixJournal(value){
 if(!object(value)||value.schemaVersion!==1||!object(value.parents)||Object.keys(value.parents).length>128)return false
 return Object.entries(value.parents).every(([key,p])=>object(p)&&/^[a-f0-9]{32}$/.test(key)&&p.id===key&&p.schemaVersion===1&&['waiting','consumed'].includes(p.phase)&&['roomId','hostMemberId','parentTransactionId','mapId','combatId'].every(k=>id(p[k]))&&['scGroupSignature','nativeResultSignature','activityDefinitionsSignature'].every(k=>digest(p[k]))&&validDependencies(p.dependencies)&&integer(p.issuedAt)&&object(p.requests)&&Object.keys(p.requests).length<=128&&Object.entries(p.requests).every(([requestId,r])=>object(r)&&/^host-sc-base:[a-f0-9]{32}$/.test(requestId)&&r.id===requestId&&integer(r.ordinal)&&['rollerTokenId','rollerCharacterId','controllerMemberId'].every(k=>id(r[k]))&&['d20','dice'].includes(r.kind)&&Number.isInteger(r.count)&&r.count>=1&&r.count<=100&&Number.isInteger(r.sides)&&r.sides>=2&&r.sides<=100&&(r.kind!=='d20'||r.sides===20&&r.count===1)&&integer(r.issuedAt)&&(r.raw==null||object(r.raw)&&pool(r.raw.values,r.count,r.sides)&&r.raw.authenticatedSubmitterMemberId===r.controllerMemberId&&r.raw.transport==='authenticated-room-member'&&integer(r.raw.recordedAt))&&(r.confirmed==null||r.raw!=null&&object(r.confirmed)&&pool(r.confirmed.values,r.count,r.sides)&&r.confirmed.authenticatedHostMemberId===p.hostMemberId&&same(r.confirmed.originalValues,r.raw.values)&&r.confirmed.transport==='authenticated-room-host'&&integer(r.confirmed.confirmedAt))))
}
/** Ordinary resource writes cannot issue or mutate these facts. A final phase
 * change requires the server transaction adapter's explicit paired SC consume. */
export function scBasePrefixGenericTransitionAllowed(before,after,allowPairedConsumption=false){
 if(before!=null&&!validScBasePrefixJournal(before)||after!=null&&!validScBasePrefixJournal(after))return false
 if(!before)return !after||Object.keys(after.parents).length===0
 if(!after)return Object.keys(before.parents).length===0
 if(!same(Object.keys(before.parents).sort(),Object.keys(after.parents).sort()))return false
 for(const p of Object.values(before.parents)){
  const n=after.parents[p.id];if(same(p,n))continue
  if(!allowPairedConsumption||p.phase!=='waiting'||n.phase!=='consumed'||!same({...p,phase:'consumed'},n)||!Object.values(p.requests).every(r=>r.raw&&r.confirmed))return false
 }
 return true
}
const fail=(status,error)=>({ok:false,status,error})
function originalWorld(parent,snapshot,identity,hash){
 if(parent.roomId!==identity.roomId||parent.hostMemberId!==identity.hostMemberId||worldNames.some(k=>(snapshot[k]?._sync?.revision??0)!==parent.dependencies[k]))return false
 const all=snapshot.combat?.secondChanceAttacks;if(!validateSecondChanceAttackReceipts(all))return false
 const group=Object.values(all??{}).filter(r=>r.attack.transactionId===parent.parentTransactionId).sort((a,b)=>(a.incomingOccurrence??0)-(b.incomingOccurrence??0))
 return group.length>0&&group.every(r=>r.attack.mapId===parent.mapId&&r.attack.combatId===parent.combatId&&r.parentContinuation?.phase==='ready')&&hash(JSON.stringify(group))===parent.scGroupSignature
}
function controllerFor(snapshot,parent,tokenId,characterId){const map=snapshot.maps?.maps?.find(m=>m.id===parent.mapId),token=map?.tokens?.find(t=>t.id===tokenId),character=snapshot.characters?.characters?.find(c=>c.id===characterId);return token?.characterId===characterId?secondChanceCanonicalControllerMemberId(character,{roomId:parent.roomId,hostMemberId:parent.hostMemberId}):undefined}
export function issueScBasePrefixRequest(journal,snapshot,identity,payload,now,hash){
 if(identity.role!=='dm'||identity.memberId!==identity.hostMemberId)return fail(403,'sc-base-prefix-host-required')
 const begin=payload?.begin===true,headerKeys=['parentTransactionId','mapId','combatId','scGroupSignature','nativeResultSignature','activityDefinitionsSignature','dependencies'],keys=begin?[...headerKeys,'begin']:[...headerKeys,'ordinal','rollerTokenId','rollerCharacterId','kind','count','sides']
 if(!object(payload)||Object.keys(payload).sort().join(',')!==keys.sort().join(',')||!['parentTransactionId','mapId','combatId'].every(k=>id(payload[k]))||!['scGroupSignature','nativeResultSignature','activityDefinitionsSignature'].every(k=>digest(payload[k]))||!validDependencies(payload.dependencies)||!begin&&(!['rollerTokenId','rollerCharacterId'].every(k=>id(payload[k]))||!integer(payload.ordinal)||payload.ordinal>=128||!['d20','dice'].includes(payload.kind)||!Number.isInteger(payload.count)||payload.count<1||payload.count>100||!Number.isInteger(payload.sides)||payload.sides<2||payload.sides>100||payload.kind==='d20'&&(payload.count!==1||payload.sides!==20)))return fail(422,'invalid-sc-base-prefix-request')
 if(journal!=null&&!validScBasePrefixJournal(journal))return fail(422,'invalid-sc-base-prefix-journal')
 const header={schemaVersion:1,roomId:identity.roomId,hostMemberId:identity.hostMemberId,parentTransactionId:payload.parentTransactionId,mapId:payload.mapId,combatId:payload.combatId,scGroupSignature:payload.scGroupSignature,nativeResultSignature:payload.nativeResultSignature,activityDefinitionsSignature:payload.activityDefinitionsSignature,dependencies:payload.dependencies}
 if(!originalWorld(header,snapshot,identity,hash))return fail(409,'sc-base-prefix-original-world-changed')
 const parentId=hash(JSON.stringify(scBasePrefixCanonical(header))).slice(0,32),old=journal?.parents[parentId]
 if(old?.phase==='consumed')return fail(409,'sc-base-prefix-already-consumed')
 const parent=old??{...header,id:parentId,phase:'waiting',issuedAt:now,requests:{}}
 if(begin){if(old)return{ok:true,changed:false,next:journal,parentId};const next={schemaVersion:1,...journal,parents:{...journal?.parents,[parentId]:parent}};return{ok:true,changed:true,next,parentId}}
 const controllerMemberId=controllerFor(snapshot,header,payload.rollerTokenId,payload.rollerCharacterId);if(!controllerMemberId)return fail(403,'sc-base-prefix-original-controller-required')
 const requestId='host-sc-base:'+hash(JSON.stringify([parentId,payload.ordinal,payload.rollerTokenId,payload.rollerCharacterId,payload.kind,payload.count,payload.sides])).slice(0,32),request={id:requestId,ordinal:payload.ordinal,rollerTokenId:payload.rollerTokenId,rollerCharacterId:payload.rollerCharacterId,controllerMemberId,kind:payload.kind,count:payload.count,sides:payload.sides,issuedAt:now}
 if(old){const previous=Object.values(old.requests).find(r=>r.ordinal===payload.ordinal);if(previous)return same({...previous,issuedAt:now,raw:undefined,confirmed:undefined},{...request,raw:undefined,confirmed:undefined})?{ok:true,changed:false,next:journal,parentId,requestId}:fail(409,'sc-base-prefix-roll-slot-changed');if(payload.ordinal!==Object.keys(old.requests).length)return fail(409,'sc-base-prefix-roll-order-required')}
 else if(payload.ordinal!==0)return fail(409,'sc-base-prefix-first-roll-required')
 const next={schemaVersion:1,...journal,parents:{...journal?.parents,[parentId]:{...parent,requests:{...parent.requests,[requestId]:request}}}}
 return validScBasePrefixJournal(next)?{ok:true,changed:true,next,parentId,requestId}:fail(422,'invalid-sc-base-prefix-journal')
}
function findRequest(journal,id){const rows=Object.values(journal?.parents??{}).flatMap(p=>Object.values(p.requests).filter(r=>r.id===id).map(r=>({parent:p,request:r})));return rows.length===1?rows[0]:undefined}
/** The owner sees one server-issued roll, never the original SC snapshot. */
export function projectScBasePrefixRequest(journal,snapshot,identity,requestId,hash){
 if(!['dm','player'].includes(identity.role)||!validScBasePrefixJournal(journal)||typeof requestId!=='string'||!/^host-sc-base:[a-f0-9]{32}$/.test(requestId))return fail(403,'issued-sc-base-prefix-required')
 const found=findRequest(journal,requestId);if(!found)return fail(403,'issued-sc-base-prefix-required')
 const{parent:p,request:r}=found,currentController=controllerFor(snapshot,p,r.rollerTokenId,r.rollerCharacterId)
 if(p.phase!=='waiting'||!originalWorld(p,snapshot,identity,hash)||currentController!==r.controllerMemberId||!(identity.memberId===r.controllerMemberId||identity.role==='dm'&&identity.memberId===p.hostMemberId))return fail(403,'sc-base-prefix-original-controller-required')
 return{ok:true,request:{requestId:r.id,mapId:p.mapId,combatId:p.combatId,rollerTokenId:r.rollerTokenId,rollerCharacterId:r.rollerCharacterId,controllerMemberId:r.controllerMemberId,phase:p.phase,kind:r.kind,count:r.count,sides:r.sides,...(r.raw?{raw:{values:[...r.raw.values]}}:{}),...(r.confirmed?{confirmed:{values:[...r.confirmed.values],originalValues:[...r.confirmed.originalValues]}}:{})}}
}
export function lockScBasePrefixRaw(journal,snapshot,identity,payload,now,hash){
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='requestId,rollerTokenId,sides,values'||typeof payload.requestId!=='string'||!/^host-sc-base:[a-f0-9]{32}$/.test(payload.requestId)||!['dm','player'].includes(identity.role)||!validScBasePrefixJournal(journal))return fail(403,'issued-sc-base-prefix-required')
 const found=findRequest(journal,payload.requestId);if(!found)return fail(403,'issued-sc-base-prefix-required');const{parent:p,request:r}=found
 if(p.phase!=='waiting'||r.rollerTokenId!==payload.rollerTokenId||r.sides!==payload.sides||!pool(payload.values,r.count,r.sides)||r.controllerMemberId!==identity.memberId||controllerFor(snapshot,p,r.rollerTokenId,r.rollerCharacterId)!==identity.memberId||!originalWorld(p,snapshot,identity,hash))return fail(403,'sc-base-prefix-original-controller-required')
 if(r.raw)return same(r.raw.values,payload.values)?{ok:true,changed:false,next:journal,requestId:r.id}:fail(409,'sc-base-prefix-raw-locked')
 const raw={values:[...payload.values],authenticatedSubmitterMemberId:identity.memberId,transport:'authenticated-room-member',recordedAt:now},next={...journal,parents:{...journal.parents,[p.id]:{...p,requests:{...p.requests,[r.id]:{...r,raw}}}}};return{ok:true,changed:true,next,requestId:r.id}
}
export function confirmScBasePrefixRaw(journal,snapshot,identity,payload,now,hash){
 if(identity.role!=='dm'||identity.memberId!==identity.hostMemberId)return fail(403,'sc-base-prefix-host-required')
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='requestId,values'||!validScBasePrefixJournal(journal))return fail(422,'invalid-sc-base-prefix-confirmation')
 const found=findRequest(journal,payload.requestId);if(!found)return fail(403,'issued-sc-base-prefix-required');const{parent:p,request:r}=found
 if(p.phase!=='waiting'||!r.raw||!pool(payload.values,r.count,r.sides)||!originalWorld(p,snapshot,identity,hash))return fail(409,'sc-base-prefix-original-raw-required')
 if(r.confirmed)return same(r.confirmed.values,payload.values)?{ok:true,changed:false,next:journal,requestId:r.id}:fail(409,'sc-base-prefix-confirmation-locked')
 const confirmed={values:[...payload.values],originalValues:[...r.raw.values],authenticatedHostMemberId:identity.memberId,transport:'authenticated-room-host',confirmedAt:now},next={...journal,parents:{...journal.parents,[p.id]:{...p,requests:{...p.requests,[r.id]:{...r,confirmed}}}}};return{ok:true,changed:true,next,requestId:r.id}
}

/** Only the original SC group's own final transaction may retire its prefix.
 * This grants no right to mint/alter pools or to publish any Base result. */
export function scBasePrefixConsumptionPaired(before,after,currentCombat,combatWrite,transactionId,hash){
 if(!validScBasePrefixJournal(before)||!validScBasePrefixJournal(after)||!combatWrite||combatWrite.name!=='combat'||combatWrite.expectedRevision!==currentCombat?._sync?.revision||!validateSecondChanceAttackReceipts(currentCombat?.secondChanceAttacks)||!validateSecondChanceAttackReceipts(combatWrite.data?.secondChanceAttacks))return false
 const changed=Object.values(before.parents).filter(p=>!same(p,after.parents[p.id]));if(changed.length!==1)return false
 const p=changed[0],n=after.parents[p.id];if(p.phase!=='waiting'||n?.phase!=='consumed'||transactionId!=='second-chance-parent:'+p.parentTransactionId||currentCombat._sync.revision!==p.dependencies.combat)return false
 const group=Object.values(currentCombat.secondChanceAttacks).filter(r=>r.attack.transactionId===p.parentTransactionId).sort((a,b)=>(a.incomingOccurrence??0)-(b.incomingOccurrence??0))
 if(!group.length||hash(JSON.stringify(group))!==p.scGroupSignature)return false
 const nextGroup=Object.values(combatWrite.data.secondChanceAttacks).filter(r=>r.attack.transactionId===p.parentTransactionId);if(nextGroup.length!==group.length)return false
 let result
 for(const row of group){const next=combatWrite.data.secondChanceAttacks[row.attack.id];if(!next||row.attack.mapId!==p.mapId||row.attack.combatId!==p.combatId||row.parentContinuation?.phase!=='ready'||next.attack.phase!=='damage-committed'||next.parentContinuation?.phase!=='consumed'||!next.parentContinuation.result?.ok||!same({...row,attack:{...row.attack,phase:'damage-committed'},parentContinuation:{...row.parentContinuation,phase:'consumed',result:next.parentContinuation.result}},next))return false;if(result&&!same(result,next.parentContinuation.result))return false;result=next.parentContinuation.result}
 return scBasePrefixGenericTransitionAllowed(before,after,true)
}

/** Reverse obligation: an issued original prefix cannot be left waiting while
 * that same SC group is consumed through another combat publication path. */
export function scBasePrefixReverseConsumptionAllowed(journal,currentCombat,incoming,writes=[],transactionId,hash){
 if(journal==null)return true
 if(!validScBasePrefixJournal(journal))return false
 if(!object(currentCombat)||!object(incoming)||currentCombat.mapId!==incoming.mapId||(currentCombat.combatId??'')!==(incoming.combatId??''))return true
 const previous=currentCombat.secondChanceAttacks,next=incoming.secondChanceAttacks
 if(!object(previous)||!object(next))return true
 for(const p of Object.values(journal.parents)){
  if(p.phase!=='waiting'||p.mapId!==currentCombat.mapId||p.combatId!==currentCombat.combatId)continue
  const group=Object.values(previous).filter(row=>row?.attack?.transactionId===p.parentTransactionId).sort((a,b)=>(a.incomingOccurrence??0)-(b.incomingOccurrence??0))
  if(!group.length||!group.some(row=>row.parentContinuation?.phase!=='consumed'&&next[row.attack.id]?.parentContinuation?.phase==='consumed'))continue
  const prefixWrite=writes.find(row=>row.name==='sc-base-prefix-rolls'),combatWrite=writes.find(row=>row.name==='combat')
  if(!prefixWrite||!combatWrite||!same(combatWrite.data,incoming)||!scBasePrefixConsumptionPaired(journal,prefixWrite.data,currentCombat,combatWrite,transactionId,hash))return false
 }
 return true
}
