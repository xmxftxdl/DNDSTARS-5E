import{bountifulOpportunitySequenceSourceFacts,bountifulOpportunityCollectorContinuationFacts}from'../../shared/bountiful-opportunity-sequence.mjs'
import{bountifulHostPreparedWireSignature}from'../../shared/bountiful-host-operation.mjs'
import{bountifulOpportunityMovementSegmentSettlementSource}from'../../shared/bountiful-opportunity-settlement.mjs'
const keys=(v,allowed)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k))
const publicCombat=c=>Object.fromEntries(Object.entries(c??{}).filter(([k])=>!['_sync','updatedAt','bountifulOriginalParents','bountifulReadyParents'].includes(k)))
const originalImmutable=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['ownerDecisions','rawReroll','hostReroll','processedRequestIds','consumed','continuation','postOriginalD20','postOriginalEquipmentD20','postOriginalCursor','opportunitySettlementRolls'].includes(k)))
export async function currentBountifulMovementOriginalGroup(ctx,d,parent,ports){
 const{load,digest}=ports,group=Object.values(d.combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parent.id),first=group.find(row=>row.identity.occurrence===0)
 if(!group.length)return true
 const original=first&&await load(ctx,'original:'+JSON.stringify(['bountiful-original-parent',parent.id,0]))
 return !!first&&first.originalAdapterId==='opportunity-move-sequence'&&!!original&&original.identity===digest(originalImmutable(first))&&!group.some(row=>row.consumed||(row.request.nativeLucky?!row.hostReroll:row.ownerDecisions.some(choice=>choice.decision==='use')?!row.hostReroll:row.ownerDecisions.length!==row.request.options.length))
}
/** Private ordering and independently authenticated pool ledger only. No state,
 * result, native completion or publication capability is accepted or issued. */
export async function recordBountifulOpportunityMovementSegment(ctx,p,principal,{d,parent,map,book,key,versions,clock,...ports}){
 const{save,load,doc,equal,digest}=ports,reject=error=>({ok:false,status:403,error}),index=p?.segmentIndex
 if(principal.role!=='dm'||!keys(p,['sourceKind','phase','parentId','mapId','combatId','segmentIndex','source'])||!['movement-segment-register','movement-segment-complete'].includes(p.phase)||!Number.isSafeInteger(index)||index<0||index>128)return reject('opportunity-movement-segment:exact-source-scope-required')
 const projection=bountifulOpportunityMovementSegmentSettlementSource(p.source,index),facts=bountifulOpportunityCollectorContinuationFacts(p.source),f=bountifulOpportunitySequenceSourceFacts(p.source),signature=bountifulHostPreparedWireSignature(p.source),segments=book?.movementSegments??[],scope=segments[index]
 if(!projection||!facts||facts.transactionId!==parent.id||!f||!signature||!equal(f.action,parent)||!equal(f.input.action,parent)||!equal(f.initialAction,parent)||!equal(f.map,map)||!equal(f.input.map,map)||!equal(f.initialMap,map)||!equal(f.characters,d.characters?.characters)||!equal(f.input.characters,d.characters?.characters)||!equal(f.initialCharacters,d.characters?.characters)||!equal(f.input.initiativeOrder,d.combat.initiativeOrder)||!equal(f.input.turnEconomyByToken,d.combat.dnd5eTurnEconomyByToken)||f.combatId!==parent.combatId||f.round!==parent.round||f.initiativeIndex!==parent.initiativeIndex||!Number.isSafeInteger(f.firstHostNow)||f.firstHostNow<1||book&&book.preparedSignature!==signature)return reject('opportunity-movement-segment:actual-original-prepared-required')
 const commands=await doc(ctx,'combat-command-receipts'),record=commands?.commands?.find(x=>x.commandId===parent.id),receipt=commands?.receipts?.find(x=>x.commandId===parent.id),command=record?.command,token=map.tokens.find(t=>t.id===parent.actorTokenId)
 if(!record||receipt?.status!=='pending'||record.actionId!==parent.id||record.submittedByMemberId!==parent.roomMemberId||record.submittedByRole!==parent.sourceMode||record.fingerprint!==receipt.fingerprint||command?.type!=='move-token'||command.commandId!==parent.id||command.actorTokenId!==parent.actorTokenId||command.characterId!==parent.characterId||command.mapId!==parent.mapId||command.combatId!==parent.combatId||command.round!==parent.round||command.initiativeIndex!==parent.initiativeIndex||!equal(command.targetPosition,parent.targetPosition)||!equal(command.expectedPosition,{x:token?.x,y:token?.y}))return reject('opportunity-movement-segment:actual-pending-command-required')
 if(scope){
  if(!equal(scope.source,p.source)||scope.segmentIndex!==index||!scope.registered)return reject('opportunity-movement-segment:registered-source-immutable')
  if(p.phase==='movement-segment-register'||scope.complete)return{ok:true}
 }else if(p.phase!=='movement-segment-register')return reject('opportunity-movement-segment:registered-source-required')
 if(!await currentBountifulMovementOriginalGroup(ctx,d,parent,ports))return reject('opportunity-movement-segment:ready-original-parent-required')
 const windows=book?.collectorWindows??[],previous=index>0?windows[index-1]:undefined
 if(index>segments.length||segments.slice(0,index).some(row=>!row.complete)||windows.length!==index||windows.some(row=>!row.complete||row.originalState!=='reaction-declined'&&row.postNativeComplete!==true)||index===0&&(facts.rawBook.length!==0||Object.keys(facts.attacks).length!==0||book?.rows?.length)||index>0&&(!previous?.completion?.source||!equal(previous.completion.source,p.source)))return reject('opportunity-movement-segment:completed-preceding-native-required')
 const rows=book?.prefixSettlementRolls??[],own=rows.filter(row=>row.spec.phase==='movement-hazards'&&row.spec.movementSegmentIndex===index)
 if(p.phase==='movement-segment-register'){
  if(index!==segments.length||rows.some(row=>!row.rawValues||!row.values))return reject('opportunity-movement-segment:confirmed-preceding-pools-required')
  const next={...book,schemaVersion:1,roomId:ctx.roomId,hostMemberId:principal.memberId,originalRoomAction:parent,preparedSignature:signature,originalSource:book?.originalSource??p.source,versions,economySignature:JSON.stringify(d.combat.dnd5eTurnEconomyByToken??{}),rows:book?.rows??[],collectorWindows:windows,collectorBinding:book?.collectorBinding??{clockRevision:clock?._sync?.revision??0,clockSignature:digest(Object.fromEntries(Object.entries(clock??{}).filter(([k])=>k!=='_sync'))),combat:publicCombat(d.combat)},movementEnabled:true,movementSegments:[...segments,{segmentIndex:index,registered:true,complete:false,source:p.source}]}
  await save(ctx,key,next);return{ok:true}
 }
 for(const row of own){const raw=await load(ctx,'opportunity-settlement:'+row.requestId);if(row.spec.sourceDigest!=='sha256:'+digest(projection)||!raw||!equal(raw.spec,row.spec)||raw.raw?.memberId!==row.spec.memberId||raw.confirmed?.memberId!==principal.memberId||!equal(raw.raw.values,row.rawValues)||!equal(raw.confirmed.values,row.values)||!equal(raw.confirmed.rawValues,row.rawValues))return reject('opportunity-movement-segment:authenticated-confirmed-pools-required')}
 if(rows.some(row=>!row.rawValues||!row.values))return reject('opportunity-movement-segment:complete-original-pools-required')
 await save(ctx,key,{...book,movementSegments:segments.map((row,i)=>i===index?{...row,complete:true}:row)});return{ok:true}
}
