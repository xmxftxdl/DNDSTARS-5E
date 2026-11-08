import{stormFuryMoveRequiresCanonicalSequence}from'./stormFuryMoveRouting'
import{createDnd5ePreparedDamageCommitSession}from'./damageCommitSession'
import{withStormFuryHitCheckpoints}from'./stormFuryHitCheckpoint'
import{readBountifulOpportunitySequenceMovementCompletion}from'./bountifulOpportunitySequenceMovement'
import{readBountifulOpportunitySequencePostNativeCompletion}from'./bountifulOpportunitySequencePostNative'
import{issueBountifulOpportunitySequencePostNativeReplay,withBountifulOpportunitySequencePostNativeReplay,readBountifulOpportunitySequencePostNativeReplay,readBountifulOpportunitySequenceMovementReplay,readBountifulOpportunitySequenceConcentrationOriginalReplay,bountifulSequenceConcentrationOriginalTargetActive,readBountifulOpportunitySequenceMovementOriginalReplay,readBountifulOpportunitySequenceMovementConcentrationOriginalReplay}from'./bountifulOpportunitySequencePostNativeReplay'
import{readDnd5eSequenceMovementOriginalReplayFacts,observeDnd5eSequenceMovementOriginal,throwDnd5eSequenceMovementOriginalResult}from'../../pages/maps/movementHazardsProducer'
import{withDnd5eOriginalD20PauseTarget,preparedOriginalD20Replay,validateOriginalD20ReplayFacts,type OriginalD20ReplayFacts}from'./allyNaturalOneCheckpoint'
import{readDnd5eSequenceConcentrationOriginalReplayFacts,observeDnd5eSequenceConcentrationOriginal,throwDnd5eSequenceConcentrationOriginalResult,readDnd5eSequenceMovementConcentrationOriginalReplayFacts,observeDnd5eSequenceMovementConcentrationOriginalAtMovement,throwDnd5eSequenceMovementConcentrationOriginalResultAtMovement}from'../../pages/maps/settleDnd5eCombatResult'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {InitiativeEntry} from '../../components/map/InitiativeTracker'
import type {SharedPlayerActionState,Dnd5eTurnEconomyCounts} from '../../lib/sharedCombatTypes'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot} from './hostTransactionClone'
import {prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove} from './playerMoveAction'
import {prepareDnd5eOpportunityAttack,prepareDnd5eOpportunityRedirectFromPrepared,resolvePreparedDnd5eOpportunityAttack,findDnd5eOpportunityWindowsForMove,dnd5eOpportunityAttackModeResolution,stageDnd5eOpportunityNegation} from './opportunityAttackAction'
import {projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import {planDnd5eMapResultApplication} from './mapBridge'
import {dnd5eCanActAtZeroHitPoints,dnd5eEffectiveSpeed,type Dnd5eActionResult} from './headlessCombatEngine'
import {getRoomSession} from '../../lib/roomSession'

type AttackInput=Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]
export type Dnd5eOpportunitySequenceRolls=Omit<AttackInput,'prepared'|'transactionId'|'transactionNow'>
export type Dnd5eOpportunitySequenceChoice=Dnd5eOpportunitySequenceRolls|{reactionDecision:'decline'}
export interface OpportunityMoveSequenceInput{
 action:SharedPlayerActionState;map:BattleMap;characters:readonly Character[];initiativeOrder:readonly InitiativeEntry[]
 turnEconomyByToken:Readonly<Record<string,Dnd5eTurnEconomyCounts>>;firstHostNow:number
}
interface PreparedSequence{action:SharedPlayerActionState;map:BattleMap;characters:readonly Character[];state:Extract<ReturnType<typeof prepareDnd5ePlayerMove>,{ok:true}>['prepared']['state'];characterIdByCombatantId:Record<string,string>;input:OpportunityMoveSequenceInput;initial:Extract<ReturnType<typeof prepareDnd5ePlayerMove>,{ok:true}>['prepared']}
const issued=new WeakMap<PreparedSequence,string>()
/** Only a real unchanged native preparation has this mechanical identity.
 * Reading it cannot issue an owner choice, original die or room write. */
export function dnd5eActualOpportunityMovePreparationCurrent(prepared:object){const signature=issued.get(prepared as PreparedSequence);return signature!==undefined&&signature===wire(prepared)}
type NativeAttackPrepared=AttackInput['prepared']
let nativePreparationStop:{parentId:string;actorId:string}|undefined
const nativePreparationStops=new WeakMap<object,NativeAttackPrepared>()
/** Synchronous observation of the actual native pre-expense preparer. The
 * scope never survives an asynchronous boundary or accepts a snapshot. */
export function captureDnd5eOpportunitySequenceNativeAttack(parentId:string,actorId:string,replay:()=>unknown):NativeAttackPrepared{
 if(nativePreparationStop)throw Error('opportunity-sequence:nested-native-preparation-scope')
 nativePreparationStop={parentId,actorId}
 try{replay()}catch(error){const prepared=error&&typeof error==='object'?nativePreparationStops.get(error):undefined;if(prepared)return prepared;throw error}finally{nativePreparationStop=undefined}
 throw Error('opportunity-sequence:actual-native-preparation-not-reached')
}

