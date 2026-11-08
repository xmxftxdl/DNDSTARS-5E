import {assertBountifulNativeSecondChanceCosts} from './bountifulNativeSecondChanceCosts'
import {consumeDnd5eBountifulDeferredD20} from './bountifulDeferredD20Mechanics'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {bountifulMonsterAfterDiceMatches} from '../../../shared/bountiful-monster-after-dice.mjs'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {bountifulIssuedHostOperation,encodeBountifulHostOperation,encodeBountifulHostMonsterDamage,type BountifulHostOperationCapability} from './bountifulHostOperation'
import {createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse,decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulPreparedController} from './bountifulPreparedController'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {bountifulUnconsumedParentRows} from '../../../shared/bountiful-parent-retention.mjs'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import {decodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {captureBountifulMonsterOriginalOperation} from './bountifulHostOperation'
import {validBountifulHostOperation,bountifulMonsterDamageContinuationMatches} from '../../../shared/bountiful-host-operation.mjs'
import {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import type {SharedPlayerActionState,Dnd5eTurnEconomyByToken} from '../../lib/sharedCombatTypes'
import {validateBountifulLuckCommand} from '../../../shared/bountiful-luck-state.mjs'

type Synced<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
interface Combat{secondChanceAttacks?:import('../../lib/secondChanceHostState').SecondChanceCombat['secondChanceAttacks'];active?:boolean;mapId?:string;combatId?:string;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:Dnd5eTurnEconomyByToken;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
const revision=(value:Synced<object>|null)=>{const current=value?._sync?.revision;if(!Number.isSafeInteger(current)||current!<0)throw Error('bountiful-host-operation:revision-required');return current!}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)

/** A true native Host operation has no player action row. Its protected parent
 * is the actual statblock facade input captured at the authenticated Host raw
 * callback, with its own explicit identity and immutable source snapshot. */
export async function persistBountifulHostOperation(capability:BountifulHostOperationCapability,gateway:Gateway){
 const facts=bountifulIssuedHostOperation(capability),{source,operation,pending}=facts,prepared=source.prepared
 const [combat,characters,maps,geometry,queue]=await Promise.all([
  gateway.loadResource<Synced<Combat>>('combat'),gateway.loadResource<Synced<{characters:Character[]}>>('characters'),gateway.loadResource<Synced<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Synced<object>>('map-geometry'),gateway.loadResource<Synced<object>>('player-action-requests')])
 bountifulIssuedHostOperation(capability)
 if(!combat||!characters||!maps||!queue||combat.active!==true||combat.mapId!==operation.mapId||combat.combatId!==operation.combatId||combat.round!==prepared.state.round||combat.initiativeIndex!==prepared.state.initiativeIndex||!same(maps.maps.find(map=>map.id===operation.mapId),prepared.map)||!same(characters.characters,prepared.characters))throw Error('bountiful-host-operation:stale-native-source')
 for(const actor of Object.values(prepared.state.combatants)){
  const stored=combat.dnd5eTurnEconomyByToken?.[actor.id],active=prepared.state.initiativeOrder[prepared.state.initiativeIndex]===actor.id,slot=prepared.state.initiativeSlotIds?.[prepared.state.initiativeIndex]??actor.id
  if(stored&&(!active||stored.turnKey===prepared.state.combatId+':'+prepared.state.round+':'+slot)&&(actor.turn.reactionAvailable!==(stored.reaction.current>0)||actor.id===operation.actorTokenId&&(actor.turn.actionAvailable&&stored.action.current===0||actor.turn.bonusActionAvailable&&stored.bonusAction.current===0)))throw Error('bountiful-host-operation:stale-native-economy')
 }
 if(!validateBountifulOriginalParents(combat.bountifulOriginalParents??{}))throw Error('bountiful-host-operation:invalid-stored-parents')
 const id=JSON.stringify(['bountiful-original-parent',operation.parentId,0]),wire=encodeBountifulHostOperation(capability),prior=combat.bountifulOriginalParents?.[id]
 if(prior){if(!same(prior.originalRoomAction,operation)||!same(prior.originalParent,wire))throw Error('bountiful-host-operation:parent-id-reused');return structuredClone(prior)}
 const host=getRoomSession()
 if(!host||host.role!=='dm'||host.roomId!==facts.roomId||host.memberId!==operation.hostMemberId)throw Error('bountiful-host-operation:host-changed')
 const request=pending.request
 const receipt=createBountifulOriginalDieReceipt({identity:{roomId:host.roomId,mapId:operation.mapId,combatId:operation.combatId,parentId:operation.parentId,occurrence:0,round:prepared.state.round,initiativeIndex:prepared.state.initiativeIndex,reactionEconomySignature:JSON.stringify(combat.dnd5eTurnEconomyByToken??{}),roller:facts.roller,hostMemberId:host.memberId,revisions:{characters:revision(characters),maps:revision(maps),'map-geometry':geometry?revision(geometry):0}},rawIssuer:{mode:'dm',rollId:operation.rawRollId,cursor:operation.rawCursor},originalAdapterId:'monster',originalRoomAction:{...operation},originalParent:wire,originalCheckpoint:{actorId:operation.actorTokenId,kind:'attack'},request,controllers:Object.fromEntries(request.options.map(option=>[option.ownerId,bountifulPreparedController(prepared,option.ownerId,host.memberId)]))})
 if(!validateBountifulOriginalParents({[id]:receipt}))throw Error('bountiful-host-operation:invalid-issued-parent')
 await gateway.publishEvent('bountiful-original-mint-dm-to-host',{id,receipt})
 bountifulIssuedHostOperation(capability)
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...bountifulUnconsumedParentRows(combat.bountifulOriginalParents),[id]:receipt}}}],{transactionId:'bountiful-native-issue:'+id,readRevisions:{...receipt.identity.revisions,'player-action-requests':revision(queue)}})
 bountifulIssuedHostOperation(capability)
 return receipt
}

