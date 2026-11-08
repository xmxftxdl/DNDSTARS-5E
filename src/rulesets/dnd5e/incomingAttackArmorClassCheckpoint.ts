import type {AttackResolution} from '../contracts'
import type {Dnd5eCombatEvent,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
export interface IncomingAttackArmorClassFacts {event:Extract<Dnd5eCombatEvent,{type:'attack-resolved'}>;attack:AttackResolution;criticalThreshold?:number;forceHit?:boolean;automaticCritical:boolean}
export interface IncomingAttackArmorClassChoice {featureId:string}
type Listener=(facts:IncomingAttackArmorClassFacts,state:Dnd5eHeadlessCombatState)=>IncomingAttackArmorClassChoice|void
let active:{listener:Listener;interrupted?:boolean;error?:unknown}|undefined
/** The Host calls this only at its genuine final incoming-hit checkpoint. */
export function withIncomingAttackArmorClassCheckpoints<T>(listener:Listener,run:()=>T):T {const previous=active;active={listener};try{return run()}finally{active=previous}}
export function visitIncomingAttackArmorClassCheckpoint(facts:IncomingAttackArmorClassFacts,state:Dnd5eHeadlessCombatState){try{return active?.listener(structuredClone(facts),structuredClone(state))}catch(error){if(active){active.interrupted=true;active.error=error}throw error}}

export function rethrowIncomingAttackArmorClassInterruption(){if(active?.interrupted)throw active.error}
