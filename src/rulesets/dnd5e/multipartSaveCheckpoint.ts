import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
export interface MultipartSaveRequest {actorId:string;ability?:string;dc:number;total:number}
export class MultipartSaveDecisionRequired extends Error {
 readonly request:MultipartSaveRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(request:MultipartSaveRequest,snapshot:Dnd5eHeadlessCombatState){super('multipart-save-decision-required');this.request=request;this.snapshot=snapshot}
}
type Listener=(request:MultipartSaveRequest,state:Dnd5eHeadlessCombatState)=>boolean
let active:{listener:Listener;error?:unknown}|undefined
export function withMultipartSaveCheckpoints<T>(listener:Listener,run:()=>T):T {
 const previous=active;active={listener}
 try {const result=run();if(active.error)throw active.error;return result} finally {active=previous}
}
export function visitMultipartSaveCheckpoint(request:MultipartSaveRequest,state:Dnd5eHeadlessCombatState):boolean {
 try {if(!active)throw new MultipartSaveDecisionRequired(structuredClone(request),structuredClone(state));return active.listener(structuredClone(request),structuredClone(state))}
 catch(error){if(active)active.error=error;throw error}
}
export function withRequiredMultipartSaveBoundary<T>(run:()=>T):T {
 return active?run():withMultipartSaveCheckpoints((request,state)=>{throw new MultipartSaveDecisionRequired(request,state)},run)
}