const wire=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
interface RawRequest{coverAttackRedirect?:AttackInput['coverAttackRedirect'];mandatory?:true;parentId:string;windowIndex:number;actorTokenId:string;targetTokenId:string;rollMode:'normal'|'advantage'|'disadvantage';position:{x:number;y:number};originalAction:SharedPlayerActionState}
type Preceding=readonly{actorTokenId:string;rolls:Dnd5eOpportunitySequenceChoice}[]
const rawRequests=new WeakMap<object,{prepared:PreparedSequence;request:RawRequest;preceding:Preceding}>()
type CollectorFact={prepared:PreparedSequence;request:RawRequest;preceding:Preceding;attack:NativeAttackPrepared;originalAttack:NativeAttackPrepared;attacks:Parameters<typeof resolvePreparedDnd5eOpportunityMoveSequence>[0]['attacks']}
const collectorCheckpoints=new WeakMap<object,CollectorFact>()
let collectorObservation:{parentId:string;completed:ReadonlySet<string>}|undefined
/** Mechanical observation only. Completion IDs cannot authorize a die, native
 * choice, cost or room write; the room boundary reads them from its private book. */
export function captureDnd5eOpportunitySequenceCollectorCheckpoint<T>(parentId:string,completedActorIds:readonly string[],replay:()=>T):{status:'collector';checkpoint:object}|{status:'complete';result:T}{
 if(collectorObservation||nativePreparationStop)throw Error('opportunity-sequence:nested-collector-observation')
 if(!parentId||new Set(completedActorIds).size!==completedActorIds.length)throw Error('opportunity-sequence:exact-collector-scope-required')
 collectorObservation={parentId,completed:new Set(completedActorIds)}
 try{return{status:'complete',result:replay()}}catch(error){if(error&&typeof error==='object'&&collectorCheckpoints.has(error))return{status:'collector',checkpoint:error};throw error}finally{collectorObservation=undefined}
}
export function readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(checkpoint:unknown){
 const fact=checkpoint&&typeof checkpoint==='object'?collectorCheckpoints.get(checkpoint):undefined,host=getRoomSession()
 if(!fact||host?.role!=='dm'||issued.get(fact.prepared)!==wire(fact.prepared))throw Error('opportunity-sequence:actual-native-collector-required')
 return cloneDnd5eHostTransactionInput({request:fact.request,attack:fact.attack,source:{prepared:fact.prepared,attacks:fact.attacks},preceding:fact.preceding})
}

/** Requires the actual issued collector; no snapshot or prepared DTO can issue a replacement preview. */
export function prepareCapturedDnd5eOpportunitySequenceCollectorRedirect(checkpoint:object,use:NonNullable<AttackInput['coverAttackRedirect']>){readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(checkpoint);const fact=collectorCheckpoints.get(checkpoint);if(!fact)throw Error('opportunity-sequence:actual-native-collector-required');const preview=prepareDnd5eOpportunityRedirectFromPrepared(fact.originalAttack,use);if(!preview.ok)throw Error('opportunity-sequence:native-cover-preview-rejected:'+preview.reason);return{...preview.prepared,state:cloneDnd5eHostTransactionInput(fact.attack.state)}}

/** Derive the actual original pool only after the native pre-original choices.
 * The local ward evaluation can prove that no attack die is needed; its
 * unused ordinary attack face is never registered, retained or published. */
export function prepareDnd5eOpportunitySequenceCollectorOriginal(checkpoint:object,choices:Pick<AttackInput,'tranquilitySave'|'areaAttackAdvantageReaction'|'disadvantageNegationChoice'|'coverAttackRedirect'>):{status:'no-original-required'}|{status:'raw-required';rawCheckpoint:object;mode:'normal'|'advantage'|'disadvantage'}{
 const fact=collectorCheckpoints.get(checkpoint)
 readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(checkpoint)
 if(!fact||!choices||typeof choices!=='object'||Object.keys(choices).some(key=>!['tranquilitySave','areaAttackAdvantageReaction','disadvantageNegationChoice','coverAttackRedirect'].includes(key)))throw Error('opportunity-sequence:actual-pre-original-choices-required')
 let attack=choices.coverAttackRedirect?prepareCapturedDnd5eOpportunitySequenceCollectorRedirect(checkpoint,choices.coverAttackRedirect):cloneDnd5eHostTransactionInput(fact.attack)
 if(choices.areaAttackAdvantageReaction)attack.areaAttackAdvantageReaction=cloneDnd5eHostTransactionInput(choices.areaAttackAdvantageReaction)
 if(attack.tranquilityWard){
  const gate=resolvePreparedDnd5eOpportunityAttack({prepared:attack,...cloneDnd5eHostTransactionInput(choices),d20:1,damageRolls:[],transactionId:fact.request.parentId+':collector-ward:'+fact.request.windowIndex,transactionNow:fact.prepared.input.firstHostNow})
  if(!gate.result.ok)throw Error('opportunity-sequence:native-pre-original-gate-rejected:'+gate.result.reason)
  if(gate.result.events.some(event=>event.type==='hostile-targeting-prevented'&&event.actorId===fact.request.actorTokenId&&event.targetId===attack.targetToken.id))return{status:'no-original-required'}
 }
 if(choices.disadvantageNegationChoice)attack=stageDnd5eOpportunityNegation(attack,choices.disadvantageNegationChoice,choices.tranquilitySave?.rerollD20!=null?1:0)
 const mode=dnd5eOpportunityAttackModeResolution(attack).mode
 const rawCheckpoint=new OriginalSequenceRawRequired(fact.prepared,{...cloneDnd5eHostTransactionInput(fact.request),...(choices.coverAttackRedirect?{coverAttackRedirect:cloneDnd5eHostTransactionInput(choices.coverAttackRedirect)}:{}),rollMode:mode},fact.preceding)
 return{status:'raw-required',rawCheckpoint,mode}
}

