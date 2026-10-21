import type { Dnd5eActionResult, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eZeroHitPointTurnOffer, planDnd5eZeroHitPointTurnAcceptance } from './zeroHitPointReaction'

export interface Dnd5eZeroHitPointCheckpoint {
  occurrence: number
  targetId: string
  sourceId?: string
  hitPointsBefore: number
  hitPointDamage: number
  remainingDamageAfterZero: number
  incapacitatedBeforeDamage: boolean
}

/** Selection from a Host-owned replay session, never an unchecked player payload. */
export interface Dnd5eZeroHitPointDecision { featureId: string; transactionId: string }
type Listener = (checkpoint: Dnd5eZeroHitPointCheckpoint, state: Dnd5eHeadlessCombatState) => void | Dnd5eZeroHitPointDecision
let active: {listener: Listener; occurrence: number; interrupted?: boolean; interruption?: unknown;
  complete?: (result:Dnd5eActionResult)=>Dnd5eActionResult; completing?:boolean} | undefined

/** Host-only synchronous replay scope. Declining simply lets the damage continue. */
export function withDnd5eZeroHitPointCheckpoints<T>(listener: Listener, run: () => T,
  complete?: (result:Dnd5eActionResult)=>Dnd5eActionResult): T {
  const previous = active
  active = {listener, occurrence: 0, complete}
  try { return run() } finally { active = previous }
}

/** Runs before map facades derive their application from the completed action. */
export function completeDnd5eZeroHitPointResolution(result:Dnd5eActionResult):Dnd5eActionResult {
  if (!active?.complete || active.completing || !result.ok) return result
  const scope = active
  scope.completing = true
  try { return scope.complete!(result) } finally {scope.completing = false}
}

export function visitDnd5eZeroHitPointCheckpoint(
  checkpoint: Omit<Dnd5eZeroHitPointCheckpoint, 'occurrence'>,
  state: Dnd5eHeadlessCombatState,
): void {
  const target = state.combatants[checkpoint.targetId]
  if (!active || !target || target.currentHp !== 0 || target.deathSaves.dead ||
    checkpoint.hitPointsBefore <= 0 || checkpoint.hitPointDamage < checkpoint.hitPointsBefore ||
    checkpoint.remainingDamageAfterZero >= target.maxHp) return
  try {
    const occurred = {...checkpoint, occurrence: active.occurrence++}
    const decision = active.listener(occurred, structuredClone(state))
    if (decision) {
      const offer = createDnd5eZeroHitPointTurnOffer(state, occurred)
      const plan = offer && planDnd5eZeroHitPointTurnAcceptance(state, offer, decision.featureId, decision.transactionId)
      if (!plan) throw new Error('zero-hit-point-reaction-invalid')
      // Preserve the target object used by the ongoing damage resolver. Only
      // validated costs and pending-turn state change before zero-HP cleanup.
      target.turn = plan.actorAfterCosts.turn
      target.classResources = plan.actorAfterCosts.classResources
      target.classState = plan.actorAfterCosts.classState
    }
  } catch (error) {
    active.interrupted = true
    active.interruption = error
    throw error
  }
}

/** Broad legacy dice catches must not turn a suspended transaction into a result. */
export function rethrowDnd5eZeroHitPointInterruption(): void {
  if (active?.interrupted) throw active.interruption
}
