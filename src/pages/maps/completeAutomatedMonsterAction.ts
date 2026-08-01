export type AutomatedMonsterActionBoundary =
  | 'combat-ended'
  | 'stopped'
  | 'continue'

export interface CompleteAutomatedMonsterActionOptions {
  /** Read after the authoritative Headless transaction has committed. */
  hasCombatOutcome: () => boolean
  /** Clears the in-flight automation owner before ending or yielding control. */
  releaseAutomationOwner: () => void
  /** Starts the authoritative combat-end coordinator. */
  endCombatIfNeeded: () => void
  /** Completes a requested takeover, or detects that this turn no longer owns automation. */
  stopAtSafePoint: () => boolean
  /** Schedules the next action/end-turn only while combat still continues. */
  continueTurn: () => void
}

/**
 * Finalizes one fully committed automated-monster action.
 *
 * A lethal result must win over a simultaneously requested DM takeover: the
 * damage is already authoritative, so release the automation lease and enter
 * combat termination instead of leaving a pending pause with no continuation.
 */
export function completeAutomatedMonsterAction(
  options: CompleteAutomatedMonsterActionOptions,
): AutomatedMonsterActionBoundary {
  if (options.hasCombatOutcome()) {
    options.releaseAutomationOwner()
    options.endCombatIfNeeded()
    return 'combat-ended'
  }
  if (options.stopAtSafePoint()) {
    options.releaseAutomationOwner()
    return 'stopped'
  }
  options.continueTurn()
  return 'continue'
}

export function completeManualMonsterAction(options: {
  clearPendingAction: () => void
  hasCombatOutcome: () => boolean
  endCombatIfNeeded: () => void
}): 'combat-ended' | 'ready' {
  options.clearPendingAction()
  if (!options.hasCombatOutcome()) return 'ready'
  options.endCombatIfNeeded()
  return 'combat-ended'
}

export function completeInterruptedMonsterMove(options: {
  hasCombatOutcome: () => boolean
  actorAlive: boolean
  releaseAutomationOwner: () => void
  endCombatIfNeeded: () => void
  completeTakeoverAtSafePoint: () => void
  settleDefeatedActorTurn: () => void
  stopAtSafePoint: () => void
}): 'combat-ended' | 'actor-defeated' | 'stopped' {
  if (options.hasCombatOutcome()) {
    options.releaseAutomationOwner()
    options.endCombatIfNeeded()
    return 'combat-ended'
  }
  if (!options.actorAlive) {
    options.completeTakeoverAtSafePoint()
    options.releaseAutomationOwner()
    options.settleDefeatedActorTurn()
    return 'actor-defeated'
  }
  options.stopAtSafePoint()
  options.releaseAutomationOwner()
  return 'stopped'
}
