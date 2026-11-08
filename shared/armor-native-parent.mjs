import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x),id=x=>typeof x==='string'&&x.length>0&&x.length<=180,integer=x=>Number.isSafeInteger(x)&&x>=0
const face=x=>Array.isArray(x)&&x.length===1&&Number.isInteger(x[0])&&x[0]>=1&&x[0]<=6
const canonical=x=>Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
/** A bounded parser allowance for one real PC parent with all three private
 * continuations. This grants no authority: every normal journal, original ACK,
 * read-version and paired-publication check still runs under the room lock. */
export function armorNativeExtendedScAtomicEnvelope(writes,transactionId){
 if(!Array.isArray(writes)||![9,10].includes(writes.length)||typeof transactionId!=='string'||!transactionId.startsWith('second-chance-parent:'))return false
 const parent=transactionId.slice('second-chance-parent:'.length),required=['characters','maps','combat','armor-native-parents','activity-death-parents','sc-base-prefix-rolls','player-action-requests','player-action-processed','player-action-ack'],names=writes.map(w=>w?.name)
 if(!id(parent)||new Set(names).size!==names.length||required.some(name=>!names.includes(name))||names.some(name=>!required.includes(name)&&name!=='map-geometry'))return false
 const data=name=>writes.find(w=>w.name===name)?.data,armor=data('armor-native-parents'),combat=data('combat'),ack=data('player-action-ack'),queue=data('player-action-requests'),processed=data('player-action-processed')
 if(!validArmorNativeParentJournal(armor)||!object(combat)||!object(combat.secondChanceAttacks)||!object(ack)||ack.actionId!==parent||ack.status!=='accepted'||!id(ack.recipientMemberId)||!Array.isArray(queue?.requests)||queue.requests.some(r=>r.id===parent)||!Array.isArray(processed?.actionIds)||!processed.actionIds.includes(parent))return false
 const rows=Object.values(armor.parents).filter(p=>p.parentTransactionId===parent&&p.phase==='consumed'&&p.decision==='decline'&&p.ownerChoice?.decision==='decline'&&p.ownerChoice?.authenticatedSubmitterMemberId===p.controllerMemberId&&p.ownerChoice?.transport==='authenticated-room-member'&&p.originalRoomAction?.id===parent&&p.originalRoomAction?.roomMemberId===ack.recipientMemberId)
 if(rows.length!==1)return false
 const original=rows[0],matches=p=>object(p)&&p.parentTransactionId===parent&&p.mapId===original.mapId&&p.combatId===original.combatId&&p.phase==='consumed',geometry=writes.find(w=>w.name==='map-geometry');let completed;try{completed=armorCompletedJson(original.completed)}catch{return false}
 if(geometry&&(!completed?.application?.geometry||!same(geometry.data,completed.application.geometry)||geometry.expectedRevision!==original.dependencies['map-geometry']))return false
 return combat.mapId===original.mapId&&combat.combatId===original.combatId&&Object.values(combat.secondChanceAttacks).some(r=>r?.attack?.transactionId===parent&&r.parentContinuation?.phase==='consumed')&&object(data('activity-death-parents')?.parents)&&Object.values(data('activity-death-parents').parents).some(matches)&&object(data('sc-base-prefix-rolls')?.parents)&&Object.values(data('sc-base-prefix-rolls').parents).some(matches)
}
export function validArmorNativeParentJournal(journal){
 return object(journal)&&journal.schemaVersion===1&&object(journal.parents)&&Object.keys(journal.parents).length<=128&&Object.entries(journal.parents).every(([key,p])=>object(p)&&key===p.id&&/^[a-f0-9]{32}$/.test(key)&&p.schemaVersion===1&&['waiting','consumed'].includes(p.phase)&&(p.phase!=='consumed'||object(p.completed)&&p.completed.schemaVersion===1&&Array.isArray(p.completed.nodes))&&['roomId','hostMemberId','parentTransactionId','mapId','combatId','actorId','targetId','targetCharacterId','controllerMemberId','featureId'].every(k=>id(p[k]))&&integer(p.occurrence)&&object(p.dependencies)&&Object.keys(p.dependencies).length===5&&['maps','characters','combat','map-geometry','campaign-time'].every(k=>integer(p.dependencies[k]))&&object(p.prepared)&&object(p.attackFacts)&&p.attackFacts.event?.actorId===p.actorId&&p.attackFacts.event?.targetId===p.targetId&&p.attackFacts.event?.hit===true&&/^host-armor-d6:[a-f0-9]{32}$/.test(p.requestId)&&['pending','use','decline'].includes(p.decision)&&(p.raw==null||p.decision==='use'&&object(p.raw)&&face(p.raw.values)&&p.raw.sourceMemberId===p.controllerMemberId&&p.raw.authenticatedSubmitterMemberId===p.controllerMemberId&&p.raw.transport==='authenticated-room-member'&&p.raw.recordedByHost===p.hostMemberId&&integer(p.raw.recordedAt))&&(p.confirmed==null||p.raw!=null&&object(p.confirmed)&&face(p.confirmed.values)&&p.confirmed.confirmedBy===p.hostMemberId&&integer(p.confirmed.confirmedAt)))
}
export function armorNativeRawTransitionAllowed(before,after,allowConsumed=false){
 if(before!=null&&!validArmorNativeParentJournal(before)||after!=null&&!validArmorNativeParentJournal(after))return false
 for(const p of Object.values(before?.parents??{})){
  if(!p.raw&&!p.ownerChoice)continue
  const n=after?.parents?.[p.id];if(!n||p.phase==='consumed'&&(n.phase!=='consumed'||!same(n.completed,p.completed)))return false
  for(const key of['id','roomId','hostMemberId','parentTransactionId','mapId','combatId','actorId','targetId','targetCharacterId','controllerMemberId','featureId','occurrence','requestId','prepared','attackFacts','dependencies','definitions','originalRoomAction','ownerChoice','decision','raw'])if(!same(p[key],n[key]))return false
 }
 for(const p of Object.values(after?.parents??{})){const old=before?.parents?.[p.id];if(p.phase==='consumed'&&old?.phase!=='consumed'&&!allowConsumed)return false;if(p.raw&&!same(old?.raw,p.raw)||p.ownerChoice&&!same(old?.ownerChoice,p.ownerChoice)||p.decision!=='pending'&&old?.decision!==p.decision)return false}
 return true
}
/** The room HTTP adapter supplies authenticated identity, canonical current
 * resources and server time. Neither raw nor a result is accepted from a DM PUT. */
