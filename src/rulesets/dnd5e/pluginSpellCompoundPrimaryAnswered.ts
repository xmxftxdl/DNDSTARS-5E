import {resolvePreparedDnd5ePluginSpellCast} from './pluginSpellTransaction'
import {createDnd5eNextOriginalD20Session,createDnd5eAllyOriginalCollectionSession,readDnd5eActualOriginalAllyBoundary,readDnd5eActualOriginalReadyBoundary} from './damageCommitSession'
import {withActivityAttackOriginalMissing} from './activities/activityAttackOriginalMissing'
import {withActivityEffectOriginalMissing,readActivityEffectOriginalMissing,withActivityEffectOriginalFormulaIdentity,type ActivityEffectOriginalPool} from './activities/activityEffectOriginalMissing'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {dnd5eRulesPluginRegistrySnapshot} from './pluginApi'
import {originalD20ReplaySourceKey,type OriginalD20ReplayFacts} from './allyNaturalOneCheckpoint'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'

type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Session=ReturnType<typeof createDnd5eNextOriginalD20Session<Source,ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>>>
type Stage=ReturnType<Session['run']>
type Pending=Extract<Stage,{status:'pending-ally-natural-one'}>
type Ready=Extract<Stage,{status:'original-d20-ready'}>
type Effect={status:'missing-primary-effect-original';request:ActivityEffectOriginalPool}
type Result=Stage|Effect
type Option=Pending['request']['options'][number]
type Fact=OriginalD20ReplayFacts['facts'][number]
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
declare const answeredBrand:unique symbol
export type Dnd5ePluginSpellCompoundPrimaryAnsweredReady={readonly[answeredBrand]:true}
declare const pendingBrand:unique symbol
export type Dnd5ePluginSpellCompoundPrimaryAnsweredPending={readonly[pendingBrand]:true}
const issuedPending=new WeakMap<object,{read:()=>void;source:()=>Source;effectTimestamp:number;actualPending:Pending}>()
const completed=new WeakMap<object,{read:()=>void;source:()=>Source;effectTimestamp:number;ready:Ready;facts:()=>readonly Fact[];primary:()=>ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>}>()

/** Native mechanics only. Every answer refers to this live worker's real pending
 * object and one actual option. No caller replay array or Room authority enters. */
