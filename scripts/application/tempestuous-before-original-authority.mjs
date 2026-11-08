import{readTempestuousHostOriginal}from'./tempestuous-host-original-authority.mjs'
import{projectTempestuousBeforeOwnerChoice,tempestuousBeforeBookSignature,tempestuousBeforeWindowSignature,tempestuousBeforeOwnerWindow,validTempestuousBeforeOwnerResponse}from'../../shared/tempestuous-before-owner-choice.mjs'
import{tempestuousBeforeOriginalSourceFacts,tempestuousBeforeRecoveryFacts,validTempestuousBeforeOriginalFrame}from'../../shared/tempestuous-before-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),identity=p=>['parentId','mapId','combatId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000),reject=error=>({ok:false,status:403,error}),key=id=>'tempestuous-before-preparation:'+id
const scope=(d,geometry,clock)=>({versions:{characters:d.characters?._sync?.revision??0,maps:d.maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0},clockSignature:JSON.stringify(clock??null),mapSignature:JSON.stringify(d.maps?.maps??[]),charactersSignature:JSON.stringify(d.characters?.characters??[]),geometrySignature:JSON.stringify(geometry??null),combatSignature:JSON.stringify([d.combat?.mapId,d.combat?.combatId,d.combat?.active,d.combat?.round,d.combat?.initiativeIndex,d.combat?.initiativeOrder]),economySignature:JSON.stringify(d.combat?.dnd5eTurnEconomyByToken??{})})
async function actualParent(ctx,p,principal,api){const queued=api.nativeParent(await api.context(ctx),p.mapId,p.combatId,p.parentId);if(queued)return queued;const host=await readTempestuousHostOriginal(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId},principal,api);return host.ok?host.originalRoomAction:undefined}
async function current(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!identity(p))return null
 const d=await api.context(ctx),parent=await actualParent(ctx,p,principal,api),geometry=await api.doc(ctx,'map-geometry'),clock=await api.doc(ctx,'campaign-time'),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack')
 if(!parent||parent.type!=='dnd5e-spell-cast'||d.combat?.active!==true||processed?.actionIds?.includes(parent.id)||ack?.actionId===parent.id&&['accepted','rejected'].includes(ack.status))return null
 return{d,parent,scope:scope(d,geometry,clock)}
}
/** Controller-private source and canonical recovery facts for the actual native
 * before-flight prechoice. This issues no owner answer, die or world write. */
