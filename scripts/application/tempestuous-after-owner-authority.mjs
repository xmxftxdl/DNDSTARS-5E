import{readTempestuousBeforeOriginalPreparation}from'./tempestuous-before-original-authority.mjs'
import{validTempestuousAfterOriginalFrame,tempestuousAfterBookSignature,tempestuousAfterWindowSignature,tempestuousAfterOwnerWindow,validTempestuousAfterOwnerResponse,projectTempestuousAfterOwnerChoice}from'../../shared/tempestuous-after-owner-choice.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),reject=error=>({ok:false,status:403,error}),identity=p=>['parentId','mapId','combatId','frameId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000),key=(parent,frame)=>'tempestuous-after-owner:'+parent+':'+frame
async function current(ctx,book,principal,api){
 const before=await readTempestuousBeforeOriginalPreparation(ctx,{parentId:book.parentId,mapId:book.mapId,combatId:book.combatId},principal,api)
 if(!before.ok||before.ownerDecision?.decision?.kind!=='decline'||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.memberId!==before.memberId||book.characterId!==before.characterId||book.effectTimestamp!==before.effectTimestamp||!api.equal(book.scope,before.scope)||book.beforeSignature!==tempestuousAfterBookSignature(before))return reject('tempestuous-after-window:current-same-original-declined-before-required')
 return{ok:true,before}
}
/** The private window records authenticate consent only. They issue no die,
 * Native capability or world commit, and never count a before-decline as consent. */
