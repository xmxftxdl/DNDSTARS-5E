import type{ActivityAbilityOriginalPool}from'./activityAbilityOriginalDice'
export type ActivityAbilityOriginalMissing=Omit<ActivityAbilityOriginalPool,'values'>&{readonly count:1|2;readonly sides:20}
let active:{error?:Error}|undefined
const issued=new WeakMap<object,ActivityAbilityOriginalMissing>()
export const activityAbilityOriginalMissingActive=()=>active!==undefined
/** Only a mechanical collector scope observes a real absent original. Ordinary
 * execution retains its existing invalid-dice behavior and never invents faces. */
export function visitActivityAbilityOriginalMissing(pool:Omit<ActivityAbilityOriginalPool,'values'>){
 if(!active)return
 if(active.error)throw active.error
 const request:ActivityAbilityOriginalMissing={...pool,count:pool.mode==='normal'?1:2,sides:20},error=new Error('activity-ability-original-required')
 issued.set(error,structuredClone(request));active.error=error;throw error
}
export function withActivityAbilityOriginalMissing<T>(run:()=>T):T{const prior=active,scope:{error?:Error}={};active=scope;try{let result:T;try{result=run()}catch(error){throw scope.error??error}if(scope.error)throw scope.error;return result}finally{active=prior}}
export function readActivityAbilityOriginalMissing(error:unknown){return error&&typeof error==='object'&&issued.has(error)?structuredClone(issued.get(error)!):undefined}
