export interface CombatEndCoordinatorOptions {
  publishInactiveCombat: () => Promise<void>
  openExperienceSettlement: () => void
  awaitPendingTransactions: () => Promise<void>
  clearMessageQueues: () => Promise<void>
}

/**
 * Combat termination and XP settlement are separate phases. The authoritative
 * inactive snapshot is committed before local queues are cleared.
 */
export async function coordinateCombatEnd(
  options: CombatEndCoordinatorOptions,
): Promise<void> {
  await options.awaitPendingTransactions()
  await options.publishInactiveCombat()
  options.openExperienceSettlement()
  await options.clearMessageQueues()
}
