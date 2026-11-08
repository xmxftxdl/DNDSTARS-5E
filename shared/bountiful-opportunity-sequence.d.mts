import type{SecondChanceParentWire}from'../src/lib/secondChanceParentWire'
import type{resolvePreparedDnd5eOpportunityAttack}from'../src/rulesets/dnd5e/opportunityAttackAction'
export type BountifulOpportunityCollectorAttack=Omit<Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0],'prepared'|'transactionId'|'transactionNow'>
export type BountifulOpportunityCollectorOriginalState='reaction-declined'|'no-original-required'|'original-confirmed-no-BL'|'bountiful-original-ready'
export interface BountifulOpportunityCollectorWindow{
 readonly actorId:string
 readonly windowIndex:number
 readonly complete:boolean
 readonly originalState?:BountifulOpportunityCollectorOriginalState
 readonly originalChoices?:Pick<BountifulOpportunityCollectorAttack,'tranquilitySave'|'areaAttackAdvantageReaction'|'disadvantageNegationChoice'|'coverAttackRedirect'>
 readonly mode?:'normal'|'advantage'|'disadvantage'
 readonly decisionInterruptId?:string
 readonly rollCursor?:number
 /** Original native input only; this never includes a Base result or state. */
 readonly completionSource?:SecondChanceParentWire
 readonly postNativeRegistered?:boolean
 readonly postNativeComplete?:boolean
}
export interface BountifulOpportunityCollectorReadFields{
 readonly collectorSource?:SecondChanceParentWire
 readonly collectorCheckpointSource?:SecondChanceParentWire
 readonly movementSegments?:readonly{readonly segmentIndex:number;readonly registered:boolean;readonly complete:boolean;readonly source:SecondChanceParentWire}[]
 readonly collectorWindows?:readonly BountifulOpportunityCollectorWindow[]
}
/** Data-only projections do not certify a native input or a Host capability. */
export function bountifulOpportunitySequenceSourceFacts(wire:unknown):Record<string,unknown>|null
export interface BountifulOpportunitySequenceRawBookRow{actorId:string;values:readonly number[];hostOriginalRollId:string;hostOriginalRollIssuerMode:'dm'|'player';hostOriginalDiceCursor:number}
export function bountifulOpportunitySequenceContinuationFacts(wire:unknown):{transactionId:unknown;attacks:unknown;rawBook:unknown}|null
/** Shape validation never creates a native capability or a room authority. */
export function validBountifulOpportunityCollectorAttack(value:unknown):boolean
export function bountifulOpportunityCollectorContinuationFacts(wire:unknown):ReturnType<typeof bountifulOpportunitySequenceContinuationFacts>
