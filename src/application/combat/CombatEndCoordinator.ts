export interface CombatEndCoordinatorOptions {
  publishInactiveCombat: () => Promise<void>
  openExperienceSettlement: () => void
  awaitPendingTransactions: () => Promise<void>
  clearMessageQueues: () => Promise<void>
}

/**
 * Combat termination and XP settlement are separate phases. The authoritative
 * inactive snapshot is committed only after the previous combat's queues have
 * been cleared. Publishing inactivity first opens the exploration UI while
 * the Host is still rejecting requests as `combat-ending`; that small window
 * can otherwise drop a freshly submitted exploration spell in the reset.
 */
export async function coordinateCombatEnd(
  options: CombatEndCoordinatorOptions,
): Promise<void> {
  await options.awaitPendingTransactions()
  await options.clearMessageQueues()
  await options.publishInactiveCombat()
  options.openExperienceSettlement()
}