type PostNativeFact={adoptedBaseCompletions:readonly object[];adoptedMovementCompletions:readonly object[];originalD20Replay?:OriginalD20ReplayFacts;prepared:PreparedSequence;request:RawRequest;preceding:Preceding;attacks:Parameters<typeof resolvePreparedDnd5eOpportunityMoveSequence>[0]['attacks'];beforeState:NativeAttackPrepared['state'];resolved:ReturnType<typeof resolvePreparedDnd5eOpportunityAttack>}
/** A mechanical transcript is captured only at the actual canonical return,
 * after native execution. It issues no controller, raw, or Room permission. */
function captureActualMoveOriginalReplay(input:{prepared:PreparedSequence},resolved:ReturnType<typeof resolvePreparedDnd5eOpportunityAttack>){
 const result=resolved.result;if(!result.ok||!result.events.some(event=>event.type==='attack-resolved'&&stormFuryMoveRequiresCanonicalSequence(result.state,event.targetId)))return undefined
 const context=preparedOriginalD20Replay(input),replay=validateOriginalD20ReplayFacts(context.binding,context.parentId,input.prepared.state,context.command)
 if(replay&&replay.effectTimestamp!==input.prepared.input.firstHostNow)throw Error('storm-fury-move-prefix:exact-original-clock-required')
 return replay
}
const postNativeCheckpoints=new WeakMap<object,PostNativeFact>()
let postNativeObservation:{parentId:string;completions:readonly object[];concentrationOriginals?:readonly object[]}|undefined
/** Observe only the actual synchronous attack facade return, before its state
 * advances the original movement. No snapshot supplied by the caller enters. */
export function captureDnd5eOpportunitySequencePostNativeCheckpoint<T>(parentId:string,replay:()=>T,completions:readonly object[]=[],concentrationOriginals:readonly object[]=[]):{status:'post-native';checkpoint:object}|{status:'complete';result:T}{
 if(postNativeObservation)throw Error('opportunity-sequence:nested-post-native-observation')
 postNativeObservation={parentId,completions,concentrationOriginals}
 try{return{status:'complete',result:replay()}}catch(error){if(error&&typeof error==='object'&&postNativeCheckpoints.has(error))return{status:'post-native',checkpoint:error};throw error}finally{postNativeObservation=undefined}
}
export function readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint:object){
 const fact=postNativeCheckpoints.get(checkpoint),host=getRoomSession()
 if(!fact||host?.role!=='dm'||issued.get(fact.prepared)!==wire(fact.prepared)||!fact.resolved.result.ok||!fact.resolved.application)throw Error('opportunity-sequence:actual-native-postfix-required')
 return cloneDnd5eHostTransactionInput({request:fact.request,source:{prepared:fact.prepared,attacks:fact.attacks},preceding:fact.preceding,beforeState:fact.beforeState,resolved:fact.resolved})
}

class OriginalSequenceRawRequired extends Error{
 constructor(prepared:PreparedSequence,request:RawRequest,preceding:Preceding){super('opportunity-sequence:actual-original-roll-required:'+request.actorTokenId);rawRequests.set(this,{prepared,request:cloneDnd5eHostTransactionInput(request),preceding:cloneDnd5eHostTransactionInput(preceding)})}
}
/** A mechanical request fact, not an authenticated PC contribution or a server
 * raw issuer. Fabricated errors cannot provide one through this reader. */
export function readDnd5eOpportunitySequenceRawRequest(error:unknown){return error&&typeof error==='object'&&rawRequests.has(error)?cloneDnd5eHostTransactionInput(rawRequests.get(error)!.request):undefined}
/** Only an actual missing-raw interruption from this exact Host preparer may
 * supply a next-original source. No caller-supplied window, snapshot or actor
 * is promoted into this capability. */
export function readDnd5eOpportunitySequenceRawSource(prepared:PreparedSequence,error:unknown){
 const host=getRoomSession(),pending=error&&typeof error==='object'?rawRequests.get(error):undefined
 if(host?.role!=='dm'||!pending||pending.prepared!==prepared||issued.get(prepared)!==wire(prepared))throw Error('opportunity-sequence:actual-host-raw-checkpoint-required')
 return cloneDnd5eHostTransactionInput({prepared,pending:pending.request,preceding:pending.preceding})
}
/** The real replay may reconstruct a fresh native preparer after reloading a
 * private parent. Its typed interruption itself retains that exact preparer;
 * a caller cannot substitute a JSON window or a different original. */
export function readCapturedDnd5eOpportunitySequenceRawSource(error:unknown){
 const pending=error&&typeof error==='object'?rawRequests.get(error):undefined
 if(!pending)throw Error('opportunity-sequence:actual-host-raw-checkpoint-required')
 return readDnd5eOpportunitySequenceRawSource(pending.prepared,error)
}

/** Mechanical original-path replay only. This module intentionally issues no
 * room/raw receipt, private capability, snapshot replacement, or write plan. */
