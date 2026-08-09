import { describe, expect, it } from 'vitest'
import {
  canBonusDieChangeFailure,
  DND5E_CORE_INSPIRATION_RESOURCE_KEY,
  dnd5eCoreInspirationChoiceRerollOption,
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

  it('opens immediately for an eligible choice reroll even before success is known', () => {
    expect(shouldOpenD20RollConfirmation({
      visibility: 'public',
      outcome: 'unknown',
      eligibleEnemyModifiers: [{
        characterId: 'hero',
        featureId: 'test.lucky:feat-lucky',
        featureLabel: '幸运',
        modifierKind: 'choice-reroll',
        rerollScope: 'self-roll',
        resourceCosts: [{ resourceKey: 'test.lucky:luck-points', amount: 1 }],
        decisionRequired: true,
      }],
    })).toBe(true)
  })

  it('projects character-sheet Inspiration into the shared Lucky-style reroll window', () => {
    expect(dnd5eCoreInspirationChoiceRerollOption({
      id: 'hero',
      inspiration: 2,
    }, 'hero-token')).toEqual({
      characterId: 'hero',
      featureId: 'dnd5e-core-inspiration',
      featureLabel: '激励',
      modifierKind: 'choice-reroll',
      sourceTokenId: 'hero-token',
      rerollScope: 'self-roll',
      resourceCosts: [{ resourceKey: DND5E_CORE_INSPIRATION_RESOURCE_KEY, amount: 1 }],
      decisionRequired: true,
    })
    expect(dnd5eCoreInspirationChoiceRerollOption({
      id: 'hero',
      inspiration: 0,
    })).toBeUndefined()
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
