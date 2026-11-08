import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readDnd5ePluginSpellCompoundPrimaryAnsweredQualification,projectDnd5ePluginSpellCompoundPrimaryAnsweredReplay,type Dnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'./pluginSpellCompoundPrimaryAnsweredQualification'
import{withActivityEffectOriginalFormulaIdentity}from'./activities/activityEffectOriginalMissing'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{prepareDnd5eIceKnifeBurstCommitV1}from'./activities/dnd5eActivityTriggerSettlement'
import{applyDnd5eActivityDeferredMapHandoffs}from'./activities/dnd5eActivityDeferredMapHandoffs'
import{planDnd5eMapResultApplication}from'./mapBridge'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{rethrowAllyNaturalOneInterruption}from'./allyNaturalOneCheckpoint'
import{withActivityAttackOriginalMissing}from'./activities/activityAttackOriginalMissing'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Descriptor=ReturnType<typeof prepareDnd5eIceKnifeBurstCommitV1>['descriptor']
type Rolls=Parameters<ReturnType<typeof prepareDnd5eIceKnifeBurstCommitV1>['commit']>[0]
export type Dnd5ePluginSpellCompoundInput=Source&{compound:{descriptor:Descriptor;activity:ReturnType<typeof prepareDnd5eIceKnifeBurstCommitV1>['activity'];primaryRollId:string;primaryInputRolls:Source['rolls'];combatRevision:number}}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
function primary(source:Source){const p=source.prepared;if(p.spell.automation.mode!=='headless-action'||p.activity?.id!=='ice-knife-cast'||p.activityHeadlessAction?.actionId!=='ice-knife-cast')throw Error('ice-knife-compound:actual-current-primary-required');const value=withActivityAttackOriginalMissing(()=>resolvePreparedDnd5ePluginSpellCast(source));if(!value.result.ok){rethrowAllyNaturalOneInterruption();throw Error('ice-knife-compound:successful-real-primary-required')}return value as typeof value&{result:Extract<typeof value.result,{ok:true}>}}
function frame(source:Source,value:ReturnType<typeof primary>,combatRevision:number){const p=source.prepared;return prepareDnd5eIceKnifeBurstCommitV1({state:value.result.state,events:value.result.events,eventBatchId:p.action.id,combatRevision,charactersByCombatantId:Object.fromEntries(Object.entries(p.characterIdByCombatantId).map(([id,characterId])=>{const character=p.characters.find(character=>character.id===characterId);if(!character)throw Error('ice-knife-compound:actual-current-character-required');return[id,character]}))})}
/** Mechanical source creation; Room must independently authenticate the primary
 * private raw/adopted anchor before issuing any burst saving or B capability. */
export function prepareDnd5ePluginSpellCompoundInput(source:Source,combatRevision:number):Dnd5ePluginSpellCompoundInput{return preparedCompound(source,combatRevision,primary(source))}
function preparedCompound(source:Source,combatRevision:number,value:ReturnType<typeof primary>):Dnd5ePluginSpellCompoundInput{const actual=frame(source,value,combatRevision),p=source.prepared,checks=p.activity!.checks!;if(checks.length!==1||checks[0].kind!=='attack-roll'||p.targets.length!==1)throw Error('ice-knife-compound:one-original-attack-required');const primaryRollId=checks[0].rollId+(checks[0].scope==='per-target'?':'+p.targets[0].token.id:'');return{...source,compound:{descriptor:actual.descriptor,activity:structuredClone(actual.activity),primaryRollId,primaryInputRolls:structuredClone(source.rolls),combatRevision}}}
function rollIds(activity:NonNullable<Source['prepared']['activity']>,targets:readonly string[]){const ids=new Set<string>();for(const check of activity.checks??[])for(const id of check.scope==='per-target'?targets:[''])ids.add(check.rollId+(id?':'+id:''));for(const outcome of activity.outcomes)for(const operation of outcome.operations){if(operation.kind==='damage'&&operation.amount.kind==='dice')for(const id of operation.perTarget?targets:[''])ids.add(operation.amount.rollId+(id?':'+id:''))}return ids}
/** Fixed actual primary + registered automatic burst. Every replay rederives its
 * event, area, actors, rules and command, before accepting only the stored dice. */
