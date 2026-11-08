import {readActiveSpecterScParent,requireActiveSpecterScFrame,readSpecterScFrame,type SpecterScParentBinding} from './specterScFrameAuthority'
import type {SecondChancePostNativeFrame} from './secondChancePostNativeBoundary'
import {assertDnd5eKilledSummonContinuationSourceV1,readDnd5eKilledSummonContinuationV1,encodeDnd5eKilledSummonContinuationV1,restoreDnd5eKilledSummonContinuationFromHostV1,type Dnd5eKilledSummonContinuationV1} from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {Dnd5eActionResult} from "../../application/combat/dnd5eCombatRules"
import type {Dnd5eMapResultPlan} from '../../rulesets/dnd5e/mapBridge'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {listRegisteredDnd5eActivityPackages} from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {migrateMapsState} from '../../store/maps'
import {normalizeCharacter} from '../../store/characters'
import {buildPlayerActionAck,buildPlayerActionProcessedState} from '../../lib/playerActionAck'
import type {SharedCombatState,SharedPlayerActionAckState,SharedPlayerActionProcessedState} from '../../lib/sharedCombatTypes'
import type {SharedMapGeometryState} from '../../lib/mapGeometry'
import {insertInitiativeEntriesPreservingActive,projectHeadlessInitiativeOrder} from '../mapsPageHelpers'
import {projectDnd5eHeadlessTurnEconomy} from '../../rulesets/dnd5e/turnEconomy'
import {readDnd5eActivityMapMaterializationV1,restoreDnd5eActivityMapMaterializationFromHostV1,type Dnd5eActivityMapHandoffResultV1,type Dnd5eActivityMapMaterializationV1} from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import {planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'

type NativeResult=Extract<Dnd5eActionResult,{ok:true}>
export interface PostNativeActivitySnapshot {
  parentTransactionId:string
  result:NativeResult
  map:BattleMap
  characters:readonly Character[]
  characterIdByCombatantId:Readonly<Record<string,string>>
  priorApplication?:Pick<Dnd5eMapResultPlan,'changedTokenIds'|'changedCharacterIds'|'tokenPatches'|'characterPatches'|'geometry'|'spentReactions'>
  preserveOffMapParticipants?:boolean
}
declare const stageBrand:unique symbol
export interface PostNativeActivityStage {readonly [stageBrand]:true}
const stages=new WeakMap<object,PostNativeActivitySnapshot>()
/** Mechanical equality ignores object-key order; array order and every field remain significant. */
export function sameActivityParentData(left:unknown,right:unknown):boolean {
  const canonical=(value:unknown):unknown=>{
    if(value===undefined)return{$undefined:true}
    if(value instanceof Map)return{$map:[...value].map(([key,row])=>[canonical(key),canonical(row)]).sort((a,b)=>JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])))}
    if(value instanceof Set)return{$set:[...value].map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}
    if(value instanceof Date)return{$date:value.toISOString()}
    if(Array.isArray(value))return value.map(canonical)
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>[key,canonical(row)]))
    return value
  }
  return JSON.stringify(canonical(left))===JSON.stringify(canonical(right))
}
function issue(snapshot:PostNativeActivitySnapshot):PostNativeActivityStage {
  const stage=Object.freeze({}) as PostNativeActivityStage
  // The data codec intentionally refuses embedded Host capabilities.
  stages.set(stage,decodeSecondChanceParentWire(encodeSecondChanceParentWire(snapshot)) as PostNativeActivitySnapshot)
  return stage
}
/** Called by the real settlement boundary, not a player command decoder. */
export function capturePostNativeActivityStage(snapshot:PostNativeActivitySnapshot):PostNativeActivityStage {
  if(!snapshot.result.ok||!snapshot.map.id||!snapshot.result.state.combatId)throw Error('activity-parent:invalid-native-stage')
  return issue(snapshot)
}
export function readPostNativeActivityStage(stage:PostNativeActivityStage):PostNativeActivitySnapshot {
  const snapshot=stages.get(stage)
  if(!snapshot)throw Error('activity-parent:unissued-stage')
  return decodeSecondChanceParentWire(encodeSecondChanceParentWire(snapshot)) as PostNativeActivitySnapshot
}
export function samePostNativeActivityInput(snapshot:PostNativeActivitySnapshot,input:{result:NativeResult;map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Readonly<Record<string,string>>;priorApplication?:PostNativeActivitySnapshot['priorApplication'];preserveOffMapParticipants?:boolean;hostParentTransactionId?:string}):boolean {
  return sameActivityParentData({...snapshot,result:{...snapshot.result,events:[]}}, {parentTransactionId:input.hostParentTransactionId??input.result.transaction?.id,result:input.result,map:input.map,characters:input.characters,characterIdByCombatantId:input.characterIdByCombatantId,priorApplication:input.priorApplication,preserveOffMapParticipants:input.preserveOffMapParticipants})
}
export function postNativeActivityResumeInput(stage:PostNativeActivityStage) {
  const snapshot=readPostNativeActivityStage(stage)
  return {...snapshot,result:{...snapshot.result,events:[]},hostParentTransactionId:snapshot.parentTransactionId,resumeActivityStage:stage}
}

export interface PostNativeActivitySettlement {result:NativeResult;application:Dnd5eMapResultPlan}
const nativeSettlements=new WeakMap<object,{originalStage:PostNativeActivityStage;stage:PostNativeActivitySnapshot;settlement:PostNativeActivitySettlement}>()
/** The actual settle function seals its own final output. This is data
 * provenance for the private journal, not an independently usable rule grant. */
