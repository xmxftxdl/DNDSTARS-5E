import{loadTempestuousBeforeReplayForOriginal}from'./tempestuousBeforeOriginalPort'
import{withTempestuousBeforePlainOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import{loadStormCastReplayForActualPending,type StormCastBountifulOriginalPort}from'./stormCastBountifulOriginalPort'
import{withStormCastPreparedOriginalReplay}from'./stormCastPreparedOriginalReplay'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {attachBountifulReadySource} from './bountifulReadySource'
import {bountifulConfirmedReplayFacts} from './bountifulConfirmedReplay'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {getRoomSession} from '../../lib/roomSession'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {dnd5eAllyNaturalOneOptions,dnd5eBountifulOriginalReadyOwners,dnd5eHasBountifulOriginalReadySource} from './headlessCombatEngine'
import {bountifulOriginalParentReceiptId,persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {appendBountifulSpellOriginalSave} from './bountifulLuckSpellOriginalStream'

type Source=BountifulSpellOriginalInput
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type UI=Parameters<typeof driveBountifulOriginalParent>[2]
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}


/** This preliminary probe must cross the same verified native cast prefix as
 * the eventual parent driver. A genuine natural one still enters its own
 * canonical reaction stream; it is never relabelled as an unmodified-ready die. */
async function probeBountifulSpellEntry(source:Source,actorId:string,kind:'attack'|'saving-throw',gateway:Gateway){
 const run=()=>{const probe=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,actorId,kind);try{return probe.run(source.prepared.state)}finally{probe.cancel()}}
 const before=await loadTempestuousBeforeReplayForOriginal(source,resolvePreparedDnd5eSpellCast,gateway as Gateway&StormCastBountifulOriginalPort),pending=before?withTempestuousBeforePlainOriginalReplay(source,before,run):run();if(pending.status!=='pending-storm-cast')return pending
 const proof=await loadStormCastReplayForActualPending(pending,gateway as Gateway&StormCastBountifulOriginalPort)
 return withStormCastPreparedOriginalReplay(source,proof,run)
}

/** The real Maps save loop calls this after this target's raw dice arrive, and
 * before native Lucky/bonus/damage prompts. It never rolls another target. */
