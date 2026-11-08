import {saveBountifulPhase} from './bountifulPhaseCommit'
import {assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {bountifulOriginalRollIssuerMode} from './bountifulOriginalRawIssuer'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {getRoomSession} from '../../lib/roomSession'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {validateBountifulOriginalParents,validateBountifulLuckCommand} from '../../../shared/bountiful-luck-state.mjs'
import {validateBountifulEquipmentD20Receipt} from '../../../shared/bountiful-equipment-d20.mjs'
import {readBountifulOriginalSource,BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {resumeBountifulOriginalParent} from './bountifulLuckPersistedReplay'
import {resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {consumeDnd5eBountifulDeferredD20} from './bountifulDeferredD20Mechanics'
import {resolveBountifulEquipmentD20Selection} from './bountifulEquipmentD20Mechanics'
import {createBountifulEquipmentD20Receipt,applyBountifulEquipmentD20Response,bountifulEquipmentD20Phase,selectionFromBountifulEquipmentD20Receipt,type BountifulEquipmentD20Receipt,type BountifulEquipmentD20Command,type BountifulEquipmentD20Response} from './bountifulEquipmentD20Receipt'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Revisioned<T>=T&{_sync?:{revision?:number}}
type Parent=BountifulOriginalDieReceipt&{postOriginalEquipmentD20?:BountifulEquipmentD20Receipt}
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,Parent>}
type Source=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]&{hostOriginalRollId?:unknown;hostOriginalDiceCursor?:unknown;hostOriginalRollIssuerMode?:unknown}
interface QueueRow extends Omit<SharedPlayerActionState,'bountifulLuck'>{bountifulLuck?:{parentId:string;occurrence:number;command:BountifulEquipmentD20Command}}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const revision=(value:Revisioned<object>|null)=>value?._sync?.revision??0
const host=()=>{const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-equipment-host:host-required');return session}
const current=(session:ReturnType<typeof host>)=>{const actual=host();if(actual.roomId!==session.roomId||actual.memberId!==session.memberId)throw Error('bountiful-equipment-host:host-changed')}

/** Reconstruct the actual private prepared source. These are read guards, not
 * a client-provided actor, ledger or replacement state authorization. */
async function load(input:{mapId:string;parentId:string},gateway:Gateway){
 const session=host()
 const [combat,characters,maps,geometry,requests]=await Promise.all([
  gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<{characters:Character[]}>>('characters'),
  gateway.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),
  gateway.loadResource<Revisioned<{requests:QueueRow[]}>>('player-action-requests')])
 current(session)
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!combat||!characters||!maps||!requests||!first||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.originalAdapterId!=='equipment'||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||first.identity.mapId!==input.mapId||!bountifulOriginalScopeMatches(combat,first.identity)||!same(combat.dnd5eTurnEconomyByToken??{},JSON.parse(first.identity.reactionEconomySignature))||!requests.requests.some(row=>same(row,first.originalRoomAction)))throw Error('bountiful-equipment-host:real-private-parent-required')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([key,value])=>reads[key]!==value))throw Error('bountiful-equipment-host:stale-source')
 const original=await readBountifulOriginalSource(first,{includeContinuation:true})
 if(original.resolve!==resolvePreparedDnd5eEquipmentAttack)throw Error('bountiful-equipment-host:actual-equipment-facade-required')
 // The exact equipment adapter restored the private Host capture above; no
 // arbitrary resolver or caller-supplied prepared state reaches this cast.
 const source=original.source as Source
 if(!same(source.prepared.characters,characters.characters)||!same(source.prepared.map,maps.maps.find(row=>row.id===input.mapId)))throw Error('bountiful-equipment-host:stale-source')
 const receipts=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const stage=resumeBountifulOriginalParent({...original,parentId:input.parentId,actorId:first.request.actorId,kind:'attack',receipts})
 if(stage.status!=='original-d20-ready'||stage.request.kind!=='attack')throw new BountifulOriginalParentPending(input.parentId,0)
 const rawRollId=source.hostOriginalRollId,cursor=source.hostOriginalDiceCursor
 if(typeof rawRollId!=='string'||typeof cursor!=='number'||!Number.isSafeInteger(cursor)||cursor<1)throw Error('bountiful-equipment-host:real-raw-lineage-required')
 const raw=durableD20RollId({mapId:input.mapId,sourceMode:bountifulOriginalRollIssuerMode(source),transactionId:input.parentId,occurrenceIndex:cursor-1})
 if(rawRollId!==raw&&rawRollId!==raw+':pool:'+stage.request.values.length+'d20')throw Error('bountiful-equipment-host:foreign-raw-lineage')
 const checkpoint=first.postOriginalCursor
 if(checkpoint&&(checkpoint.hostMemberId!==session.memberId||checkpoint.rawRollId!==rawRollId||checkpoint.cursor<cursor||checkpoint.stageSignature!==JSON.stringify([first.postOriginalD20??[],first.postOriginalEquipmentD20??null])))throw Error('bountiful-equipment-host:changed-post-original-cursor')
 const origin=receipts.filter(row=>row.request.actorId===stage.request.actorId&&row.request.kind==='attack'&&same(row.request.originalRolls,stage.request.originalRolls)).at(-1)
 if(!origin)throw Error('bountiful-equipment-host:real-original-occurrence-required')
 const generic=(first.postOriginalD20??[]).filter(row=>row.readyOrdinal===stage.request.ordinal)
 const actor=stage.snapshot.combatants[stage.request.actorId]
 const values=consumeDnd5eBountifulDeferredD20(actor,'attack',stage.request.values,generic,[],new Set(stage.request.finalizedDice),stage.request.rollMode?{rollMode:stage.request.rollMode,attackAbility:stage.request.attackAbility}:undefined)
 const ready={...stage.request,values,finalizedDice:[...new Set([...stage.request.finalizedDice,...generic.map(row=>row.dieIndex)])].sort((a,b)=>a-b)}
 if(!origin.identity.roller.characterId)throw Error('bountiful-equipment-host:actual-character-roller-required')
 const expected=createBountifulEquipmentD20Receipt({identity:{roomId:first.identity.roomId,mapId:input.mapId,combatId:first.identity.combatId,parentId:input.parentId,sourceOccurrence:origin.identity.occurrence,readyOrdinal:ready.ordinal??-1,rawRollId,hostMemberId:session.memberId,roller:{tokenId:origin.identity.roller.tokenId,characterId:origin.identity.roller.characterId,memberId:origin.identity.roller.memberId}},prepared:source.prepared,ready})
 if(first.postOriginalEquipmentD20){
  const stored=first.postOriginalEquipmentD20
  if(!expected||!validateBountifulEquipmentD20Receipt(stored,first.identity)||!same(stored.identity,expected.identity)||!same(stored.ready,expected.ready)||stored.inventorySignature!==expected.inventorySignature||!same(stored.candidates,expected.candidates))throw Error('bountiful-equipment-host:changed-issued-stage')
 }
 return {session,combat,characters,maps,geometry,requests,first,receipts,source,ready,snapshot:stage.snapshot,expected,reads}
}