export function lockArmorNativeRaw(journal,snapshot,identity,payload,now){
 const fail=(status,error)=>({ok:false,status,error})
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='requestId,rollerTokenId,sides,values'||!/^host-armor-d6:[a-f0-9]{32}$/.test(payload.requestId)||payload.sides!==6||!face(payload.values))return fail(422,'invalid-armor-native-raw')
 if(!['dm','player'].includes(identity.role)||!validArmorNativeParentJournal(journal))return fail(403,'issued-armor-native-required')
 const matches=Object.values(journal.parents).filter(p=>p.requestId===payload.requestId)
 if(matches.length!==1)return fail(403,'issued-armor-native-required')
 const p=matches[0]
 if(p.roomId!==identity.roomId||p.controllerMemberId!==identity.memberId||p.targetId!==payload.rollerTokenId||p.decision!=='use'||p.ownerChoice?.decision!=='use'||p.ownerChoice?.authenticatedSubmitterMemberId!==identity.memberId||p.ownerChoice?.transport!=='authenticated-room-member')return fail(403,'armor-native-controller-required')
 if(p.raw)return same(p.raw.values,payload.values)?{ok:true,changed:false,next:journal}:fail(409,'armor-native-raw-already-locked')
 if(p.phase!=='waiting'||p.confirmed)return fail(409,'armor-native-parent-not-waiting')
 if(Object.entries(p.dependencies).some(([name,rev])=>(snapshot[name]?._sync?.revision??0)!==rev))return fail(409,'armor-native-stale-parent')
 const map=snapshot.maps?.maps?.find(m=>m.id===p.mapId),token=map?.tokens?.find(t=>t.id===p.targetId),character=snapshot.characters?.characters?.find(c=>c.id===p.targetCharacterId)
 if(!token||token.characterId!==p.targetCharacterId||!character||secondChanceCanonicalControllerMemberId(character,{roomId:identity.roomId,hostMemberId:p.hostMemberId})!==identity.memberId||identity.role==='dm'&&identity.memberId!==p.hostMemberId)return fail(403,'armor-native-controller-required')
 const raw={values:[payload.values[0]],sourceMemberId:identity.memberId,authenticatedSubmitterMemberId:identity.memberId,transport:'authenticated-room-member',recordedByHost:p.hostMemberId,recordedAt:now}
 const next={...journal,parents:{...journal.parents,[p.id]:{...p,raw}}}
 return validArmorNativeParentJournal(next)?{ok:true,changed:true,next}:fail(422,'invalid-armor-native-parent')
}

