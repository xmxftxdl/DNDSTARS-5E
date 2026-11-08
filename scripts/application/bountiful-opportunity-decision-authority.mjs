import{bountifulOpportunitySequenceSourceFacts}from'../../shared/bountiful-opportunity-sequence.mjs'
import{currentBountifulCollectorBook}from'./bountiful-opportunity-collector-authority.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const immutable=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['status','response','updatedAt'].includes(key)))
/** Only the real authenticated interrupt mutation can mint this private fact.
 * Generic resource writes never pass this port. A completion additionally
 * checks the current persisted interrupt against the issued immutable row. */
export async function recordBountifulCollectorDecisionMutation(ctx,{queue,mutation,result,now},principal,ports){
 const {load,save,doc,context,nativeParent,controller,hostPoolController,equal,digest}=ports
 const prior=queue?.interrupts?.find(row=>row.id===mutation.id),incoming=mutation.operation==='upsert'?result?.next?.interrupts?.find(row=>row.id===mutation.interrupt?.id):prior,binding=incoming?.payload?.opportunitySequenceDecision
 if(!binding)return{ok:true}
 const reject=error=>({ok:false,status:403,error})
 if(!result?.ok||!object(binding)||Object.keys(binding).length!==3||!binding.parentId||!binding.actorId||!Number.isInteger(binding.windowIndex)||binding.windowIndex<0||incoming.kind!=='opportunity-attack')return reject('opportunity-decision:actual-collector-interrupt-required')
 const d=await context(ctx),parent=nativeParent(d,incoming.mapId,d.combat?.combatId,binding.parentId),book=await load(ctx,'opportunity-sequence:'+binding.parentId),window=book?.collectorWindows?.[binding.windowIndex],source=bountifulOpportunitySequenceSourceFacts(window?.registrationSource),clock=await doc(ctx,'campaign-time'),geometry=await doc(ctx,'map-geometry')
 if(!parent||!window||window.actorId!==binding.actorId||window.complete||book.hostMemberId!==principal.hostMemberId||book.roomId!==ctx.roomId||!equal(book.originalRoomAction,parent)||!equal(book.versions,{characters:d.characters?._sync?.revision??0,maps:d.maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0})||book.economySignature!==JSON.stringify(d.combat.dnd5eTurnEconomyByToken??{})||!currentBountifulCollectorBook(book,d,clock,equal,digest)||source?.pending?.mandatory===true||source?.pending?.attack?.mandatory===true||source?.pending?.actorTokenId!==binding.actorId||source.pending.windowIndex!==binding.windowIndex||source.pending.targetTokenId!==parent.actorTokenId||incoming.transactionId!==parent.id||incoming.payload.attackerTokenId!==binding.actorId||incoming.payload.targetTokenId!==parent.actorTokenId||incoming.payload.trigger!=='movement')return reject('opportunity-decision:current-registered-window-required')
 const owned=controller(d,parent.mapId,binding.actorId,ctx.roomId)??hostPoolController(d,parent.mapId,binding.actorId),member=owned?.character?.roomMemberId??principal.hostMemberId
 if(!owned||incoming.actorCharId!==(owned.character?.id??undefined)||!member)return reject('opportunity-decision:canonical-window-owner-required')
 const key='opportunity-decision:'+incoming.id,old=await load(ctx,key),base={roomId:ctx.roomId,hostMemberId:principal.hostMemberId,parentId:parent.id,actorId:binding.actorId,targetId:parent.actorTokenId,windowIndex:binding.windowIndex,controllerMemberId:member,preparedSignature:book.preparedSignature,registrationSignature:digest(window.registrationSource),interrupt:immutable(incoming)}
 if(mutation.operation==='upsert'){
  if(principal.role!=='dm'||principal.memberId!==principal.hostMemberId||incoming.status!=='pending'||incoming.response!==undefined||!Number.isFinite(incoming.expiresAt)||incoming.expiresAt<=now||incoming.expiresAt>now+60000)return reject('opportunity-decision:Host-issued-live-window-required')
  if(old&&!equal(Object.fromEntries(Object.entries(old).filter(([key])=>!['issuedAt','answer','timeoutAt'].includes(key))),base))return reject('opportunity-decision:issued-window-immutable')
  if(!old)await save(ctx,key,{...base,issuedAt:now});return{ok:true}
 }
 if(!old||!equal(Object.fromEntries(Object.entries(old).filter(([key])=>!['issuedAt','answer','timeoutAt'].includes(key))),base))return reject('opportunity-decision:authenticated-issued-window-required')
 if(mutation.operation==='answer'){
  if(principal.memberId!==member||!['dm','player'].includes(principal.role)||!object(mutation.response)||Object.keys(mutation.response).length!==1||typeof mutation.response.useOpportunityAttack!=='boolean'||old.timeoutAt!==undefined)return reject('opportunity-decision:actual-owner-answer-required')
  const answer={memberId:principal.memberId,role:principal.role,useOpportunityAttack:mutation.response.useOpportunityAttack}
  if(old.answer&&!equal(old.answer,answer))return reject('opportunity-decision:answer-immutable')
  if(!old.answer)await save(ctx,key,{...old,answer});return{ok:true}
 }
 if(mutation.operation==='finish'){
  if(principal.role!=='dm'||principal.memberId!==principal.hostMemberId)return reject('opportunity-decision:Host-finish-required')
  const response=mutation.response??incoming.response
  if(old.answer&&!equal(response,{useOpportunityAttack:old.answer.useOpportunityAttack}))return reject('opportunity-decision:authenticated-answer-required')
  if(!old.answer){if(incoming.response!==undefined||mutation.response!==undefined&& !equal(mutation.response,{useOpportunityAttack:false})||incoming.expiresAt>now)return reject('opportunity-decision:real-unanswered-deadline-required');if(old.timeoutAt===undefined)await save(ctx,key,{...old,timeoutAt:now})}
  return{ok:true}
 }
 return reject('opportunity-decision:unsupported-collector-transition')
}
export async function authenticatedBountifulCollectorDecline(ctx,p,book,parent,principal,ports){
 const{load,doc,equal,digest}=ports,window=book.collectorWindows?.[p.windowIndex],witness=typeof p.decisionInterruptId==='string'&&await load(ctx,'opportunity-decision:'+p.decisionInterruptId),queue=await doc(ctx,'combat-interrupts'),row=queue?.interrupts?.find(row=>row.id===p.decisionInterruptId)
 return !!witness&&!!window&&queue?.mapId===parent.mapId&&row?.status==='done'&&row.kind==='opportunity-attack'&&witness.roomId===ctx.roomId&&witness.hostMemberId===principal.memberId&&witness.parentId===parent.id&&witness.actorId===p.actorId&&witness.targetId===parent.actorTokenId&&witness.windowIndex===p.windowIndex&&witness.preparedSignature===book.preparedSignature&&witness.registrationSignature===digest(window.registrationSource)&&equal(immutable(row),witness.interrupt)&&equal(row.response,{useOpportunityAttack:false})&&(witness.answer?.useOpportunityAttack===false||witness.timeoutAt!==undefined)
}
