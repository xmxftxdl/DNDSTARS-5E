import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'
import {validArcaneNativeJournal} from './arcane-native-parent.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),integer=v=>Number.isSafeInteger(v)&&v>=0,id=v=>typeof v==='string'&&v.length>0&&v.length<=180,digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export const arcaneBasePrefixCanonical=v=>v===undefined?{$undefined:true}:Array.isArray(v)?v.map(arcaneBasePrefixCanonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,arcaneBasePrefixCanonical(v[k])])):v
const same=(a,b)=>JSON.stringify(arcaneBasePrefixCanonical(a))===JSON.stringify(arcaneBasePrefixCanonical(b)),pool=(v,count,sides)=>Array.isArray(v)&&v.length===count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=sides),worldNames=['maps','characters','combat','map-geometry','campaign-time']
const validDependencies=v=>object(v)&&Object.keys(v).length===5&&worldNames.every(k=>integer(v[k]))
export function validArcaneBasePrefixJournal(value){
 if(!object(value)||value.schemaVersion!==1||!object(value.parents)||Object.keys(value.parents).length>128)return false
 return Object.entries(value.parents).every(([key,p])=>validBaseCheckpoints(p)&&object(p)&&/^[a-f0-9]{32}$/.test(key)&&p.id===key&&p.schemaVersion===1&&['waiting','consumed'].includes(p.phase)&&['roomId','hostMemberId','parentTransactionId','mapId','combatId'].every(k=>id(p[k]))&&['arcaneParentSignature','nativeResultSignature','activityDefinitionsSignature'].every(k=>digest(p[k]))&&validDependencies(p.dependencies)&&integer(p.issuedAt)&&object(p.requests)&&Object.keys(p.requests).length<=128&&Object.entries(p.requests).every(([requestId,r])=>object(r)&&/^host-arcane-base:[a-f0-9]{32}$/.test(requestId)&&r.id===requestId&&integer(r.ordinal)&&['rollerTokenId','rollerCharacterId','controllerMemberId'].every(k=>id(r[k]))&&['d20','dice'].includes(r.kind)&&Number.isInteger(r.count)&&r.count>=1&&r.count<=100&&Number.isInteger(r.sides)&&r.sides>=2&&r.sides<=100&&(r.kind!=='d20'||r.sides===20&&r.count===1)&&integer(r.issuedAt)&&(r.raw==null||object(r.raw)&&pool(r.raw.values,r.count,r.sides)&&r.raw.authenticatedSubmitterMemberId===r.controllerMemberId&&r.raw.transport==='authenticated-room-member'&&integer(r.raw.recordedAt))&&(r.confirmed==null||r.raw!=null&&object(r.confirmed)&&pool(r.confirmed.values,r.count,r.sides)&&r.confirmed.authenticatedHostMemberId===p.hostMemberId&&same(r.confirmed.originalValues,r.raw.values)&&r.confirmed.transport==='authenticated-room-host'&&integer(r.confirmed.confirmedAt))))
}
/** Ordinary resource writes cannot issue or mutate these facts. A final phase
 * change requires the server transaction adapter's explicit paired Arcane consume. */