export async function ensureBountifulEquipmentContinuation(input:{mapId:string;parentId:string},gateway:Gateway){
 const context=await load(input,gateway)
 if(context.first.postOriginalEquipmentD20)return structuredClone(context.first.postOriginalEquipmentD20)
 if(!context.expected)return undefined
 const first={...context.first,postOriginalEquipmentD20:context.expected},parents={...context.combat.bountifulOriginalParents,[bountifulOriginalParentReceiptId(input.parentId,0)]:first}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-equipment-host:invalid-stage')
 current(context.session)
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(context.combat),data:{...context.combat,bountifulOriginalParents:parents}}],{transactionId:'bountiful-equipment-issue:'+input.parentId,readRevisions:{...context.reads,'player-action-requests':revision(context.requests)}})
 current(context.session);return structuredClone(context.expected)
}

/** The request id selects an actual server-stamped append row. There is no
 * principal, face, item, success or mutable state argument at this boundary. */
export async function processBountifulEquipmentResponse(input:{mapId:string;parentId:string;requestId:string},gateway:Gateway){
 const context=await load(input,gateway),row=context.requests.requests.find(row=>row.id===input.requestId),child=context.first.postOriginalEquipmentD20
 if(!child||!row||row.status!=='pending'||row.type!=='dnd5e-bountiful-luck'||row.mapId!==input.mapId||row.combatId!==context.first.identity.combatId||!row.roomMemberId||!row.characterId||!row.bountifulLuck||row.bountifulLuck.parentId!==input.parentId||row.bountifulLuck.occurrence!==child.identity.sourceOccurrence||!validateBountifulLuckCommand(row.bountifulLuck)||!row.bountifulLuck.command.phase.startsWith('equipment-'))throw Error('bountiful-equipment-host:authenticated-response-required')
 const response:BountifulEquipmentD20Response={id:row.id,roomId:context.session.roomId,mapId:row.mapId,combatId:row.combatId,parentId:input.parentId,roomMemberId:row.roomMemberId,sourceMode:row.sourceMode,actorTokenId:row.actorTokenId,characterId:row.characterId,command:row.bountifulLuck.command}
 const receipt=applyBountifulEquipmentD20Response(child,response)
 const first={...context.first,postOriginalEquipmentD20:receipt},parents={...context.combat.bountifulOriginalParents,[bountifulOriginalParentReceiptId(input.parentId,0)]:first}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-equipment-host:invalid-confirmed-stage')
 current(context.session)
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(context.combat),data:{...context.combat,bountifulOriginalParents:parents}},{name:'player-action-requests',expectedRevision:revision(context.requests),data:{...context.requests,requests:context.requests.requests.map(request=>request.id===row.id?{...request,status:'done'}:request)}}],{transactionId:'bountiful-equipment-response:'+row.id,readRevisions:context.reads})
 current(context.session);return {parent:first,receipt}
}

