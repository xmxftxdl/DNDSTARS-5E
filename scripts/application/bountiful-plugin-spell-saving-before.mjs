import{readTempestuousPluginOriginalPreparation}from'./tempestuous-plugin-original-authority.mjs'
import{tempestuousPluginOriginalSourceFacts}from'../../shared/tempestuous-plugin-original.mjs'
import{validateBountifulLuckCommand}from'../../shared/bountiful-luck-state.mjs'

const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const resources=['characters','maps','combat','player-action-requests','campaign-time','map-geometry','player-action-processed','player-action-ack']
const identity=p=>object(p)&&Object.keys(p).every(key=>['parentId','mapId','combatId','timing'].includes(key))&&p.timing==='before'&&['parentId','mapId','combatId'].every(key=>typeof p[key]==='string'&&p[key].length>0)
const ownerKey=p=>'tempestuous-plugin-preparation:'+p.parentId+':before'
const inputKey=p=>'tempestuous-plugin-original-inputs:'+p.parentId
const omit=(value,names)=>Object.fromEntries(Object.entries(value).filter(([key])=>!names.includes(key)))
const immutableOriginal=row=>omit(row,['ownerDecisions','rawReroll','hostReroll','processedRequestIds','consumed','continuation','postOriginalD20','postOriginalEquipmentD20','postOriginalCursor','opportunitySettlementRolls','nativeLuckyDecision'])

/** This is graph comparison only. No DTO can issue a Native operation. */
function withoutRolls(wire){
 const indices=new Map(),nodes=[],rootId=wire.root.ref
 const visit=value=>{if(!object(value)||!Object.hasOwn(value,'ref'))return value;const old=value.ref;if(indices.has(old))return{ref:indices.get(old)};const at=nodes.length;indices.set(old,at);nodes.push(null);const node=wire.nodes[old];nodes[at]=node.kind==='array'?{kind:'array',items:node.items.map(visit)}:{kind:'object',entries:node.entries.filter(([name])=>old!==rootId||name!=='rolls').map(([name,item])=>[name,visit(item)])};return{ref:at}}
 const root=visit(wire.root);return{schemaVersion:1,root,nodes}
}

/** One finite low flight. Other W landing/Base transcripts retain their own
 * closed route until separately joined; no missing material is guessed. */
export async function captureBountifulSavingBeforeAnchor(ctx,id,source,effectTimestamp,principal,api){
 if(!identity(id))return null
 const book=await readTempestuousPluginOriginalPreparation(ctx,id,principal,api),facts=tempestuousPluginOriginalSourceFacts(source)
 if(!book.ok||!facts||book.ownerDecision?.decision?.kind!=='use'||book.effectTimestamp!==effectTimestamp||facts.source.now!==effectTimestamp||!api.equal(withoutRolls(source),withoutRolls(book.source)))return null
 const original=tempestuousPluginOriginalSourceFacts(book.source),selection=book.ownerDecision.decision.selection,ground=original?.actorState?.groundElevationFeet??0
 if(!selection||!Number.isFinite(selection.elevationFeet)||selection.elevationFeet<ground||selection.elevationFeet-ground>=10)return null
 const inputs=await api.load(ctx,inputKey(id))
 if(!inputs||inputs.stage!=='started'||typeof inputs.collectionId!=='string'||!inputs.collectionId||inputs.saveStarted!==undefined||inputs.roomId!==ctx.roomId||inputs.hostMemberId!==principal.memberId||inputs.effectTimestamp!==effectTimestamp||inputs.beforeBookSignature!==JSON.stringify(book))return null
 return{schemaVersion:1,identity:{...id},owner:book,inputs}
}

function exactDocumentMeta(before,after,api){
 if(!object(before)||!object(after)||!object(before._sync)||!object(after._sync)||after._sync.schemaVersion!==before._sync.schemaVersion||!Number.isSafeInteger(after._sync.revision)||after._sync.revision<before._sync.revision||typeof after._sync.writerId!=='string'||!after._sync.writerId||!Number.isFinite(after._sync.writtenAt))return false
 return api.equal(omit(before._sync,['revision','writerId','writtenAt']),omit(after._sync,['revision','writerId','writtenAt']))
}

