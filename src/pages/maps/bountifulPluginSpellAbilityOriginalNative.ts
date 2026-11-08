import{loadBountifulPluginSpellAbilityProtectedOriginalDecision}from'./bountifulPluginSpellAbilityProtectedPrefix'
import{createDnd5ePluginSpellAbilityOriginalBoundary}from'../../rulesets/dnd5e/bountifulPluginSpellAbilityOriginalBoundary'
import{originalD20ReplaySourceKey,type OriginalD20ReplayFacts}from'../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import{readBountifulPluginSpellAbilityOriginalRecoveryProof}from'./bountifulPluginSpellAbilityOriginalRecovery'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{createDnd5eOriginalD20Session,actualDnd5eOriginalAllyBoundaryMatches}from'../../rulesets/dnd5e/damageCommitSession'
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{withActivityAbilityOriginalPoolObserver,type ActivityAbilityOriginalPool}from'../../rulesets/dnd5e/activities/activityAbilityOriginalDice'
import{withActivityAbilityOriginalMissing,readActivityAbilityOriginalMissing,type ActivityAbilityOriginalMissing}from'../../rulesets/dnd5e/activities/activityAbilityOriginalMissing'
import{captureSecondChancePreparedHostFacts}from'./secondChancePreparedHostFacts'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type NativeSession=ReturnType<typeof createDnd5eOriginalD20Session<Source,unknown>>
type Stage=ReturnType<NativeSession['run']>
type Pending=Extract<Stage,{status:'pending-ally-natural-one'}>
type MissingStage={status:'missing-activity-ability-original';request:ActivityAbilityOriginalMissing}
declare const originalPluginSpellAbilityOperation:unique symbol
export type BountifulPluginSpellAbilityOriginalOperation={readonly[originalPluginSpellAbilityOperation]:true}
declare const missingPluginSpellAbilityOperation:unique symbol
export type BountifulPluginSpellAbilityMissingOriginalOperation={readonly[missingPluginSpellAbilityOperation]:true}
const issued=new WeakMap<object,{roomId:string;memberId:string;source:Source;sourceSignature:string;definitionSignature:string;stage:Pending;stageSignature:string;pool:Readonly<ActivityAbilityOriginalPool>;effectTimestamp:number;alive:()=>boolean}>()
const missingIssued=new WeakMap<object,{roomId:string;memberId:string;source:Source;sourceSignature:string;definitionSignature:string;stage:MissingStage;stageSignature:string;precedingPools:readonly Readonly<ActivityAbilityOriginalPool>[];effectTimestamp:number;alive:()=>boolean}>()
const host=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('plugin-spell-ability-original:actual-host-required');return{roomId:value.roomId,memberId:value.memberId}}
const signature=(source:Source)=>JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(source)))
function definition(source:Source){const action=source.prepared.activityHeadlessAction!;return JSON.stringify(getRegisteredDnd5eActivity(action.pluginId,action.actionId))}
/** Captures the actual synchronous worker of the original asynchronous facade.
 * The reused boundary is mechanical; no Second Chance parent or owner grant is
 * issued. Only a genuine Native pause can create this observation capability. */
