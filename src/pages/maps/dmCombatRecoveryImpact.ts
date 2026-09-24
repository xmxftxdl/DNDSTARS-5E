import type { DmUndoTransactionSummary } from '../../ports/sharedRoomGateway'

/** Stored details describe the original mutation; this dialog previews its inverse. */
export function combatRecoveryDetailLabel(detail: string): string {
  return detail.replace(/：HP (-?\d+) → (-?\d+)（恢复为 (-?\d+)）$/, '：HP $2 → $3（撤回后）')
}

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
  return INTERNAL_COMBAT_RECOVERY_LABELS.has(transaction.label.trim()) || (
    transaction.label.trim() === '提交战斗结算' && !transaction.details?.length
  )
}

export function combatRecoveryOperationTransactions(
  transactions: readonly DmUndoTransactionSummary[],
): DmUndoTransactionSummary[] {
  return transactions.filter((transaction) =>
    !isCombatRecoveryInternalTransaction(transaction))
}

/** Compact continuous manual HP edits for display only; keep the recovery cascade intact. */
export function combatRecoveryDisplayOperations(transactions: readonly DmUndoTransactionSummary[]): DmUndoTransactionSummary[] {
  const result: DmUndoTransactionSummary[] = []
  let chain: { row: DmUndoTransactionSummary; name: string; initial: string; final: string; oldest: DmUndoTransactionSummary } | undefined
  for (const transaction of combatRecoveryOperationTransactions(transactions)) {
    const match = /^(.*)：HP (-?\d+) → (-?\d+)（恢复为 -?\d+）$/.exec(transaction.details?.[0] ?? '')
    const hpOnly = ['更新 maps', '更新 characters'].includes(transaction.label) && transaction.details?.length === 1 && match
    if (hpOnly && chain && chain.name === match[1] && chain.initial === match[3] &&
        chain.oldest.label === transaction.label &&
        JSON.stringify(chain.oldest.combat) === JSON.stringify(transaction.combat) &&
        chain.oldest.createdAt >= transaction.createdAt && chain.oldest.createdAt - transaction.createdAt <= 2000) {
      chain.initial = match[2]
      chain.oldest = transaction
      chain.row.details = [`${chain.name}：HP ${chain.initial} → ${chain.final}（恢复为 ${chain.initial}）`]
      continue
    }
    const row = hpOnly ? { ...transaction, label: '调整血量', details: [...transaction.details!] } : transaction
    result.push(row)
    chain = hpOnly ? { row, name: match[1], initial: match[2], final: match[3], oldest: transaction } : undefined
  }
  return result
}

/** Display one rollback boundary per contiguous turn; retain all server transactions. */
export function combatRecoveryTurnCheckpoints(history: readonly DmUndoTransactionSummary[]): DmUndoTransactionSummary[] {
  const groups: { key: string; rows: DmUndoTransactionSummary[] }[] = []
  for (const transaction of [...history].reverse()) {
    const combat = transaction.combat
    const setup = combat?.beforeActive === false || transaction.label === '开始战斗'
    const round = combat?.beforeRound ?? combat?.afterRound
    const slot = combat?.beforeSlotId ?? combat?.beforeInitiativeIndex ?? combat?.afterSlotId ?? combat?.afterInitiativeIndex
    const key = setup ? `setup:${transaction.transactionId}` : round != null && slot != null
      ? `${combat?.mapId}:${combat?.combatId}:${round}:${slot}`
      : `legacy:${transaction.transactionId}`
    const previous = groups.at(-1)
    if (previous?.key === key && !key.startsWith('setup:')) previous.rows.push(transaction)
    else groups.push({ key, rows: [transaction] })
  }
  return groups.filter(group => combatRecoveryOperationTransactions(group.rows).length > 0 ||
    group.rows.some(row => row.label === '提交战斗结算')).map(group => {
    const first = group.rows[0]!
    const named = group.rows.find(row => row.combat?.beforeActorLabel)
    const actor = named?.combat?.beforeActorLabel
    return {
      ...first,
      label: actor && !group.key.startsWith('setup:') ? `${actor} · 回合开始` : first.label,
      combat: first.combat ? { ...first.combat, afterRound: first.combat.beforeRound ?? first.combat.afterRound } : undefined,
      resources: [...new Set(group.rows.flatMap(row => row.resources))],
    }
  }).reverse()
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
