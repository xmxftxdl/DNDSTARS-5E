import type{D20RollMode}from'../../contracts'
export interface ActivityAttackOriginalMissing{readonly activityId?:string;readonly checkId:string;readonly rollId:string;readonly actorId:string;readonly targetId:string;readonly mode:D20RollMode;readonly count:1|2;readonly sides:20}
let active:{error?:Error}|undefined
const issued=new WeakMap<object,ActivityAttackOriginalMissing>()
export const activityAttackOriginalMissingActive=()=>active!==undefined
/** Observes only an actually absent attack formula in this synchronous Native
 * scope. It supplies no values, result, Room source or world permission. */
export function visitActivityAttackOriginalMissing(pool:Omit<ActivityAttackOriginalMissing,'count'|'sides'>){if(!active)return;if(active.error)throw active.error;const request:ActivityAttackOriginalMissing={...pool,count:pool.mode==='normal'?1:2,sides:20},error=new Error('activity-attack-original-required');issued.set(error,structuredClone(request));active.error=error;throw error}
export function withActivityAttackOriginalMissing<T>(run:()=>T):T{const prior=active,scope:{error?:Error}={};active=scope;try{let result:T;try{result=run()}catch(error){throw scope.error??error}if(scope.error)throw scope.error;return result}finally{active=prior}}
export function readActivityAttackOriginalMissing(error:unknown){return error&&typeof error==='object'&&issued.has(error)?structuredClone(issued.get(error)!):undefined}
