import{secondChanceCanonicalControllerMemberId}from'../../shared/second-chance-controller.mjs'
import{projectTempestuousPluginOwnerChoice,tempestuousPluginBookSignature,tempestuousPluginWindowSignature,tempestuousPluginOwnerWindow,validTempestuousPluginOwnerResponse}from'../../shared/tempestuous-plugin-owner-choice.mjs'
import{tempestuousPluginOriginalSourceFacts,validTempestuousPluginOriginalFrame}from'../../shared/tempestuous-plugin-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),identity=p=>['parentId','mapId','combatId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000)&&['before','after'].includes(p?.timing),reject=error=>({ok:false,status:403,error}),key=p=>'tempestuous-plugin-preparation:'+p.parentId+':'+p.timing
const publicationResources=['characters','maps','combat','player-action-requests','campaign-time','map-geometry','player-action-processed','player-action-ack']
async function readPublicationDependencies(ctx,api){const values=await Promise.all(publicationResources.map(name=>api.doc(ctx,name))),dependencies={};for(let i=0;i<publicationResources.length;i++){const value=values[i];let revision=0;if(value!==null&&value!==undefined){const sync=value?._sync;if(!data(value)||!data(sync)||sync.schemaVersion!==1||!Number.isSafeInteger(sync.revision)||sync.revision<0||typeof sync.writerId!=='string'||!sync.writerId||!Number.isFinite(sync.writtenAt)||sync.writtenAt<0)return null;revision=sync.revision}dependencies[publicationResources[i]]={revision,signature:JSON.stringify(value??null)}}return dependencies}
const scope=(d,geometry,clock,dependencies)=>({publicDependencies:dependencies,versions:{characters:d.characters?._sync?.revision??0,maps:d.maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0},clockSignature:JSON.stringify(clock??null),mapSignature:JSON.stringify(d.maps?.maps??[]),charactersSignature:JSON.stringify(d.characters?.characters??[]),geometrySignature:JSON.stringify(geometry??null),combatSignature:JSON.stringify([d.combat?.mapId,d.combat?.combatId,d.combat?.active,d.combat?.round,d.combat?.initiativeIndex,d.combat?.initiativeOrder,d.combat?.effectiveRules??null]),economySignature:JSON.stringify(d.combat?.dnd5eTurnEconomyByToken??{})})
async function current(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!identity(p))return null
 const d=await api.context(ctx),parent=api.nativeParent(d,p.mapId,p.combatId,p.parentId),geometry=await api.doc(ctx,'map-geometry'),clock=await api.doc(ctx,'campaign-time'),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack')
 if(!parent||parent.type!=='dnd5e-spell-cast'||d.combat?.active!==true||processed?.actionIds?.includes(parent.id)||ack?.actionId===parent.id&&['accepted','rejected'].includes(ack.status))return null
 const dependencies=await readPublicationDependencies(ctx,api);if(!dependencies)return null;return{d,parent,scope:scope(d,geometry,clock,dependencies)}
}
/** Controller-private source and canonical recovery facts for the actual native
 * before-flight prechoice. This issues no owner answer, die or world write. */
