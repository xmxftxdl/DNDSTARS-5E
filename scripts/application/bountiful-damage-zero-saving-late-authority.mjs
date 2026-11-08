import{bountifulDamageZeroSourceFacts,bountifulDamageZeroQualifiedWire}from'../../shared/bountiful-damage-zero-original.mjs'

import{validateBountifulOriginalParents,bountifulNativeLuckyDeclined}from'../../shared/bountiful-luck-state.mjs'
import{readBountifulDamageZeroOriginal,authenticatedBountifulDamageZeroOriginal}from'./bountiful-damage-zero-original-authority.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),reject=error=>({ok:false,status:403,error}),key=id=>'damage-zero-saving-late:'+id,namespace='bountiful-damage-zero-saving-late:'
const identityKeys=['parentId','mapId','combatId'],faces=(values,slot)=>Array.isArray(values)&&values.length===slot.count&&values.every(v=>Number.isInteger(v)&&v>=1&&v<=slot.sides)
/** Ledger only. Native Ready/complete choices and final original CAS remain
 * browser issuer permissions; this module never accepts a state or outcome. */
async function ready(ctx,p,principal,api){
 const original=await readBountifulDamageZeroOriginal(ctx,Object.fromEntries(identityKeys.map(k=>[k,p[k]])),principal,api);if(!original.ok)return null
 const d=await api.context(ctx),parents=d.combat?.bountifulOriginalParents;if(!validateBountifulOriginalParents(parents))return null
  const entries=Object.entries(parents).filter(([,row])=>row.identity.parentId===p.parentId).sort((a,b)=>a[1].identity.occurrence-b[1].identity.occurrence);if(!entries.length||entries.length>64)return null
  const [id,row]=entries[0];if(row.request.nativeLucky)return null
  const values=[...row.request.originalRolls],finalizedDice=[],protectedDecisions=[]
  for(let index=0;index<entries.length;index++){
   const[,current]=entries[index],i=current.identity,used=current.ownerDecisions.find(c=>c.decision==='use'),dieIndex=current.request.dieIndex
   if(i.occurrence!==index||current.consumed||i.mapId!==p.mapId||i.combatId!==p.combatId||i.effectTimestamp!==row.identity.effectTimestamp||!api.equal(current.originalParent,row.originalParent)||!api.equal(current.rawIssuer,row.rawIssuer)||!api.equal(current.request.originalRolls,row.request.originalRolls)||current.request.actorId!==row.request.actorId||!await authenticatedBountifulDamageZeroOriginal(ctx,current,principal,api)||finalizedDice.includes(dieIndex))return null
   if(current.request.nativeLucky){
    const previous=entries.slice(0,index).map(([,entry])=>entry).findLast(entry=>entry.request.dieIndex===dieIndex)
    if(!previous||previous.request.nativeLucky||previous.ownerDecisions.length!==previous.request.options.length||previous.ownerDecisions.some(c=>c.decision!=='decline')||!bountifulNativeLuckyDeclined(current)&&(!current.rawReroll||!current.hostReroll)||current.request.options.length!==1||current.request.options[0].ownerId!==current.request.actorId||current.request.options[0].featureId!=='dnd5e-racial-halfling-lucky')return null
    // A canonical V1 keep decision preserves the exact original pool and does
    // not mark that die as physically replaced. Legacy rerolls keep their contract.
    if(!bountifulNativeLuckyDeclined(current)){values[dieIndex]=current.hostReroll.value;finalizedDice.push(dieIndex)}
   }else{
    if(!used&&current.ownerDecisions.length!==current.request.options.length||used&&!current.hostReroll)return null
    if(used){values[dieIndex]=current.hostReroll.value;finalizedDice.push(dieIndex)}
   }
   protectedDecisions.push({identity:i,request:current.request,ownerDecisions:current.ownerDecisions,rawReroll:current.rawReroll??null,hostReroll:current.hostReroll??null,...(current.nativeLuckyChoiceVersion===1?{nativeLuckyDecision:current.nativeLuckyDecision}: {})})
  }
  finalizedDice.sort((a,b)=>a-b)
  return{original,row,id,values,finalizedDice,stageSignature:api.digest(protectedDecisions.length===1?protectedDecisions[0]:protectedDecisions)}
}
async function current(ctx,p,principal,api){const stage=await ready(ctx,p,principal,api),book=await api.load(ctx,key(p.parentId));if(!stage||!book||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.mapId!==p.mapId||book.combatId!==p.combatId||book.stageSignature!==stage.stageSignature||!api.equal(book.originalSource,stage.original.source))return null;return{stage,book}}
export async function recordBountifulDamageZeroSavingLate(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase',...identityKeys,'ordinal','spec','requestId','rawValues','values','source'])||p.sourceKind!=='damage-zero-saving-late-v1'||!identityKeys.every(k=>typeof p[k]==='string'&&p[k]))return reject('damage-zero-save-late:closed-issued-source-required')
 if(p.phase==='register'){
  if(p.requestId!==undefined||p.rawValues!==undefined||p.values!==undefined||p.source!==undefined)return reject('damage-zero-save-late:closed-register-required')
  const stage=await ready(ctx,p,principal,api),spec=p.spec;if(!stage||!Number.isSafeInteger(p.ordinal)||p.ordinal<0||p.ordinal>127||!closed(spec,['purpose','count','sides','label'])||!['bardic-inspiration','dark-ones-own-luck','optional-bonus','saving-throw-reroll','post-d20-adjustment'].includes(spec.purpose)||![1,2].includes(spec.count)||![4,6,8,10,12,20].includes(spec.sides)||typeof spec.label!=='string'||!spec.label||spec.label.length>500)return reject('damage-zero-save-late:ready-original-slot-required')
  const originalCharacter=bountifulDamageZeroSourceFacts(stage.original.source)?.characters?.find(row=>row.id===stage.original.characterId),held=originalCharacter?.dnd5eCombatState,die=held?.bardicInspirationDie;if(spec.purpose!=='bardic-inspiration'||spec.count!==1||![6,8,10,12].includes(die)||spec.sides!==die||held.bardicInspirationRoundsRemaining!=null&&held.bardicInspirationRoundsRemaining<=0)return reject('damage-zero-save-late:actual-held-die-required')
  const base={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,hostMemberId:principal.memberId,memberId:stage.original.memberId,characterId:stage.original.characterId,actorId:stage.original.frame.targetId,originalSource:stage.original.source,originalRequestId:stage.original.rows[0].requestId,stageSignature:stage.stageSignature,retainedValues:stage.values,finalizedDice:stage.finalizedDice},prior=await api.load(ctx,key(p.parentId)),book=prior??{...base,slots:[]};if(prior){const{slots,complete,...saved}=prior;if(!api.equal(saved,base))return reject('damage-zero-save-late:immutable-ready-source')}
  const slot={ordinal:p.ordinal,...spec,requestId:namespace+api.digest([base,p.ordinal,spec])};const old=book.slots[p.ordinal];if(old){const{announced,raw,confirmed,...issued}=old;return api.equal(issued,slot)?{ok:true,slot:old}:reject('damage-zero-save-late:immutable-slot')}
  if(book.complete||p.ordinal!==book.slots.length)return reject('damage-zero-save-late:ordered-open-slot-required');book.slots.push(slot);await api.save(ctx,key(p.parentId),book);return{ok:true,slot}
 }
 const live=await current(ctx,p,principal,api);if(!live)return reject('damage-zero-save-late:current-ready-book-required');const slot=live.book.slots.find(row=>row.requestId===p.requestId)
 if(p.phase==='append'){
  if(p.requestId!==undefined||p.spec!==undefined||p.rawValues!==undefined||p.values!==undefined||p.ordinal!==undefined||!live.book.complete||live.book.slots.length!==1||!live.book.slots[0].confirmed)return reject('damage-zero-save-late:completed-exact-slot-required')
  const original=bountifulDamageZeroQualifiedWire(live.stage.row.originalParent),next=bountifulDamageZeroQualifiedWire(p.source),before=original?.records?.[0],after=next?.records?.[0],slot=live.book.slots[0];if(!original||!next||!api.equal(original.base,next.base)||!api.equal(original.replay,next.replay)||original.records?.length!==1||next.records?.length!==1||!before?.choice||!after?.choice||before.choice.bardicInspirationRoll!==undefined||after.choice.bardicInspirationRoll!==slot.confirmed.values[0]||!api.equal({...before,choice:after.choice},after)){return reject('damage-zero-save-late:exact-confirmed-continuation-required')}
  const{bardicInspirationRoll,...withoutLate}=after.choice;if(!api.equal({...withoutLate,legendaryResistance:withoutLate.legendaryResistance??false},{...before.choice,legendaryResistance:before.choice.legendaryResistance??false}))return reject('damage-zero-save-late:locked-original-choice-required')
  const stamp={roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,beforeSignature:api.digest(live.stage.row),sourceSignature:api.digest(p.source),stageSignature:live.book.stageSignature};await api.save(ctx,'damage-zero-saving-late-continuation:'+p.parentId+':'+stamp.sourceSignature,stamp);return{ok:true}
 }
 if(p.source!==undefined)return reject('damage-zero-save-late:unexpected-continuation-source')
 if(p.phase==='complete'){if(p.requestId!==undefined||p.spec!==undefined||p.rawValues!==undefined||p.values!==undefined||p.ordinal!==undefined||live.book.slots.some(row=>!row.raw||!row.confirmed))return reject('damage-zero-save-late:all-independent-pools-required');if(!live.book.complete){live.book.complete=true;await api.save(ctx,key(p.parentId),live.book)}return{ok:true}}
 if(p.spec!==undefined||p.ordinal!==undefined)return reject('damage-zero-save-late:closed-pool-command-required');if(!slot)return reject('damage-zero-save-late:exact-issued-slot-required')
 if(p.phase==='host-raw'){if(live.book.memberId!==principal.memberId||!faces(p.rawValues,slot))return reject('damage-zero-save-late:canonical-host-raw-required');const raw={memberId:principal.memberId,values:[...p.rawValues]};if(slot.raw&&!api.equal(slot.raw,raw))return reject('damage-zero-save-late:raw-immutable');slot.raw=raw
 }else if(p.phase==='confirm'){if(!slot.raw||!faces(p.rawValues,slot)||!faces(p.values,slot)||!api.equal(p.rawValues,slot.raw.values))return reject('damage-zero-save-late:locked-raw-required');const confirmed={memberId:principal.memberId,values:[...p.values]};if(slot.confirmed&&!api.equal(slot.confirmed,confirmed))return reject('damage-zero-save-late:adoption-immutable');slot.confirmed=confirmed
 }else return reject('damage-zero-save-late:unknown-source-phase')
 await api.save(ctx,key(p.parentId),live.book);return{ok:true}
}
export async function readBountifulDamageZeroSavingLate(ctx,p,principal,api){const existing=await api.load(ctx,key(p.parentId));if(!existing)return{ok:true,present:false};const live=await current(ctx,p,principal,api);return live?{ok:true,present:true,...live.book}:reject('damage-zero-save-late:current-ready-book-required')}
export async function recordBountifulDamageZeroSavingLateDice(ctx,p,principal,api){
 const confirmed=typeof p?.requestId==='string'&&p.requestId.endsWith(':dm-confirmed'),id=confirmed?p.requestId.slice(0,-13):p?.requestId;if(typeof id!=='string'||!/^bountiful-damage-zero-saving-late:[a-f0-9]{64}$/.test(id))return reject('damage-zero-save-late:exact-issued-request-required')
 const d=await api.context(ctx),books=[];for(const action of d.requests?.requests??[]){const book=await api.load(ctx,key(action.id));if(book?.slots?.some(row=>row.requestId===id))books.push(book)}if(books.length!==1)return reject('damage-zero-save-late:exact-current-parent-required');const book=books[0],live=await current(ctx,book,{role:'dm',memberId:book.hostMemberId},api),slot=live?.book.slots.find(row=>row.requestId===id)
 if(!slot||p.mapId!==book.mapId||p.combatId!==book.combatId||p.count!==slot.count||p.sides!==slot.sides||!['d20','dice'].includes(p.kind))return reject('damage-zero-save-late:exact-issued-pool-required')
 if(confirmed)return principal.role==='dm'&&principal.memberId===book.hostMemberId&&p.delivery==='broadcast-result'&&slot.confirmed&&faces(p.values,slot)&&api.equal(p.values,slot.confirmed.values)?{ok:true}:reject('damage-zero-save-late:confirmed-presentation-required')
 if(p.rollerTokenId!==book.actorId||p.targetCharacterId!==book.characterId||p.rollKind!=='saving-throw')return reject('damage-zero-save-late:canonical-roller-required')
 if(p.delivery==='player-roll-request')return principal.role==='dm'&&principal.memberId===book.hostMemberId&&book.memberId!==book.hostMemberId?{ok:true}:reject('damage-zero-save-late:canonical-request-host-required')
 if(!['player-roll-start','player-roll-result'].includes(p.delivery)||principal.role!=='player'||principal.memberId!==book.memberId||book.memberId===book.hostMemberId||p.delivery==='player-roll-result'&&!faces(p.values,slot)||p.delivery==='player-roll-start'&&(!Array.isArray(p.values)||p.values.length!==0&&!faces(p.values,slot)))return reject('damage-zero-save-late:canonical-physical-player-required')
 if(p.delivery==='player-roll-start'){if(p.values.length){const announced={memberId:principal.memberId,values:[...p.values]};if(slot.announced&&!api.equal(slot.announced,announced)||slot.raw&&!api.equal(slot.raw,announced))return reject('damage-zero-save-late:announced-immutable');if(!slot.announced){slot.announced=announced;await api.save(ctx,key(book.parentId),live.book)}}return{ok:true}}
 const raw={memberId:principal.memberId,values:[...p.values]};if(slot.announced&&!api.equal(slot.announced,raw)||slot.raw&&!api.equal(slot.raw,raw))return reject('damage-zero-save-late:raw-immutable');if(!slot.raw){slot.raw=raw;await api.save(ctx,key(book.parentId),live.book)}return{ok:true}
}
