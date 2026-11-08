import {readBountifulPluginSpellCompoundPrimary,readBountifulPluginSpellCompoundPrimaryForCommandAppend,bountifulPluginSpellCompoundPrimaryOriginalSourceMatches} from './bountiful-plugin-spell-compound-primary.mjs'
import {bountifulPluginSpellSavingOriginalSourceFacts} from '../../shared/bountiful-plugin-spell-saving-original.mjs'
import {bountifulOriginalRowReady,validateBountifulLuckCommand} from '../../shared/bountiful-luck-state.mjs'

const immutable=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['ownerDecisions','rawReroll','hostReroll','processedRequestIds','consumed','continuation','postOriginalD20','postOriginalEquipmentD20','postOriginalCursor','opportunitySettlementRolls','nativeLuckyDecision'].includes(key)))

/** The primary owns a distinct private index discriminator. Sharing the DiceBox
 * transport prefix does not turn a Saving, Activity or ordinary attack into it. */
export async function authenticatedBountifulPluginSpellCompoundPrimaryOriginal(ctx,row,principal,api){
 const i=row?.identity,issuer=row?.rawIssuer
 if(!i||issuer?.mode!=='dm'||issuer.cursor!==1||!/^bountiful-plugin-spell-saving-original:[a-f0-9]{64}$/.test(issuer.rollId)||row.originalAdapterId!=='plugin-spell'||row.request?.kind!=='attack'||!Number.isSafeInteger(i.occurrence)||i.occurrence<0||row.request.originalRolls?.[row.request.dieIndex]!==1)return null
 const pointer=await api.load(ctx,'plugin-spell-saving-original-request:'+issuer.rollId)
 if(!pointer||pointer.poolKind!=='primary'||pointer.roomId!==ctx.roomId||pointer.hostMemberId!==principal.memberId||['parentId','mapId','combatId'].some(key=>pointer[key]!==i[key]))return null
 const book=await readBountifulPluginSpellCompoundPrimary(ctx,{parentId:i.parentId,mapId:i.mapId,combatId:i.combatId},principal,api),slot=book.rows?.[0],facts=bountifulPluginSpellSavingOriginalSourceFacts(row.originalParent)
 if(!book.ok||book.rows.length!==1||!slot.raw||!slot.confirmed||slot.requestId!==issuer.rollId||row.request.actorId!==slot.actorId||i.roller?.tokenId!==slot.actorId||i.roller.characterId!==slot.characterId||i.roller.memberId!==slot.memberId||i.hostMemberId!==book.hostMemberId||i.roomId!==book.roomId||i.effectTimestamp!==book.effectTimestamp||!api.equal(row.request.originalRolls,slot.confirmed.values)||!facts||!bountifulPluginSpellCompoundPrimaryOriginalSourceMatches(book,row.originalParent,api)||Object.keys(facts.rolls).length!==1||!api.equal(facts.rolls[slot.rollId],{values:slot.confirmed.values,modifier:0,total:slot.confirmed.values.reduce((sum,value)=>sum+value,0)}))return null
 const d=await api.context(ctx),parents=d.requests?.requests?.filter(action=>action.id===i.parentId),action=parents?.[0],prior=Object.values(d.combat?.bountifulOriginalParents??{}).filter(previous=>previous?.identity?.parentId===i.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 if(parents?.length!==1||!api.equal(row.originalRoomAction,action))return null
 if(i.occurrence===0){if(row.request.nativeLucky)return null}
 else{
  if(prior.length!==i.occurrence||prior[0]?.request.nativeLucky)return null
  for(let index=0;index<prior.length;index++){
   const previous=prior[index],identity=previous.identity,original=bountifulPluginSpellSavingOriginalSourceFacts(previous.originalParent),stamp=await api.load(ctx,'original:'+JSON.stringify(['bountiful-original-parent',i.parentId,index]))
   if(previous.consumed||identity.occurrence!==index||identity.roomId!==book.roomId||identity.hostMemberId!==book.hostMemberId||identity.effectTimestamp!==book.effectTimestamp||identity.mapId!==book.mapId||identity.combatId!==book.combatId||previous.originalAdapterId!=='plugin-spell'||previous.request.kind!=='attack'||previous.rawIssuer?.mode!=='dm'||previous.rawIssuer.rollId!==slot.requestId||previous.rawIssuer.cursor!==1||previous.request.actorId!==slot.actorId||!api.equal(previous.request.originalRolls,slot.confirmed.values)||!api.equal(previous.originalRoomAction,action)||!original||!bountifulPluginSpellCompoundPrimaryOriginalSourceMatches(book,previous.originalParent,api)||!api.equal(original.rolls,facts.rolls)||!bountifulOriginalRowReady(previous)||!stamp||stamp.roomId!==book.roomId||stamp.memberId!==book.hostMemberId||stamp.identity!==api.digest(immutable(previous))||!api.equal(stamp.raw,slot.raw)||!api.equal(stamp.adopted,slot.confirmed))return null
  }
  if(row.request.nativeLucky){
   const actor=api.controller(d,i.mapId,row.request.actorId,ctx.roomId)?.character
   if(row.request.nativeLucky!==true||row.nativeLuckyChoiceVersion!==1||actor?.dnd5eRaceId!=='halfling'||actor.dnd5eCombatState?.activeEffects?.some(effect=>effect.tags?.includes('bountiful-luck:racial-lucky-suppressed'))||prior.some(previous=>previous.request.nativeLucky&&(previous.request.dieIndex===row.request.dieIndex||previous.nativeLuckyDecision?.decision==='use')||!previous.request.nativeLucky&&previous.request.dieIndex===row.request.dieIndex&&(previous.ownerDecisions??[]).some(choice=>choice.decision==='use')))return null
  }else{
   const used=new Set(prior.flatMap(previous=>previous.request.nativeLucky?[]:(previous.ownerDecisions??[]).filter(choice=>choice.decision==='use').map(choice=>choice.ownerId)))
   if(row.request.originalRolls.length!==2||row.request.dieIndex<=prior[prior.length-1].request.dieIndex||prior.some(previous=>!previous.request.nativeLucky&&previous.request.dieIndex===row.request.dieIndex)||row.request.options.some(option=>used.has(option.ownerId)))return null
  }
 }
 return{parent:action,raw:slot.raw,adopted:slot.confirmed}
}

async function appendContext(ctx,action,principal,api){
 const scope=action?.bountifulLuck
 if(action?.type!=='dnd5e-bountiful-luck'||!validateBountifulLuckCommand(scope)||!['player','dm'].includes(action.sourceMode)||!['dm','player'].includes(principal.role)||principal.memberId!==action.roomMemberId||principal.role!==(action.sourceMode==='player'?'player':'dm'))return null
 const d=await api.context(ctx),row=d.combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',scope.parentId,scope.occurrence])],i=row?.identity
 if(!row||row.consumed||i.roomId!==ctx.roomId||i.mapId!==action.mapId||i.combatId!==action.combatId||i.parentId!==scope.parentId||row.originalAdapterId!=='plugin-spell'||row.request.kind!=='attack'||row.rawIssuer?.cursor!==1)return null
 const pointer=await api.load(ctx,'plugin-spell-saving-original-request:'+row.rawIssuer?.rollId)
 if(pointer?.poolKind!=='primary'||pointer.roomId!==ctx.roomId||pointer.hostMemberId!==i.hostMemberId||['parentId','mapId','combatId'].some(key=>pointer[key]!==i[key]))return null
 const command=scope.command,owner=command.phase==='reaction'&&row.controllers?.[command.ownerId]
 if(command.phase==='reaction'?(!owner||owner.memberId!==principal.memberId||owner.characterId!==action.characterId||action.actorTokenId!==command.ownerId||!row.request.options.some(option=>option.ownerId===command.ownerId&&option.featureId===command.featureId)):command.phase==='confirm'?(principal.role!=='dm'||principal.memberId!==i.hostMemberId||action.actorTokenId!==i.roller.tokenId):['roll','native-lucky'].includes(command.phase)?(principal.memberId!==i.roller.memberId||action.actorTokenId!==i.roller.tokenId||action.characterId!==i.roller.characterId||command.phase==='native-lucky'&&!row.request.nativeLucky):true)return null
 return{identity:{parentId:i.parentId,mapId:i.mapId,combatId:i.combatId},host:{role:'dm',memberId:i.hostMemberId},effectTimestamp:i.effectTimestamp}
}

export async function preflightBountifulPluginSpellCompoundPrimaryCommandAppend(ctx,action,principal,api){
 const actual=await appendContext(ctx,action,principal,api)
 if(!actual)return{ok:false,status:403,error:'ice-knife-primary:actual-append-principal-required'}
 const book=await readBountifulPluginSpellCompoundPrimary(ctx,actual.identity,actual.host,api)
 return book.ok&&book.effectTimestamp===actual.effectTimestamp?{ok:true}:{ok:false,status:403,error:'ice-knife-primary:current-preappend-source-required'}
}

export async function readBountifulPluginSpellCompoundPrimaryOriginalForCommandAppend(ctx,action,principal,api){
 const actual=await appendContext(ctx,action,principal,api)
 if(!actual)return{ok:false,status:403,error:'ice-knife-primary:actual-append-principal-required'}
 const book=await readBountifulPluginSpellCompoundPrimaryForCommandAppend(ctx,actual.identity,actual.host,api,action,principal)
 return book.ok&&book.effectTimestamp===actual.effectTimestamp?book:{ok:false,status:403,error:'ice-knife-primary:actual-append-tail-required'}
}
