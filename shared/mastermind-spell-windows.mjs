import{mutateMastermindSpellWardRetargetProposal}from'./mastermind-spell-ward-retarget-proposals.mjs'
import{currentMastermindSpellWardRequest,validMastermindSpellWardRequests,mutateMastermindSpellWardWindow,projectMastermindSpellWardRequest,projectMastermindSpellWardBountifulRequest,mastermindSpellWardInputs}from'./mastermind-spell-ward-pools.mjs'
import{readMastermindSpellOwnerChain,readMastermindSpellOwnerChainAtRetargetTarget}from'./mastermind-spell-owner-chain.mjs'
import{validMastermindSpellTargetExtras}from'./mastermind-spell-target-input.mjs'
import{mastermindExecutionParentId}from'./mastermind-execution-id.mjs'
import{secondChanceCanonicalControllerMemberId}from'./second-chance-controller.mjs'

// Authenticated input ledger only. Nothing here issues native, Base, target,
// reaction or world-publication authority. Those remain genuine native frames.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v)
const integer=v=>Number.isSafeInteger(v)&&v>=0
const keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k))
const ordered=v=>Array.isArray(v)?v.map(ordered):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,ordered(x)])):v
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
const names=['maps','characters','combat','map-geometry','campaign-time']
const revision=v=>v==null?0:integer(v?._sync?.revision)?v._sync.revision:undefined
const fail=(status,error)=>({ok:false,status,error})
const controller=(c,i)=>secondChanceCanonicalControllerMemberId(c,{roomId:i.roomId,hostMemberId:i.hostMemberId})
const host=i=>i?.role==='dm'&&id(i.memberId)&&i.memberId===i.hostMemberId
const versions=(v,s)=>object(v)&&Object.keys(v).length===5&&names.every(n=>integer(v[n])&&v[n]===revision(s[n]))
const worldSignature=(s,hash)=>hash(JSON.stringify(ordered(Object.fromEntries(names.map(n=>[n,s[n]??null])))))
const targetList=v=>Array.isArray(v)&&v.length>0&&v.length<=128&&v.every(id)
function castSelection(v){return keys(v,['spellId','slotLevel','targetTokenId','targetTokenIds','ritual','castingClassId','itemInstanceId','itemUseActionId','focusItemInstanceId','racialInnate','projectileTargetIds'])&&id(v.spellId)&&integer(v.slotLevel)&&v.slotLevel<=9&&id(v.targetTokenId)&&targetList(v.projectileTargetIds)&&v.projectileTargetIds[0]===v.targetTokenId&&(v.targetTokenIds===undefined||targetList(v.targetTokenIds)&&v.targetTokenIds[0]===v.targetTokenId&&same([...new Set(v.targetTokenIds)].sort(),[...new Set(v.projectileTargetIds)].sort()))&&(v.ritual===undefined||v.ritual===false)&&['castingClassId','itemInstanceId','itemUseActionId','focusItemInstanceId'].every(k=>v[k]===undefined||id(v[k]))&&(v.racialInnate===undefined||typeof v.racialInnate==='boolean')}
function canonicalSource(input,snapshot,identity){
 const combat=snapshot.combat;if(!combat||combat.active!==true||combat.flowPause||!id(combat.combatId))return
 let action,nativeIntent
 if(keys(input,['origin','actionId'])&&input.origin==='queued'&&mastermindExecutionParentId(input.actionId)){
  action=snapshot['player-action-requests']?.requests?.find(a=>a.id===input.actionId)
  if(!action||action.type!=='dnd5e-spell-cast'||action.status!=='pending'||action.sourceMode!=='player'||!id(action.roomMemberId)||!castSelection(action.dnd5eSpellCast))return
 }else if(keys(input,['origin','parentTransactionId','mapId','actorTokenId','spellCast'])&&input.origin==='native'&&mastermindExecutionParentId(input.parentTransactionId)&&id(input.mapId)&&id(input.actorTokenId)&&castSelection(input.spellCast)){
  if(snapshot['player-action-requests']?.requests?.some(a=>a.id===input.parentTransactionId))return
  nativeIntent=structuredClone(input);action={id:input.parentTransactionId,mapId:input.mapId,combatId:combat.combatId,actorTokenId:input.actorTokenId,type:'dnd5e-spell-cast',sourceMode:'dm',status:'pending',dnd5eSpellCast:structuredClone(input.spellCast),round:combat.round,initiativeIndex:combat.initiativeIndex}
 }else return
 const map=snapshot.maps?.maps?.find(m=>m.id===action.mapId),token=map?.tokens?.find(t=>t.id===action.actorTokenId&&t.type!=='obstacle'),character=snapshot.characters?.characters?.find(c=>c.id===token?.characterId),member=controller(character,identity)
 if(!map||!token||!character||!id(member)||map.id!==combat.mapId||action.combatId!==combat.combatId||action.round!==combat.round||action.initiativeIndex!==combat.initiativeIndex||combat.initiativeOrder?.[combat.initiativeIndex]?.tokenId!==token.id)return
 if(nativeIntent?member!==identity.hostMemberId:action.characterId!==character.id||action.roomMemberId!==member)return
 const processed=snapshot['player-action-processed'],ack=snapshot['player-action-ack'];if(!Object.hasOwn(snapshot,'player-action-processed')||!Object.hasOwn(snapshot,'player-action-ack')||processed?.mapId===action.mapId&&processed?.combatId===action.combatId&&Array.isArray(processed.actionIds)&&processed.actionIds.includes(action.id)||ack?.mapId===action.mapId&&ack?.combatId===action.combatId&&ack.actionId===action.id&&['accepted','rejected'].includes(ack.status))return
 const cast=action.dnd5eSpellCast;if(!cast.projectileTargetIds.every(target=>map.tokens.some(t=>t.id===target&&t.type!=='obstacle'))||action.targetTokenId!==undefined&&action.targetTokenId!==cast.targetTokenId)return
 return{action,nativeIntent,actorTokenId:token.id,actorCharacterId:character.id,actorMemberId:member,mapId:map.id,combatId:combat.combatId,targets:[...cast.projectileTargetIds],spellId:cast.spellId}
}
function current(parent,snapshot,identity,hash){
 if(parent.roomId!==identity.roomId||parent.hostMemberId!==identity.hostMemberId||!versions(parent.versions,snapshot)||parent.worldSignature!==worldSignature(snapshot,hash)||parent.queueRevision!==revision(snapshot['player-action-requests']))return
 const source=canonicalSource(parent.source,snapshot,identity);return source&&same(source,parent.original)?source:undefined
}
export function validMastermindSpellWindows(value){return object(value)&&value.schemaVersion===1&&object(value.parents)&&Object.keys(value.parents).length<=512&&Object.entries(value.parents).every(([key,p])=>object(p)&&key===p.id&&id(p.id)&&id(p.roomId)&&id(p.hostMemberId)&&object(p.original)&&object(p.source)&&typeof p.recipeSignature==='string'&&p.recipeSignature.length>=2&&p.recipeSignature.length<=200000&&object(p.versions)&&typeof p.worldSignature==='string'&&p.worldSignature.length===64&&integer(p.queueRevision)&&integer(p.issuedAt)&&integer(p.nextWindow)&&Array.isArray(p.windows)&&p.windows.length<=128&&p.windows.every((w,i)=>object(w)&&w.index===i&&id(w.originalTargetId)&&['registered','complete'].includes(w.phase)&&validMastermindSpellWardRequests(p,w)&&Array.isArray(w.requests)&&w.requests.length<=64&&w.requests.every(r=>object(r)&&id(r.id)&&r.windowIndex===i&&['attack','damage'].includes(r.kind)&&integer(r.ordinal)&&id(r.rollerTokenId)&&id(r.rollerCharacterId)&&id(r.rollerMemberId)&&integer(r.count)&&r.count>=1&&r.count<=100&&integer(r.sides)&&r.sides>=2&&r.sides<=1000&&(r.raw===undefined||object(r.raw)&&r.raw.memberId===r.rollerMemberId&&values(r.raw.values,r))&&(r.confirmed===undefined||r.raw&&object(r.confirmed)&&r.confirmed.memberId===p.hostMemberId&&values(r.confirmed.values,r))))) }
const values=(v,r)=>Array.isArray(v)&&v.length===r.count&&v.every(x=>Number.isInteger(x)&&x>=1&&x<=r.sides)
function windowChoice(parent,window,snapshot,identity){
 const chain=readMastermindSpellOwnerChain(parent,window,snapshot,identity);if(!chain.ok)return{error:chain.error};if(chain.waiting)return{error:'spell-window-owner-choice-pending'};const positive=Object.values(snapshot['mastermind-misdirections']?.parents??{}).filter(row=>row?.spellWindowOriginal?.sourceParentId===parent.id&&row.spellWindowOriginal.windowIndex===window.index&&row.spellWindowOriginal.retargetStep!==undefined);for(const step of [...new Set(positive.map(row=>row.spellWindowOriginal.retargetStep))].sort((a,b)=>a-b)){const next=readMastermindSpellOwnerChainAtRetargetTarget(parent,window,snapshot,identity,step);if(!next.ok)return{error:next.error};if(next.waiting)return{error:'spell-window-owner-choice-pending'}}return{targetId:chain.targetId,...(chain.coverAttackRedirect?{coverAttackRedirect:chain.coverAttackRedirect}:{})}
}
function lookup(base,input,allowBountifulOccurrence=false){if(!keys(input,['parentId','windowIndex','kind','count','sides','mode','ordinal','requestId','rollerTokenId','values','extras','wardEffectId','retargetStep','retargetOriginalAvailable','choice','request','featureSources','ownerId','featureId','decision','retargetAvailable','targetTokenId','expectedProposalRevision',...(allowBountifulOccurrence?['occurrence']:[])])||!id(input.parentId))return;return base.parents[input.parentId]}
function finish(base,parent,changed,extra={}){const next=changed?{...base,parents:{...base.parents,[parent.id]:parent}}:base;return validMastermindSpellWindows(next)?{ok:true,changed,next,parentId:parent.id,firstHostNow:parent.issuedAt,...extra}:fail(409,'invalid-spell-window-ledger')}
export function mutateMastermindSpellWindows(currentValue,snapshot,identity,operation,input,now,hash){
 if(!object(input)||!id(identity?.roomId)||!id(identity?.hostMemberId)||!id(identity?.memberId)||!['dm','player'].includes(identity.role)||!integer(now)||typeof hash!=='function')return fail(403,'spell-window-member-required')
 const base=currentValue??{schemaVersion:1,parents:{}};if(!validMastermindSpellWindows(base))return fail(409,'invalid-spell-window-ledger')
 if(operation==='begin'){
  if(!host(identity))return fail(403,'spell-window-Host-required')
  if(!keys(input,['source','versions','recipeSignature'])||typeof input.recipeSignature!=='string'||input.recipeSignature.length<2||input.recipeSignature.length>200000||!object(input.source)||!versions(input.versions,snapshot))return fail(400,'spell-window-canonical-source-required')
  const original=canonicalSource(input.source,snapshot,identity);if(!original)return fail(409,'spell-window-original-changed')
  const parentId='mm-spell-window:'+hash(JSON.stringify([identity.roomId,original.action.id,original.mapId,original.combatId])),old=base.parents[parentId],row={id:parentId,roomId:identity.roomId,hostMemberId:identity.hostMemberId,source:structuredClone(input.source),recipeSignature:input.recipeSignature,original:structuredClone(original),versions:{...input.versions},queueRevision:revision(snapshot['player-action-requests']),worldSignature:worldSignature(snapshot,hash),issuedAt:old?.issuedAt??now,nextWindow:0,windows:[]}
  if(old){if(!same({...old,windows:[],nextWindow:0},row)||!current(old,snapshot,identity,hash))return fail(409,'spell-window-original-conflict');return finish(base,old,false)}return finish(base,row,true)
 }
 const parent=lookup(base,input,operation.startsWith('ward-bountiful-'));if(!parent||!current(parent,snapshot,identity,hash))return fail(409,'spell-window-original-changed')
 if(operation==='register'){
  if(!host(identity))return fail(403,'spell-window-Host-required')
  if(!keys(input,['parentId','windowIndex'])||!integer(input.windowIndex)||input.windowIndex>=parent.original.targets.length||input.windowIndex>parent.nextWindow)return fail(409,'spell-window-order-required')
  const prior=parent.windows[input.windowIndex];if(prior)return finish(base,parent,false,{windowIndex:prior.index,complete:prior.phase==='complete'})
  if(input.windowIndex!==parent.nextWindow||parent.windows.length!==input.windowIndex)return fail(409,'spell-window-order-required')
  return finish(base,{...parent,windows:[...parent.windows,{index:input.windowIndex,originalTargetId:parent.original.targets[input.windowIndex],phase:'registered',requests:[]}]},true,{windowIndex:input.windowIndex})
 }
 const window=parent.windows[input.windowIndex];if(!window||!integer(input.windowIndex))return fail(409,'spell-window-issued-window-required')
 if(['ward-retarget-propose','ward-retarget-accept','ward-retarget-reject'].includes(operation)||operation==='ward-outcome-register'&&Object.hasOwn(input,'retargetAvailable')||operation==='ward-outcome'&&window.wardRequests?.some(row=>row.id===input.requestId&&row.retargetAvailable===true)){const found=mutateMastermindSpellWardRetargetProposal(parent,window,snapshot,identity,operation,input,now,hash);if(!found.ok)return found;return finish(base,{...parent,windows:parent.windows.map(w=>w.index===window.index?found.window:w)},found.changed,{requestId:found.requestId})}
 if(operation.startsWith('ward-bountiful-')||['ward-register','ward-complete','ward-outcome-register','ward-outcome'].includes(operation)||typeof input.requestId==='string'&&input.requestId.startsWith('mm-spell-ward-pool:')){const found=mutateMastermindSpellWardWindow(parent,window,snapshot,identity,operation,input,now,hash);if(!found.ok)return found;return finish(base,{...parent,windows:parent.windows.map(w=>w.index===window.index?found.window:w)},found.changed,{requestId:found.requestId,...(found.choice?{choice:found.choice}:{})})}
 if(operation==='issue'){
  const choice=windowChoice(parent,window,snapshot,identity);if(choice.error)return fail(409,choice.error)
  if(!host(identity))return fail(403,'spell-window-Host-required')
  if(!keys(input,['parentId','windowIndex','kind','count','sides','mode','ordinal'])||window.phase!=='registered'||input.windowIndex!==parent.nextWindow||!integer(input.ordinal)||!['attack','damage'].includes(input.kind)||!integer(input.count)||input.count<1||input.count>100||!integer(input.sides)||input.sides<2||input.sides>1000)return fail(400,'spell-window-exact-pool-required')
  if(window.wardRequests?.some(row=>row.outcomePending&&row.outcome?.choice!=='retarget-original'&&row.outcome?.choice!=='retarget'))return fail(409,'spell-ward:actor-outcome-original-forbidden');
  if((window.wardRequests??[]).length){const saved=mastermindSpellWardInputs(parent,window,snapshot,identity,hash);if(!saved.ok)return saved}
  const existing=window.requests[input.ordinal];if(existing)return existing.kind===input.kind&&existing.count===input.count&&existing.sides===input.sides&&existing.mode===input.mode?finish(base,parent,false,{requestId:existing.id}):fail(409,'spell-window-exact-issued-pool-required')
  if(input.ordinal!==window.requests.length)return fail(409,'spell-window-pool-order-required')
  if(input.kind==='attack'?(window.requests.length!==0||input.sides!==20||!['normal','advantage','disadvantage'].includes(input.mode)||input.count!==(input.mode==='normal'?1:2)):(input.mode!==undefined||!window.requests.length||window.requests.some(r=>!r.confirmed)))return fail(409,'spell-window-pool-order-required')
  const ordinal=window.requests.length,idValue='mm-spell-pool:'+hash(JSON.stringify([parent.id,window.index,ordinal,input.kind,input.count,input.sides,input.mode??null])),request={id:idValue,windowIndex:window.index,ordinal,kind:input.kind,count:input.count,sides:input.sides,...(input.mode?{mode:input.mode}:{}),rollerTokenId:parent.original.actorTokenId,rollerCharacterId:parent.original.actorCharacterId,rollerMemberId:parent.original.actorMemberId,issuedAt:now},nextWindow={...window,requests:[...window.requests,request]};return finish(base,{...parent,windows:parent.windows.map(w=>w.index===window.index?nextWindow:w)},true,{requestId:idValue})
 }
 if(operation==='raw'||operation==='confirm'){
  if(!keys(input,['parentId','windowIndex','requestId','rollerTokenId','values']))return fail(400,'spell-window-exact-pool-required')
  const r=window.requests.find(r=>r.id===input.requestId);if(!r||input.rollerTokenId!==r.rollerTokenId||!values(input.values,r))return fail(409,'spell-window-exact-issued-pool-required')
  if(operation==='raw'?(identity.memberId!==r.rollerMemberId||controller(snapshot.characters.characters.find(c=>c.id===r.rollerCharacterId),identity)!==identity.memberId):!host(identity))return fail(403,'spell-window-real-controller-required')
  const existing=operation==='raw'?r.raw:r.confirmed;if(existing)return same(existing.values,input.values)?finish(base,parent,false,{requestId:r.id}):fail(409,'spell-window-pool-locked')
  if(window.phase!=='registered'||operation==='confirm'&&!r.raw)return fail(409,'spell-window-raw-required')
  const nextRequest={...r,[operation==='raw'?'raw':'confirmed']:{values:[...input.values],memberId:identity.memberId,recordedAt:now}},nextWindow={...window,requests:window.requests.map(row=>row.id===r.id?nextRequest:row)};return finish(base,{...parent,windows:parent.windows.map(w=>w.index===window.index?nextWindow:w)},true,{requestId:r.id})
 }
 if(operation==='complete'){
  if(!host(identity))return fail(403,'spell-window-Host-required')
  if(!keys(input,['parentId','windowIndex','extras']))return fail(400,'spell-window-input-not-result-required')
  if(window.phase==='complete')return input.extras!==undefined&&!same(input.extras,window.extras??{})?fail(409,'spell-window-complete-input-locked'):finish(base,parent,false,{windowIndex:window.index,complete:true})
  if(window.wardRequests?.some(row=>row.outcome?.choice==='waste')){
   if(window.index!==parent.nextWindow||window.requests.length||(window.wardRequests.length!==1&&!(window.wardRequests.length===2&&window.wardRequests[1].retargetStep===1&&window.wardRequests[0].outcome?.choice==='retarget'&&window.wardRequests[1].outcome?.choice==='waste'))||input.extras!==undefined&&(!object(input.extras)||Object.keys(input.extras).length))return fail(409,'spell-ward:exact-no-original-waste-required');
   const row=window.wardRequests.find(row=>row.outcome?.choice==='waste'),saved=mastermindSpellWardInputs(parent,window,snapshot,identity,hash),choice=windowChoice(parent,window,snapshot,identity);if(!saved.ok)return saved;if(choice.error||row.outcome?.choice!=='waste'||row.outcome.submittedByMemberId!==parent.original.actorMemberId)return fail(409,'spell-ward:actual-caster-waste-required');
   const compiled={targetId:choice.targetId,...(choice.coverAttackRedirect?{coverAttackRedirect:choice.coverAttackRedirect}:{}),attackAttemptWardSaves:saved.saves,wardFailureChoice:'waste',effectRolls:[]};return finish(base,{...parent,nextWindow:parent.nextWindow+1,windows:parent.windows.map(w=>w.index===window.index?{...w,phase:'complete',input:compiled,extras:{}}:w)},true,{windowIndex:window.index,complete:true})
  }
  if(window.index!==parent.nextWindow||!window.requests.length||window.requests[0].kind!=='attack'||window.requests.some(r=>!r.confirmed))return fail(409,'spell-window-confirmed-original-required')
  const choice=windowChoice(parent,window,snapshot,identity);if(choice.error)return fail(409,choice.error);const attack=window.requests[0],extras=input.extras??{},original={d20:attack.confirmed.values[0],...(attack.count===2?{d20Second:attack.confirmed.values[1]}:{}),effectRolls:window.requests.slice(1).flatMap(r=>r.confirmed.values)};if(!validMastermindSpellTargetExtras(extras,original))return fail(400,'spell-window-typed-native-extras-required');const ward=mastermindSpellWardInputs(parent,window,snapshot,identity,hash);if(!ward.ok)return ward;const completeInput={...structuredClone(extras),...(ward.saves.length?{attackAttemptWardSaves:ward.saves}:{}),targetId:choice.targetId,...(choice.coverAttackRedirect?{coverAttackRedirect:choice.coverAttackRedirect}:{}),d20:attack.confirmed.values[0],...(attack.count===2?{d20Second:attack.confirmed.values[1]}:{}),effectRolls:window.requests.slice(1).flatMap(r=>r.confirmed.values)};return finish(base,{...parent,nextWindow:parent.nextWindow+1,windows:parent.windows.map(w=>w.index===window.index?{...w,phase:'complete',input:completeInput,extras:structuredClone(extras)}:w)},true,{windowIndex:window.index,complete:true})
 }
 return fail(400,'spell-window-operation-required')
}
export function projectMastermindSpellWindowRequest(value,snapshot,identity,requestId,hash){
 if(!validMastermindSpellWindows(value)||!id(requestId))return fail(404,'spell-window-request-not-found')
 for(const p of Object.values(value.parents))for(const w of p.windows){const childWard=w.wardRequests?.find(x=>[x.bountiful,...(x.bountifulContinuations??[]).map(entry=>entry.book)].some(book=>book&&requestId==='mm-spell-ward-bountiful-pool:'+book.id.split(':')[1]));if(childWard){if(!current(p,snapshot,identity,hash))return fail(409,'spell-window-original-changed');return projectMastermindSpellWardBountifulRequest(p,w,childWard,snapshot,identity,requestId,hash)}const ward=w.wardRequests?.find(x=>x.id===requestId);if(ward){if(!current(p,snapshot,identity,hash))return fail(409,'spell-window-original-changed');return projectMastermindSpellWardRequest(p,w,ward,snapshot,identity,hash)}const r=w.requests.find(x=>x.id===requestId);if(!r)continue;if(!current(p,snapshot,identity,hash))return fail(409,'spell-window-original-changed');const own=identity.memberId===r.rollerMemberId&&controller(snapshot.characters.characters.find(c=>c.id===r.rollerCharacterId),identity)===identity.memberId;if(!host(identity)&&!own)return fail(403,'spell-window-real-controller-required');return{ok:true,request:{id:r.id,parentId:p.id,mapId:p.original.mapId,windowIndex:w.index,kind:r.kind,count:r.count,sides:r.sides,rollerTokenId:r.rollerTokenId,rollerCharacterId:r.rollerCharacterId,controllerMemberId:r.rollerMemberId,...(r.mode?{mode:r.mode}:{}),canRoll:own,phase:r.confirmed?'confirmed':r.raw?'raw':'issued',...(r.raw?{raw:[...r.raw.values]}:{}),...(r.confirmed?{confirmed:[...r.confirmed.values]}:{})}}}return fail(404,'spell-window-request-not-found')
}
export function readMastermindSpellWindowSource(value,snapshot,identity,parentId,hash){
 if(!host(identity))return fail(403,'spell-window-Host-required')
 if(!validMastermindSpellWindows(value)||!id(parentId)||!value.parents[parentId])return fail(404,'spell-window-parent-not-found')
 const parent=value.parents[parentId];if(!current(parent,snapshot,identity,hash))return fail(409,'spell-window-original-changed')
 return{ok:true,parent:structuredClone(parent)}
}
/** Pending choices are a filtered view of the protected input journal. They
 * grant neither a saving result, a reaction expense nor publication authority. */