/** Only the authenticated current target controller can opt into this original
 * hit occurrence. A Host metadata PUT never supplies a player's choice. */
export function lockArmorNativeDecision(journal,snapshot,identity,payload,now){
 const fail=(status,error)=>({ok:false,status,error})
 if(!object(payload)||Object.keys(payload).sort().join(',')!=='decision,parentId,rollerTokenId'||!id(payload.parentId)||!['use','decline'].includes(payload.decision))return fail(422,'invalid-armor-native-decision')
 if(!['dm','player'].includes(identity.role)||!validArmorNativeParentJournal(journal))return fail(403,'issued-armor-native-required')
 const p=journal.parents[payload.parentId]
 if(!p||p.roomId!==identity.roomId||p.controllerMemberId!==identity.memberId||p.targetId!==payload.rollerTokenId||identity.role==='dm'&&identity.memberId!==p.hostMemberId)return fail(403,'armor-native-controller-required')
 if(p.ownerChoice)return p.ownerChoice.authenticatedSubmitterMemberId===identity.memberId&&p.ownerChoice.decision===payload.decision?{ok:true,changed:false,next:journal}:fail(409,'armor-native-decision-already-locked')
 if(p.phase!=='waiting'||p.decision!=='pending'||p.raw||p.confirmed)return fail(409,'armor-native-parent-not-waiting')
 if(Object.entries(p.dependencies).some(([name,rev])=>(snapshot[name]?._sync?.revision??0)!==rev))return fail(409,'armor-native-stale-parent')
 const map=snapshot.maps?.maps?.find(m=>m.id===p.mapId),token=map?.tokens?.find(t=>t.id===p.targetId),character=snapshot.characters?.characters?.find(c=>c.id===p.targetCharacterId)
 if(!token||token.characterId!==p.targetCharacterId||!character||secondChanceCanonicalControllerMemberId(character,{roomId:identity.roomId,hostMemberId:p.hostMemberId})!==identity.memberId)return fail(403,'armor-native-controller-required')
 const ownerChoice={decision:payload.decision,authenticatedSubmitterMemberId:identity.memberId,transport:'authenticated-room-member',recordedAt:now}
 const next={...journal,parents:{...journal.parents,[p.id]:{...p,decision:payload.decision,ownerChoice}}}
 return validArmorNativeParentJournal(next)?{ok:true,changed:true,next}:fail(422,'invalid-armor-native-parent')
}

