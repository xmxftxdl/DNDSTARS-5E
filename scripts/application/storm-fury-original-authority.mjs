import{validStormFuryMoveBountyReplay}from'../../shared/storm-fury-move-bounty-replay.mjs'
import{stormFuryMoveOriginalSourceFacts}from'../../shared/storm-fury-move-original.mjs'
import{stormFuryOriginalSourceFacts,validStormFuryOwnerFrame,stormFuryOwnerWindowId,validStormFuryOwnerDecision}from'../../shared/storm-fury-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),identity=p=>['parentId','mapId','combatId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000)&&Number.isSafeInteger(p?.frameIndex)&&p.frameIndex>=0,reject=error=>({ok:false,status:403,error})
const key=p=>'storm-fury-original:'+JSON.stringify([p.parentId,p.frameIndex])
const scope=(d,geometry,clock)=>({characters:d.characters,maps:d.maps,requests:d.requests,geometry,clock,combat:d.combat})
async function current(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!identity(p))return null
 const d=await api.context(ctx),geometry=await api.doc(ctx,'map-geometry'),clock=await api.doc(ctx,'campaign-time'),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack'),hostResult=await api.doc(ctx,'host-native-weapon-result')
 if(d.combat?.active!==true||d.combat.mapId!==p.mapId||d.combat.combatId!==p.combatId||processed?.actionIds?.includes(p.parentId)||ack?.actionId===p.parentId&&['accepted','rejected'].includes(ack.status)||hostResult?.actionId===p.parentId&&['accepted','rejected'].includes(hostResult.status))return null
 return{d,scope:scope(d,geometry,clock)}
}
/** Host-authenticated original input and private consent only. This book is not
 * a Native capability, saving-roll issuer, push permission or world commit. */
