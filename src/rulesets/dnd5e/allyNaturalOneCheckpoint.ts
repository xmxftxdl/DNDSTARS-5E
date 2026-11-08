import{readDnd5eMonsterDamageZeroOriginalContext}from'./monsterDamageZeroOriginalContext'
import {bountifulHostOperationReplayContext} from './bountifulHostOperation'
import {validateBountifulEquipmentD20Receipt,bountifulEquipmentD20ReceiptComplete} from '../../../shared/bountiful-equipment-d20.mjs'
import {validateBountifulDeferredD20Choices} from '../../../shared/bountiful-deferred-d20.mjs'
import type {BountifulDeferredD20Choice,BountifulMechanicalD20Choice,BountifulReadyD20Choice} from './bountifulLuckDeferredD20'
import {validDnd5eAfterOriginalFallChoice,type Dnd5eAfterOriginalFallRequest,type Dnd5eAfterOriginalFallChoice} from './afterOriginalFallCheckpoint'
import type {Dnd5eHeadlessCombatState,Dnd5eCombatEvent} from '../../../src/rulesets/dnd5e/headlessCombatEngine'

export type AllyNaturalOneKind='attack'|'ability-check'|'saving-throw'
export interface AllyNaturalOneRequest {actorId:string;kind:AllyNaturalOneKind;skill?:string;originalRolls:readonly number[];dieIndex:number;nativeLucky?:true;options:readonly {ownerId:string;featureId:string}[]}
export interface AllyNaturalOneDecision {ownerId:string;featureId:string;replacement:number}
type Listener=(request:AllyNaturalOneRequest,state:Dnd5eHeadlessCombatState)=>AllyNaturalOneDecision|undefined
export interface OriginalD20ReadyMetadata {rollMode:'normal'|'advantage'|'disadvantage';attackAbility?:import('../../lib/dnd').AbilityKey}
export interface OriginalD20Ready {ordinal?:number;finalizedDice:readonly number[];rollMode?:OriginalD20ReadyMetadata['rollMode'];attackAbility?:OriginalD20ReadyMetadata['attackAbility'];actorId:string;kind:AllyNaturalOneKind;skill?:string;originalRolls:readonly number[];values:readonly number[]}
type ReadyListener=(request:OriginalD20Ready,state:Dnd5eHeadlessCombatState,events:readonly Dnd5eCombatEvent[])=>readonly BountifulMechanicalD20Choice[]|undefined|void
let active:{listener:Listener;ready?:ReadyListener;recoverNativeLucky:boolean;interrupted?:boolean;error?:unknown}|undefined
export const dnd5eNativeLuckyCheckpointRecoveryActive=()=>active?.recoverNativeLucky===true
let preview=false
let originalPauseTarget:((request:OriginalD20Ready)=>boolean)|undefined
type OriginalReadyTail={stop:(request:OriginalD20Ready,state:Dnd5eHeadlessCombatState,events:readonly Dnd5eCombatEvent[])=>never;error?:unknown;active?:NonNullable<typeof active>;priorInterrupted?:boolean;priorError?:unknown}
let originalReadyTail:OriginalReadyTail|undefined
let originalReadyObserver:((request:OriginalD20Ready,state:Dnd5eHeadlessCombatState,events:readonly Dnd5eCombatEvent[])=>void)|undefined
/** Reads an actual native boundary without supplying choices or issuing state. */
export function withDnd5eOriginalD20ReadyObserver<T>(observe:NonNullable<typeof originalReadyObserver>,run:()=>T):T{const previous=originalReadyObserver;originalReadyObserver=observe;try{return run()}finally{originalReadyObserver=previous}}
export function withDnd5eOriginalD20ReadyTailStop<T>(stop:OriginalReadyTail['stop'],run:()=>T):T{const previous=originalReadyTail,scope:OriginalReadyTail={stop};originalReadyTail=scope;try{const result=run();if(Object.hasOwn(scope,'error'))throw scope.error;return result}finally{if(scope.active&&Object.hasOwn(scope,'error')&&scope.active.error===scope.error){scope.active.interrupted=scope.priorInterrupted;scope.active.error=scope.priorError}originalReadyTail=previous}}
/** Observation ordering only. This scope issues no native result, die,
 * reaction, receipt, or publication permission. */
