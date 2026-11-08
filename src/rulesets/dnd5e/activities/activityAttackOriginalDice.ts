import type{D20RollMode}from'../../contracts'
export interface ActivityAttackOriginalPool{readonly activityId?:string;readonly checkId:string;readonly rollId:string;readonly actorId:string;readonly targetId:string;readonly mode:D20RollMode;readonly values:readonly number[]}
type Reader=(pool:ActivityAttackOriginalPool)=>readonly number[]
let active:Reader|undefined
/** Mechanical only. The bounded initial-primary Native observer supplies no
 * physical values, Room family qualification or publication permission. */
export function withActivityAttackOriginalDice<T>(read:Reader,run:()=>T):T{const prior=active;active=read;try{return run()}finally{active=prior}}
export function settleActivityAttackOriginalDice(pool:ActivityAttackOriginalPool){return active?active(pool):pool.values}
