import{secondChanceCanonicalControllerMemberId}from'./second-chance-controller.mjs'
import{createHash}from'node:crypto'
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const closed=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key))
const text=value=>typeof value==='string'&&value.length>0&&value.length<=2000&&value.trim()===value
const integer=value=>Number.isSafeInteger(value)&&value>=0
const stable=value=>Array.isArray(value)?value.map(stable):object(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,child])=>[key,stable(child)])):value
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b))
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const names=['characters','maps','combat','map-geometry','campaign-time']
const fail=(status,error)=>({ok:false,status,error})
const host=identity=>identity.role==='dm'&&identity.memberId===identity.hostMemberId
const faces=(values,count)=>Array.isArray(values)&&values.length===count&&values.every(value=>Number.isSafeInteger(value)&&value>=1&&value<=20)
const phase=original=>!original.raw?'original-roller':!original.confirmed?'original-confirmation':original.request&&!original.decisions.some(choice=>choice.decision==='use')&&original.decisions.length<original.request.options.length?'owner-choice':original.request&&original.decisions.some(choice=>choice.decision==='use')&&!original.replacementRaw?'replacement-roller':original.request&&original.decisions.some(choice=>choice.decision==='use')&&!original.replacementConfirmed?'replacement-confirmation':original.complete?'complete':'original-ready'
const usedOwner=original=>original.decisions.find(choice=>choice.decision==='use')?.ownerId
const currentOwner=original=>usedOwner(original)?undefined:original.request?.options[original.decisions.length]
const originalId=(id,actorTokenId)=>'bountiful-initiative-pool:'+digest({id,actorTokenId})
const replacementId=original=>'bountiful-initiative-replacement:'+digest({id:original.id})

