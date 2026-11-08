import type{AbilityKey}from'../../lib/dnd'
import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
export interface MissingSpellTargetOriginalRequirement{actorId:string;targetId:string;spellId:string;ability:AbilityKey;dc:number;rollMode:'normal'|'advantage'|'disadvantage';requiredDiceCount:1|2}
export interface MissingSpellTargetOriginal{readonly status:'missing-spell-target-original';readonly requirement:Readonly<MissingSpellTargetOriginalRequirement>;readonly snapshot:Dnd5eHeadlessCombatState}
class NativeMissingSpellTargetOriginal extends Error{}
let active:{result?:MissingSpellTargetOriginal;error?:NativeMissingSpellTargetOriginal}|undefined
/** Called at the genuine single-target Spell saving loop after final mode/DC,
 * casting-start, caster saving and earlier resources. No raw value is supplied. */
export function visitMissingSpellTargetOriginal(requirement:MissingSpellTargetOriginalRequirement,state:Dnd5eHeadlessCombatState):void{if(!active)return;active.result=Object.freeze({status:'missing-spell-target-original',requirement:Object.freeze({...requirement}),snapshot:structuredClone(state)});active.error=new NativeMissingSpellTargetOriginal('actual-spell-target-original-missing');throw active.error}
/** Observation only. An ordinary resolver outside this scope is unchanged. */
export function observeMissingSpellTargetOriginal<T>(run:()=>T):T|MissingSpellTargetOriginal{const previous=active,scope:{result?:MissingSpellTargetOriginal;error?:NativeMissingSpellTargetOriginal}={};active=scope;try{const result=run();return scope.result??result}catch(error){if(error===scope.error&&scope.result)return scope.result;throw error}finally{active=previous}}
