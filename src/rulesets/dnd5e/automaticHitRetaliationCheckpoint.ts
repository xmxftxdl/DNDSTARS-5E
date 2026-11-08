import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {Dnd5eFormulaRollDeclaration} from './activities/dnd5eFormula'

export interface Dnd5eAutomaticHitRetaliationRequest {
  actorId:string
  targetId:string
  packageId:string
  packageVersion:string
  activityId:string
  activityName:string
  definitionSignature:string
  grantEffectId:string
  rolls:readonly Dnd5eFormulaRollDeclaration[]
}
export type Dnd5eAutomaticHitRetaliationRolls=Readonly<Record<string,import('./activities/dnd5eFormula').Dnd5eFormulaRollResult>>
type Listener=(request:Dnd5eAutomaticHitRetaliationRequest,state:Dnd5eHeadlessCombatState)=>Dnd5eAutomaticHitRetaliationRolls
let active:{listener:Listener;interrupted?:boolean;error?:unknown}|undefined
export class Dnd5eAutomaticHitRetaliationRejected extends Error {}
export class Dnd5eAutomaticHitRetaliationRollsRequired extends Error {
  readonly request:Dnd5eAutomaticHitRetaliationRequest
  readonly snapshot:Dnd5eHeadlessCombatState
  constructor(request:Dnd5eAutomaticHitRetaliationRequest,state:Dnd5eHeadlessCombatState){super('automatic-hit-retaliation-rolls-required');this.request=structuredClone(request);this.snapshot=structuredClone(state)}
}
export function withDnd5eAutomaticHitRetaliationCheckpoints<T>(listener:Listener,run:()=>T):T {
  const previous=active;active={listener}
  try{const result=run();if(active.interrupted)throw active.error;return result}finally{active=previous}
}
export function visitDnd5eAutomaticHitRetaliationCheckpoint(request:Dnd5eAutomaticHitRetaliationRequest,state:Dnd5eHeadlessCombatState):Dnd5eAutomaticHitRetaliationRolls {
  if(!active)throw new Dnd5eAutomaticHitRetaliationRollsRequired(request,state)
  try{return active.listener(structuredClone(request),structuredClone(state))}catch(error){active.interrupted=true;active.error=error;throw error}
}
export function rejectDnd5eAutomaticHitRetaliation(reason:string):never {
  const error=new Dnd5eAutomaticHitRetaliationRejected(reason)
  if(active){active.interrupted=true;active.error=error}
  throw error
}
