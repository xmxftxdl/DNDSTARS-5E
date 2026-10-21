import { expect, it } from 'vitest'
import { applyDnd5eAdvantageReroll } from './advantageReroll'
import { createD20ChoiceRerollContribution, createD20RollConfirmationInterrupt, settleD20RollConfirmation } from '../../lib/rollConfirmation'

it('preserves the original advantage pair when declined, including doubles and critical faces', () => {
  for (let first = 1; first <= 20; first++) for (let second = 1; second <= 20; second++) {
    expect(applyDnd5eAdvantageReroll([first, second], Math.max(first, second))).toEqual([first, second])
  }
})
it('composes persisted Host highest policy with the original pair to resolve all three dice', () => {
  for (const pair of [[1, 1], [20, 1], [1, 20], [12, 7], [7, 12], [12, 12]]) {
    for (const extra of [1, 7, 12, 18, 20]) {
      const originalValue = Math.max(...pair)
      const prompt = createD20RollConfirmationInterrupt({ mapId: 'map', rollId: 'attack', label: 'Attack', originalValue,
        eligibleModifiers: [{ characterId: 'hero', featureId: 'accuracy', featureLabel: 'Accuracy', modifierKind: 'choice-reroll',
          rerollScope: 'self-roll', additionalDice: 1, selectionPolicy: 'highest', resourceCosts: [] }] })
      const contribution = createD20ChoiceRerollContribution({ interruptId: prompt.id, characterId: 'hero', characterName: 'Hero',
        featureId: 'accuracy', featureLabel: 'Accuracy', decision: 'use', selectedIndex: 1 })
      prompt.contributions = [contribution]
      prompt.payload.rollOptions = { contributionId: contribution.id, values: [originalValue, extra] }
      const response = settleD20RollConfirmation(prompt, contribution.id)
      expect(response.finalValue).toBeDefined()
      const result = applyDnd5eAdvantageReroll(pair, response.finalValue!)
      expect(Math.max(...result)).toBe(Math.max(...pair, extra))
      expect(Math.min(...result)).toBe(Math.min(...pair))
    }
  }
})
it('rejects invalid dice and unauthorized lowering of the advantage result', () => {
  for (const pair of [[], [12], [12, 7, 3], [0, 7], [12, 21], [NaN, 7]]) {
    expect(() => applyDnd5eAdvantageReroll(pair, 15)).toThrow()
  }
  expect(() => applyDnd5eAdvantageReroll([12, 7], 2)).toThrow('cannot-lower')
})
