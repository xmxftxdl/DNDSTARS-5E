import{loadBountifulActivityProtectedOriginalDecision}from'./bountifulActivityProtectedPrefix'
import{originalD20ReplaySourceKey,type OriginalD20ReplayFacts}from'../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import{readBountifulActivityOriginalRecoveryProof}from'./bountifulActivityOriginalRecovery'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{createDnd5eOriginalD20Session,createDnd5eAllyOriginalCollectionSession,actualDnd5eOriginalAllyBoundaryMatches}from'../../rulesets/dnd5e/damageCommitSession'
import type{resolvePreparedDnd5ePluginFeatureAction}from'../../rulesets/dnd5e/pluginFeatureAction'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{withActivityAbilityOriginalPoolObserver,type ActivityAbilityOriginalPool}from'../../rulesets/dnd5e/activities/activityAbilityOriginalDice'
import{withActivityAbilityOriginalMissing,readActivityAbilityOriginalMissing,type ActivityAbilityOriginalMissing}from'../../rulesets/dnd5e/activities/activityAbilityOriginalMissing'
import{captureBountifulActivityNativeBoundary}from'../../rulesets/dnd5e/bountifulActivityNativeBoundary'
import{captureSecondChancePreparedHostFacts}from'./secondChancePreparedHostFacts'
type Source=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]
type NativeSession=ReturnType<typeof createDnd5eOriginalD20Session<Source,unknown>>
type Stage=ReturnType<NativeSession['run']>
type Pending=Extract<Stage,{status:'pending-ally-natural-one'}>
type MissingStage={status:'missing-activity-ability-original';request:ActivityAbilityOriginalMissing}
declare const originalActivityOperation:unique symbol
export type BountifulActivityOriginalOperation={readonly[originalActivityOperation]:true}
declare const missingActivityOperation:unique symbol
export type BountifulActivityMissingOriginalOperation={readonly[missingActivityOperation]:true}
const issued=new WeakMap<object,{roomId:string;memberId:string;source:Source;sourceSignature:string;definitionSignature:string;stage:Pending;stageSignature:string;pool:Readonly<ActivityAbilityOriginalPool>;effectTimestamp:number;bookProof?:object}>()
const firstOwnIssued=new WeakMap<object,object>()
const ownIssued=new WeakMap<object,object>()
const missingIssued=new WeakMap<object,{roomId:string;memberId:string;source:Source;sourceSignature:string;definitionSignature:string;stage:MissingStage;stageSignature:string;precedingPools:readonly Readonly<ActivityAbilityOriginalPool>[];effectTimestamp:number;bookProof?:object}>()
const host=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('activity-original:actual-host-required');return{roomId:value.roomId,memberId:value.memberId}}
const signature=(source:Source)=>JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(source)))
function definition(source:Source){const action=source.prepared.headlessAction;return JSON.stringify(getRegisteredDnd5eActivity(action.pluginId,action.actionId))}
/** Captures the actual synchronous worker of the original asynchronous facade.
 * The reused boundary is mechanical; no Second Chance parent or owner grant is
 * issued. Only a genuine Native pause can create this observation capability. */
