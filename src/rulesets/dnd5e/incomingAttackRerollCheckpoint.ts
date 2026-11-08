import type { AttackResolution, D20RollMode } from '../contracts'
import type{DamageRollInput}from'../contracts'
import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
export type IncomingAttackEvent=Extract<Dnd5eCombatEvent,{type:'attack-resolved'}>
export interface IncomingAttackRollFacts {event:IncomingAttackEvent;dice:readonly number[];mode:D20RollMode;modifier:number;criticalThreshold?:number;forceHit?:boolean;automaticCritical?:boolean}
export interface IncomingAttackRerollChoice {featureId:string;dieIndex:number;newD20:number}
type Listener=(facts:IncomingAttackRollFacts,state:Dnd5eHeadlessCombatState)=>IncomingAttackRerollChoice|void
export interface IncomingCriticalDiceRequest{id:string;actorId:string;targetId:string;count:number;sides:number;originalRolls:readonly number[];rollKey?:string}
type SupplementListener=(request:IncomingCriticalDiceRequest)=>readonly number[]
let active:{listener:Listener;supplement?:SupplementListener;upgrade?:{id:string;actorId:string;targetId:string;group:number};rerolled?:{actorId:string;targetId:string};formulaDice?:Map<string,readonly number[]>;dice:Map<string,{dice:readonly number[];mode:D20RollMode}>;error?:unknown;interrupted?:boolean}|undefined
export function withIncomingAttackRerollCheckpoints<T>(listener:Listener,run:()=>T,supplement?:SupplementListener):T{
 const prior=active;active={listener,supplement,dice:new Map()};try{return run()}finally{active=prior}
}
export function recordIncomingAttackDice(actorId:string,dice:readonly number[],mode:D20RollMode){if(active){active.dice.set(actorId,{dice:[...dice],mode});if(active.rerolled?.actorId===actorId)active.rerolled=undefined}}
export function markIncomingAttackWasRerolled(actorId:string,targetId:string){if(active)active.rerolled={actorId,targetId}}
export function incomingAttackWasRerolled(actorId:string,targetId:string){const row=active?.rerolled;return !!row&&row.actorId===actorId&&row.targetId===targetId}
export function visitIncomingAttackRerollCheckpoint(event:IncomingAttackEvent,attack:AttackResolution,state:Dnd5eHeadlessCombatState,context?:{criticalThreshold?:number;forceHit?:boolean;automaticCritical?:boolean}){
 if(!active||!event.hit)return
 const raw=active.dice.get(event.actorId)
 if(!raw)throw Error('incoming-attack:original-dice-unavailable')
 try{const facts={event:structuredClone(event),dice:[...raw.dice],mode:raw.mode,modifier:attack.roll.total-attack.roll.d20,...context};const choice=active.listener(facts,structuredClone(state));return choice?{facts,choice}:undefined}
 catch(error){active.error=error;active.interrupted=true;throw error}
}
export function rethrowIncomingAttackRerollInterruption(){if(active?.interrupted)throw active.error}
export function markIncomingCriticalUpgrade(input?:{id:string;actorId:string;targetId:string}){if(active){active.upgrade=input?{...input,group:0}:undefined;active.formulaDice=new Map()}}
export function incomingAttackHasReplacement(){return !!active?.rerolled}
export function incomingCriticalFormulaRolls():Readonly<Record<string,readonly number[]>>{return Object.fromEntries([...(active?.formulaDice??[])].map(([key,values])=>[key,[...values]]))}
export function isIncomingCriticalUpgrade(){return !!active?.upgrade}
export function incomingCriticalOnlyDice(count:number,sides:number,label:string):readonly number[]|undefined{
 const upgrade=active?.upgrade
 if(!active||!upgrade)return undefined
 if(!Number.isSafeInteger(count)||count<1||count>1000||!Number.isSafeInteger(sides)||sides<2||sides>10000)throw Error('incoming-critical-only-profile-invalid')
 const text=JSON.stringify([upgrade.id,upgrade.group++,label,count,sides])
 let first=2166136261,second=2246822519;for(let index=0;index<text.length;index++){first=Math.imul(first^text.charCodeAt(index),16777619);second=Math.imul(second^text.charCodeAt(index),3266489917)}
 const request:IncomingCriticalDiceRequest={id:`incoming-critical:${(first>>>0).toString(36)}${(second>>>0).toString(36)}`,actorId:upgrade.actorId,targetId:upgrade.targetId,count,sides,originalRolls:[],rollKey:label}
 try{if(!active.supplement)throw Error('incoming-critical-dice-required');const values=active.supplement(request);if(values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('incoming-critical-dice-invalid');return[...values]}catch(error){active.error=error;active.interrupted=true;throw error}
}
/** Only a proven incoming reroll upgrade can open this window. The real damage
 * resolver supplies the count and sides; existing base dice remain unchanged. */
export function supplementIncomingCriticalDamage<T extends DamageRollInput>(input:T,rollKey?:string):T{
 const upgrade=active?.upgrade
 if(!active||!upgrade||!input.critical||input.rolls.length>=input.count*2||input.rolls.length<input.count||input.count<1)return input
 const count=input.count*2-input.rolls.length,ordinal=upgrade.group++
 const text=JSON.stringify([upgrade.id,ordinal,input.count,input.sides,input.rolls,rollKey])
 let first=2166136261,second=2246822519;for(let index=0;index<text.length;index++){first=Math.imul(first^text.charCodeAt(index),16777619);second=Math.imul(second^text.charCodeAt(index),3266489917)}
 const request:IncomingCriticalDiceRequest={id:`incoming-critical:${(first>>>0).toString(36)}${(second>>>0).toString(36)}`,actorId:upgrade.actorId,targetId:upgrade.targetId,count,sides:input.sides,originalRolls:[...input.rolls],rollKey}
 try{if(!active.supplement)throw Error('incoming-critical-dice-required');const extra=active.supplement(request);if(extra.length!==count||extra.some(value=>!Number.isInteger(value)||value<1||value>input.sides))throw Error('incoming-critical-dice-invalid');const values=[...input.rolls,...extra];if(rollKey)active.formulaDice?.set(rollKey,values);return{...input,rolls:values}}
 catch(error){active.error=error;active.interrupted=true;throw error}
}
