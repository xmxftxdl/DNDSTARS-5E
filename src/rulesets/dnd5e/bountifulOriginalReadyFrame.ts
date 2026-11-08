import{loadTempestuousBeforeReplayForOriginal}from'./tempestuousBeforeOriginalPort'
import{withTempestuousBeforePlainOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import{withStormCastPreparedOriginalReplay}from'./stormCastPreparedOriginalReplay'
import{loadStormCastReplayForActualPending,type StormCastBountifulOriginalPort}from'./stormCastBountifulOriginalPort'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import {bountifulUnconsumedParentRows} from '../../../shared/bountiful-parent-retention.mjs'
import {captureBountifulOriginalSceneScope,assertBountifulOriginalSceneScope,type BountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {bountifulOriginalRollIssuerMode} from './bountifulOriginalRawIssuer'
import {assertBountifulStoredReadySourcePrefix} from './bountifulSpellCounterattackSource'
import {readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {bountifulConfirmedReplayFacts} from './bountifulConfirmedReplay'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import {encodeSecondChanceParentWire,type SecondChanceParentWire,decodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFactsAsync} from '../../pages/maps/secondChancePreparedHostFacts'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {dnd5eBountifulOriginalReadyOwners,dnd5eHasBountifulOriginalReadySource} from './headlessCombatEngine'
import {bountifulPreparedOriginalRoller} from './bountifulPreparedController'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {resumeBountifulOriginalParent} from './bountifulLuckPersistedReplay'
type Source=BountifulSpellOriginalInput
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>&StormCastBountifulOriginalPort
type Snapshot<T>=T&{_sync?:{revision?:number}}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
// Character facts are JSON data; object insertion order is not a game fact.
// Keep every field/value and array position, matching the canonical ready-parent validator.
const canonicalCharacterFacts=(value:unknown):unknown=>Array.isArray(value)?value.map(canonicalCharacterFacts):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalCharacterFacts((value as Record<string,unknown>)[key])])):value
const sameCharacterFacts=(a:unknown,b:unknown)=>JSON.stringify(canonicalCharacterFacts(a))===JSON.stringify(canonicalCharacterFacts(b))
const host=()=>{const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-ready:host-required');return session}
const revision=(value:Snapshot<object>|null)=>{const current=value?._sync?.revision??0;if(!Number.isSafeInteger(current)||current<0)throw Error('bountiful-ready:invalid-version');return current}
const issued=new WeakMap<object,{sceneScope?:BountifulOriginalSceneScope;roomId:string;hostMemberId:string;parent:SharedPlayerActionState;versions:Record<string,number>;source:Source;request:import('./allyNaturalOneCheckpoint').OriginalD20Ready;snapshot:import('./headlessCombatEngine').Dnd5eHeadlessCombatState;reactionEconomySignature:string;qualifiedSources:readonly {actorId:string;ownerId:string;featureId:string}[];owners:readonly {ownerId:string;featureId:string}[];controller:ReturnType<typeof bountifulPreparedReadyController>}>()
/** Only the concrete native spell facade can issue a real raw-ready frame.
 * Persistence is private metadata only; actual generic costs replay with the native parent. */
type CaptureInput={action:SharedPlayerActionState;source:Source;actorId:string;kind?:'attack'|'saving-throw'}
export async function captureBountifulSpellOriginalReadyFrame(input:CaptureInput,gateway:Gateway){return captureActualReadyFrame(input,gateway)}
async function captureActualReadyFrame(input:CaptureInput,gateway:Gateway,saved?:BountifulReadyParentData){
 const session=host(),[combat,characters,maps,geometry,requests]=await Promise.all([gateway.loadResource<Snapshot<SharedCombatState>>('combat'),gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry'),gateway.loadResource<Snapshot<{requests:SharedPlayerActionState[]}>>('player-action-requests')])
 const source=cloneDnd5eHostTransactionInput(input.source),prepared=source.prepared
 if(!combat||!characters||!maps||!requests||(combat.active===true?(combat.mapId!==input.action.mapId||combat.combatId!==input.action.combatId||combat.round!==input.action.round||combat.initiativeIndex!==input.action.initiativeIndex):(combat.active!==false||input.action.combatId!==undefined))||!requests.requests.some(row=>row.status==='pending'&&same(row,input.action))||!same(prepared.action,input.action)||!sameCharacterFacts(prepared.characters,characters.characters)||!same(prepared.map,maps.maps.find(map=>map.id===input.action.mapId)))throw Error('bountiful-ready:actual-native-parent-required')
 const sceneScope=await captureBountifulOriginalSceneScope(combat,gateway)
 const kind=input.kind??'saving-throw'
 const row=source.targetSavingThrows?.find(row=>row.targetId===input.actorId),raw=kind==='attack'?(source.d20===undefined?undefined:source.d20Second===undefined?[source.d20]:[source.d20,source.d20Second]):row?(row.d20Second===undefined?[row.d20]:[row.d20,row.d20Second]):source.savingThrowD20===undefined?undefined:source.savingThrowD20Second===undefined?[source.savingThrowD20]:[source.savingThrowD20,source.savingThrowD20Second]
 if(!raw)throw Error('bountiful-ready:actual-raw-required')
 bountifulOriginalRawForActor(source,input.actorId,kind,raw)
 for(const actor of Object.values(prepared.state.combatants)){
  const stored=combat.dnd5eTurnEconomyByToken?.[actor.id],active=prepared.state.initiativeOrder[prepared.state.initiativeIndex]===actor.id,slot=prepared.state.initiativeSlotIds?.[prepared.state.initiativeIndex]??actor.id
  if(stored&&(!active||stored.turnKey===prepared.state.combatId+':'+prepared.state.round+':'+slot))actor.turn.reactionAvailable=stored.reaction.current>0
 }
 if(!dnd5eHasBountifulOriginalReadySource(prepared.state))return undefined
 const tempestuousBeforePreparedReplay=await loadTempestuousBeforeReplayForOriginal(source,resolvePreparedDnd5eSpellCast,gateway)
 const initial=()=>{const probe=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,input.actorId,kind);try{return probe.run(prepared.state)}finally{probe.cancel()}}
 let stage=tempestuousBeforePreparedReplay?withTempestuousBeforePlainOriginalReplay(source,tempestuousBeforePreparedReplay,initial):initial()
  let stormCastPreparedReplay:object|undefined
  if(stage.status==='pending-storm-cast'){
   stormCastPreparedReplay=await loadStormCastReplayForActualPending(stage,gateway)
   stage=withStormCastPreparedOriginalReplay(source,stormCastPreparedReplay,()=>{const reader=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,input.actorId,kind);try{return reader.run(prepared.state)}finally{reader.cancel()}})
  }
 const affected=kind==='saving-throw'?(prepared.targetSavingThrows?.map(row=>row.targetToken.id)??[input.actorId]):[input.actorId]
 const initialSnapshot=stage.status==='pending-ally-natural-one'?stage.snapshot:undefined
 const initialQualifiedSources=initialSnapshot?affected.flatMap(actorId=>dnd5eBountifulOriginalReadyOwners(initialSnapshot,{actorId,kind}).map(owner=>({actorId,...owner}))):[]
 let verifiedOriginalParent=false
 if(stage.status==='pending-ally-natural-one'){
  const receipts=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
  if(receipts.length){
   let resumed:ReturnType<typeof resumeBountifulOriginalParent<Source,ReturnType<typeof resolvePreparedDnd5eSpellCast>>>
   if(saved){
    // The capability is private to readBountifulSpellOriginalReadyFrame; its
    // argument was loaded from protected combat metadata, never a UI payload.
    const storedCombat:SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}=combat
    const current=storedCombat.bountifulReadyParents?.[saved.id]
    if(!current||!same(current,saved)||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||receipts.some(row=>row.identity.roomId!==session.roomId||row.identity.hostMemberId!==session.memberId||!same(row.originalRoomAction,input.action))||!same(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(source)),saved.source))throw Error('bountiful-ready:stored-native-capability-required')
    const native=await readBountifulOriginalSource(receipts[0],{includeContinuation:true})
    assertBountifulStoredReadySourcePrefix(source,native.source)
    const confirmed=bountifulConfirmedReplayFacts({parentId:input.action.id,source,receipts})
    const replay={...confirmed,...(source.hostOriginalD20Replay?.readyFrames?{readyFrames:source.hostOriginalD20Replay.readyFrames}:{})}
    const reader=createDnd5eOriginalD20Session({...source,hostOriginalD20Replay:replay},resolvePreparedDnd5eSpellCast,input.actorId,kind)
    try{const result=stormCastPreparedReplay?withStormCastPreparedOriginalReplay({...source,hostOriginalD20Replay:replay},stormCastPreparedReplay,()=>{const actual=createDnd5eOriginalD20Session({...source,hostOriginalD20Replay:replay},resolvePreparedDnd5eSpellCast,input.actorId,kind);try{return actual.run(prepared.state)}finally{actual.cancel()}}):tempestuousBeforePreparedReplay?withTempestuousBeforePlainOriginalReplay({...source,hostOriginalD20Replay:replay},tempestuousBeforePreparedReplay,()=>{const actual=createDnd5eOriginalD20Session({...source,hostOriginalD20Replay:replay},resolvePreparedDnd5eSpellCast,input.actorId,kind);try{return actual.run(prepared.state)}finally{actual.cancel()}}):reader.run(prepared.state);if(result.status!=='original-d20-ready')throw Error('bountiful-ready:stored-raw-boundary-not-reached');resumed=result}finally{reader.cancel()}
   }else resumed=resumeBountifulOriginalParent({source,resolve:resolvePreparedDnd5eSpellCast,parentId:input.action.id,actorId:input.actorId,kind,receipts,...(stormCastPreparedReplay?{stormCastPreparedReplay}:tempestuousBeforePreparedReplay?{tempestuousBeforePreparedReplay}:{})})
   if(resumed.status!=='original-d20-ready')throw Error('bountiful-ready:prior-original-must-settle')
   stage=resumed;verifiedOriginalParent=true
  }
 }
 if(stage.status==='pending-ally-natural-one'){
  const affected=kind==='saving-throw'?(prepared.targetSavingThrows?.map(row=>row.targetToken.id)??[input.actorId]):[input.actorId]
  if(!affected.some(actorId=>dnd5eBountifulOriginalReadyOwners(stage.snapshot,{actorId,kind}).length))return undefined
 }
 if(stage.status!=='original-d20-ready'||stage.request.actorId!==input.actorId||stage.request.kind!==kind||!same(stage.request.originalRolls,raw)||!same(stage.request.values,raw)||stage.request.finalizedDice.length)throw Error('bountiful-ready:actual-unmodified-ready-required')
 const owners=dnd5eBountifulOriginalReadyOwners(stage.snapshot,stage.request)
 const currentQualifiedSources=affected.flatMap(actorId=>dnd5eBountifulOriginalReadyOwners(stage.snapshot,{actorId,kind}).map(owner=>({actorId,...owner})))
 const qualifiedSources=currentQualifiedSources.length?currentQualifiedSources:verifiedOriginalParent?initialQualifiedSources:[]
 if(!qualifiedSources.length)return undefined
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-ready:host-changed')
 const controller=bountifulPreparedReadyController(prepared,input.actorId,session.memberId),frame=Object.freeze({id:JSON.stringify(['bountiful-original-ready',input.action.id,stage.request.ordinal,input.actorId,kind])})
 issued.set(frame,{sceneScope,roomId:session.roomId,hostMemberId:session.memberId,parent:structuredClone(input.action),versions:{combat:revision(combat),characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),'player-action-requests':revision(requests),...(sceneScope?{'campaign-time':sceneScope.campaignTimeRevision}:{})},source,snapshot:structuredClone(stage.snapshot),reactionEconomySignature:JSON.stringify(combat.dnd5eTurnEconomyByToken??{}),request:structuredClone(stage.request),owners:structuredClone(owners),qualifiedSources:structuredClone(qualifiedSources),controller})
 return frame
}
export async function inspectBountifulSpellOriginalReadyFrame(frame:object,gateway:Gateway){
 const value=issued.get(frame),session=host()
 if(!value||value.roomId!==session.roomId||value.hostMemberId!==session.memberId)throw Error('bountiful-ready:private-issued-frame-required')
 for(const [name,expected]of Object.entries(value.versions))if(revision(await gateway.loadResource<Snapshot<object>>(name))!==expected)throw Error('bountiful-ready:stale-frame')
 const combat=await gateway.loadResource<Snapshot<SharedCombatState>>('combat')
 await assertBountifulOriginalSceneScope(combat,{mapId:value.parent.mapId,combatId:value.parent.combatId??value.source.prepared.state.combatId,round:value.parent.round,initiativeIndex:value.parent.initiativeIndex,sceneScope:value.sceneScope,revisions:value.versions},gateway)
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-ready:host-changed')
 return structuredClone({sceneScope:value.sceneScope,parent:value.parent,source:value.source,snapshot:value.snapshot,request:value.request,owners:value.owners,qualifiedSources:value.qualifiedSources,controller:value.controller,versions:value.versions})
}