export function capturePostNativeActivitySettlement(stage:PostNativeActivityStage|undefined,value:PostNativeActivitySettlement):PostNativeActivitySettlement {
 if(stage)nativeSettlements.set(value,{originalStage:stage,stage:readPostNativeActivityStage(stage),settlement:decodeSecondChanceParentWire(encodeSecondChanceParentWire(value)) as PostNativeActivitySettlement})
 return value
}
function issuedSettlement(value:PostNativeActivitySettlement){const saved=nativeSettlements.get(value);if(!saved||!sameActivityParentData(saved.settlement,value))throw Error('activity-parent:unissued-native-settlement');return saved}
/** A genuine Base completion for this exact opaque prefix, never persisted
 * JSON or another caller's mechanically similar stage. */
export function readPostNativeActivitySettlementForStage(stage:PostNativeActivityStage,value:PostNativeActivitySettlement){
 const original=readPostNativeActivityStage(stage),saved=issuedSettlement(value)
 if(saved.originalStage!==stage||!sameActivityParentData(saved.stage,original))throw Error('activity-parent:unrelated-native-settlement-stage')
 return{originalStage:stage,prefix:original,settlement:decodeSecondChanceParentWire(encodeSecondChanceParentWire(saved.settlement)) as PostNativeActivitySettlement}
}

export const ACTIVITY_DEATH_PARENT_RESOURCE='activity-death-parents'
type Revisioned={_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export interface ActivityDeathParentIdentity {parentTransactionId:string;mapId:string;combatId:string;actorId:string;targetId:string;deathEventIndex:number}
export function activityDeathParentKey(identity:ActivityDeathParentIdentity):string{return dnd5eExecutionEventKey(JSON.stringify([identity.parentTransactionId,identity.mapId,identity.combatId,identity.actorId,identity.targetId,identity.deathEventIndex]))}
export interface ActivityDeathParentRecord extends ActivityDeathParentIdentity {
  schemaVersion:1
  id:string
  roomId:string
  hostMemberId:string
  choice?:import('./activityDeathChoice').ActivityDeathChoiceState
  phase:'waiting'|'consumed'
  completed?:SecondChanceParentWire
  dependencies:Record<string,number>
  definitions:ReturnType<typeof listRegisteredDnd5eActivityPackages>
  originalRoomAction?:SharedPlayerActionState
  scParent?:SpecterScParentBinding
  stage:SecondChanceParentWire
  continuation?:SecondChanceParentWire
  mapProgress?:SecondChanceParentWire
  initiativeRolls?:Record<string,import('./activityDeathInitiative').ActivityDeathInitiativeRoll>
}
interface Journal extends Revisioned {schemaVersion:1;parents:Record<string,ActivityDeathParentRecord>}
function revision(value:Revisioned|null,name:string):number {
  if(value===null)return 0
  const revision=value._sync?.revision
  if(!Number.isSafeInteger(revision)||revision!<0)throw Error('activity-parent:revision-required:'+name)
  return revision!
}
function currentDefinitions():ReturnType<typeof listRegisteredDnd5eActivityPackages>{return JSON.parse(JSON.stringify(listRegisteredDnd5eActivityPackages()))}
const dependencyNames=['maps','characters','combat','map-geometry','campaign-time'] as const
declare const baselineBrand:unique symbol
export interface ActivityDeathParentBaseline {readonly [baselineBrand]:true}
interface BaselineData {roomId:string;hostMemberId:string;dependencies:Record<string,number>;command?:SharedPlayerActionState;scParent?:SpecterScParentBinding}
const baselines=new WeakMap<object,BaselineData>()
function hostGuard(){
  const session=getRoomSession()
  const guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('activity-parent:host-room-required')}
  guard();return{session:session!,guard}
}
function assertKilledTarget(snapshot:PostNativeActivitySnapshot,identity:ActivityDeathParentIdentity,expectedNativeTransactionId?:string) {
  const event=snapshot.result.events[identity.deathEventIndex]
  const victim=snapshot.result.state.combatants[identity.targetId]
  if(!identity.parentTransactionId||snapshot.parentTransactionId!==identity.parentTransactionId||snapshot.map.id!==identity.mapId||snapshot.result.state.combatId!==identity.combatId||event?.type!=='creature-died'||event.killerId!==identity.actorId||event.targetId!==identity.targetId||!victim?.deathSaves.dead||victim.currentHp!==0||!snapshot.result.state.combatants[identity.actorId]||snapshot.result.transaction&&snapshot.result.transaction.id!==(expectedNativeTransactionId??identity.parentTransactionId))throw Error('activity-parent:death-parent-mismatch')
}
/** Issued BEFORE the native resolver runs. Fetching a newer revision after a
 * hit has resolved must never authorize publishing that older result. */
export async function captureActivityDeathParentBaseline(input:{command:SharedPlayerActionState;map:BattleMap;characters:readonly Character[]},gateway:Pick<Gateway,'loadResource'>):Promise<ActivityDeathParentBaseline> {
  const {session,guard}=hostGuard()
  const values=await Promise.all(dependencyNames.map(name=>gateway.loadResource<Revisioned>(name)));guard()
  const maps=values[0] as (Revisioned&{maps:BattleMap[]})|null,characters=values[1] as (Revisioned&{characters:Character[]})|null,combat=values[2] as (Revisioned&{combatId?:string;active?:boolean})|null
  const storedMap=maps?.maps.find(row=>row.id===input.map.id)
  const jsonData=(value:unknown)=>JSON.parse(JSON.stringify(value)) as unknown
  if(!storedMap||!characters||input.command.mapId!==input.map.id||((input.command.combatId??'')!==(combat?.combatId??'')&&!(combat?.active===false&&input.command.sourceMode==='player'&&input.command.status==='pending'&&input.command.combatId===undefined))||!sameActivityParentData(migrateMapsState({maps:[storedMap]}).maps[0],migrateMapsState({maps:[input.map]}).maps[0])||!sameActivityParentData(jsonData(characters.characters.map(row=>normalizeCharacter(row))),jsonData(input.characters.map(row=>normalizeCharacter(row)))))throw Error('activity-parent:prepared-baseline-mismatch')
  let command=input.command
  if(command.sourceMode==='player'){
    const queue=await gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests');guard()
    const actual=queue?.requests.find(row=>row.id===command.id)
    const stripMember=(row:SharedPlayerActionState)=>{const copy={...row};delete copy.roomMemberId;return jsonData(copy)}
    const owner=characters.characters.find(row=>row.id===command.characterId)
    if(!actual||!actual.roomMemberId||actual.roomMemberId!==owner?.roomMemberId||!sameActivityParentData(stripMember(actual),stripMember(command)))throw Error('activity-parent:authenticated-original-command-required')
    command=actual
  }else if(command.sourceMode!=='dm')throw Error('activity-parent:original-command-required')
  const baseline=Object.freeze({}) as ActivityDeathParentBaseline
  baselines.set(baseline,{roomId:session.roomId,hostMemberId:session.memberId,command:structuredClone(command),dependencies:Object.fromEntries(dependencyNames.map((name,index)=>[name,revision(values[index],name)]))})
  return baseline
}
/** No HP, action cost or summon is published by this checkpoint. Only the DM
 * can write/read this private resource. Baselines are exact CAS dependencies. */