export function isArmorNativeChoice(row){return !!row&&(typeof row.id==='string'&&row.id.startsWith('host-armor-choice:')||row.payload?.armorNativeBinding!=null)}
export function validArmorNativeChoice(row){
 const b=row?.payload?.armorNativeBinding
 return object(row)&&/^host-armor-choice:[a-f0-9]{32}:[0-9]{1,4}$/.test(row.id)&&row.kind==='plugin-choice'&&object(b)&&b.schemaVersion===1&&Object.keys(b).length===11&&['parentId','parentTransactionId','mapId','combatId','actorId','targetId','targetCharacterId','controllerMemberId','featureId'].every(k=>id(b[k]))&&integer(b.occurrence)&&row.id.startsWith('host-armor-choice:'+b.parentId+':')&&row.transactionId===b.parentTransactionId&&row.mapId===b.mapId&&row.actorCharId===b.targetCharacterId&&row.payload.featureId===b.featureId&&['actor','dm'].includes(row.payload.audience)&&row.payload.defaultOptionId==='wait'&&Array.isArray(row.payload.options)&&same(row.payload.options.map(o=>o.id),['use','decline','wait'])
}
export function armorNativeChoicesUnchanged(before,after){
 const a=before?.interrupts??[],b=after?.interrupts??[],ids=new Set([...a,...b].filter(isArmorNativeChoice).map(row=>row.id))
 return (!ids.size||before?.mapId===after?.mapId)&&[...ids].every(id=>{const x=a.filter(row=>row.id===id),y=b.filter(row=>row.id===id);return x.length===1&&y.length===1&&same(x[0],y[0])})
}
export function armorNativeChoiceBinding(parent){return Object.fromEntries(['schemaVersion','parentTransactionId','mapId','combatId','actorId','targetId','targetCharacterId','controllerMemberId','featureId','occurrence'].map(k=>[k,parent[k]]).concat([['parentId',parent.id]]))}
/** The Host may collect only a server-authenticated, finished original-owner
 * answer. Its own member token never stands in for a PC's decision. */
export function lockArmorNativeDecisionFromChoice(journal,snapshot,identity,payload,now){
 const fail=(status,error)=>({ok:false,status,error})
 if(!object(payload)||Object.keys(payload).join(',')!=='parentId'||!id(payload.parentId))return fail(422,'invalid-armor-native-choice-parent')
 if(identity.role!=='dm'||!validArmorNativeParentJournal(journal))return fail(403,'issued-armor-native-required')
 const p=journal.parents[payload.parentId]
 if(!p||p.roomId!==identity.roomId||p.hostMemberId!==identity.memberId)return fail(403,'armor-native-host-required')
 if(p.ownerChoice)return{ok:true,changed:false,next:journal}
 const receiptId='host-armor-choice:'+p.id+':'+(p.choiceAttempt??0),rows=(snapshot['combat-interrupts']?.interrupts??[]).filter(row=>row.id===receiptId),row=rows[0]
 if(rows.length!==1||!validArmorNativeChoice(row)||row.status!=='done'||!same(row.payload.armorNativeBinding,armorNativeChoiceBinding(p))||row.response?.controllerMemberId!==p.controllerMemberId)return fail(409,'armor-native-owner-answer-required')
 if(row.response.optionId==='wait'){
  if(p.phase!=='waiting'||p.decision!=='pending'||Object.entries(p.dependencies).some(([name,rev])=>(snapshot[name]?._sync?.revision??0)!==rev))return fail(409,'armor-native-stale-parent')
  return{ok:true,changed:true,next:{...journal,parents:{...journal.parents,[p.id]:{...p,choiceAttempt:(p.choiceAttempt??0)+1}}}}
 }
 const result=lockArmorNativeDecision(journal,snapshot,{roomId:identity.roomId,memberId:p.controllerMemberId,role:p.controllerMemberId===p.hostMemberId?'dm':'player'},{parentId:p.id,rollerTokenId:p.targetId,decision:row.response.optionId},now)
 if(!result.ok||!result.changed)return result
 result.next.parents[p.id].ownerChoice.choiceReceiptId=receiptId
 return result
}

function armorCompletedJson(wire){
 if(!object(wire)||wire.schemaVersion!==1||!Array.isArray(wire.nodes)||wire.nodes.length>100000)throw Error('invalid-armor-completion')
 const values=wire.nodes.map(n=>n.kind==='object'?Object.create(null):n.kind==='array'?[]:n.kind==='set'?new Set():n.kind==='map'?new Map():n.kind==='date'?new Date(n.value):undefined)
 const decode=v=>{if(v===null||typeof v==='boolean'||typeof v==='string'||typeof v==='number'&&Number.isFinite(v))return v;if(object(v)&&Object.keys(v).length===1&&v.undefined===true)return undefined;if(object(v)&&Object.keys(v).length===1&&Number.isSafeInteger(v.ref)&&v.ref>=0&&v.ref<values.length)return values[v.ref];throw Error('invalid-armor-completion')}
 for(let i=0;i<wire.nodes.length;i++){const n=wire.nodes[i],value=values[i];if(n.kind==='object'){if(!Array.isArray(n.entries))throw Error('invalid-armor-completion');for(const [k,v]of n.entries){if(typeof k!=='string')throw Error('invalid-armor-completion');value[k]=decode(v)}}else if(n.kind==='array')value.push(...n.items.map(decode));else if(n.kind==='set')for(const x of n.items)value.add(decode(x));else if(n.kind==='map')for(const[k,v]of n.entries)value.set(decode(k),decode(v));else if(n.kind!=='date')throw Error('invalid-armor-completion')}
 return JSON.parse(JSON.stringify(decode(wire.root)))
}
/** A prior authenticated Armor decline belongs to this same SC original parent.
 * Retiring SC must consume that record in the same real final transaction.
 * Parents which never issued Armor keep their existing publication contract. */