export function createBountifulPluginSpellAbilityOriginalNativeSession(input:Source,actorId:string){return createSession(input,actorId)}
export function createBountifulPluginSpellAbilityOriginalCollectorSession(input:Source){return createSession(input,undefined)}
export function createBountifulPluginSpellAbilityOriginalNativeSessionFromBook(proof:object,actorId:string){const r=readBountifulPluginSpellAbilityOriginalRecoveryProof(proof);return createSession(r.source,actorId,r.effectTimestamp,proof)}
export function createBountifulPluginSpellAbilityOriginalCollectorSessionFromBook(proof:object){const r=readBountifulPluginSpellAbilityOriginalRecoveryProof(proof);return createSession(r.source,undefined,r.effectTimestamp,proof)}
function createSession(input:Source,actorId:string|undefined,effectTimestamp?:number,bookProof?:object){
 if('hostOriginalD20Replay'in input&&input.hostOriginalD20Replay!==undefined)throw Error('plugin-spell-ability-original:protected-replay-required')
 if(('attackActionTeleport'in input.prepared&&input.prepared.attackActionTeleport)||('attackTeleportPrelude'in input.prepared&&input.prepared.attackTeleportPrelude))throw Error('plugin-spell-ability-original:protected-prelude-required')
 const owner=host(),sourceInput={...input};for(const key of ['resolveDamageBoundary','resolveMaterialDamageBoundary']as const)if(Object.hasOwn(input,key))Reflect.set(sourceInput,key,undefined);const source=cloneDnd5eHostTransactionInput(sourceInput),sourceSignature=signature(source),definitionSignature=definition(source)
 if(source.prepared.action.type!=='dnd5e-spell-cast'||!source.prepared.activityHeadlessAction||!source.prepared.activity||JSON.stringify(source.prepared.activity)!==definitionSignature||!source.prepared.action.id||!definitionSignature)throw Error('plugin-spell-ability-original:actual-prepared-definition-required')
 const nativeInput:Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts}=effectTimestamp===undefined?source:{...source,hostOriginalD20Replay:{parentId:source.prepared.action.id,sourceKey:originalD20ReplaySourceKey(source.prepared.action.id,source.prepared.state,source.prepared.action,effectTimestamp),effectTimestamp,facts:[]}}
 const resolveWorker=resolvePreparedDnd5ePluginSpellCast,session=createDnd5ePluginSpellAbilityOriginalBoundary(nativeInput,actorId),stages=new WeakMap<object,BountifulPluginSpellAbilityOriginalOperation>(),missingStages=new WeakMap<object,BountifulPluginSpellAbilityMissingOriginalOperation>();const observations=new WeakMap<object,{signature:string;pools:readonly Readonly<ActivityAbilityOriginalPool>[]}>();const authenticatedOwnStages=new WeakMap<object,string>();let ended=false,resumed=false,authenticatedPrefix=false;let currentPending:Pending|undefined
 function observe(run:()=>Stage):Stage|MissingStage{
  if(ended)throw Error('plugin-spell-ability-original:session-ended')
  const current=host();if(current.roomId!==owner.roomId||current.memberId!==owner.memberId||signature(source)!==sourceSignature||definition(source)!==definitionSignature)throw Error('plugin-spell-ability-original:changed-current-source')
  let interruptedPool:Readonly<ActivityAbilityOriginalPool>|undefined,interruptedError:unknown,stage:Stage;const pools:Readonly<ActivityAbilityOriginalPool>[]=[]
  try{stage=withActivityAbilityOriginalPoolObserver(value=>{pools.push(value)},()=>withActivityAbilityOriginalMissing(run),(value,error)=>{interruptedPool=value;interruptedError=error})}catch(error){
   const request=readActivityAbilityOriginalMissing(error);if(!request)throw error
   if(resumed&&!authenticatedPrefix)throw Error('plugin-spell-ability-original:protected-prefix-required')
   if(request.activityId!==getRegisteredDnd5eActivity(source.prepared.activityHeadlessAction!.pluginId,source.prepared.activityHeadlessAction!.actionId)?.id)throw Error('plugin-spell-ability-original:exact-root-activity-required')
   const missing:MissingStage={status:'missing-activity-ability-original',request},operation=Object.freeze({})as BountifulPluginSpellAbilityMissingOriginalOperation
   missingIssued.set(operation,{...owner,source,sourceSignature,definitionSignature,stage:missing,stageSignature:JSON.stringify(missing),precedingPools:structuredClone(pools),effectTimestamp:session.originalEffectTimestamp(),alive:()=>!ended});missingStages.set(missing,operation);observations.set(missing,{signature:JSON.stringify(encodeSecondChanceParentWire(missing)),pools:structuredClone(pools)});return missing
  }
  if((!resumed||authenticatedPrefix)&&stage.status==='pending-ally-natural-one'&&!stage.request.nativeLucky&&stage.request.kind==='ability-check'){
   const pool=interruptedPool
   if(!actualDnd5eOriginalAllyBoundaryMatches(stage,resolveWorker,interruptedError)||!pool||pool.activityId!==getRegisteredDnd5eActivity(source.prepared.activityHeadlessAction!.pluginId,source.prepared.activityHeadlessAction!.actionId)?.id||pool.actorId!==stage.request.actorId||JSON.stringify(pool.values.slice(0,pool.mode==='normal'?1:2))!==JSON.stringify(stage.request.originalRolls))throw Error('plugin-spell-ability-original:exact-native-formula-slot-required')
   const operation=Object.freeze({})as BountifulPluginSpellAbilityOriginalOperation;issued.set(operation,{...owner,source,sourceSignature,definitionSignature,stage,stageSignature:JSON.stringify(stage),pool:structuredClone(pool),effectTimestamp:session.originalEffectTimestamp(),alive:()=>!ended});stages.set(stage,operation);currentPending=stage
  }
  if(authenticatedPrefix&&bookProof&&stage.status==='pending-ally-natural-one'&&stage.request.nativeLucky&&stage.request.kind==='ability-check'){
   const pool=interruptedPool;if(!actualDnd5eOriginalAllyBoundaryMatches(stage,resolveWorker,interruptedError)||!pool||pool.activityId!==getRegisteredDnd5eActivity(source.prepared.activityHeadlessAction!.pluginId,source.prepared.activityHeadlessAction!.actionId)?.id||pool.actorId!==stage.request.actorId||JSON.stringify(pool.values)!==JSON.stringify(stage.request.originalRolls))throw Error('plugin-spell-ability-original:exact-native-own-slot-required');authenticatedOwnStages.set(stage,JSON.stringify(stage));currentPending=stage
  }
  observations.set(stage,{signature:JSON.stringify(encodeSecondChanceParentWire(stage)),pools:structuredClone(pools)});return stage
 }
 return{async resumeAuthenticatedAllyNaturalOne(stage:Stage|MissingStage){if(ended||!bookProof||stage!==currentPending||(!stages.has(stage)&&!authenticatedOwnStages.has(stage))||stage.status!=='pending-ally-natural-one')throw Error('plugin-spell-ability-prefix:actual-book-pending-required');const decision=await loadBountifulPluginSpellAbilityProtectedOriginalDecision(bookProof,stage.occurrence,stage.request);if(ended||stage!==currentPending||signature(source)!==sourceSignature||JSON.stringify(stage)!==(authenticatedOwnStages.get(stage)??issued.get(stages.get(stage)!)?.stageSignature))throw Error('plugin-spell-ability-prefix:changed-pending');currentPending=undefined;resumed=true;authenticatedPrefix=true;return observe(()=>session.resumeAllyNaturalOne(source.prepared.state,stage.occurrence,stage.request,decision))},observedPools(stage:Stage|MissingStage){const current=host(),row=observations.get(stage);if(ended||!row||current.roomId!==owner.roomId||current.memberId!==owner.memberId||sourceSignature!==signature(source)||row.signature!==JSON.stringify(encodeSecondChanceParentWire(stage)))throw Error('plugin-spell-ability-original:actual-current-observation-required');return structuredClone(row.pools)},run:()=>observe(()=>session.run(source.prepared.state)),resumeAllyNaturalOne:(occurrence:number,request:Parameters<NativeSession['resumeAllyNaturalOne']>[2],decision?:Parameters<NativeSession['resumeAllyNaturalOne']>[3])=>{currentPending=undefined;resumed=true;authenticatedPrefix=false;return observe(()=>session.resumeAllyNaturalOne(source.prepared.state,occurrence,request,decision))},operation(stage:Stage|MissingStage){const operation=stages.get(stage);if(!operation)throw Error('plugin-spell-ability-original:actual-issued-original-pause-required');return operation},missingOriginal(stage:Stage|MissingStage){const operation=missingStages.get(stage);if(!operation)throw Error('plugin-spell-ability-original:actual-issued-missing-pause-required');return operation},async dispose(){if(ended)return;ended=true;session.cancel();}}
}
export function readBountifulPluginSpellAbilityMissingOriginalOperation(operation:object){
 const record=missingIssued.get(operation),owner=host();if(!record||!record.alive()||record.roomId!==owner.roomId||record.memberId!==owner.memberId||record.stageSignature!==JSON.stringify(record.stage)||record.sourceSignature!==signature(record.source)||record.definitionSignature!==definition(record.source))throw Error('plugin-spell-ability-original:changed-or-unissued-missing-operation')
 return{source:cloneDnd5eHostTransactionInput(record.source),parentId:record.source.prepared.action.id,request:structuredClone(record.stage.request),precedingPools:structuredClone(record.precedingPools),effectTimestamp:record.effectTimestamp}
}
/** A read-only Native fact. Private raw transport and actual publication still
 * require their own canonical source/controller/clock and receipt checks. */
export function readBountifulPluginSpellAbilityOriginalOperation(operation:object){
 const record=issued.get(operation),owner=host();if(!record||!record.alive()||record.roomId!==owner.roomId||record.memberId!==owner.memberId||record.stageSignature!==JSON.stringify(record.stage)||record.sourceSignature!==signature(record.source)||record.definitionSignature!==definition(record.source))throw Error('plugin-spell-ability-original:changed-or-unissued-operation')
 return{source:cloneDnd5eHostTransactionInput(record.source),parentId:record.source.prepared.action.id,pool:structuredClone(record.pool),request:structuredClone(record.stage.request),snapshot:structuredClone(record.stage.snapshot),effectTimestamp:record.effectTimestamp}
}


export function readBountifulPluginSpellAbilityOriginalActualStage(operation:object){readBountifulPluginSpellAbilityOriginalOperation(operation);const row=issued.get(operation);if(!row)throw Error('plugin-spell-ability-original:actual-issued-original-pause-required');return row.stage}