function canonical(snapshot,identity,mapId){
 const map=snapshot.maps?.maps?.find(value=>value.id===mapId),characters=snapshot.characters?.characters,combat=snapshot.combat
 if(!map||!Array.isArray(map.tokens)||!Array.isArray(characters)||combat!==null&&combat!==undefined&&combat.active!==false||combat?.flowPause)return undefined
 const roster=map.tokens.filter(token=>token.type!=='obstacle').map(token=>({tokenId:token.id,characterId:token.characterId??null}))
 if(!roster.length||roster.length>256||roster.some(token=>!text(token.tokenId))||new Set(roster.map(token=>token.tokenId)).size!==roster.length)return undefined
 const versions=Object.fromEntries(names.map(name=>[name,snapshot[name]?._sync?.revision??(snapshot[name]==null?0:undefined)]));if(Object.values(versions).some(value=>!integer(value)))return undefined
 return{map,characters,roster,versions,scope:digest(Object.fromEntries(names.map(name=>[name,snapshot[name]??null]))),roomId:identity.roomId,hostMemberId:identity.hostMemberId}
}
function actor(facts,actorTokenId){const token=facts.map.tokens.find(value=>value.id===actorTokenId),rows=token?.characterId?facts.characters.filter(value=>value.id===token.characterId):[],memberId=rows.length===1?secondChanceCanonicalControllerMemberId(rows[0],{roomId:facts.roomId,hostMemberId:facts.hostMemberId}):undefined;return token&&token.type!=='obstacle'&&rows.length===1&&memberId?{token,character:rows[0],memberId}:undefined}
function current(row,snapshot,identity){const facts=canonical(snapshot,identity,row.mapId);if(row.consumed||!facts||row.roomId!==identity.roomId||row.hostMemberId!==identity.hostMemberId||!same(row.versions,facts.versions)||row.scope!==facts.scope||!same(row.roster,facts.roster))return undefined;for(const original of row.originals){const roller=actor(facts,original.actorTokenId);if(!roller||roller.character.id!==original.characterId||roller.memberId!==original.memberId)return undefined;for(const[ownerId,controller]of Object.entries(original.controllers??{})){const owner=actor(facts,ownerId);if(!owner||owner.character.id!==controller.characterId||owner.memberId!==controller.memberId)return undefined}}return facts}
const own=(identity,memberId)=>identity.memberId===memberId&&(memberId===identity.hostMemberId?host(identity):identity.role==='player')
function projection(row,identity){
 if(host(identity))return structuredClone(row)
 const original=row.originals[row.originals.length-1];if(!original||row.consumed)return undefined
 const next=currentOwner(original),controlled=next&&original.controllers?.[next.ownerId]
 if(controlled?.memberId===identity.memberId&&identity.role==='player')return{id:row.id,mapId:row.mapId,preparationId:row.preparationId,originalId:original.id,actorTokenId:original.actorTokenId,phase:'owner-choice',revision:original.revision,ownerId:next.ownerId,featureId:next.featureId}
 if(own(identity,original.memberId)&&['original-roller','replacement-roller'].includes(phase(original)))return{id:row.id,mapId:row.mapId,preparationId:row.preparationId,originalId:original.id,actorTokenId:original.actorTokenId,characterId:original.characterId,phase:phase(original),requestId:phase(original)==='original-roller'?original.id:replacementId(original),count:phase(original)==='original-roller'?original.count:1,mode:phase(original)==='original-roller'?original.mode:'normal',hostMemberId:row.hostMemberId,sides:20}
 return undefined
}
export function validBountifulInitiativeOriginals(book){
 if(!closed(book,['schemaVersion','parents','updatedAt','_sync'])||book.schemaVersion!==1||!object(book.parents)||Object.keys(book.parents).length>256)return false
 return Object.entries(book.parents).every(([id,row])=>closed(row,['id','preparationId','mapId','roomId','hostMemberId','versions','scope','roster','createdAt','originals','consumed'])&&row.id===id&&/^bountiful-initiative:[a-f0-9]{64}$/.test(id)&&['preparationId','mapId','roomId','hostMemberId'].every(key=>text(row[key]))&&object(row.versions)&&Object.keys(row.versions).length===5&&names.every(key=>integer(row.versions[key]))&&/^[a-f0-9]{64}$/.test(row.scope)&&Array.isArray(row.roster)&&row.roster.length>0&&row.roster.length<=256&&integer(row.createdAt)&&Array.isArray(row.originals)&&row.originals.length<=row.roster.length&&row.originals.every((value,index)=>validOriginal(value,row,index))&&(row.consumed===undefined||closed(row.consumed,['transactionId','authorityRevision'])&&row.consumed.transactionId==='combat-start:'+row.preparationId&&integer(row.consumed.authorityRevision)&&row.consumed.authorityRevision>0))
}
function validOriginal(value,row,index){
 if(!closed(value,['id','actorTokenId','characterId','memberId','count','mode','revision','raw','confirmed','request','featureSources','controllers','decisions','replacementRaw','replacementConfirmed','complete'])||value.id!==originalId(row.id,value.actorTokenId)||!text(value.actorTokenId)||!text(value.characterId)||!text(value.memberId)||!['normal','advantage','disadvantage'].includes(value.mode)||value.count!==(value.mode==='normal'?1:2)||!integer(value.revision)||value.revision<1||typeof value.complete!=='boolean'||row.originals.slice(0,index).some(old=>old.actorTokenId===value.actorTokenId||!old.complete)||!Array.isArray(value.decisions))return false
 const pool=(pool,count)=>pool===undefined||closed(pool,['memberId','values','at'])&&text(pool.memberId)&&faces(pool.values,count)&&integer(pool.at)
 if(!pool(value.raw,value.count)||!pool(value.confirmed,value.count)||value.raw&&value.raw.memberId!==value.memberId||value.confirmed&&(!value.raw||value.confirmed.memberId!==row.hostMemberId))return false
 const expectedRevision=1+(value.raw?1:0)+(value.confirmed?1:0)+(value.request?1:0)+value.decisions.length+(value.replacementRaw?1:0)+(value.replacementConfirmed?1:0)+(value.complete?1:0);if(value.revision!==expectedRevision)return false
 if(value.request===undefined)return !value.decisions.length&&!value.featureSources&&!value.controllers&&!value.replacementRaw&&!value.replacementConfirmed&&(!value.complete||!!value.confirmed)
 if(!validRequest(value.request)||!value.confirmed||!same(value.request.originalRolls,value.confirmed.values)||value.request.actorId!==value.actorTokenId||!object(value.featureSources)||!object(value.controllers))return false
 if(Object.keys(value.featureSources).length!==new Set(value.request.options.map(option=>option.featureId)).size||Object.keys(value.controllers).length!==new Set(value.request.options.map(option=>option.ownerId)).size||value.request.options.some(option=>!/^[a-f0-9]{64}$/.test(value.featureSources[option.featureId]??'')||!closed(value.controllers[option.ownerId],['characterId','memberId'])||!text(value.controllers[option.ownerId].characterId)||!text(value.controllers[option.ownerId].memberId)))return false
 let accepted=false;for(let i=0;i<value.decisions.length;i++){const choice=value.decisions[i],option=value.request.options[i],controller=option&&value.controllers[option.ownerId];if(accepted||!option||!closed(choice,['ownerId','featureId','memberId','decision','at'])||choice.ownerId!==option.ownerId||choice.featureId!==option.featureId||choice.memberId!==controller?.memberId||!['use','decline'].includes(choice.decision)||!integer(choice.at))return false;accepted=choice.decision==='use'}
 return pool(value.replacementRaw,1)&&pool(value.replacementConfirmed,1)&&(!value.replacementRaw||accepted&&value.replacementRaw.memberId===value.memberId)&&(!value.replacementConfirmed||value.replacementRaw&&value.replacementConfirmed.memberId===row.hostMemberId)&&(!value.complete||(accepted?!!value.replacementConfirmed:value.decisions.length===value.request.options.length))
}
function validRequest(value){return closed(value,['actorId','kind','originalRolls','dieIndex','options'])&&Object.keys(value).length===5&&text(value.actorId)&&value.kind==='ability-check'&&Array.isArray(value.originalRolls)&&value.originalRolls.length>=1&&value.originalRolls.length<=2&&value.originalRolls.every(n=>Number.isInteger(n)&&n>=1&&n<=20)&&integer(value.dieIndex)&&value.dieIndex<value.originalRolls.length&&value.originalRolls[value.dieIndex]===1&&Array.isArray(value.options)&&value.options.length>0&&value.options.length<=128&&value.options.every(option=>closed(option,['ownerId','featureId'])&&Object.keys(option).length===2&&text(option.ownerId)&&text(option.featureId)&&option.ownerId!==value.actorId)&&new Set(value.options.map(option=>JSON.stringify(option))).size===value.options.length}
export function projectBountifulInitiativeOriginal(book,snapshot,identity,input={}){
 if(!closed(input,['id','requestId'])||input.id!==undefined&&!text(input.id)||input.requestId!==undefined&&(!text(input.requestId)||input.id!==undefined)||!validBountifulInitiativeOriginals(book))return fail(400,'initiative-original:closed-project-required')
 if(input.requestId!==undefined){const matches=[];for(const row of Object.values(book.parents)){if(!current(row,snapshot,identity))continue;const original=row.originals.at(-1);if(!original)continue;const replacement=input.requestId===replacementId(original);if(input.requestId!==original.id&&!replacement||!host(identity)&&!own(identity,original.memberId)||replacement&&!usedOwner(original))continue;const raw=replacement?original.replacementRaw:original.raw,confirmed=replacement?original.replacementConfirmed:original.confirmed;matches.push({id:row.id,mapId:row.mapId,preparationId:row.preparationId,originalId:original.id,actorTokenId:original.actorTokenId,characterId:original.characterId,phase:phase(original),requestId:input.requestId,count:replacement?1:original.count,mode:replacement?'normal':original.mode,hostMemberId:row.hostMemberId,...(raw?{raw:{values:[...raw.values]}}:{}),...(confirmed?{confirmed:{values:[...confirmed.values]}}:{})})}return matches.length===1?{ok:true,preparation:matches[0],revision:book._sync?.revision??0}:fail(403,'initiative-original:actual-owned-pool-required')}
 if(input.id){const row=book.parents[input.id];if(!row||!current(row,snapshot,identity))return fail(409,'initiative-original:current-preparation-required');const value=projection(row,identity);return value?{ok:true,preparation:value,revision:book._sync?.revision??0}:fail(403,'initiative-original:actual-controller-required')}
 return{ok:true,revision:book._sync?.revision??0,preparations:Object.values(book.parents).filter(row=>current(row,snapshot,identity)).map(row=>projection(row,identity)).filter(Boolean)}
}
export function mutateBountifulInitiativeOriginal(book,snapshot,identity,operation,input,now){
 const base=book??{schemaVersion:1,parents:{}};if(!validBountifulInitiativeOriginals(base))return fail(409,'initiative-original:protected-book-required')
 if(operation==='begin'){
  if(!host(identity))return fail(403,'initiative-original:actual-Host-required')
  if(!closed(input,['preparationId','mapId'])||Object.keys(input).length!==2||!text(input.preparationId)||!text(input.mapId))return fail(400,'initiative-original:closed-preparation-required')
  const facts=canonical(snapshot,identity,input.mapId);if(!facts)return fail(409,'initiative-original:actual-inactive-roster-required')
  const id='bountiful-initiative:'+digest({roomId:identity.roomId,preparationId:input.preparationId,mapId:input.mapId}),old=base.parents[id];if(old)return current(old,snapshot,identity)?{ok:true,changed:false,next:base,preparation:projection(old,identity)}:fail(409,'initiative-original:preparation-immutable')
  if(Object.keys(base.parents).length>=256)return fail(409,'initiative-original:book-capacity')
  const row={id,...input,roomId:identity.roomId,hostMemberId:identity.hostMemberId,versions:facts.versions,scope:facts.scope,roster:facts.roster,createdAt:now,originals:[]};return{ok:true,changed:true,next:{...base,parents:{...base.parents,[id]:row},updatedAt:now},preparation:projection(row,identity)}
 }
 if(!object(input)||!text(input.id))return fail(400,'initiative-original:closed-operation-required');const row=base.parents[input.id],facts=row&&current(row,snapshot,identity);if(!facts)return fail(409,'initiative-original:current-preparation-required')
 const change=next=>({ok:true,changed:true,next:{...base,parents:{...base.parents,[row.id]:next},updatedAt:now},preparation:projection(next,identity)??{id:row.id}})
 if(operation==='issue'){
  if(!host(identity))return fail(403,'initiative-original:actual-Host-required');if(!closed(input,['id','actorTokenId','mode'])||Object.keys(input).length!==3||!['normal','advantage','disadvantage'].includes(input.mode))return fail(400,'initiative-original:closed-original-required')
  const who=actor(facts,input.actorTokenId);if(!who)return fail(409,'initiative-original:actual-character-required');const old=row.originals.find(value=>value.actorTokenId===input.actorTokenId);if(old)return old.mode===input.mode?{ok:true,changed:false,next:base,preparation:projection(row,identity)}:fail(409,'initiative-original:pool-immutable')
  if(row.originals.some(value=>!value.complete))return fail(409,'initiative-original:previous-original-incomplete');const original={id:originalId(row.id,input.actorTokenId),actorTokenId:who.token.id,characterId:who.character.id,memberId:who.memberId,mode:input.mode,count:input.mode==='normal'?1:2,revision:1,decisions:[],complete:false};return change({...row,originals:[...row.originals,original]})
 }
 const original=row.originals[row.originals.length-1];if(!original||input.originalId!==original.id)return fail(409,'initiative-original:current-original-required');const update=value=>change({...row,originals:[...row.originals.slice(0,-1),{...value,revision:original.revision+1}]})
 if(operation==='qualify'){
  if(!host(identity))return fail(403,'initiative-original:actual-Host-required');if(!closed(input,['id','originalId','request','featureSources'])||Object.keys(input).length!==4||!validRequest(input.request)||!object(input.featureSources))return fail(400,'initiative-original:closed-Native-checkpoint-required')
  if(!original.confirmed||input.request.actorId!==original.actorTokenId||!same(input.request.originalRolls,original.confirmed.values)||original.complete)return fail(409,'initiative-original:actual-confirmed-original-required')
  if(original.request)return same(original.request,input.request)&&same(original.featureSources,input.featureSources)?{ok:true,changed:false,next:base,preparation:projection(row,identity)}:fail(409,'initiative-original:Native-request-immutable')
  const controllers={};for(const option of input.request.options){const who=actor(facts,option.ownerId);if(!who||!/^[a-f0-9]{64}$/.test(input.featureSources[option.featureId]??'')||row.originals.some(previous=>usedOwner(previous)===option.ownerId))return fail(409,'initiative-original:current-unspent-helper-required');controllers[option.ownerId]={characterId:who.character.id,memberId:who.memberId}}
  if(Object.keys(input.featureSources).length!==new Set(input.request.options.map(option=>option.featureId)).size)return fail(400,'initiative-original:closed-feature-sources-required');return update({...original,request:structuredClone(input.request),featureSources:structuredClone(input.featureSources),controllers})
 }
 if(operation==='answer'){
  if(!closed(input,['id','originalId','expectedRevision','ownerId','featureId','decision'])||Object.keys(input).length!==6||!['use','decline'].includes(input.decision)||!integer(input.expectedRevision))return fail(400,'initiative-original:closed-owner-decision-required');const controller=original.controllers?.[input.ownerId];if(!controller||!own(identity,controller.memberId))return fail(403,'initiative-original:actual-helper-controller-required')
  const previous=original.decisions.find(value=>value.ownerId===input.ownerId&&value.featureId===input.featureId);if(previous)return previous.decision===input.decision?{ok:true,changed:false,next:base,preparation:projection(row,identity)}:fail(409,'initiative-original:decision-immutable');const option=currentOwner(original);if(!option||option.ownerId!==input.ownerId||option.featureId!==input.featureId||input.expectedRevision!==original.revision||original.complete)return fail(409,'initiative-original:current-owner-choice-required');return update({...original,decisions:[...original.decisions,{ownerId:input.ownerId,featureId:input.featureId,memberId:identity.memberId,decision:input.decision,at:now}]})
 }
 if(['raw','confirm','replacement-raw','replacement-confirm'].includes(operation)){
  if(!closed(input,['id','originalId','rollerTokenId','values'])||Object.keys(input).length!==4||input.rollerTokenId!==original.actorTokenId||!faces(input.values,operation.startsWith('replacement')?1:original.count))return fail(400,'initiative-original:closed-exact-pool-required');const confirm=operation.endsWith('confirm'),replacement=operation.startsWith('replacement'),field=replacement?confirm?'replacementConfirmed':'replacementRaw':confirm?'confirmed':'raw';if(confirm?!host(identity):!own(identity,original.memberId))return fail(403,'initiative-original:actual-roller-or-Host-required');const prior=original[field];if(prior)return same(prior.values,input.values)?{ok:true,changed:false,next:base,preparation:projection(row,identity)}:fail(409,'initiative-original:raw-or-adoption-immutable');if(original.complete||confirm&&!original[replacement?'replacementRaw':'raw']||replacement&&(!usedOwner(original)||!original.confirmed))return fail(409,'initiative-original:actual-prior-pool-required');return update({...original,[field]:{memberId:identity.memberId,values:[...input.values],at:now}})
 }
 if(operation==='complete'){
  if(!host(identity))return fail(403,'initiative-original:actual-Host-required');if(!closed(input,['id','originalId'])||Object.keys(input).length!==2)return fail(400,'initiative-original:no-result-snapshot-accepted');if(original.complete)return{ok:true,changed:false,next:base,preparation:projection(row,identity)};if(phase(original)!=='original-ready')return fail(409,'initiative-original:actual-completed-pools-required');return update({...original,complete:true})
 }
 return fail(400,'initiative-original:unknown-operation')
}