export function armorNativeScReverseConsumptionAllowed(journal,current,incoming,writes=[],transactionId,originalWorld={}){
 if(journal==null)return true
 if(!validArmorNativeParentJournal(journal))return false
 if(!object(current)||!object(incoming)||current.mapId!==incoming.mapId||current.combatId!==incoming.combatId||!object(current.secondChanceAttacks)||!object(incoming.secondChanceAttacks))return true
 for(const p of Object.values(journal.parents)){
  if(p.phase!=='waiting'||p.decision!=='decline'||p.ownerChoice?.decision!=='decline'||p.mapId!==current.mapId||p.combatId!==current.combatId)continue
  const group=Object.values(current.secondChanceAttacks).filter(r=>r?.attack?.transactionId===p.parentTransactionId&&same(r.parentInput?.prepared,p.prepared))
  if(!group.some(r=>r.parentContinuation?.phase!=='consumed'&&incoming.secondChanceAttacks[r.attack.id]?.parentContinuation?.phase==='consumed'))continue
  const armorWrites=writes.filter(w=>w.name==='armor-native-parents'),combatWrites=writes.filter(w=>w.name==='combat'),mapWrites=writes.filter(w=>w.name==='maps'),charWrites=writes.filter(w=>w.name==='characters')
  if(transactionId!=='second-chance-parent:'+p.parentTransactionId||armorWrites.length!==1||combatWrites.length!==1||mapWrites.length!==1||charWrites.length!==1||!same(combatWrites[0].data,incoming)||combatWrites[0].expectedRevision!==current._sync?.revision||mapWrites[0].expectedRevision!==p.dependencies.maps||charWrites[0].expectedRevision!==p.dependencies.characters+group.filter(r=>r.committed).length||originalWorld['map-geometry']!==p.dependencies['map-geometry']||originalWorld['campaign-time']!==p.dependencies['campaign-time'])return false
  const next=armorWrites[0].data,n=next?.parents?.[p.id];if(!armorNativeRawTransitionAllowed(journal,next,true)||n?.phase!=='consumed')return false
  const deathJournal=originalWorld.activityDeathParents,deathRows=Object.values(deathJournal?.parents??{}).filter(row=>row.parentTransactionId===p.parentTransactionId&&row.mapId===p.mapId&&row.combatId===p.combatId&&row.scParent)
  if(deathRows.length){
   const deathWrites=writes.filter(w=>w.name==='activity-death-parents');if(deathWrites.length!==1||deathWrites[0].expectedRevision!==deathJournal._sync?.revision)return false
   for(const row of deathRows){const retiring=deathWrites[0].data?.parents?.[row.id];let bound,done;try{bound=JSON.parse(row.scParent.groupIdentity);done=armorCompletedJson(retiring?.completed)}catch{return false}
    if(row.phase!=='waiting'||!same(bound,group)||retiring?.phase!=='consumed'||done?.origin!=='second-chance'||done.scGroupIdentity!==row.scParent.groupIdentity||!group.every(r=>same(done.settlement?.result,incoming.secondChanceAttacks[r.attack.id]?.parentContinuation?.result)))return false
   }
  }
  let completed;try{completed=armorCompletedJson(n.completed)}catch{return false}
  for(const r of group){const after=incoming.secondChanceAttacks[r.attack.id];if(r.parentContinuation?.phase!=='ready'||after?.parentContinuation?.phase!=='consumed'||after.attack.phase!=='damage-committed'||!after.parentContinuation.result?.ok||!same(completed?.result,after.parentContinuation.result))return false}
 }
 return true
}