export interface BountifulReadyParentData{
 sceneScope?:BountifulOriginalSceneScope
 rawIssuer:{mode:'dm'|'player';rollId:string;cursor:number}
 schemaVersion:1;id:string;roomId:string;hostMemberId:string;parentId:string;mapId:string;combatId:string;round:number;initiativeIndex:number;reactionEconomySignature:string
 consumed?:{transactionId:string}
 continuation?:{source:SecondChanceParentWire;rollCursor:number}
 postReadyD20?:readonly import('./bountifulLuckDeferredD20').BountifulReadyD20Choice[]
 source:SecondChanceParentWire;originalRoomAction:SharedPlayerActionState;request:import('./allyNaturalOneCheckpoint').OriginalD20Ready
 qualifiedSources:readonly {actorId:string;ownerId:string;featureId:string}[];owners:readonly {ownerId:string;featureId:string}[];controller:ReturnType<typeof bountifulPreparedReadyController>;versions:Record<string,number>
}
const validRecords=(value:unknown):value is Record<string,BountifulReadyParentData>=>validateBountifulReadyParents(value)
export async function persistBountifulSpellOriginalReadyFrame(frame:object,gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>&Partial<Pick<SharedRoomGatewayPort,'publishEvent'>>){
 const value=issued.get(frame),session=host();if(!value)throw Error('bountiful-ready:private-issued-frame-required')
 const combat=await gateway.loadResource<Snapshot<SharedCombatState>&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}>('combat')
 if(!combat||!bountifulOriginalScopeMatches(combat,{mapId:value.parent.mapId,combatId:value.parent.combatId??value.source.prepared.state.combatId,round:value.parent.round,initiativeIndex:value.parent.initiativeIndex,sceneScope:value.sceneScope})||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==value.reactionEconomySignature||combat.bountifulReadyParents&&!validRecords(combat.bountifulReadyParents))throw Error('bountiful-ready:changed-original-combat')
 if(value.request.kind!=='attack'&&value.request.kind!=='saving-throw')throw Error('bountiful-ready:concrete-spell-roll-required')
 const metadata=bountifulOriginalRawForActor(value.source,value.request.actorId,value.request.kind,value.request.originalRolls)
 const saved:BountifulReadyParentData={sceneScope:value.sceneScope,rawIssuer:{mode:bountifulOriginalRollIssuerMode(metadata),rollId:metadata.hostOriginalRollId,cursor:metadata.hostOriginalDiceCursor},schemaVersion:1,id:'id'in frame&&typeof frame.id==='string'?frame.id:'',roomId:session.roomId,hostMemberId:session.memberId,parentId:value.parent.id,mapId:value.parent.mapId,combatId:value.parent.combatId??value.source.prepared.state.combatId,round:value.parent.round,initiativeIndex:value.parent.initiativeIndex,reactionEconomySignature:value.reactionEconomySignature,source:encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(value.source)),originalRoomAction:structuredClone(value.parent),request:structuredClone(value.request),owners:structuredClone(value.owners),qualifiedSources:structuredClone(value.qualifiedSources),controller:structuredClone(value.controller),versions:{...value.versions}}
 const previous=combat.bountifulReadyParents?.[saved.id]
 if(previous){
  if(!same(previous,saved))throw Error('bountiful-ready:conflicting-issued-frame')
  await readBountifulSpellOriginalReadyFrame({mapId:saved.mapId,id:saved.id},gateway)
  return saved.id
 }
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 if(revision(combat)!==value.versions.combat)throw Error('bountiful-ready:changed-original-combat')
 const records={...bountifulUnconsumedParentRows(combat.bountifulReadyParents),[saved.id]:saved}
 if(!validRecords(records))throw Error('bountiful-ready:invalid-issued-data')
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-ready:host-changed')
 const {combat:_combat,...readRevisions}=value.versions;void _combat
 await gateway.publishEvent?.('bountiful-ready-mint-dm-to-host',{frame:saved})
 const result=await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:value.versions.combat,data:{...combat,bountifulReadyParents:records}}],{transactionId:'bountiful-ready-issue:'+saved.id,readRevisions})
 if(result.status!=='committed')throw Error('bountiful-ready:issue-not-committed')
 return saved.id
}
/** Reconstruct only this concrete original-ready issuer from its private saved
 * source, then verify its exact request and controllers. No state setter. */
