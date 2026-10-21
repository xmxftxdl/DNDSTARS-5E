import type { Dnd5eActionResult, Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export interface Dnd5eDeathSaveCheckpoint {
  combatId: string
  actorId: string
  round: number
  initiativeIndex: number
}

type Listener = (checkpoint: Dnd5eDeathSaveCheckpoint, snapshot: Dnd5eHeadlessCombatState) => Dnd5eActionResult | void
let listener: Listener | undefined
let currentCheckpoint: Dnd5eDeathSaveCheckpoint | undefined
let activityAuthority: {actorId:string;packageId:string;activityId:string} | undefined

export function withDnd5eDeathSaveActivityAuthority<T>(authority: NonNullable<typeof activityAuthority>, run:()=>T):T {
  if (!currentCheckpoint || currentCheckpoint.actorId !== authority.actorId) throw Error('no live death-save checkpoint')
  const previous=activityAuthority
  activityAuthority={...authority}
  try{return run()}finally{activityAuthority=previous}
}

export function hasDnd5eDeathSaveActivityAuthority(state:Dnd5eHeadlessCombatState,actorId:string,activityId:string,packageId?:string):boolean {
  const actor=state.combatants[actorId]
  return !!currentCheckpoint && !!activityAuthority && currentCheckpoint.combatId===state.combatId &&
    currentCheckpoint.round===state.round && currentCheckpoint.initiativeIndex===state.initiativeIndex &&
    activityAuthority.actorId===actorId && activityAuthority.activityId===activityId && activityAuthority.packageId===packageId &&
    actor?.currentHp===0 && !actor.deathSaves.dead && !actor.deathSaves.stable
}

/** Synchronous Host scope only. No player-provided callback or permanent bypass flag. */
export function withDnd5eDeathSaveCheckpoint<T>(value: Listener, run: () => T): T {
  const previous = listener
  listener = value
  try { return run() } finally { listener = previous }
}

export function visitDnd5eDeathSaveCheckpoint(state: Dnd5eHeadlessCombatState, actorId: string): Dnd5eActionResult | void {
  if (!listener) return
  const current = listener
  const previousCheckpoint=currentCheckpoint
  currentCheckpoint={combatId:state.combatId,actorId,round:state.round,initiativeIndex:state.initiativeIndex}
  listener = undefined
  try { return current({...currentCheckpoint}, structuredClone(state)) }
  finally { listener = current;currentCheckpoint=previousCheckpoint }
}
