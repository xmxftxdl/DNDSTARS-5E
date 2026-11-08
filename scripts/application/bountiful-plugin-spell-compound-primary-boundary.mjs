import {validateBountifulLuckCommand} from '../../shared/bountiful-luck-state.mjs'

const resources=['characters','maps','combat','player-action-requests','campaign-time','map-geometry','player-action-processed','player-action-ack']
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const omit=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)))
const immutable=row=>omit(row,['ownerDecisions','rawReroll','hostReroll','processedRequestIds','consumed','continuation','postOriginalD20','postOriginalEquipmentD20','postOriginalCursor','opportunitySettlementRolls','nativeLuckyDecision'])

/** Captured only while the primary's private register validates the real queued
 * source. A caller cannot supply or replace these eight persisted documents. */
export async function captureBountifulPluginSpellCompoundPrimaryDependencies(ctx,api){
 const docs=await Promise.all(resources.map(name=>api.doc(ctx,name)))
 return Object.fromEntries(resources.map((name,index)=>[name,{signature:JSON.stringify(docs[index]??null),revision:docs[index]?._sync?.revision??0}]))
}

function meta(before,after,api){
 return object(before)&&object(after)&&object(before._sync)&&object(after._sync)&&after._sync.schemaVersion===before._sync.schemaVersion&&Number.isSafeInteger(after._sync.revision)&&after._sync.revision>=before._sync.revision&&typeof after._sync.writerId==='string'&&!!after._sync.writerId&&Number.isFinite(after._sync.writtenAt)&&api.equal(omit(before._sync,['revision','writerId','writtenAt']),omit(after._sync,['revision','writerId','writtenAt']))
}

async function original(ctx,id,row,book,action,api,saving){
 const i=row?.identity,attack=row?.request?.kind==='attack',slot=attack?book.rows?.[0]:row?.request?.kind==='saving-throw'&&saving?.rows?.find(slot=>slot.requestId===row.rawIssuer?.rollId),stamp=await api.load(ctx,'original:'+id)
 return !!i&&!row.consumed&&id===JSON.stringify(['bountiful-original-parent',book.parentId,i.occurrence])&&Number.isSafeInteger(i.occurrence)&&i.occurrence>=0&&i.parentId===book.parentId&&i.mapId===book.mapId&&i.combatId===book.combatId&&i.roomId===book.roomId&&i.hostMemberId===book.hostMemberId&&i.effectTimestamp===book.effectTimestamp&&row.originalAdapterId==='plugin-spell'&&api.equal(row.originalRoomAction,action)&&slot?.raw&&slot.confirmed&&row.rawIssuer?.mode==='dm'&&row.rawIssuer.rollId===slot.requestId&&row.rawIssuer.cursor===slot.index+1&&row.request.actorId===slot.actorId&&api.equal(row.request.originalRolls,slot.confirmed.values)&&stamp?.roomId===book.roomId&&stamp.memberId===book.hostMemberId&&stamp.identity===api.digest(immutable(row))&&api.equal(stamp.raw,slot.raw)&&api.equal(stamp.adopted,slot.confirmed)
}

async function commands(ctx,before,after,book,combat,api,pending){
 if(!meta(before,after,api)||!Array.isArray(before.requests)||!Array.isArray(after.requests)||after.requests.length<before.requests.length||!api.equal(before.requests,after.requests.slice(0,before.requests.length))||!api.equal(omit(before,['_sync','updatedAt','requests','mapId','combatId']),omit(after,['_sync','updatedAt','requests','mapId','combatId'])))return false
 const added=after.requests.slice(before.requests.length),done=added.filter(action=>action.status==='done').length
 if(after._sync.revision!==before._sync.revision+added.length+done||after.updatedAt!==undefined&&(!Number.isFinite(after.updatedAt)||after.updatedAt<0)||new Set(after.requests.map(action=>action.id)).size!==after.requests.length)return false
 if(added.length?(after.mapId!==book.mapId||after.combatId!==book.combatId):!api.equal({mapId:before.mapId,combatId:before.combatId},{mapId:after.mapId,combatId:after.combatId}))return false
 for(const [index,action] of added.entries()){
  const scope=action.bountifulLuck,command=scope?.command,row=scope&&combat.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',book.parentId,scope.occurrence])]
  let fact=await api.load(ctx,'command:'+action.id)
  // Only the router's exact locked append call may witness its own new tail.
  // The ordinary reader always calls this function without pending.
  if(!fact&&pending&&index===added.length-1&&pending.principal.memberId===action.roomMemberId&&pending.principal.role===(action.sourceMode==='player'?'player':'dm')&&api.equal(pending.action,action))fact={roomId:ctx.roomId,memberId:pending.principal.memberId,action}
  if(!validateBountifulLuckCommand(scope)||scope.parentId!==book.parentId||!row||row.consumed||row.identity.effectTimestamp!==book.effectTimestamp||row.identity.roomId!==book.roomId||row.identity.hostMemberId!==book.hostMemberId||action.type!=='dnd5e-bountiful-luck'||action.mapId!==book.mapId||action.combatId!==book.combatId||!['pending','done'].includes(action.status)||action.status==='done'&&!row.processedRequestIds.includes(action.id)||!fact||fact.roomId!==book.roomId||fact.memberId!==action.roomMemberId||!api.equal(fact.action,action.status==='done'?{...action,status:'pending'}:action))return false
  if(command.phase==='reaction'){
   const owner=row.controllers?.[command.ownerId]
   if(!owner||owner.memberId!==action.roomMemberId||owner.characterId!==action.characterId||action.actorTokenId!==command.ownerId||!row.request.options.some(option=>option.ownerId===command.ownerId&&option.featureId===command.featureId))return false
  }else if(command.phase==='roll'||command.phase==='native-lucky'){
   if(command.phase==='native-lucky'&&!row.request.nativeLucky||action.roomMemberId!==row.identity.roller.memberId||action.actorTokenId!==row.identity.roller.tokenId||action.characterId!==row.identity.roller.characterId)return false
  }else if(command.phase==='confirm'){
   if(action.sourceMode!=='dm'||action.roomMemberId!==book.hostMemberId||action.actorTokenId!==row.identity.roller.tokenId)return false
  }else return false
 }
 return true
}

