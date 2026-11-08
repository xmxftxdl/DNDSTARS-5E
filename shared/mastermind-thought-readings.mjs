import{mastermindThoughtAuthorizedVersions}from'./mastermind-thought-adjudication.mjs'
import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v)
const integer=v=>Number.isSafeInteger(v)&&v>=0
const order=v=>Array.isArray(v)?v.map(order):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,order(n)])):v
const same=(a,b)=>JSON.stringify(order(a))===JSON.stringify(order(b))
const names=['characters','maps','combat','map-geometry','campaign-time']
const revision=v=>v==null?0:integer(v?._sync?.revision)?v._sync.revision:undefined
const versionsMatch=(a,s)=>object(a)&&Object.keys(a).length===5&&names.every(n=>integer(a[n])&&a[n]===revision(s[n]))
const controller=(c,i)=>secondChanceCanonicalControllerMemberId(c,{roomId:i.roomId,hostMemberId:i.hostMemberId})
const fail=(status,error)=>({ok:false,status,error})
const choices=['deny','allow-real-thoughts','present-false-thoughts']
const publishedResult=(row)=>object(row.result)&&['blocked','real-consent','false-thoughts'].includes(row.result.kind)&&integer(row.result.publishedAt)&&row.result.recipientMemberId===row.originalAction.roomMemberId&&Object.keys(row.result).every(k=>['kind','publishedAt','recipientMemberId','thoughts'].includes(k))&&(row.result.thoughts===undefined||row.result.kind==='real-consent'&&typeof row.result.thoughts==='string'&&row.result.thoughts.trim().length>0&&row.result.thoughts.length<=4000)&&(row.result.kind==='real-consent'?row.answer?.choice==='allow-real-thoughts':row.result.kind==='false-thoughts'?row.answer?.choice==='present-false-thoughts'&&['owner','reader'].every(role=>row.rollRequests?.[role]?.raw&&row.rollRequests[role].confirmed):true)

/** An authenticated owner decision is not a native reading capability. A native
 * consumer must separately prove the actual spell, level17 source and occurrence. */
export function validMastermindThoughtReadings(value){
 if(!object(value)||value.schemaVersion!==1||!object(value.parents)||Object.keys(value.parents).length>1024)return false
 return Object.entries(value.parents).every(([key,row])=>object(row)&&key===row.id&&id(key)&&id(row.roomId)&&id(row.hostMemberId)&&id(row.parentTransactionId)&&id(row.mapId)&&id(row.readerTokenId)&&id(row.ownerTokenId)&&id(row.readerCharacterId)&&id(row.ownerCharacterId)&&id(row.ownerMemberId)&&id(row.featureId)&&typeof row.sourceDefinitionSignature==='string'&&row.sourceDefinitionSignature.length>=2&&row.sourceDefinitionSignature.length<=20000&&object(row.originalAction)&&(row.origin===undefined||row.origin==='native'&&row.originalAction.sourceMode==='dm'&&row.originalAction.roomMemberId===row.hostMemberId)&&object(row.versions)&&Object.keys(row.versions).length===5&&names.every(n=>integer(row.versions[n]))&&integer(row.issuedAt)&&integer(row.revision)&&['waiting','answered','published'].includes(row.phase)&&(row.phase==='waiting'?row.answer===undefined:object(row.answer)&&choices.includes(row.answer.choice)&&row.answer.submittedByMemberId===row.ownerMemberId&&integer(row.answer.submittedAt)&&(row.answer.choice==='present-false-thoughts'?typeof row.answer.falseThoughts==='string'&&row.answer.falseThoughts.trim().length>0&&row.answer.falseThoughts.length<=4000:row.answer.falseThoughts===undefined))&&(row.phase==='published'?publishedResult(row):row.result===undefined)&&(row.rollRequests===undefined||validRequests(row.rollRequests,row)))
}

/** A private result may only accompany the exact issued original's accepted
 * normal ACK and all three mechanical writes. Authentication facts are never
 * created or changed by this transport. */