export function createDnd5ePluginSpellCompoundPrimaryAnsweredCollector(input:Source){
 if('hostOriginalD20Replay'in input||'compound'in input)throw Error('ice-knife-primary-answered:plain-source-required')
 let source=cloneDnd5eHostTransactionInput(input),sourceSignature=signature(source)
 const p=source.prepared,action=p.activityHeadlessAction,definition=action&&getRegisteredDnd5eActivity(action.pluginId,action.actionId),registry=dnd5eRulesPluginRegistrySnapshot(),definitionSignature=signature(definition),effectTimestamp=source.now
 if(!Number.isSafeInteger(effectTimestamp)||effectTimestamp!<=0||p.action.type!=='dnd5e-spell-cast'||p.action.status!=='pending'||action?.actionId!=='ice-knife-cast'||!definition||signature(p.activity)!==definitionSignature||p.targets.length!==1)throw Error('ice-knife-primary-answered:actual-one-target-queued-definition-required')
 const facts:Fact[]=[]
 let worker:Session,ended=false,current:Result|undefined,currentSignature:string|undefined,effectError:unknown,primary:ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>|undefined,primarySignature:string|undefined
 const guard=()=>{if(ended||registry!==dnd5eRulesPluginRegistrySnapshot()||signature(source)!==sourceSignature||signature(getRegisteredDnd5eActivity(action.pluginId,action.actionId))!==definitionSignature)throw Error('ice-knife-primary-answered:current-source-required')}
 const nativeInput=()=>({...source,hostOriginalD20Replay:{parentId:p.action.id,effectTimestamp:effectTimestamp!,sourceKey:originalD20ReplaySourceKey(p.action.id,p.state,p.action,effectTimestamp),facts:structuredClone(facts)}})
 const createWorker=()=>createDnd5eNextOriginalD20Session(nativeInput(),resolvePreparedDnd5ePluginSpellCast)
 worker=createWorker()
 const assertCurrent=(stage:Result)=>{guard();if(current!==stage||signature(stage)!==currentSignature)throw Error('ice-knife-primary-answered:actual-current-stage-required')}
 const accept=(invoke:()=>Stage):Result=>{
  guard();let stage:Result
  try{stage=withActivityAttackOriginalMissing(()=>withActivityEffectOriginalMissing(invoke))
   if(stage.status==='original-d20-ready'){
    const actual=readDnd5eActualOriginalReadyBoundary(stage)
    if(!facts.length||actual.resolve!==resolvePreparedDnd5ePluginSpellCast||stage.request.kind!=='attack'||stage.request.actorId!==p.actorToken.id)throw Error('ice-knife-primary-answered:actual-answered-ready-required')
    // A true d20-ready stop precedes the damage formula. Independently finish
    // this same original primary, using only this worker's accumulated facts.
    // Missing ordinary damage remains its actual Native formula frontier.
    const completion=createDnd5eAllyOriginalCollectionSession(nativeInput(),resolvePreparedDnd5ePluginSpellCast)
    try{
     const done=withActivityAttackOriginalMissing(()=>withActivityEffectOriginalMissing(()=>withActivityEffectOriginalFormulaIdentity({activityId:definition.id,actorId:p.actorToken.id,transactionId:p.action.id},()=>completion.run(p.state))))
     if(done.status!=='resolved'||!done.result.result.ok)throw Error('ice-knife-primary-answered:successful-actual-primary-required:'+done.status+':'+(done.status==='resolved'&&!done.result.result.ok?done.result.result.reason:'not-resolved'))
     primary=done.result;primarySignature=signature(primary)
    }finally{completion.cancel()}
   }
  }
  catch(error){const missing=readActivityEffectOriginalMissing(error);if(!missing){ended=true;current=undefined;worker.cancel();throw error}
   if(missing.activityId!==definition.id||missing.actorId!==p.actorToken.id||missing.transactionId!==p.action.id||!facts.length){ended=true;current=undefined;worker.cancel();throw Error('ice-knife-primary-answered:actual-primary-effect-required')}
   effectError=error;stage={status:'missing-primary-effect-original',request:missing}
  }
  current=stage;currentSignature=signature(stage)
  if(stage.status==='pending-ally-natural-one'){
   const actual=readDnd5eActualOriginalAllyBoundary(stage)
   if(actual.resolve!==resolvePreparedDnd5ePluginSpellCast||actual.effectTimestamp!==effectTimestamp||stage.request.kind!=='attack'||stage.request.actorId!==p.actorToken.id||stage.occurrence!==facts.length||!stage.request.originalRolls.includes(1))throw Error('ice-knife-primary-answered:actual-primary-checkpoint-required')
  }
  
  return stage
 }
 return{
  run(){guard();if(current){assertCurrent(current);return current}return accept(()=>worker.run(p.state))},
  pending(stage:Pending):Dnd5ePluginSpellCompoundPrimaryAnsweredPending{
   assertCurrent(stage);readDnd5eActualOriginalAllyBoundary(stage)
   const cap=Object.freeze({}) as Dnd5ePluginSpellCompoundPrimaryAnsweredPending
   issuedPending.set(cap,{read:()=>{assertCurrent(stage);readDnd5eActualOriginalAllyBoundary(stage)},source:()=>source,effectTimestamp:effectTimestamp!,actualPending:stage})
   return cap
  },
  answer(stage:Pending,option:Option|undefined,replacement?:number):Result{
   assertCurrent(stage);readDnd5eActualOriginalAllyBoundary(stage)
   if(option?!stage.request.options.includes(option)||!Number.isInteger(replacement)||replacement!<1||replacement!>20:replacement!==undefined)throw Error('ice-knife-primary-answered:actual-option-scalar-required')
   const decision=option?{ownerId:option.ownerId,featureId:option.featureId,replacement:replacement!}:undefined
   // Only this genuine pending/resume sequence contributes to replay on a
   // later real damage-formula pause. The caller never supplies these facts.
   facts.push({occurrence:stage.occurrence,request:structuredClone(stage.request),...(decision?{decision}: {})})
   return accept(()=>worker.resumeAllyNaturalOne(p.state,stage.occurrence,stage.request,decision))
  },
  supplyEffect(stage:Effect,rollId:string,values:readonly number[]):Result{
   assertCurrent(stage)
   if(signature(readActivityEffectOriginalMissing(effectError))!==signature(stage.request))throw Error('ice-knife-primary-answered:actual-formula-required')
   const roll=stage.request.rolls.find(row=>row.rollId===rollId)
   if(stage.request.rolls.length!==1||!roll||values.length!==roll.count||values.some(value=>!Number.isInteger(value)||value<1||value>roll.sides)||source.rolls?.activityRolls?.[rollId]!==undefined)throw Error('ice-knife-primary-answered:actual-formula-values-required')
   worker.cancel()
   source={...source,rolls:{...source.rolls,activityRolls:{...source.rolls?.activityRolls,[rollId]:{values:[...values],modifier:roll.modifier,total:values.reduce((sum,value)=>sum+value,0)+roll.modifier}}}}
   sourceSignature=signature(source);worker=createWorker();effectError=undefined
   return accept(()=>worker.run(p.state))
  },
  ready(stage:Ready):Dnd5ePluginSpellCompoundPrimaryAnsweredReady{
   assertCurrent(stage);readDnd5eActualOriginalReadyBoundary(stage)
   if(!primary||!primary.result.ok||signature(primary)!==primarySignature)throw Error('ice-knife-primary-answered:actual-complete-primary-required')
   const cap=Object.freeze({}) as Dnd5ePluginSpellCompoundPrimaryAnsweredReady
   completed.set(cap,{read:()=>{assertCurrent(stage);readDnd5eActualOriginalReadyBoundary(stage);if(!primary||signature(primary)!==primarySignature)throw Error('ice-knife-primary-answered:unchanged-complete-primary-required')},source:()=>source,effectTimestamp:effectTimestamp!,ready:stage,facts:()=>facts,primary:()=>primary!})
   return cap
  },
  close(){if(!ended){ended=true;current=undefined;worker.cancel()}}
 }
}
/** Read-only mechanical witness. A later family must independently bind every
 * input to its authenticated private book, current world and publication CAS. */
export function readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap:object){
 const row=completed.get(cap);if(!row)throw Error('ice-knife-primary-answered:actual-ready-cap-required');row.read()
 const source=cloneDnd5eHostTransactionInput(row.source())
 return{source,effectTimestamp:row.effectTimestamp,parentId:source.prepared.action.id,actorId:source.prepared.actorToken.id,targetId:source.prepared.targets[0].token.id,mode:row.ready.request.rollMode,ready:structuredClone(row.ready.request),facts:structuredClone(row.facts()),primary:structuredClone(row.primary())}
}

/** Current mechanical lease only. The genuine pending reference is intentionally
 * not cloned; its Native reader and this live collector must both remain valid. */
export function readDnd5ePluginSpellCompoundPrimaryAnsweredPending(cap:object){
 const row=issuedPending.get(cap);if(!row)throw Error('ice-knife-primary-answered:actual-pending-cap-required');row.read()
 return{source:cloneDnd5eHostTransactionInput(row.source()),actualPending:row.actualPending,effectTimestamp:row.effectTimestamp}
}
