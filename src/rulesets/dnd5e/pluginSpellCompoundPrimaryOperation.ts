import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{createDnd5eNextOriginalD20Session,readDnd5eActualOriginalReadyBoundary}from'./damageCommitSession'
import{withActivityAttackOriginalMissing,readActivityAttackOriginalMissing,type ActivityAttackOriginalMissing}from'./activities/activityAttackOriginalMissing'
import{getRegisteredDnd5eActivity}from'./activities/dnd5eActivityRegistry'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{dnd5eRulesPluginRegistrySnapshot}from'./pluginApi'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Session=ReturnType<typeof createDnd5eNextOriginalD20Session<Source,ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>>>
type Stage=ReturnType<Session['run']>
type Ready=Extract<Stage,{status:'original-d20-ready'}>
declare const primaryBrand:unique symbol
export type Dnd5ePluginSpellCompoundPrimaryOperation={readonly[primaryBrand]:true}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const operations=new WeakMap<object,{source:Source;effectTimestamp:number;read:()=>void;missing?:ActivityAttackOriginalMissing;ready?:Ready}>()
/** Fixed genuine initial primary worker. No physical raw or B permission is
 * issued by either its absent formula or its actual original-ready boundary. */
export function createDnd5ePluginSpellCompoundPrimaryObserver(input:Source){
 if('hostOriginalD20Replay'in input||'compound'in input)throw Error('ice-knife-primary:plain-unreplayed-source-required')
 const source=cloneDnd5eHostTransactionInput(input),p=source.prepared,action=p.activityHeadlessAction,definition=action&&getRegisteredDnd5eActivity(action.pluginId,action.actionId),registry=dnd5eRulesPluginRegistrySnapshot(),definitionSignature=signature(definition),sourceSignature=signature(source),effectTimestamp=source.now
 if(!Number.isSafeInteger(effectTimestamp)||effectTimestamp!<=0||p.action.type!=='dnd5e-spell-cast'||p.action.status!=='pending'||action?.actionId!=='ice-knife-cast'||!definition||signature(p.activity)!==definitionSignature||p.targets.length!==1)throw Error('ice-knife-primary:actual-one-target-queued-definition-required')
 const native={...source,hostOriginalD20Replay:{parentId:p.action.id,effectTimestamp:effectTimestamp!,sourceKey:originalD20ReplaySourceKey(p.action.id,p.state,p.action,effectTimestamp),facts:[]}},worker=createDnd5eNextOriginalD20Session(native,resolvePreparedDnd5ePluginSpellCast),stages=new WeakMap<object,Dnd5ePluginSpellCompoundPrimaryOperation>();let ended=false,current:object|undefined
 const guard=()=>{if(ended||registry!==dnd5eRulesPluginRegistrySnapshot()||signature(source)!==sourceSignature||signature(getRegisteredDnd5eActivity(action.pluginId,action.actionId))!==definitionSignature)throw Error('ice-knife-primary:current-live-native-source-required')}
 return{run(){guard();let stage:Stage|{status:'missing-activity-attack-original';request:ActivityAttackOriginalMissing},error:unknown;try{stage=withActivityAttackOriginalMissing(()=>worker.run(p.state))}catch(cause){const request=readActivityAttackOriginalMissing(cause);if(!request)throw cause;error=cause;stage={status:'missing-activity-attack-original',request}}
  current=stage;if(stage.status!=='missing-activity-attack-original'&&stage.status!=='original-d20-ready')return stage
  const missing=stage.status==='missing-activity-attack-original'?stage.request:undefined,ready=stage.status==='original-d20-ready'?stage:undefined
  if(missing&&(missing.activityId!==definition.id||missing.actorId!==p.actorToken.id||missing.targetId!==p.targets[0].token.id)||ready&&(ready.request.kind!=='attack'||ready.request.actorId!==p.actorToken.id||readDnd5eActualOriginalReadyBoundary(ready).resolve!==resolvePreparedDnd5ePluginSpellCast))throw Error('ice-knife-primary:actual-native-primary-slot-required')
  const token=Object.freeze({})as Dnd5ePluginSpellCompoundPrimaryOperation,stageSignature=signature(stage),read=()=>{guard();if(current!==stage||signature(stage)!==stageSignature||missing&&signature(readActivityAttackOriginalMissing(error))!==signature(missing))throw Error('ice-knife-primary:unchanged-issued-primary-required');if(ready)readDnd5eActualOriginalReadyBoundary(ready)}
  operations.set(token,{source,effectTimestamp:effectTimestamp!,read,missing,ready});stages.set(stage,token);return stage
 },operation(stage:object){guard();const op=stages.get(stage);if(!op)throw Error('ice-knife-primary:actual-issued-stage-required');operations.get(op)!.read();return op},close(){if(!ended){ended=true;current=undefined;worker.cancel()}}}
}
export function readDnd5ePluginSpellCompoundPrimaryOperation(token:object){const row=operations.get(token);if(!row)throw Error('ice-knife-primary:actual-native-operation-required');row.read();const common={source:cloneDnd5eHostTransactionInput(row.source),effectTimestamp:row.effectTimestamp,parentId:row.source.prepared.action.id};return row.missing?{...common,kind:'missing'as const,request:structuredClone(row.missing)}:{...common,kind:'ready'as const,ready:structuredClone(row.ready!.request)}}
