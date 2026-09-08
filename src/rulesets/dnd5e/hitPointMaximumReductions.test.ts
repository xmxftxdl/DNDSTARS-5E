import { describe, expect, it } from 'vitest'
import {
  advanceDnd5eHitPointMaximumReductionDurations,
  appendDnd5eHitPointMaximumReduction,
  normalizeDnd5eHitPointMaximumReductionLedger,
} from './hitPointMaximumReductions'

describe('timed hit-point maximum reductions', () => {
  it('retains a timed reduction until its last round and then restores it', () => {
    const reduced = appendDnd5eHitPointMaximumReduction({
      currentMaximum: 80,
      ledger: undefined,
      entry: {
        id: 'harm:1',
        amount: 56,
        recovery: 'greater-restoration-or-other-magic',
        remainingRounds: 600,
      },
    })
    expect(reduced.maximum).toBe(24)

    const beforeExpiry = advanceDnd5eHitPointMaximumReductionDurations(
      reduced.ledger,
      599,
    )
    expect(beforeExpiry.maximum).toBe(24)
    expect(beforeExpiry.ledger?.entries[0]?.remainingRounds).toBe(1)
    expect(beforeExpiry.recoveredAmount).toBe(0)

    const expired = advanceDnd5eHitPointMaximumReductionDurations(
      beforeExpiry.ledger,
      1,
    )
    expect(expired).toEqual({
      ledger: undefined,
      maximum: 80,
      recoveredAmount: 56,
    })
  })

  it('rejects invalid persisted timed entries', () => {
    expect(normalizeDnd5eHitPointMaximumReductionLedger({
      schemaVersion: 1,
      baseMaximum: 40,
      entries: [{
        id: 'invalid',
        amount: 5,
        recovery: 'greater-restoration-or-other-magic',
        remainingRounds: 0,
      }],
    })).toBeUndefined()
  })
})
