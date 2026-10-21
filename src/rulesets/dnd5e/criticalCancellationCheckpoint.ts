import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export type Dnd5eCriticalHitEvent = Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>
export interface Dnd5eCriticalCancellationSelection {
  protectorId: string
  featureId: string
}

type Listener = (event: Dnd5eCriticalHitEvent, state: Dnd5eHeadlessCombatState) => Dnd5eCriticalCancellationSelection | void
let active: { listener: Listener; interrupted?: boolean; error?: unknown } | undefined

/** Host synchronous replay scope. Never retain this scope across an await. */
export function withDnd5eCriticalCancellationCheckpoints<T>(listener: Listener, run: () => T): T {
  const previous = active
  active = { listener }
  try { return run() } finally { active = previous }
}

export function visitDnd5eCriticalCancellationCheckpoint(event: Dnd5eCriticalHitEvent, state: Dnd5eHeadlessCombatState) {
  if (!active || !event.hit || !event.critical) return
  try { return active.listener(structuredClone(event), structuredClone(state)) }
  catch (error) { active.interrupted = true; active.error = error; throw error }
}

export function rethrowDnd5eCriticalCancellationInterruption() {
  if (active?.interrupted) throw active.error
}
