import { describe, expect, it } from 'vitest'
import type { DmUndoTransactionSummary } from '../ports/sharedRoomGateway'
import type { CombatLogEntry } from './sharedCombatTypes'
import { combatLogCutoffBeforeEntry, planCombatLogRollback } from './combatLogRollback'

function log(id: number): CombatLogEntry {
  return { id, round: 1, text: `log-${id}`, kind: 'system', time: '10:00' }
}

function transaction(
  transactionId: string,
  createdAt: number,
  resources: string[] = ['combat'],
  status: DmUndoTransactionSummary['status'] = 'applied',
): DmUndoTransactionSummary {
  return { transactionId, label: transactionId, resources, status, createdAt, updatedAt: createdAt }
}

describe('combat log rollback planning', () => {
  it('places the log cutoff before the selected action so that action is removed too', () => {
    expect(combatLogCutoffBeforeEntry([log(30), log(20), log(10)], 20)).toBe(10)
    expect(combatLogCutoffBeforeEntry([log(30), log(20)], 20)).toBe(0)
  })

  it('undoes the selected authority transaction and later transactions in newest-first order', () => {
    const plan = planCombatLogRollback({
      targetEntry: log(10_000),
      entries: [log(20_000), log(10_000), log(5_000)],
      history: [
        transaction('newest', 18_000),
        transaction('middle', 15_000, ['characters']),
        transaction('before', 9_000),
        transaction('unrelated', 19_000, ['campaign-time']),
        transaction('already-undone', 17_000, ['maps'], 'undone'),
      ],
    })

    expect(plan.transactions.map((entry) => entry.transactionId)).toEqual(['newest', 'middle', 'before'])
  })

  it('restores both action economy and spell-slot snapshots associated with the selected spell log', () => {
    const plan = planCombatLogRollback({
      targetEntry: log(10_000),
      entries: [log(20_000), log(10_000)],
      history: [
        transaction('selected-action', 10_400, ['combat']),
        transaction('selected-statistics', 10_800, ['combat-statistics']),
        transaction('selected-spell-slot', 10_600, ['characters']),
        transaction('later-action', 15_000),
      ],
    })

    expect(plan.anchorTransaction?.transactionId).toBe('selected-action')
    expect(plan.cutoffAt).toBe(9_999)
    expect(plan.transactions.map((entry) => entry.transactionId)).toEqual([
      'later-action',
      'selected-statistics',
      'selected-spell-slot',
      'selected-action',
    ])
  })
})