/** Reload has no source DTO argument. Only the current server-protected parent
 * row can request a fresh concrete monster issuer, and that issuer must produce
 * exactly the same native operation, raw request, and source wire again. */
export async function recoverBountifulHostOperation(parentId:string,gateway:Pick<Gateway,'loadResource'>,options?:{includeDamage?:boolean}){
 const host=getRoomSession(),combat=await gateway.loadResource<Synced<Combat>>('combat')
 const id=JSON.stringify(['bountiful-original-parent',parentId,0]),row=combat?.bountifulOriginalParents?.[id]
 if(!host||host.role!=='dm'||!row||row.consumed||!validateBountifulOriginalParents(combat?.bountifulOriginalParents)||row.identity.roomId!==host.roomId||row.identity.hostMemberId!==host.memberId||!validBountifulHostOperation(row.originalRoomAction)||combat?.active!==true||combat.mapId!==row.identity.mapId||combat.combatId!==row.identity.combatId||combat.round!==row.identity.round||combat.initiativeIndex!==row.identity.initiativeIndex)throw Error('bountiful-host-operation:protected-current-parent-required')
 const [characters,maps,geometry]=await Promise.all([gateway.loadResource<Synced<{characters:Character[]}>>('characters'),gateway.loadResource<Synced<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Synced<object>>('map-geometry')])
 if(!characters||!maps||revision(maps)!==row.identity.revisions.maps||(geometry?revision(geometry):0)!==row.identity.revisions['map-geometry'])throw Error('bountiful-host-operation:stale-native-source')
 if(row.continuation&&(row.continuation.hostMemberId!==host.memberId||(!bountifulMonsterDamageContinuationMatches(row.originalParent,row.continuation.source)&&!bountifulMonsterAfterDiceMatches(row.originalParent,row.continuation.source))))throw Error('bountiful-host-operation:foreign-damage-continuation')
 const wire=options?.includeDamage?row.continuation?.source??row.originalParent:row.originalParent,source=decodeSecondChanceParentWire(wire)
 if(!monsterSource(source)||!same(source.prepared.map,maps.maps.find(map=>map.id===row.identity.mapId)))throw Error('bountiful-host-operation:invalid-protected-monster-source')
 if(revision(characters)!==row.identity.revisions.characters||!same(source.prepared.characters,characters.characters)||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==row.identity.reactionEconomySignature)await assertBountifulNativeSecondChanceCosts({combat,first:row,source,characters:characters.characters,characterRevision:revision(characters),hostMemberId:host.memberId})
 const operation=row.originalRoomAction,capability=captureBountifulMonsterOriginalOperation({parentId,source,rawRollId:operation.rawRollId,rawCursor:operation.rawCursor})
 if(!capability)throw Error('bountiful-host-operation:original-checkpoint-disappeared')
 const facts=bountifulIssuedHostOperation(capability)
 if(facts.roomId!==row.identity.roomId||!same(facts.operation,operation)||!same(facts.pending.request,row.request)||!same(encodeBountifulHostOperation(capability),wire))throw Error('bountiful-host-operation:changed-protected-monster-source')
 return capability
}