export function createBountifulActivityOriginalNativeSession(input:Source,actorId:string){return createSession(input,actorId)}
export function createBountifulActivityOriginalNativeSessionFromBook(proof:object,actorId:string){const recovered=readBountifulActivityOriginalRecoveryProof(proof);return createSession(recovered.source,actorId,recovered.effectTimestamp,proof)}
export function createBountifulActivityOriginalCollectorSession(input:Source){return createSession(input,undefined)}
export function createBountifulActivityOriginalCollectorSessionFromBook(proof:object){const recovered=readBountifulActivityOriginalRecoveryProof(proof);return createSession(recovered.source,undefined,recovered.effectTimestamp,proof)}
function createSession(input:Source,actorId:string|undefined,effectTimestamp?:number,bookProof?:object){
 if('hostOriginalD20Replay'in input&&input.hostOriginalD20Replay!==undefined)throw Error('activity-original:protected-replay-required')
 if(input.prepared.attackActionTeleport||('attackTeleportPrelude'in input.prepared&&input.prepared.attackTeleportPrelude))throw Error('activity-original:protected-prelude-required')
 const owner=host(),source=cloneDnd5eHostTransactionInput({...input,resolveDamageBoundary:undefined,resolveMaterialDamageBoundary:undefined}),sourceSignature=signature(source),definitionSignature=definition(source)
 if(!source.prepared.action.id||!definitionSignature)throw Error('activity-original:actual-prepared-definition-required')
 const nativeInput:Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts}=effectTimestamp===undefined?source:{...source,hostOriginalD20Replay:{parentId:source.prepared.action.id,sourceKey:originalD20ReplaySourceKey(source.prepared.action.id,source.prepared.state,source.prepared.action,effectTimestamp),effectTimestamp,facts:[]}}
 const boundary=captureBountifulActivityNativeBoundary(source),resolveWorker=boundary.resolvePrepared,session=actorId===undefined?createDnd5eAllyOriginalCollectionSession(nativeInput,resolveWorker):createDnd5eOriginalD20Session(nativeInput,resolveWorker,actorId,'ability-check'),stages=new WeakMap<object,BountifulActivityOriginalOperation>(),missingStages=new WeakMap<object,BountifulActivityMissingOriginalOperation>(),nativeLuckyStages=new WeakMap<object,string>();let ended=false,resumed=false,authenticatedPrefix=false;let currentPending:Pending|undefined
 function observe(run:()=>Stage):Stage|MissingStage{
  if(ended)throw Error('activity-original:session-ended')
  const current=host();if(current.roomId!==owner.roomId||current.memberId!==owner.memberId||signature(source)!==sourceSignature||definition(source)!==definitionSignature)throw Error('activity-original:changed-current-source')
  let interruptedPool:Readonly<ActivityAbilityOriginalPool>|undefined,interruptedError:unknown,stage:Stage;const pools:Readonly<ActivityAbilityOriginalPool>[]=[]
  try{stage=withActivityAbilityOriginalPoolObserver(value=>{pools.push(value)},()=>withActivityAbilityOriginalMissing(run),(value,error)=>{interruptedPool=value;interruptedError=error})}catch(error){
   const request=readActivityAbilityOriginalMissing(error);if(!request)throw error
   currentPending=undefined;if(resumed&&!authenticatedPrefix)throw Error('activity-original:protected-prefix-required')
   if(request.activityId!==getRegisteredDnd5eActivity(source.prepared.headlessAction.pluginId,source.prepared.headlessAction.actionId)?.id)throw Error('activity-original:exact-root-activity-required')
   const missing:MissingStage={status:'missing-activity-ability-original',request},operation=Object.freeze({})as BountifulActivityMissingOriginalOperation
   missingIssued.set(operation,{...owner,source,sourceSignature,definitionSignature,stage:missing,stageSignature:JSON.stringify(missing),precedingPools:structuredClone(pools),effectTimestamp:session.originalEffectTimestamp(),...(bookProof?{bookProof}:{})});missingStages.set(missing,operation);return missing
  }
  currentPending=stage.status==='pending-ally-natural-one'?stage:undefined
  if((!resumed||authenticatedPrefix)&&stage.status==='pending-ally-natural-one'&&!stage.request.nativeLucky&&stage.request.kind==='ability-check'){
   const pool=interruptedPool
   if(!actualDnd5eOriginalAllyBoundaryMatches(stage,resolveWorker,interruptedError)||!pool||pool.activityId!==getRegisteredDnd5eActivity(source.prepared.headlessAction.pluginId,source.prepared.headlessAction.actionId)?.id||pool.actorId!==stage.request.actorId||JSON.stringify(pool.values.slice(0,pool.mode==='normal'?1:2))!==JSON.stringify(stage.request.originalRolls))throw Error('activity-original:exact-native-formula-slot-required')
   const operation=Object.freeze({})as BountifulActivityOriginalOperation;issued.set(operation,{...owner,source,sourceSignature,definitionSignature,stage,stageSignature:JSON.stringify(stage),pool:structuredClone(pool),effectTimestamp:session.originalEffectTimestamp(),...(bookProof?{bookProof}:{})});stages.set(stage,operation)
  }
  if((!resumed||authenticatedPrefix)&&stage.status==='pending-ally-natural-one'&&stage.request.nativeLucky&&stage.request.kind==='ability-check'){
   const pool=interruptedPool;if(!actualDnd5eOriginalAllyBoundaryMatches(stage,resolveWorker,interruptedError)||!pool||pool.actorId!==stage.request.actorId||JSON.stringify(pool.values.slice(0,pool.mode==='normal'?1:2))!==JSON.stringify(stage.request.originalRolls))throw Error('activity-own:exact-native-formula-slot-required');nativeLuckyStages.set(stage,JSON.stringify(stage));const operation=Object.freeze({})as BountifulActivityOriginalOperation;issued.set(operation,{...owner,source,sourceSignature,definitionSignature,stage,stageSignature:JSON.stringify(stage),pool:structuredClone(pool),effectTimestamp:session.originalEffectTimestamp(),...(bookProof?{bookProof}:{})});ownIssued.set(stage,operation);if(stage.occurrence===0)firstOwnIssued.set(stage,operation)
  }
  return stage
 }
 return{run:()=>observe(()=>session.run(source.prepared.state)),async resumeAuthenticatedAllyNaturalOne(stage:Stage|MissingStage){if(ended||!bookProof||stage!==currentPending||(!stages.has(stage)&&!nativeLuckyStages.has(stage))||stage.status!=='pending-ally-natural-one')throw Error('activity-prefix:actual-book-pending-required');const decision=await loadBountifulActivityProtectedOriginalDecision(bookProof,stage.occurrence,stage.request);if(ended||stage!==currentPending||signature(source)!==sourceSignature||JSON.stringify(stage)!==(nativeLuckyStages.get(stage)??issued.get(stages.get(stage)!)?.stageSignature))throw Error('activity-prefix:changed-pending');currentPending=undefined;resumed=true;authenticatedPrefix=true;return observe(()=>session.resumeAllyNaturalOne(source.prepared.state,stage.occurrence,stage.request,decision))},resumeAllyNaturalOne:(occurrence:number,request:Parameters<NativeSession['resumeAllyNaturalOne']>[2],decision?:Parameters<NativeSession['resumeAllyNaturalOne']>[3])=>{currentPending=undefined;resumed=true;authenticatedPrefix=false;return observe(()=>session.resumeAllyNaturalOne(source.prepared.state,occurrence,request,decision))},ownOperation(stage:Stage|MissingStage){const operation=ownIssued.get(stage);if(!operation||stage!==currentPending)throw Error('activity-own:actual-current-own-pause-required');return operation as BountifulActivityOriginalOperation},firstOwnOperation(stage:Stage|MissingStage){const operation=firstOwnIssued.get(stage);if(!operation)throw Error('activity-first-own:actual-issued-own-pause-required');return operation as BountifulActivityOriginalOperation},operation(stage:Stage|MissingStage){const operation=stages.get(stage);if(!operation)throw Error('activity-original:actual-issued-original-pause-required');return operation},missingOriginal(stage:Stage|MissingStage){const operation=missingStages.get(stage);if(!operation)throw Error('activity-original:actual-issued-missing-pause-required');return operation},async dispose(){if(ended)return;ended=true;session.cancel();await boundary.abort()}}
}
export function readBountifulActivityMissingOriginalOperation(operation:object){
 const record=missingIssued.get(operation),owner=host();if(!record||record.roomId!==owner.roomId||record.memberId!==owner.memberId||record.stageSignature!==JSON.stringify(record.stage)||record.sourceSignature!==signature(record.source)||record.definitionSignature!==definition(record.source))throw Error('activity-original:changed-or-unissued-missing-operation')
 return{source:cloneDnd5eHostTransactionInput(record.source),parentId:record.source.prepared.action.id,request:structuredClone(record.stage.request),precedingPools:structuredClone(record.precedingPools),effectTimestamp:record.effectTimestamp}
}
/** A read-only Native fact. Private raw transport and actual publication still
 * require their own canonical source/controller/clock and receipt checks. */
export function readBountifulActivityOriginalOperation(operation:object){
 const record=issued.get(operation),owner=host();if(!record||record.roomId!==owner.roomId||record.memberId!==owner.memberId||record.stageSignature!==JSON.stringify(record.stage)||record.sourceSignature!==signature(record.source)||record.definitionSignature!==definition(record.source))throw Error('activity-original:changed-or-unissued-operation')
 return{source:cloneDnd5eHostTransactionInput(record.source),parentId:record.source.prepared.action.id,pool:structuredClone(record.pool),request:structuredClone(record.stage.request),snapshot:structuredClone(record.stage.snapshot),effectTimestamp:record.effectTimestamp}
}

export function readBountifulActivityOriginalOperationBookProof(operation:object){const record=issued.get(operation);readBountifulActivityOriginalOperation(operation);if(!record?.bookProof)throw Error('activity-original:actual-protected-book-required');readBountifulActivityOriginalRecoveryProof(record.bookProof);return record.bookProof}

export function readBountifulActivityOriginalActualStage(operation:object){readBountifulActivityOriginalOperation(operation);const row=issued.get(operation);if(!row)throw Error('activity-original:actual-issued-original-pause-required');return row.stage}
