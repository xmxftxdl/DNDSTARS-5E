import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const id=value=>typeof value==='string'&&value.length>0&&value.length<=180
const integer=value=>Number.isSafeInteger(value)&&value>=0
export function validActivityDeathParentJournal(value){
 if(!plain(value)||value.schemaVersion!==1||!plain(value.parents)||Object.keys(value.parents).length>128)return false
 return Object.entries(value.parents).every(([key,row])=>plain(row)&&row.schemaVersion===1&&['waiting','consumed'].includes(row.phase)&&(row.phase!=='consumed'||validStageWire(row.completed))&&(row.choice==null||plain(row.choice)&&integer(row.choice.attempt)&&id(row.choice.receiptId)&&id(row.choice.eventId)&&id(row.choice.packageId)&&id(row.choice.activityId)&&(row.choice.decision==null||['use','decline'].includes(row.choice.decision)&&id(row.choice.controllerMemberId)))&&key===row.id&&/^[a-f0-9]{32}$/.test(key)&&['parentTransactionId','mapId','combatId','actorId','targetId','roomId','hostMemberId'].every(name=>id(row[name]))&&integer(row.deathEventIndex)&&plain(row.dependencies)&&Object.keys(row.dependencies).length===5&&['maps','characters','combat','map-geometry','campaign-time'].every(name=>integer(row.dependencies[name]))&&Array.isArray(row.definitions)&&row.definitions.length<=256&&row.definitions.every(pkg=>plain(pkg)&&id(pkg.packageId)&&id(pkg.packageVersion)&&Array.isArray(pkg.activities))&&(row.scParent==null?validOriginalRoomAction(row):validScParent(row))&&(row.continuation==null||validStageWire(row.continuation))&&(row.mapProgress==null||validStageWire(row.mapProgress))&&(row.initiativeRolls==null||validInitiativeRolls(row.initiativeRolls,row))&&validStageWire(row.stage))
}
function validStageWire(wire){
 if(!plain(wire)||wire.schemaVersion!==1||!Array.isArray(wire.nodes)||wire.nodes.length>100000)return false
 const encoded=value=>value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||plain(value)&&Object.keys(value).length===1&&(value.undefined===true||integer(value.ref)&&value.ref<wire.nodes.length)
 return encoded(wire.root)&&wire.nodes.every(node=>plain(node)&&(node.kind==='object'&&Array.isArray(node.entries)&&node.entries.length<=100000&&node.entries.every(row=>Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&encoded(row[1]))&&new Set(node.entries.map(row=>row[0])).size===node.entries.length||(node.kind==='array'||node.kind==='set')&&Array.isArray(node.items)&&node.items.length<=100000&&node.items.every(encoded)||node.kind==='map'&&Array.isArray(node.entries)&&node.entries.length<=100000&&node.entries.every(row=>Array.isArray(row)&&row.length===2&&row.every(encoded))||node.kind==='date'&&typeof node.value==='string'&&Number.isFinite(Date.parse(node.value))))
}

export function isActivityDeathChoice(row){return !!row&&(typeof row.id==='string'&&row.id.startsWith('host-death-choice:')||row.payload?.activityDeathBinding!=null)}
export function validActivityDeathChoice(row){
 const binding=row?.payload?.activityDeathBinding
 return plain(row)&&/^host-death-choice:[a-f0-9]{32}$/.test(row.id)&&row.kind==='plugin-choice'&&plain(binding)&&binding.schemaVersion===1&&Object.keys(binding).length===12&&['parentTransactionId','mapId','combatId','actorId','targetId','eventId','packageId','activityId','actorCharacterId','controllerMemberId'].every(key=>id(binding[key]))&&integer(binding.deathEventIndex)&&binding.mapId===row.mapId&&binding.parentTransactionId===row.transactionId&&row.actorCharId===binding.actorCharacterId&&row.payload.pluginId===binding.packageId&&row.payload.featureId===binding.activityId&&['actor','dm'].includes(row.payload.audience)&&row.payload.defaultOptionId==='wait'&&Array.isArray(row.payload.options)&&JSON.stringify(row.payload.options.map(option=>option.id))===JSON.stringify(['use','decline','wait'])
}
export function activityDeathChoicesUnchanged(before,after,retiredChoiceIds=[]){
 const a=Array.isArray(before?.interrupts)?before.interrupts:[],b=Array.isArray(after?.interrupts)?after.interrupts:[],ids=new Set([...a,...b].filter(isActivityDeathChoice).map(row=>row.id))
 if(!ids.size)return true
 return [...ids].every(id=>{const x=a.filter(row=>row.id===id),y=b.filter(row=>row.id===id);if(retiredChoiceIds.includes(id)&&x.length===1&&y.length===0)return true;return before?.mapId===after?.mapId&&x.length===1&&y.length===1&&JSON.stringify(x[0])===JSON.stringify(y[0])})
}