export function arcaneBasePrefixGenericTransitionAllowed(before,after,allowPairedConsumption=false){
 if(before!=null&&!validArcaneBasePrefixJournal(before)||after!=null&&!validArcaneBasePrefixJournal(after))return false
 if(!before)return !after||Object.keys(after.parents).length===0
 if(!after)return Object.keys(before.parents).length===0
 if(!same(Object.keys(before.parents).sort(),Object.keys(after.parents).sort()))return false
 for(const p of Object.values(before.parents)){
  const n=after.parents[p.id];if(same(p,n))continue
  if(baseCheckpointAppendAllowed(p,n))continue
  if(!allowPairedConsumption||p.phase!=='waiting'||n.phase!=='consumed'||!same({...p,phase:'consumed'},n)||(!Object.values(p.requests).every(r=>r.raw&&r.confirmed)||!(p.checkpoints??[]).every(c=>c.arcaneChoice&&(c.phase!=='shroud'||c.shroudChoice))))return false
 }
 return true
}
const fail=(status,error)=>({ok:false,status,error})
function originalWorld(parent,snapshot,identity,hash){
 if(parent.roomId!==identity.roomId||parent.hostMemberId!==identity.hostMemberId||worldNames.some(k=>(snapshot[k]?._sync?.revision??0)!==parent.dependencies[k]))return false
 const journal=snapshot['arcane-native-parents'];if(!validArcaneNativeJournal(journal))return false
 const matches=Object.values(journal.parents).filter(p=>p.parentTransactionId===parent.parentTransactionId&&p.mapId===parent.mapId&&p.combatId===parent.combatId)
 return matches.length===1&&matches[0].phase!=='consumed'&&!!matches[0].arcaneChoice&&(matches[0].phase!=='shroud'||!!matches[0].shroudChoice)&&hash(JSON.stringify(arcaneBasePrefixCanonical(matches[0])))===parent.arcaneParentSignature

}
function controllerFor(snapshot,parent,tokenId,characterId){const map=snapshot.maps?.maps?.find(m=>m.id===parent.mapId),token=map?.tokens?.find(t=>t.id===tokenId),character=snapshot.characters?.characters?.find(c=>c.id===characterId);return token?.characterId===characterId?secondChanceCanonicalControllerMemberId(character,{roomId:parent.roomId,hostMemberId:parent.hostMemberId}):undefined}
export function issueArcaneBasePrefixRequest(journal,snapshot,identity,payload,now,hash){
 if(identity.role!=='dm'||identity.memberId!==identity.hostMemberId)return fail(403,'arcane-base-prefix-host-required')
 const begin=payload?.begin===true,headerKeys=['parentTransactionId','mapId','combatId','arcaneParentSignature','nativeResultSignature','activityDefinitionsSignature','dependencies'],keys=begin?[...headerKeys,'begin']:[...headerKeys,'ordinal','rollerTokenId','rollerCharacterId','kind','count','sides']
 if(!object(payload)||Object.keys(payload).sort().join(',')!==keys.sort().join(',')||!['parentTransactionId','mapId','combatId'].every(k=>id(payload[k]))||!['arcaneParentSignature','nativeResultSignature','activityDefinitionsSignature'].every(k=>digest(payload[k]))||!validDependencies(payload.dependencies)||!begin&&(!['rollerTokenId','rollerCharacterId'].every(k=>id(payload[k]))||!integer(payload.ordinal)||payload.ordinal>=128||!['d20','dice'].includes(payload.kind)||!Number.isInteger(payload.count)||payload.count<1||payload.count>100||!Number.isInteger(payload.sides)||payload.sides<2||payload.sides>100||payload.kind==='d20'&&(payload.count!==1||payload.sides!==20)))return fail(422,'invalid-arcane-base-prefix-request')
 if(journal!=null&&!validArcaneBasePrefixJournal(journal))return fail(422,'invalid-arcane-base-prefix-journal')
 const header={schemaVersion:1,roomId:identity.roomId,hostMemberId:identity.hostMemberId,parentTransactionId:payload.parentTransactionId,mapId:payload.mapId,combatId:payload.combatId,arcaneParentSignature:payload.arcaneParentSignature,nativeResultSignature:payload.nativeResultSignature,activityDefinitionsSignature:payload.activityDefinitionsSignature,dependencies:payload.dependencies}
 if(!originalWorld(header,snapshot,identity,hash))return fail(409,'arcane-base-prefix-original-world-changed')
 const parentId=hash(JSON.stringify(arcaneBasePrefixCanonical(header))).slice(0,32),old=journal?.parents[parentId]
 if(old?.phase==='consumed')return fail(409,'arcane-base-prefix-already-consumed')
 const parent=old??{...header,id:parentId,phase:'waiting',issuedAt:now,requests:{}}
 if(begin){if(old)return{ok:true,changed:false,next:journal,parentId};const next={schemaVersion:1,...journal,parents:{...journal?.parents,[parentId]:parent}};return{ok:true,changed:true,next,parentId}}
 const controllerMemberId=controllerFor(snapshot,header,payload.rollerTokenId,payload.rollerCharacterId);if(!controllerMemberId)return fail(403,'arcane-base-prefix-original-controller-required')
 const requestId='host-arcane-base:'+hash(JSON.stringify([parentId,payload.ordinal,payload.rollerTokenId,payload.rollerCharacterId,payload.kind,payload.count,payload.sides])).slice(0,32),request={id:requestId,ordinal:payload.ordinal,rollerTokenId:payload.rollerTokenId,rollerCharacterId:payload.rollerCharacterId,controllerMemberId,kind:payload.kind,count:payload.count,sides:payload.sides,issuedAt:now}
 if(old){const previous=Object.values(old.requests).find(r=>r.ordinal===payload.ordinal);if(previous)return same({...previous,issuedAt:now,raw:undefined,confirmed:undefined},{...request,raw:undefined,confirmed:undefined})?{ok:true,changed:false,next:journal,parentId,requestId}:fail(409,'arcane-base-prefix-roll-slot-changed');if(payload.ordinal!==Object.keys(old.requests).length)return fail(409,'arcane-base-prefix-roll-order-required')}
 else if(payload.ordinal!==0)return fail(409,'arcane-base-prefix-first-roll-required')
 const next={schemaVersion:1,...journal,parents:{...journal?.parents,[parentId]:{...parent,requests:{...parent.requests,[requestId]:request}}}}
 return validArcaneBasePrefixJournal(next)?{ok:true,changed:true,next,parentId,requestId}:fail(422,'invalid-arcane-base-prefix-journal')
}
function findRequest(journal,id){const rows=Object.values(journal?.parents??{}).flatMap(p=>Object.values(p.requests).filter(r=>r.id===id).map(r=>({parent:p,request:r})));return rows.length===1?rows[0]:undefined}
/** The owner sees one server-issued roll, never the original Arcane snapshot. */
export function projectArcaneBasePrefixRequest(journal,snapshot,identity,requestId,hash){
 if(!['dm','player'].includes(identity.role)||!validArcaneBasePrefixJournal(journal)||typeof requestId!=='string'||!/^host-arcane-base:[a-f0-9]{32}$/.test(requestId))return fail(403,'issued-arcane-base-prefix-required')
 const found=findRequest(journal,requestId);if(!found)return fail(403,'issued-arcane-base-prefix-required')
 const{parent:p,request:r}=found,currentController=controllerFor(snapshot,p,r.rollerTokenId,r.rollerCharacterId)
 if(p.phase!=='waiting'||!originalWorld(p,snapshot,identity,hash)||currentController!==r.controllerMemberId||!(identity.memberId===r.controllerMemberId||identity.role==='dm'&&identity.memberId===p.hostMemberId))return fail(403,'arcane-base-prefix-original-controller-required')
 return{ok:true,request:{requestId:r.id,mapId:p.mapId,combatId:p.combatId,rollerTokenId:r.rollerTokenId,rollerCharacterId:r.rollerCharacterId,controllerMemberId:r.controllerMemberId,phase:p.phase,kind:r.kind,count:r.count,sides:r.sides,...(r.raw?{raw:{values:[...r.raw.values]}}:{}),...(r.confirmed?{confirmed:{values:[...r.confirmed.values],originalValues:[...r.confirmed.originalValues]}}:{})}}
}
export function lockArcaneBasePrefixRaw(journal,snapshot,identity,payload,now,hash){
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='requestId,rollerTokenId,sides,values'||typeof payload.requestId!=='string'||!/^host-arcane-base:[a-f0-9]{32}$/.test(payload.requestId)||!['dm','player'].includes(identity.role)||!validArcaneBasePrefixJournal(journal))return fail(403,'issued-arcane-base-prefix-required')
 const found=findRequest(journal,payload.requestId);if(!found)return fail(403,'issued-arcane-base-prefix-required');const{parent:p,request:r}=found
 if(p.phase!=='waiting'||r.rollerTokenId!==payload.rollerTokenId||r.sides!==payload.sides||!pool(payload.values,r.count,r.sides)||r.controllerMemberId!==identity.memberId||controllerFor(snapshot,p,r.rollerTokenId,r.rollerCharacterId)!==identity.memberId||!originalWorld(p,snapshot,identity,hash))return fail(403,'arcane-base-prefix-original-controller-required')
 if(r.raw)return same(r.raw.values,payload.values)?{ok:true,changed:false,next:journal,requestId:r.id}:fail(409,'arcane-base-prefix-raw-locked')
 const raw={values:[...payload.values],authenticatedSubmitterMemberId:identity.memberId,transport:'authenticated-room-member',recordedAt:now},next={...journal,parents:{...journal.parents,[p.id]:{...p,requests:{...p.requests,[r.id]:{...r,raw}}}}};return{ok:true,changed:true,next,requestId:r.id}
}
export function confirmArcaneBasePrefixRaw(journal,snapshot,identity,payload,now,hash){
 if(identity.role!=='dm'||identity.memberId!==identity.hostMemberId)return fail(403,'arcane-base-prefix-host-required')
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='requestId,values'||!validArcaneBasePrefixJournal(journal))return fail(422,'invalid-arcane-base-prefix-confirmation')
 const found=findRequest(journal,payload.requestId);if(!found)return fail(403,'issued-arcane-base-prefix-required');const{parent:p,request:r}=found
 if(p.phase!=='waiting'||!r.raw||!pool(payload.values,r.count,r.sides)||!originalWorld(p,snapshot,identity,hash))return fail(409,'arcane-base-prefix-original-raw-required')
 if(r.confirmed)return same(r.confirmed.values,payload.values)?{ok:true,changed:false,next:journal,requestId:r.id}:fail(409,'arcane-base-prefix-confirmation-locked')
 const confirmed={values:[...payload.values],originalValues:[...r.raw.values],authenticatedHostMemberId:identity.memberId,transport:'authenticated-room-host',confirmedAt:now},next={...journal,parents:{...journal.parents,[p.id]:{...p,requests:{...p.requests,[r.id]:{...r,confirmed}}}}};return{ok:true,changed:true,next,requestId:r.id}
}