/** Persist the real later damage callback without publishing damage or cost. */
export async function recordBountifulHostMonsterDamage(parentId:string,damage:readonly (readonly (readonly number[])[])[],gateway:Gateway){
 const capability=await recoverBountifulHostOperation(parentId,gateway),combat=await gateway.loadResource<Synced<Combat>>('combat'),id=JSON.stringify(['bountiful-original-parent',parentId,0]),row=combat?.bountifulOriginalParents?.[id],host=getRoomSession()
 if(!row||!combat||!host||host.role!=='dm')throw Error('bountiful-host-operation:protected-parent-required')
 decisionFromBountifulOriginalDieReceipt(row,row.request)
 await readBountifulHostMonsterOriginalReady(parentId,gateway)
 const wire=encodeBountifulHostMonsterDamage(capability,damage)
 if(!bountifulMonsterDamageContinuationMatches(row.originalParent,wire))throw Error('bountiful-host-operation:foreign-native-damage-source')
 const continuation={hostMemberId:host.memberId,source:wire}
 if(row.continuation){if(!same(row.continuation,continuation))throw Error('bountiful-host-operation:damage-already-confirmed');return}
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:{...row,continuation}}}}],{transactionId:'bountiful-native-damage:'+parentId,readRevisions:row.identity.revisions})
}

/** Real pre-damage continuation for the existing Monster UI. A public result
 * or manually entered replacement never becomes a new original die here. */
export async function readBountifulHostMonsterOriginalStage(parentId:string,gateway:Pick<Gateway,'loadResource'>){
 const capability=await recoverBountifulHostOperation(parentId,gateway),facts=bountifulIssuedHostOperation(capability),combat=await gateway.loadResource<Synced<Combat>>('combat')
 const rows=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const source=facts.source,effectTimestamp=rows[0]?.identity.effectTimestamp
 const input={...source,hostOriginalD20Replay:{parentId,sourceKey:originalD20ReplaySourceKey(parentId,source.prepared.state,facts.operation,effectTimestamp),facts:[],...(effectTimestamp===undefined?{}:{effectTimestamp})}}
 const session=createDnd5eOriginalD20Session(input,resolvePreparedDnd5eMonsterAttack,facts.operation.actorTokenId,'attack')
 try{
  let stage=session.run(source.prepared.state)
  for(let count=0;stage.status==='pending-ally-natural-one'&&count<128;count++){
   const pending=stage,receipt=rows.find(row=>row.identity.occurrence===pending.occurrence)
   if(!receipt)return {status:'pending-record' as const,request:stage.request,occurrence:stage.occurrence}
   if(receipt.consumed||JSON.stringify(receipt.originalParent)!==JSON.stringify(rows[0].originalParent))throw Error('bountiful-native-driver:changed-original-group')
   let decision:ReturnType<typeof decisionFromBountifulOriginalDieReceipt>
   try{decision=decisionFromBountifulOriginalDieReceipt(receipt,stage.request)}catch(error){if(error instanceof Error&&error.message==='bountiful-parent:decision-still-pending')return {status:'pending-decision' as const,receipt};throw error}
   stage=session.resumeAllyNaturalOne(source.prepared.state,stage.occurrence,stage.request,decision)
  }
  if(stage.status!=='original-d20-ready')throw Error('bountiful-host-operation:actual-monster-ready-required')
  const choices=(rows[0]?.postOriginalD20??[]).filter(row=>row.readyOrdinal===stage.request.ordinal)
  if(!choices.length)return stage
  const snapshot=cloneDnd5eHostTransactionInput(stage.snapshot),actor=snapshot.combatants[stage.request.actorId]
  if(!actor)throw Error('bountiful-followup:actual-original-owner-required')
  if(!stage.request.rollMode)throw Error('bountiful-followup:actual-roll-mode-required')
  const values=consumeDnd5eBountifulDeferredD20(actor,stage.request.kind,stage.request.values,choices,[],new Set(stage.request.finalizedDice),{rollMode:stage.request.rollMode,attackAbility:stage.request.attackAbility})
  return {...stage,snapshot,request:{...stage.request,values,finalizedDice:[...stage.request.finalizedDice,...choices.map(row=>row.dieIndex)]}}
 }finally{session.cancel()}
}

/** This issues only the next request rediscovered by the real frozen facade.
 * A caller supplies neither a request nor a source snapshot. */