export function mastermindThoughtPublicationAllowed(current,next,snapshot,writes,transactionId,identity){
 if(!validMastermindThoughtReadings(current)||!validMastermindThoughtReadings(next)||!same(Object.keys(current.parents).sort(),Object.keys(next.parents).sort()))return false
 const changed=Object.keys(current.parents).filter(key=>!same(current.parents[key],next.parents[key]));if(changed.length!==1)return false
 const old=current.parents[changed[0]],row=next.parents[changed[0]];
 if(old.phase!=='answered'||row.phase!=='published'||row.revision!==old.revision+1||!same({...row,phase:old.phase,revision:old.revision,result:undefined},{...old,result:undefined})||!publishedResult(row)||old.roomId!==identity.roomId||old.hostMemberId!==identity.hostMemberId||identity.memberId!==identity.hostMemberId||identity.role!=='dm')return false
 const authorized=mastermindThoughtAuthorizedVersions(old,snapshot),issued=original(old,snapshot,identity);if(!issued||!same(issued.action,old.originalAction)||!authorized||transactionId!==(old.origin==='native'?'native-thought-reading:'+old.id:'player-action:'+old.parentTransactionId))return false
 if(old.answer.choice==='deny'&&row.result.kind!=='blocked'||old.answer.choice==='allow-real-thoughts'&&!['real-consent','blocked'].includes(row.result.kind)||old.answer.choice==='present-false-thoughts'&&!['blocked','false-thoughts'].includes(row.result.kind))return false
 if(old.answer.choice==='present-false-thoughts'&&!['owner','reader'].every(role=>old.rollRequests?.[role]?.raw&&old.rollRequests[role].confirmed))return false
 if(!['characters','maps','combat'].every(name=>writes.some(w=>w.name===name&&w.expectedRevision===authorized[name])))return false
 if(old.origin==='native')return writes.length===4&&new Set(writes.map(w=>w.name)).size===4&&['characters','maps','combat','mastermind-thought-readings'].every(name=>writes.some(w=>w.name===name));
 const ack=writes.find(w=>w.name==='player-action-ack')?.data,processed=writes.find(w=>w.name==='player-action-processed')?.data;
 return ack?.actionId===old.parentTransactionId&&ack.status==='accepted'&&ack.mapId===old.mapId&&ack.recipientMemberId===old.originalAction.roomMemberId&&processed?.actionIds?.includes(old.parentTransactionId)===true
}

/** The original reader gets only its committed private result, never either
 * private pool, the defender source, or the owner's consent protocol. */
