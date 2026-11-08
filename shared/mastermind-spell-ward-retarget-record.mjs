const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0,keys=(v,allowed)=>object(v)&&Object.keys(v).every(key=>allowed.includes(key))
export function validMastermindSpellWardRetargetProposals(parent,row){
 if(!object(parent)||!object(row))return false
 if(row.retargetAvailable===undefined&&row.retargetProposals===undefined)return row.outcome?.choice!=='retarget'
 if(row.retargetAvailable!==true||row.outcomePending!==true||!row.complete||!row.raw||!row.confirmed)return false
 if(row.outcome!==undefined){
  const outcome=row.outcome,isRetarget=outcome?.choice==='retarget'
  if(!keys(outcome,isRetarget?['choice','targetTokenId','proposalRevision','submittedByMemberId','submittedAt']:['choice','submittedByMemberId','submittedAt'])||Object.keys(outcome).length!==(isRetarget?5:3)||outcome.submittedByMemberId!==row.rollerMemberId||!integer(outcome.submittedAt)||(!isRetarget&&!['waste','retarget-original'].includes(outcome.choice))||outcome.choice==='retarget-original'&&row.retargetOriginalAvailable!==true||isRetarget&&(!id(outcome.targetTokenId)||!integer(outcome.proposalRevision)||outcome.proposalRevision<1))return false
 }
 const proposals=row.retargetProposals??[]
 if(!Array.isArray(proposals)||proposals.length>128)return false
 for(let index=0;index<proposals.length;index++){
  const proposal=proposals[index]
  if(!keys(proposal,['revision','targetTokenId','memberId','submittedAt','phase','resolvedAt','resolvedByMemberId'])||proposal.revision!==index+1||!id(proposal.targetTokenId)||proposal.targetTokenId===row.wardTargetTokenId||proposal.memberId!==row.rollerMemberId||!integer(proposal.submittedAt)||!['pending','rejected','accepted','canceled'].includes(proposal.phase))return false
  if(proposal.phase==='pending'){
   if(index!==proposals.length-1||proposal.resolvedAt!==undefined||proposal.resolvedByMemberId!==undefined||row.outcome!==undefined)return false
  }else{
   if(!integer(proposal.resolvedAt)||proposal.resolvedByMemberId!==(proposal.phase==='canceled'?row.rollerMemberId:parent.hostMemberId))return false
   if(proposal.phase==='accepted'&&(index!==proposals.length-1||!row.outcome||row.outcome.choice!=='retarget'||row.outcome.proposalRevision!==proposal.revision||row.outcome.targetTokenId!==proposal.targetTokenId||row.outcome.submittedByMemberId!==proposal.memberId||row.outcome.submittedAt!==proposal.submittedAt))return false
  }
 }
 if(row.outcome?.choice==='retarget'&&proposals.at(-1)?.phase!=='accepted')return false
 return true
}