export function prepareDnd5eOpportunityMoveSequence(input:OpportunityMoveSequenceInput){
 if(!input.action.combatId)return{ok:false as const,reason:'active-original-combat-required'}
 const mover=input.turnEconomyByToken[input.action.actorTokenId]
 if(!mover||!Number.isSafeInteger(input.firstHostNow)||input.firstHostNow<1)return {ok:false as const,reason:'original-move-economy-and-time-required'}
 const move=prepareDnd5ePlayerMove({action:input.action,map:input.map,characters:input.characters,initiativeOrder:input.initiativeOrder,turnEconomy:mover})
 if(!move.ok)return move
 for(const[id,actor]of Object.entries(move.prepared.state.combatants)){
  const economy=input.turnEconomyByToken[id]
  if(!economy)return{ok:false as const,reason:'complete-original-economies-required'}
  actor.turn={actionAvailable:economy.action.current>0,bonusActionAvailable:economy.bonusAction.current>0,reactionAvailable:economy.reaction.current>0,movementRemaining:economy.movement.current}
 }
 const prepared={action:cloneDnd5eHostTransactionInput(input.action),map:cloneDnd5eHostTransactionInput(input.map),characters:cloneDnd5eHostTransactionInput(input.characters),state:cloneDnd5eHostTransactionInput(move.prepared.state),characterIdByCombatantId:cloneDnd5eHostTransactionInput(move.prepared.characterIdByCombatantId),input:cloneDnd5eHostTransactionInput(input),initial:move.prepared}
 issued.set(prepared,wire(prepared))
 return{ok:true as const,prepared}
}