export async function readBountifulSpellOriginalReadyFrame(input:{mapId:string;id:string},gateway:Gateway){
 const session=host(),combat=await gateway.loadResource<Snapshot<SharedCombatState>&{bountifulReadyParents?:unknown}>('combat')
 if(!combat||!validRecords(combat.bountifulReadyParents))throw Error('bountiful-ready:private-stored-frame-required')
 const saved=combat.bountifulReadyParents[input.id]
 if(!saved||saved.consumed||saved.roomId!==session.roomId||saved.hostMemberId!==session.memberId||saved.mapId!==input.mapId||!bountifulOriginalScopeMatches(combat,saved)||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==saved.reactionEconomySignature)throw Error('bountiful-ready:wrong-stored-parent')
 await assertBountifulOriginalSceneScope(combat,{...saved,revisions:saved.versions},gateway)
 for(const [name,expected]of Object.entries(saved.versions)){
  if(name==='combat'||name==='player-action-requests')continue
  if(revision(await gateway.loadResource<Snapshot<object>>(name))!==expected)throw Error('bountiful-ready:stale-stored-materials')
 }
 const restored=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(saved.source))
 const source=restored as Source
 const frame=await captureActualReadyFrame({action:saved.originalRoomAction,source,actorId:saved.request.actorId,kind:saved.request.kind==='attack'?'attack':'saving-throw'},gateway,saved)
 if(!frame)throw Error('bountiful-ready:current-source-unavailable')
 const facts=issued.get(frame)
 if(!facts||!same(facts.request,saved.request)||!same(facts.owners,saved.owners)||!same(facts.qualifiedSources,saved.qualifiedSources)||!same(facts.controller,saved.controller)||!same(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(facts.source)),saved.source))throw Error('bountiful-ready:changed-native-recovery')
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-ready:host-changed')
 return frame
}

function bountifulPreparedReadyController(...args:Parameters<typeof bountifulPreparedOriginalRoller>){const {tokenId,...controller}=bountifulPreparedOriginalRoller(...args);void tokenId;return controller}
