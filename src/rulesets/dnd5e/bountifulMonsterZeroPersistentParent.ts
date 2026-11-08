import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{Dnd5eTurnEconomyByToken,SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import{readBountifulMonsterDamageZeroOriginalQualification,encodeBountifulMonsterDamageZeroOriginalQualification,type BountifulMonsterDamageZeroOriginalQualification}from'./bountifulMonsterDamageZeroOriginalQualification'
import{readDnd5eMonsterDamageZeroOriginalContext}from'./monsterDamageZeroOriginalContext'
import{createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse,decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{bountifulPreparedController,bountifulPreparedOriginalRoller}from'./bountifulPreparedController'
import{validateBountifulOriginalParents,validateBountifulLuckCommand}from'../../../shared/bountiful-luck-state.mjs'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import type{OriginalD20ReplayFacts}from'./allyNaturalOneCheckpoint'
import{bountifulUnconsumedParentRows}from'../../../shared/bountiful-parent-retention.mjs'
import{saveBountifulPhase}from'./bountifulPhaseCommit'
type Synced<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
interface Combat{active?:boolean;mapId?:string;combatId?:string;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:Dnd5eTurnEconomyByToken;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function revision(value:Synced<object>|null){const current=value?._sync?.revision;if(!Number.isSafeInteger(current)||current!<0)throw Error('monster-zero-parent:revision-required');return current!}
/** A true class saving operation and its independently adopted original pool
 * issue this row. Neither a public result nor a caller source can issue it. */
export async function persistBountifulMonsterZeroOriginal(qualification:BountifulMonsterDamageZeroOriginalQualification,source:unknown,gateway:Gateway){
 const facts=await readBountifulMonsterDamageZeroOriginalQualification(qualification,source),prepared=facts.source.prepared,context=readDnd5eMonsterDamageZeroOriginalContext(facts.source),host=getRoomSession()
 if(!context||!host||host.role!=='dm'||context.parentId!==facts.parentId)throw Error('monster-zero-parent:actual-host-context-required')
 const command=context.command
 const[combat,characters,maps,geometry,queue]=await Promise.all([gateway.loadResource<Synced<Combat>>('combat'),gateway.loadResource<Synced<{characters:Character[]}>>('characters'),gateway.loadResource<Synced<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Synced<object>>('map-geometry'),gateway.loadResource<Synced<object>>('player-action-requests')])
 await readBountifulMonsterDamageZeroOriginalQualification(qualification,source)
 if(!combat||!characters||!maps||!queue||combat.active!==true||combat.mapId!==command.mapId||combat.combatId!==command.combatId||combat.round!==prepared.state.round||combat.initiativeIndex!==prepared.state.initiativeIndex||!same(maps.maps.find(map=>map.id===command.mapId),prepared.map)||!same(characters.characters,prepared.characters))throw Error('monster-zero-parent:stale-native-source')
 for(const actor of Object.values(prepared.state.combatants)){
  const stored=combat.dnd5eTurnEconomyByToken?.[actor.id],active=prepared.state.initiativeOrder[prepared.state.initiativeIndex]===actor.id,slot=prepared.state.initiativeSlotIds?.[prepared.state.initiativeIndex]??actor.id
  if(stored&&(!active||stored.turnKey===prepared.state.combatId+':'+prepared.state.round+':'+slot)&&(actor.turn.reactionAvailable!==(stored.reaction.current>0)||actor.id===command.actorTokenId&&(actor.turn.actionAvailable&&stored.action.current===0||actor.turn.bonusActionAvailable&&stored.bonusAction.current===0)))throw Error('monster-zero-parent:stale-native-economy')
 }
 if(!validateBountifulOriginalParents(combat.bountifulOriginalParents??{}))throw Error('monster-zero-parent:invalid-stored-parents')
 const wire=await encodeBountifulMonsterDamageZeroOriginalQualification(qualification,source),id=JSON.stringify(['bountiful-original-parent',facts.parentId,0]),prior=combat.bountifulOriginalParents?.[id]
 if(prior){if(prior.consumed||!same(prior.originalRoomAction,command)||!same(prior.originalParent,wire)||!same(prior.request,facts.request)||!same(prior.rawIssuer,facts.rawIssuer)||prior.identity.effectTimestamp!==facts.effectTimestamp)throw Error('monster-zero-parent:parent-id-reused');return structuredClone(prior)}
 const request=facts.request,receipt=createBountifulOriginalDieReceipt({identity:{roomId:host.roomId,mapId:command.mapId,combatId:command.combatId,parentId:facts.parentId,occurrence:0,round:prepared.state.round,initiativeIndex:prepared.state.initiativeIndex,reactionEconomySignature:JSON.stringify(combat.dnd5eTurnEconomyByToken??{}),roller:bountifulPreparedOriginalRoller(prepared,request.actorId,host.memberId),hostMemberId:host.memberId,effectTimestamp:facts.effectTimestamp,revisions:{characters:revision(characters),maps:revision(maps),'map-geometry':geometry?revision(geometry):0}},rawIssuer:facts.rawIssuer,originalAdapterId:'monster',originalRoomAction:{...command},originalParent:wire,originalCheckpoint:{actorId:request.actorId,kind:'saving-throw'},request,controllers:Object.fromEntries(request.options.map(option=>[option.ownerId,bountifulPreparedController(prepared,option.ownerId,host.memberId)]))})
 if(!validateBountifulOriginalParents({[id]:receipt}))throw Error('monster-zero-parent:invalid-issued-parent')
 await gateway.publishEvent('bountiful-original-mint-dm-to-host',{id,receipt})
 await readBountifulMonsterDamageZeroOriginalQualification(qualification,source)
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...bountifulUnconsumedParentRows(combat.bountifulOriginalParents),[id]:receipt}}}],{transactionId:'bountiful-monster-zero-issue:'+id,readRevisions:{...receipt.identity.revisions,'player-action-requests':revision(queue)}})
 return receipt
}

