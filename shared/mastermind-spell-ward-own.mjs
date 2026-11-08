import{secondChanceCanonicalControllerMemberId}from'./second-chance-controller.mjs'
// This is authenticated input evidence, never a Native/Base/World issuer.
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),keys=(v,a)=>obj(v)&&Object.keys(v).every(k=>a.includes(k)),id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v),int=v=>Number.isSafeInteger(v)&&v>=0,hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),face=v=>Array.isArray(v)&&v.length===1&&Number.isSafeInteger(v[0])&&v[0]>=1&&v[0]<=20,ordered=v=>Array.isArray(v)?v.map(ordered):obj(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,ordered(x)])):v,same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
export const spellWardOwnRequestPrefix='mm-spell-ward-own:'
export function validSpellWardOwnRequest(v,row){return keys(v,['actorId','kind','originalRolls','dieIndex','nativeLucky','options'])&&Object.keys(v).length===6&&v.actorId===row.rollerTokenId&&v.kind==='saving-throw'&&v.nativeLucky===true&&Array.isArray(v.originalRolls)&&v.originalRolls.length===row.count&&v.originalRolls.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=20)&&int(v.dieIndex)&&v.dieIndex<row.count&&v.originalRolls[v.dieIndex]===1&&same(v.options,[{ownerId:row.rollerTokenId,featureId:'dnd5e-racial-halfling-lucky'}])}
export function spellWardOwnEntryReady(entry){return entry?.decision?.decision==='decline'||entry?.decision?.decision==='use'&&!!entry.raw&&!!entry.confirmed}
export function validSpellWardOwn(value,row,parent){
 if(value===undefined)return true
 if(!keys(value,['schemaVersion','sourceKind','sourceSignature','entries'])||value.schemaVersion!==1||value.sourceKind!=='mm-spell-ward-own-v1'||!hex(value.sourceSignature)||!Array.isArray(value.entries)||value.entries.length>128)return false
 let previous=-1;for(const e of value.entries){
  if(!keys(e,['id','occurrence','request','sourceSignature','prefixSignature','attempt','createdAt','window','answer','decision','raw','confirmed'])||!/^mm-spell-ward-own:[a-f0-9]{64}$/.test(e.id)||!int(e.occurrence)||e.occurrence>127||e.occurrence<=previous||!validSpellWardOwnRequest(e.request,row)||e.sourceSignature!==value.sourceSignature||!hex(e.prefixSignature)||!int(e.attempt)||!int(e.createdAt))return false;previous=e.occurrence
  if(e.window!==undefined&&(!keys(e.window,['id','signature'])||!id(e.window.id)||!hex(e.window.signature)))return false
  if(e.answer!==undefined&&(!e.window||!keys(e.answer,['memberId','optionId','windowSignature','at'])||e.answer.memberId!==row.rollerMemberId||!['pending','decline','use'].includes(e.answer.optionId)||e.answer.windowSignature!==e.window.signature||!int(e.answer.at)))return false
  if(e.decision!==undefined&&(!e.answer||!keys(e.decision,['memberId','decision','choiceId','windowSignature','at'])||e.decision.memberId!==row.rollerMemberId||!['decline','use'].includes(e.decision.decision)||e.decision.decision!==e.answer.optionId||e.decision.choiceId!==e.window.id||e.decision.windowSignature!==e.window.signature||!int(e.decision.at)))return false
  if(e.raw!==undefined&&(e.decision?.decision!=='use'||!keys(e.raw,['values','memberId','at'])||!face(e.raw.values)||e.raw.memberId!==row.rollerMemberId||!int(e.raw.at)))return false
  if(e.confirmed!==undefined&&(!e.raw||!keys(e.confirmed,['values','rawValues','memberId','at'])||!face(e.confirmed.values)||!same(e.confirmed.rawValues,e.raw.values)||e.confirmed.memberId!==parent.hostMemberId||!int(e.confirmed.at)))return false
 }return new Set(value.entries.map(e=>e.id)).size===value.entries.length
}
/** Canonical controller/race come from the current protected parent's World.
 * Caller supplied nativeLucky/racialRules/source snapshots are never accepted. */