export async function persistActivityDeathParent(stage:PostNativeActivityStage,identity:ActivityDeathParentIdentity,gateway:Gateway,baseline:ActivityDeathParentBaseline):Promise<ActivityDeathParentRecord> {
  const {session,guard}=hostGuard(),snapshot=readPostNativeActivityStage(stage)
  const original=baselines.get(baseline)
  if(!original||original.roomId!==session.roomId||original.hostMemberId!==session.memberId||(!original.scParent&&(!original.command||original.command.id!==identity.parentTransactionId||original.command.mapId!==identity.mapId||original.command.combatId!==identity.combatId)))throw Error('activity-parent:unissued-prepare-baseline')
  if(original.scParent){const scoped=await readActiveSpecterScParent({...identity,roomId:session.roomId,hostMemberId:session.memberId,scParent:original.scParent});if(!sameActivityParentData(readPostNativeActivityStage(scoped.stage),snapshot)||!sameActivityParentData(scoped.originalRoomAction,original.command))throw Error('specter-sc:unrelated-original-stage');assertKilledTarget(snapshot,identity,scoped.result.transaction?.id)}else assertKilledTarget(snapshot,identity)
  const names=dependencyNames
  const [journal,...values]=await Promise.all([gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE),...names.map(name=>gateway.loadResource<Revisioned>(name))]);guard()
  const current=journal as Journal|null,dependencies=Object.fromEntries(names.map((name,index)=>[name,revision(values[index],name)]))
  if(!sameActivityParentData(original.dependencies,dependencies))throw Error('activity-parent:stale-prepare-baseline')
  const record:ActivityDeathParentRecord={schemaVersion:1,id:activityDeathParentKey(identity),...identity,roomId:session.roomId,hostMemberId:session.memberId,phase:'waiting',dependencies,definitions:currentDefinitions(),...(original.command?{originalRoomAction:original.command}:{}),...(original.scParent?{scParent:original.scParent}:{}),stage:encodeSecondChanceParentWire(snapshot)}
  const existing=current?.parents?.[activityDeathParentKey(identity)]
  if(existing){const original={...existing};delete original.choice;delete original.continuation;delete original.mapProgress;delete original.initiativeRolls;if(!sameActivityParentData(original,record))throw Error('activity-parent:changed-original-parent');return existing}
  const next:Journal={schemaVersion:1,parents:{...current?.parents,[activityDeathParentKey(identity)]:record}}
  const writes=[{name:ACTIVITY_DEATH_PARENT_RESOURCE,expectedRevision:revision(current,ACTIVITY_DEATH_PARENT_RESOURCE),data:next}]
  try{await gateway.saveResourcesAtomically(writes,{transactionId:`activity-death-wait:${identity.parentTransactionId}`,readRevisions:dependencies,undoLabel:'保留击杀后的召唤选择'});guard()}
  catch(error){guard();const saved=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard();if(!sameActivityParentData(saved?.parents?.[activityDeathParentKey(identity)],record))throw error}
  return record
}
/** Recovery takes only an identity. The stage always comes from the protected
 * persisted DM record, never from a player supplied copy of result/events. */
export async function restoreActivityDeathParent(identity:ActivityDeathParentIdentity,gateway:Pick<Gateway,'loadResource'>):Promise<PostNativeActivityStage> {
  const {session,guard}=hostGuard(),journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
  const record=journal?.parents?.[activityDeathParentKey(identity)]
  if(!record||record.phase!=='waiting'||record.roomId!==session.roomId||record.hostMemberId!==session.memberId||!sameActivityParentData(Object.fromEntries(Object.keys(identity).map(key=>[key,record[key as keyof ActivityDeathParentIdentity]])),identity))throw Error('activity-parent:persisted-identity-mismatch')
  if(!sameActivityParentData(record.definitions,currentDefinitions()))throw Error('activity-parent:changed-source-definitions')
  let expectedScNativeTransactionId:string|undefined
  if(record.scParent){const scoped=await readActiveSpecterScParent({...record});if(!sameActivityParentData(readPostNativeActivityStage(scoped.stage),decodeSecondChanceParentWire(record.stage))||!sameActivityParentData(scoped.revisions,record.dependencies)||!sameActivityParentData(scoped.originalRoomAction,record.originalRoomAction))throw Error('specter-sc:changed-original-stage');expectedScNativeTransactionId=scoped.result.transaction?.id}
  else if(record.originalRoomAction?.sourceMode==='player'){
    const queue=await gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests');guard()
    if(!sameActivityParentData(queue?.requests.find(row=>row.id===identity.parentTransactionId),record.originalRoomAction))throw Error('activity-parent:changed-original-command')
  }
  const entries=Object.entries(record.dependencies),values=await Promise.all(entries.map(([name])=>gateway.loadResource<Revisioned>(name)));guard()
  if(entries.some(([name,expected],index)=>revision(values[index],name)!==expected))throw Error('activity-parent:stale-native-baseline')
  const snapshot=decodeSecondChanceParentWire(record.stage) as PostNativeActivitySnapshot
  assertKilledTarget(snapshot,identity,expectedScNativeTransactionId)
  return issue(snapshot)
}
/** Restore a prepare baseline only from this authenticated private parent.
 * It can authorize later windows of that same native action, never a newer
 * command or refreshed world revision. */