export async function beginBountifulSpellOriginalSave(input:{action:SharedPlayerActionState;source:Source&{hostOriginalDiceCursor:number};actorId:string;rollCursor:number;authorityUnchanged:()=>boolean},gateway:Gateway,ui:UI){
 input={...input,source:await attachBountifulReadySource(input,gateway)}
 const session=getRoomSession()
 if(!session||session.role!=='dm')throw Error('bountiful-spell-entry:host-required')
 if(!input.authorityUnchanged())throw Error('bountiful-spell-entry:stale-authority')
 const combat=await gateway.loadResource<Combat>('combat')
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
 if(first){
  if(first.originalAdapterId!=='spell'||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId)throw Error('bountiful-spell-entry:wrong-private-parent')
  const previous=await readBountifulOriginalSource(first,{includeContinuation:true})
  if(JSON.stringify(previous.source)!==JSON.stringify(input.source))await appendBountifulSpellOriginalSave(input,gateway)
  else if('hostOriginalSpellSavingThrows'in input.source){
   const row=input.source.targetSavingThrows?.find(row=>row.targetId===input.actorId)
   if(!row)throw Error('bountiful-spell-entry:actual-target-raw-required')
   const metadata=bountifulOriginalRawForActor(input.source,input.actorId,'saving-throw',row.d20Second===undefined?[row.d20]:[row.d20,row.d20Second])
   if(input.rollCursor!==metadata.hostOriginalDiceCursor)throw Error('bountiful-spell-entry:resume-cursor-required')
  }else if(first.originalCheckpoint?.actorId!==input.actorId||first.originalCheckpoint.kind!=='saving-throw'||input.rollCursor!==(first.continuation?.rollCursor??input.source.hostOriginalDiceCursor))throw Error('bountiful-spell-entry:resume-cursor-required')
 }else{
  if(!Number.isSafeInteger(input.rollCursor)||input.rollCursor<0||input.rollCursor>100000||(!('hostOriginalSpellSavingThrows'in input.source)&&input.source.hostOriginalDiceCursor!==input.rollCursor))throw Error('bountiful-spell-entry:original-cursor-required')
  const row=input.source.targetSavingThrows?.find(save=>save.targetId===input.actorId)
  const primary=input.source.prepared.savingThrow&&input.source.prepared.targetToken.id===input.actorId
  const raw=row&&input.source.prepared.targetSavingThrows?.some(save=>save.targetToken.id===input.actorId)
    ?row.d20Second===undefined?[row.d20]:[row.d20,row.d20Second]
    :primary&&input.source.savingThrowD20!==undefined?input.source.savingThrowD20Second===undefined?[input.source.savingThrowD20]:[input.source.savingThrowD20,input.source.savingThrowD20Second]:undefined
  if(!raw||raw.some(face=>!Number.isInteger(face)||face<1||face>20))throw Error('bountiful-spell-entry:actual-target-raw-required')
  if(!raw.includes(1))return undefined
  const state=structuredClone(input.source.prepared.state)
  for(const actor of Object.values(state.combatants)){
   const economy=combat?.dnd5eTurnEconomyByToken?.[actor.id]
   const active=state.initiativeOrder[state.initiativeIndex]===actor.id
   const slot=state.initiativeSlotIds?.[state.initiativeIndex]??actor.id
   if(economy&&(!active||economy.turnKey===state.combatId+':'+state.round+':'+slot))actor.turn.reactionAvailable=economy.reaction.current>0
  }
  if(!dnd5eHasBountifulOriginalReadySource(state))return undefined
   const actualSource=cloneDnd5eHostTransactionInput(input.source)
   // Preserve the complete native prepared reference graph while adopting only
   // the current, already-read reaction economy used by this existing entry.
   for(const actor of Object.values(actualSource.prepared.state.combatants))actor.turn.reactionAvailable=state.combatants[actor.id].turn.reactionAvailable
   const pending=await probeBountifulSpellEntry(actualSource,input.actorId,'saving-throw',gateway)
  const snapshot=pending.status==='pending-ally-natural-one'||pending.status==='original-d20-ready'?pending.snapshot:undefined
  const affected=input.source.prepared.targetSavingThrows?.map(row=>row.targetToken.id)??[input.actorId]
  if(!snapshot||!affected.some(actorId=>dnd5eBountifulOriginalReadyOwners(snapshot,{actorId,kind:'saving-throw'}).length))return undefined
  if(pending.status!=='pending-ally-natural-one')return undefined
  if(pending.request.actorId!==input.actorId||pending.request.kind!=='saving-throw'||JSON.stringify(pending.request.originalRolls)!==JSON.stringify(raw))throw Error('bountiful-spell-entry:earlier-original-must-settle')
  if(pending.occurrence!==0)throw Error('bountiful-spell-entry:unexpected-original-occurrence')
  await persistBountifulOriginalParent({parentId:input.action.id,source:input.source,resolve:resolvePreparedDnd5eSpellCast,actorId:input.actorId,kind:'saving-throw'},gateway)
 }
 const stage=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id,...('hostOriginalSpellSavingThrows'in input.source?{originalScope:{actorId:input.actorId,kind:'saving-throw' as const}}:{})},gateway,ui)
 return {originalReady:structuredClone(stage.request),rawDice:stage.request.originalRolls,retainedDice:stage.request.values,previewState:stage.snapshot,receipts:stage.receipts,
  hostOriginalD20Replay:bountifulConfirmedReplayFacts({parentId:input.action.id,source:input.source,receipts:stage.receipts})}
}