export function projectMastermindThoughtResult(current,snapshot,identity,parentId){
 if(!validMastermindThoughtReadings(current)||!id(parentId))return fail(404,'thought-reading-result-not-found');const row=current.parents[parentId];
 if(!row||row.roomId!==identity.roomId||row.phase!=='published')return fail(404,'thought-reading-result-not-found');const reader=snapshot.characters?.characters?.find(c=>c.id===row.readerCharacterId);
 if(identity.memberId!==row.result.recipientMemberId||controller(reader,identity)!==identity.memberId)return fail(403,'thought-reading-original-reader-required');
 const processed=snapshot['player-action-processed'];if(row.origin!=='native'&&!processed?.actionIds?.includes(row.parentTransactionId))return fail(409,'thought-reading-original-ack-required');
 return{ok:true,result:{parentTransactionId:row.parentTransactionId,mapId:row.mapId,kind:row.result.kind==='blocked'?'unavailable':'thoughts',...(row.result.kind==='false-thoughts'?{thoughts:row.answer.falseThoughts}:row.result.kind==='real-consent'&&row.result.thoughts?{thoughts:row.result.thoughts}:{})}}
}
function original(row,snapshot,identity){
 const map=snapshot.maps?.maps?.find(m=>m.id===row.mapId),characters=snapshot.characters?.characters??[],owner=characters.find(c=>c.id===row.ownerCharacterId),reader=characters.find(c=>c.id===row.readerCharacterId)
 const native=row.origin==='native',action=native?row.originalAction:snapshot['player-action-requests']?.requests?.find(a=>a.id===row.parentTransactionId),payload=action?.dnd5eSpellCast
 if(!owner||!reader||!map||!action||!['dnd5e-spell-cast','dnd5e-plugin-action'].includes(action.type)||action.status!=='pending'||action.sourceMode!==(native?'dm':'player')||action.mapId!==map.id||action.actorTokenId!==row.readerTokenId||action.characterId!==reader.id||!action.roomMemberId||controller(reader,identity)!==action.roomMemberId||controller(owner,identity)!==row.ownerMemberId)return undefined
 if(native){
  const combat=snapshot.combat
  if(combat?.active===true&&(combat.mapId!==row.mapId||action.combatId!==combat.combatId||action.round!==combat.round||action.initiativeIndex!==combat.initiativeIndex||combat.initiativeOrder?.[combat.initiativeIndex]?.tokenId!==row.readerTokenId||!(combat.dnd5eTurnEconomyByToken?.[row.readerTokenId]?.action?.current>0)))return undefined
  if(combat?.active!==true&&action.combatId!==undefined)return undefined
  if(snapshot['player-action-requests']?.requests?.some(a=>a.id===row.parentTransactionId))return undefined
  if(action.id!==row.parentTransactionId||controller(reader,identity)!==identity.hostMemberId||action.roomMemberId!==identity.hostMemberId)return undefined
  if(action.type==='dnd5e-spell-cast'){
   const wizard=reader.dnd5eClassChoices?.classes?.wizard?.selections
   if(payload?.castingClassId!=='wizard'||payload.slotLevel!==2||!(reader.dnd5eClassLevels?.wizard>=3)||!wizard?.['wizard-spellbook']?.some(id=>id.split(':').at(-1)==='detect-thoughts')||!wizard?.['spell-prepared']?.some(id=>id.split(':').at(-1)==='detect-thoughts'))return undefined
  }
 }

 if(action.type==='dnd5e-spell-cast'){
  if(!payload||typeof payload.spellId!=='string'||payload.spellId.split(':').at(-1)!=='detect-thoughts'||(payload.targetTokenId??action.targetTokenId)!==row.ownerTokenId)return undefined
 }else{
  const request=action.dnd5ePluginAction,kind=['surface','probe'].find(kind=>request?.featureId==='srd-5.1:effect-control.spell:detect-thoughts:'+kind),effect=reader.dnd5eCombatState?.activeEffects?.find(effect=>effect.id===request?.payload?.activeEffectId)
  if(!kind||request?.payload?.selectedActivityId!=null&&request.payload.selectedActivityId!=='spell:detect-thoughts:'+kind||action.targetTokenId!==row.ownerTokenId||!effect||effect.source?.kind!=='spell'||effect.source.actorId!==row.readerTokenId||effect.source.characterId!==reader.id||effect.source.rulesId?.split(':').at(-1)!=='detect-thoughts'||effect.source.pluginId!=='srd-5.1'||effect.source.magical!==true||effect.duration?.type!=='concentration'||effect.duration.sourceActorId!==row.readerTokenId||!effect.grantedActivities?.includes('spell:detect-thoughts:'+kind)||reader.concentrating!==true)return undefined
  if(kind==='probe'&&!owner.dnd5eCombatState?.activeEffects?.some(focus=>focus.tags?.includes('detect-thoughts-focus')&&focus.source?.actorId===row.readerTokenId&&focus.source?.characterId===reader.id))return undefined
 }
 if(!map.tokens?.some(t=>t.id===row.readerTokenId&&t.characterId===reader.id)||!map.tokens?.some(t=>t.id===row.ownerTokenId&&t.characterId===owner.id)||row.readerTokenId===row.ownerTokenId)return undefined
 const rogue=owner.dnd5eClassLevels?.rogue??(owner.charClass==='游荡者'?owner.level:0)
 if(!integer(rogue)||rogue<17||!id(owner.dnd5eClassChoices?.classes?.rogue?.subclass))return undefined
 return{action,owner,reader,map}
}
export function mutateMastermindThoughtReading(current,snapshot,identity,operation,input,now){
 if(!object(input)||!id(input.id)||!id(identity?.roomId)||!id(identity?.hostMemberId)||!id(identity?.memberId)||!['dm','player'].includes(identity.role)||!integer(now))return fail(403,'thought-reading-member-required')
 const base=current??{schemaVersion:1,parents:{}}
 if(!validMastermindThoughtReadings(base))return fail(409,'invalid-thought-reading-journal')
 const old=base.parents[input.id],host=identity.role==='dm'&&identity.memberId===identity.hostMemberId
 if(operation==='begin'||operation==='begin-native'){
  if(!host)return fail(403,'thought-reading-host-required')
  const continuation=operation==='begin-native'&&input.continuationKind!==undefined
  if((input.continuationKind!==undefined||input.activeEffectId!==undefined)&&(!continuation||!['surface','probe'].includes(input.continuationKind)||!id(input.activeEffectId)))return fail(400,'invalid-thought-reading-continuation')
  const fields=['id','parentTransactionId','mapId','readerTokenId','ownerTokenId','readerCharacterId','ownerCharacterId','featureId','sourceDefinitionSignature','versions',...(continuation?['continuationKind','activeEffectId']:[])]
  if(Object.keys(input).some(k=>!fields.includes(k)))return fail(400,'invalid-thought-reading-parent')
  const{continuationKind,activeEffectId,...parentInput}=input,owner=snapshot.characters?.characters?.find(c=>c.id===input.ownerCharacterId),row={...parentInput,roomId:identity.roomId,hostMemberId:identity.hostMemberId,ownerMemberId:controller(owner,identity),phase:'waiting',issuedAt:now,revision:1}
  if(operation==='begin-native'){
   if(!old&&snapshot.combat?.flowPause)return fail(409,'thought-reading-native-combat-paused')
   if(snapshot['player-action-requests']?.requests?.some(a=>a.id===input.parentTransactionId))return fail(409,'thought-reading-native-queue-alias')
   if(!old&&Object.values(base.parents).some(parent=>parent.roomId===identity.roomId&&parent.mapId===input.mapId&&parent.phase!=='published'&&!!mastermindThoughtAuthorizedVersions(parent,snapshot)&&!!original(parent,snapshot,identity)))return fail(409,'thought-reading-native-parent-pending')
   const combat=snapshot.combat,nativeNow=old?.origin==='native'?old.issuedAt:now;row.origin='native'
   row.originalAction={id:input.parentTransactionId,mapId:input.mapId,type:continuation?'dnd5e-plugin-action':'dnd5e-spell-cast',status:'pending',sourceMode:'dm',roomMemberId:identity.hostMemberId,characterId:input.readerCharacterId,actorTokenId:input.readerTokenId,targetTokenId:input.ownerTokenId,...(continuation?{dnd5ePluginAction:{featureId:'srd-5.1:effect-control.spell:detect-thoughts:'+continuationKind,payload:{activeEffectId}}}:{dnd5eSpellCast:{spellId:'detect-thoughts',castingClassId:'wizard',slotLevel:2,targetTokenId:input.ownerTokenId}}),round:combat?.round??1,initiativeIndex:combat?.initiativeIndex??0,...(combat?.active===true&&combat.mapId===input.mapId?{combatId:combat.combatId}:{}),seq:0,updatedAt:nativeNow}
  }

  const source=original(row,snapshot,identity)
  if(!source||!versionsMatch(row.versions,snapshot))return fail(409,'thought-reading-original-changed')
  row.originalAction=structuredClone(source.action)
  row.originalCombat=structuredClone(snapshot.combat)
  if(old){const fields=['origin','roomId','hostMemberId','parentTransactionId','mapId','readerTokenId','ownerTokenId','readerCharacterId','ownerCharacterId','ownerMemberId','featureId','sourceDefinitionSignature','versions','originalAction'];return fields.every(k=>same(old[k],row[k]))?{ok:true,changed:false,next:base,id:old.id,phase:old.phase}:fail(409,'thought-reading-parent-conflict')}
  const next={...base,parents:{...base.parents,[row.id]:row}}
  return validMastermindThoughtReadings(next)?{ok:true,changed:true,next,id:row.id,phase:row.phase}:fail(400,'invalid-thought-reading-parent')
 }
 if(['issue-roll','raw','confirm'].includes(operation))return mutateRoll(base,snapshot,identity,operation,input,now)
 if(operation!=='answer'||Object.keys(input).some(k=>!['id','expectedRecordRevision','choice','falseThoughts'].includes(k)))return fail(400,'invalid-thought-reading-answer')
 if(!old||old.roomId!==identity.roomId||old.hostMemberId!==identity.hostMemberId)return fail(404,'thought-reading-parent-not-found')
 const owner=snapshot.characters?.characters?.find(c=>c.id===old.ownerCharacterId)
 if(identity.memberId!==old.ownerMemberId||controller(owner,identity)!==identity.memberId)return fail(403,'thought-reading-owner-required')
 if(!choices.includes(input.choice)||(input.choice==='present-false-thoughts'?typeof input.falseThoughts!=='string'||!input.falseThoughts.trim()||input.falseThoughts.length>4000:input.falseThoughts!==undefined))return fail(400,'thought-reading-choice-required')
 if(old.phase==='answered')return old.answer.choice===input.choice&&old.answer.falseThoughts===input.falseThoughts?{ok:true,changed:false,next:base,id:old.id,phase:old.phase}:fail(409,'thought-reading-answer-locked')
 if(input.expectedRecordRevision!==old.revision||!versionsMatch(old.versions,snapshot)||!same(original(old,snapshot,identity)?.action,old.originalAction))return fail(409,'thought-reading-original-changed')
 const row={...old,phase:'answered',revision:old.revision+1,answer:{choice:input.choice,...(input.choice==='present-false-thoughts'?{falseThoughts:input.falseThoughts}:{}),submittedByMemberId:identity.memberId,submittedAt:now}}
 return{ok:true,changed:true,next:{...base,parents:{...base.parents,[old.id]:row}},id:row.id,phase:row.phase}
}
export function projectMastermindThoughtReading(current,snapshot,identity,parentId){
 if(!validMastermindThoughtReadings(current)||!id(parentId))return fail(404,'thought-reading-parent-not-found')
 const row=current.parents[parentId],owner=snapshot.characters?.characters?.find(c=>c.id===row?.ownerCharacterId),host=identity?.role==='dm'&&identity.memberId===identity.hostMemberId,canAnswer=row?.ownerMemberId===identity?.memberId&&controller(owner,identity)===identity?.memberId
 if(!row||row.roomId!==identity?.roomId)return fail(404,'thought-reading-parent-not-found')
 if(!host&&!canAnswer)return fail(403,'thought-reading-owner-required')
 return{ok:true,parent:{id:row.id,mapId:row.mapId,ownerCharacterId:row.ownerCharacterId,ownerTokenId:row.ownerTokenId,phase:row.phase,revision:row.revision,canAnswer,...(row.answer?{choice:row.answer.choice,...(row.answer.falseThoughts?{falseThoughts:row.answer.falseThoughts}:{})}:{})}}
}

