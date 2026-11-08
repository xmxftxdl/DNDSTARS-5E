import{authenticateMastermindOpportunityChoice}from'./mastermind-opportunity-choice-authority.mjs'
import{recordBountifulOpportunityMovementSegment}from'./bountiful-opportunity-movement-segment-authority.mjs'
import{recordBountifulOpportunityMovementOriginal}from'./bountiful-opportunity-movement-original-authority.mjs'
import{recordBountifulOpportunityConcentrationOriginal}from'./bountiful-opportunity-concentration-original-authority.mjs'
import{recordBountifulOpportunityCollector,currentBountifulCollectorBook,bountifulCollectorSourceMatches}from'./bountiful-opportunity-collector-authority.mjs'
import{recordBountifulOpportunityPostNative}from'./bountiful-opportunity-post-native-authority.mjs'
import{bountifulOpportunitySequenceSourceFacts,bountifulOpportunitySequenceContinuationFacts}from'../../shared/bountiful-opportunity-sequence.mjs'
import{bountifulHostPreparedWireSignature}from'../../shared/bountiful-host-operation.mjs'
/** Invoked only under the existing authenticated room event write lock. The
 * normal raw path retains its unchanged original-PC checks. No world writes
 * or Bountiful decisions are authorized by this private original-roll book. */