export async function recordTempestuousPluginOriginalPreparation(ctx,p,principal,api){
 if(p?.phase==='choice')return recordTempestuousPluginOwnerChoice(ctx,p,principal,api)
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','timing','source','features','frame','prefixSignature','effectTimestamp'])||p.sourceKind!=='tempestuous-plugin-preparation-v1'||p.phase!=='prepare'||!identity(p)||!validTempestuousPluginOriginalFrame(p.frame)||typeof p.prefixSignature!=='string'||!p.prefixSignature||!Number.isSafeInteger(p.effectTimestamp)||p.effectTimestamp<=0)return reject('tempestuous-plugin-preparation:actual-shape-required')
 const now=await current(ctx,p,principal,api),facts=tempestuousPluginOriginalSourceFacts(p.source);if(!now||!facts||!Array.isArray(p.features)||!p.features.length)return reject('tempestuous-plugin-preparation:current-spell-original-required')
 const owned=api.controller(now.d,p.mapId,p.frame.actorId,ctx.roomId),map=now.d.maps?.maps?.find(m=>m.id===p.mapId),action=now.parent
 const actor=facts.actorState,sourceOrder=facts.initiativeOrder,currentOrder=(now.d.combat.initiativeOrder??[]).map(entry=>typeof entry==='string'?entry:entry.tokenId)
 if(p.frame.timing!==p.timing||!api.equal(sourceOrder,currentOrder)||!actor||actor.currentHp<=0||actor.turn?.bonusActionAvailable!==true||facts.initiativeOrder?.[facts.initiativeIndex]!==p.frame.actorId||p.timing==='before'&&!api.equal(p.frame.origin,{...actor.position,elevationFeet:actor.elevationFeet??actor.groundElevationFeet??0})||p.frame.options.some(option=>!actor.pluginFeatureIds?.includes(option.featureId))||!api.equal(p.features.map(f=>f.featureId),p.frame.options.map(o=>o.featureId))||p.features.some(row=>{try{const f=JSON.parse(row.definition),a=f.declarativeAbility;return row.featureId!==f.id||f.automation!=='full'||f.sourceClassId!=='sorcerer'||f.minimumLevel!==1||a?.automation!=='full'||a.level!==1||a.mechanic?.kind!=='storm-cast-flight'}catch{return true}}))return reject('tempestuous-plugin-preparation:canonical-native-preparation-required')
 if(!owned||!api.equal(facts.action,action)||action.id!==p.frame.parentId||action.actorTokenId!==p.frame.actorId||facts.actorToken?.id!==p.frame.actorId||action.dnd5eSpellCast.spellId!==p.frame.spellId||action.dnd5eSpellCast.slotLevel!==p.frame.slotLevel||facts.combatId!==p.combatId||facts.round!==now.d.combat.round||facts.initiativeIndex!==now.d.combat.initiativeIndex||!api.equal(facts.map,map)||!api.equal(facts.characters,now.d.characters?.characters)||facts.envelope&&(facts.envelope.roomId!==ctx.roomId||facts.envelope.memberId!==principal.memberId))return reject('tempestuous-plugin-preparation:canonical-spell-source-required')
 for(const[id,row]of Object.entries(facts.turns)){const stored=now.d.combat.dnd5eTurnEconomyByToken?.[id],active=facts.initiativeOrder?.[facts.initiativeIndex]===id,slot=active?(facts.initiativeSlotIds?.[facts.initiativeIndex]??id):id;if(stored&&(!active||stored.turnKey===p.combatId+':'+facts.round+':'+slot)&&(row.turn.reactionAvailable!==(stored.reaction.current>0)||id===p.frame.actorId&&(row.turn.actionAvailable&&stored.action.current===0||row.turn.bonusActionAvailable&&stored.bonusAction.current===0)))return reject('tempestuous-plugin-preparation:canonical-economy-required')}
 const opposite=await api.load(ctx,key({...p,timing:p.timing==='before'?'after':'before'}));if(facts.source.now!==p.effectTimestamp||opposite&&(opposite.effectTimestamp!==p.effectTimestamp||tempestuousPluginOriginalSourceFacts(opposite.source)?.preparedSignature!==facts.preparedSignature))return reject('tempestuous-plugin-preparation:same-native-parent-clock-required')
 const book={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,originalRoomAction:action,source:p.source,features:p.features,timing:p.timing,frame:p.frame,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,characterId:owned.character.id,memberId:secondChanceCanonicalControllerMemberId(owned.character,{roomId:ctx.roomId,hostMemberId:principal.memberId}),scope:now.scope},prior=await api.load(ctx,key(p))
 const priorSource=prior&&Object.fromEntries(Object.entries(prior).filter(([key])=>key!=='ownerDecision'));if(prior&&!api.equal(priorSource,book))return reject('tempestuous-plugin-preparation:immutable-source-required')
 if(!prior)await api.save(ctx,key(p),book)
 return{ok:true}
}
export async function readTempestuousPluginOriginalPreparation(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','timing'])||!identity(p))return reject('tempestuous-plugin-preparation:identity-required')
 const now=await current(ctx,p,principal,api),book=await api.load(ctx,key(p)),owned=now&&book&&api.controller(now.d,p.mapId,book.frame.actorId,ctx.roomId)
 if(!now||!book||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.mapId!==p.mapId||book.combatId!==p.combatId||!api.equal(book.originalRoomAction,now.parent)||!api.equal(book.scope,now.scope)||!owned||owned.character.id!==book.characterId||secondChanceCanonicalControllerMemberId(owned.character,{roomId:ctx.roomId,hostMemberId:principal.memberId})!==book.memberId)return reject('tempestuous-plugin-preparation:current-private-source-required')
 return{ok:true,...book}
}

