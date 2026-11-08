import type{SavingThrowResolution}from'../contracts'
import type{AbilityKey}from'../../lib/dnd'
import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
export interface FailedSavingThrowOption{featureId:string;amount:number}
export interface FailedSavingThrowFacts{affectedId:string;sourceActorId?:string;ability?:AbilityKey;resolution:SavingThrowResolution;options:readonly FailedSavingThrowOption[]}
export interface FailedSavingThrowChoice{featureId:string}
type Listener=(facts:FailedSavingThrowFacts,state:Dnd5eHeadlessCombatState)=>FailedSavingThrowChoice|undefined
let active:{listener:Listener;interrupted?:boolean;error?:unknown}|undefined
export function withFailedSavingThrowCheckpoints<T>(listener:Listener,run:()=>T):T{const previous=active;active={listener};try{return run()}finally{active=previous}}
/** Only the real saving-throw resolver supplies the failed roll and current source options. */
export function visitFailedSavingThrowCheckpoint(facts:FailedSavingThrowFacts,state:Dnd5eHeadlessCombatState){try{return active?.listener(structuredClone(facts),structuredClone(state))}catch(error){if(active){active.interrupted=true;active.error=error}throw error}}
export function rethrowFailedSavingThrowInterruption(){if(active?.interrupted)throw active.error}
