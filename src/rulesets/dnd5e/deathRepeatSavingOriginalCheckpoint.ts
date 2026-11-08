import type{Dnd5eHeadlessCombatState,Dnd5eCombatEvent}from'./headlessCombatEngine'
import type{Dnd5eActiveEffectInstance}from'./activeEffects'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
export interface Dnd5eDeathRepeatSavingFrame{actorId:string;effect:Dnd5eActiveEffectInstance;effectIndex:number;mode:'normal'|'advantage'|'disadvantage';count:1|2;sides:20;timing:'target-turn-end';snapshot:Dnd5eHeadlessCombatState;events:readonly Dnd5eCombatEvent[]}
type Visit=Omit<Dnd5eDeathRepeatSavingFrame,'count'|'sides'|'timing'>&{timing:'target-turn-start'|'target-turn-end'}
type Pool={frame:Dnd5eDeathRepeatSavingFrame;values:readonly number[];error:unknown}
let active:{actorId:string;missing?:Error;interrupted?:Pool}|undefined
const missing=new WeakMap<object,Dnd5eDeathRepeatSavingFrame>()
const frame=(value:Visit):Dnd5eDeathRepeatSavingFrame=>cloneDnd5eHostTransactionInput({...value,count:value.mode==='normal'?1:2,sides:20,timing:'target-turn-end'})
/** Mechanical observation only. No caller result, dice, owner consent, source family or publication permission is issued. */
export function deathRepeatSavingOriginalMissingActive(actorId:string,timing:string){return!!active&&active.actorId===actorId&&timing==='target-turn-end'}
export function visitDeathRepeatSavingOriginalMissing(value:Visit){if(!active||active.actorId!==value.actorId||value.timing!=='target-turn-end')return;if(active.missing)throw active.missing;const error=new Error('death-repeat-saving-original:actual-input-required');missing.set(error,frame(value));active.missing=error;throw error}
export function withActualDeathRepeatSavingOriginal<T>(value:Visit,values:readonly number[],run:()=>T):T{if(!active||active.actorId!==value.actorId||value.timing!=='target-turn-end')return run();const scope=active,current=frame(value);try{return run()}catch(error){scope.interrupted={frame:current,values:[...values],error};throw error}}
export function withDeathRepeatSavingOriginals<T>(actorId:string,run:()=>T){const prior=active,scope:{actorId:string;missing?:Error;interrupted?:Pool}={actorId};active=scope;try{let result:T;try{result=run()}catch(error){throw scope.missing??error}if(scope.missing)throw scope.missing;return{result,interrupted:scope.interrupted}}finally{active=prior}}
export function readDeathRepeatSavingOriginalMissing(error:unknown){return error&&typeof error==='object'&&missing.has(error)?cloneDnd5eHostTransactionInput(missing.get(error)!):undefined}
