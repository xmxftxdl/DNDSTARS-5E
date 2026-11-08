import{authenticateMastermindOpportunityChoice}from'./mastermind-opportunity-choice-authority.mjs'
import{authenticatedBountifulCollectorDecline}from'./bountiful-opportunity-decision-authority.mjs'
import{bountifulOpportunitySequenceSourceFacts,bountifulOpportunityCollectorContinuationFacts}from'../../shared/bountiful-opportunity-sequence.mjs'
import{bountifulHostPreparedWireSignature}from'../../shared/bountiful-host-operation.mjs'
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const phaseStates=['reaction-declined','no-original-required','original-confirmed-no-BL','bountiful-original-ready']
const ready=row=>!!row&&!row.consumed&&(row.request.nativeLucky?!!row.hostReroll:row.ownerDecisions.some(x=>x.decision==='use')?!!row.hostReroll:row.ownerDecisions.length===row.request.options.length)
const publicCombat=c=>Object.fromEntries(Object.entries(c??{}).filter(([k])=>!['_sync','updatedAt','bountifulOriginalParents','bountifulReadyParents'].includes(k)))
export const currentBountifulCollectorBook=(book,d,clock,equal,digest)=>!book?.collectorBinding||book.collectorBinding.clockRevision===(clock?._sync?.revision??0)&&book.collectorBinding.clockSignature===digest(Object.fromEntries(Object.entries(clock??{}).filter(([k])=>k!=='_sync')))&&equal(book.collectorBinding.combat,publicCombat(d.combat))
function originalChoices(attack){return Object.fromEntries(['tranquilitySave','areaAttackAdvantageReaction','disadvantageNegationChoice','coverAttackRedirect'].filter(k=>attack[k]!==undefined).map(k=>[k,attack[k]]))}
async function stampCompletion(ctx,p,principal,book,parent,group,ports,completedRetry=false){
 const{equal,digest,load,save}=ports,first=group.find(row=>row.identity.occurrence===0)
 if(!first)return true
 if(first.originalAdapterId!=='opportunity-move-sequence'||group.some(row=>!ready(row)))return false
 if(equal(first.continuation,{hostMemberId:principal.memberId,source:p.source,rollCursor:p.rollCursor}))return true
 const previous=bountifulOpportunityCollectorContinuationFacts(first.continuation?.source??first.originalParent),next=bountifulOpportunityCollectorContinuationFacts(p.source)
 // A retry can repair only the latest protected completion. It cannot rewind
 // an already-issued later raw window or replace any existing choice value.
 if(completedRetry&&(!equal(book.collectorSource,p.source)||!previous||!next||previous.rawBook.length>next.rawBook.length||!equal(previous.rawBook,next.rawBook.slice(0,previous.rawBook.length))||Object.entries(previous.attacks).some(([id,attack])=>!next.attacks[id]||Object.entries(attack).some(([key,value])=>key==='damageRolls'&&Array.isArray(value)&&value.length===0?false:!equal(value,next.attacks[id][key])))))return false
 const stamp={roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:parent.id,beforeSignature:digest(first),sourceSignature:digest(p.source),rollCursor:p.rollCursor},key='opportunity-sequence-continuation:'+parent.id+':'+stamp.sourceSignature,old=await load(ctx,key)
 if(old&&!equal(old,stamp)&&(!completedRetry||!equal({...old,beforeSignature:stamp.beforeSignature},stamp)))return false
 if(!old||!equal(old,stamp))await save(ctx,key,stamp)
 return true
}
function settledRows(book,group,actorId){const byId=new Map;for(const row of [...book.prefixSettlementRolls??[],...group.flatMap(x=>x.opportunitySettlementRolls??[])])if(row.spec.phase!=='post-native'&&row.spec.phase!=='movement-hazards'&&(row.spec.opportunityActorId??row.spec.actorId)===actorId)byId.set(row.requestId,row);return[...byId.values()]}
/** Bind every supplied numeric late choice to a confirmed original collector
 * pool. This does not grant an effect; the native resolver still validates it. */
