import { describe, expect, it } from 'vitest'
import {
  canBonusDieChangeFailure,
  DND5E_CORE_INSPIRATION_RESOURCE_KEY,
  dnd5eCoreInspirationChoiceRerollOption,
  shouldOfferDnd5ePlayerD20ChoiceReroll,
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
    expect(shouldOpenD20RollConfirmation({
      visibility: 'public',
      outcome: 'failure',
      eligibleEnemyModifiers: [{ ...eligibleEnemyModifiers[0], replacementValues: [17] }],
    })).toBe(true)
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
      additionalDice: 1,
      selectionPolicy: 'highest',
      resourceCosts: [{ resourceKey: DND5E_CORE_INSPIRATION_RESOURCE_KEY, amount: 1 }],
      decisionRequired: true,
    })
    expect(dnd5eCoreInspirationChoiceRerollOption({
      id: 'hero',
      inspiration: 0,
    })).toBeUndefined()
    expect(dnd5eCoreInspirationChoiceRerollOption({
      id: 'hero',
      inspiration: 2,
    }, 'hero-token', 'advantage')).toBeUndefined()
    expect(dnd5eCoreInspirationChoiceRerollOption({
      id: 'hero',
      inspiration: 2,
    }, 'hero-token', 'disadvantage')).toBeUndefined()
  })

  it('routes every identified player attack and save d20 into the shared choice bridge', () => {
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 1, sides: 20, rollKind: 'attack', rollMode: 'normal', rollerSide: 'player',
    })).toBe(true)
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 1, sides: 20, rollKind: 'saving-throw', rollMode: 'normal', rollerSide: 'player',
    })).toBe(true)
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 1, sides: 20, rollKind: 'ability-check', rollMode: 'normal', rollerSide: 'player',
    })).toBe(true)
  })

  it('does not add an Inspiration die to monsters, damage pools, or an existing roll mode', () => {
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 1, sides: 20, rollKind: 'attack', rollMode: 'normal', rollerSide: 'enemy',
    })).toBe(false)
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 1, sides: 20, rollerSide: 'player',
    })).toBe(false)
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 2, sides: 20, rollKind: 'saving-throw', rollMode: 'advantage', rollerSide: 'player',
    })).toBe(false)
    expect(shouldOfferDnd5ePlayerD20ChoiceReroll({
      count: 2, sides: 20, rollKind: 'saving-throw', rollMode: 'disadvantage', rollerSide: 'player',
    })).toBe(false)
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
