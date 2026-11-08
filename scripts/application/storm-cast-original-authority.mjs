import{readTempestuousHostOriginal}from'./tempestuous-host-original-authority.mjs'
import{readTempestuousBeforeOriginalPreparation}from'./tempestuous-before-original-authority.mjs'
import{projectStormCastOwnerChoice}from'../../shared/storm-cast-owner-choice.mjs'
import{stormCastOriginalSourceFacts,validStormCastOriginalFrame}from'../../shared/storm-cast-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),identity=p=>['parentId','mapId','combatId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000),reject=error=>({ok:false,status:403,error}),key=id=>'storm-cast-preparation:'+id
const scope=(d,geometry,clock)=>({versions:{characters:d.characters?._sync?.revision??0,maps:d.maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0},clockSignature:JSON.stringify(clock??null),mapSignature:JSON.stringify(d.maps?.maps??[]),charactersSignature:JSON.stringify(d.characters?.characters??[]),geometrySignature:JSON.stringify(geometry??null),combatSignature:JSON.stringify([d.combat?.mapId,d.combat?.combatId,d.combat?.active,d.combat?.round,d.combat?.initiativeIndex,d.combat?.initiativeOrder]),economySignature:JSON.stringify(d.combat?.dnd5eTurnEconomyByToken??{})})
async function actualParent(ctx,p,principal,api){const queued=api.nativeParent(await api.context(ctx),p.mapId,p.combatId,p.parentId);if(queued)return queued;const host=await readTempestuousHostOriginal(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId},principal,api);return host.ok?host.originalRoomAction:undefined}
async function current(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!identity(p))return null
 const d=await api.context(ctx),parent=await actualParent(ctx,p,principal,api),geometry=await api.doc(ctx,'map-geometry'),clock=await api.doc(ctx,'campaign-time'),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack')
 if(!parent||parent.type!=='dnd5e-spell-cast'||d.combat?.active!==true||processed?.actionIds?.includes(parent.id)||ack?.actionId===parent.id&&['accepted','rejected'].includes(ack.status))return null
 return{d,parent,scope:scope(d,geometry,clock)}
}
/** This first phase stores only the actual effect-pool-backed original source
 * before any new saving D20 is issued. It grants no owner answer or raw pool. */