function validInitiativeRolls(rolls,parent){
 const face=value=>Array.isArray(value)&&value.length===1&&Number.isInteger(value[0])&&value[0]>=1&&value[0]<=20
 return plain(rolls)&&Object.keys(rolls).length<=32&&Object.entries(rolls).every(([key,row])=>plain(row)&&key===row.id&&/^host-death-init:[a-f0-9]{32}$/.test(key)&&row.schemaVersion===1&&typeof row.receiptId==='string'&&row.receiptId.length>0&&row.receiptId.length<=600&&['eventId','packageId','activityId','actorId','targetId','actorCharacterId','controllerMemberId'].every(name=>id(row[name]))&&row.actorId===parent.actorId&&row.targetId===parent.targetId&&row.occurrenceIndex===0&&row.count===1&&row.sides===20&&(row.raw==null||plain(row.raw)&&face(row.raw.values)&&row.raw.sourceMemberId===row.controllerMemberId&&row.raw.recordedByHost===parent.hostMemberId&&integer(row.raw.recordedAt)&&(row.raw.transport==null&&row.raw.authenticatedSubmitterMemberId==null||row.raw.transport==='authenticated-room-member'&&row.raw.authenticatedSubmitterMemberId===row.controllerMemberId))&&(row.confirmed==null||row.raw!=null&&plain(row.confirmed)&&face(row.confirmed.values)&&row.confirmed.confirmedBy===parent.hostMemberId&&integer(row.confirmed.confirmedAt)))
}

/** A member may supply only the one raw D20 of an already Host-issued request.
 * The server supplies identity and time; no private parent/confirmation input. */
export function lockActivityDeathInitiativeRaw(journal,snapshot,identity,payload,now){
 const fail=(status,error)=>({ok:false,status,error})
 if(!plain(payload)||Object.keys(payload).sort().join(',')!=='requestId,rollerTokenId,sides,values'||!/^host-death-init:[a-f0-9]{32}$/.test(payload.requestId)||payload.sides!==20||!Array.isArray(payload.values)||payload.values.length!==1||!Number.isInteger(payload.values[0])||payload.values[0]<1||payload.values[0]>20)return fail(422,'invalid-death-initiative-raw')
 if(!['dm','player'].includes(identity.role)||!validActivityDeathParentJournal(journal))return fail(403,'issued-death-initiative-required')
 const matches=Object.values(journal.parents).filter(row=>row.initiativeRolls?.[payload.requestId])
 if(matches.length!==1)return fail(403,'issued-death-initiative-required')
 const parent=matches[0],roll=parent.initiativeRolls[payload.requestId]
 if(parent.roomId!==identity.roomId||roll.actorId!==payload.rollerTokenId||roll.actorId!==parent.actorId||roll.targetId!==parent.targetId||roll.controllerMemberId!==identity.memberId||parent.choice?.decision!=='use'||parent.choice.controllerMemberId!==identity.memberId||parent.choice.authenticatedSubmitterMemberId!==identity.memberId||parent.choice.transport!=='authenticated-room-member'||parent.choice.acceptedByHost!==parent.hostMemberId)return fail(403,'death-initiative-controller-required')
 if(roll.raw){
  if(roll.raw.transport!=='authenticated-room-member'||roll.raw.authenticatedSubmitterMemberId!==roll.controllerMemberId)return fail(409,'death-initiative-unverified-existing-raw')
  if(JSON.stringify(roll.raw.values)!==JSON.stringify(payload.values)||roll.raw.sourceMemberId!==identity.memberId)return fail(409,'death-initiative-raw-already-locked')
  return {ok:true,changed:false,next:journal}
 }
 if(parent.phase!=='waiting'||roll.confirmed)return fail(409,'death-initiative-parent-not-waiting')
 if(Object.entries(parent.dependencies).some(([name,revision])=>(snapshot[name]?._sync?.revision??0)!==revision))return fail(409,'death-initiative-stale-parent')
 const map=snapshot.maps?.maps?.find(row=>row.id===parent.mapId),actor=map?.tokens?.find(row=>row.id===parent.actorId),character=snapshot.characters?.characters?.find(row=>row.id===roll.actorCharacterId)
 if(!actor||actor.characterId!==roll.actorCharacterId||!character||secondChanceCanonicalControllerMemberId(character,{roomId:identity.roomId,hostMemberId:parent.hostMemberId})!==identity.memberId||identity.role==='dm'&&identity.memberId!==parent.hostMemberId)return fail(403,'death-initiative-controller-required')
 const raw={values:[payload.values[0]],sourceMemberId:identity.memberId,recordedByHost:parent.hostMemberId,recordedAt:now,authenticatedSubmitterMemberId:identity.memberId,transport:'authenticated-room-member'}
 const next={...journal,parents:{...journal.parents,[parent.id]:{...parent,initiativeRolls:{...parent.initiativeRolls,[roll.id]:{...roll,raw}}}}}
 return validActivityDeathParentJournal(next)?{ok:true,changed:true,next}:fail(422,'invalid-death-initiative-parent')
}