export function currentSpellWardOwnActor(parent,row,snapshot,identity){
 const map=snapshot.maps?.maps?.find(m=>m.id===parent.original.mapId),token=map?.tokens?.find(t=>t.id===row.rollerTokenId&&t.characterId===row.rollerCharacterId),character=snapshot.characters?.characters?.find(c=>c.id===row.rollerCharacterId),member=secondChanceCanonicalControllerMemberId(character,{roomId:identity.roomId,hostMemberId:identity.hostMemberId});
 const a=character?.dnd5eCombatState?.activeEffects??[],b=token?.dnd5eCombatState?.activeEffects??[];if(!Array.isArray(a)||!Array.isArray(b))return;const effects=[...a,...b];
 return token&&character&&character.dnd5eRaceId==='halfling'&&Number.isFinite(character.currentHp)&&character.currentHp>0&&member===row.rollerMemberId&&member===parent.original.actorMemberId&&!effects.some(e=>e?.tags?.includes('bountiful-luck:racial-lucky-suppressed'))?{token,character,member}:undefined
}
/** Every prior record is one actual Native checkpoint, not one B owner vote.
 * The caller supplies decoders for already validated B records. No source or
 * permission is minted; gaps, duplicates and unfinished inputs fail closed. */
export function spellWardOwnCompletedPrefix(row,occurrence,decodeB){
 if(!int(occurrence)||occurrence>127||!row.confirmed)return
 const records=new Map(),put=(n,v)=>{if(!int(n)||records.has(n))return false;records.set(n,v);return true};
 if(row.bountiful&&!put(0,{kind:'B',value:row.bountiful}))return
 for(const e of row.bountifulContinuations??[])if(!put(e.occurrence,{kind:'B',value:e.book}))return
 for(const e of row.own?.entries??[])if(!put(e.occurrence,{kind:'own',value:e}))return
 // Native requests retain the original complete pool. Effective faces and the
 // B replacement mask advance separately; only the current die may be Own.
 const faces=[...row.confirmed.values],inputs=[],bReplacedDice=new Set();
 for(let n=0;n<occurrence;n++){
  const record=records.get(n);if(!record)return
  if(record.kind==='B'){const proof=decodeB(record.value,n);if(!proof?.ready||!same(proof.request.originalRolls,row.confirmed.values)||proof.request.actorId!==row.rollerTokenId)return;if(proof.choice!==undefined){faces[proof.request.dieIndex]=proof.choice.replacement;bReplacedDice.add(proof.request.dieIndex)}inputs.push({kind:'B',occurrence:n,input:proof.input});continue}
  const e=record.value;if(!spellWardOwnEntryReady(e)||!same(e.request.originalRolls,row.confirmed.values))return
  if(e.decision.decision==='use')faces[e.request.dieIndex]=e.confirmed.values[0]
  inputs.push({kind:'own',occurrence:n,request:e.request,decision:e.decision,...(e.raw?{raw:e.raw}:{}),...(e.confirmed?{confirmed:e.confirmed}:{})})
 }
 return{faces,inputs,bReplacedDice:[...bReplacedDice]}
}
export function spellWardOwnInputChoice(entry){if(!spellWardOwnEntryReady(entry))return;return entry.decision.decision==='decline'?{ready:true,choice:undefined}:{ready:true,choice:Object.freeze({ownerId:entry.request.actorId,featureId:'dnd5e-racial-halfling-lucky',replacement:entry.confirmed.values[0]})}}
export function spellWardOwnOrderedSignature(value){return JSON.stringify(ordered(value))}

