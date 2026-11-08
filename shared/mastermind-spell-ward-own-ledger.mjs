import{readMastermindSpellWindowSource,validMastermindSpellWindows}from'./mastermind-spell-windows.mjs'
import{currentMastermindSpellWardRequest}from'./mastermind-spell-ward-pools.mjs'
import{validSpellWardBountiful,validSpellWardBountifulContinuations,spellWardBountifulPhase}from'./mastermind-spell-ward-bountiful.mjs'
import{mutateSpellWardOwn,recordSpellWardOwnInterrupt,spellWardOwnChoiceId}from'./mastermind-spell-ward-own.mjs'
const fail=(status,error)=>({ok:false,status,error})
function read(value,snapshot,identity,parentId,hash){
 const source=readMastermindSpellWindowSource(value,snapshot,{...identity,role:'dm',memberId:identity.hostMemberId},parentId,hash)
 return source.ok?value.parents[parentId]:undefined
}
function decoded(row,parent){return(book,occurrence)=>{
 const expected=occurrence===0?row.bountiful:row.bountifulContinuations?.find(entry=>entry.occurrence===occurrence)?.book;if(!validSpellWardBountifulContinuations(row.bountifulContinuations,row,parent)||book!==expected||!validSpellWardBountiful(book,row,parent)||!['ready','declined'].includes(spellWardBountifulPhase(book)))return
 const used=book.decisions.find(d=>d.decision==='use'),{complete,...input}=book
 return{ready:true,request:book.request,input,...(used?{choice:{ownerId:used.ownerId,featureId:used.featureId,replacement:book.confirmed.values[0]}}:{})}
}}
function finish(value,parent,window,row,extra={}){
 const changed=row!==window.wardRequests.find(r=>r.id===row.id),p=changed?{...parent,windows:parent.windows.map(w=>w.index===window.index?{...window,wardRequests:window.wardRequests.map(r=>r.id===row.id?row:r)}:w)}:parent,next=changed?{...value,parents:{...value.parents,[parent.id]:p}}:value
 return validMastermindSpellWindows(next)?{ok:true,changed,next,parentId:parent.id,firstHostNow:parent.issuedAt,...extra}:fail(409,'spell-ward-own:invalid-protected-ledger')
}
export function mutateMastermindSpellWardOwn(value,snapshot,identity,operation,input,now,hash){
 if(!input||typeof input!=='object'||Array.isArray(input)||!['dm','player'].includes(identity?.role)||!identity.memberId||!identity.hostMemberId)return fail(403,'spell-ward-own:actual-room-member-required')
 const parent=read(value,snapshot,identity,input.parentId,hash),window=parent?.windows[input.windowIndex],row=window?.wardRequests?.find(r=>r.id===input.requestId)
 if(!parent||!Number.isSafeInteger(input.windowIndex)||!row||!currentMastermindSpellWardRequest(parent,window,row,snapshot,identity,hash))return fail(409,'spell-ward-own:current-canonical-original-required')
 if(operation==='ward-own-register'&&(window.phase!=='registered'||window.index!==parent.nextWindow||window.requests.length||row.outcomePending))return fail(409,'spell-ward-own:pre-attack-checkpoint-required')
 const result=mutateSpellWardOwn(parent,row,snapshot,identity,operation,input,now,hash,decoded(row,parent))
 return result.ok?finish(value,parent,window,result.row,{own:result.own,...(result.pending?{pending:true}:{})}):result
}
export function recordMastermindSpellWardOwnInterrupt(value,snapshot,identity,mutation,result,now,hash){
 const id=String(mutation?.interrupt?.id??mutation?.id??'');if(!id.startsWith('mm-spell-ward-own-choice:'))return{ok:true,changed:false,next:value}
 if(!validMastermindSpellWindows(value))return fail(403,'spell-ward-own:actual-protected-ledger-required')
 const candidates=[];for(const p of Object.values(value.parents))for(const w of p.windows)for(const r of w.wardRequests??[])if(r.own?.entries.some(e=>spellWardOwnChoiceId(e)===id))candidates.push({p,w,r})
 if(candidates.length!==1)return fail(403,'spell-ward-own:unique-issued-choice-required')
 const{p,w,r}=candidates[0],parent=read(value,snapshot,identity,p.id,hash)
 if(!parent||!currentMastermindSpellWardRequest(parent,w,r,snapshot,identity,hash))return fail(403,'spell-ward-own:current-canonical-original-required')
 const next=recordSpellWardOwnInterrupt(parent,r,snapshot,identity,mutation,result,now,hash,decoded(r,parent))
 return next.ok?finish(value,parent,w,next.row):next
}