function authenticatedChoices(attack,rows,equal,{preOnly=false}={}){
 if(rows.some(row=>!row.rawValues||!row.values))return false
 const numeric=(value,out=[])=>{if(typeof value==='number')out.push(value);else if(Array.isArray(value))for(const v of value)numeric(v,out);else if(record(value))for(const[k,v]of Object.entries(value))if(!['distanceFeet','dieIndex','targetIndex','occurrence','threshold','dc','amount'].includes(k))numeric(v,out);return out}
 const choices=Object.fromEntries(Object.entries(attack).filter(([key])=>!['d20','d20Second','damageRolls'].includes(key)&&(!preOnly||['tranquilitySave','areaAttackAdvantageReaction','disadvantageNegationChoice','coverAttackRedirect'].includes(key))))
 const supplied=numeric(choices),available=rows.flatMap(row=>row.values),used=new Map
 for(const n of supplied){const count=(used.get(n)??0)+1;if(available.filter(v=>v===n).length<count)return false;used.set(n,count)}
 if(attack.damageRolls.length){const damage=rows.filter(row=>row.spec.rollKind==='damage').flatMap(row=>row.values);if(!equal(attack.damageRolls,damage.slice(0,attack.damageRolls.length)))return false}
 return true
}
/** Exact complete prefix plus this window's independently confirmed raw and
 * concrete prechoices. Used by both first mint and completion, not by JSON flags. */