export async function restoreActivityDeathParentBaseline(identity:ActivityDeathParentIdentity,gateway:Pick<Gateway,'loadResource'>):Promise<ActivityDeathParentBaseline>{
 const {session,guard}=hostGuard();await restoreActivityDeathParent(identity,gateway);guard()
 const journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const row=journal?.parents[activityDeathParentKey(identity)]
 if(!row)throw Error('activity-parent:persisted-identity-mismatch')
 const baseline=Object.freeze({}) as ActivityDeathParentBaseline
 baselines.set(baseline,{roomId:session.roomId,hostMemberId:session.memberId,dependencies:structuredClone(row.dependencies),command:structuredClone(row.originalRoomAction),scParent:row.scParent&&structuredClone(row.scParent)})
 return baseline
}

/** Freeze the real already-validated handoff and its earlier Activity progress.
 * This native-death adapter deliberately refuses an unrelated/nested death;
 * those need their own before-choice provenance, never a guessed event index. */
export async function persistActivityDeathParentContinuation(identity:ActivityDeathParentIdentity,frame:Dnd5eKilledSummonContinuationV1,gateway:Gateway,mapResults:readonly Dnd5eActivityMapHandoffResultV1[]=[]):Promise<void>{
 const {guard}=hostGuard(),stage=await restoreActivityDeathParent(identity,gateway);guard()
 const snapshot=readPostNativeActivityStage(stage),data=readDnd5eKilledSummonContinuationV1(frame)
 assertDnd5eKilledSummonContinuationSourceV1(frame)
 const pending=data.phase==='owner-choice'?{...data.pendingChoice,receiptId:`${data.pendingChoice.eventId}:${data.pendingChoice.packageId}:${data.pendingChoice.activity.id}`}:data.pending
 const originalEventBatch=data.initial.eventBatchId===identity.parentTransactionId||data.initial.eventBatchId===`production:${dnd5eExecutionEventKey(identity.parentTransactionId)}`
 if(!sameActivityParentData(data.initial.state,snapshot.result.state)||!sameActivityParentData(data.initial.events,snapshot.result.events)||!originalEventBatch||pending.actorId!==identity.actorId||!pending.triggerContext.eligibleTargetIds.includes(identity.targetId))throw Error('activity-parent:unrelated-handoff-continuation')
 const journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const key=activityDeathParentKey(identity),record=journal?.parents[key]
 const sameChoice=record?.choice==null||record.choice.eventId===pending.eventId&&record.choice.packageId===pending.packageId&&record.choice.activityId===pending.activity.id
 if(!record||!sameChoice||data.phase!=='owner-choice'&&record.choice?.decision!=='use')throw Error('activity-parent:accepted-exact-owner-choice-required')
 const continuation=encodeDnd5eKilledSummonContinuationV1(frame)
 const mapProgress=mapResults.length?encodeSecondChanceParentWire(validateActivityDeathMapProgress(snapshot,frame,{witnesses:mapResults.map(readDnd5eActivityMapMaterializationV1)})):undefined
 if(record.continuation){
  if(sameActivityParentData(record.continuation,continuation)&&sameActivityParentData(record.mapProgress,mapProgress))return
  const before=readDnd5eKilledSummonContinuationV1(restoreDnd5eKilledSummonContinuationFromHostV1(record.continuation))
  const common=(value:typeof data)=>Object.fromEntries(Object.entries(value).filter(([name])=>!['phase','pending','pendingChoice'].includes(name)))
  if(before.phase!=='owner-choice'||data.phase==='owner-choice'||record.choice?.decision!=='use'||`${before.pendingChoice.eventId}:${before.pendingChoice.packageId}:${before.pendingChoice.activity.id}`!==pending.receiptId||!sameActivityParentData(common(before),common(data))||!sameActivityParentData(record.mapProgress,mapProgress))throw Error('activity-parent:changed-pending-handoff')
 }
 const next={...journal,parents:{...journal!.parents,[key]:{...record,continuation,...(mapProgress?{mapProgress}:{})}}}
 try{await gateway.saveResourcesAtomically([{name:ACTIVITY_DEATH_PARENT_RESOURCE,expectedRevision:revision(journal,ACTIVITY_DEATH_PARENT_RESOURCE),data:next}],{transactionId:`activity-death-frame:${record.id}`,readRevisions:record.dependencies,undoLabel:'保留召唤位置与已完成的结算'});guard()}
 catch(error){guard();const saved=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard();if(!sameActivityParentData(saved?.parents[key]?.continuation,continuation)||!sameActivityParentData(saved?.parents[key]?.mapProgress,mapProgress))throw error}
}
export async function restoreActivityDeathParentContinuation(identity:ActivityDeathParentIdentity,gateway:Pick<Gateway,'loadResource'>):Promise<Dnd5eKilledSummonContinuationV1|undefined>{
 const {guard}=hostGuard();await restoreActivityDeathParent(identity,gateway);guard()
 const journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const wire=journal?.parents[activityDeathParentKey(identity)]?.continuation
 if(!wire)return undefined
 const frame=restoreDnd5eKilledSummonContinuationFromHostV1(wire)
 assertDnd5eKilledSummonContinuationSourceV1(frame)
 return frame
}