/** A presentation packet is never an original-die issuer. Raw and independent
 * adoption must already exist in this exact protected preparation. */
export function bountifulInitiativeDiceEventAllowed(book,snapshot,identity,p){
 if(!validBountifulInitiativeOriginals(book)||!object(p)||typeof p.requestId!=='string')return fail(403,'initiative-original:exact-issued-request-required')
 const confirmed=p.requestId.endsWith(':dm-confirmed'),id=confirmed?p.requestId.slice(0,-13):p.requestId,matches=[]
 for(const row of Object.values(book.parents))for(const original of row.originals){const replacement=id===replacementId(original);if(id===original.id||replacement)matches.push({row,original,replacement})}
 if(matches.length!==1)return fail(403,'initiative-original:exact-issued-request-required')
 const{row,original,replacement}=matches[0],facts=current(row,snapshot,{...identity,hostMemberId:row.hostMemberId}),count=replacement?1:original.count,raw=replacement?original.replacementRaw:original.raw,adopted=replacement?original.replacementConfirmed:original.confirmed
 if(!facts||p.mapId!==row.mapId||(p.combatId??'')!==(snapshot.combat?.combatId??'')||p.sides!==20||p.count!==count||!['dice','d20'].includes(p.kind)||p.rollerTokenId!==undefined&&p.rollerTokenId!==original.actorTokenId||p.targetCharacterId!==undefined&&p.targetCharacterId!==original.characterId||replacement&&!usedOwner(original))return fail(403,'initiative-original:canonical-pool-required')
 const actualIdentity={...identity,hostMemberId:row.hostMemberId}
 if(confirmed)return host(actualIdentity)&&p.delivery==='broadcast-result'&&adopted&&same(p.values,adopted.values)?{ok:true}:fail(403,'initiative-original:confirmed-presentation-required')
 if(p.delivery==='player-roll-request')return host(actualIdentity)&&original.memberId!==row.hostMemberId&&p.targetCharacterId===original.characterId&&p.rollKind==='ability-check'&&Array.isArray(p.values)&&!p.values.length?{ok:true}:fail(403,'initiative-original:canonical-request-Host-required')
 if(['player-roll-start','player-roll-result'].includes(p.delivery))return own(actualIdentity,original.memberId)&&original.memberId!==row.hostMemberId&&p.targetCharacterId===original.characterId&&p.rollKind==='ability-check'&&raw&&same(p.values,raw.values)?{ok:true}:fail(403,'initiative-original:actual-locked-player-raw-required')
 // Host-owned animation announcements carry no permission or stored die.
 // The concrete physical callback still has to lock its actual raw via /raw.
 if(p.delivery==='broadcast-result'&&host(actualIdentity)&&original.memberId===row.hostMemberId&&faces(p.values,count)&&(!raw||same(p.values,raw.values)||adopted&&same(p.values,adopted.values)))return{ok:true}
 return fail(403,'initiative-original:actual-presentation-principal-required')
}

