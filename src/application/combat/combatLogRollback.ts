import type { DmUndoTransactionSummary } from '../../ports/sharedRoomGateway'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'

const COMBAT_ROLLBACK_RESOURCES = new Set([
  'maps',
  'characters',
  'combat',
  'combat-interrupts',
  'combat-statistics',
  'map-geometry',
  'room-journal',
])

const TRANSACTION_ENTRY_PRE_WINDOW_MS = 5_000
const TRANSACTION_ENTRY_POST_WINDOW_MS = 1_500
const COMBAT_START_GRACE_MS = 30_000

export interface CombatLogRollbackPlan {
  cutoffAt: number
  anchorTransaction?: DmUndoTransactionSummary
  transactions: DmUndoTransactionSummary[]
}

export function dmTransactionAffectsCombatRollback(
  transaction: DmUndoTransactionSummary,
): boolean {
  return transaction.resources.some((resource) => COMBAT_ROLLBACK_RESOURCES.has(resource))
}

export function combatLogCutoffBeforeEntry(
  entries: readonly CombatLogEntry[],
  targetEntryId: number,
): number {
  return entries.reduce(
    (latestBefore, entry) =>
      entry.id < targetEntryId ? Math.max(latestBefore, entry.id) : latestBefore,
    0,
  )
}

export function planCombatLogRollback(input: {
  targetEntry: CombatLogEntry
  entries: readonly CombatLogEntry[]
  history: readonly DmUndoTransactionSummary[]
}): CombatLogRollbackPlan {
  const targetAt = Math.floor(input.targetEntry.id)
  const oldestLogAt = input.entries.reduce(
    (oldest, entry) => Math.min(oldest, Math.floor(entry.id)),
    targetAt,
  )
  const combatStartedAt = Math.max(0, oldestLogAt - COMBAT_START_GRACE_MS)
  const relevant = input.history.filter((transaction) =>
    transaction.status === 'applied' &&
    transaction.createdAt >= combatStartedAt &&
    dmTransactionAffectsCombatRollback(transaction))
  const anchorTransaction = relevant
    .filter((transaction) =>
      transaction.createdAt >= targetAt - TRANSACTION_ENTRY_PRE_WINDOW_MS &&
      transaction.createdAt <= targetAt + TRANSACTION_ENTRY_POST_WINDOW_MS)
    .sort((left, right) => left.createdAt - right.createdAt)[0]
  // Clicking a row means undoing that row as well as everything after it.
  // Move the cutoff just before the earliest nearby authority transaction so
  // the character spell-slot snapshot and combat action economy are restored together.
  const cutoffAt = Math.max(0, Math.min(targetAt, anchorTransaction?.createdAt ?? targetAt) - 1)
  const transactions = relevant
    .filter((transaction) => transaction.createdAt > cutoffAt)
    .sort((left, right) => right.createdAt - left.createdAt)
  return { cutoffAt, anchorTransaction, transactions }
}
