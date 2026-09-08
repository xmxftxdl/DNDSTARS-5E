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