const canonical=value=>Array.isArray(value)?value.map(canonical):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
/** Only this journal's issued raw facts are write-once. New parent/request IDs
 * may be appended; they cannot release an old issued raw identity. No implicit
 * expiry/retag/whole-resource deletion authorizes rewriting a physical roll. */
export function activityDeathRawTransitionAllowed(before,after){
 if(before!=null&&!validActivityDeathParentJournal(before))return false
 if(after!=null&&!validActivityDeathParentJournal(after))return false
 for(const parent of Object.values(before?.parents??{}))for(const roll of Object.values(parent.initiativeRolls??{})){
  if(!roll.raw)continue
  const nextParent=after?.parents?.[parent.id],next=nextParent?.initiativeRolls?.[roll.id]
  if(!nextParent||!next)return false
  if(!['id','roomId','hostMemberId','parentTransactionId','mapId','combatId','actorId','targetId','deathEventIndex','scParent'].every(key=>equal(parent[key],nextParent[key])))return false
  if(!['id','schemaVersion','receiptId','eventId','packageId','activityId','actorId','targetId','actorCharacterId','controllerMemberId','occurrenceIndex','count','sides','raw'].every(key=>equal(roll[key],next[key])))return false
 }
 for(const parent of Object.values(before?.parents??{})){
  const next=after?.parents?.[parent.id]
  if(!next||!equal(parent.choice,next.choice)||!['id','roomId','hostMemberId','parentTransactionId','mapId','combatId','actorId','targetId','deathEventIndex','scParent','originalRoomAction','stage','definitions','dependencies'].every(key=>equal(parent[key],next[key]))||parent.phase==='consumed'&&(next.phase!=='consumed'||!equal(parent.completed,next.completed)))return false
 }
 for(const parent of Object.values(after?.parents??{}))if(parent.choice&&!equal(before?.parents?.[parent.id]?.choice,parent.choice))return false
 // Only the authenticated endpoint can mint any raw, including legacy-shaped data.
 for(const parent of Object.values(after?.parents??{}))for(const roll of Object.values(parent.initiativeRolls??{})){
  if(!roll.raw)continue
  if(!equal(before?.parents?.[parent.id]?.initiativeRolls?.[roll.id]?.raw,roll.raw))return false
 }
 return true
}

function validOriginalRoomAction(row){const command=row.originalRoomAction;return plain(command)&&command.id===row.parentTransactionId&&command.mapId===row.mapId&&command.combatId===row.combatId&&['player','dm'].includes(command.sourceMode)&&(command.sourceMode!=='player'||id(command.roomMemberId))}
function validScParent(row){return plain(row.scParent)&&row.scParent.schemaVersion===1&&Object.keys(row.scParent).length===2&&typeof row.scParent.groupIdentity==='string'&&row.scParent.groupIdentity.length>0&&row.scParent.groupIdentity.length<=2000000&&(row.originalRoomAction==null||validOriginalRoomAction(row))}