export function listMastermindSpellWindowWardChoices(value,snapshot,identity,hash){
 if(!['dm','player'].includes(identity.role)||!id(identity.memberId))return fail(403,'spell-ward-choice:actual-room-member-required');
 if(value==null)return{ok:true,choices:[]};if(!validMastermindSpellWindows(value))return fail(409,'spell-ward-choice:valid-private-journal-required');
 const choices=[];for(const p of Object.values(value.parents)){
  if(!current(p,snapshot,identity,hash))continue;
  const w=p.windows.find(w=>w.index===p.nextWindow&&w.phase==='registered');if(!w||w.requests.length)continue;
  const map=snapshot.maps?.maps?.find(m=>m.id===p.original.mapId);
  for(const row of w.wardRequests??[]){if(!row.complete||!row.confirmed||!currentMastermindSpellWardRequest(p,w,row,snapshot,identity,hash))continue;
   const child=row.bountiful;
   for(const{occurrence,book}of[...(child?[{occurrence:0,book:child}]:[]),...(row.bountifulContinuations??[])]){
    if(book.decisions.some(d=>d.decision==='use')||book.decisions.length>=book.request.options.length)continue;
    const option=book.request.options[book.decisions.length],expected=book.controllers[option.ownerId],token=map?.tokens.find(t=>t.id===option.ownerId),character=snapshot.characters?.characters?.find(c=>c.id===token?.characterId);
    if(expected?.memberId===identity.memberId&&expected.characterId===character?.id&&controller(character,identity)===identity.memberId)choices.push({id:book.id,kind:'bountiful',parentId:p.id,mapId:p.original.mapId,windowIndex:w.index,requestId:row.id,...(occurrence?{occurrence}:{}),ownerId:option.ownerId,featureId:option.featureId,ownerCharacterId:character.id,ownerName:character.name,rollerTokenId:row.rollerTokenId});
   }
   if(row.outcomePending&&!row.outcome&&(!child||child.complete)&&(row.bountifulContinuations??[]).every(entry=>entry.book.complete)&&row.rollerMemberId===identity.memberId){const character=snapshot.characters?.characters?.find(c=>c.id===row.rollerCharacterId);if(controller(character,identity)===identity.memberId)choices.push({id:row.id+':outcome',kind:'ward-failure',parentId:p.id,mapId:p.original.mapId,windowIndex:w.index,requestId:row.id,actorId:row.rollerTokenId,actorCharacterId:row.rollerCharacterId,actorName:character.name,choices:row.retargetOriginalAvailable?['waste','retarget-original']:['waste'],...(row.retargetAvailable?{retargetAvailable:true,wardTargetTokenId:row.wardTargetTokenId,...(row.retargetProposals?.length?{proposal:{revision:row.retargetProposals.at(-1).revision,targetTokenId:row.retargetProposals.at(-1).targetTokenId,phase:row.retargetProposals.at(-1).phase}}:{})}:{})})}
  }
 }
 return{ok:true,choices}
}
