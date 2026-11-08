import{bountifulOpportunityMovementSegmentSettlementSource,validBountifulOpportunitySettlementSpec}from'../../shared/bountiful-opportunity-settlement.mjs'
import{bountifulHostPreparedWireSignature}from'../../shared/bountiful-host-operation.mjs'
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const ready=row=>!row.consumed&&(row.request.nativeLucky?!!row.hostReroll:row.ownerDecisions.some(choice=>choice.decision==='use')?!!row.hostReroll:row.ownerDecisions.length===row.request.options.length)
/** Authenticated original faces and ordering only. Never accepts a state,
 * result, DC or fake opportunity actor/window for a real movement operation. */
async function authenticatedPools(ctx,operation,book,parent,{equal,digest,load}){
 const segment=book.movementSegments?.find(row=>row.segmentIndex===operation.segmentIndex),projection=segment&&bountifulOpportunityMovementSegmentSettlementSource(segment.source,operation.segmentIndex)
 if(!segment?.registered||!projection||!equal(operation.source,segment.source)||operation.origin!=='concentration'&&operation.actorId!==parent.actorTokenId)return null
 let tuple;try{tuple=JSON.parse(operation.operationId);if(operation.origin==='concentration'){if(!Array.isArray(tuple)||tuple.length!==4||tuple[1]!=='concentration'||!Number.isSafeInteger(tuple[2])||tuple[2]<0||tuple[3]!==operation.actorId||typeof tuple[0]!=='string')return null;tuple=JSON.parse(tuple[0])}}catch{return null}
 if(!equal(tuple,[parent.id,'movement-segment',operation.segmentIndex,'item-area',tuple?.[4],tuple?.[5],operation.origin==='concentration'?parent.actorTokenId:operation.actorId])||!Number.isSafeInteger(tuple[4])||tuple[4]<0||typeof tuple[5]!=='string')return null
 const sourceMap=book.originalRoomAction.mapId,kind=operation.mode==='normal'?1:['advantage','disadvantage'].includes(operation.mode)?2:0
 if(sourceMap!==parent.mapId||!kind||!Array.isArray(operation.rawRequestIds)||operation.rawRequestIds.length<1||operation.rawRequestIds.length>kind||new Set(operation.rawRequestIds).size!==operation.rawRequestIds.length)return null
 const rows=operation.rawRequestIds.map(id=>book.prefixSettlementRolls?.find(row=>row.requestId===id));let previous,count=0
 for(const row of rows){
  if(!row)return null
  const spec=row.spec,fact=await load(ctx,'opportunity-settlement:'+row.requestId)
  if(!validBountifulOpportunitySettlementSpec(spec)||spec.parentId!==parent.id||spec.roomId!==ctx.roomId||spec.mapId!==parent.mapId||spec.combatId!==parent.combatId||spec.hostMemberId!==book.hostMemberId||spec.phase!=='movement-hazards'||spec.movementSegmentIndex!==operation.segmentIndex||spec.opportunityActorId!==undefined||spec.postNativeWindowIndex!==undefined||spec.actorId!==operation.actorId||![1,2].includes(spec.count)||spec.sides!==20||spec.rollKind!=='saving-throw'||spec.sourceDigest!=='sha256:'+digest(projection)||row.requestId!=='bountiful-opportunity-settlement:'+digest(spec)||previous!==undefined&&spec.ordinal!==previous+1||!fact||!equal(fact.spec,spec)||fact.raw?.memberId!==spec.memberId||fact.confirmed?.memberId!==book.hostMemberId||!equal(fact.raw.values,row.rawValues)||!equal(fact.confirmed.rawValues,row.rawValues)||!equal(fact.confirmed.values,row.values)||![row.rawValues,row.values].every(values=>Array.isArray(values)&&values.length===spec.count&&values.every(value=>Number.isInteger(value)&&value>=1&&value<=20)))return null
  previous=spec.ordinal;count+=spec.count
 }
 if(count!==kind)return null
 return{rows,segment,areaId:tuple[5],operationIndex:tuple[4],raw:rows.flatMap(row=>row.rawValues),adopted:rows.flatMap(row=>row.values)}
}
export async function recordBountifulOpportunityMovementOriginal(ctx,p,principal,{d,parent,map,book,key,...ports}){
 const{equal,save}=ports,reject=error=>({ok:false,status:403,error})
 if(!object(p)||Object.keys(p).some(name=>!['sourceKind','phase','parentId','mapId','combatId','segmentIndex','actorId','operationId','rawRequestIds','mode','source'].includes(name))||!['movement-original-register','movement-concentration-original-register'].includes(p.phase)||principal.role!=='dm'||principal.memberId!==book?.hostMemberId||book.roomId!==ctx.roomId||!Number.isSafeInteger(p.segmentIndex)||p.segmentIndex<0||typeof p.operationId!=='string'||typeof p.actorId!=='string')return reject('movement-original:exact-actual-operation-required')
 const operation={...(p.phase==='movement-concentration-original-register'?{origin:'concentration'}:{}),segmentIndex:p.segmentIndex,actorId:p.actorId,operationId:p.operationId,rawRequestIds:p.rawRequestIds,mode:p.mode,source:p.source},pools=await authenticatedPools(ctx,operation,book,parent,ports)
 if(!pools||!map?.dnd5eItemAreas?.some(area=>area.id===pools.areaId))return reject('movement-original:authenticated-original-pools-required')
 const prior=book.movementOriginals?.find(row=>row.operationId===p.operationId)
 if(prior)return equal(prior,operation)?{ok:true}:reject('movement-original:operation-immutable')
 const group=Object.values(d.combat.bountifulOriginalParents??{}).filter(row=>row.identity?.parentId===parent.id)
 if(pools.segment.complete||book.movementSegments.at(-1).segmentIndex!==p.segmentIndex||group.some(row=>row.originalAdapterId!=='opportunity-move-sequence'||!ready(row))||book.movementOriginals?.some(row=>row.rawRequestIds.some(id=>p.rawRequestIds.includes(id))))return reject('movement-original:ready-current-operation-required')
 await save(ctx,key,{...book,movementOriginals:[...book.movementOriginals??[],operation]});return{ok:true}
}
/** Dedicated saving first-mint evidence; failure never falls back to a
 * collector attack slot or a legacy raw namespace. */