/** Independent primary-family eight-document reader. It does not relax W's
 * reader or issue raw/ready authority. Only stamped attack metadata, subsequent
 * Saving metadata tied to this exact private primary book, and this parent's
 * exact commands may explain changes to combat and the queue. */
export async function bountifulPluginSpellCompoundPrimaryDependenciesCurrent(ctx,book,principal,api,pending){
 if(principal.role!=='dm'||principal.memberId!==book.hostMemberId||book.roomId!==ctx.roomId)return false
 const dependencies=book.dependencies
 if(!object(dependencies)||Object.keys(dependencies).length!==resources.length)return false
 const docs=await Promise.all(resources.map(name=>api.doc(ctx,name))),current=Object.fromEntries(resources.map((name,index)=>[name,docs[index]??null]))
 for(const name of resources){const before=dependencies[name];if(!object(before)||typeof before.signature!=='string'||!Number.isSafeInteger(before.revision)||before.revision<0)return false;if(!['combat','player-action-requests'].includes(name)&&JSON.stringify(current[name])!==before.signature)return false}
 let beforeCombat,beforeQueue
 try{beforeCombat=JSON.parse(dependencies.combat.signature);beforeQueue=JSON.parse(dependencies['player-action-requests'].signature)}catch{return false}
 const combat=current.combat,queue=current['player-action-requests'],action=beforeQueue?.requests?.find(action=>action.id===book.parentId)
 if(!action||beforeQueue.requests.filter(action=>action.id===book.parentId).length!==1||!api.equal(queue?.requests?.filter(action=>action.id===book.parentId),[action]))return false
 if(JSON.stringify(combat)!==dependencies.combat.signature){
  if(!meta(beforeCombat,combat,api)||!api.equal(omit(beforeCombat,['_sync','updatedAt','bountifulOriginalParents']),omit(combat,['_sync','updatedAt','bountifulOriginalParents'])))return false
  const prior=beforeCombat.bountifulOriginalParents??{},now=combat.bountifulOriginalParents??{}
  const saving=await api.load(ctx,'plugin-spell-saving-original:'+book.parentId)
  if(saving&&(saving.schemaVersion!==1||saving.sourceKind!=='plugin-spell-saving-original-v1'||saving.roomId!==book.roomId||saving.hostMemberId!==book.hostMemberId||saving.effectTimestamp!==book.effectTimestamp||['parentId','mapId','combatId'].some(key=>saving[key]!==book[key])||!api.equal(saving.primaryAnchor?.book,{ok:true,...book})))return false
  let changed=false,metadataWrites=0
  for(const id of new Set([...Object.keys(prior),...Object.keys(now)])){
   if(api.equal(prior[id],now[id]))continue
   changed=true
   if(prior[id]||!await original(ctx,id,now[id],book,action,api,saving))return false
   const row=now[id],processed=row.processedRequestIds
   if(!Array.isArray(processed)||new Set(processed).size!==processed.length)return false
   for(const requestId of processed){const command=queue.requests.find(action=>action.id===requestId);if(!command||command.status!=='done'||command.bountifulLuck?.parentId!==book.parentId||command.bountifulLuck.occurrence!==row.identity.occurrence)return false}
   metadataWrites+=1+processed.length
  }
  if(!changed||combat._sync.revision!==beforeCombat._sync.revision+metadataWrites)return false
 }
 return JSON.stringify(queue)===dependencies['player-action-requests'].signature||commands(ctx,beforeQueue,queue,book,combat,api,pending)
}