export function activityDeathAuthenticatedChoice(choice,parent){return plain(choice)&&['use','decline'].includes(choice.decision)&&choice.authenticatedSubmitterMemberId===choice.controllerMemberId&&choice.transport==='authenticated-room-member'&&choice.acceptedByHost===parent.hostMemberId&&integer(choice.acceptedAt)&&id(choice.receiptId)}
export function activityDeathRetiredChoiceIds(journal){return Object.values(journal?.parents??{}).filter(parent=>parent.choice?.authenticatedSubmitterMemberId===parent.choice?.controllerMemberId&&parent.choice?.transport==='authenticated-room-member'&&parent.choice?.acceptedByHost===parent.hostMemberId&&integer(parent.choice?.acceptedAt)).map(parent=>parent.choice.receiptId)}
/** Private first writer: no PC decision comes from a generic Host journal PUT.
 * The row was created pending by Host, answered by the exact authenticated
 * controller and finished without replacing that response. */
export function lockActivityDeathChoice(journal,snapshot,identity,payload,now){
 const fail=(status,error)=>({ok:false,status,error})
 if(!plain(payload)||Object.keys(payload).sort().join(',')!=='parentId,receiptId'||!id(payload.parentId)||!/^host-death-choice:[a-f0-9]{32}$/.test(payload.receiptId))return fail(422,'invalid-death-choice')
 if(identity.role!=='dm'||!validActivityDeathParentJournal(journal))return fail(403,'issued-death-parent-required')
 const parent=journal.parents[payload.parentId]
 if(!parent||parent.roomId!==identity.roomId||parent.hostMemberId!==identity.memberId)return fail(403,'death-choice-host-required')
 if(parent.choice?.decision)return activityDeathAuthenticatedChoice(parent.choice,parent)&&parent.choice.receiptId===payload.receiptId?{ok:true,changed:false,next:journal}:fail(409,'death-choice-already-locked')
 if(parent.choice?.receiptId===payload.receiptId&&parent.choice?.transport==='authenticated-room-member')return{ok:true,changed:false,next:journal}
 if(parent.phase!=='waiting'||Object.entries(parent.dependencies).some(([name,rev])=>(snapshot[name]?._sync?.revision??0)!==rev))return fail(409,'death-choice-stale-parent')
 const rows=(snapshot['combat-interrupts']?.interrupts??[]).filter(row=>row.id===payload.receiptId),row=rows[0],b=row?.payload?.activityDeathBinding
 if(rows.length!==1||!validActivityDeathChoice(row)||row.status!=='done'||!['parentTransactionId','mapId','combatId','actorId','targetId','deathEventIndex'].every(k=>equal(parent[k],b[k])))return fail(409,'death-choice-finished-original-required')
 const map=snapshot.maps?.maps?.find(m=>m.id===parent.mapId),token=map?.tokens?.find(t=>t.id===parent.actorId),character=snapshot.characters?.characters?.find(c=>c.id===b.actorCharacterId),controller=secondChanceCanonicalControllerMemberId(character,{roomId:identity.roomId,hostMemberId:parent.hostMemberId})
 if(!token||token.characterId!==b.actorCharacterId||!character||!controller||controller!==b.controllerMemberId||row.response?.controllerMemberId!==controller||!['use','decline','wait'].includes(row.response.optionId))return fail(403,'death-choice-authenticated-owner-required')
 const attempt=parent.choice?.attempt??0,source={eventId:b.eventId,packageId:b.packageId,activityId:b.activityId}
 const stamp={controllerMemberId:controller,authenticatedSubmitterMemberId:controller,transport:'authenticated-room-member',acceptedByHost:parent.hostMemberId,acceptedAt:now}
 const choice=row.response.optionId==='wait'?{...source,...stamp,attempt:attempt+1,receiptId:row.id}:{...source,...stamp,attempt,receiptId:row.id,decision:row.response.optionId}
 return{ok:true,changed:true,next:{...journal,parents:{...journal.parents,[parent.id]:{...parent,choice}}}}
}