/** Optimistic dependencies only, never Native/raw/World authority. Read all
 * eight raw public documents before independently revalidating the same private
 * parent book. Unknown document fields participate in exact signatures. */
export async function readTempestuousPluginPublicationGuard(ctx,p,principal,api){
 const dependencies=await readPublicationDependencies(ctx,api);if(!dependencies)return reject('tempestuous-plugin-publication:existing-dependency-sync-required')
 const book=await readTempestuousPluginOriginalPreparation(ctx,p,principal,api);if(!book.ok)return book
 if(!api.equal(dependencies,book.scope.publicDependencies))return reject('tempestuous-plugin-publication:exact-current-dependencies-required')
 return{ok:true,sourceKind:'tempestuous-plugin-publication-readset-v1',parentId:book.parentId,mapId:book.mapId,combatId:book.combatId,timing:book.timing,roomId:book.roomId,hostMemberId:book.hostMemberId,effectTimestamp:book.effectTimestamp,bookSignature:JSON.stringify(book),expectedRevisions:Object.fromEntries(publicationResources.map(name=>[name,dependencies[name].revision]))}
}

/** Only true private absence is optional. A stored stale book always rejects. */
export async function probeTempestuousPluginOriginalPreparation(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!closed(p,['parentId','mapId','combatId','timing'])||!identity(p))return reject('tempestuous-plugin-preparation:identity-required')
 const book=await api.load(ctx,key(p))
 if(book!=null){const result=await readTempestuousPluginOriginalPreparation(ctx,p,principal,api);return result.ok?{...result,present:true}:result}
 const d=await api.context(ctx),parent=api.nativeParent(d,p.mapId,p.combatId,p.parentId),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack')
 if(!parent||parent.type!=='dnd5e-spell-cast'||processed?.actionIds?.includes(parent.id)||ack?.actionId===parent.id&&['accepted','rejected'].includes(ack.status))return reject('tempestuous-plugin-preparation:current-spell-original-required')
 return{ok:true,sourceKind:'tempestuous-plugin-preparation-probe-v1',present:false,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId}
}

async function recordTempestuousPluginOwnerChoice(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','timing'])||p.sourceKind!=='tempestuous-plugin-preparation-v1'||!identity(p))return reject('tempestuous-plugin-choice:identity-only-required')
 const current=await readTempestuousPluginOriginalPreparation(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,timing:p.timing},principal,api);if(!current.ok)return current
 if(current.ownerDecision)return{ok:true}
 const queue=await api.doc(ctx,'combat-interrupts'),answers=Object.fromEntries(await Promise.all((queue?.interrupts??[]).map(async row=>[row.id,await api.load(ctx,'tempestuous-plugin-answer:'+p.parentId+':'+row.id)])))
 const projected=projectTempestuousPluginOwnerChoice(current,queue,answers);if(!projected.ok)return reject(projected.error)
 const {ok,...book}=current;await api.save(ctx,key(p),{...book,ownerDecision:{decision:projected.decision,interruptIds:projected.interruptIds}});return{ok:true}
}

/** Only this real authenticated interrupt route records an owner answer.
 * Generic public completion data and caller controller IDs are never evidence. */