type MovementFact={source:{prepared:PreparedSequence;attacks:Readonly<Record<string,Dnd5eOpportunitySequenceChoice>>};request:{parentId:string;segmentIndex:number;originalAction:SharedPlayerActionState};preceding:readonly{actorTokenId:string;rolls:Dnd5eOpportunitySequenceChoice}[];beforeState:PreparedSequence['initial']['state'];resolved:ReturnType<typeof resolvePreparedDnd5ePlayerMove>;movement:Parameters<typeof resolvePreparedDnd5ePlayerMove>[0]['prepared']}
const movementCheckpoints=new WeakMap<object,MovementFact>();let movementObservation:{parentId:string;completions:readonly object[];originals:readonly object[];concentrationOriginals:readonly object[]}|undefined
export function captureDnd5eOpportunitySequenceMovementCheckpoint<T>(parentId:string,replay:()=>T,completions:readonly object[]=[],originals:readonly object[]=[],concentrationOriginals:readonly object[]=[]){if(movementObservation)throw Error('opportunity-sequence:movement-observation-busy');movementObservation={parentId,completions,originals,concentrationOriginals};try{return{status:'complete' as const,result:replay()}}catch(error){if(error&&typeof error==='object'&&movementCheckpoints.has(error))return{status:'movement' as const,checkpoint:error};throw error}finally{movementObservation=undefined}}
export function readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint:object){const fact=movementCheckpoints.get(checkpoint),host=getRoomSession();if(!fact||host?.role!=='dm'||issued.get(fact.source.prepared)!==wire(fact.source.prepared))throw Error('opportunity-sequence:actual-native-movement-required');return cloneDnd5eHostTransactionInput(fact)}
export function resolvePreparedDnd5eOpportunityMoveSequence(input:{prepared:PreparedSequence;attacks:Readonly<Record<string,Dnd5eOpportunitySequenceChoice>>}){
 if(issued.get(input.prepared)!==wire(input.prepared))throw Error('opportunity-sequence:exact-native-preparer-required')
 const source=cloneDnd5eHostTransactionInput(input.prepared),original=source.input
 let map=original.map,characters=original.characters,state=source.initial.state,economies={...original.turnEconomyByToken}
 const adoptedBaseCompletions:object[]=[],adoptedMovementCompletions:object[]=[]
  const events:Dnd5eActionResult['events'][number][]=[],handled=new Set<string>(),attacks:string[]=[]
 let segment=0,stopped:string|undefined,lastResult:Dnd5eActionResult|undefined
 const projectEconomies=()=>{economies=Object.fromEntries(Object.entries(economies).map(([id,before])=>{const actor=state.combatants[id];return[id,actor?projectDnd5eHeadlessTurnEconomy(before,actor.turn,Math.max(actor.speed,dnd5eEffectiveSpeed(actor))):before]}))}
 const adopt=(resolved:{result:Dnd5eActionResult;application?:ReturnType<typeof planDnd5eMapResultApplication>})=>{
  if(!resolved.result.ok||!resolved.application)throw Error('opportunity-sequence:actual-facade-result-required')
  lastResult=resolved.result;state=resolved.result.state;map=resolved.application.map;characters=resolved.application.characters;events.push(...resolved.result.events);projectEconomies()
 }
 while(segment<=original.map.tokens.length+1){
  const mover=map.tokens.find(token=>token.id===original.action.actorTokenId),actor=state.combatants[original.action.actorTokenId]
  if(!mover||!actor)throw Error('opportunity-sequence:original-mover-required')
  if(actor.currentHp<=0&&!dnd5eCanActAtZeroHitPoints(actor)){stopped='mover-defeated';break}
  const planned=prepareDnd5ePlayerMove({action:original.action,map,characters,initiativeOrder:original.initiativeOrder,turnEconomy:economies[mover.id]})
  if(!planned.ok){stopped=planned.reason;break}
  const windows=findDnd5eOpportunityWindowsForMove({map,characters,movingToken:mover,to:planned.prepared.to,path:planned.prepared.path,pathElevationsFeet:planned.prepared.pathElevationsFeet,toElevationFeet:planned.prepared.toElevationFeet,turnEconomyByToken:economies,movementMode:original.action.dnd5eTraversalMode??'walk',combatContext:{combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:original.initiativeOrder,active:true}})
  const window=windows.find(row=>!handled.has(row.attacker.id)),destination=window?.position??{...planned.prepared.to,elevationFeet:planned.prepared.toElevationFeet}
  const segmentAction={...original.action,id:original.action.id+':sequence-segment:'+segment,targetPosition:{x:destination.x,y:destination.y},targetElevationFeet:destination.elevationFeet}
  const partial=prepareDnd5ePlayerMove({action:segmentAction,map,characters,initiativeOrder:original.initiativeOrder,turnEconomy:economies[mover.id]})
  if(!partial.ok){stopped=partial.reason;break}
  // State comes exclusively from the previous real facade in this invocation.
  // There is no caller-supplied continuation snapshot to sign or adopt.
  const beforeMovement=cloneDnd5eHostTransactionInput(state),resolvedMovement=resolvePreparedDnd5ePlayerMove({prepared:{...partial.prepared,state:cloneDnd5eHostTransactionInput(state)},transactionId:segmentAction.id},{now:original.firstHostNow})
  if(movementObservation?.parentId===original.action.id){
   if(!resolvedMovement.result.ok||!resolvedMovement.application)throw Error('opportunity-sequence:actual-movement-result-required')
   const checkpoint=new Error('opportunity-sequence:actual-movement-hazards-required')
   movementCheckpoints.set(checkpoint,{source:{prepared:input.prepared,attacks:cloneDnd5eHostTransactionInput(input.attacks)},request:{parentId:original.action.id,segmentIndex:segment,originalAction:cloneDnd5eHostTransactionInput(original.action)},preceding:attacks.map(actorTokenId=>({actorTokenId,rolls:cloneDnd5eHostTransactionInput(input.attacks[actorTokenId])})),beforeState:beforeMovement,resolved:resolvedMovement,movement:resolvedMovement.prepared??partial.prepared})
    const operations=[...movementObservation.originals.map(frame=>({kind:'item'as const,frame,fact:readDnd5eSequenceMovementOriginalReplayFacts(frame)})),...movementObservation.concentrationOriginals.map(frame=>({kind:'concentration'as const,frame,fact:readDnd5eSequenceMovementConcentrationOriginalReplayFacts(frame)}))].filter(row=>row.fact.segmentIndex===segment).sort((a,b)=>a.fact.operationIndex-b.fact.operationIndex||(a.kind==='item'?0:1)-(b.kind==='item'?0:1)||(a.kind==='concentration'&&b.kind==='concentration'?a.fact.checkIndex-b.fact.checkIndex:0))
    for(const row of operations){if(row.kind==='item'){if(row.fact.stage==='result')throwDnd5eSequenceMovementOriginalResult(row.frame,checkpoint);observeDnd5eSequenceMovementOriginal(row.frame,checkpoint)}else{if(row.fact.stage==='result')throwDnd5eSequenceMovementConcentrationOriginalResultAtMovement(row.frame,checkpoint);observeDnd5eSequenceMovementConcentrationOriginalAtMovement(row.frame,checkpoint)}}
   let completed:ReturnType<typeof readBountifulOpportunitySequenceMovementCompletion>,completedCap:object|undefined
   for(const cap of movementObservation.completions){const actual=readBountifulOpportunitySequenceMovementCompletion(cap,checkpoint);if(actual){if(completed)throw Error('opportunity-sequence:duplicate-real-movement-completion');completed=actual;completedCap=cap}}
   if(!completed||!completedCap)throw checkpoint
   adopt(completed);adoptedMovementCompletions.push(completedCap)
   const arrived=state.combatants[mover.id]
   if(!arrived||arrived.position.x!==destination.x||arrived.position.y!==destination.y){stopped='movement-hazard';break}
  }else adopt(resolvedMovement)
  segment++
  if(!window)break
  const opportunity=prepareDnd5eOpportunityAttack({combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,map,characters,initiativeOrder:original.initiativeOrder,actorTokenId:window.attacker.id,targetTokenId:mover.id,turnEconomy:economies[window.attacker.id],targetTurnEconomy:economies[mover.id]})
  if(!opportunity.ok){stopped=opportunity.reason;break}
  if(collectorObservation?.parentId===original.action.id&&!collectorObservation.completed.has(window.attacker.id)){
   const target=map.tokens.find(token=>token.id===mover.id);if(!target)throw Error('opportunity-sequence:actual-collector-mover-required')
   const checkpoint=new Error('opportunity-sequence:actual-native-collector-required')
   collectorCheckpoints.set(checkpoint,{prepared:input.prepared,request:{...(opportunity.prepared.mandatory?{mandatory:true as const}:{}),parentId:original.action.id,windowIndex:attacks.length,actorTokenId:window.attacker.id,targetTokenId:mover.id,rollMode:dnd5eOpportunityAttackModeResolution(opportunity.prepared).mode,position:{x:target.x,y:target.y},originalAction:cloneDnd5eHostTransactionInput(original.action)},preceding:attacks.map(actorTokenId=>({actorTokenId,rolls:cloneDnd5eHostTransactionInput(input.attacks[actorTokenId])})),originalAttack:opportunity.prepared,attack:{...opportunity.prepared,state:cloneDnd5eHostTransactionInput(state)},attacks:cloneDnd5eHostTransactionInput(input.attacks)})
   throw checkpoint
  }
  if(nativePreparationStop?.parentId===original.action.id&&nativePreparationStop.actorId===window.attacker.id){const stop=new Error('opportunity-sequence:native-preparation-observed');nativePreparationStops.set(stop,{...opportunity.prepared,state:cloneDnd5eHostTransactionInput(state)});throw stop}
  const choices=input.attacks[window.attacker.id]
  if(!choices){const target=map.tokens.find(token=>token.id===mover.id);if(!target)throw Error('opportunity-sequence:actual-window-mover-required');throw new OriginalSequenceRawRequired(input.prepared,{parentId:original.action.id,windowIndex:attacks.length,actorTokenId:window.attacker.id,targetTokenId:mover.id,rollMode:dnd5eOpportunityAttackModeResolution(opportunity.prepared).mode,position:{x:target.x,y:target.y},originalAction:original.action},attacks.map(actorTokenId=>({actorTokenId,rolls:input.attacks[actorTokenId]})))}
  if('reactionDecision'in choices){
   if(choices.reactionDecision!=='decline'||Object.keys(choices).length!==1)throw Error('opportunity-sequence:exact-decline-choice-required')
   if(opportunity.prepared.mandatory)throw Error('opportunity-sequence:mandatory-opportunity-cannot-decline')
   // A genuine declined window is handled without an attack, die or reaction
   // expense. The separate room authority verifies its actual owner decision.
   handled.add(window.attacker.id);attacks.push(window.attacker.id);continue
  }
  const redirected=choices.coverAttackRedirect?prepareDnd5eOpportunityRedirectFromPrepared(opportunity.prepared,choices.coverAttackRedirect):opportunity
  if(!redirected.ok)throw Error('opportunity-sequence:native-cover-preview-rejected:'+redirected.reason)
  const beforeAttack=cloneDnd5eHostTransactionInput(state),resolvedAttack=resolvePreparedDnd5eOpportunityAttack({...choices,prepared:{...redirected.prepared,state:cloneDnd5eHostTransactionInput(state)},transactionNow:original.firstHostNow,transactionId:original.action.id+':sequence-opportunity:'+attacks.length+':'+window.attacker.id})
  if(furyPrefixExecution?.parentId===original.action.id&&furyPrefixExecution.windowIndex===attacks.length&&furyPrefixExecution.actorId===window.attacker.id){
    if(!resolvedAttack.result.ok||!resolvedAttack.application)throw Error('storm-fury-move-prefix:actual-native-result-required')
    const result={result:resolvedAttack.result,application:resolvedAttack.application,attacks:[...attacks,window.attacker.id],stopped:'storm-fury-prefix',originalAction:cloneDnd5eHostTransactionInput(original.action)}
    const receipt=registerDnd5eHostReceipt(Object.freeze({}));furyPrefixResults.set(receipt,{proof:furyPrefixExecution,signature:JSON.stringify(result)})
    Object.defineProperty(result,furyPrefixResultSlot,{value:receipt,enumerable:false});return result
   }
   if(postNativeObservation?.parentId===original.action.id){
   if(!resolvedAttack.result.ok||!resolvedAttack.application)throw Error('opportunity-sequence:actual-postfix-result-required')
   const target=map.tokens.find(token=>token.id===mover.id);if(!target)throw Error('opportunity-sequence:actual-postfix-mover-required')
   const checkpoint=new Error('opportunity-sequence:actual-native-postfix-required')
   postNativeCheckpoints.set(checkpoint,{adoptedBaseCompletions:[...adoptedBaseCompletions],adoptedMovementCompletions:[...adoptedMovementCompletions],originalD20Replay:captureActualMoveOriginalReplay(input,resolvedAttack),prepared:input.prepared,request:{parentId:original.action.id,windowIndex:attacks.length,actorTokenId:window.attacker.id,targetTokenId:mover.id,rollMode:dnd5eOpportunityAttackModeResolution(opportunity.prepared).mode,position:{x:target.x,y:target.y},originalAction:cloneDnd5eHostTransactionInput(original.action)},preceding:attacks.map(actorTokenId=>({actorTokenId,rolls:cloneDnd5eHostTransactionInput(input.attacks[actorTokenId])})),attacks:cloneDnd5eHostTransactionInput(input.attacks),beforeState:beforeAttack,resolved:resolvedAttack})
    for(const frame of postNativeObservation.concentrationOriginals??[]){const operation=readDnd5eSequenceConcentrationOriginalReplayFacts(frame);if(operation.windowIndex===attacks.length){if(operation.stage==='result')throwDnd5eSequenceConcentrationOriginalResult(frame,checkpoint);observeDnd5eSequenceConcentrationOriginal(frame,checkpoint)}}
   let completed:ReturnType<typeof readBountifulOpportunitySequencePostNativeCompletion>,completedCap:object|undefined
   for(const completion of postNativeObservation.completions){const material=readBountifulOpportunitySequencePostNativeCompletion(completion,checkpoint);if(material){if(completed)throw Error('opportunity-sequence:duplicate-real-postfix-completion');completed=material;completedCap=completion}}
   if(completed&&completedCap){adopt(completed);adoptedBaseCompletions.push(completedCap);handled.add(window.attacker.id);attacks.push(window.attacker.id);continue}
   throw checkpoint
  }
  adopt(resolvedAttack)
  handled.add(window.attacker.id);attacks.push(window.attacker.id)
 }
 if(segment>original.map.tokens.length+1)throw Error('opportunity-sequence:finite-native-windows-required')
 const result:Dnd5eActionResult=lastResult?{...lastResult,state:cloneDnd5eHostTransactionInput(state),events}:{ok:false,state:cloneDnd5eHostTransactionInput(state),events,reason:'invalid-target'}
 return{result,application:planDnd5eMapResultApplication({state:result.state,map:original.map,characters:original.characters,characterIdByCombatantId:source.initial.characterIdByCombatantId,events}),attacks,stopped,originalAction:cloneDnd5eHostTransactionInput(original.action)}
}