export async function recordTempestuousBeforeOriginalPreparation(ctx,p,principal,api){
 if(p?.phase==='choice')return recordTempestuousBeforeOwnerChoice(ctx,p,principal,api)
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','source','preparation','frame','prefixSignature','effectTimestamp'])||p.sourceKind!=='tempestuous-before-preparation-v1'||p.phase!=='prepare'||!identity(p)||!validTempestuousBeforeOriginalFrame(p.frame)||typeof p.prefixSignature!=='string'||!p.prefixSignature||!Number.isSafeInteger(p.effectTimestamp)||p.effectTimestamp<=0)return reject('tempestuous-before-preparation:actual-shape-required')
 const now=await current(ctx,p,principal,api),facts=tempestuousBeforeOriginalSourceFacts(p.source),recovery=tempestuousBeforeRecoveryFacts(p.preparation);if(!now||!facts||!recovery)return reject('tempestuous-before-preparation:current-spell-original-required')
 const owned=api.controller(now.d,p.mapId,p.frame.actorId,ctx.roomId),map=now.d.maps?.maps?.find(m=>m.id===p.mapId),action=now.parent
 const actor=facts.actorState,sourceOrder=(recovery.input.initiativeOrder??[]).map(entry=>typeof entry==='string'?entry:entry.tokenId),currentOrder=(now.d.combat.initiativeOrder??[]).map(entry=>typeof entry==='string'?entry:entry.tokenId)
 if(recovery.preparedSignature!==facts.preparedSignature||!api.equal(recovery.input.action,facts.action)||!api.equal(recovery.input.map,facts.map)||!api.equal(recovery.input.characters,facts.characters)||!api.equal(sourceOrder,currentOrder)||facts.transactionId!==undefined&&facts.transactionId!==p.parentId||!actor||actor.currentHp<=0||actor.turn?.bonusActionAvailable!==true||facts.initiativeOrder?.[facts.initiativeIndex]!==p.frame.actorId||!api.equal(p.frame.origin,{...actor.position,elevationFeet:actor.elevationFeet??actor.groundElevationFeet??0})||p.frame.options.some(option=>!actor.pluginFeatureIds?.includes(option.featureId))||!api.equal(recovery.features.map(f=>f.featureId),p.frame.options.map(o=>o.featureId)))return reject('tempestuous-before-preparation:canonical-native-preparation-required')
 if(!owned||!api.equal(facts.action,action)||action.id!==p.frame.parentId||action.actorTokenId!==p.frame.actorId||facts.actorToken?.id!==p.frame.actorId||action.dnd5eSpellCast.spellId!==p.frame.spellId||action.dnd5eSpellCast.slotLevel!==p.frame.slotLevel||facts.combatId!==p.combatId||facts.round!==now.d.combat.round||facts.initiativeIndex!==now.d.combat.initiativeIndex||!api.equal(facts.map,map)||!api.equal(facts.characters,now.d.characters?.characters)||facts.envelope&&(facts.envelope.roomId!==ctx.roomId||facts.envelope.memberId!==principal.memberId))return reject('tempestuous-before-preparation:canonical-spell-source-required')
 for(const[id,row]of Object.entries(facts.turns)){const stored=now.d.combat.dnd5eTurnEconomyByToken?.[id],active=facts.initiativeOrder?.[facts.initiativeIndex]===id,slot=active?(facts.initiativeSlotIds?.[facts.initiativeIndex]??id):id;if(stored&&(!active||stored.turnKey===p.combatId+':'+facts.round+':'+slot)&&(row.turn.reactionAvailable!==(stored.reaction.current>0)||id===p.frame.actorId&&(row.turn.actionAvailable&&stored.action.current===0||row.turn.bonusActionAvailable&&stored.bonusAction.current===0)))return reject('tempestuous-before-preparation:canonical-economy-required')}
 const book={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,originalRoomAction:action,source:p.source,preparation:p.preparation,frame:p.frame,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,characterId:owned.character.id,memberId:owned.character.roomMemberId??principal.memberId,scope:now.scope},prior=await api.load(ctx,key(p.parentId))
 const priorSource=prior&&Object.fromEntries(Object.entries(prior).filter(([key])=>key!=='ownerDecision'));if(prior&&!api.equal(priorSource,book))return reject('tempestuous-before-preparation:immutable-source-required')
 if(!prior)await api.save(ctx,key(p.parentId),book)
 return{ok:true}
}
export async function readTempestuousBeforeOriginalPreparation(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId'])||!identity(p))return reject('tempestuous-before-preparation:identity-required')
 const now=await current(ctx,p,principal,api),book=await api.load(ctx,key(p.parentId)),owned=now&&book&&api.controller(now.d,p.mapId,book.frame.actorId,ctx.roomId)
 if(!now||!book||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.mapId!==p.mapId||book.combatId!==p.combatId||!api.equal(book.originalRoomAction,now.parent)||!api.equal(book.scope,now.scope)||!owned||owned.character.id!==book.characterId||(owned.character.roomMemberId??principal.memberId)!==book.memberId)return reject('tempestuous-before-preparation:current-private-source-required')
 return{ok:true,...book}
}

/** Only true private absence is optional. A stored stale book always rejects. */
export async function probeTempestuousBeforeOriginalPreparation(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!closed(p,['parentId','mapId','combatId'])||!identity(p))return reject('tempestuous-before-preparation:identity-required')
 const book=await api.load(ctx,key(p.parentId))
 if(book!=null){const result=await readTempestuousBeforeOriginalPreparation(ctx,p,principal,api);return result.ok?{...result,present:true}:result}
 const d=await api.context(ctx),parent=await actualParent(ctx,p,principal,api),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack')
 if(!parent||parent.type!=='dnd5e-spell-cast'||processed?.actionIds?.includes(parent.id)||ack?.actionId===parent.id&&['accepted','rejected'].includes(ack.status))return reject('tempestuous-before-preparation:current-spell-original-required')
 return{ok:true,sourceKind:'tempestuous-before-preparation-probe-v1',present:false,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId}
}

async function recordTempestuousBeforeOwnerChoice(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId'])||p.sourceKind!=='tempestuous-before-preparation-v1'||!identity(p))return reject('tempestuous-before-choice:identity-only-required')
 const current=await readTempestuousBeforeOriginalPreparation(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId},principal,api);if(!current.ok)return current
 if(current.ownerDecision)return{ok:true}
 const queue=await api.doc(ctx,'combat-interrupts'),answers=Object.fromEntries(await Promise.all((queue?.interrupts??[]).map(async row=>[row.id,await api.load(ctx,'tempestuous-before-answer:'+p.parentId+':'+row.id)])))
 const projected=projectTempestuousBeforeOwnerChoice(current,queue,answers);if(!projected.ok)return reject(projected.error)
 const {ok,...book}=current;await api.save(ctx,key(p.parentId),{...book,ownerDecision:{decision:projected.decision,interruptIds:projected.interruptIds}});return{ok:true}
}