/** Forward obligation: no generic metadata publication can manufacture a
 * completed Armor parent. The exact original result/map/roster are one CAS. */
export function armorNativeConsumptionPaired(before,after,currentCombat,writes,transactionId,world){
 if(!validArmorNativeParentJournal(before)||!validArmorNativeParentJournal(after))return false
 const retiring=Object.values(after.parents).filter(p=>p.phase==='consumed'&&before.parents[p.id]?.phase!=='consumed')
 if(!retiring.length||retiring.some(p=>!before.parents[p.id]))return false
 const mapWrites=writes.filter(w=>w.name==='maps'),charWrites=writes.filter(w=>w.name==='characters'),combatWrites=writes.filter(w=>w.name==='combat'),armorWrites=writes.filter(w=>w.name==='armor-native-parents')
 if(mapWrites.length!==1||charWrites.length!==1||combatWrites.length!==1||armorWrites.length!==1||armorWrites[0].expectedRevision!==before._sync?.revision||!same(armorWrites[0].data,after))return false
 for(const n of retiring){
  const p=before.parents[n.id],choice=p.ownerChoice
  if(p.phase!=='waiting'||choice?.decision!==p.decision||choice.authenticatedSubmitterMemberId!==p.controllerMemberId||choice.transport!=='authenticated-room-member'||!['use','decline'].includes(p.decision)||p.decision==='use'&&(!p.raw||!p.confirmed))return false
  let completed;try{completed=armorCompletedJson(n.completed)}catch{return false}
  if(!completed?.result?.ok||completed.result.state?.combatId!==p.combatId||completed.application?.map?.id!==p.mapId||!Array.isArray(completed.application.characters)||!same(charWrites[0].data?.characters,completed.application.characters)||!same(mapWrites[0].data?.maps?.find(m=>m.id===p.mapId),completed.application.map)||combatWrites[0].data?.mapId!==p.mapId||combatWrites[0].data?.combatId!==p.combatId)return false
  if(transactionId==='second-chance-parent:'+p.parentTransactionId){
   const group=Object.values(currentCombat?.secondChanceAttacks??{}).filter(r=>r.attack?.transactionId===p.parentTransactionId&&same(r.parentInput?.prepared,p.prepared))
   if(!group.length||!armorNativeScReverseConsumptionAllowed(before,currentCombat,combatWrites[0].data,writes,transactionId,world))return false
  }else if(transactionId==='armor-native-publish:'+p.id){
   if(currentCombat?.mapId!==p.mapId||currentCombat?.combatId!==p.combatId||combatWrites[0].expectedRevision!==p.dependencies.combat||mapWrites[0].expectedRevision!==p.dependencies.maps||charWrites[0].expectedRevision!==p.dependencies.characters||world['map-geometry']!==p.dependencies['map-geometry']||world['campaign-time']!==p.dependencies['campaign-time'])return false
  }else return false
  if(completed.application.geometry){const geometry=writes.filter(w=>w.name==='map-geometry');if(geometry.length!==1||geometry[0].expectedRevision!==p.dependencies['map-geometry']||!same(geometry[0].data,completed.application.geometry))return false}
  if(p.originalRoomAction?.sourceMode==='player'){
   const action=p.originalRoomAction,ack=writes.filter(w=>w.name==='player-action-ack'),processed=writes.filter(w=>w.name==='player-action-processed'),queue=writes.filter(w=>w.name==='player-action-requests')
   if(!action.roomMemberId||ack.length!==1||processed.length!==1||queue.length!==1||ack[0].data?.actionId!==action.id||ack[0].data?.status!=='accepted'||ack[0].data?.recipientMemberId!==action.roomMemberId||!processed[0].data?.actionIds?.includes(action.id)||!Array.isArray(queue[0].data?.requests)||queue[0].data.requests.some(row=>row.id===action.id))return false
  }
 }
 return armorNativeRawTransitionAllowed(before,after,true)
}