/** A prefix can retire only beside its exact original Arcane journal retirement.
 * This does not authorize the resulting map or character publication. */
export function arcaneBasePrefixConsumptionPaired(before,after,arcaneBefore,arcaneAfter,transactionId,hash){
 if(!validArcaneBasePrefixJournal(before)||!validArcaneBasePrefixJournal(after)||!validArcaneNativeJournal(arcaneBefore)||!validArcaneNativeJournal(arcaneAfter)||!arcaneBasePrefixGenericTransitionAllowed(before,after,true))return false
 const changed=Object.values(before.parents).filter(p=>!same(p,after.parents[p.id]));if(changed.length!==1)return false
 const p=changed[0],matches=Object.values(arcaneBefore.parents).filter(a=>a.parentTransactionId===p.parentTransactionId&&a.mapId===p.mapId&&a.combatId===p.combatId)
 if(matches.length!==1)return false;const a=matches[0],n=arcaneAfter.parents[a.id]
 return a.phase!=='consumed'&&n?.phase==='consumed'&&transactionId==='arcane-native-publish:'+a.id&&hash(JSON.stringify(arcaneBasePrefixCanonical(a)))===p.arcaneParentSignature
}
export function arcaneBasePrefixReverseConsumptionAllowed(prefix,arcaneBefore,arcaneAfter,writes,transactionId,hash){
 if(prefix==null)return true;if(!validArcaneBasePrefixJournal(prefix))return false
 for(const p of Object.values(prefix.parents)){
  if(p.phase!=='waiting')continue
  const a=Object.values(arcaneBefore?.parents??{}).find(a=>a.parentTransactionId===p.parentTransactionId&&a.mapId===p.mapId&&a.combatId===p.combatId)
  if(!a||a.phase==='consumed'||arcaneAfter?.parents?.[a.id]?.phase!=='consumed')continue
  const write=writes?.find(w=>w.name==='arcane-base-prefix-rolls');if(!write||!arcaneBasePrefixConsumptionPaired(prefix,write.data,arcaneBefore,arcaneAfter,transactionId,hash))return false
 }
 return true
}