/** Only this real authenticated interrupt route records an owner answer.
 * Generic public completion data and caller controller IDs are never evidence. */
export async function recordTempestuousBeforeInterruptMutation(ctx,p,principal,api){
 const mutation=p?.mutation,result=p?.result,id=String(mutation?.interrupt?.id??mutation?.id??'');if(!id.startsWith('tempestuous-before:'))return{ok:true}
 const row=result?.next?.interrupts?.find(row=>row.id===id),previous=p?.queue?.interrupts?.find(row=>row.id===id);if(!result?.ok||!row||!principal?.hostMemberId||!principal.memberId)return reject('tempestuous-before-window:actual-authenticated-route-required')
 const stored=await api.load(ctx,key(row.transactionId));if(!stored||stored.hostMemberId!==principal.hostMemberId)return reject('tempestuous-before-window:current-private-source-required')
 const current=await readTempestuousBeforeOriginalPreparation(ctx,{parentId:stored.parentId,mapId:stored.mapId,combatId:stored.combatId},{role:'dm',memberId:principal.hostMemberId},api);if(!current.ok)return current
 if(!tempestuousBeforeOwnerWindow(current,row))return reject('tempestuous-before-window:exact-owner-window-required')
 const bookSignature=tempestuousBeforeBookSignature(current),windowSignature=tempestuousBeforeWindowSignature(row),windowKey='tempestuous-before-window:'+current.parentId+':'+id,answerKey='tempestuous-before-answer:'+current.parentId+':'+id,window=await api.load(ctx,windowKey),answer=await api.load(ctx,answerKey),host=principal.role==='dm'&&principal.memberId===current.hostMemberId,owner=principal.memberId===current.memberId&&principal.role===(current.memberId===current.hostMemberId?'dm':'player')
 if(mutation.operation==='upsert'){
  if(!host||mutation.interrupt?.status!=='pending'||mutation.interrupt.response!=null)return reject('tempestuous-before-window:host-issue-only-required')
  if(window){if(window.schemaVersion!==1||window.bookSignature!==bookSignature||window.windowSignature!==windowSignature)return reject('tempestuous-before-window:immutable-window-required');return{ok:true}}
  if(previous&&previous.status!=='pending'||row.status!=='pending'||row.response!=null)return reject('tempestuous-before-window:actual-pending-issue-required')
  await api.save(ctx,windowKey,{schemaVersion:1,sourceKind:'tempestuous-before-window-v1',roomId:ctx.roomId,parentId:current.parentId,frameId:current.frame.id,memberId:current.memberId,bookSignature,windowSignature});return{ok:true}
 }
 if(!window||window.schemaVersion!==1||window.sourceKind!=='tempestuous-before-window-v1'||window.roomId!==ctx.roomId||window.parentId!==current.parentId||window.frameId!==current.frame.id||window.memberId!==current.memberId||window.bookSignature!==bookSignature||window.windowSignature!==windowSignature)return reject('tempestuous-before-window:actual-issued-window-required')
 if(mutation.operation==='answer'){
  if(!owner||!validTempestuousBeforeOwnerResponse(current,row,mutation.response)||!api.equal(mutation.response,row.response))return reject('tempestuous-before-window:actual-owner-answer-required')
  if(answer){if(answer.memberId!==principal.memberId||answer.role!==principal.role||answer.bookSignature!==bookSignature||answer.windowSignature!==windowSignature||!api.equal(answer.response,row.response))return{ok:false,status:409,error:'tempestuous-before-window:immutable-answer-required'};return{ok:true}}
  await api.save(ctx,answerKey,{schemaVersion:1,sourceKind:'tempestuous-before-answer-v1',roomId:ctx.roomId,parentId:current.parentId,frameId:current.frame.id,memberId:principal.memberId,role:principal.role,bookSignature,windowSignature,response:row.response});return{ok:true}
 }
 if(mutation.operation==='finish'){
  if(!host||!answer||answer.memberId!==current.memberId||answer.role!==(current.memberId===current.hostMemberId?'dm':'player')||answer.bookSignature!==bookSignature||answer.windowSignature!==windowSignature||!api.equal(answer.response,row.response))return reject('tempestuous-before-window:actual-owner-before-host-finish-required');return{ok:true}
 }
 if(['wait','rolling','rollback'].includes(mutation.operation))return host||owner?{ok:true}:reject('tempestuous-before-window:actual-controller-required')
 return reject('tempestuous-before-window:unsupported-operation')
}
