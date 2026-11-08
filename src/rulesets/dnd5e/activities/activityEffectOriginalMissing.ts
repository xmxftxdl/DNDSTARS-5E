export interface ActivityEffectOriginalPool{readonly activityId:string;readonly actorId:string;readonly transactionId:string;readonly rolls:readonly{readonly rollId:string;readonly count:number;readonly sides:number;readonly modifier:number}[]}
let active:{error?:Error}|undefined
const issued=new WeakMap<object,Readonly<ActivityEffectOriginalPool>>()
export const activityEffectOriginalMissingActive=()=>active!==undefined
/** A missing formula pool is observed only after the actual Native saving gate
 * has settled its original choices. This scope creates no die or result. */
export function visitActivityEffectOriginalMissing(pool:ActivityEffectOriginalPool){if(!active||!pool.rolls.length)return;if(active.error)throw active.error;const error=new Error('activity-effect-original-required');issued.set(error,structuredClone(pool));active.error=error;throw error}
export function withActivityEffectOriginalMissing<T>(run:()=>T):T{const previous=active,scope:{error?:Error}={};active=scope;try{let result:T;try{result=run()}catch(error){throw scope.error??error}if(scope.error)throw scope.error;return result}finally{active=previous}}
export function readActivityEffectOriginalMissing(error:unknown){return error&&typeof error==='object'&&issued.has(error)?structuredClone(issued.get(error)!):undefined}

type FormulaIdentity=Pick<ActivityEffectOriginalPool,'activityId'|'actorId'|'transactionId'>
let formulaIdentity:FormulaIdentity|undefined
/** Owned by the fixed actual automatic-burst worker, never a Room permit. */
export function withActivityEffectOriginalFormulaIdentity<T>(identity:FormulaIdentity,run:()=>T):T{const prior=formulaIdentity;formulaIdentity=identity;try{return run()}finally{formulaIdentity=prior}}
/** Actual missing formula only, after the real saving outcome selected damage. */
export function visitActivityEffectOriginalFormulaMissing(rollId:string,count:number,sides:number){if(active&&formulaIdentity)visitActivityEffectOriginalMissing({...formulaIdentity,rolls:[{rollId,count,sides,modifier:0}]})}