async function readActualParents(qualification:BountifulMonsterDamageZeroOriginalQualification,source:unknown,gateway:Pick<Gateway,'loadResource'>){
 const facts=await readBountifulMonsterDamageZeroOriginalQualification(qualification,source),host=getRoomSession(),combat=await gateway.loadResource<Synced<Combat>>('combat'),context=readDnd5eMonsterDamageZeroOriginalContext(facts.source)
 if(!host||host.role!=='dm'||!combat||!context||!validateBountifulOriginalParents(combat.bountifulOriginalParents??{})||combat.active!==true||combat.mapId!==context.command.mapId||combat.combatId!==context.command.combatId||combat.round!==facts.source.prepared.state.round||combat.initiativeIndex!==facts.source.prepared.state.initiativeIndex)throw Error('monster-zero-parent:protected-current-parent-required')
 const wire=await encodeBountifulMonsterDamageZeroOriginalQualification(qualification,source),rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===facts.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 if(!rows.length||rows.some((row,index)=>row.consumed||row.identity.occurrence!==index||row.identity.roomId!==host.roomId||row.identity.hostMemberId!==host.memberId||row.identity.effectTimestamp!==facts.effectTimestamp||!same(row.originalRoomAction,context.command)||!same(row.originalParent,wire)||!same(row.rawIssuer,facts.rawIssuer)||row.originalCheckpoint?.kind!=='saving-throw'||row.originalCheckpoint.actorId!==facts.request.actorId||row.identity.reactionEconomySignature!==JSON.stringify(combat.dnd5eTurnEconomyByToken??{})))throw Error('monster-zero-parent:changed-protected-original')
 return{facts,combat,rows,host}
}
/** Responses are reread from the authenticated append-only action queue. */
export async function processBountifulMonsterZeroChoice(qualification:BountifulMonsterDamageZeroOriginalQualification,source:unknown,requestId:string,gateway:Gateway){
 const{combat,rows,host}=await readActualParents(qualification,source,gateway),queue=await gateway.loadResource<Synced<{requests:SharedPlayerActionState[]}>>('player-action-requests'),action=queue?.requests.find(row=>row.id===requestId),command=action?.bountifulLuck
 if(!queue||!action||action.type!=='dnd5e-bountiful-luck'||action.status!=='pending'||!action.roomMemberId||!command||!validateBountifulLuckCommand(command)||(command.command.phase!=='native-lucky'&&command.command.phase!=='reaction'&&command.command.phase!=='roll'&&command.command.phase!=='confirm'))throw Error('monster-zero-parent:authenticated-choice-required')
 const receipt=rows.find(row=>row.identity.parentId===command.parentId&&row.identity.occurrence===command.occurrence)
 if(!receipt||action.round!==receipt.identity.round||action.initiativeIndex!==receipt.identity.initiativeIndex)throw Error('monster-zero-parent:current-owner-parent-required')
 const next=applyBountifulStampedDieResponse(receipt,{...command,command:command.command,id:action.id,roomId:host.roomId,mapId:action.mapId,combatId:action.combatId??'',roomMemberId:action.roomMemberId,sourceMode:action.sourceMode,actorTokenId:action.actorTokenId,characterId:action.characterId}),id=JSON.stringify(['bountiful-original-parent',command.parentId,command.occurrence])
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:next}}},{name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.map(row=>row.id===requestId?{...row,status:'done'}:row)}}],{transactionId:'bountiful-monster-zero-response:'+requestId,readRevisions:receipt.identity.revisions})
 return next
}
/** The exact frozen Native resolver discovers each request again before its
 * stamped decision is allowed into the original replay transcript. */