export async function authenticatedBountifulMovementOriginal(ctx,row,parent,book,ports){
 const{equal}=ports;if(row.originalAdapterId!=='opportunity-move-sequence'||row.request.kind!=='saving-throw'||!book||!parent)return null
 const operation=book.movementOriginals?.find(operation=>operation.rawRequestIds[0]===row.rawIssuer?.rollId),first=Object.values(ports.current?.bountifulOriginalParents??{}).find(item=>item.identity?.parentId===parent.id&&item.identity.occurrence===0),source=row.identity.occurrence===0?row.originalParent:first?.continuation?.source??first?.originalParent
 if(!operation||operation.actorId!==row.request.actorId||!equal(operation.source,source)||row.identity.occurrence>0&&(!first||first.consumed||!equal(first.originalParent,row.originalParent))||bountifulHostPreparedWireSignature(row.originalParent)!==book.preparedSignature)return null
 const pools=await authenticatedPools(ctx,operation,book,parent,ports)
 if(!pools||row.rawIssuer.mode!=='dm'||row.rawIssuer.cursor!==pools.rows[0].spec.ordinal+1||!equal(pools.adopted,row.request.originalRolls)||pools.rows.some(item=>item.spec.memberId!==row.identity.roller.memberId||item.spec.characterId!==row.identity.roller.characterId))return null
 return{raw:{memberId:row.identity.roller.memberId,values:pools.raw},adopted:{memberId:row.identity.hostMemberId,values:pools.adopted}}
}