export async function recordTempestuousAfterInterruptMutation(ctx,p,principal,api){
 const mutation=p?.mutation,result=p?.result,id=String(mutation?.interrupt?.id??mutation?.id??'');if(!id.startsWith('tempestuous-after:'))return{ok:true}
 const row=result?.next?.interrupts?.find(r=>r.id===id),previous=p?.queue?.interrupts?.find(r=>r.id===id),context=row?.payload?.tempestuousAfter
 if(!result?.ok||!row||!principal?.hostMemberId||!principal.memberId||!data(context)||Object.keys(context).some(k=>!['frame','prefixSignature','effectTimestamp'].includes(k))||!validTempestuousAfterOriginalFrame(context.frame)||typeof context.prefixSignature!=='string'||!/^sha256:[a-f0-9]{64}$/.test(context.prefixSignature)||!Number.isSafeInteger(context.effectTimestamp)||context.effectTimestamp<=0)return reject('tempestuous-after-window:actual-context-required')
 const frame=context.frame,before=await readTempestuousBeforeOriginalPreparation(ctx,{parentId:frame.parentId,mapId:row.mapId,combatId:row.payload.combatId},{role:'dm',memberId:principal.hostMemberId},api)
 if(!before.ok||before.ownerDecision?.decision?.kind!=='decline'||frame.parentId!==before.parentId||frame.actorId!==before.frame.actorId||frame.spellId!==before.frame.spellId||frame.slotLevel!==before.frame.slotLevel||context.effectTimestamp!==before.effectTimestamp||!api.equal(frame.options,before.frame.options))return reject('tempestuous-after-window:current-same-original-declined-before-required')
 const candidate={schemaVersion:1,sourceKind:'tempestuous-after-owner-v1',roomId:ctx.roomId,hostMemberId:principal.hostMemberId,parentId:before.parentId,mapId:before.mapId,combatId:before.combatId,memberId:before.memberId,characterId:before.characterId,frame,prefixSignature:context.prefixSignature,effectTimestamp:context.effectTimestamp,scope:before.scope,beforeSignature:tempestuousAfterBookSignature(before)},bookKey=key(before.parentId,frame.id),stored=await api.load(ctx,bookKey),book=stored??candidate
 if(stored&&!api.equal(stored,candidate))return reject('tempestuous-after-window:immutable-original-required')
 if(!tempestuousAfterOwnerWindow(book,row))return reject('tempestuous-after-window:exact-owner-window-required')
 const bookSignature=tempestuousAfterBookSignature(book),windowSignature=tempestuousAfterWindowSignature(row),windowKey='tempestuous-after-window:'+book.parentId+':'+id,answerKey='tempestuous-after-answer:'+book.parentId+':'+id,window=await api.load(ctx,windowKey),answer=await api.load(ctx,answerKey),host=principal.role==='dm'&&principal.memberId===book.hostMemberId,owner=principal.memberId===book.memberId&&principal.role===(book.memberId===book.hostMemberId?'dm':'player')
 if(mutation.operation==='upsert'){
  if(!host||mutation.interrupt?.status!=='pending'||mutation.interrupt.response!=null||previous&&previous.status!=='pending'||row.status!=='pending'||row.response!=null)return reject('tempestuous-after-window:host-pending-issue-only-required')
  if(window){if(window.bookSignature!==bookSignature||window.windowSignature!==windowSignature)return reject('tempestuous-after-window:immutable-window-required');return{ok:true}}
  if(!stored)await api.save(ctx,bookKey,candidate)
  await api.save(ctx,windowKey,{schemaVersion:1,sourceKind:'tempestuous-after-window-v1',roomId:ctx.roomId,parentId:book.parentId,frameId:frame.id,memberId:book.memberId,bookSignature,windowSignature});return{ok:true}
 }
 if(!window||window.schemaVersion!==1||window.sourceKind!=='tempestuous-after-window-v1'||window.roomId!==ctx.roomId||window.parentId!==book.parentId||window.frameId!==frame.id||window.memberId!==book.memberId||window.bookSignature!==bookSignature||window.windowSignature!==windowSignature)return reject('tempestuous-after-window:actual-issued-window-required')
 if(mutation.operation==='answer'){
  if(!owner||!validTempestuousAfterOwnerResponse(book,row,mutation.response)||!api.equal(mutation.response,row.response))return reject('tempestuous-after-window:actual-owner-answer-required')
  if(answer){if(answer.memberId!==principal.memberId||answer.role!==principal.role||answer.bookSignature!==bookSignature||answer.windowSignature!==windowSignature||!api.equal(answer.response,row.response))return{ok:false,status:409,error:'tempestuous-after-window:immutable-answer-required'};return{ok:true}}
  await api.save(ctx,answerKey,{schemaVersion:1,sourceKind:'tempestuous-after-answer-v1',roomId:ctx.roomId,parentId:book.parentId,frameId:frame.id,memberId:principal.memberId,role:principal.role,bookSignature,windowSignature,response:row.response});return{ok:true}
 }
 if(mutation.operation==='finish'){if(!host||!answer||answer.memberId!==book.memberId||answer.role!==(book.memberId===book.hostMemberId?'dm':'player')||answer.bookSignature!==bookSignature||answer.windowSignature!==windowSignature||!api.equal(answer.response,row.response))return reject('tempestuous-after-window:actual-owner-before-host-finish-required');return{ok:true}}
 if(['wait','rolling','rollback'].includes(mutation.operation))return host||owner?{ok:true}:reject('tempestuous-after-window:actual-controller-required')
 return reject('tempestuous-after-window:unsupported-operation')
}
export async function verifyTempestuousAfterOwnerDecision(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!identity(p)||Object.keys(p).some(k=>!['parentId','mapId','combatId','frameId'].includes(k)))return reject('tempestuous-after-choice:identity-only-required')
 const book=await api.load(ctx,key(p.parentId,p.frameId));if(!book||book.frame.id!==p.frameId||book.mapId!==p.mapId||book.combatId!==p.combatId)return reject('tempestuous-after-choice:actual-private-original-required')
 const now=await current(ctx,book,principal,api);if(!now.ok)return now
 const queue=await api.doc(ctx,'combat-interrupts'),answers=Object.fromEntries(await Promise.all((queue?.interrupts??[]).map(async row=>[row.id,await api.load(ctx,'tempestuous-after-answer:'+p.parentId+':'+row.id)]))),projected=projectTempestuousAfterOwnerChoice(book,queue,answers)
 return projected.ok?{ok:true,frameId:p.frameId,decision:projected.decision}:reject(projected.error)
}