export async function driveBountifulEquipmentContinuation(input:{mapId:string;parentId:string},gateway:Gateway,ui:{showChoice:(receipt:BountifulEquipmentD20Receipt)=>Promise<void>;requestRoll:(receipt:BountifulEquipmentD20Receipt,refresh:()=>Promise<BountifulEquipmentD20Receipt>)=>Promise<void>}){
 for(let step=0;step<16;step++){
  await ensureBountifulEquipmentContinuation(input,gateway)
  let context=await load(input,gateway)
  for(const row of context.requests.requests.filter(row=>row.status==='pending'&&row.type==='dnd5e-bountiful-luck'&&row.bountifulLuck?.parentId===input.parentId&&row.bountifulLuck.command.phase.startsWith('equipment-'))){
   try{await processBountifulEquipmentResponse({...input,requestId:row.id},gateway)}catch(error){if(!(error instanceof Error)||!/^bountiful-equipment-receipt:(?:wrong-parent-or-principal|owner-choice-required|unavailable-original-die-or-item|original-roller-required|host-confirmation-required|invalid-command|changed-replayed-response)$/.test(error.message))throw error}
  }
  context=await load(input,gateway)
  const receipt=context.first.postOriginalEquipmentD20
  if(!receipt)return {receipt:undefined,selection:undefined,retainedDice:context.ready.values,ready:context.ready,previewState:context.snapshot}
  const phase=bountifulEquipmentD20Phase(receipt)
  if(phase==='complete'){
   const selection=selectionFromBountifulEquipmentD20Receipt(receipt),mechanics=selection?resolveBountifulEquipmentD20Selection({prepared:context.source.prepared,ready:context.ready,selection}):undefined
   return {receipt:structuredClone(receipt),selection,retainedDice:mechanics?.values??context.ready.values,ready:context.ready,previewState:context.snapshot,previewCharacter:mechanics?.character}
  }
  const refresh=async()=>{
   const pending=await load(input,gateway)
   for(const row of pending.requests.requests.filter(row=>row.status==='pending'&&row.type==='dnd5e-bountiful-luck'&&row.bountifulLuck?.parentId===input.parentId&&row.bountifulLuck.command.phase.startsWith('equipment-'))){
    try{await processBountifulEquipmentResponse({...input,requestId:row.id},gateway)}catch(error){if(!(error instanceof Error)||!/^bountiful-equipment-receipt:(?:wrong-parent-or-principal|owner-choice-required|unavailable-original-die-or-item|original-roller-required|host-confirmation-required|invalid-command|changed-replayed-response)$/.test(error.message))throw error}
   }
   const next=await load(input,gateway),value=next.first.postOriginalEquipmentD20;if(!value)throw Error('bountiful-equipment-host:issued-stage-lost');return structuredClone(value)
  }
  try{if(phase==='owner-choice')await ui.showChoice(receipt);else await ui.requestRoll(receipt,refresh)}catch(error){const pending=new BountifulOriginalParentPending(input.parentId,receipt.identity.sourceOccurrence);pending.cause=error;throw pending}
  const after=await refresh()
  if(same(after,receipt))throw new BountifulOriginalParentPending(input.parentId,receipt.identity.sourceOccurrence)
 }
 throw Error('bountiful-equipment-host:stage-limit')
}

/** Actual Host UI calls this after original-owner/self/item choices finish,
 * before any hit/damage dice. It persists sequence metadata only, never state,
 * HP, costs, a replacement die, or a caller-supplied parent. */
export async function recordBountifulEquipmentOriginalCursor(input:{mapId:string;parentId:string;cursor:number},gateway:Gateway){
 const context=await load(input,gateway),child=context.first.postOriginalEquipmentD20
 if(context.expected&&(!child||bountifulEquipmentD20Phase(child)!=='complete'))throw Error('bountiful-equipment-host:post-original-not-complete')
 const rawCursor=context.source.hostOriginalDiceCursor
 if(typeof rawCursor!=='number'||!Number.isSafeInteger(input.cursor)||input.cursor<rawCursor||input.cursor>100000)throw Error('bountiful-equipment-host:invalid-post-original-cursor')
 const checkpoint={hostMemberId:context.session.memberId,rawRollId:String(context.source.hostOriginalRollId),cursor:input.cursor,stageSignature:JSON.stringify([context.first.postOriginalD20??[],child??null])}
 if(context.first.postOriginalCursor){if(!same(context.first.postOriginalCursor,checkpoint))throw Error('bountiful-equipment-host:post-original-already-recorded');return structuredClone(checkpoint)}
 const first={...context.first,postOriginalCursor:checkpoint},parents={...context.combat.bountifulOriginalParents,[bountifulOriginalParentReceiptId(input.parentId,0)]:first}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-equipment-host:invalid-post-original-cursor')
 current(context.session)
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(context.combat),data:{...context.combat,bountifulOriginalParents:parents}}],{transactionId:'bountiful-post-original-cursor:'+input.parentId,readRevisions:{...context.reads,'player-action-requests':revision(context.requests)}})
 current(context.session);return structuredClone(checkpoint)
}
