import { expect, it } from 'vitest'
import { createD20ChoiceRerollContribution, createD20RollConfirmationInterrupt, settleD20RollConfirmation } from './rollConfirmation'

function checkpoint(selectionPolicy: 'must-use-latest' | 'owner-chooses' = 'must-use-latest', dice = [7]) {
  const interrupt = createD20RollConfirmationInterrupt({ mapId: 'map', rollId: 'roll', label: 'Reroll', originalValue: 7,
    eligibleModifiers: [{ characterId: 'hero', featureId: 'reroll', featureLabel: 'Reroll', modifierKind: 'choice-reroll',
      rerollScope: 'self-roll', additionalDice: dice.length as 1 | 2, selectionPolicy,
      resourceCosts: [{ resourceKey: 'uses', amount: 1 }] }] })
  const contribution = createD20ChoiceRerollContribution({ interruptId: interrupt.id, characterId: 'hero', characterName: 'Hero',
    featureId: 'reroll', featureLabel: 'Reroll', decision: 'use' })
  interrupt.contributions = [contribution]
  interrupt.payload.rollOptions = { contributionId: contribution.id, values: [7, ...dice] }
  return { interrupt, contribution }
}
it('resumes a persisted reroll without receiving or generating another die', () => {
  const { interrupt, contribution } = checkpoint('must-use-latest', [3])
  const restored = JSON.parse(JSON.stringify(interrupt))
  const before = structuredClone(restored)
  const result = settleD20RollConfirmation(restored, contribution.id)
  expect(result.finalValue).toBe(3)
  expect(result.choiceReroll).toMatchObject({ rerollValues: [3], selectedIndex: 1 })
  expect(restored).toEqual(before)
  expect(settleD20RollConfirmation(restored, contribution.id).choiceReroll).toEqual(result.choiceReroll)
})
it('records the latest die identity even when its face equals an earlier die', () => {
  const { interrupt, contribution } = checkpoint('must-use-latest', [7, 7])
  const result = settleD20RollConfirmation(interrupt, contribution.id)
  expect(result.choiceReroll).toMatchObject({ selectedIndex: 2, selectedValue: 7, rerollValues: [7, 7] })
  expect(result.transaction?.rollLedger.entries).toHaveLength(2)
})
it('keeps owner selection pending after reload and accepts the exact saved option', () => {
  const { interrupt, contribution } = checkpoint('owner-chooses', [18])
  expect(() => settleD20RollConfirmation(interrupt, contribution.id)).toThrow('player-selection-pending')
  expect(settleD20RollConfirmation(interrupt, contribution.id, 20, undefined, undefined, undefined, 1).finalValue).toBe(18)
})
it('rejects contradictory dice, an altered original face and another contribution checkpoint', () => {
  const { interrupt, contribution } = checkpoint('must-use-latest', [3])
  expect(() => settleD20RollConfirmation(interrupt, contribution.id, 20, undefined, undefined, 19)).toThrow('checkpoint-mismatch')
  expect(settleD20RollConfirmation(interrupt, contribution.id, 20, undefined, undefined, 3).finalValue).toBe(3)
  const changed = structuredClone(interrupt)
  changed.payload.rollOptions!.values[0] = 8
  expect(() => settleD20RollConfirmation(changed, contribution.id)).toThrow('checkpoint-mismatch')
  changed.payload.rollOptions = { contributionId: 'other', values: [7, 3] }
  expect(() => settleD20RollConfirmation(changed, contribution.id)).toThrow('checkpoint-mismatch')
})
it('rejects malformed persisted reroll counts and nonnumeric dice without coercion', () => {
  const { interrupt, contribution } = checkpoint()
  for (const dice of [[], [2, 3], ['7'], [0], [21]]) {
    const changed = structuredClone(interrupt)
    Object.assign(changed.payload.rollOptions!, { values: [7, ...dice] })
    expect(() => settleD20RollConfirmation(changed, contribution.id)).toThrow('invalid-roll-confirmation-choice-reroll')
  }
})
