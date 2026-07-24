import { describe, expect, it } from 'vitest'
import {
  canBonusDieChangeFailure,
  shouldOpenD20RollConfirmation,
} from './d20InterruptPolicy'

describe('d20 interrupt policy', () => {
  it('settles public d20 rolls immediately when nobody can modify an enemy result', () => {
    expect(shouldOpenD20RollConfirmation({
      visibility: 'public',
      outcome: 'success',
      eligibleEnemyModifiers: [],
    })).toBe(false)
  })

  it('opens an enemy-result window only for a successful result with an eligible feature', () => {
    const eligibleEnemyModifiers = [{
      characterId: 'hero',
      featureId: 'plugin:omen',
      featureLabel: '预兆',
    }]
    expect(shouldOpenD20RollConfirmation({
      visibility: 'public',
      outcome: 'success',
      eligibleEnemyModifiers,
    })).toBe(true)
    expect(shouldOpenD20RollConfirmation({
      visibility: 'public',
      outcome: 'failure',
      eligibleEnemyModifiers,
    })).toBe(false)
  })

  it('keeps DM-only d20 rolls editable in every settlement mode', () => {
    expect(shouldOpenD20RollConfirmation({
      visibility: 'dm-only',
      outcome: 'unknown',
    })).toBe(true)
  })

  it('offers a bonus die only when the failed result can still reach the target', () => {
    expect(canBonusDieChangeFailure({
      success: false,
      currentTotal: 11,
      targetNumber: 14,
      dieSides: 6,
    })).toBe(true)
    expect(canBonusDieChangeFailure({
      success: true,
      currentTotal: 14,
      targetNumber: 14,
      dieSides: 6,
    })).toBe(false)
    expect(canBonusDieChangeFailure({
      success: false,
      currentTotal: 5,
      targetNumber: 14,
      dieSides: 6,
    })).toBe(false)
  })
})