export function withDnd5eOriginalD20PauseTarget<T>(target:(request:OriginalD20Ready)=>boolean,run:()=>T):T{const previous=originalPauseTarget;originalPauseTarget=target;try{return run()}finally{originalPauseTarget=previous}}
export const dnd5eOriginalD20PauseTargetActive=(request:OriginalD20Ready)=>originalPauseTarget?.(request)??true
export const dnd5eOriginalD20PreviewActive=()=>preview
/** The caller supplies already-adopted faces; this read-only preview never spends a reaction or re-rerolls them. */
export function withOriginalD20Preview<T>(run:()=>T):T{const prior=preview;preview=true;try{return run()}finally{preview=prior}}
export class AllyNaturalOneDecisionRequired extends Error {
  readonly request:AllyNaturalOneRequest
  readonly snapshot:Dnd5eHeadlessCombatState
  constructor(request:AllyNaturalOneRequest,state:Dnd5eHeadlessCombatState){super('ally-natural-one-decision-required');this.request=structuredClone(request);this.snapshot=structuredClone(state)}
}
export function withAllyNaturalOneCheckpoints<T>(listener:Listener,run:()=>T,ready?:ReadyListener,recoverNativeLucky=false):T{
  const previous=active;active={listener,ready,recoverNativeLucky}
  try{const result=run();if(active.interrupted)throw active.error;return result}finally{active=previous}
}
export function visitOriginalD20Ready(request:OriginalD20Ready,state:Dnd5eHeadlessCombatState,events:readonly Dnd5eCombatEvent[]){
  if(preview||!active?.ready&&!originalReadyTail&&!originalReadyObserver)return
  try{originalReadyObserver?.(structuredClone(request),structuredClone(state),structuredClone(events));const retained=active?.ready?.(structuredClone(request),structuredClone(state),structuredClone(events));if(originalReadyTail){const tail=originalReadyTail;tail.active=active;tail.priorInterrupted=active?.interrupted;tail.priorError=active?.error;try{tail.stop(structuredClone(request),structuredClone(state),structuredClone(events))}catch(error){tail.error=error;throw error}}return retained}catch(error){if(active){active.interrupted=true;active.error=error}throw error}
}
export function visitAllyNaturalOneCheckpoint(request:AllyNaturalOneRequest,state:Dnd5eHeadlessCombatState){
  if(!active)throw new AllyNaturalOneDecisionRequired(request,state)
  try{return active.listener(structuredClone(request),structuredClone(state))}catch(error){active.interrupted=true;active.error=error;throw error}
}
export function withRequiredAllyNaturalOneBoundary<T>(run:()=>T):T{
  if(active)return run()
  return withAllyNaturalOneCheckpoints((request,state)=>{throw new AllyNaturalOneDecisionRequired(request,state)},run)
}
export function rethrowAllyNaturalOneInterruption(){if(active?.interrupted)throw active.error}

/** Host-only replay data belongs to a suspended parent input or its execution
 * options. No player action payload supplies this field. Actual mechanics still
 * recheck every request, feature, reaction, and replacement when replayed. */