interface ActivityDeathMapProgress {map:BattleMap;witnesses:readonly Dnd5eActivityMapMaterializationV1[]}
function validateActivityDeathMapProgress(snapshot:PostNativeActivitySnapshot,frame:Dnd5eKilledSummonContinuationV1,progress:{witnesses:readonly Dnd5eActivityMapMaterializationV1[];map?:BattleMap}):ActivityDeathMapProgress{
 const cursor=readDnd5eKilledSummonContinuationV1(frame)
 const pendingReceipt=cursor.phase==='owner-choice'?`${cursor.pendingChoice.eventId}:${cursor.pendingChoice.packageId}:${cursor.pendingChoice.activity.id}`:cursor.pending.receiptId
 if(!Array.isArray(progress.witnesses)||progress.witnesses.length>32)throw Error('activity-parent:invalid-map-progress')
 let map=planDnd5eMapResultApplication({map:snapshot.map,characters:snapshot.characters,state:snapshot.result.state,events:[...snapshot.result.events],characterIdByCombatantId:snapshot.characterIdByCombatantId}).map
 for(const witness of progress.witnesses){
  if(!cursor.consumed.includes(witness.actionId)||witness.actionId===pendingReceipt||!cursor.diagnostics.some(row=>row.status==='resolved'&&row.eventId+':'+row.packageId+':'+row.activityId===witness.actionId&&row.packageId===witness.packageId&&row.activityId===witness.activityId)||!sameActivityParentData(witness.beforeMap,map)||!witness.result.ok||witness.result.map.id!==snapshot.map.id)throw Error('activity-parent:unbound-earlier-map-progress')
  map=witness.result.map
 }
 if(progress.map&&!sameActivityParentData(progress.map,map))throw Error('activity-parent:changed-earlier-map-progress')
 return{map,witnesses:progress.witnesses}
}
export async function restoreActivityDeathParentMapProgress(identity:ActivityDeathParentIdentity,gateway:Pick<Gateway,'loadResource'>):Promise<{map:BattleMap;mapResults:readonly Dnd5eActivityMapHandoffResultV1[]}|undefined>{
 const {guard}=hostGuard(),stage=await restoreActivityDeathParent(identity,gateway),frame=await restoreActivityDeathParentContinuation(identity,gateway);guard()
 const journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const wire=journal?.parents[activityDeathParentKey(identity)]?.mapProgress
 if(!wire)return undefined
 if(!frame)throw Error('activity-parent:map-progress-without-continuation')
 const saved=validateActivityDeathMapProgress(readPostNativeActivityStage(stage),frame,decodeSecondChanceParentWire(wire) as ActivityDeathMapProgress)
 return{map:saved.map,mapResults:saved.witnesses.map(restoreDnd5eActivityMapMaterializationFromHostV1)}
}

interface CompletedActivityDeathParent {
 settlement:PostNativeActivitySettlement
 publishedAt:number
 ack?:SharedPlayerActionAckState
}
export interface PublishedActivityDeathParent {
 status:'published'
 transactionId:string
 settlement:PostNativeActivitySettlement
 alreadyPublished:boolean
}
/** The original native action, all accepted Activity work, its private cursor,
 * and the original player's ACK share one CAS. A newer world is never used to
 * refresh an old prepared result. This adapter currently accepts only the
 * single killed-target summon handoff; other map work must acquire its own
 * materialization continuation rather than being silently dropped. */
