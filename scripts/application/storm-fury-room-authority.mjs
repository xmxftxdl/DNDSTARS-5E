import{recordStormFuryOwnerAnswer}from'./storm-fury-original-authority.mjs'
import{readStormFurySavingDice}from'./storm-fury-saving-authority.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),identity=p=>['parentId','mapId','combatId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000)&&Number.isSafeInteger(p?.frameIndex)&&p.frameIndex>=0,reject=error=>({ok:false,status:403,error}),parentKey=p=>'storm-fury-original:'+JSON.stringify([p.parentId,p.frameIndex]),pushKey=p=>'storm-fury-push:'+JSON.stringify([p.parentId,p.frameIndex])
async function current(ctx,p,api){
 if(!identity(p))return null
 const book=await api.load(ctx,parentKey(p));if(!book||book.roomId!==ctx.roomId||book.mapId!==p.mapId||book.combatId!==p.combatId)return null
 const d=await api.context(ctx),geometry=await api.doc(ctx,'map-geometry'),clock=await api.doc(ctx,'campaign-time'),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack'),scope={characters:d.characters,maps:d.maps,requests:d.requests,geometry,clock,combat:d.combat}
 const owned=api.controller(d,p.mapId,book.frame.event.targetId,ctx.roomId)
 if(!api.equal(scope,book.scope)||d.combat?.active!==true||d.combat.mapId!==p.mapId||d.combat.combatId!==p.combatId||processed?.actionIds?.includes(p.parentId)||ack?.actionId===p.parentId&&['accepted','rejected'].includes(ack.status)||!owned?.character||owned.character.id!==book.characterId||(owned.character.roomMemberId??book.hostMemberId)!==book.memberId)return null
 return book
}
export async function recordStormFuryPushPreparation(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','frameIndex','family','source','request','prefixSignature','effectTimestamp'])||p.sourceKind!=='storm-fury-push-v1'||p.phase!=='prepare'||!identity(p)||!closed(p.request,['kind','frame','featureId'])||p.request.kind!=='push'||typeof p.prefixSignature!=='string'||!p.prefixSignature)return reject('storm-fury-push:actual-failed-phase-required')
 const book=await current(ctx,p,api);if(!book||principal.role!=='dm'||principal.memberId!==book.hostMemberId||p.family!==book.family||p.effectTimestamp!==book.effectTimestamp||!api.equal(p.source,book.source)||!api.equal(p.request.frame,book.frame))return reject('storm-fury-push:exact-current-original-required')
 const saved=await readStormFurySavingDice(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex},principal,api)
 if(!saved.ok||p.request.featureId!==saved.request.featureId)return reject('storm-fury-push:actual-adopted-saving-prefix-required')
 const candidate={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex,hostMemberId:book.hostMemberId,memberId:book.memberId,characterId:book.characterId,source:p.source,request:p.request,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,savingSignature:JSON.stringify(saved),windowId:'storm-fury-push:'+JSON.stringify([p.parentId,p.frameIndex])},stored=await api.load(ctx,pushKey(p))
 if(stored&&!api.equal(stored,candidate))return reject('storm-fury-push:immutable-failed-prefix-required')
 if(!stored)await api.save(ctx,pushKey(p),candidate)
 return{ok:true,windowId:candidate.windowId}
}
const windowSignature=row=>JSON.stringify({id:row.id,mapId:row.mapId,transactionId:row.transactionId,kind:row.kind,actorCharId:row.actorCharId,targetCharId:row.targetCharId,payload:row.payload,phase:row.phase,timeoutPolicy:row.timeoutPolicy})
function windowMatches(book,row,kind,api){
 const p=row?.payload,context=p?.[kind==='owner'?'stormFuryOwner':'stormFuryPush'],id={parentId:book.parentId,mapId:book.mapId,combatId:book.combatId,frameIndex:book.frameIndex}
 if(!row||row.id!==book.windowId||row.mapId!==book.mapId||row.transactionId!==book.parentId||row.kind!=='plugin-choice'||row.actorCharId!==book.characterId||row.targetCharId!=null||!data(p)||p.defaultOptionId!=='pending'||!['actor',...(book.memberId===book.hostMemberId?['dm']:[])].includes(p.audience)||!closed(context,['parentId','mapId','combatId','frameIndex'])||!api.equal(context,id)||p.fields!=null&&(!Array.isArray(p.fields)||p.fields.length))return false
 const frame=kind==='owner'?book.frame:book.request.frame,options=kind==='owner'?['pending','decline',...frame.options.map(o=>o.featureId)]:['pending','decline','select-cell']
 if(!Array.isArray(p.options)||!api.equal(p.options.map(o=>o.id),options)||p.featureId!==(kind==='owner'?frame.options[0].featureId:book.request.featureId))return false
 if(kind==='owner')return p.movementChoice==null
 const movement=p.movementChoice
 return closed(movement,['actorTokenId','originTokenId','rangeFeet','label','allowedCells'])&&movement.actorTokenId===frame.event.actorId&&movement.originTokenId===frame.event.actorId&&movement.rangeFeet===20&&Array.isArray(movement.allowedCells)&&movement.allowedCells.every(c=>closed(c,['col','row'])&&Number.isSafeInteger(c.col)&&Number.isSafeInteger(c.row))
}
function responseDecision(book,row,response,kind){
 if(!closed(response,['optionId','fieldValues','movementCell'])||response.fieldValues!=null&&(!data(response.fieldValues)||Object.keys(response.fieldValues).length)||response.optionId==='pending'||!row.payload.options.some(o=>o.id===response.optionId))return null
 if(kind==='owner'){if(response.movementCell!=null)return null;return response.optionId==='decline'?{kind:'decline'}:{kind:'use',featureId:response.optionId}}
 if(response.optionId==='decline')return response.movementCell==null?{kind:'decline'}:null
 const cell=response.movementCell;if(!closed(cell,['col','row'])||!Number.isSafeInteger(cell.col)||!Number.isSafeInteger(cell.row)||!row.payload.movementChoice.allowedCells.some(c=>c.col===cell.col&&c.row===cell.row))return null
 return{kind:'push',cell:{col:cell.col,row:cell.row}}
}
export async function recordStormFuryRoomInterruptMutation(ctx,p,principal,api){
 const mutation=p?.mutation,id=String(mutation?.interrupt?.id??mutation?.id??''),kind=id.startsWith('storm-fury-owner:')?'owner':id.startsWith('storm-fury-push:')?'push':null
 if(!kind)return{ok:true}
 const row=p.result?.next?.interrupts?.find(r=>r.id===id),priorRow=p.queue?.interrupts?.find(r=>r.id===id),context=row?.payload?.[kind==='owner'?'stormFuryOwner':'stormFuryPush'],original=await current(ctx,context,api)
 if(!p.result?.ok||!original)return reject('storm-fury-room:current-native-original-required')
 const book=kind==='owner'?original:await api.load(ctx,pushKey(context));if(!book||book.roomId!==ctx.roomId||book.hostMemberId!==original.hostMemberId||book.memberId!==original.memberId||kind==='push'&&(!api.equal(book.source,original.source)||book.effectTimestamp!==original.effectTimestamp))return reject('storm-fury-room:actual-private-phase-required')
 if(!windowMatches(book,row,kind,api))return reject('storm-fury-room:exact-issued-window-required')
 const host=principal.role==='dm'&&principal.memberId===book.hostMemberId,owner=principal.memberId===book.memberId&&principal.role===(book.memberId===book.hostMemberId?'dm':'player'),signature=windowSignature(row),key=parentKey(context)+':'+kind+':window',issued=await api.load(ctx,key)
 if(mutation.operation==='upsert'){
  if(!host||mutation.interrupt?.status!=='pending'||mutation.interrupt.response!=null||row.status!=='pending'||row.response!=null||priorRow&&priorRow.status!=='pending')return reject('storm-fury-room:host-pending-issue-only-required')
  if(issued&&issued.signature!==signature)return reject('storm-fury-room:immutable-window-required')
  if(!issued)await api.save(ctx,key,{schemaVersion:1,roomId:ctx.roomId,memberId:book.memberId,signature})
  return{ok:true}
 }
 if(!issued||issued.roomId!==ctx.roomId||issued.memberId!==book.memberId||issued.signature!==signature)return reject('storm-fury-room:actual-issued-window-required')
 const answerKey=parentKey(context)+':'+kind+':response',answer=await api.load(ctx,answerKey)
 if(mutation.operation==='answer'){
  const decision=responseDecision(book,row,mutation.response,kind);if(!owner||!decision||!api.equal(mutation.response,row.response))return reject('storm-fury-room:actual-owner-response-required')
  const candidate={schemaVersion:1,roomId:ctx.roomId,memberId:principal.memberId,role:principal.role,signature,response:row.response,decision}
  if(answer&&!api.equal(answer,candidate))return{ok:false,status:409,error:'storm-fury-room:immutable-owner-response-required'}
  if(kind==='owner'){const saved=await recordStormFuryOwnerAnswer(ctx,{...context,windowId:book.windowId,decision},principal,api);if(!saved.ok)return saved}
  if(!answer)await api.save(ctx,answerKey,candidate)
  return{ok:true}
 }
 if(mutation.operation==='finish')return host&&answer&&answer.roomId===ctx.roomId&&answer.memberId===book.memberId&&answer.role===(book.memberId===book.hostMemberId?'dm':'player')&&answer.signature===signature&&api.equal(answer.response,row.response)?{ok:true}:reject('storm-fury-room:private-owner-before-host-finish-required')
 return['wait','rolling','rollback'].includes(mutation.operation)&&(host||owner)?{ok:true}:reject('storm-fury-room:unsupported-mutation')
}
export async function readStormFuryPushDecision(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','frameIndex'])||!identity(p))return reject('storm-fury-push:identity-only-required')
 const original=await current(ctx,p,api),book=await api.load(ctx,pushKey(p)),answer=await api.load(ctx,parentKey(p)+':push:response'),window=await api.load(ctx,parentKey(p)+':push:window')
 if(!original||!book||principal.role!=='dm'||principal.memberId!==original.hostMemberId||book.hostMemberId!==original.hostMemberId||book.memberId!==original.memberId||!api.equal(book.source,original.source)||book.effectTimestamp!==original.effectTimestamp||!answer||!window||answer.roomId!==ctx.roomId||answer.memberId!==original.memberId||answer.role!==(original.memberId===original.hostMemberId?'dm':'player')||answer.signature!==window.signature)return reject('storm-fury-push:actual-private-owner-response-required')
 const saving=await readStormFurySavingDice(ctx,p,principal,api);if(!saving.ok||JSON.stringify(saving)!==book.savingSignature)return reject('storm-fury-push:unchanged-adopted-saving-prefix-required')
 return{ok:true,decision:answer.decision}
}
