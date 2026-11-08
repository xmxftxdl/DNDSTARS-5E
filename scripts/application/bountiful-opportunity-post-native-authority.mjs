import{bountifulOpportunityPostNativeSettlementSource,validBountifulOpportunitySettlementSpec}from'../../shared/bountiful-opportunity-settlement.mjs'
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const noBase=window=>window.originalState==='reaction-declined'
/** This is only an authenticated raw/adoption ledger and sequencing barrier.
 * It neither accepts a post-Base result/state nor issues a native/Base brand. */
export async function recordBountifulOpportunityPostNative(ctx,p,principal,{d,book,key,parent,...ports}){
 const{equal,digest,load,save}=ports,reject=error=>({ok:false,status:403,error})
 if(!object(p)||Object.keys(p).some(name=>!['sourceKind','phase','parentId','mapId','combatId','actorId','windowIndex','source'].includes(name))||!['post-native-register','post-native-complete'].includes(p.phase)||principal.role!=='dm'||principal.memberId!==book?.hostMemberId||book.roomId!==ctx.roomId||!Number.isSafeInteger(p.windowIndex)||p.windowIndex<0)return reject('opportunity-post-native:exact-completed-source-required')
 const windows=book.collectorWindows??[],window=windows[p.windowIndex],projection=window&&bountifulOpportunityPostNativeSettlementSource(window.completion?.source,p.actorId,p.windowIndex)
 if(!window?.complete||window.actorId!==p.actorId||noBase(window)||!equal(p.source,window.completion?.source)||!projection||parent.id!==p.parentId||parent.mapId!==p.mapId||parent.combatId!==p.combatId)return reject('opportunity-post-native:exact-completed-source-required')
 const group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id)
 if(group.some(row=>row.originalAdapterId!=='opportunity-move-sequence'||row.consumed||(row.request.nativeLucky?!row.hostReroll:row.ownerDecisions.some(choice=>choice.decision==='use')?!row.hostReroll:row.ownerDecisions.length!==row.request.options.length)))return reject('opportunity-post-native:ready-original-parent-required')
 const scope={actorId:p.actorId,windowIndex:p.windowIndex,sourceDigest:'sha256:'+digest(projection)}
 if(window.postNativeScope&&!equal(window.postNativeScope,scope))return reject('opportunity-post-native:issued-scope-immutable')
 if(p.phase==='post-native-register'){
  // A completed past scope can be reopened only as a read-only replay of its
  // already locked pools. It cannot mint a new ordinal or clear completion.
  if(window.postNativeRegistered)return{ok:true}
  if(windows.slice(0,p.windowIndex).some(row=>!row.complete||!noBase(row)&&row.postNativeComplete!==true)||windows.length!==p.windowIndex+1)return reject('opportunity-post-native:completed-preceding-stage-required')
  await save(ctx,key,{...book,postNativeEnabled:true,collectorWindows:windows.map((row,index)=>index===p.windowIndex?{...row,postNativeRegistered:true,postNativeScope:scope}:row)});return{ok:true}
 }
 if(!book.postNativeEnabled||!window.postNativeRegistered||!equal(window.postNativeScope,scope))return reject('opportunity-post-native:registered-stage-required')
 if(window.postNativeComplete)return{ok:true}
 const rows=(book.prefixSettlementRolls??[]).filter(row=>row.spec?.phase==='post-native'&&row.spec.postNativeWindowIndex===p.windowIndex)
 for(const row of rows){
  const spec=row.spec,fact=await load(ctx,'opportunity-settlement:'+row.requestId),faces=values=>Array.isArray(values)&&values.length===spec.count&&values.every(value=>Number.isInteger(value)&&value>=1&&value<=spec.sides)
  if(!validBountifulOpportunitySettlementSpec(spec)||spec.parentId!==parent.id||spec.roomId!==ctx.roomId||spec.mapId!==parent.mapId||spec.combatId!==parent.combatId||spec.hostMemberId!==book.hostMemberId||spec.opportunityActorId!==window.actorId||spec.sourceDigest!==scope.sourceDigest||row.requestId!=='bountiful-opportunity-settlement:'+digest(spec)||!faces(row.rawValues)||!faces(row.values)||!fact||!equal(fact.spec,spec)||fact.raw?.memberId!==spec.memberId||fact.confirmed?.memberId!==book.hostMemberId||!equal(fact.raw.values,row.rawValues)||!equal(fact.confirmed.rawValues,row.rawValues)||!equal(fact.confirmed.values,row.values))return reject('opportunity-post-native:authenticated-confirmed-pools-required')
 }
 await save(ctx,key,{...book,collectorWindows:windows.map((row,index)=>index===p.windowIndex?{...row,postNativeComplete:true}:row)});return{ok:true}
}
