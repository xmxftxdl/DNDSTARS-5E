import{validMastermindSpellWardRetargetProposals}from'./mastermind-spell-ward-retarget-record.mjs'
import{secondChanceCanonicalControllerMemberId}from'./second-chance-controller.mjs'
import{mastermindExecutionParentId}from'./mastermind-execution-id.mjs'
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0,ordered=v=>Array.isArray(v)?v.map(ordered):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,ordered(x)])):v,same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b)),fail=error=>({ok:false,error})
/** Authenticated input facts only. Callers must supply the actual protected
 * window and canonical snapshot. This issues no Native, raw or World brand. */
export function readMastermindSpellOwnerChain(parent,window,snapshot,identity){
 if(!object(parent)||!id(parent.id)||!id(parent.roomId)||!id(parent.hostMemberId)||!object(window)||!object(parent.original)||!object(parent.original.action)||!mastermindExecutionParentId(parent.original.action.id)||!id(parent.original.mapId)||!id(parent.original.actorTokenId)||!object(parent.source)||!['queued','native'].includes(parent.source.origin)||!object(parent.versions)||Object.keys(parent.versions).length!==5||!['maps','characters','combat','map-geometry','campaign-time'].every(k=>integer(parent.versions[k]))||!Array.isArray(parent.windows)||!object(snapshot)||!Array.isArray(snapshot.maps?.maps)||!Array.isArray(snapshot.characters?.characters)||parent.roomId!==identity?.roomId||parent.hostMemberId!==identity?.hostMemberId||window.index!==parent.windows?.[window.index]?.index||!integer(window.index)||!id(window.originalTargetId))return fail('spell-window-authenticated-owner-original-required')
 const rows=Object.values(snapshot['mastermind-misdirections']?.parents??{}).filter(row=>row?.spellWindowOriginal?.sourceParentId===parent.id&&row.spellWindowOriginal.windowIndex===window.index&&row.spellWindowOriginal.retargetStep===undefined)
 if(rows.length>64)return fail('spell-window-bounded-owner-chain-required')
 if(!rows.length)return{ok:true,rows:[],waiting:false,targetId:window.originalTargetId}
 const roots=rows.filter(row=>row.redirectOriginal===undefined);if(roots.length!==1)return fail('spell-window-ambiguous-owner-original')
 const root=roots[0],map=snapshot.maps.maps.find(m=>m.id===parent.original.mapId),characters=snapshot.characters.characters,visited=new Set(),owners=new Set(),actual=[],uses=[];if(!Array.isArray(map?.tokens)||parent.source.origin==='native'&&(!object(root.nativeOriginal)||root.nativeOriginal.family!=='spell-attack'||root.nativeOriginal.sourceId!==parent.original.action.id||root.nativeOriginal.spellId!==parent.original.spellId||root.nativeOriginal.combatId!==parent.original.combatId||root.nativeOriginal.occurrence!==window.index))return fail('spell-window-authenticated-owner-original-required');let row=root,targetId=window.originalTargetId,previousId
 for(let depth=0;depth<64;depth++){
  const token=map?.tokens?.find(t=>t.id===targetId&&t.type!=='obstacle'),owner=characters.find(c=>c.id===token?.characterId),member=secondChanceCanonicalControllerMemberId(owner,{roomId:identity.roomId,hostMemberId:identity.hostMemberId}),rogue=owner?.dnd5eClassLevels?.rogue??(owner?.charClass==='游荡者'?owner.level:0)
  if(!row||!id(row.id)||visited.has(row.id)||owners.has(targetId)||!owner||!id(member)||!integer(rogue)||rogue<13||!id(owner.dnd5eClassChoices?.classes?.rogue?.subclass)||row.roomId!==parent.roomId||row.hostMemberId!==parent.hostMemberId||row.parentTransactionId!==parent.original.action.id||row.mapId!==parent.original.mapId||row.attackerTokenId!==parent.original.actorTokenId||row.ownerTokenId!==targetId||row.ownerCharacterId!==owner.id||row.ownerMemberId!==member||!same(row.versions,parent.versions)||!id(row.featureId)||!same(row.spellWindowOriginal,{schemaVersion:1,family:'spell-window',sourceParentId:parent.id,windowIndex:window.index}))return fail('spell-window-authenticated-owner-original-required')
  if(parent.source.origin==='queued'?(row.nativeOriginal!==undefined||!same(row.originalAction,parent.original.action)):(row.originalAction!==undefined||!same(row.nativeOriginal,root.nativeOriginal)))return fail('spell-window-authenticated-owner-original-required')
  if(previousId===undefined?row.redirectOriginal!==undefined:!same(row.redirectOriginal,{schemaVersion:1,rootParentId:root.id,previousParentId:previousId}))return fail('spell-window-actual-causal-owner-required')
  visited.add(row.id);owners.add(targetId);actual.push(row);const children=rows.filter(next=>next.redirectOriginal?.rootParentId===root.id&&next.redirectOriginal.previousParentId===row.id)
  if(row.phase==='waiting'){
   if(row.revision!==1||row.answer!==undefined||children.length||visited.size!==rows.length)return fail('spell-window-unvisited-owner-chain-required')
   return{ok:true,rows:actual,waiting:true,targetId,...compiled(uses)}
  }
  if(row.phase!=='answered'||row.revision!==2||!row.answer||row.answer.submittedByMemberId!==member)return fail('spell-window-authenticated-owner-answer-required')
  if(row.answer.choice==='decline'){
   if(children.length||visited.size!==rows.length)return fail('spell-window-unvisited-owner-chain-required')
   return{ok:true,rows:actual,waiting:false,targetId,...compiled(uses)}
  }
  if(!Array.isArray(row.replacementTokenIds)||!row.replacementTokenIds.includes(row.answer.choice)||!id(row.answer.choice)||!map.tokens.some(t=>t.id===row.answer.choice&&t.type!=='obstacle'))return fail('spell-window-exact-owner-choice-required')
  uses.push({featureId:row.featureId,originalTargetId:targetId,replacementTargetId:row.answer.choice});targetId=row.answer.choice
  if(!children.length){if(visited.size!==rows.length)return fail('spell-window-unvisited-owner-chain-required');return{ok:true,rows:actual,waiting:false,targetId,...compiled(uses)}}
  if(children.length!==1)return fail('spell-window-ambiguous-owner-original');previousId=row.id;row=children[0]
 }
 return fail('spell-window-bounded-owner-chain-required')
}
function compiled(uses){let use;for(let i=uses.length-1;i>=0;i--)use={...uses[i],...(use?{next:use}:{})};return use?{coverAttackRedirect:use}:{}}

