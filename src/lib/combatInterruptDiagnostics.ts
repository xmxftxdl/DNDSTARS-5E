import {
  isCombatInterruptTerminal,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'

export interface CombatInterruptDiagnosticIssue {
  id: string
  severity: 'error' | 'warning'
  message: string
}

export function inspectCombatInterruptQueue(
  queue: SharedCombatInterruptQueueState | null | undefined,
  now = Date.now(),
): CombatInterruptDiagnosticIssue[] {
  if (!queue) return []
  const issues: CombatInterruptDiagnosticIssue[] = []
  const locks = new Map<string, string>()
  for (const interrupt of queue.interrupts) {
    if (!isCombatInterruptTerminal(interrupt)) {
      const previous = locks.get(interrupt.transactionId)
      if (previous) issues.push({
        id: `duplicate:${interrupt.id}`,
        severity: 'error',
        message: `事务 ${interrupt.transactionId} 被 ${previous} 与 ${interrupt.id} 同时锁定。`,
      })
      else locks.set(interrupt.transactionId, interrupt.id)
    }
    if (interrupt.status === 'waiting-for-dm') issues.push({
      id: `waiting:${interrupt.id}`,
      severity: 'warning',
      message: `${interrupt.id} 正等待 DM 恢复；原动作快照尚未提交。`,
    })
    if (interrupt.status === 'rolling' && now - interrupt.updatedAt > 60_000) issues.push({
      id: `rolling:${interrupt.id}`,
      severity: 'error',
      message: `${interrupt.id} 已处于结算锁超过 60 秒，应回滚或从权威快照恢复。`,
    })
    if (
      interrupt.status === 'pending' && interrupt.timeoutPolicy === 'rollback' &&
      interrupt.expiresAt != null && now >= interrupt.expiresAt
    ) issues.push({
      id: `expired:${interrupt.id}`,
      severity: 'warning',
      message: `${interrupt.id} 已超时，DM 权威循环将按原快照回滚。`,
    })
  }
  return issues
}