/** The book is a dice/controller ledger, never a supplied world result. Its
 * consumption can only accompany the existing Host combat-start transaction. */
export function bountifulInitiativeConsumptionAllowed(book,snapshot,identity,writes,transactionId){
 const write=writes.find(value=>value.name==='bountiful-initiative-originals'),candidates=Object.values(book?.parents??{}).filter(row=>transactionId==='combat-start:'+row.preparationId)
 if(!write&&!candidates.length)return true
 if(!host(identity)||!validBountifulInitiativeOriginals(book)||candidates.length!==1||!write||write.expectedRevision!==book._sync?.revision||!validBountifulInitiativeOriginals(write.data))return false
 const row=candidates[0],facts=current(row,snapshot,identity),expected=['characters','maps','combat','dm-authority-ready','bountiful-initiative-originals'];if(!facts||writes.length!==5||new Set(writes.map(value=>value.name)).size!==5||expected.some(name=>!writes.some(value=>value.name===name)))return false
 const tokens=facts.map.tokens.filter(token=>token.type!=='obstacle'&&!token.dnd5eSimulacrum);if(tokens.some(token=>!token.characterId)||row.originals.length!==tokens.length||tokens.some(token=>!row.originals.some(original=>original.actorTokenId===token.id&&original.complete)))return false
 const combat=writes.find(value=>value.name==='combat')?.data,ready=writes.find(value=>value.name==='dm-authority-ready')?.data;if(!combat||combat.active!==true||combat.mapId!==row.mapId||combat.combatId!==row.preparationId||combat.round!==1||combat.initiativeIndex!==0||!Array.isArray(combat.initiativeOrder)||!combat.initiativeOrder.length||combat.initiativeOrder.some(entry=>!facts.map.tokens.some(token=>token.id===entry.tokenId))||facts.roster.some(token=>!combat.initiativeOrder.some(entry=>entry.tokenId===token.tokenId))||!ready||ready.ready!==true||ready.mapId!==row.mapId||ready.combatId!==row.preparationId)return false
 const used=new Set();for(const original of row.originals){const owner=usedOwner(original);if(!owner)continue;if(used.has(owner))return false;used.add(owner);const reaction=combat.dnd5eTurnEconomyByToken?.[owner]?.reaction?.current;if(combat.initiativeOrder[0]?.tokenId===owner?![0,1].includes(reaction):reaction!==0)return false}
 const consumption={transactionId,authorityRevision:book._sync.revision+1};if(!same(Object.keys(book.parents).sort(),Object.keys(write.data.parents).sort()))return false
 for(const[id,before]of Object.entries(book.parents))if(!same(write.data.parents[id],id===row.id?{...before,consumed:consumption}:before))return false
 const{parents:beforeParents,_sync:beforeSync,...beforeRest}=book,{parents:afterParents,_sync:afterSync,...afterRest}=write.data;void beforeParents;void beforeSync;void afterParents;void afterSync;return same(beforeRest,afterRest)
}