export function bountifulCollectorSourceMatches(book,wire,parent,{actorId,windowIndex,originalState,mint=false},group,ports){
 const{equal,namespace}=ports,f=bountifulOpportunityCollectorContinuationFacts(wire),windows=book?.collectorWindows??[],window=windows[windowIndex]
 if(!f||f.transactionId!==parent.id||bountifulHostPreparedWireSignature(wire)!==book.preparedSignature||!window||window.actorId!==actorId||window.windowIndex!==windowIndex||window.complete||windows.slice(0,windowIndex).some(row=>!row.complete)||!equal(Object.keys(f.attacks),windows.slice(0,windowIndex+1).map(row=>row.actorId)))return null
 const previous=bountifulOpportunityCollectorContinuationFacts(book.collectorSource)
 if(windowIndex>0&&(!previous||windows.slice(0,windowIndex).some(row=>!equal(previous.attacks[row.actorId],f.attacks[row.actorId]))))return null
 const slots=book.rows.filter(row=>row.windowIndex<=windowIndex).sort((a,b)=>a.windowIndex-b.windowIndex)
 if(!equal(f.rawBook.map(row=>row.actorId),slots.map(row=>row.actorId)))return null
 for(let index=0;index<slots.length;index++){
  const slot=slots[index],raw=f.rawBook[index],ns=namespace(slot.requestId,parent)
  if(!slot.confirmed||!ns||!equal(raw,{actorId:slot.actorId,values:slot.confirmed.values,hostOriginalRollId:slot.requestId,hostOriginalRollIssuerMode:ns.mode,hostOriginalDiceCursor:ns.cursor}))return null
 }
 const attack=f.attacks[actorId];if(!equal(attack.coverAttackRedirect,window.misdirectionWitness?.use))return null
 const slot=slots.find(row=>row.windowIndex===windowIndex),rows=settledRows(book,group,actorId)
 if(mint){if(!slot?.confirmed||attack.damageRolls.length||Object.keys(attack).some(k=>!['d20','d20Second','damageRolls','tranquilitySave','areaAttackAdvantageReaction','disadvantageNegationChoice','coverAttackRedirect'].includes(k)))return null}
 if(originalState==='reaction-declined'){
  if(mint||slot||rows.length||!equal(attack,{reactionDecision:'decline'}))return null
 }else if(originalState==='no-original-required'){
  if(slot||attack.d20!==1||attack.d20Second!==undefined||attack.damageRolls.length||!attack.tranquilitySave||!rows.some(row=>row.spec.rollKind==='saving-throw')||!authenticatedChoices(attack,rows,equal))return null
 }else{
  if(!slot?.confirmed||!equal(attack.d20Second===undefined?[attack.d20]:[attack.d20,attack.d20Second],slot.confirmed.values)||!authenticatedChoices(attack,rows,equal,{preOnly:mint}))return null
 }
 if(originalState==='original-confirmed-no-BL'&&group.some(row=>row.request.actorId===actorId))return null
 if(originalState==='bountiful-original-ready'&&(!group.some(row=>row.request.actorId===actorId)||group.some(row=>!ready(row))))return null
 return{facts:f,attack,originalChoices:originalChoices(attack),mode:window.mode}
}
export async function recordBountifulOpportunityCollector(ctx,p,principal,{d,parent,map,book,key,versions,geometry,clock,...ports}){
 const{save,doc,equal,digest,controller,hostPoolController}=ports,reject=error=>({ok:false,status:403,error})
 if(!currentBountifulCollectorBook(book,d,clock,equal,digest))return reject('opportunity-collector:source-clock-or-combat-changed')
 if(p.phase==='collector-register'){
  const f=bountifulOpportunitySequenceSourceFacts(p.source),r=f?.pending,signature=bountifulHostPreparedWireSignature(p.source),windows=book?.collectorWindows??[]
  if(!f||!signature||!r||!equal(f.action,parent)||!equal(f.input.action,parent)||!equal(f.initialAction,parent)||!equal(r.originalAction,parent)||r.parentId!==parent.id||!equal(f.map,map)||!equal(f.input.map,map)||!equal(f.initialMap,map)||!equal(f.characters,d.characters?.characters)||!equal(f.input.characters,d.characters?.characters)||!equal(f.initialCharacters,d.characters?.characters)||!equal(f.input.initiativeOrder,d.combat.initiativeOrder)||!equal(f.input.turnEconomyByToken,d.combat.dnd5eTurnEconomyByToken)||f.combatId!==parent.combatId||f.round!==parent.round||f.initiativeIndex!==parent.initiativeIndex||!Number.isSafeInteger(f.firstHostNow)||f.firstHostNow<1||!Number.isInteger(r.windowIndex)||r.windowIndex<0||r.windowIndex>=map.tokens.length||!Array.isArray(f.preceding)||f.preceding.length!==r.windowIndex||r.targetTokenId!==parent.actorTokenId||r.actorTokenId===parent.actorTokenId||!['normal','advantage','disadvantage'].includes(r.rollMode)||book&&book.preparedSignature!==signature)return reject('opportunity-collector:actual-native-checkpoint-required')
  const commands=await doc(ctx,'combat-command-receipts'),record=commands?.commands?.find(x=>x.commandId===parent.id),receipt=commands?.receipts?.find(x=>x.commandId===parent.id),command=record?.command,token=map.tokens.find(t=>t.id===parent.actorTokenId)
  if(!record||receipt?.status!=='pending'||record.actionId!==parent.id||record.submittedByMemberId!==parent.roomMemberId||record.submittedByRole!==parent.sourceMode||record.fingerprint!==receipt.fingerprint||command?.type!=='move-token'||command.commandId!==parent.id||command.actorTokenId!==parent.actorTokenId||command.characterId!==parent.characterId||command.mapId!==parent.mapId||command.combatId!==parent.combatId||command.round!==parent.round||command.initiativeIndex!==parent.initiativeIndex||!equal(command.targetPosition,parent.targetPosition)||!equal(command.expectedPosition,{x:token?.x,y:token?.y}))return reject('opportunity-collector:actual-pending-command-required')
  if(!controller(d,parent.mapId,r.actorTokenId,ctx.roomId)&&!hostPoolController(d,parent.mapId,r.actorTokenId))return reject('opportunity-collector:canonical-window-actor-required')
  const prior=bountifulOpportunityCollectorContinuationFacts(book?.collectorSource)
  const precedingChanged=r.windowIndex>0&&(!prior||f.preceding.some((row,i)=>row?.actorTokenId!==windows[i]?.actorId||!equal(row?.rolls,prior.attacks[row?.actorTokenId])))
  if(r.windowIndex>windows.length||windows.slice(0,r.windowIndex).some(w=>!w.complete||book?.postNativeEnabled&&w.originalState!=='reaction-declined'&&w.postNativeComplete!==true)||precedingChanged)return reject('opportunity-collector:completed-preceding-window-required')
  if(book?.movementEnabled&&book.movementSegments?.[r.windowIndex]?.complete!==true)return reject('opportunity-collector:actual-completed-movement-segment-required')
  const before=windows[r.windowIndex];if(before){if(before.complete||before.actorId!==r.actorTokenId||!equal(before.registrationSource,p.source))return reject('opportunity-collector:registered-window-immutable');return{ok:true}}
  const next={...book,schemaVersion:1,roomId:ctx.roomId,hostMemberId:principal.memberId,originalRoomAction:parent,preparedSignature:signature,originalSource:book?.originalSource??p.source,versions,economySignature:JSON.stringify(d.combat.dnd5eTurnEconomyByToken??{}),rows:book?.rows??[],collectorBinding:book?.collectorBinding??{clockRevision:clock?._sync?.revision??0,clockSignature:digest(Object.fromEntries(Object.entries(clock??{}).filter(([k])=>k!=='_sync'))),combat:publicCombat(d.combat)},collectorWindows:[...windows,{actorId:r.actorTokenId,windowIndex:r.windowIndex,complete:false,mode:r.rollMode,registrationSource:p.source}]}
  await save(ctx,key,next);return{ok:true}
 }
 if(!book||!phaseStates.includes(p.originalState)||!Number.isInteger(p.windowIndex)||!Number.isSafeInteger(p.rollCursor)||p.rollCursor<0)return reject('opportunity-collector:registered-completion-required')
 const window=book.collectorWindows?.[p.windowIndex]
 if(!window||window.actorId!==p.actorId)return reject('opportunity-collector:registered-completion-required')
 if(p.originalState==='reaction-declined'&&!await authenticatedBountifulCollectorDecline(ctx,p,book,parent,principal,ports))return reject('opportunity-collector:authenticated-reaction-decline-required')
 const incoming=bountifulOpportunityCollectorContinuationFacts(p.source)?.attacks?.[p.actorId],mm=await authenticateMastermindOpportunityChoice(ctx,{d,parent,book,windowIndex:p.windowIndex,actorId:p.actorId,use:incoming?.coverAttackRedirect},ports)
 if(!mm)return reject('opportunity-collector:authenticated-Misdirection-choice-required')
 const checkedBook=mm.witness?{...book,collectorWindows:book.collectorWindows.map((row,i)=>i===p.windowIndex?{...row,misdirectionWitness:mm.witness}:row)}:book
 const group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id),checked=bountifulCollectorSourceMatches(checkedBook,p.source,parent,p,group,ports)
 if(window.complete){
  if(!equal(window.completion,{source:p.source,originalState:p.originalState,rollCursor:p.rollCursor,...(p.originalState==='reaction-declined'?{decisionInterruptId:p.decisionInterruptId}:{})}))return reject('opportunity-collector:completed-window-immutable')
  if(equal(book.collectorSource,p.source)&&!await stampCompletion(ctx,p,principal,book,parent,group,ports,true))return reject('opportunity-collector:completed-source-cannot-rewind-parent')
  return{ok:true}
 }
 if(!checked||checked.facts.rawBook.some(row=>row.hostOriginalDiceCursor>p.rollCursor)||p.rollCursor<(book.collectorRollCursor??0))return reject('opportunity-collector:authenticated-complete-source-required')
 if(!await stampCompletion(ctx,p,principal,book,parent,group,ports))return reject('opportunity-collector:continuation-stamp-immutable')
 await save(ctx,key,{...checkedBook,collectorSource:p.source,collectorRollCursor:p.rollCursor,collectorWindows:checkedBook.collectorWindows.map((row,i)=>i===p.windowIndex?{...row,complete:true,originalState:p.originalState,...(p.originalState==='reaction-declined'?{decisionInterruptId:p.decisionInterruptId}:{}),originalChoices:checked.originalChoices,mode:checked.mode,rollCursor:p.rollCursor,completion:{source:p.source,originalState:p.originalState,rollCursor:p.rollCursor,...(p.originalState==='reaction-declined'?{decisionInterruptId:p.decisionInterruptId}:{})}}:row)});return{ok:true}
}