export async function readBountifulMonsterZeroOriginalReady(qualification:BountifulMonsterDamageZeroOriginalQualification,source:unknown,gateway:Pick<Gateway,'loadResource'>){
 const{facts,rows}=await readActualParents(qualification,source,gateway),state=facts.source.prepared.state,session=createDnd5eOriginalD20Session(facts.source,resolvePreparedDnd5eMonsterAttack,facts.request.actorId,'saving-throw'),replay:OriginalD20ReplayFacts['facts'][number][]=[]
 try{
  let stage=session.run(state)
  while(stage.status==='pending-ally-natural-one'){
   const receipt=rows[stage.occurrence]
   if(!receipt)throw Error('monster-zero-parent:next-actual-receipt-required')
   const decision=decisionFromBountifulOriginalDieReceipt(receipt,stage.request)
   replay.push({occurrence:stage.occurrence,request:structuredClone(stage.request),...(decision?{decision:structuredClone(decision)}:{})})
   stage=session.resumeAllyNaturalOne(state,stage.occurrence,stage.request,decision)
  }
  if(stage.status!=='original-d20-ready'||replay.length!==rows.length)throw Error('monster-zero-parent:exact-native-original-ready-required')
  return{source:{...facts.source,hostOriginalD20Replay:{...facts.source.hostOriginalD20Replay,facts:replay}},stage,receipts:rows}
 }finally{session.cancel()}
}

/** Only the exact native replay of every authenticated preceding receipt can
 * discover the next original die. No request, result or snapshot is accepted. */
export async function issueNextBountifulMonsterZeroOriginal(qualification:BountifulMonsterDamageZeroOriginalQualification,source:unknown,gateway:Gateway,options?:{nativeLuckyChoiceVersion?:1}){
 const{facts,rows,combat,host}=await readActualParents(qualification,source,gateway),state=facts.source.prepared.state,session=createDnd5eOriginalD20Session(facts.source,resolvePreparedDnd5eMonsterAttack,facts.request.actorId,'saving-throw')
 try{
  let pending=session.run(state)
  for(const receipt of rows){
   if(pending.status!=='pending-ally-natural-one'||pending.occurrence!==receipt.identity.occurrence)throw Error('monster-zero-next:exact-actual-prefix-required')
   const decision=decisionFromBountifulOriginalDieReceipt(receipt,pending.request)
   pending=session.resumeAllyNaturalOne(state,pending.occurrence,pending.request,decision)
  }
  if(pending.status==='original-d20-ready')return undefined
  if(pending.status!=='pending-ally-natural-one'||pending.occurrence!==rows.length||pending.request.actorId!==facts.request.actorId||pending.request.kind!=='saving-throw'||!same(pending.request.originalRolls,facts.request.originalRolls))throw Error('monster-zero-next:same-actual-original-pool-required')
  const first=rows[0],request=pending.request,id=JSON.stringify(['bountiful-original-parent',facts.parentId,pending.occurrence]),receipt=createBountifulOriginalDieReceipt({...((request.nativeLucky&&options?.nativeLuckyChoiceVersion===1)?{nativeLuckyChoiceVersion:1 as const}:{}),identity:{...first.identity,occurrence:pending.occurrence},rawIssuer:{...first.rawIssuer!},originalAdapterId:first.originalAdapterId,originalRoomAction:first.originalRoomAction,originalParent:first.originalParent,originalCheckpoint:first.originalCheckpoint,request:structuredClone(request),controllers:Object.fromEntries(request.options.map(option=>[option.ownerId,bountifulPreparedController(facts.source.prepared,option.ownerId,host.memberId)]))})
  if(!validateBountifulOriginalParents({...combat.bountifulOriginalParents,[id]:receipt}))throw Error('monster-zero-next:invalid-real-native-next')
  const current=await readActualParents(qualification,source,gateway),queue=await gateway.loadResource<Synced<object>>('player-action-requests')
  if(!same(current.rows,rows)||revision(current.combat)!==revision(combat)||!queue)throw Error('monster-zero-next:changed-authenticated-prefix')
  await gateway.publishEvent('bountiful-original-mint-dm-to-host',{id,receipt})
  await readBountifulMonsterDamageZeroOriginalQualification(qualification,source)
  await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:receipt}}}],{transactionId:'bountiful-monster-zero-next:'+id,readRevisions:{...first.identity.revisions,'player-action-requests':revision(queue)}})
  return receipt
 }finally{session.cancel()}
}