export async function recordStormCastOriginalPreparation(ctx,p,principal,api){
 if(p?.phase==='choice')return recordStormCastOwnerChoice(ctx,p,principal,api)
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','source','frame','prefixSignature','effectTimestamp'])||p.sourceKind!=='storm-cast-preparation-v1'||p.phase!=='prepare'||!identity(p)||!validStormCastOriginalFrame(p.frame)||typeof p.prefixSignature!=='string'||!p.prefixSignature||!Number.isSafeInteger(p.effectTimestamp)||p.effectTimestamp<=0)return reject('storm-cast-preparation:actual-shape-required')
 const now=await current(ctx,p,principal,api),facts=stormCastOriginalSourceFacts(p.source);if(!now||!facts)return reject('storm-cast-preparation:current-spell-original-required')
 if(facts.transactionId!==undefined&&facts.transactionId!==p.parentId)return reject('storm-cast-preparation:exact-original-transaction-required')
 const storedBefore=await api.load(ctx,'tempestuous-before-preparation:'+p.parentId);let tempestuousBefore
 if(storedBefore){const before=await readTempestuousBeforeOriginalPreparation(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId},principal,api);if(!before.ok||!before.ownerDecision||before.effectTimestamp!==p.effectTimestamp||!api.equal(before.source,p.source))return reject('storm-cast-preparation:actual-tempestuous-parent-required');tempestuousBefore={schemaVersion:1,parentId:p.parentId,frameId:before.frame.id,prefixSignature:before.prefixSignature}}
 const owned=api.controller(now.d,p.mapId,p.frame.actorId,ctx.roomId),map=now.d.maps?.maps?.find(m=>m.id===p.mapId),action=now.parent
 if(!owned||!api.equal(facts.action,action)||action.id!==p.frame.parentId||action.actorTokenId!==p.frame.actorId||facts.actorToken?.id!==p.frame.actorId||action.dnd5eSpellCast.spellId!==p.frame.spellId||action.dnd5eSpellCast.slotLevel!==p.frame.slotLevel||facts.combatId!==p.combatId||facts.round!==now.d.combat.round||facts.initiativeIndex!==now.d.combat.initiativeIndex||!api.equal(facts.map,map)||!api.equal(facts.characters,now.d.characters?.characters)||facts.envelope&&(facts.envelope.roomId!==ctx.roomId||facts.envelope.memberId!==principal.memberId))return reject('storm-cast-preparation:canonical-spell-source-required')
 for(const[id,row]of Object.entries(facts.turns)){const stored=now.d.combat.dnd5eTurnEconomyByToken?.[id],active=facts.initiativeOrder?.[facts.initiativeIndex]===id,slot=active?(facts.initiativeSlotIds?.[facts.initiativeIndex]??id):id;if(stored&&(!active||stored.turnKey===p.combatId+':'+facts.round+':'+slot)&&(row.turn.reactionAvailable!==(stored.reaction.current>0)||id===p.frame.actorId&&(row.turn.actionAvailable&&stored.action.current===0||row.turn.bonusActionAvailable&&stored.bonusAction.current===0)))return reject('storm-cast-preparation:canonical-economy-required')}
 const book={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,originalRoomAction:action,source:p.source,frame:p.frame,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,characterId:owned.character.id,memberId:owned.character.roomMemberId??principal.memberId,scope:now.scope,...(tempestuousBefore?{tempestuousBefore}:{})},prior=await api.load(ctx,key(p.parentId))
 const priorSource=prior&&Object.fromEntries(Object.entries(prior).filter(([key])=>key!=='ownerDecision'));if(prior&&!api.equal(priorSource,book))return reject('storm-cast-preparation:immutable-source-required')
 if(!prior)await api.save(ctx,key(p.parentId),book)
 return{ok:true}
}
export async function readStormCastOriginalPreparation(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId'])||!identity(p))return reject('storm-cast-preparation:identity-required')
 const now=await current(ctx,p,principal,api),book=await api.load(ctx,key(p.parentId)),owned=now&&book&&api.controller(now.d,p.mapId,book.frame.actorId,ctx.roomId)
 if(!now||!book||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.mapId!==p.mapId||book.combatId!==p.combatId||!api.equal(book.originalRoomAction,now.parent)||!api.equal(book.scope,now.scope)||!owned||owned.character.id!==book.characterId||(owned.character.roomMemberId??principal.memberId)!==book.memberId)return reject('storm-cast-preparation:current-private-source-required')
 return{ok:true,...book}
}

async function recordStormCastOwnerChoice(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId'])||p.sourceKind!=='storm-cast-preparation-v1'||!identity(p))return reject('storm-cast-choice:identity-only-required')
 const current=await readStormCastOriginalPreparation(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId},principal,api);if(!current.ok)return current
 if(current.ownerDecision)return{ok:true}
 const projected=projectStormCastOwnerChoice(current,await api.doc(ctx,'combat-interrupts'));if(!projected.ok)return reject(projected.error)
 const decision={decision:projected.decision,interruptIds:projected.interruptIds}
 const{ok,...book}=current;await api.save(ctx,key(p.parentId),{...book,ownerDecision:decision});return{ok:true}
}

/** Only true private absence is optional. A stored stale book always rejects. */
export async function probeStormCastOriginalPreparation(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!closed(p,['parentId','mapId','combatId'])||!identity(p))return reject('storm-cast-preparation:identity-required')
 const book=await api.load(ctx,key(p.parentId))
 if(book!=null){const result=await readStormCastOriginalPreparation(ctx,p,principal,api);return result.ok?{...result,present:true}:result}
 const d=await api.context(ctx),parent=await actualParent(ctx,p,principal,api),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack')
 if(!parent||parent.type!=='dnd5e-spell-cast'||processed?.actionIds?.includes(parent.id)||ack?.actionId===parent.id&&['accepted','rejected'].includes(ack.status))return reject('storm-cast-preparation:current-spell-original-required')
 return{ok:true,sourceKind:'storm-cast-preparation-probe-v1',present:false,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId}
}