/** Canonical reconstruction for the existing private prepared-parent codec.
 * This pure facade validates every frozen input against the real native
 * preparer; only the separate typed missing-raw capability can issue a pool. */
export function resolveDnd5eOpportunityMoveSequenceOriginal(input:Parameters<typeof resolvePreparedDnd5eOpportunityMoveSequence>[0]){
 const fresh=prepareDnd5eOpportunityMoveSequence(input.prepared.input)
 if(!fresh.ok||wire(fresh.prepared)!==wire(input.prepared))throw Error('opportunity-sequence:canonical-original-required')
 const caps=readBountifulOpportunitySequencePostNativeReplay(input),movementCaps=readBountifulOpportunitySequenceMovementReplay(input),concentrationOriginals=readBountifulOpportunitySequenceConcentrationOriginalReplay(input),movementOriginals=readBountifulOpportunitySequenceMovementOriginalReplay(input),movementConcentrationOriginals=readBountifulOpportunitySequenceMovementConcentrationOriginalReplay(input)
 const run=()=>{const previous=furyPrefixExecution;furyPrefixExecution=readActualFuryMovePrefix(input);try{return resolvePreparedDnd5eOpportunityMoveSequence({...input,prepared:fresh.prepared})}finally{furyPrefixExecution=previous}}
 const post=()=>{if(caps&&!postNativeObservation){const observed=captureDnd5eOpportunitySequencePostNativeCheckpoint(input.prepared.action.id,()=>{postNativeObservation!.concentrationOriginals=concentrationOriginals;return run()},caps);if(observed.status==='post-native')throw observed.checkpoint;return observed.result}return run()}
 return withDnd5eOriginalD20PauseTarget(request=>bountifulSequenceConcentrationOriginalTargetActive(input,request)!==false,()=>{
  if((movementCaps?.length||movementOriginals?.length||movementConcentrationOriginals?.length)&&!movementObservation){const observed=captureDnd5eOpportunitySequenceMovementCheckpoint(input.prepared.action.id,post,movementCaps,movementOriginals,movementConcentrationOriginals);if(observed.status==='movement')throw observed.checkpoint;return observed.result}
  return post()
 })
}

