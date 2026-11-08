import{bountifulOpportunityPostNativeSettlementSource,validBountifulOpportunitySettlementSpec}from'../../shared/bountiful-opportunity-settlement.mjs'
import{bountifulHostPreparedWireSignature}from'../../shared/bountiful-host-operation.mjs'
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const ready=row=>!row.consumed&&(row.request.nativeLucky?!!row.hostReroll:row.ownerDecisions.some(choice=>choice.decision==='use')?!!row.hostReroll:row.ownerDecisions.length===row.request.options.length)
/** Identity and authenticated original faces only. No state, result, DC,
 * native operation capability, reaction decision or world write is accepted. */
async function authenticatedPools(ctx,operation,book,parent,{equal,digest,load}){
 const window=book.collectorWindows?.[operation.windowIndex],projection=window&&bountifulOpportunityPostNativeSettlementSource(window.completion?.source,window.actorId,operation.windowIndex)
 if(!window?.complete||!window.postNativeRegistered||window.originalState==='reaction-declined'||!projection||!equal(operation.source,window.completion.source))return null
 let tuple;try{tuple=JSON.parse(operation.operationId)}catch{return null}
 if(!equal(tuple,[parent.id+':sequence-opportunity:'+operation.windowIndex+':'+window.actorId,'concentration',tuple?.[2],operation.actorId])||!Number.isSafeInteger(tuple[2])||tuple[2]<0)return null
 const count=operation.mode==='normal'?1:['advantage','disadvantage'].includes(operation.mode)?2:0
 if(!count||!Array.isArray(operation.rawRequestIds)||operation.rawRequestIds.length!==count||new Set(operation.rawRequestIds).size!==count)return null
 const rows=operation.rawRequestIds.map(id=>book.prefixSettlementRolls?.find(row=>row.requestId===id));let previous
 for(const row of rows){
  if(!row)return null
  const spec=row.spec,fact=await load(ctx,'opportunity-settlement:'+row.requestId)
  if(!validBountifulOpportunitySettlementSpec(spec)||spec.parentId!==parent.id||spec.roomId!==ctx.roomId||spec.mapId!==parent.mapId||spec.combatId!==parent.combatId||spec.hostMemberId!==book.hostMemberId||spec.phase!=='post-native'||spec.opportunityActorId!==window.actorId||spec.postNativeWindowIndex!==operation.windowIndex||spec.actorId!==operation.actorId||spec.count!==1||spec.sides!==20||spec.rollKind!=='saving-throw'||spec.sourceDigest!=='sha256:'+digest(projection)||row.requestId!=='bountiful-opportunity-settlement:'+digest(spec)||previous!==undefined&&spec.ordinal!==previous+1||!fact||!equal(fact.spec,spec)||fact.raw?.memberId!==spec.memberId||fact.confirmed?.memberId!==book.hostMemberId||!equal(fact.raw.values,row.rawValues)||!equal(fact.confirmed.rawValues,row.rawValues)||!equal(fact.confirmed.values,row.values)||![row.rawValues,row.values].every(values=>Array.isArray(values)&&values.length===1&&Number.isInteger(values[0])&&values[0]>=1&&values[0]<=20))return null
  previous=spec.ordinal
 }
 return{rows,window,raw:rows.flatMap(row=>row.rawValues),adopted:rows.flatMap(row=>row.values)}
}
export async function recordBountifulOpportunityConcentrationOriginal(ctx,p,principal,{d,parent,book,key,...ports}){
 const{equal,save}=ports,reject=error=>({ok:false,status:403,error})
 if(!object(p)||Object.keys(p).some(name=>!['sourceKind','phase','parentId','mapId','combatId','windowIndex','actorId','operationId','rawRequestIds','mode','source'].includes(name))||p.phase!=='post-native-original-register'||principal.role!=='dm'||principal.memberId!==book?.hostMemberId||book.roomId!==ctx.roomId||!Number.isSafeInteger(p.windowIndex)||p.windowIndex<0||typeof p.operationId!=='string'||typeof p.actorId!=='string')return reject('opportunity-CON-original:exact-actual-operation-required')
 const operation={windowIndex:p.windowIndex,actorId:p.actorId,operationId:p.operationId,rawRequestIds:p.rawRequestIds,mode:p.mode,source:p.source},pools=await authenticatedPools(ctx,operation,book,parent,ports)
 if(!pools)return reject('opportunity-CON-original:authenticated-original-pools-required')
 const prior=book.concentrationOriginals?.find(row=>row.operationId===p.operationId)
 if(prior)return equal(prior,operation)?{ok:true}:reject('opportunity-CON-original:operation-immutable')
 const group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id)
 if(pools.window.postNativeComplete||group.some(row=>row.originalAdapterId!=='opportunity-move-sequence'||!ready(row))||book.concentrationOriginals?.some(row=>row.rawRequestIds.some(id=>p.rawRequestIds.includes(id))))return reject('opportunity-CON-original:ready-current-operation-required')
 await save(ctx,key,{...book,concentrationOriginals:[...book.concentrationOriginals??[],operation]});return{ok:true}
}
/** Called only after the ordinary first-mint parent/version/clock guards. */
export async function authenticatedBountifulConcentrationOriginal(ctx,row,parent,book,ports){
 const{equal}=ports
 if(row.originalAdapterId!=='opportunity-move-sequence'||row.request.kind!=='saving-throw'||!book)return null
 const operation=book.concentrationOriginals?.find(operation=>operation.rawRequestIds[0]===row.rawIssuer?.rollId)
 const first=Object.values(ports.current?.bountifulOriginalParents??{}).find(item=>item.identity?.parentId===parent?.id&&item.identity.occurrence===0),source=row.identity.occurrence===0?row.originalParent:first?.continuation?.source??first?.originalParent
 if(!operation||!parent||operation.actorId!==row.request.actorId||!equal(operation.source,source)||row.identity.occurrence>0&&(!first||first.consumed||!equal(first.originalParent,row.originalParent))||bountifulHostPreparedWireSignature(row.originalParent)!==book.preparedSignature)return null
 const pools=await authenticatedPools(ctx,operation,book,parent,ports)
 if(!pools||row.rawIssuer.mode!=='dm'||row.rawIssuer.cursor!==pools.rows[0].spec.ordinal+1||!equal(pools.adopted,row.request.originalRolls)||pools.rows.some(item=>item.spec.memberId!==row.identity.roller.memberId||item.spec.characterId!==row.identity.roller.characterId))return null
 return{raw:{memberId:row.identity.roller.memberId,values:pools.raw},adopted:{memberId:row.identity.hostMemberId,values:pools.adopted}}
}