export async function recordBountifulOpportunitySequenceEvent(ctx,p,principal,ports){
 const{load,save,doc,context,nativeParent,namespace,controller,hostPoolController,equal,digest}=ports,reject=error=>({ok:false,status:403,error}),faces=(v,count)=>Array.isArray(v)&&v.length===count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=20)
 if(principal.role!=='dm'||!principal.memberId||p?.sourceKind!=='opportunity-sequence-v1')return reject('opportunity-sequence:authenticated-host-required')
 const clock=await doc(ctx,'campaign-time')
 const d=await context(ctx),parent=nativeParent(d,p.mapId,p.combatId,p.parentId),map=d.maps?.maps?.find(m=>m.id===p.mapId),geometry=await doc(ctx,'map-geometry'),versions={characters:d.characters?._sync?.revision??0,maps:d.maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0},key='opportunity-sequence:'+p.parentId,book=await load(ctx,key),processed=await doc(ctx,'player-action-processed')
 if(!parent||parent.type!=='move-token'||d.combat?.active!==true)return reject('opportunity-sequence:actual-original-move-required')
 if(processed?.combatId===parent.combatId&&processed?.actionIds?.includes(parent.id))return reject('opportunity-sequence:original-already-completed')
 if(book&&(book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||!equal(book.originalRoomAction,parent)||!equal(book.versions,versions)||book.economySignature!==JSON.stringify(d.combat.dnd5eTurnEconomyByToken??{})))return reject('opportunity-sequence:stale-original-source')
 if(!currentBountifulCollectorBook(book,d,clock,equal,digest))return reject('opportunity-collector:source-clock-or-combat-changed')
 if(['movement-segment-register','movement-segment-complete'].includes(p.phase))return recordBountifulOpportunityMovementSegment(ctx,p,principal,{d,parent,map,book,key,versions,geometry,clock,...ports})
 if(['movement-original-register','movement-concentration-original-register'].includes(p.phase))return recordBountifulOpportunityMovementOriginal(ctx,p,principal,{d,parent,map,book,key,...ports})
 if(['collector-register','collector-complete'].includes(p.phase))return recordBountifulOpportunityCollector(ctx,p,principal,{d,parent,map,book,key,versions,geometry,clock,...ports})
 if(['post-native-register','post-native-complete'].includes(p.phase))return recordBountifulOpportunityPostNative(ctx,p,principal,{d,book,key,parent,...ports})
 if(p.phase==='post-native-original-register')return recordBountifulOpportunityConcentrationOriginal(ctx,p,principal,{d,parent,book,key,...ports})
 if(p.phase==='read'){
  if(!book)return reject('opportunity-sequence:issued-original-required')
  const rows=[];for(const row of book.rows){const fact=await load(ctx,'raw:'+row.requestId);if(fact&&(fact.roomId!==ctx.roomId||fact.parentId!==parent.id||fact.actorId!==row.actorId||fact.memberId!==row.memberId))return reject('opportunity-sequence:original-raw-scope-changed');rows.push({...row,originalIssuer:namespace(row.requestId,parent),...(fact?.raw?{raw:fact.raw}:{})})}
  return{ok:true,source:book.originalSource,rows,...(book.prefixSource?{prefixSource:book.prefixSource}:{}),prefixSettlementRolls:book.prefixSettlementRolls??[],...(book.movementSegments?{movementSegments:book.movementSegments}:{}),...(book.collectorSource?{collectorSource:book.collectorSource}:{}),...(book.collectorWindows?{collectorWindows:book.collectorWindows.map(({registrationSource,completion,postNativeScope,...row})=>({...row,...(row.complete&&completion?.source?{completionSource:completion.source}:{})})),...(book.collectorWindows.find(row=>!row.complete)?{collectorCheckpointSource:book.collectorWindows.find(row=>!row.complete).registrationSource}:{})}:{})}
 }
 if(p.phase==='record-prefix-source'&&book?.collectorWindows){
  const window=book.collectorWindows.find(row=>!row.complete),group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id)
  if(!window||group.length||!bountifulCollectorSourceMatches(book,p.source,parent,{actorId:window.actorId,windowIndex:window.windowIndex,mint:true},group,ports))return reject('opportunity-collector:authenticated-prefix-source-required')
  await save(ctx,key,{...book,prefixSource:p.source});return{ok:true}
 }
 if(p.phase==='append-parent-source'&&book?.collectorWindows){
  const window=book.collectorWindows.find(row=>!row.complete),group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id),first=group.find(row=>row.identity.occurrence===0)
  if(!window||!first||first.originalAdapterId!=='opportunity-move-sequence'||group.some(row=>row.consumed||!(row.hostReroll||!row.request.nativeLucky&&row.ownerDecisions.length===row.request.options.length))||!Number.isSafeInteger(p.rollCursor)||p.rollCursor<(first.continuation?.rollCursor??0)||!bountifulCollectorSourceMatches(book,p.source,parent,{actorId:window.actorId,windowIndex:window.windowIndex,mint:true},group,ports))return reject('opportunity-collector:authenticated-next-original-source-required')
  const stamp={roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:parent.id,beforeSignature:digest(first),sourceSignature:digest(p.source),rollCursor:p.rollCursor},stampKey='opportunity-sequence-continuation:'+parent.id+':'+stamp.sourceSignature,old=await load(ctx,stampKey);if(old&&!equal(old,stamp))return reject('opportunity-sequence:source-stamp-immutable');if(!old)await save(ctx,stampKey,stamp);return{ok:true}
 }
 if(p.phase==='record-prefix-source'){
  const source=bountifulOpportunitySequenceContinuationFacts(p.source),rows=book?.rows??[],group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id)
  if(!book||group.length||!source||source.transactionId!==parent.id||bountifulHostPreparedWireSignature(p.source)!==book.preparedSignature||!Array.isArray(source.rawBook)||source.rawBook.length!==rows.length||!rows.length||!equal(Object.keys(source.attacks??{}),rows.map(row=>row.actorId)))return reject('opportunity-sequence:exact-prefix-source-required')
  for(let index=0;index<rows.length;index++){
   const slot=rows[index],raw=source.rawBook[index],ns=namespace(slot.requestId,parent),attack=source.attacks[slot.actorId],settlement=(book.prefixSettlementRolls??[]).filter(row=>row.spec.actorId===slot.actorId),damage=settlement.flatMap(row=>row.values??[])
   if(!slot.confirmed||!ns||!equal(raw,{actorId:slot.actorId,values:slot.confirmed.values,hostOriginalRollId:slot.requestId,hostOriginalRollIssuerMode:ns.mode,hostOriginalDiceCursor:ns.cursor})||!attack||!Array.isArray(attack.damageRolls)||settlement.some(row=>!row.values)&&attack.damageRolls.length||!equal(attack,{d20:slot.confirmed.values[0],...(slot.confirmed.values.length===2?{d20Second:slot.confirmed.values[1]}:{}),damageRolls:attack.damageRolls})||attack.damageRolls.length&&!equal(attack.damageRolls,damage))return reject('opportunity-sequence:authenticated-prefix-damage-required')
   const before=bountifulOpportunitySequenceContinuationFacts(book.prefixSource)?.attacks?.[slot.actorId]
   if(before?.damageRolls?.length&&!equal(before,attack))return reject('opportunity-sequence:prefix-damage-immutable')
  }
  await save(ctx,key,{...book,prefixSource:p.source});return{ok:true}
 }
 if(p.phase==='append-parent-source'){
  const group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id),first=group.find(row=>row.identity.occurrence===0),before=first?.continuation?.source??first?.originalParent,a=bountifulOpportunitySequenceContinuationFacts(before),b=bountifulOpportunitySequenceContinuationFacts(p.source),record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
  if(!book||!first||first.originalAdapterId!=='opportunity-move-sequence'||group.some(row=>row.consumed||!(row.hostReroll||!row.request.nativeLucky&&row.ownerDecisions.length===row.request.options.length))||!a||!b||a.transactionId!==parent.id||b.transactionId!==parent.id||bountifulHostPreparedWireSignature(before)!==book.preparedSignature||bountifulHostPreparedWireSignature(p.source)!==book.preparedSignature||!record(a.attacks)||!record(b.attacks)||!Array.isArray(a.rawBook)||!Array.isArray(b.rawBook)||b.rawBook.length!==a.rawBook.length+1||b.rawBook.length>book.rows.length||!equal(a.rawBook,b.rawBook.slice(0,a.rawBook.length))||!Number.isSafeInteger(p.rollCursor)||p.rollCursor<1||p.rollCursor<(first.continuation?.rollCursor??0))return reject('opportunity-sequence:exact-next-original-source-required')
  for(let i=0;i<b.rawBook.length;i++){const raw=b.rawBook[i],slot=book.rows[i],ns=slot&&namespace(slot.requestId,parent);if(!slot?.confirmed||!ns||!record(raw)||Object.keys(raw).some(key=>!['actorId','values','hostOriginalRollIssuerMode','hostOriginalRollId','hostOriginalDiceCursor'].includes(key))||raw.actorId!==slot.actorId||!equal(raw.values,slot.confirmed.values)||raw.hostOriginalRollId!==slot.requestId||raw.hostOriginalRollIssuerMode!==ns.mode||raw.hostOriginalDiceCursor!==ns.cursor||p.rollCursor<ns.cursor)return reject('opportunity-sequence:authenticated-original-book-required')}
  const previousIds=a.rawBook.map(row=>row.actorId),ids=b.rawBook.map(row=>row.actorId),actor=ids.at(-1),slot=book.rows[b.rawBook.length-1],added=b.attacks[actor],expected={d20:slot.confirmed.values[0],...(slot.confirmed.values.length===2?{d20Second:slot.confirmed.values[1]}:{}),damageRolls:[]}
  if(!equal(Object.keys(a.attacks),previousIds)||!equal(Object.keys(b.attacks),ids)||previousIds.some(id=>!equal(a.attacks[id],b.attacks[id]))||!equal(added,expected))return reject('opportunity-sequence:append-one-authenticated-original-required')
  const stamp={roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:parent.id,beforeSignature:digest(first),sourceSignature:digest(p.source),rollCursor:p.rollCursor},key='opportunity-sequence-continuation:'+parent.id+':'+stamp.sourceSignature,old=await load(ctx,key)
  if(old&&!equal(old,stamp))return reject('opportunity-sequence:source-stamp-immutable')
  if(!old)await save(ctx,key,stamp)
  return{ok:true}
 }
 if(p.phase==='record-late-source'){
  const group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id),first=group.find(row=>row.identity.occurrence===0),before=first?.continuation?.source??first?.originalParent,a=bountifulOpportunitySequenceContinuationFacts(before),b=bountifulOpportunitySequenceContinuationFacts(p.source),actor=p.actorId,record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
  if(!book||!first||first.originalAdapterId!=='opportunity-move-sequence'||group.some(row=>row.consumed||!(row.hostReroll||!row.request.nativeLucky&&row.ownerDecisions.length===row.request.options.length))||!a||!b||a.transactionId!==parent.id||b.transactionId!==parent.id||bountifulHostPreparedWireSignature(before)!==book.preparedSignature||bountifulHostPreparedWireSignature(p.source)!==book.preparedSignature||!record(a.attacks)||!record(b.attacks)||!Array.isArray(a.rawBook)||!equal(a.rawBook,b.rawBook)||a.rawBook.at(-1)?.actorId!==actor||!equal(Object.keys(a.attacks),Object.keys(b.attacks))||!Number.isSafeInteger(p.rollCursor)||p.rollCursor<(first.continuation?.rollCursor??a.rawBook.at(-1)?.hostOriginalDiceCursor??1))return reject('opportunity-sequence:exact-late-source-required')
  const old=a.attacks[actor],next=b.attacks[actor],rows=(first.opportunitySettlementRolls??[]).filter(row=>row.spec.phase==='attack-late'&&row.spec.actorId===actor&&row.spec.rollKind==='damage')
  if(!record(old)||!record(next)||!Array.isArray(old.damageRolls)||old.damageRolls.length||!rows.length||rows.some(row=>!Array.isArray(row.values))||!equal(next,{...old,damageRolls:rows.flatMap(row=>row.values)})||Object.keys(a.attacks).some(id=>id!==actor&&!equal(a.attacks[id],b.attacks[id])))return reject('opportunity-sequence:exact-confirmed-damage-required')
  const stamp={roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:parent.id,beforeSignature:digest(first),sourceSignature:digest(p.source),rollCursor:p.rollCursor},key='opportunity-sequence-continuation:'+parent.id+':'+stamp.sourceSignature,prior=await load(ctx,key)
  if(prior&&!equal(prior,stamp))return reject('opportunity-sequence:source-stamp-immutable');if(!prior)await save(ctx,key,stamp);return{ok:true}
 }
 if(p.phase==='host-raw'){
  const row=book?.rows.find(row=>row.requestId===p.requestId),issued=row&&await load(ctx,'opportunity:'+row.requestId)
  if(!row||!issued||row.memberId!==principal.memberId||issued.memberId!==principal.memberId||issued.hostMemberId!==principal.memberId||issued.parentId!==parent.id||issued.actorId!==row.actorId||issued.count!==row.count||!equal(issued.originalRoomAction,parent)||!faces(p.rawValues,row.count))return reject('opportunity-sequence:actual-host-original-pool-required')
  const expected={schemaVersion:1,roomId:ctx.roomId,hostMemberId:principal.memberId,mapId:parent.mapId,combatId:parent.combatId,parentId:parent.id,requestId:row.requestId,actorId:row.actorId,...(row.characterId?{characterId:row.characterId}:{}),memberId:principal.memberId,kind:'attack',count:row.count,originalRoomAction:parent,versions},prior=await load(ctx,'raw:'+row.requestId),raw={memberId:principal.memberId,values:[...p.rawValues]}
  if(prior){const{raw:before,...identity}=prior;if(!equal(identity,expected)||before&&!equal(before,raw))return reject('opportunity-sequence:host-original-raw-immutable')}
  if(!prior?.raw)await save(ctx,'raw:'+row.requestId,{...expected,raw})
  return{ok:true}
 }
 if(p.phase==='confirm'){
  const index=book?.rows.findIndex(row=>row.requestId===p.requestId)??-1,row=index>=0?book.rows[index]:null,raw=row&&await load(ctx,'raw:'+p.requestId)
  if(!row||!raw?.raw||raw.roomId!==ctx.roomId||raw.hostMemberId!==principal.memberId||raw.parentId!==parent.id||raw.actorId!==row.actorId||raw.raw.memberId!==row.memberId||!faces(p.rawValues,row.count)||!equal(raw.raw.values,p.rawValues)||!faces(p.values,row.count))return reject('opportunity-sequence:actual-raw-confirmation-required')
  const confirmed={memberId:principal.memberId,rawValues:[...p.rawValues],values:[...p.values]}
  if(row.confirmed&&!equal(row.confirmed,confirmed))return reject('opportunity-sequence:confirmation-immutable')
  if(!row.confirmed)await save(ctx,key,{...book,rows:book.rows.map((item,i)=>i===index?{...item,confirmed}:item)})
  return{ok:true}
 }
 if(p.phase!=='issue')return reject('opportunity-sequence:actual-phase-required')
 const f=bountifulOpportunitySequenceSourceFacts(p.source),signature=bountifulHostPreparedWireSignature(p.source),r=f?.pending
 if(!f||!signature||!r||!equal(f.action,parent)||!equal(f.input.action,parent)||!equal(f.initialAction,parent)||!equal(r.originalAction,parent)||r.parentId!==parent.id||!equal(f.map,map)||!equal(f.input.map,map)||!equal(f.initialMap,map)||!equal(f.characters,d.characters?.characters)||!equal(f.input.characters,d.characters?.characters)||!equal(f.initialCharacters,d.characters?.characters)||f.combatId!==parent.combatId||f.round!==parent.round||f.initiativeIndex!==parent.initiativeIndex||!Number.isSafeInteger(f.firstHostNow)||f.firstHostNow<1||!Number.isInteger(r.windowIndex)||r.windowIndex<0||r.windowIndex>=map.tokens.length||!Array.isArray(f.preceding)||f.preceding.length!==r.windowIndex||r.targetTokenId!==parent.actorTokenId||r.actorTokenId===parent.actorTokenId||!['normal','advantage','disadvantage'].includes(r.rollMode)||p.count!==(r.rollMode==='normal'?1:2)||!equal(namespace(p.rawRollId,parent),{mode:p.issuerMode,cursor:p.rawCursor}))return reject('opportunity-sequence:actual-native-checkpoint-required')
 const commandDoc=await doc(ctx,'combat-command-receipts'),record=commandDoc?.commands?.find(x=>x.commandId===parent.id),receipt=commandDoc?.receipts?.find(x=>x.commandId===parent.id),command=record?.command,token=map.tokens.find(t=>t.id===parent.actorTokenId)
 if(!record||receipt?.status!=='pending'||record.actionId!==parent.id||record.submittedByMemberId!==parent.roomMemberId||record.submittedByRole!==parent.sourceMode||record.fingerprint!==receipt.fingerprint||command?.type!=='move-token'||command.commandId!==parent.id||!equal(command.targetPosition,parent.targetPosition)||!equal(command.expectedPosition,{x:token?.x,y:token?.y}))return reject('opportunity-sequence:actual-pending-command-required')
 for(const[id,turn]of Object.entries(f.turns)){const stored=d.combat.dnd5eTurnEconomyByToken?.[id];if(stored&&(turn.reactionAvailable!==(stored.reaction.current>0)||turn.actionAvailable!==(stored.action.current>0)||turn.bonusActionAvailable!==(stored.bonusAction.current>0)||turn.movementRemaining!==stored.movement.current))return reject('opportunity-sequence:stale-original-economy')}
 const owned=controller(d,parent.mapId,r.actorTokenId,ctx.roomId)??hostPoolController(d,parent.mapId,r.actorTokenId)
 if(!owned)return reject('opportunity-sequence:canonical-roller-required')
 if(book&&book.preparedSignature!==signature)return reject('opportunity-sequence:original-immutable')
 const rows=book?.rows??[]
 if(book?.collectorWindows){
  const window=book.collectorWindows[r.windowIndex],previous=bountifulOpportunitySequenceContinuationFacts(book.collectorSource)
  if(!window||window.complete||window.actorId!==r.actorTokenId||book.collectorWindows.slice(0,r.windowIndex).some(row=>!row.complete)||r.windowIndex>0&&(!previous||f.preceding.some((row,i)=>row?.actorTokenId!==book.collectorWindows[i]?.actorId||!equal(row?.rolls,previous.attacks[row?.actorTokenId]))))return reject('opportunity-collector:completed-preceding-window-required')
 }else{
 if(r.windowIndex>rows.length)return reject('opportunity-sequence:next-window-order-required')
 for(let i=0;i<r.windowIndex;i++){const previous=rows[i],actual=f.preceding[i],rolls=actual?.rolls;if(!previous?.confirmed||actual.actorTokenId!==previous.actorId||!equal(rolls?.d20Second===undefined?[rolls?.d20]:[rolls?.d20,rolls.d20Second],previous.confirmed.values))return reject('opportunity-sequence:confirmed-preceding-original-required')}
 const pendingParent=Object.values(d.combat.bountifulOriginalParents??{}).find(row=>row.originalAdapterId==='opportunity-move-sequence'&&row.identity?.parentId===parent.id&&row.identity.occurrence===0)
 if(pendingParent&&r.windowIndex>0){const current=bountifulOpportunitySequenceContinuationFacts(pendingParent.continuation?.source??pendingParent.originalParent);if(!current||f.preceding.some(row=>!equal(current.attacks?.[row.actorTokenId],row.rolls)))return reject('opportunity-sequence:changed-preceding-native-source')}
 if(!pendingParent&&f.preceding.some(row=>row.rolls?.damageRolls?.length)){const prefix=bountifulOpportunitySequenceContinuationFacts(book?.prefixSource);if(!prefix||f.preceding.some(row=>!equal(prefix.attacks?.[row.actorTokenId],row.rolls)))return reject('opportunity-sequence:authenticated-prefix-damage-required')}
 }
 const mm=book?.collectorWindows?await authenticateMastermindOpportunityChoice(ctx,{d,parent,book,windowIndex:r.windowIndex,actorId:r.actorTokenId,use:r.coverAttackRedirect},ports):r.coverAttackRedirect===undefined?{ok:true}:null
 if(!mm)return reject('opportunity-collector:authenticated-Misdirection-choice-required')
 const fact={schemaVersion:1,roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:parent.id,actorId:owned.token.id,...(owned.character?{characterId:owned.character.id}:{}),memberId:owned.character?.roomMemberId??principal.memberId,kind:'attack',count:p.count,originalRoomAction:parent,preparedSignature:signature,versions},slot={requestId:p.rawRollId,actorId:fact.actorId,characterId:fact.characterId,memberId:fact.memberId,count:p.count,windowIndex:r.windowIndex,sourceDigest:digest(p.source)}
 const existingSlot=rows.find(row=>row.windowIndex===r.windowIndex)
 if(existingSlot){const{confirmed,...before}=existingSlot;void confirmed;if(!equal(before,slot))return reject('opportunity-sequence:original-slot-immutable')}
 else if(rows.some(x=>x.requestId===p.rawRollId||x.actorId===fact.actorId))return reject('opportunity-sequence:duplicate-original-required')
 const existing=await load(ctx,'opportunity:'+p.rawRollId);if(existing&&!equal(existing,fact))return reject('opportunity-sequence:original-source-immutable')
 if(!existing)await save(ctx,'opportunity:'+p.rawRollId,fact)
 if(!existingSlot)await save(ctx,key,{...book,...(book?.collectorWindows?{collectorWindows:book.collectorWindows.map(row=>row.windowIndex===r.windowIndex?{...row,mode:r.rollMode,...(mm.witness?{misdirectionWitness:mm.witness}:{})}:row)}:{}),schemaVersion:1,roomId:ctx.roomId,hostMemberId:principal.memberId,originalRoomAction:parent,preparedSignature:signature,originalSource:book?.originalSource??p.source,versions,economySignature:JSON.stringify(d.combat.dnd5eTurnEconomyByToken??{}),rows:[...rows,slot]})
 return{ok:true}
}
