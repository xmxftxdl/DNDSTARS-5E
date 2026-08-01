export interface CombatEndCoordinatorOptions {
  publishInactiveCombat: () => Promise<void>
  openExperienceSettlement: () => void
  awaitPendingTransactions: () => Promise<void>
  clearMessageQueues: () => Promise<void>
}

/**
 * Combat termination and XP settlement are separate phases.
 *
 * Finish the currently accepted authority transaction before publishing the
 * inactive snapshot. Once that snapshot commits, players can leave combat and
 * the DM may distribute XP independently. Never clear request queues while the
 * authoritative combat is still active.
 */
export async function coordinateCombatEnd(
  options: CombatEndCoordinatorOptions,
): Promise<void> {
  await options.awaitPendingTransactions()
  await options.publishInactiveCombat()
  options.openExperienceSettlement()
  await options.clearMessageQueues()
}
