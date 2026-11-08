import type{D20RollMode}from'../../contracts'
export interface ActivityAbilityOriginalPool{readonly activityId?:string;readonly checkId:string;readonly rollId:string;readonly actorId:string;readonly skill?:string;readonly mode:D20RollMode;readonly values:readonly number[]}
type Reader=(roll:ActivityAbilityOriginalPool)=>readonly number[]
let active:Reader|undefined
let observer:((pool:Readonly<ActivityAbilityOriginalPool>)=>void)|undefined
const actualInterruptedPools=new WeakMap<object,Readonly<ActivityAbilityOriginalPool>>()
export function readActualInterruptedActivityAbilityPool(error:unknown){const row=error&&typeof error==='object'?actualInterruptedPools.get(error):undefined;if(!row)throw Error('activity-original:actual-interrupted-formula-pool-required');return row}
let interrupted:((pool:Readonly<ActivityAbilityOriginalPool>,error:unknown)=>void)|undefined
/** Mechanical observation only; it cannot supply an adopted value or a grant. */
export function withActivityAbilityOriginalPoolObserver<T>(observe:NonNullable<typeof observer>,run:()=>T,onInterrupted?:NonNullable<typeof interrupted>):T{const prior=observer,priorInterrupted=interrupted;observer=observe;interrupted=onInterrupted;try{return run()}finally{observer=prior;interrupted=priorInterrupted}}
/** A mechanical Native scope only; this module never issues a room source or result. */
export function withActivityAbilityOriginalDice<T>(read:Reader,run:()=>T):T{const previous=active;active=read;try{return run()}finally{active=previous}}
export function settleActivityAbilityOriginalDice(roll:ActivityAbilityOriginalPool){const observed=Object.freeze({...roll,values:Object.freeze([...roll.values])});observer?.(observed);try{return active?active(roll):roll.values}catch(error){if(error&&typeof error==='object'&&!actualInterruptedPools.has(error))actualInterruptedPools.set(error,observed);interrupted?.(observed,error);throw error}}