export async function persistBountifulHostNextOriginal(parentId:string,gateway:Gateway){
 const stage=await readBountifulHostMonsterOriginalStage(parentId,gateway)
 if(stage.status!=='pending-record')return
 const cap=await recoverBountifulHostOperation(parentId,gateway),facts=bountifulIssuedHostOperation(cap),combat=await gateway.loadResource<Synced<Combat>>('combat'),host=getRoomSession(),first=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',parentId,0])]
 if(!combat||!host||host.role!=='dm'||!first||stage.occurrence<1||stage.request.actorId!==facts.operation.actorTokenId||JSON.stringify(stage.request.originalRolls)!==JSON.stringify(first.request.originalRolls))throw Error('bountiful-native-driver:actual-next-original-required')
 const id=JSON.stringify(['bountiful-original-parent',parentId,stage.occurrence]),receipt=createBountifulOriginalDieReceipt({identity:{...first.identity,occurrence:stage.occurrence},rawIssuer:first.rawIssuer,originalAdapterId:first.originalAdapterId,originalRoomAction:first.originalRoomAction,originalParent:first.originalParent,originalCheckpoint:first.originalCheckpoint,request:stage.request,controllers:stage.request.nativeLucky?{}:Object.fromEntries(stage.request.options.map(option=>[option.ownerId,bountifulPreparedController(facts.source.prepared,option.ownerId,host.memberId)]))})
 if(!validateBountifulOriginalParents({[id]:receipt}))throw Error('bountiful-native-driver:invalid-next-original')
 await gateway.publishEvent('bountiful-original-mint-dm-to-host',{id,receipt})
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:receipt}}}],{transactionId:'bountiful-native-next:'+id,readRevisions:first.identity.revisions})
}

export async function readBountifulHostMonsterOriginalReady(parentId:string,gateway:Pick<Gateway,'loadResource'>){
 const stage=await readBountifulHostMonsterOriginalStage(parentId,gateway)
 if(stage.status!=='original-d20-ready')throw Error('bountiful-host-operation:decision-still-pending')
 return stage
}

function monsterSource(value:unknown):value is Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]{
 const record=(item:unknown):item is Record<string,unknown>=>!!item&&typeof item==='object'&&!Array.isArray(item)
 if(!record(value)||!record(value.prepared)||typeof value.transactionId!=='string'||!Array.isArray(value.rolls)||!value.rolls.length)return false
 const prepared=value.prepared
 return record(prepared.map)&&record(prepared.state)&&record(prepared.actorToken)&&record(prepared.targetToken)&&record(prepared.resourceAction)&&record(prepared.monster)&&Array.isArray(prepared.characters)&&Array.isArray(prepared.attacks)&&record(prepared.characterIdByCombatantId)&&Array.isArray(prepared.state.initiativeOrder)&&record(prepared.state.combatants)&&value.rolls.every(roll=>record(roll)&&Number.isInteger(roll.d20)&&Array.isArray(roll.damageRolls)&&roll.damageRolls.every(group=>Array.isArray(group)&&group.every(Number.isInteger)))
}

/** The only response input is an ID reread from the real authenticated queue.
 * No caller may supply the owner principal, native source, or reaction cost. */
export async function processBountifulHostOperationChoice(requestId:string,gateway:Gateway){
 const [combat,queue]=await Promise.all([gateway.loadResource<Synced<Combat>>('combat'),gateway.loadResource<Synced<{requests:SharedPlayerActionState[]}>>('player-action-requests')])
 const action=queue?.requests.find(row=>row.id===requestId),command=action?.bountifulLuck
 if(!combat||!queue||!action||action.type!=='dnd5e-bountiful-luck'||action.status!=='pending'||!action.roomMemberId||!command||!validateBountifulLuckCommand(command))throw Error('bountiful-host-operation:authenticated-owner-choice-required')
 if(command.command.phase!=='reaction'&&command.command.phase!=='roll'&&command.command.phase!=='confirm')throw Error('bountiful-host-operation:original-phase-required')
 await recoverBountifulHostOperation(command.parentId,gateway)
 const id=JSON.stringify(['bountiful-original-parent',command.parentId,command.occurrence]),receipt=combat.bountifulOriginalParents?.[id],host=getRoomSession()
 if(!receipt||!host||host.role!=='dm'||action.round!==receipt.identity.round||action.initiativeIndex!==receipt.identity.initiativeIndex)throw Error('bountiful-host-operation:current-owner-parent-required')
 const next=applyBountifulStampedDieResponse(receipt,{...command,command:command.command,id:action.id,roomId:host.roomId,mapId:action.mapId,combatId:action.combatId??'',roomMemberId:action.roomMemberId,sourceMode:action.sourceMode,actorTokenId:action.actorTokenId,characterId:action.characterId})
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:next}}},{name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.map(row=>row.id===requestId?{...row,status:'done'}:row)}}],{transactionId:'bountiful-native-response:'+requestId,readRevisions:receipt.identity.revisions})
 return next
}