export async function recordStormFuryOriginal(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','frameIndex','family','source','frame','prefixSignature','effectTimestamp','hostEquipmentOrigin'])||p.sourceKind!=='storm-fury-original-v1'||p.phase!=='prepare'||!identity(p)||!['monster','spell','equipment','opportunity','opportunity-move'].includes(p.family)||!validStormFuryOwnerFrame(p.frame)||p.frameIndex!==p.frame.index||typeof p.prefixSignature!=='string'||!p.prefixSignature||!Number.isSafeInteger(p.effectTimestamp)||p.effectTimestamp<=0)return reject('storm-fury-original:actual-shape-required')
 const now=await current(ctx,p,principal,api),facts=p.family==='opportunity-move'?stormFuryMoveOriginalSourceFacts(p.source,p.frame):stormFuryOriginalSourceFacts(p.source);if(!now||!facts)return reject('storm-fury-original:current-original-required')
 const map=now.d.maps?.maps?.find(m=>m.id===p.mapId),actor=map?.tokens?.find(t=>t.id===p.frame.event.actorId),owned=api.controller(now.d,p.mapId,p.frame.event.targetId,ctx.roomId)
 if(!map||!actor||!owned||(facts.transactionId??(p.family==='spell'||p.family==='equipment'?facts.action?.id:undefined))!==p.parentId||facts.map?.id!==p.mapId||facts.actorToken?.id!==actor.id||facts.combatId!==p.combatId||facts.round!==now.d.combat.round||facts.initiativeIndex!==now.d.combat.initiativeIndex||!api.equal(facts.map,map)||!api.equal(facts.characters,now.d.characters?.characters)||facts.envelope&&(facts.envelope.roomId!==ctx.roomId||facts.envelope.memberId!==principal.memberId))return reject('storm-fury-original:exact-current-source-required')
 if(p.family==='opportunity-move'){if(!validStormFuryMoveBountyReplay(facts.move,facts.action,now.d.combat.bountifulOriginalParents,now.scope,{roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,round:now.d.combat.round,initiativeIndex:now.d.combat.initiativeIndex}))return reject('storm-fury-move:exact-authenticated-earlier-bounty-required');if(p.effectTimestamp!==facts.move.firstHostNow||!api.equal(facts.move.initiativeOrder,now.d.combat.initiativeOrder))return reject('storm-fury-move:exact-original-clock-order-required');for(const[tokenId,economy]of Object.entries(facts.move.economies)){const stored=now.d.combat.dnd5eTurnEconomyByToken?.[tokenId];if(!stored||!api.equal(stored,economy))return reject('storm-fury-move:exact-current-economy-required')}}
 else for(const[tokenId,row]of Object.entries(facts.turns)){const stored=now.d.combat.dnd5eTurnEconomyByToken?.[tokenId],active=facts.initiativeOrder?.[facts.initiativeIndex]===tokenId,slot=active?(facts.initiativeSlotIds?.[facts.initiativeIndex]??tokenId):tokenId;if(stored&&(!active||stored.turnKey===p.combatId+':'+facts.round+':'+slot)&&(row.turn.reactionAvailable!==(stored.reaction?.current>0)||tokenId===p.frame.event.actorId&&(row.turn.actionAvailable&&stored.action?.current===0||row.turn.bonusActionAvailable&&stored.bonusAction?.current===0)))return reject('storm-fury-original:canonical-economy-required')}
 const queued=now.d.requests?.requests?.filter(r=>r.id===p.parentId)??[]
 const hostEquipment=p.family==='equipment'&&p.hostEquipmentOrigin!==undefined
 if(p.hostEquipmentOrigin!==undefined&&!hostEquipment)return reject('storm-fury-original:host-issuer-scope-required')
 if(hostEquipment){const h=p.hostEquipmentOrigin,hostActor=api.controller(now.d,p.mapId,actor.id,ctx.roomId);if(!closed(h,['sourceKind','roomId','hostMemberId','parentId','mapId','combatId','round','initiativeIndex','actorTokenId','characterId'])||h.sourceKind!=='host-character-weapon-original-v1'||h.roomId!==ctx.roomId||h.hostMemberId!==principal.memberId||h.parentId!==p.parentId||h.mapId!==p.mapId||h.combatId!==p.combatId||h.round!==now.d.combat.round||h.initiativeIndex!==now.d.combat.initiativeIndex||h.actorTokenId!==actor.id||h.characterId!==actor.characterId||queued.length||!hostActor||(hostActor.character.roomMemberId??principal.memberId)!==principal.memberId||facts.action?.sourceMode!=='dm'||facts.action?.roomMemberId!==principal.memberId||facts.action?.id!==p.parentId||facts.action?.mapId!==p.mapId||facts.action?.combatId!==p.combatId||facts.action?.type!=='dnd5e-weapon-attack'||facts.action?.status!=='pending'||facts.action?.actorTokenId!==actor.id||facts.action?.characterId!==actor.characterId||facts.action?.round!==now.d.combat.round||facts.action?.initiativeIndex!==now.d.combat.initiativeIndex)return reject('storm-fury-original:actual-consumed-host-equipment-required')
 }else if(p.family==='opportunity-move'){const mover=api.controller(now.d,p.mapId,facts.action?.actorTokenId,ctx.roomId);if(queued.length!==1||!mover?.character||queued[0].status!=='pending'||queued[0].type!=='move-token'||queued[0].mapId!==p.mapId||queued[0].combatId!==p.combatId||queued[0].round!==now.d.combat.round||queued[0].initiativeIndex!==now.d.combat.initiativeIndex||!api.equal(facts.action,queued[0])||facts.action.characterId!==mover.character.id||(facts.action.roomMemberId??null)!==(mover.character.roomMemberId??null)||!api.equal(facts.move.mover,map.tokens.find(t=>t.id===facts.action.actorTokenId)))return reject('storm-fury-move:actual-queued-parent-required')
 }else if(p.family==='spell'||p.family==='equipment'){
  if(queued.length!==1||queued[0].status!=='pending'||queued[0].type!==(p.family==='spell'?'dnd5e-spell-cast':'dnd5e-weapon-attack')||queued[0].mapId!==p.mapId||queued[0].combatId!==p.combatId||queued[0].round!==now.d.combat.round||queued[0].initiativeIndex!==now.d.combat.initiativeIndex||!api.equal(facts.action,queued[0])||facts.action?.actorTokenId!==actor.id)return reject('storm-fury-original:actual-queued-spell-required')
 }else if(p.family==='opportunity'){if(queued.length||facts.action!==undefined||!api.equal(facts.actorToken,actor))return reject('storm-fury-original:actual-host-opportunity-required')}else if(queued.length||actor.characterId||!actor.poolId||facts.monsterId!==actor.poolId||!facts.resourceAction)return reject('storm-fury-original:actual-host-monster-required')
 const book={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex,family:p.family,source:p.source,frame:p.frame,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,characterId:owned.character.id,memberId:owned.character.roomMemberId??principal.memberId,windowId:stormFuryOwnerWindowId(p.parentId,p.frameIndex),scope:now.scope,...(hostEquipment?{hostEquipmentOrigin:p.hostEquipmentOrigin}:{})},prior=await api.load(ctx,key(p))
 if(prior&&!api.equal(prior,book))return reject('storm-fury-original:immutable-source-required')
 if(!prior)await api.save(ctx,key(p),book)
 return{ok:true,windowId:book.windowId}
}
async function readCurrent(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','frameIndex'])||!identity(p))return null
 const book=await api.load(ctx,key(p));if(!book||book.roomId!==ctx.roomId||book.mapId!==p.mapId||book.combatId!==p.combatId)return null
 const now=await current(ctx,p,{role:'dm',memberId:book.hostMemberId},api),owned=now&&api.controller(now.d,p.mapId,book.frame.event.targetId,ctx.roomId)
 if(!now||!api.equal(book.scope,now.scope)||!owned||owned.character.id!==book.characterId||(owned.character.roomMemberId??book.hostMemberId)!==book.memberId)return null
 return book
}
export async function readStormFuryOwnerWindow(ctx,p,principal,api){
 const book=await readCurrent(ctx,p,principal,api);if(!book||principal.memberId!==book.memberId||principal.role!==(book.memberId===book.hostMemberId?'dm':'player'))return reject('storm-fury-owner:actual-controller-required')
 return{ok:true,windowId:book.windowId,frameIndex:book.frameIndex,options:book.frame.options.map(o=>({featureId:o.featureId})),decision:(await api.load(ctx,key(p)+':answer'))?.decision??null}
}
export async function recordStormFuryOwnerAnswer(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','frameIndex','windowId','decision']))return reject('storm-fury-owner:closed-answer-required')
 const id={parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex},book=await readCurrent(ctx,id,principal,api)
 if(!book||principal.memberId!==book.memberId||principal.role!==(book.memberId===book.hostMemberId?'dm':'player')||p.windowId!==book.windowId||!validStormFuryOwnerDecision(book,p.decision))return reject('storm-fury-owner:actual-owner-answer-required')
 const answer={schemaVersion:1,sourceKind:'storm-fury-owner-answer-v1',roomId:ctx.roomId,memberId:principal.memberId,role:principal.role,windowId:book.windowId,decision:p.decision},prior=await api.load(ctx,key(p)+':answer')
 if(prior&&!api.equal(prior,answer))return{ok:false,status:409,error:'storm-fury-owner:immutable-answer-required'}
 if(!prior)await api.save(ctx,key(p)+':answer',answer)
 return{ok:true}
}
export async function readStormFuryOwnerDecision(ctx,p,principal,api){
 const book=await readCurrent(ctx,p,principal,api);if(!book||principal.role!=='dm'||principal.memberId!==book.hostMemberId)return reject('storm-fury-owner:current-host-source-required')
 const answer=await api.load(ctx,key(p)+':answer');if(!answer||answer.roomId!==ctx.roomId||answer.memberId!==book.memberId||answer.role!==(book.memberId===book.hostMemberId?'dm':'player')||answer.windowId!==book.windowId||!validStormFuryOwnerDecision(book,answer.decision))return reject('storm-fury-owner:private-owner-answer-required')
 return{ok:true,frameIndex:book.frameIndex,decision:answer.decision}
}