const values=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(d=>Number.isInteger(d)&&d>=1&&d<=20)
function validRequests(requests,row){return object(requests)&&Object.keys(requests).every(role=>['owner','reader'].includes(role)&&validRequest(requests[role],row,role))}
function validRequest(r,row,role){return object(r)&&r.id===row.id+':'+role&&r.role===role&&r.tokenId===(role==='owner'?row.ownerTokenId:row.readerTokenId)&&r.characterId===(role==='owner'?row.ownerCharacterId:row.readerCharacterId)&&id(r.controllerMemberId)&&['normal','advantage','disadvantage'].includes(r.mode)&&r.count===(r.mode==='normal'?1:2)&&r.sides===20&&integer(r.issuedAt)&&(r.raw===undefined||object(r.raw)&&r.raw.memberId===r.controllerMemberId&&['dm','player'].includes(r.raw.sourceMode)&&integer(r.raw.at)&&values(r.raw.values,r.count))&&(r.confirmed===undefined||object(r.confirmed)&&!!r.raw&&r.confirmed.memberId===row.hostMemberId&&integer(r.confirmed.at)&&values(r.confirmed.values,r.count))}
function mutateRoll(base,snapshot,identity,operation,input,now){
 const row=base.parents[input.id],host=identity.role==='dm'&&identity.memberId===identity.hostMemberId
 if(!row||row.roomId!==identity.roomId||row.hostMemberId!==identity.hostMemberId||row.phase!=='answered'||row.answer?.choice!=='present-false-thoughts')return fail(409,'thought-contest-parent-required')
 if(!['owner','reader'].includes(input.role))return fail(400,'thought-contest-role-required')
 if(!versionsMatch(row.versions,snapshot)||!same(original(row,snapshot,identity)?.action,row.originalAction))return fail(409,'thought-reading-original-changed')
 const role=input.role,character=snapshot.characters?.characters?.find(c=>c.id===(role==='owner'?row.ownerCharacterId:row.readerCharacterId)),member=controller(character,identity),prior=row.rollRequests?.[role]
 if(!id(member))return fail(409,'thought-contest-controller-unavailable')
 let request
 if(operation==='issue-roll'){
  if(!host)return fail(403,'thought-reading-host-required')
  if(Object.keys(input).some(k=>!['id','role','mode'].includes(k))||!['normal','advantage','disadvantage'].includes(input.mode))return fail(400,'thought-contest-mode-required')
  request={id:row.id+':'+role,role,tokenId:role==='owner'?row.ownerTokenId:row.readerTokenId,characterId:character.id,controllerMemberId:member,mode:input.mode,count:input.mode==='normal'?1:2,sides:20,issuedAt:now}
  if(prior)return prior.mode===request.mode&&prior.controllerMemberId===member?{ok:true,changed:false,next:base,id:row.id,requestId:prior.id,phase:row.phase}:fail(409,'thought-contest-issue-conflict')
 }else{
  if(!prior||!validRequest(prior,row,role)||prior.controllerMemberId!==member||input.requestId!==prior.id)return fail(409,'thought-contest-issued-roll-required')
  if(Object.keys(input).some(k=>!['id','role','requestId','values'].includes(k))||!values(input.values,prior.count))return fail(400,'thought-contest-raw-dice-required')
  if(operation==='raw'){
   if(identity.memberId!==member)return fail(403,'thought-contest-roller-required')
   if(prior.raw)return same(prior.raw.values,input.values)&&prior.raw.memberId===identity.memberId?{ok:true,changed:false,next:base,id:row.id,requestId:prior.id,phase:row.phase}:fail(409,'thought-contest-raw-locked')
   request={...prior,raw:{memberId:identity.memberId,sourceMode:identity.role,at:now,values:[...input.values]}}
  }else{
   if(!host)return fail(403,'thought-reading-host-required')
   if(!prior.raw)return fail(409,'thought-contest-original-raw-required')
   if(prior.confirmed)return same(prior.confirmed.values,input.values)?{ok:true,changed:false,next:base,id:row.id,requestId:prior.id,phase:row.phase}:fail(409,'thought-contest-confirmation-locked')
   request={...prior,confirmed:{memberId:identity.memberId,at:now,values:[...input.values]}}
  }
 }
 const changed={...row,rollRequests:{...row.rollRequests,[role]:request},revision:row.revision+1},next={...base,parents:{...base.parents,[row.id]:changed}}
 return validMastermindThoughtReadings(next)?{ok:true,changed:true,next,id:row.id,requestId:request.id,phase:row.phase}:fail(400,'invalid-thought-contest-request')
}
export function projectMastermindThoughtRoll(current,snapshot,identity,parentId,requestId){
 if(!validMastermindThoughtReadings(current)||!id(parentId)||!id(requestId))return fail(404,'thought-contest-roll-not-found')
 const row=current.parents[parentId],request=row&&Object.values(row.rollRequests??{}).find(r=>r.id===requestId),host=identity.role==='dm'&&identity.memberId===identity.hostMemberId
 if(!row||row.roomId!==identity.roomId||!request)return fail(404,'thought-contest-roll-not-found')
 const character=snapshot.characters?.characters?.find(c=>c.id===request.characterId),member=controller(character,identity)
 if(!host&&(request.controllerMemberId!==identity.memberId||member!==identity.memberId))return fail(403,'thought-contest-roller-required')
 if(!versionsMatch(row.versions,snapshot)||!same(original(row,snapshot,identity)?.action,row.originalAction))return fail(409,'thought-reading-original-changed')
 return{ok:true,request:{id:request.id,parentId:row.id,mapId:row.mapId,role:request.role,rollerTokenId:request.tokenId,rollerCharacterId:request.characterId,controllerMemberId:request.controllerMemberId,mode:request.mode,count:request.count,sides:request.sides,phase:request.confirmed?'confirmed':request.raw?'dm-confirm':'raw',...(request.raw?{rawValues:[...request.raw.values]}:{}),...(request.confirmed?{confirmedValues:[...request.confirmed.values]}:{})}}
}
