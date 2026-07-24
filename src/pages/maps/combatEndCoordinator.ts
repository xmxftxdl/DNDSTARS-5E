export interface CombatEndCoordinatorOptions {
  publishInactiveCombat: () => Promise<void>
  openExperienceSettlement: () => void
  awaitPendingTransactions: () => Promise<void>
  clearMessageQueues: () => Promise<void>
}

/**
 * Combat termination and XP settlement are separate phases.
 *
 * The inactive snapshot is started first, while the DM's post-combat dialog
 * may open immediately. Transaction and queue cleanup happens afterwards and
 * is still attempted if the authoritative publish fails.
 */
export async function coordinateCombatEnd(
  options: CombatEndCoordinatorOptions,
): Promise<void> {
  let publishError: unknown
  let publishPromise: Promise<void>
  try {
    publishPromise = options.publishInactiveCombat()
  } catch (error) {
    publishError = error
    publishPromise = Promise.resolve()
  }

  options.openExperienceSettlement()

  try {
    await publishPromise
  } catch (error) {
    publishError ??= error
  }

  try {
    await options.awaitPendingTransactions()
  } catch (error) {
    publishError ??= error
  }

  try {
    await options.clearMessageQueues()
  } catch (error) {
    publishError ??= error
  }

  if (publishError !== undefined) throw publishError
}
