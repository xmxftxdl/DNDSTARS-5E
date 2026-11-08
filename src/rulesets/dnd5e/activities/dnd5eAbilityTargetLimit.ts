import type{AbilityKey}from'../../../lib/dnd'
/** A deterministic limit from the currently acting creature, bounded by the declaration's hard cap. */
export interface Dnd5eAbilityTargetLimit {ability:AbilityKey;base:number;minimum:number}
export function validDnd5eAbilityTargetLimit(value:unknown,cap:number):value is Dnd5eAbilityTargetLimit{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const v=value as Dnd5eAbilityTargetLimit
 return Object.keys(value).length===3&&Object.keys(value).every(k=>['ability','base','minimum'].includes(k))&&['str','dex','con','int','wis','cha'].includes(v.ability)&&Number.isInteger(v.base)&&v.base>=0&&v.base<=256&&Number.isInteger(v.minimum)&&v.minimum>=0&&v.minimum<=cap
}
export function dnd5eAbilityTargetMaximum(cap:number,limit:Dnd5eAbilityTargetLimit|undefined,abilities:Readonly<Partial<Record<AbilityKey,number>>>|undefined):number{
 if(!limit)return cap
 const score=abilities?.[limit.ability]
 return validDnd5eAbilityTargetLimit(limit,cap)&&typeof score==='number'&&Number.isFinite(score)?Math.max(0,Math.min(cap,Math.max(limit.minimum,limit.base+Math.floor((score-10)/2)))):0
}
