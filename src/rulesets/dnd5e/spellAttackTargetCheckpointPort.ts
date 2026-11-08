import type{Dnd5eHeadlessCombatState,Dnd5eCombatEvent}from'./headlessCombatEngine'

/** Mechanical observation only. This leaf has no capability issuer, catalog,
 * Room authority, result constructor, or dependency on a concrete facade. */
export type Dnd5eSpellAttackTargetVisit=Readonly<{
 state:Dnd5eHeadlessCombatState;events:readonly Dnd5eCombatEvent[];actorId:string;
 originalTargetId:string;currentTargetId?:string;retargetStep?:number;attackIndex:number;stage:'target'|'ward'|'ward-result'|'raw';wardTargetId?:string;wardAllowed?:boolean;
 raw?:Readonly<{targetId:string;mode:'normal'|'advantage'|'disadvantage'}>
}>
let observer:((visit:Dnd5eSpellAttackTargetVisit)=>void)|undefined
export function withDnd5eSpellAttackTargetObserver<T>(visit:(value:Dnd5eSpellAttackTargetVisit)=>void,run:()=>T):T{
 if(run.constructor.name==='AsyncFunction')throw Error('spell-attack-window:sync-only')
 const previous=observer;observer=visit
 try{const result=run();if(result&&typeof result==='object'&&'then'in result&&typeof result.then==='function')throw Error('spell-attack-window:sync-only');return result}finally{observer=previous}
}
/** An observer sees detached mechanical data. It cannot mutate the working
 * state/event ledger subsequently authenticated by a concrete native facade. */
export function visitDnd5eSpellAttackTarget(value:Dnd5eSpellAttackTargetVisit):void{
 const current=observer;if(!current)return
 current(Object.freeze({...value,state:structuredClone(value.state),events:structuredClone(value.events),...(value.raw?{raw:Object.freeze({...value.raw})}:{})}))
}
