import {resolvePreparedDnd5eClassFeature} from './classFeatureAction'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {bountifulOriginalParentReceiptId,persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {bountifulPreparedReplayFacts} from './bountifulLuckReceipt'
import {readBountifulAfterDiceSource,assertBountifulAfterDiceSource,type BountifulContinuationReceipt} from './bountifulLuckAfterDice'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'

type NativeSource=Parameters<typeof resolvePreparedDnd5eClassFeature>[0]
type Source=NativeSource&{hostOriginalRollActorId:string;hostOriginalRollKind:'saving-throw';hostOriginalRollId:string;hostOriginalDiceCursor:number}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>

export async function readBountifulClassPresenceOriginal(input:{mapId:string;parentId:string},gateway:Gateway){
 const combat=await gateway.loadResource<SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulContinuationReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!first)return undefined
 if(first.consumed||first.originalAdapterId!=='class-feature'||first.identity.mapId!==input.mapId)throw Error('bountiful-class-entry:live-class-parent-required')
 const restored=await readBountifulOriginalSource(first)
 if(restored.resolve!==resolvePreparedDnd5eClassFeature)throw Error('bountiful-class-entry:actual-class-facade-required')
 // The private decoder restores only this concrete, authenticated facade input.
 const source=restored.source as Source
 if(!source.prepared.intimidatingPresence||source.hostOriginalRollKind!=='saving-throw'||source.hostOriginalRollActorId!==source.prepared.intimidatingPresence.target.id||typeof source.hostOriginalRollId!=='string'||!Number.isSafeInteger(source.hostOriginalDiceCursor))throw Error('bountiful-class-entry:actual-presence-raw-required')
 return source
}

export async function readBountifulClassPresenceAfterDice(input:{mapId:string;parentId:string},gateway:Gateway){
 const original=await readBountifulClassPresenceOriginal(input,gateway)
 if(!original)return undefined
 const combat=await gateway.loadResource<SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulContinuationReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!first||!first.continuation)return undefined
 const restored=await readBountifulAfterDiceSource(first)
 const data=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
 if(!data(restored))throw Error('bountiful-class-entry:actual-continuation-required')
 assertBountifulAfterDiceSource('class-feature',original,restored)
 // Concrete private Host facts and the late-source guard above pin this DTO.
 return {source:restored as NativeSource,rollCursor:first.continuation.rollCursor??original.hostOriginalDiceCursor}
}

/** The Intimidating Presence native raw boundary. Only the concrete class
 * facade can produce the pending request; retained faces are preview values,
 * while the original source remains unchanged for final native replay. */
export async function continueBountifulClassPresenceOriginal(input:{action:SharedPlayerActionState;source:Source;authorityUnchanged:()=>boolean},gateway:Gateway,ui:Parameters<typeof driveBountifulOriginalParent>[2]){
 if(!input.authorityUnchanged())throw Error('bountiful-class-entry:stale-authority')
 const presence=input.source.prepared.intimidatingPresence
 if(!presence||presence.extending||input.source.hostOriginalRollActorId!==presence.target.id||input.source.hostOriginalRollKind!=='saving-throw')throw Error('bountiful-class-entry:actual-presence-target-required')
 const raw=input.source.savingThrowD20Second===undefined?[input.source.savingThrowD20]:[input.source.savingThrowD20,input.source.savingThrowD20Second]
 if(raw.some(face=>typeof face!=='number'||!Number.isInteger(face)||face<1||face>20))throw Error('bountiful-class-entry:actual-raw-required')
 const combat=await gateway.loadResource<SharedCombatState>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
 if(first){
  const restored=await readBountifulOriginalSource(first)
  if(first.consumed||first.originalAdapterId!=='class-feature'||JSON.stringify(restored.source)!==JSON.stringify(input.source))throw Error('bountiful-class-entry:changed-original')
 }else{
  if(!raw.includes(1))return undefined
  const source=cloneDnd5eHostTransactionInput(input.source)
  for(const actor of Object.values(source.prepared.state.combatants)){
   const stored=combat?.dnd5eTurnEconomyByToken?.[actor.id],state=source.prepared.state,active=state.initiativeOrder[state.initiativeIndex]===actor.id,slot=state.initiativeSlotIds?.[state.initiativeIndex]??actor.id
   if(stored&&(!active||stored.turnKey===state.combatId+':'+state.round+':'+slot))actor.turn.reactionAvailable=stored.reaction.current>0
  }
  const probe=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eClassFeature,presence.target.id,'saving-throw')
  let pending:ReturnType<typeof probe.run>
  try{pending=probe.run(source.prepared.state)}finally{probe.cancel()}
  if(pending.status!=='pending-ally-natural-one')return undefined
  if(pending.occurrence!==0||pending.request.actorId!==presence.target.id||pending.request.kind!=='saving-throw'||JSON.stringify(pending.request.originalRolls)!==JSON.stringify(raw))throw Error('bountiful-class-entry:earlier-original-must-settle')
  await persistBountifulOriginalParent({parentId:input.action.id,source:input.source,resolve:resolvePreparedDnd5eClassFeature,actorId:presence.target.id,kind:'saving-throw'},gateway)
 }
 const stage=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id},gateway,ui)
 if(!input.authorityUnchanged())throw Error('bountiful-class-entry:stale-authority')
 return {...stage,retainedDice:stage.request.values,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts:stage.receipts})}
}