/** Protected causal input projection only. A positive step cannot be supplied
 * as an alternative original target: its sole root is the exact completed
 * previous Ward and the actual caster's accepted target proposal. No Native,
 * geometry, source provider, reaction or publication capability is minted. */
export function readMastermindSpellOwnerChainAtRetargetTarget(parent,window,snapshot,identity,step){
 if(!integer(step)||step<1||step>128||!object(parent)||!object(window)||!Array.isArray(window.wardRequests)||!window.wardRequests.length||window.wardRequests.length>64||step>window.wardRequests.length||!window.wardRequests.every((row,index)=>object(row)&&(index===0?!Object.hasOwn(row,'retargetStep'):row.retargetStep===index)))return fail('spell-window-actual-retarget-prefix-required')
 const previous=step===1?readMastermindSpellOwnerChain(parent,window,snapshot,identity):readMastermindSpellOwnerChainAtRetargetTarget(parent,window,snapshot,identity,step-1),ward=window.wardRequests[step-1]
 if(!previous.ok||previous.waiting||!validMastermindSpellWardRetargetProposals(parent,ward)||!ward.complete||!ward.raw||!ward.confirmed||ward.bountiful&&!ward.bountiful.complete||ward.wardTargetTokenId!==previous.targetId||ward.outcome?.choice!=='retarget'||!ward.retargetAvailable)return fail('spell-window-authenticated-caster-retarget-required')
 const targetId=ward.outcome.targetTokenId,journal=snapshot['mastermind-misdirections']??{parents:{}},rows=Object.values(journal.parents??{}).filter(row=>row?.spellWindowOriginal?.sourceParentId===parent.id&&row.spellWindowOriginal.windowIndex===window.index&&row.spellWindowOriginal.retargetStep===step)
 if(rows.length>64||!id(targetId))return fail('spell-window-bounded-next-owner-chain-required')
 const projectedWindow={...window,originalTargetId:targetId},projectedParent={...parent,windows:parent.windows.map(value=>value.index===window.index?projectedWindow:value)},projectedJournal={...journal,parents:Object.fromEntries(rows.map(row=>{const{retargetStep:_,...scope}=row.spellWindowOriginal;return[row.id,{...row,spellWindowOriginal:scope}]}))},read=readMastermindSpellOwnerChain(projectedParent,projectedWindow,{...snapshot,'mastermind-misdirections':projectedJournal},identity)
 if(!read.ok)return read
 return{...read,rows:read.rows.map(row=>journal.parents[row.id]),retargetStep:step,initialTargetId:targetId,previousWardRequestId:ward.id,proposalRevision:ward.outcome.proposalRevision}
}
