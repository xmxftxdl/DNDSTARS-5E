import type {Dnd5eCombatEvent,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {BattleMap} from '../../store/maps'
import {replayDnd5eTempleMovementEntries,type Dnd5eTempleMovementReplay,type Dnd5eForcedMovementLandingReplay,type Dnd5eForcedFallReactionReplay} from './templeMovementReplay'

export type Dnd5eHitPushEvent=Extract<Dnd5eCombatEvent,{type:'moved'}>
export interface Dnd5eHitPushReceipts {
  map:BattleMap
  entryReplays:readonly Dnd5eTempleMovementReplay[]
  landings:readonly Dnd5eForcedMovementLandingReplay[]
  fallReactions?:readonly Dnd5eForcedFallReactionReplay[]
}
type Listener=(event:Dnd5eHitPushEvent,state:Dnd5eHeadlessCombatState)=>Dnd5eHitPushReceipts
let active:{listener:Listener;interrupted?:boolean;error?:unknown}|undefined
/** Synchronous replay only. A listener returns dice receipts, never a replacement combat state. */
export function withDnd5eHitPushCheckpoints<T>(listener:Listener,run:()=>T):T {
 const previous=active;active={listener}
 try{return run()}finally{active=previous}
}
export function visitDnd5eHitPushCheckpoint(event:Dnd5eHitPushEvent,state:Dnd5eHeadlessCombatState) {
 if(!active)return undefined
 try{
  const receipts=active.listener(structuredClone(event),structuredClone(state))
  const replay=replayDnd5eTempleMovementEntries({...receipts,state,events:[event]})
  if(!replay.ok)throw Error(replay.reason)
  return replay
 }catch(error){active.interrupted=true;active.error=error;throw error}
}
export function rethrowDnd5eHitPushInterruption(){if(active?.interrupted)throw active.error}
