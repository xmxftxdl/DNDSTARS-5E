import type { DmUndoTransactionSummary } from '../../ports/sharedRoomGateway'

const COMBAT_RECOVERY_RESOURCES = new Set([
  'maps', 'characters', 'combat', 'combat-interrupts', 'combat-log',
  'combat-statistics', 'map-geometry', 'map-fog', 'map-exploration',
])

export function isCombatRecoveryResource(name: string): boolean {
  return COMBAT_RECOVERY_RESOURCES.has(name)
}

function isCombatCascadeTransaction(transaction: DmUndoTransactionSummary): boolean {
  return transaction.status === 'applied' && (
    transaction.combatRecoverable === true ||
    transaction.resources.some(isCombatRecoveryResource)
  )
}

const INTERNAL_COMBAT_RECOVERY_LABELS = new Set([
  '更新 combat',
  '更新 combat-interrupts',
  '更新 combat-log',
  '更新 combat-statistics',
  '处理战斗中断',
])

/**
 * Server recovery must retain these rows for revision-safe restoration, but
 * they are projections produced by a player/DM operation rather than separate
 * operations the DM chose to perform.
 */
export function isCombatRecoveryInternalTransaction(
  transaction: DmUndoTransactionSummary,
): boolean {
  return INTERNAL_COMBAT_RECOVERY_LABELS.has(transaction.label.trim())
}

export function combatRecoveryOperationTransactions(
  transactions: readonly DmUndoTransactionSummary[],
): DmUndoTransactionSummary[] {
  return transactions.filter((transaction) =>
    !isCombatRecoveryInternalTransaction(transaction))
}

/** Mirrors the server's newest-to-selected combat-cascade boundary. */
export function combatRecoveryAffectedTransactions(
  history: readonly DmUndoTransactionSummary[],
  selectedId: string,
): DmUndoTransactionSummary[] {
  const selectedIndex = history.findIndex((transaction) => transaction.transactionId === selectedId)
  if (selectedIndex < 0) return []
  return history.slice(0, selectedIndex + 1).filter(isCombatCascadeTransaction)
}
