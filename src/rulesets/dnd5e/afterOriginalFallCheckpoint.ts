import type {Dnd5eHeadlessCombatState,Dnd5eUnsupportedAirborneFallPreview,Dnd5eSpellcastingSavingThrowRoll} from './headlessCombatEngine'

export interface Dnd5eAfterOriginalFallRequest {
 actorId:string
 actionSignature:string
 falls:readonly Dnd5eUnsupportedAirborneFallPreview[]
}
export interface Dnd5eAfterOriginalFallChoice {
 featherFalls:readonly {casterId:string;targetIds:readonly string[];spellcastingSavingThrows?:readonly Dnd5eSpellcastingSavingThrowRoll[]}[]
 rollsByCombatantId:Readonly<Record<string,readonly number[]>>
}
type Listener=(request:Dnd5eAfterOriginalFallRequest,state:Dnd5eHeadlessCombatState)=>Dnd5eAfterOriginalFallChoice
let active:{enabled:()=>boolean;listener:Listener;interrupted?:boolean;error?:unknown}|undefined
const settled=new WeakSet<Dnd5eHeadlessCombatState>()
export const dnd5eAfterOriginalFallCheckpointActive=()=>active?.enabled()===true
export function withDnd5eAfterOriginalFallCheckpoints<T>(enabled:()=>boolean,listener:Listener,run:()=>T):T{
 const previous=active;active={enabled,listener}
 try{const result=run();if(active.interrupted)throw active.error;return result}finally{active=previous}
}
export function visitDnd5eAfterOriginalFallCheckpoint(request:Dnd5eAfterOriginalFallRequest,state:Dnd5eHeadlessCombatState){
 if(!active?.enabled())return undefined
 try{return active.listener(structuredClone(request),structuredClone(state))}catch(error){active.interrupted=true;active.error=error;throw error}
}
export function rethrowDnd5eAfterOriginalFallInterruption(){if(active?.interrupted)throw active.error}
export function markDnd5eAfterOriginalFallsSettled(state:Dnd5eHeadlessCombatState){settled.add(state)}
export const dnd5eAfterOriginalFallsWereSettled=(state:Dnd5eHeadlessCombatState)=>settled.has(state)
export function validDnd5eAfterOriginalFallChoice(value:Dnd5eAfterOriginalFallChoice){
 return !!value&&typeof value==='object'&&Object.keys(value).every(key=>key==='featherFalls'||key==='rollsByCombatantId')&&Array.isArray(value.featherFalls)&&value.featherFalls.length<=128&&
 value.featherFalls.every(choice=>!!choice&&typeof choice==='object'&&Object.keys(choice).every(key=>['casterId','targetIds','spellcastingSavingThrows'].includes(key))&&typeof choice.casterId==='string'&&!!choice.casterId&&Array.isArray(choice.targetIds)&&choice.targetIds.length>0&&choice.targetIds.length<=5&&new Set(choice.targetIds).size===choice.targetIds.length&&choice.targetIds.every((id:unknown)=>typeof id==='string'&&!!id))&&
 !!value.rollsByCombatantId&&typeof value.rollsByCombatantId==='object'&&!Array.isArray(value.rollsByCombatantId)&&Object.keys(value.rollsByCombatantId).length<=256&&Object.values(value.rollsByCombatantId).every(rolls=>Array.isArray(rolls)&&rolls.length<=128&&rolls.every(face=>Number.isInteger(face)&&face>=1&&face<=20))
}
export class Dnd5eAfterOriginalFallDecisionRequired extends Error{
 readonly request:Dnd5eAfterOriginalFallRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(request:Dnd5eAfterOriginalFallRequest,state:Dnd5eHeadlessCombatState){super('after-original-fall-decision-required');this.request=structuredClone(request);this.snapshot=structuredClone(state)}
}
