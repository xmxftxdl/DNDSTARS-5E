import{validMastermindSpellWardRetargetProposals}from'./mastermind-spell-ward-retarget-record.mjs'
export{validMastermindSpellWardRetargetProposals}from'./mastermind-spell-ward-retarget-record.mjs'
import{currentMastermindSpellWardRequest}from'./mastermind-spell-ward-pools.mjs'
import{secondChanceCanonicalControllerMemberId}from'./second-chance-controller.mjs'
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0,keys=(v,allowed)=>object(v)&&Object.keys(v).every(key=>allowed.includes(key)),fail=(status,error)=>({ok:false,status,error}),host=(parent,identity)=>identity.role==='dm'&&identity.memberId===parent.hostMemberId&&identity.hostMemberId===parent.hostMemberId
/** Protected actor INPUT history only. Acceptance records the actor's exact
 * proposal; it is never a Native result/geometry/save/World capability. The
 * production Host must qualify the target with the genuine failed-frame issuer
 * before accepting it, and the final Native consumer independently proves that
 * same accepted proposal again. This draft is deliberately not routed yet. */
export function mutateMastermindSpellWardRetargetProposal(parent,window,snapshot,identity,operation,input,now,hash){
 if(!integer(now)||!object(input)||input.parentId!==parent.id||input.windowIndex!==window.index||!id(input.requestId))return fail(400,'spell-ward:closed-retarget-input-required')
 const row=window.wardRequests?.find(value=>value.id===input.requestId)
 if(!row||!validMastermindSpellWardRetargetProposals(parent,row)||!currentMastermindSpellWardRequest(parent,window,row,snapshot,identity,hash)||!row.complete||!row.raw||!row.confirmed||row.bountiful&&!row.bountiful.complete)return fail(409,'spell-ward:actual-pre-attack-retarget-source-required')
 const active=window.phase==='registered'&&window.index===parent.nextWindow&&window.requests.length===0,update=next=>({ok:true,changed:next!==row,window:next===row?window:{...window,wardRequests:window.wardRequests.map(value=>value.id===row.id?next:value)},requestId:row.id}),proposals=row.retargetProposals??[],last=proposals.at(-1),actor=()=>identity.memberId===row.rollerMemberId&&secondChanceCanonicalControllerMemberId(snapshot.characters?.characters?.find(value=>value.id===row.rollerCharacterId),{roomId:identity.roomId,hostMemberId:identity.hostMemberId})===identity.memberId
 if(operation==='ward-outcome-register'){
  if(!keys(input,['parentId','windowIndex','requestId','retargetAvailable','retargetOriginalAvailable'])||input.retargetAvailable!==true||Object.hasOwn(input,'retargetOriginalAvailable')&&input.retargetOriginalAvailable!==true)return fail(400,'spell-ward:closed-retarget-category-required')
  if(!host(parent,identity))return fail(403,'spell-ward:actual-Host-source-required')
  if(input.retargetOriginalAvailable&&(window.index!==0||window.originalTargetId===row.wardTargetTokenId))return fail(409,'spell-ward:prepared-original-retarget-only')
  if(row.outcomePending)return row.retargetAvailable===true&&!!row.retargetOriginalAvailable===!!input.retargetOriginalAvailable?update(row):fail(409,'spell-ward:immutable-actor-options')
  if(!active)return fail(409,'spell-ward:actual-pre-attack-retarget-source-required')
  return update({...row,outcomePending:true,retargetAvailable:true,...(input.retargetOriginalAvailable?{retargetOriginalAvailable:true}:{})})
 }
 if(row.retargetAvailable!==true||!row.outcomePending)return fail(409,'spell-ward:actual-issued-retarget-category-required')
 if(operation==='ward-retarget-propose'){
  if(!keys(input,['parentId','windowIndex','requestId','targetTokenId'])||Object.keys(input).length!==4||!id(input.targetTokenId)||input.targetTokenId===row.wardTargetTokenId)return fail(400,'spell-ward:closed-retarget-proposal-required')
  if(!actor())return fail(403,'spell-ward:actual-caster-controller-required')
  if(row.outcome)return row.outcome.choice==='retarget'&&row.outcome.targetTokenId===input.targetTokenId&&last?.phase==='accepted'?update(row):fail(409,'spell-ward:immutable-actor-choice')
  if(!active)return fail(409,'spell-ward:actual-pre-attack-retarget-source-required')
  if(!snapshot.maps?.maps?.find(value=>value.id===parent.original.mapId)?.tokens?.some(value=>value.id===input.targetTokenId))return fail(409,'spell-ward:current-retarget-token-required')
  if(last?.phase==='pending'&&last.targetTokenId===input.targetTokenId)return update(row)
  if(proposals.length>=128)return fail(409,'spell-ward:bounded-retarget-proposals-required')
  const prior=last?.phase==='pending'?proposals.map(value=>value===last?{...value,phase:'canceled',resolvedAt:now,resolvedByMemberId:identity.memberId}:value):proposals
  return update({...row,retargetProposals:[...prior,{revision:proposals.length+1,targetTokenId:input.targetTokenId,memberId:identity.memberId,submittedAt:now,phase:'pending'}]})
 }
 if(operation==='ward-retarget-accept'||operation==='ward-retarget-reject'){
  if(!keys(input,['parentId','windowIndex','requestId','expectedProposalRevision'])||Object.keys(input).length!==4||!integer(input.expectedProposalRevision)||input.expectedProposalRevision<1)return fail(400,'spell-ward:closed-retarget-qualification-required')
  if(!host(parent,identity))return fail(403,'spell-ward:actual-Host-source-required')
  if(!last||last.revision!==input.expectedProposalRevision)return fail(409,'spell-ward:current-caster-proposal-required')
  const phase=operation==='ward-retarget-accept'?'accepted':'rejected'
  if(last.phase===phase)return update(row)
  if(last.phase!=='pending'||row.outcome)return fail(409,'spell-ward:immutable-retarget-qualification')
  if(!active)return fail(409,'spell-ward:actual-pre-attack-retarget-source-required')
  const next={...row,retargetProposals:proposals.map(value=>value===last?{...value,phase,resolvedAt:now,resolvedByMemberId:identity.memberId}:value)}
  return update(phase==='accepted'?{...next,outcome:{choice:'retarget',targetTokenId:last.targetTokenId,proposalRevision:last.revision,submittedByMemberId:last.memberId,submittedAt:last.submittedAt}}:next)
 }
 if(operation==='ward-outcome'){
  if(!keys(input,['parentId','windowIndex','requestId','choice'])||Object.keys(input).length!==4||!['waste','retarget-original'].includes(input.choice))return fail(400,'spell-ward:closed-actor-choice-required')
  if(!actor())return fail(403,'spell-ward:actual-caster-controller-required')
  if(input.choice==='retarget-original'&&!row.retargetOriginalAvailable)return fail(409,'spell-ward:exact-issued-retarget-option-required')
  if(row.outcome)return row.outcome.choice===input.choice?update(row):fail(409,'spell-ward:immutable-actor-choice')
  if(!active)return fail(409,'spell-ward:actual-pre-attack-retarget-source-required')
  const canceled=last?.phase==='pending'?proposals.map(value=>value===last?{...value,phase:'canceled',resolvedAt:now,resolvedByMemberId:identity.memberId}:value):proposals
  return update({...row,...(proposals.length?{retargetProposals:canceled}:{}),outcome:{choice:input.choice,submittedByMemberId:identity.memberId,submittedAt:now}})
 }
 return fail(400,'spell-ward:unknown-retarget-operation')
}
