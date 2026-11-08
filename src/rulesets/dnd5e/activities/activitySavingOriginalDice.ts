import type{D20RollMode}from'../../contracts'
import type{AbilityKey}from'../../../lib/dnd'
export interface ActivitySavingOriginalPool{readonly activityId?:string;readonly checkId:string;readonly rollId:string;readonly sourceActorId:string;readonly actorId:string;readonly ability:AbilityKey;readonly mode:D20RollMode;readonly values:readonly number[]}
type Reader=(pool:ActivitySavingOriginalPool)=>readonly number[]
let active:Reader|undefined
let observer:((pool:Readonly<ActivitySavingOriginalPool>)=>void)|undefined
let interrupted:((pool:Readonly<ActivitySavingOriginalPool>,error:unknown)=>void)|undefined
const actualInterrupted=new WeakMap<object,Readonly<ActivitySavingOriginalPool>>()
/** Mechanical observation cannot supply an adopted value or issue Room authority. */
export function withActivitySavingOriginalPoolObserver<T>(observe:NonNullable<typeof observer>,run:()=>T,onInterrupted?:NonNullable<typeof interrupted>):T{const prior=observer,priorInterrupted=interrupted;observer=observe;interrupted=onInterrupted;try{return run()}finally{observer=prior;interrupted=priorInterrupted}}
export function readActualInterruptedActivitySavingPool(error:unknown){const pool=error&&typeof error==='object'?actualInterrupted.get(error):undefined;if(!pool)throw Error('activity-saving-original:actual-interrupted-pool-required');return pool}
/** A Native mechanical scope; no physical pool, source or permission is minted. */
export function withActivitySavingOriginalDice<T>(read:Reader,run:()=>T):T{const prior=active;active=read;try{return run()}finally{active=prior}}
export function settleActivitySavingOriginalDice(pool:ActivitySavingOriginalPool){const observed=Object.freeze({...pool,values:Object.freeze([...pool.values])});observer?.(observed);try{return active?active(pool):pool.values}catch(error){if(error&&typeof error==='object'&&!actualInterrupted.has(error))actualInterrupted.set(error,observed);interrupted?.(observed,error);throw error}}

let planning=false,probing=false
/** Synchronous Native recipe ordering only; no die or world result is issued. */
export function withActivitySavingOriginalPlanning<T>(run:()=>T):T{const previous=planning;planning=true;try{return run()}finally{planning=previous}}
export const activitySavingOriginalPlanningActive=()=>planning&&!probing&&active!==undefined
/** Probe the actual saving reader through the ordinary pure preview first.
 * Automatic/immune/willing branches need no pool. The fixed Native scope then
 * settles only the pool actually read, before its conditional formula gate. */
export function probeActivitySavingOriginalPool<T>(run:()=>T):{value:T;pool?:Readonly<ActivitySavingOriginalPool>}{
 if(!activitySavingOriginalPlanningActive())throw Error('activity-saving-original:actual-native-planning-required')
 const previous=active,previousProbe=probing;let pool:Readonly<ActivitySavingOriginalPool>|undefined
 active=value=>{if(pool)throw Error('activity-saving-original:single-preview-pool-required');pool=Object.freeze({...value,values:Object.freeze([...value.values])});return value.values};probing=true
 try{return{value:run(),get pool(){return pool}}}finally{active=previous;probing=previousProbe}
}