/** Real native caster raw attack boundary, before Lucky or attack modifiers. */
export async function beginBountifulSpellOriginalAttack(input:{action:SharedPlayerActionState;source:Source&{hostOriginalDiceCursor:number};actorId:string;rollCursor:number;authorityUnchanged:()=>boolean},gateway:Gateway,ui:UI){
 input={...input,source:await attachBountifulReadySource(input,gateway)}
 const session=getRoomSession()
 if(!session||session.role!=='dm')throw Error('bountiful-spell-entry:host-required')
 if(!input.authorityUnchanged())throw Error('bountiful-spell-entry:stale-authority')
 const combat=await gateway.loadResource<Combat>('combat')
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
 if(first){
  if(first.originalAdapterId!=='spell'||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId)throw Error('bountiful-spell-entry:wrong-private-parent')
  const previous=await readBountifulOriginalSource(first,{includeContinuation:true})
  if(JSON.stringify(previous.source)!==JSON.stringify(input.source))throw Error('bountiful-spell-entry:changed-attack-original')
  else if(first.originalCheckpoint?.actorId!==input.actorId||first.originalCheckpoint.kind!=='attack'||input.rollCursor!==(first.continuation?.rollCursor??input.source.hostOriginalDiceCursor))throw Error('bountiful-spell-entry:resume-cursor-required')
 }else{
  if(!Number.isSafeInteger(input.rollCursor)||input.rollCursor<0||input.rollCursor>100000||(!('hostOriginalSpellSavingThrows'in input.source)&&input.source.hostOriginalDiceCursor!==input.rollCursor))throw Error('bountiful-spell-entry:original-cursor-required')
  if(input.actorId!==input.source.prepared.actorToken.id)throw Error('bountiful-spell-entry:actual-caster-required')
  const raw=input.source.d20===undefined?undefined:input.source.d20Second===undefined?[input.source.d20]:[input.source.d20,input.source.d20Second]
  if(!raw||raw.some(face=>!Number.isInteger(face)||face<1||face>20))throw Error('bountiful-spell-entry:actual-target-raw-required')
  if(!raw.includes(1))return undefined
  const state=structuredClone(input.source.prepared.state)
  for(const actor of Object.values(state.combatants)){
   const economy=combat?.dnd5eTurnEconomyByToken?.[actor.id]
   const active=state.initiativeOrder[state.initiativeIndex]===actor.id
   const slot=state.initiativeSlotIds?.[state.initiativeIndex]??actor.id
   if(economy&&(!active||economy.turnKey===state.combatId+':'+state.round+':'+slot))actor.turn.reactionAvailable=economy.reaction.current>0
  }
  if(!raw.some((value,dieIndex)=>value===1&&dnd5eAllyNaturalOneOptions(state,{actorId:input.actorId,kind:'attack',originalRolls:raw,dieIndex}).length>0))return undefined
   const actualSource=cloneDnd5eHostTransactionInput(input.source)
   // Preserve the complete native prepared reference graph while adopting only
   // the current, already-read reaction economy used by this existing entry.
   for(const actor of Object.values(actualSource.prepared.state.combatants))actor.turn.reactionAvailable=state.combatants[actor.id].turn.reactionAvailable
   const pending=await probeBountifulSpellEntry(actualSource,input.actorId,'attack',gateway)
  if(pending.status!=='pending-ally-natural-one')return undefined
  if(pending.request.actorId!==input.actorId||pending.request.kind!=='attack'||JSON.stringify(pending.request.originalRolls)!==JSON.stringify(raw))throw Error('bountiful-spell-entry:earlier-original-must-settle')
  if(pending.occurrence!==0)throw Error('bountiful-spell-entry:unexpected-original-occurrence')
  await persistBountifulOriginalParent({parentId:input.action.id,source:input.source,resolve:resolvePreparedDnd5eSpellCast,actorId:input.actorId,kind:'attack'},gateway)
 }
 const stage=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id},gateway,ui)
 return {originalReady:structuredClone(stage.request),rawDice:stage.request.originalRolls,retainedDice:stage.request.values,previewState:stage.snapshot,receipts:stage.receipts,
  hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts:stage.receipts})}
}
