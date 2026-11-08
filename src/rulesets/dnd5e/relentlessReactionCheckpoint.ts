import type {Dnd5eAction,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
export interface Dnd5eRelentlessReactionRequest {actorId:string;grantId:string;triggerSourceId?:string}
export interface Dnd5eRelentlessReactionChoice {attack?:Extract<Dnd5eAction,{type:'attack'}>;disadvantageNegationChoice?:NonNullable<Dnd5eAction['savingThrowCounterattacks']>[number]['disadvantageNegationChoice']}
export interface Dnd5eRelentlessReactionDecision extends Dnd5eRelentlessReactionChoice {occurrence:number}
export class Dnd5eRelentlessReactionDecisionRequired extends Error {
 readonly request:Dnd5eRelentlessReactionRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(request:Dnd5eRelentlessReactionRequest,snapshot:Dnd5eHeadlessCombatState){super('relentless-reaction-decision-required');this.request=structuredClone(request);this.snapshot=structuredClone(snapshot)}
}
export class Dnd5eRelentlessReactionAttackRejected extends Error {}
type Listener=(request:Dnd5eRelentlessReactionRequest,state:Dnd5eHeadlessCombatState)=>Dnd5eRelentlessReactionDecision
let active:{listener:Listener;interrupted?:boolean;error?:unknown}|undefined
export function withDnd5eRelentlessReactionCheckpoints<T>(listener:Listener,run:()=>T):T{
 const previous=active;active={listener};try{const result=run();if(active.interrupted)throw active.error;return result}finally{active=previous}
}
export function visitDnd5eRelentlessReactionCheckpoint(request:Dnd5eRelentlessReactionRequest,state:Dnd5eHeadlessCombatState):Dnd5eRelentlessReactionDecision|undefined{
 if(!active)throw new Dnd5eRelentlessReactionDecisionRequired(request,state)
 try{return active.listener(structuredClone(request),structuredClone(state))}
 catch(error){active.interrupted=true;active.error=error;throw error}
}
export function rethrowDnd5eRelentlessReactionInterruption(){if(active?.interrupted)throw active.error}

export function withDnd5eRequiredRelentlessReactionBoundary<T>(run:()=>T):T {
 if(active)return run()
 return withDnd5eRelentlessReactionCheckpoints((request,snapshot)=>{throw new Dnd5eRelentlessReactionDecisionRequired(request,snapshot)},run)
}