export async function recordTempestuousPluginInterruptMutation(ctx,p,principal,api){
 const mutation=p?.mutation,result=p?.result,id=String(mutation?.interrupt?.id??mutation?.id??'');if(!id.startsWith('tempestuous-plugin:'))return{ok:true}
 const row=result?.next?.interrupts?.find(row=>row.id===id),previous=p?.queue?.interrupts?.find(row=>row.id===id);if(!result?.ok||!row||!principal?.hostMemberId||!principal.memberId)return reject('tempestuous-plugin-window:actual-authenticated-route-required')
 const candidates=await Promise.all(['before','after'].map(timing=>api.load(ctx,key({parentId:row.transactionId,timing}))));const stored=candidates.find(book=>book&&tempestuousPluginOwnerWindow(book,row));if(!stored||stored.hostMemberId!==principal.hostMemberId)return reject('tempestuous-plugin-window:current-private-source-required')
 const current=await readTempestuousPluginOriginalPreparation(ctx,{parentId:stored.parentId,mapId:stored.mapId,combatId:stored.combatId,timing:stored.timing},{role:'dm',memberId:principal.hostMemberId},api);if(!current.ok)return current
 if(!tempestuousPluginOwnerWindow(current,row))return reject('tempestuous-plugin-window:exact-owner-window-required')
 const bookSignature=tempestuousPluginBookSignature(current),windowSignature=tempestuousPluginWindowSignature(row),windowKey='tempestuous-plugin-window:'+current.parentId+':'+id,answerKey='tempestuous-plugin-answer:'+current.parentId+':'+id,window=await api.load(ctx,windowKey),answer=await api.load(ctx,answerKey),host=principal.role==='dm'&&principal.memberId===current.hostMemberId,owner=principal.memberId===current.memberId&&principal.role===(current.memberId===current.hostMemberId?'dm':'player')
 if(mutation.operation==='upsert'){
  if(!host||mutation.interrupt?.status!=='pending'||mutation.interrupt.response!=null)return reject('tempestuous-plugin-window:host-issue-only-required')
  if(window){if(window.schemaVersion!==1||window.bookSignature!==bookSignature||window.windowSignature!==windowSignature)return reject('tempestuous-plugin-window:immutable-window-required');return{ok:true}}
  if(previous&&previous.status!=='pending'||row.status!=='pending'||row.response!=null)return reject('tempestuous-plugin-window:actual-pending-issue-required')
  await api.save(ctx,windowKey,{schemaVersion:1,sourceKind:'tempestuous-plugin-window-v1',roomId:ctx.roomId,parentId:current.parentId,frameId:current.frame.id,memberId:current.memberId,bookSignature,windowSignature});return{ok:true}
 }
 if(!window||window.schemaVersion!==1||window.sourceKind!=='tempestuous-plugin-window-v1'||window.roomId!==ctx.roomId||window.parentId!==current.parentId||window.frameId!==current.frame.id||window.memberId!==current.memberId||window.bookSignature!==bookSignature||window.windowSignature!==windowSignature)return reject('tempestuous-plugin-window:actual-issued-window-required')
 if(mutation.operation==='answer'){
  if(!owner||!validTempestuousPluginOwnerResponse(current,row,mutation.response)||!api.equal(mutation.response,row.response))return reject('tempestuous-plugin-window:actual-owner-answer-required')
  if(answer){if(answer.memberId!==principal.memberId||answer.role!==principal.role||answer.bookSignature!==bookSignature||answer.windowSignature!==windowSignature||!api.equal(answer.response,row.response))return{ok:false,status:409,error:'tempestuous-plugin-window:immutable-answer-required'};return{ok:true}}
  await api.save(ctx,answerKey,{schemaVersion:1,sourceKind:'tempestuous-plugin-answer-v1',roomId:ctx.roomId,parentId:current.parentId,frameId:current.frame.id,memberId:principal.memberId,role:principal.role,bookSignature,windowSignature,response:row.response});return{ok:true}
 }
 if(mutation.operation==='finish'){
  if(!host||!answer||answer.memberId!==current.memberId||answer.role!==(current.memberId===current.hostMemberId?'dm':'player')||answer.bookSignature!==bookSignature||answer.windowSignature!==windowSignature||!api.equal(answer.response,row.response))return reject('tempestuous-plugin-window:actual-owner-before-host-finish-required');return{ok:true}
 }
 if(['wait','rolling','rollback'].includes(mutation.operation))return host||owner?{ok:true}:reject('tempestuous-plugin-window:actual-controller-required')
 return reject('tempestuous-plugin-window:unsupported-operation')
}