export async function publishActivityDeathParent(input:{
 identity:ActivityDeathParentIdentity
 settlement?:PostNativeActivitySettlement
 mapResults?:readonly Dnd5eActivityMapHandoffResultV1[]
},gateway:Gateway):Promise<PublishedActivityDeathParent>{
 const {session,guard}=hostGuard(),identity=input.identity,key=activityDeathParentKey(identity)
 const journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const record=journal?.parents[key]
 if(!record||record.roomId!==session.roomId||record.hostMemberId!==session.memberId||!sameActivityParentData(Object.fromEntries(Object.keys(identity).map(name=>[name,record[name as keyof ActivityDeathParentIdentity]])),identity))throw Error('activity-parent:persisted-identity-mismatch')
 if(record.scParent||!record.originalRoomAction)throw Error('specter-sc:original-sc-publisher-required')
 const completed=(saved:ActivityDeathParentRecord,alreadyPublished:boolean)=>verifyActivityDeathCompletion(saved,identity,gateway,guard,alreadyPublished)
 if(record.phase==='consumed')return completed(record,true)
 const stage=await restoreActivityDeathParent(identity,gateway);guard()
 const {settlement,result,application,witnesses,values,group}=await prepareDeathParentMaterialization(input,record,journal!,stage,gateway,guard)
 const maps=values[0] as Revisioned&{maps:BattleMap[]},characters=values[1] as Revisioned&{characters:Character[]},combat=values[2] as SharedCombatState,geometry=values[3] as (Revisioned&SharedMapGeometryState)|null
 const order=projectHeadlessInitiativeOrder({current:combat.initiativeOrder,state:result.state})
 const initiative=insertInitiativeEntriesPreservingActive(order,result.state.initiativeIndex,witnesses.flatMap(row=>[...row.result.initiativeEntries]))
 const economy={...combat.dnd5eTurnEconomyByToken}
 for(const[id,actor]of Object.entries(result.state.combatants)){
  const prior=economy[id];if(!prior)continue
  const projected=projectDnd5eHeadlessTurnEconomy(prior,actor.turn,actor.speed)
  // The stage already includes the native attack. Use its final absolute turn
  // usage, not a second attack delta measured from that post-hit snapshot.
  economy[id]=actor.classState.attacksMadeTurnKey===prior.turnKey?{...projected,attacksUsed:Math.max(0,Math.floor(actor.classState.attacksMadeThisTurn??0))}:projected
 }
 const now=Date.now(),player=record.originalRoomAction.sourceMode==='player'
 const [queue,ackBefore,processedBefore]=player?await Promise.all([
  gateway.loadResource<Revisioned&{requests:SharedPlayerActionState[]}>('player-action-requests'),
  gateway.loadResource<Revisioned&SharedPlayerActionAckState>('player-action-ack'),
  gateway.loadResource<Revisioned&SharedPlayerActionProcessedState>('player-action-processed'),
 ]):[null,null,null];guard()
 if(player&&!sameActivityParentData(queue?.requests.find(row=>row.id===record.parentTransactionId),record.originalRoomAction))throw Error('activity-parent:changed-original-command')
 const ack=player?buildPlayerActionAck({action:record.originalRoomAction,status:'accepted',mapId:identity.mapId,combatId:identity.combatId,round:result.state.round,initiativeIndex:initiative.index,appliedAt:now}):undefined
 const done:CompletedActivityDeathParent={settlement,publishedAt:now,...(ack?{ack}:{})};let wire=encodeSecondChanceParentWire(done)
 const nextJournal={...journal,parents:{...journal!.parents,...Object.fromEntries(group.map(row=>[row.id,{...row,phase:'consumed' as const,completed:wire}]))}}
 const writes:import('../../ports/sharedRoomGateway').SharedResourceTransactionWrite[]=[
  {name:'maps',expectedRevision:record.dependencies.maps,data:{...maps,maps:maps.maps.map(row=>row.id===identity.mapId?application.map:row)}},
  {name:'characters',expectedRevision:record.dependencies.characters,data:{...characters,characters:application.characters}},
  {name:'combat',expectedRevision:record.dependencies.combat,data:{...combat,round:result.state.round,initiativeOrder:initiative.order,initiativeIndex:initiative.index,dnd5eTurnEconomyByToken:economy,updatedAt:now}},
  {name:ACTIVITY_DEATH_PARENT_RESOURCE,expectedRevision:revision(journal,ACTIVITY_DEATH_PARENT_RESOURCE),data:nextJournal},
 ]
 if(application.geometry){
  if(application.geometry.mapId!==identity.mapId)throw Error('activity-parent:unrelated-final-geometry')
  writes.push({name:'map-geometry',expectedRevision:record.dependencies['map-geometry'],data:{schemaVersion:1,maps:[...(geometry?.maps.filter(row=>row.mapId!==identity.mapId)??[]),application.geometry],updatedAt:now}})
 }
 if(player)writes.push(
  {name:'player-action-requests',expectedRevision:revision(queue,'player-action-requests'),data:{...queue,requests:queue!.requests.filter(row=>row.id!==record.parentTransactionId),updatedAt:now}},
  {name:'player-action-ack',expectedRevision:revision(ackBefore,'player-action-ack'),data:ack},
  {name:'player-action-processed',expectedRevision:revision(processedBefore,'player-action-processed'),data:buildPlayerActionProcessedState({action:record.originalRoomAction,current:processedBefore,updatedAt:now})},
 )
 // The real server adds this revision vector to the ACK. Persist the same
 // expected vector in the private witness instead of weakening ACK equality.
 if(ack){
  ack.authorityRevisions=Object.fromEntries(writes.map(write=>[write.name,write.expectedRevision!+1]))
  wire=encodeSecondChanceParentWire(done)
  for(const row of group)nextJournal.parents[row.id]={...nextJournal.parents[row.id],completed:wire}
 }
 try{
  const writtenNames=new Set(writes.map(write=>write.name))
  await gateway.saveResourcesAtomically(writes,{transactionId:`activity-death-publish:${record.id}`,readRevisions:Object.fromEntries(Object.entries(record.dependencies).filter(([name])=>!writtenNames.has(name))),undoLabel:'提交原攻击与咒缚幽灵'});guard()
 }catch(error){
  guard();const saved=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
  const row=saved?.parents[key]
  if(row?.phase!=='consumed'||!sameActivityParentData(row.completed,wire))throw error
  return completed(row,false)
 }
 const saved=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const row=saved?.parents[key]
 if(!row||!sameActivityParentData(row.completed,wire))throw Error('activity-parent:missing-published-witness')
 return completed(row,false)
}

async function verifyActivityDeathCompletion(saved:ActivityDeathParentRecord,identity:ActivityDeathParentIdentity,gateway:Pick<Gateway,'loadResource'>,guard:()=>void,alreadyPublished:boolean):Promise<PublishedActivityDeathParent>{
  if(saved.phase!=='consumed'||!saved.completed)throw Error('activity-parent:completion-witness-required')
  const data=decodeSecondChanceParentWire(saved.completed) as CompletedActivityDeathParent
  if(!data.settlement?.result.ok||data.settlement.result.state.combatId!==identity.combatId||data.settlement.application.map.id!==identity.mapId||!Number.isSafeInteger(data.publishedAt))throw Error('activity-parent:invalid-completion-witness')
  if(saved.scParent||!saved.originalRoomAction)throw Error('specter-sc:original-sc-publisher-required')
  if(saved.originalRoomAction.sourceMode==='player'){
   const [ack,processed]=await Promise.all([gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<SharedPlayerActionProcessedState>('player-action-processed')]);guard()
   // A later ACK may replace the latest slot; the persisted processed set is
   // still required. Never republish an old ACK over a newer action.
   const ackData=ack?Object.fromEntries(Object.entries(ack).filter(([name])=>name!=='_sync')):undefined
   if(!data.ack||data.ack.actionId!==saved.parentTransactionId||data.ack.status!=='accepted'||data.ack.recipientMemberId!==saved.originalRoomAction.roomMemberId||!processed?.actionIds.includes(saved.parentTransactionId)||ack?.actionId===saved.parentTransactionId&&!sameActivityParentData(ackData,JSON.parse(JSON.stringify(data.ack))))throw Error('activity-parent:accepted-command-witness-required')
  }
  return{status:'published',transactionId:identity.parentTransactionId,settlement:data.settlement,alreadyPublished}
}
export async function readPublishedActivityDeathParent(identity:ActivityDeathParentIdentity,gateway:Pick<Gateway,'loadResource'>):Promise<PublishedActivityDeathParent>{
 const {session,guard}=hostGuard(),journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const record=journal?.parents[activityDeathParentKey(identity)]
 if(!record||record.roomId!==session.roomId||record.hostMemberId!==session.memberId||!sameActivityParentData(Object.fromEntries(Object.keys(identity).map(name=>[name,record[name as keyof ActivityDeathParentIdentity]])),identity))throw Error('activity-parent:persisted-identity-mismatch')
 return verifyActivityDeathCompletion(record,identity,gateway,guard,true)
}

