import type{ActivitySavingOriginalPool}from'./activitySavingOriginalDice'
export type ActivitySavingOriginalMissing=Omit<ActivitySavingOriginalPool,'values'>&{readonly count:1|2;readonly sides:20}
let active:{error?:Error}|undefined
const issued=new WeakMap<object,ActivitySavingOriginalMissing>()
export const activitySavingOriginalMissingActive=()=>active!==undefined
/** Only a real absent saving slot in the bounded collector scope is observed. */
export function visitActivitySavingOriginalMissing(pool:Omit<ActivitySavingOriginalPool,'values'>){if(!active)return;if(active.error)throw active.error;const request:ActivitySavingOriginalMissing={...pool,count:pool.mode==='normal'?1:2,sides:20},error=new Error('activity-saving-original-required');issued.set(error,structuredClone(request));active.error=error;throw error}
export function withActivitySavingOriginalMissing<T>(run:()=>T):T{const prior=active,scope:{error?:Error}={};active=scope;try{let result:T;try{result=run()}catch(error){throw scope.error??error}if(scope.error)throw scope.error;return result}finally{active=prior}}
export function readActivitySavingOriginalMissing(error:unknown){return error&&typeof error==='object'&&issued.has(error)?structuredClone(issued.get(error)!):undefined}