const furyPrefixSlot=Symbol('actual-storm-fury-move-prefix'),furyPrefixResultSlot=Symbol('actual-storm-fury-move-prefix-result')
registerDnd5eHostReceiptSlot(furyPrefixSlot);registerDnd5eHostReceiptSlot(furyPrefixResultSlot)
type FuryPrefixProof={checkpoint:object;parentId:string;windowIndex:number;actorId:string;prepared:PreparedSequence;signature:string;source:object;roomId:string;memberId:string}
const furyPrefixInputs=new WeakMap<object,FuryPrefixProof>(),furyPrefixResults=new WeakMap<object,{proof:FuryPrefixProof;signature:string}>()
let furyPrefixExecution:FuryPrefixProof|undefined
function readActualFuryMovePrefix(input:object){const receipt=(input as Record<symbol,unknown>)[furyPrefixSlot];if(receipt===undefined)return undefined;const proof=receipt&&typeof receipt==='object'?furyPrefixInputs.get(receipt):undefined,host=getRoomSession();if(!proof||host?.role!=='dm'||proof.roomId!==host.roomId||proof.memberId!==host.memberId||proof.signature!==JSON.stringify(input)||!dnd5eActualOpportunityMovePreparationCurrent(proof.prepared))throw Error('storm-fury-move-prefix:exact-live-native-source-required');readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(proof.checkpoint);return proof}
/** Only an actual post-OA native checkpoint can issue this mechanical prefix.
 * It is not a Room/raw/world permission and has no JSON restoration path. */