function ownSource(parent,row,snapshot,identity,hash){
 const actor=currentSpellWardOwnActor(parent,row,snapshot,identity)
 if(!actor||!row.complete||!row.raw||!row.confirmed||row.sides!==20||row.count!==(row.mode==='normal'?1:2)||!row.confirmed.values.some(n=>n===1))return
 const{windows,nextWindow,...original}=parent,{own,bountiful,bountifulContinuations,outcomePending,outcome,retargetAvailable,retargetOriginalAvailable,retargetProposals,...saving}=row
 return{actor,sourceSignature:hash(JSON.stringify(ordered({original,saving,character:actor.character,token:actor.token}))) }
}
const ownChoiceId=e=>'mm-spell-ward-own-choice:'+e.id.slice(spellWardOwnRequestPrefix.length)+':'+e.attempt
const reject=(status,error)=>({ok:false,status,error}),host=i=>i.role==='dm'&&i.memberId===i.hostMemberId
export function mutateSpellWardOwn(parent,row,snapshot,identity,operation,input,now,hash,decodeB){
 if(!validSpellWardOwn(row.own,row,parent))return reject(409,'spell-ward-own:invalid-protected-input')
 const ctx=ownSource(parent,row,snapshot,identity,hash);if(!ctx)return reject(409,'spell-ward-own:current-half-original-required')
 if(row.own&&row.own.sourceSignature!==ctx.sourceSignature)return reject(409,'spell-ward-own:changed-original-source')
 const own=row.own?structuredClone(row.own):{schemaVersion:1,sourceKind:'mm-spell-ward-own-v1',sourceSignature:ctx.sourceSignature,entries:[]},finish=()=>({ok:true,row:same(own,row.own)?row:{...row,own},own:structuredClone(own)})
 if(operation==='ward-own-register'){
  if(!host(identity))return reject(403,'spell-ward-own:actual-host-issue-required')
  if(!keys(input,['parentId','windowIndex','requestId','occurrence','request'])||Object.keys(input).length!==5||!int(input.occurrence)||!validSpellWardOwnRequest(input.request,row))return reject(400,'spell-ward-own:closed-native-request-required')
  const prefix=spellWardOwnCompletedPrefix(row,input.occurrence,decodeB);if(!prefix||!same(row.confirmed.values,input.request.originalRolls)||prefix.faces[input.request.dieIndex]!==1||prefix.bReplacedDice.includes(input.request.dieIndex))return reject(409,'spell-ward-own:authenticated-native-prefix-required')
  const prefixSignature=hash(JSON.stringify(ordered(prefix.inputs))),fixed={occurrence:input.occurrence,request:input.request,sourceSignature:ctx.sourceSignature,prefixSignature},requestId=spellWardOwnRequestPrefix+hash(JSON.stringify(ordered({parentId:parent.id,wardRequestId:row.id,...fixed}))),existing=own.entries.find(e=>e.occurrence===input.occurrence)
  if(existing){if(existing.id!==requestId||!same(Object.fromEntries(Object.keys(fixed).map(k=>[k,existing[k]])),fixed))return reject(409,'spell-ward-own:immutable-native-request-required');return finish()}
  if(own.entries.some(e=>e.occurrence>input.occurrence||!spellWardOwnEntryReady(e)))return reject(409,'spell-ward-own:previous-input-still-pending')
  own.entries.push({id:requestId,...structuredClone(fixed),attempt:0,createdAt:now});return finish()
 }
 if(operation==='ward-own-source'){if(!host(identity)||!keys(input,['parentId','windowIndex','requestId'])||Object.keys(input).length!==3)return reject(403,'spell-ward-own:host-source-only');return{ok:true,row,own:row.own?structuredClone(row.own):undefined}}
 const entry=own.entries.find(e=>e.id===input.ownRequestId);if(!entry)return reject(409,'spell-ward-own:actual-issued-entry-required')
 const prefix=spellWardOwnCompletedPrefix(row,entry.occurrence,decodeB);if(!prefix||!same(row.confirmed.values,entry.request.originalRolls)||prefix.faces[entry.request.dieIndex]!==1||prefix.bReplacedDice.includes(entry.request.dieIndex)||hash(JSON.stringify(ordered(prefix.inputs)))!==entry.prefixSignature)return reject(409,'spell-ward-own:changed-authenticated-prefix')
 if(operation==='ward-own-choice'){
  if(!host(identity)||!keys(input,['parentId','windowIndex','requestId','ownRequestId'])||Object.keys(input).length!==4)return reject(403,'spell-ward-own:host-read-choice-only')
  if(entry.decision)return finish()
  const publicRow=snapshot['combat-interrupts']?.interrupts?.find(r=>r.id===ownChoiceId(entry))
  if(!entry.answer||!publicRow||!same(publicRow.response,{optionId:entry.answer.optionId}))return{ok:true,row,own:row.own?structuredClone(row.own):undefined,pending:true}
  if(entry.answer.optionId==='pending'){delete entry.window;delete entry.answer;entry.attempt++;return finish()}
  entry.decision={memberId:entry.answer.memberId,decision:entry.answer.optionId,choiceId:ownChoiceId(entry),windowSignature:entry.answer.windowSignature,at:now};return finish()
 }
 if(!keys(input,['parentId','windowIndex','requestId','ownRequestId','values'])||Object.keys(input).length!==5||!face(input.values)||entry.decision?.decision!=='use')return reject(400,'spell-ward-own:actual-use-pool-required')
 if(operation==='ward-own-raw'){
  if(identity.memberId!==row.rollerMemberId||identity.role!==(row.rollerMemberId===parent.hostMemberId?'dm':'player'))return reject(403,'spell-ward-own:actual-controller-original-required')
  if(entry.raw&&!same(entry.raw.values,input.values))return reject(409,'spell-ward-own:immutable-raw-required')
  entry.raw??={values:[...input.values],memberId:identity.memberId,at:now};return finish()
 }
 if(operation==='ward-own-confirm'){
  if(!host(identity))return reject(403,'spell-ward-own:actual-host-adoption-required')
  if(!entry.raw)return reject(409,'spell-ward-own:independent-original-before-adoption-required')
  if(entry.confirmed&&!same(entry.confirmed.values,input.values))return reject(409,'spell-ward-own:immutable-adoption-required')
  entry.confirmed??={values:[...input.values],rawValues:[...entry.raw.values],memberId:identity.memberId,at:now};return finish()
 }
 return reject(400,'spell-ward-own:unsupported-operation')
}
export function spellWardOwnChoiceId(entry){return ownChoiceId(entry)}
function ownWindowSignature(parent,row,entry,window,hash){
 const payload=window?.payload,binding=payload?.wardOwnBinding
 if(!window||window.id!==ownChoiceId(entry)||window.kind!=='plugin-choice'||window.phase!=='after-save'||window.transactionId!==parent.id||window.mapId!==parent.original.mapId||window.actorCharId!==row.rollerCharacterId||window.targetCharId!=null||!keys(payload,['pluginId','featureId','featureName','prompt','audience','options','defaultOptionId','wardOwnBinding'])||payload.pluginId!=='dnd5e-2014-srd-5.1'||payload.featureId!=='dnd5e-racial-halfling-lucky'||typeof payload.featureName!=='string'||!payload.featureName||typeof payload.prompt!=='string'||!payload.prompt||payload.defaultOptionId!=='pending'||!(row.rollerMemberId===parent.hostMemberId?['actor','dm']:['actor']).includes(payload.audience)||!Array.isArray(payload.options)||!same(payload.options.map(o=>o.id),['pending','decline','use'])||payload.options.some(o=>!keys(o,['id','label','description'])||typeof o.label!=='string'||o.description!==undefined&&typeof o.description!=='string')||!same(binding,{parentId:parent.id,wardRequestId:row.id,ownRequestId:entry.id,occurrence:entry.occurrence,effectTimestamp:parent.issuedAt,sourceSignature:entry.sourceSignature,prefixSignature:entry.prefixSignature}))return
 return hash(JSON.stringify(ordered({id:window.id,kind:window.kind,phase:window.phase,transactionId:window.transactionId,mapId:window.mapId,actorCharId:window.actorCharId,payload})))
}
/** Only the real authenticated interrupt mutation calls this function. The
 * enclosing ledger rechecks the canonical parent and all current dependencies. */