const checkpointKeys=['id','arcaneParentId','eventId','occurrence','targetId','targetCharacterId','controllerMemberId','featureId','stateSignature','facts','rollRequestIds','phase','arcaneChoice','shroudChoice']
function validBaseCheckpoints(p){if(!object(p))return false;if(p.checkpoints===undefined)return true;const rows=p.checkpoints;return Array.isArray(rows)&&rows.length<=32&&new Set(rows.map(c=>c.id)).size===rows.length&&rows.every(c=>object(c)&&Object.keys(c).every(k=>checkpointKeys.includes(k))&&/^[a-f0-9]{32}$/.test(c.id)&&/^[a-f0-9]{32}$/.test(c.arcaneParentId)&&typeof c.eventId==='string'&&c.eventId.length>0&&c.eventId.length<=1024&&['targetId','targetCharacterId','controllerMemberId','featureId'].every(k=>id(c[k]))&&integer(c.occurrence)&&digest(c.stateSignature)&&['arcane','shroud'].includes(c.phase)&&c.facts?.affectedId===c.targetId&&c.facts.sourceActorId===c.targetId&&c.facts.resolution?.success===false&&c.facts.resolution.roll?.total<c.facts.resolution.dc&&c.facts.options?.some(o=>o.featureId===c.featureId&&o.amount===4)&&Array.isArray(c.rollRequestIds)&&c.rollRequestIds.length>0&&new Set(c.rollRequestIds).size===c.rollRequestIds.length&&c.rollRequestIds.every(id=>p.requests?.[id]?.raw&&p.requests[id].confirmed)&&(!c.arcaneChoice||validBaseChoice(c.arcaneChoice,c,'arcane'))&&(!c.shroudChoice||validBaseChoice(c.shroudChoice,c,'shroud'))&&(c.phase!=='shroud'||c.arcaneChoice?.decision==='use'))}
function validBaseChoice(v,c,stage){return object(v)&&v.parentId===c.arcaneParentId&&v.checkpointId===c.id&&v.stage===stage&&['use','decline'].includes(v.decision)&&v.authenticatedSubmitterMemberId===c.controllerMemberId&&v.transport==='authenticated-room-member'&&integer(v.acceptedAt)&&(stage==='arcane'?v.targetIds===undefined:Array.isArray(v.targetIds)&&v.targetIds.length<=3&&new Set(v.targetIds).size===v.targetIds.length&&v.targetIds.every(id))}
function baseCheckpointAppendAllowed(before,after){if(before.phase!=='waiting'||after.phase!=='waiting'||!same({...before,checkpoints:undefined},{...after,checkpoints:undefined}))return false;const old=before.checkpoints??[],next=after.checkpoints??[];if(next.length<old.length||next.length>old.length+1)return false;for(let i=0;i<old.length;i++){if(!same({...old[i],phase:undefined},{...next[i],phase:undefined})||old[i].phase==='shroud'&&next[i].phase!=='shroud')return false}const child=next[old.length];if(child&&(child.phase!=='arcane'||child.arcaneChoice||child.shroudChoice||old.length&&(!old.at(-1).arcaneChoice||old.at(-1).phase==='shroud'&&!old.at(-1).shroudChoice)))return false;return true}
function baseChoiceRows(journal,parentId,checkpointId){return Object.values(journal?.parents??{}).flatMap(parent=>(parent.checkpoints??[]).filter(c=>c.arcaneParentId===parentId&&(checkpointId===undefined||c.id===checkpointId)).map(checkpoint=>({parent,checkpoint})))}
export function hasArcaneBaseChoice(journal,payload){return !!payload?.checkpointId&&validArcaneBasePrefixJournal(journal)&&baseChoiceRows(journal,payload.parentId,payload.checkpointId).length===1}
export function acceptArcaneBaseChoice(journal,snapshot,identity,payload,now,hash){
 if(!object(payload)||Object.keys(payload).some(k=>!['parentId','checkpointId','stage','decision','targetIds'].includes(k))||!['arcane','shroud'].includes(payload.stage)||!['use','decline'].includes(payload.decision)||payload.stage==='arcane'&&payload.targetIds!==undefined||!hasArcaneBaseChoice(journal,payload))return fail(403,'issued-arcane-base-choice-required')
 const{parent:p,checkpoint:c}=baseChoiceRows(journal,payload.parentId,payload.checkpointId)[0];if(!['dm','player'].includes(identity.role)||identity.memberId!==c.controllerMemberId||controllerFor(snapshot,p,c.targetId,c.targetCharacterId)!==identity.memberId||!originalWorld(p,snapshot,identity,hash)||p.phase!=='waiting')return fail(403,'arcane-base-choice-owner-required')
 const answer={parentId:c.arcaneParentId,checkpointId:c.id,stage:payload.stage,decision:payload.decision,...(payload.stage==='shroud'?{targetIds:payload.targetIds}:{}),authenticatedSubmitterMemberId:identity.memberId,transport:'authenticated-room-member',acceptedAt:now};if(!validBaseChoice(answer,c,payload.stage))return fail(422,'invalid-arcane-base-choice')
 const key=payload.stage==='arcane'?'arcaneChoice':'shroudChoice',old=c[key];if(old)return same({...old,acceptedAt:now},answer)?{ok:true,changed:false,next:journal}:fail(409,'arcane-base-choice-locked');if(c.phase!==payload.stage)return fail(409,'arcane-base-choice-phase-required')
 return{ok:true,changed:true,next:{...journal,parents:{...journal.parents,[p.id]:{...p,checkpoints:p.checkpoints.map(row=>row.id===c.id?{...row,[key]:answer}:row)}}}}
}
export function projectArcaneBaseChoiceRequests(journal,snapshot,identity,hash){if(!['dm','player'].includes(identity.role)||!validArcaneBasePrefixJournal(journal))return[];return Object.values(journal.parents).flatMap(p=>p.phase!=='waiting'||!originalWorld(p,snapshot,identity,hash)?[]:(p.checkpoints??[]).flatMap(c=>c.controllerMemberId!==identity.memberId||controllerFor(snapshot,p,c.targetId,c.targetCharacterId)!==identity.memberId||c.phase==='arcane'&&c.arcaneChoice||c.phase==='shroud'&&c.shroudChoice?[]:[{parentId:c.arcaneParentId,checkpointId:c.id,phase:c.phase,mapId:p.mapId,characterId:c.targetCharacterId,actorTokenId:c.targetId,featureId:c.featureId,...(c.phase==='shroud'?{maximumTargets:3,rangeFeet:60,requiresVisibleTargets:true}:{})}]))}
