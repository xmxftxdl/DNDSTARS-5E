import type {AbilityKey} from '../../lib/dnd'
import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
export interface MissingSpellcastingOriginalRequirement{actorId:string;effectId:string;ability:AbilityKey;dc:number;rollMode:'normal'|'advantage'|'disadvantage';requiredDiceCount:1|2}
export interface MissingSpellcastingOriginal{readonly status:'missing-spellcasting-original';readonly requirement:Readonly<MissingSpellcastingOriginalRequirement>;readonly snapshot:Dnd5eHeadlessCombatState}
class NativeMissingSpellcastingOriginal extends Error{}
let active:{result?:MissingSpellcastingOriginal;error?:NativeMissingSpellcastingOriginal}|undefined
export const dnd5eMissingSpellcastingOriginalObservationActive=()=>active!==undefined
/** Called only from the real current native effect loop after its input shape
 * has been checked. This descriptor contains no faces, raw ID or permission. */
export function visitMissingSpellcastingOriginal(requirement:MissingSpellcastingOriginalRequirement,state:Dnd5eHeadlessCombatState):void{
 if(!active)return
 active.result=Object.freeze({status:'missing-spellcasting-original',requirement:Object.freeze({...requirement}),snapshot:structuredClone(state)})
 active.error=new NativeMissingSpellcastingOriginal('actual-spellcasting-original-missing')
 throw active.error
}
/** A synchronous read-only observation, never a constructor for raw lineage. */
export function observeMissingSpellcastingOriginal<T>(run:()=>T):T|MissingSpellcastingOriginal{
 const previous=active,scope:{result?:MissingSpellcastingOriginal;error?:NativeMissingSpellcastingOriginal}={};active=scope
 try{const result=run();return scope.result??result}catch(error){if(error===scope.error&&scope.result)return scope.result;throw error}finally{active=previous}
}