async function prepareDeathParentMaterialization(input:{identity:ActivityDeathParentIdentity;settlement?:PostNativeActivitySettlement;mapResults?:readonly Dnd5eActivityMapHandoffResultV1[]},record:ActivityDeathParentRecord,journal:Journal,stage:PostNativeActivityStage,gateway:Gateway,guard:()=>void){
 const identity=input.identity
 const cursor=record.continuation?restoreDnd5eKilledSummonContinuationFromHostV1(record.continuation):undefined
 if(cursor)assertDnd5eKilledSummonContinuationSourceV1(cursor)
 if(!input.settlement)throw Error('activity-parent:final-settlement-required')
 const issued=issuedSettlement(input.settlement)
 if(!sameActivityParentData(issued.stage,readPostNativeActivityStage(stage)))throw Error('activity-parent:unrelated-final-settlement')
 const settlement=issued.settlement,{result,application}=settlement
 const expectedNativeTransactionId=record.scParent?(await readActiveSpecterScParent(record)).result.transaction?.id:identity.parentTransactionId
 if(result.state.combatId!==identity.combatId||application.map.id!==identity.mapId||result.transaction&&result.transaction.id!==expectedNativeTransactionId||!record.choice?.decision)throw Error('activity-parent:unresolved-final-parent')
 if(record.choice?.transport!=='authenticated-room-member'||record.choice.authenticatedSubmitterMemberId!==record.choice.controllerMemberId||record.choice.acceptedByHost!==record.hostMemberId||!Number.isSafeInteger(record.choice.acceptedAt))throw Error('activity-parent:authenticated-original-owner-choice-required')
 const witnesses=(input.mapResults??[]).map(readDnd5eActivityMapMaterializationV1)
 const previous=record.mapProgress&&cursor?validateActivityDeathMapProgress(readPostNativeActivityStage(stage),cursor,decodeSecondChanceParentWire(record.mapProgress) as ActivityDeathMapProgress):undefined
 if(record.mapProgress&&!previous)throw Error('activity-parent:map-progress-without-continuation')
 const prefix=previous?.witnesses??[]
 if(!sameActivityParentData(witnesses.slice(0,prefix.length),prefix))throw Error('activity-parent:lost-or-changed-earlier-map-progress')
 if(record.choice.decision==='use'){
  if(witnesses.length!==prefix.length+1)throw Error('activity-parent:exact-summon-materialization-required')
  const witness=witnesses[witnesses.length-1],expectedReceipt=`${record.choice.eventId}:${record.choice.packageId}:${record.choice.activityId}`
  if(witness.actionId!==expectedReceipt||witness.packageId!==record.choice.packageId||witness.activityId!==record.choice.activityId||witness.actorId!==identity.actorId||witness.eventTargetTokenId!==identity.targetId||witness.beforeMap.id!==identity.mapId||witness.result.map.id!==identity.mapId)throw Error('activity-parent:unrelated-map-materialization')
  const rolls=Object.values(record.initiativeRolls??{}).filter(roll=>roll.receiptId===expectedReceipt)
  const roll=rolls[0],calculation=witness.result.initiativeEntries[0]?.initiativeCalculation
  if(rolls.length!==1||!roll.raw||!roll.confirmed||roll.actorId!==identity.actorId||roll.targetId!==identity.targetId||roll.controllerMemberId!==record.choice.controllerMemberId||roll.raw.sourceMemberId!==roll.controllerMemberId||roll.raw.recordedByHost!==record.hostMemberId||roll.confirmed.confirmedBy!==record.hostMemberId||calculation?.d20!==roll.confirmed.values[0]||!sameActivityParentData(calculation.rolls,roll.confirmed.values)||calculation.mode!=='normal')throw Error('activity-parent:confirmed-original-specter-initiative-required')
  if(roll.raw.authenticatedSubmitterMemberId!==roll.controllerMemberId||roll.raw.transport!=='authenticated-room-member')throw Error('activity-parent:authenticated-player-original-raw-required')
 }else if(witnesses.length!==prefix.length)throw Error('activity-parent:declined-parent-has-unbound-map-work')
  // Specter's map work must not smuggle unrelated geometry or world changes.
  for(let index=0;index<witnesses.length;index++){
   const entry=witnesses[index],mapped=entry.result
   if(index>0&&!sameActivityParentData(entry.beforeMap,witnesses[index-1].result.map))throw Error('activity-parent:discontinuous-map-progress')
   if(mapped.createdAreaIds.length||mapped.removedTokenIds.length||mapped.boundCharacters?.length||mapped.geometryDoorPatches.length||mapped.geometryLightUpserts.length||mapped.structureGeometry||mapped.otherMapGeometryUpdates?.length||mapped.otherMapLightUpserts?.length||mapped.otherMapAreaDismissals?.length||mapped.geometryEntityPatches?.length||mapped.movementPaths.length||mapped.detonatedAreaIds.length||mapped.endedAreaIds?.length)throw Error('activity-parent:unsupported-map-continuation')
   const beforeIds=new Set(entry.beforeMap.tokens.map(token=>token.id)),added=mapped.map.tokens.filter(token=>!beforeIds.has(token.id))
   if(added.length!==1||mapped.initiativeEntries.length!==1||mapped.initiativeEntries[0].tokenId!==added[0].id||added.some(token=>!sameActivityParentData(application.map.tokens.find(row=>row.id===token.id),token)))throw Error('activity-parent:changed-materialized-summon')
  }
 if(witnesses.length){
  const originalIds=new Set(witnesses[0].beforeMap.tokens.map(token=>token.id)),allAdded=witnesses[witnesses.length-1].result.map.tokens.filter(token=>!originalIds.has(token.id))
  if(!sameActivityParentData(application.map.tokens.filter(token=>!originalIds.has(token.id)),allAdded))throw Error('activity-parent:changed-materialized-summon')
 }
 const values=await Promise.all(dependencyNames.map(name=>gateway.loadResource<Revisioned>(name)));guard()
 if(dependencyNames.some((name,index)=>revision(values[index],name)!==record.dependencies[name]))throw Error('activity-parent:stale-native-baseline')
 const maps=values[0] as Revisioned&{maps:BattleMap[]},characters=values[1] as Revisioned&{characters:Character[]},combat=values[2] as SharedCombatState
 if(!maps||!characters||!combat||combat.mapId!==identity.mapId||combat.combatId!==identity.combatId||!Array.isArray(combat.initiativeOrder))throw Error('activity-parent:complete-combat-snapshot-required')
 const group=Object.values(journal!.parents).filter(row=>row.parentTransactionId===identity.parentTransactionId)
 if(group.some(row=>!sameActivityParentData(row.scParent,record.scParent)||row.phase!=='waiting'||!sameActivityParentData(row.stage,record.stage)||!row.choice?.decision))throw Error('activity-parent:other-death-choice-still-pending')
 return{settlement,result,application,witnesses,values,group}
}