export function resolvePreparedDnd5ePluginSpellCompound(input:Dnd5ePluginSpellCompoundInput):ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>{
 const{compound,...full}=input,primaryIds=rollIds(full.prepared.activity!,full.prepared.targets.map(target=>target.token.id)),original=full.rolls?.activityRolls??{},primaryRolls=compound.primaryInputRolls?.activityRolls??{},source={...full,rolls:structuredClone(compound.primaryInputRolls)}
 for(const id of primaryIds){const captured=primaryRolls[id]?.values??compound.primaryInputRolls?.effectRollDice?.[id];if(original[id]&&signature(original[id].values)!==signature(captured)||full.rolls?.effectRollDice?.[id]&&signature(full.rolls.effectRollDice[id])!==signature(captured))throw Error('ice-knife-compound:unchanged-original-primary-dice-required')}
 const value=primary(source),actual=frame(source,value,compound.combatRevision)
 if(signature(actual.descriptor)!==signature(compound.descriptor)||signature(actual.activity)!==signature(compound.activity))throw Error('ice-knife-compound:exact-new-native-event-area-required')
 const burstIds=rollIds(actual.activity,compound.descriptor.command.targetIds),rolls:Rolls={};for(const[id,roll]of Object.entries(original)){if(primaryIds.has(id)){if(burstIds.has(id))throw Error('ice-knife-compound:unique-primary-and-burst-slots-required');continue}if(!burstIds.has(id))throw Error('ice-knife-compound:only-current-registered-slots-required');Reflect.set(rolls,id,{values:[...roll.values]})}
 for(const[id,values]of Object.entries(full.rolls?.effectRollDice??{})){if(primaryIds.has(id))continue;if(!burstIds.has(id)||rolls[id]&&signature(rolls[id].values)!==signature(values))throw Error('ice-knife-compound:only-current-registered-slots-required');Reflect.set(rolls,id,{values:[...values]})}
 const committed=withActivityEffectOriginalFormulaIdentity({activityId:actual.activity.id,actorId:source.prepared.actorToken.id,transactionId:source.prepared.action.id},()=>actual.commit(rolls));if(committed.phase!=='commit'||!committed.result.ok){rethrowAllyNaturalOneInterruption();throw Error('ice-knife-compound:actual-complete-burst-required:'+committed.phase+':'+('reason'in committed.result?committed.result.reason:'not-committed'))}
 const p=source.prepared,burst=committed.result;if(!burst.activityHandoffs)throw Error('ice-knife-compound:actual-burst-map-handoff-required');const applied=applyDnd5eActivityDeferredMapHandoffs({map:p.map,characters:p.characters,activity:actual.activity,packageId:compound.descriptor.command.packageId,actionId:actual.receiptId,actorId:compound.descriptor.command.actorId,round:burst.state.round,worldMinute:burst.state.combatants[p.actorToken.id].campaignWorldMinute??0,combatId:burst.state.combatId,castLevel:compound.descriptor.command.castLevel,handoffs:burst.activityHandoffs,eventTargetTokenId:compound.descriptor.triggerContext.eligibleTargetIds[0],selection:{flamesByOperationId:{},summonCells:[],summonInitiativeD20s:[],movementCellsByOperationId:{}}})
 if(!applied.ok||signature(applied.map)!==signature(p.map))throw Error('ice-knife-compound:closed-unchanged-map-handoffs-required')
 const settledActor=burst.state.combatants[actual.descriptor.command.actorId];if(!settledActor)throw Error('ice-knife-compound:actual-completed-burst-actor-required')
 const priorReceipts=settledActor.classState.activityTriggerReceipts;settledActor.classState.activityTriggerReceipts={combatId:burst.state.combatId,ids:[...(priorReceipts?.combatId===burst.state.combatId?priorReceipts.ids:[]),actual.receiptId]}
 const{activityHandoffs:_appliedHandoffs,...completedBurst}=burst;void _appliedHandoffs
 const result={...completedBurst,transaction:value.transaction,events:[...value.result.events,...burst.events]}
 return{...value,result,application:planDnd5eMapResultApplication({state:result.state,map:p.map,characters:p.characters,baselineCharacters:p.characters,characterIdByCombatantId:p.characterIdByCombatantId,events:[...result.events]})}
}

/** Header construction from this live Native collector's already successful
 * primary. Final resolution still executes the real primary and its prefix. */
export function prepareDnd5ePluginSpellCompoundAnsweredInput(qualification:Dnd5ePluginSpellCompoundPrimaryAnsweredQualification,combatRevision:number){const actual=readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(qualification);if(!actual.primary.result.ok)throw Error('ice-knife-compound:successful-answered-primary-required');return preparedCompound(actual.source,combatRevision,actual.primary as ReturnType<typeof primary>)}
const answeredResolvers=new WeakMap<object,(input:Dnd5ePluginSpellCompoundInput)=>ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>>()
const answeredResolverQualifications=new WeakMap<Function,Dnd5ePluginSpellCompoundPrimaryAnsweredQualification>()
export function dnd5ePluginSpellCompoundAnsweredReplaySessionInput<Input extends{prepared?:{state:Source['prepared']['state']}}>(resolve:unknown,input:Input,state:Source['prepared']['state']):Input|undefined{
 const qualification=typeof resolve==='function'?answeredResolverQualifications.get(resolve):undefined
 if(!qualification)return undefined
 const actual=input as unknown as Dnd5ePluginSpellCompoundInput,projected=projectDnd5ePluginSpellCompoundPrimaryAnsweredReplay(qualification,actual)
 if(signature(projected.hostOriginalD20Replay)!==signature((actual as typeof projected).hostOriginalD20Replay))throw Error('ice-knife-compound:actual-session-attack-prefix-required')
 if(!input.prepared||signature(state)!==signature(input.prepared.state))throw Error('ice-knife-compound:exact-answered-session-baseline-required')
 return cloneDnd5eHostTransactionInput(input)
}
export function dnd5ePluginSpellCompoundAnsweredResolver(qualification:Dnd5ePluginSpellCompoundPrimaryAnsweredQualification){
 readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(qualification)
 let resolve=answeredResolvers.get(qualification)
 if(!resolve){resolve=input=>{
  const actual=readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(qualification),projected=projectDnd5ePluginSpellCompoundPrimaryAnsweredReplay(qualification,input)
  if(signature(projected.hostOriginalD20Replay)!==signature((input as typeof projected).hostOriginalD20Replay))throw Error('ice-knife-compound:actual-session-attack-prefix-required')
  return withActivityEffectOriginalFormulaIdentity({activityId:actual.source.prepared.activity!.id,actorId:actual.source.prepared.actorToken.id,transactionId:actual.source.prepared.action.id},()=>resolvePreparedDnd5ePluginSpellCompound(projected))
 };answeredResolverQualifications.set(resolve,qualification);answeredResolvers.set(qualification,resolve)}
 return resolve
}