export interface OriginalD20ReplayFacts{
 parentId:string;sourceKey:string;effectTimestamp?:number
 equipmentD20?:import('./bountifulEquipmentD20Receipt').BountifulEquipmentD20Receipt
 deferredD20Choices?:readonly BountifulDeferredD20Choice[]
 readyFrames?:readonly {frameId:string;request:OriginalD20Ready;choices:readonly BountifulReadyD20Choice[]}[]
 facts:readonly {occurrence:number;request:AllyNaturalOneRequest;decision?:AllyNaturalOneDecision}[]
 afterOriginalFalls?:readonly {occurrence:number;request:Dnd5eAfterOriginalFallRequest;snapshotSignature:string;choice:Dnd5eAfterOriginalFallChoice}[]
}
export function originalD20ReplaySourceKey(parentId:string,state:Dnd5eHeadlessCombatState,command:unknown,effectTimestamp?:number){return JSON.stringify([parentId,state,command,...(effectTimestamp===undefined?[]:[effectTimestamp])])}
export function validateOriginalD20ReplayFacts(value:OriginalD20ReplayFacts|undefined,parentId:string|undefined,state:Dnd5eHeadlessCombatState,command:unknown):OriginalD20ReplayFacts|undefined{
 if(value===undefined)return undefined
 if(value.equipmentD20!==undefined&&(!validateBountifulEquipmentD20Receipt(value.equipmentD20)||!bountifulEquipmentD20ReceiptComplete(value.equipmentD20)||value.equipmentD20.identity.parentId!==value.parentId||value.equipmentD20.identity.combatId!==state.combatId))throw Error('original-d20-replay-equipment-mismatch')
 if(value.deferredD20Choices!==undefined&&!validateBountifulDeferredD20Choices(value.deferredD20Choices,value.parentId))throw Error('original-d20-replay-deferred-facts-mismatch')
 if(value.readyFrames!==undefined){
  if(!Array.isArray(value.readyFrames)||value.readyFrames.length>512||new Set(value.readyFrames.map(row=>row.frameId)).size!==value.readyFrames.length)throw Error('original-d20-replay-ready-frame-mismatch')
  for(const row of value.readyFrames){
   const request=row?.request
   if(!request||!Number.isSafeInteger(request.ordinal)||request.ordinal!<0||!['saving-throw','attack'].includes(request.kind)||!request.actorId||row.frameId!==JSON.stringify(['bountiful-original-ready',value.parentId,request.ordinal,request.actorId,request.kind])||!Array.isArray(request.originalRolls)||request.originalRolls.length<1||request.originalRolls.length>2||request.originalRolls.some((face:number)=>!Number.isInteger(face)||face<1||face>20)||JSON.stringify(request.values)!==JSON.stringify(request.originalRolls)||!Array.isArray(request.finalizedDice)||request.finalizedDice.length||!Array.isArray(row.choices)||row.choices.length>2||new Set(row.choices.map((choice:BountifulReadyD20Choice)=>choice.dieIndex)).size!==row.choices.length)throw Error('original-d20-replay-ready-frame-mismatch')
   for(const choice of row.choices){
    if('sourceOccurrence'in choice||choice.readyFrameId!==row.frameId||choice.parentId!==value.parentId||choice.readyOrdinal!==request.ordinal||choice.actorId!==request.actorId||choice.originalValue!==request.originalRolls[choice.dieIndex])throw Error('original-d20-replay-ready-frame-mismatch')
    const {readyFrameId:_frame,...mechanical}=choice;void _frame
    if(!validateBountifulDeferredD20Choices([{...mechanical,sourceOccurrence:0}],value.parentId))throw Error('original-d20-replay-ready-choice-mismatch')
   }
  }
 }
 const invalidFact=(row:OriginalD20ReplayFacts['facts'][number],index:number)=>!row||row.occurrence!==index||!row.request||!Array.isArray(row.request.originalRolls)||row.request.originalRolls.length<1||row.request.originalRolls.length>2||row.request.originalRolls.some((face:number)=>!Number.isInteger(face)||face<1||face>20)||!Number.isInteger(row.request.dieIndex)||row.request.originalRolls[row.request.dieIndex]!==1||!Array.isArray(row.request.options)||!!row.decision&&(!Number.isInteger(row.decision.replacement)||row.decision.replacement<1||row.decision.replacement>20||!row.request.options.some((option:AllyNaturalOneRequest['options'][number])=>option.ownerId===row.decision?.ownerId&&option.featureId===row.decision.featureId))
 if(value?.effectTimestamp!==undefined&&(!Number.isSafeInteger(value.effectTimestamp)||value.effectTimestamp<=0))throw Error('original-d20-replay-clock-mismatch')
 if(value?.afterOriginalFalls!==undefined&&(!Array.isArray(value.afterOriginalFalls)||value.afterOriginalFalls.length>128||value.afterOriginalFalls.some((row,index)=>!row||row.occurrence!==index||typeof row.snapshotSignature!=='string'||!row.snapshotSignature||!row.request||typeof row.request.actorId!=='string'||typeof row.request.actionSignature!=='string'||!Array.isArray(row.request.falls)||!validDnd5eAfterOriginalFallChoice(row.choice))))throw Error('original-d20-replay-fall-facts-mismatch')
 if(!parentId||!value||value.parentId!==parentId||value.sourceKey!==originalD20ReplaySourceKey(parentId,state,command,value.effectTimestamp)||!Array.isArray(value.facts)||value.facts.length>128||value.facts.some(invalidFact))throw Error('original-d20-replay-source-mismatch')
 return structuredClone(value)
}
export function preparedOriginalD20Replay(input:unknown):{binding?:OriginalD20ReplayFacts;parentId?:string;command?:unknown}{
 if(!input||typeof input!=='object'||!('prepared'in input)||!input.prepared||typeof input.prepared!=='object')return {}
 const attackNative=bountifulHostOperationReplayContext(input),zeroNative=readDnd5eMonsterDamageZeroOriginalContext(input)
 if(attackNative&&zeroNative)throw Error('original-d20-replay:ambiguous-monster-original')
 const native=zeroNative??attackNative
 const action=native?.command??('action'in input.prepared?input.prepared.action:undefined)
 const parentId=native?.parentId??(action&&typeof action==='object'&&'id'in action&&typeof action.id==='string'?action.id:undefined)
 const binding='hostOriginalD20Replay'in input?input.hostOriginalD20Replay as OriginalD20ReplayFacts|undefined:undefined
 return {binding,parentId,command:action}
}

// The original parent probe may suspend at a known raw die before later
// actors have rolled. This scope never applies to the final commit resolver.
let originalParentProbeDepth=0
export const dnd5eOriginalD20ParentProbeActive=()=>originalParentProbeDepth>0
export function withOriginalD20ParentProbe<T>(run:()=>T):T{originalParentProbeDepth++;try{return run()}finally{originalParentProbeDepth--}}