async function queueOnlyAuthenticatedCommands(ctx,before,after,saving,combat,api,pending){
 if(!exactDocumentMeta(before,after,api)||!Array.isArray(before.requests)||!Array.isArray(after.requests)||after.requests.length<before.requests.length||!api.equal(before.requests,after.requests.slice(0,before.requests.length))||!api.equal(omit(before,['_sync','updatedAt','requests','mapId','combatId']),omit(after,['_sync','updatedAt','requests','mapId','combatId'])))return false
 const added=after.requests.slice(before.requests.length)
 const completed=added.filter(action=>action.status==='done').length
 if(after._sync.revision!==before._sync.revision+added.length+completed||after.updatedAt!==undefined&&(!Number.isFinite(after.updatedAt)||after.updatedAt<0)||new Set(after.requests.map(row=>row.id)).size!==after.requests.length)return false
 if(added.length?(after.mapId!==saving.mapId||after.combatId!==saving.combatId):!api.equal({mapId:before.mapId,combatId:before.combatId},{mapId:after.mapId,combatId:after.combatId}))return false
 for(const[index,action]of added.entries()){
  const scope=action.bountifulLuck,command=scope?.command,row=scope&&combat.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',saving.parentId,scope.occurrence])];let fact=await api.load(ctx,'command:'+action.id)
  if(!fact&&pending&&index===added.length-1&&pending.principal.memberId===action.roomMemberId&&pending.principal.role===(action.sourceMode==='player'?'player':'dm')&&api.equal(pending.action,action))fact={roomId:ctx.roomId,memberId:pending.principal.memberId,action}
  if(!validateBountifulLuckCommand(scope)||scope.parentId!==saving.parentId||!row||row.consumed||row.identity.parentId!==saving.parentId||row.identity.effectTimestamp!==saving.effectTimestamp||row.identity.roomId!==saving.roomId||row.identity.hostMemberId!==saving.hostMemberId||action.mapId!==saving.mapId||action.combatId!==saving.combatId||action.type!=='dnd5e-bountiful-luck'||!['pending','done'].includes(action.status)||action.status==='done'&&!row.processedRequestIds.includes(action.id)||!fact||fact.roomId!==saving.roomId||fact.memberId!==action.roomMemberId||!api.equal(fact.action,action.status==='done'?{...action,status:'pending'}:action))return false
  if(command.phase==='reaction'){
   const owner=row.controllers?.[command.ownerId]
   if(!owner||action.roomMemberId!==owner.memberId||action.actorTokenId!==command.ownerId||action.characterId!==owner.characterId||!row.request.options.some(option=>option.ownerId===command.ownerId&&option.featureId===command.featureId))return false
  }else if(command.phase==='native-lucky'||command.phase==='roll'){
   if(command.phase==='native-lucky'&&!row.request.nativeLucky||action.roomMemberId!==row.identity.roller.memberId||action.actorTokenId!==row.identity.roller.tokenId||action.characterId!==row.identity.roller.characterId)return false
  }else if(command.phase==='confirm'){
   if(action.roomMemberId!==saving.hostMemberId||action.sourceMode!=='dm'||action.actorTokenId!==row.identity.roller.tokenId)return false
  }else return false
 }
 return true
}

/** Independent Saving-family reader. The original W reader and eight-document
 * contract remain unchanged. Only private-stamped rows/commands of this exact
 * Saving parent may account for the two metadata documents. */
export async function bountifulSavingBeforeAnchorCurrent(ctx,saving,principal,api,pending){
 const anchor=saving.beforeAnchor;if(!anchor)return true
 if(anchor.schemaVersion!==1||!identity(anchor.identity)||anchor.identity.parentId!==saving.parentId||anchor.identity.mapId!==saving.mapId||anchor.identity.combatId!==saving.combatId||anchor.owner.effectTimestamp!==saving.effectTimestamp||anchor.owner.roomId!==saving.roomId||anchor.owner.hostMemberId!==saving.hostMemberId||principal.memberId!==saving.hostMemberId||principal.role!=='dm')return false
 const owner=await api.load(ctx,ownerKey(anchor.identity)),inputs=await api.load(ctx,inputKey(anchor.identity))
 if(!owner||!api.equal({ok:true,...owner},anchor.owner)||!api.equal(inputs,anchor.inputs))return false
 const docs=await Promise.all(resources.map(name=>api.doc(ctx,name))),current=Object.fromEntries(resources.map((name,index)=>[name,docs[index]])),dependencies=anchor.owner.scope?.publicDependencies
 if(!dependencies||Object.keys(dependencies).length!==resources.length)return false
 for(const name of resources){if(!object(dependencies[name])||typeof dependencies[name].signature!=='string')return false;if(!['combat','player-action-requests'].includes(name)&&JSON.stringify(current[name]??null)!==dependencies[name].signature)return false}
 let beforeCombat,beforeQueue;try{beforeCombat=JSON.parse(dependencies.combat.signature);beforeQueue=JSON.parse(dependencies['player-action-requests'].signature)}catch{return false}
 const combat=current.combat
 if(!exactDocumentMeta(beforeCombat,combat,api)||!api.equal(omit(beforeCombat,['_sync','updatedAt','bountifulOriginalParents']),omit(combat,['_sync','updatedAt','bountifulOriginalParents'])))return false
 const prior=beforeCombat.bountifulOriginalParents??{},now=combat.bountifulOriginalParents??{}
 for(const id of new Set([...Object.keys(prior),...Object.keys(now)])){
  if(api.equal(prior[id],now[id]))continue
  const row=now[id],slot=saving.rows.find(slot=>slot.requestId===row?.rawIssuer?.rollId),stamp=await api.load(ctx,'original:'+id)
  if(prior[id]||!row||row.consumed||id!==JSON.stringify(['bountiful-original-parent',saving.parentId,row.identity.occurrence])||row.identity.parentId!==saving.parentId||row.identity.mapId!==saving.mapId||row.identity.combatId!==saving.combatId||row.identity.effectTimestamp!==saving.effectTimestamp||row.identity.roomId!==saving.roomId||row.identity.hostMemberId!==saving.hostMemberId||row.originalAdapterId!=='plugin-spell'||row.request.kind!=='saving-throw'||!slot?.raw||!slot.confirmed||row.rawIssuer.mode!=='dm'||row.rawIssuer.cursor!==slot.index+1||row.request.actorId!==slot.actorId||!stamp||stamp.roomId!==saving.roomId||stamp.memberId!==saving.hostMemberId||stamp.identity!==api.digest(immutableOriginal(row))||!api.equal(stamp.raw,slot.raw)||!api.equal(stamp.adopted,slot.confirmed))return false
 }
 return queueOnlyAuthenticatedCommands(ctx,beforeQueue,current['player-action-requests'],saving,combat,api,pending)
}