/** Only a real SC-issued post-CON frame may establish this origin; no fake DM
 * command or late world baseline substitutes for the original SC authority. */
export async function persistSpecterScActivityDeathParent(frame:SecondChancePostNativeFrame,identity:ActivityDeathParentIdentity,gateway:Gateway){
 const view=await requireActiveSpecterScFrame(frame),snapshot=readPostNativeActivityStage(view.stage)
 if(identity.parentTransactionId!==view.parentTransactionId||identity.mapId!==view.mapId||identity.combatId!==view.combatId)throw Error('specter-sc:unrelated-parent')
 assertKilledTarget(snapshot,identity,view.result.transaction?.id)
 const baseline=Object.freeze({}) as ActivityDeathParentBaseline
 baselines.set(baseline,{roomId:view.roomId,hostMemberId:view.hostMemberId,dependencies:{...view.revisions} as Record<string,number>,command:view.originalRoomAction,scParent:{schemaVersion:1,groupIdentity:view.scGroupIdentity}})
 return persistActivityDeathParent(view.stage,identity,gateway,baseline)
}
declare const scReadyBrand:unique symbol
export interface SpecterScActivityReady {readonly[scReadyBrand]:true}
interface ScReadyData {frame:SecondChancePostNativeFrame;definitions:ReturnType<typeof currentDefinitions>;value:{result:NativeResult;application:Dnd5eMapResultPlan;initiativeEntries:readonly import('../../components/map/InitiativeTracker').InitiativeEntry[];journalWrite:import('../../ports/sharedRoomGateway').SharedResourceTransactionWrite;readRevisions:Record<string,number>}}
const scReadyPlans=new WeakMap<object,ScReadyData>()
export async function prepareSpecterScActivityReady(frame:SecondChancePostNativeFrame,input:{identity:ActivityDeathParentIdentity;settlement:PostNativeActivitySettlement;mapResults?:readonly Dnd5eActivityMapHandoffResultV1[]},gateway:Gateway):Promise<SpecterScActivityReady>{
 const view=await requireActiveSpecterScFrame(frame),{guard}=hostGuard(),journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
 const record=journal?.parents[activityDeathParentKey(input.identity)]
 if(!record||record.phase!=='waiting'||record.scParent?.groupIdentity!==view.scGroupIdentity||record.parentTransactionId!==view.parentTransactionId||!sameActivityParentData(record.dependencies,view.revisions))throw Error('specter-sc:original-waiting-parent-required')
 const stage=await restoreActivityDeathParent(input.identity,gateway)
 const materialized=await prepareDeathParentMaterialization(input,record,journal!,stage,gateway,guard)
 const completed=encodeSecondChanceParentWire({origin:'second-chance',scGroupIdentity:view.scGroupIdentity,settlement:materialized.settlement})
 const next={...journal,parents:{...journal!.parents,...Object.fromEntries(materialized.group.map(row=>[row.id,{...row,phase:'consumed' as const,completed}]))}}
 const ready=Object.freeze({}) as SpecterScActivityReady
 scReadyPlans.set(ready,{frame,definitions:currentDefinitions(),value:{result:materialized.result,application:materialized.application,initiativeEntries:materialized.witnesses.flatMap(w=>[...w.result.initiativeEntries]),journalWrite:{name:ACTIVITY_DEATH_PARENT_RESOURCE,expectedRevision:revision(journal,ACTIVITY_DEATH_PARENT_RESOURCE),data:next},readRevisions:{...record.dependencies}}})
 return ready
}
/** This returns only the branded private-journal mutation. The real SC
 * publisher retains its sole HP/resource/combat/ACK CAS and group revalidation. */
export async function readSpecterScActivityReady(frame:SecondChancePostNativeFrame,ready:SpecterScActivityReady){
 const view=await readSpecterScFrame(frame),entry=scReadyPlans.get(ready)
 if(!entry||entry.frame!==frame||!sameActivityParentData(entry.definitions,currentDefinitions())||entry.value.result.state.combatId!==view.combatId||entry.value.application.map.id!==view.mapId)throw Error('specter-sc:issued-current-ready-required')
 return decodeSecondChanceParentWire(encodeSecondChanceParentWire(entry.value)) as ScReadyData['value']
}