export function prepareStormFuryMoveNativePrefix(checkpoint:object){
 readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint);const fact=postNativeCheckpoints.get(checkpoint)!,host=getRoomSession()!,fresh=prepareDnd5eOpportunityMoveSequence(fact.prepared.input)
 if(!fresh.ok||wire(fresh.prepared)!==wire(fact.prepared))throw Error('storm-fury-move-prefix:exact-native-repreparation-required')
 const prefixActors=[...fact.preceding.map(row=>row.actorTokenId),fact.request.actorTokenId],prefixAttacks:Record<string,Dnd5eOpportunitySequenceChoice>={}
  for(const actorTokenId of prefixActors){const choice=fact.attacks[actorTokenId];if(!choice)throw Error('storm-fury-move-prefix:exact-executed-attack-required');prefixAttacks[actorTokenId]=cloneDnd5eHostTransactionInput(choice)}
  const plainSource={prepared:fresh.prepared,attacks:prefixAttacks,transactionId:fact.request.parentId,...(fact.originalD20Replay?{hostOriginalD20Replay:cloneDnd5eHostTransactionInput(fact.originalD20Replay)}:{})},receipt=registerDnd5eHostReceipt(Object.freeze({})),source=fact.adoptedBaseCompletions.length||fact.adoptedMovementCompletions.length?withBountifulOpportunitySequencePostNativeReplay(plainSource,issueBountifulOpportunitySequencePostNativeReplay(fresh.prepared,fact.adoptedBaseCompletions,fact.adoptedMovementCompletions)):plainSource,proof={checkpoint,parentId:fact.request.parentId,windowIndex:fact.request.windowIndex,actorId:fact.request.actorTokenId,prepared:fresh.prepared,signature:JSON.stringify(source),source,roomId:host.roomId,memberId:host.memberId}
 furyPrefixInputs.set(receipt,proof);Object.defineProperty(source,furyPrefixSlot,{value:receipt,enumerable:false})
 // Establish the actual pre-Fury baseline independently before any owner
 // callback. Earlier unrepresented Base/hazard effects must fail closed,
 // rather than silently disappear when this fresh native prefix is replayed.
 const baseline=withStormFuryHitCheckpoints(()=>undefined,()=>{
  if(!fact.originalD20Replay)return resolveDnd5eOpportunityMoveSequenceOriginal(source)
  const session=createDnd5ePreparedDamageCommitSession(source,resolveDnd5eOpportunityMoveSequenceOriginal,()=>false)
  try{const completed=session.run(source.prepared.state);if(completed.status!=='resolved')throw Error('storm-fury-move-prefix:complete-original-baseline-required');return completed.result}finally{session.cancel()}
 })
 if(JSON.stringify({result:baseline.result,application:baseline.application})!==JSON.stringify({result:fact.resolved.result,application:fact.resolved.application}))throw Error('storm-fury-move-prefix:exact-current-pre-fury-baseline-required')
 return source
}
/** The native Session calls this only to restrict this genuine prefix's offer
 * to its current real occurrence, retaining the ordinary frame counter. */
export function stormFuryMovePrefixAcceptsFrame(input:object,frame:{event:{actorId:string}}){const proof=readActualFuryMovePrefix(input);return!proof||frame.event.actorId===proof.actorId}
export function readStormFuryMovePrefixPlainSource(input:unknown):unknown{
 if(!input||typeof input!=='object')return input;const proof=readActualFuryMovePrefix(input);if(!proof)return input
 const copy=Object.create(Object.getPrototypeOf(input));for(const key of Reflect.ownKeys(input))if(key!==furyPrefixSlot)Object.defineProperty(copy,key,Object.getOwnPropertyDescriptor(input,key)!)
 return cloneDnd5eHostTransactionInput(copy)
}
/** A full signature from the actual canonical return must survive the actual
 * Session clone. A copied result, foreign checkpoint or changed field rejects. */
export function readStormFuryMoveNativePrefixResult(checkpoint:object,result:object){const receipt=(result as Record<symbol,unknown>)[furyPrefixResultSlot],row=receipt&&typeof receipt==='object'?furyPrefixResults.get(receipt):undefined;if(!row||row.proof.checkpoint!==checkpoint||row.signature!==JSON.stringify(result))throw Error('storm-fury-move-prefix:actual-current-native-result-required');readActualFuryMovePrefix(row.proof.source);return true}

/** A derived Base checkpoint is issued only from both actual native objects.
 * The pre-Fury original checkpoint remains unchanged for later Base replay. */
export function deriveStormFuryMoveNativeBaseCheckpoint(checkpoint:object,result:ReturnType<typeof resolveDnd5eOpportunityMoveSequenceOriginal>){
 readStormFuryMoveNativePrefixResult(checkpoint,result);readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint)
 const fact=postNativeCheckpoints.get(checkpoint)!,derived=new Error('storm-fury-move-prefix:actual-native-base-checkpoint')
 postNativeCheckpoints.set(derived,{...fact,resolved:{result:cloneDnd5eHostTransactionInput(result.result),application:cloneDnd5eHostTransactionInput(result.application)}})
 furyDerivedBaseReplay.set(derived,{original:checkpoint,result,originalSignature:JSON.stringify(readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint)),derivedSignature:JSON.stringify(readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(derived))});return derived
}

const furyDerivedBaseReplay=new WeakMap<object,{original:object;result:ReturnType<typeof resolveDnd5eOpportunityMoveSequenceOriginal>;originalSignature:string;derivedSignature:string}>()
/** Only a real Base frame's original binding can name this bridge. Both
 * checkpoint objects remain genuine native issuances; their complete fields,
 * parent/T1/occurrence and the concrete Fury-native receipt are rechecked.
 * A JSON shape, changed result or another real native occurrence rejects. */
export function readStormFuryMoveBaseReplayCheckpoint(actualCheckpoint:object,boundCheckpoint:object):object|undefined{
 const proof=furyDerivedBaseReplay.get(boundCheckpoint);if(!proof)return undefined
 const actual=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(actualCheckpoint),bound=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(boundCheckpoint)
 const expected=actualCheckpoint===boundCheckpoint?proof.derivedSignature:proof.originalSignature
 if(JSON.stringify(actual)!==expected||JSON.stringify(bound)!==proof.derivedSignature)throw Error('storm-fury-move-con:exact-original-and-derived-prefix-required')
 readStormFuryMoveNativePrefixResult(proof.original,proof.result)
 return boundCheckpoint
}