export function recordSpellWardOwnInterrupt(parent,row,snapshot,identity,mutation,result,now,hash,decodeB){
 const windowId=String(mutation?.interrupt?.id??mutation?.id??'')
 if(!windowId.startsWith('mm-spell-ward-own-choice:'))return{ok:true,row,changed:false}
 if(!validSpellWardOwn(row.own,row,parent)||!result?.ok||!int(now))return reject(403,'spell-ward-own:authenticated-route-required')
 const ctx=ownSource(parent,row,snapshot,identity,hash),entry=row.own?.entries.find(e=>ownChoiceId(e)===windowId),window=result.next?.interrupts?.find(w=>w.id===windowId),previous=snapshot['combat-interrupts']?.interrupts?.find(w=>w.id===windowId)
 if(!ctx||!entry||ctx.sourceSignature!==entry.sourceSignature)return reject(403,'spell-ward-own:current-issued-source-required')
 const prefix=spellWardOwnCompletedPrefix(row,entry.occurrence,decodeB),signature=ownWindowSignature(parent,row,entry,window,hash)
 if(!prefix||!signature||hash(JSON.stringify(ordered(prefix.inputs)))!==entry.prefixSignature||!same(row.confirmed.values,entry.request.originalRolls)||prefix.faces[entry.request.dieIndex]!==1||prefix.bReplacedDice.includes(entry.request.dieIndex))return reject(403,'spell-ward-own:exact-issued-window-required')
 const own=structuredClone(row.own),next=own.entries.find(e=>e.id===entry.id),finish=()=>({ok:true,changed:!same(own,row.own),row:same(own,row.own)?row:{...row,own}}),controller=identity.memberId===row.rollerMemberId&&identity.role===(row.rollerMemberId===parent.hostMemberId?'dm':'player'),response=r=>keys(r,['optionId'])&&Object.keys(r).length===1&&['pending','decline','use'].includes(r.optionId)
 if(mutation.operation==='upsert'){
  if(!host(identity)||mutation.interrupt.status!=='pending'||mutation.interrupt.response!=null||previous&&previous.status!=='pending'||window.status!=='pending'||window.response!=null)return reject(403,'spell-ward-own:host-issued-pending-only')
  if(entry.window&&!same(entry.window,{id:windowId,signature}))return reject(409,'spell-ward-own:immutable-issued-window')
  next.window??={id:windowId,signature};return finish()
 }
 if(!entry.window||entry.window.signature!==signature||entry.window.id!==windowId)return reject(403,'spell-ward-own:actual-issued-window-required')
 if(mutation.operation==='answer'){
  if(!controller||!previous||!entry.answer&&!['pending','waiting','rolling'].includes(previous.status)||!response(mutation.response)||!same(mutation.response,window.response)||window.status!=='answered')return reject(403,'spell-ward-own:actual-controller-answer-required')
  const answer={memberId:identity.memberId,optionId:window.response.optionId,windowSignature:signature,at:entry.answer?.at??now};if(entry.answer&&!same(entry.answer,answer))return reject(409,'spell-ward-own:immutable-answer-required');next.answer=answer;return finish()
 }
 if(mutation.operation==='finish')return host(identity)&&entry.answer&&same(window.response,{optionId:entry.answer.optionId})?finish():reject(403,'spell-ward-own:owner-answer-before-finish-required')
 if(['wait','rolling','rollback'].includes(mutation.operation))return host(identity)||controller?finish():reject(403,'spell-ward-own:actual-controller-required')
 return reject(403,'spell-ward-own:unsupported-interrupt-mutation')
}

/** Completed authenticated input data only. This never issues a Native,
 * Parent, result, Host or publication capability. */
export function readSpellWardOwnCompletedInputs(row,parent,occurrence,snapshot,identity,hash){
 const ctx=ownSource(parent,row,snapshot,identity,hash);if(!ctx||!int(occurrence)||occurrence>64||!validSpellWardOwn(row.own,row,parent)||row.own&&row.own.sourceSignature!==ctx.sourceSignature)return
 const entries=(row.own?.entries??[]).filter(entry=>entry.occurrence<occurrence),inputs=[]
 for(const entry of entries){const decoded=spellWardOwnInputChoice(entry);if(!decoded?.ready||!same(entry.request.originalRolls,row.confirmed?.values))return;inputs.push({occurrence:entry.occurrence,request:structuredClone(entry.request),choice:decoded.choice,identity:structuredClone({sourceKind:row.own.sourceKind,sourceSignature:row.own.sourceSignature,entry})})}
 return inputs
}
