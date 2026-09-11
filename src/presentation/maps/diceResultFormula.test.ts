import { expect, it } from 'vitest'
import { diceResultFormula } from './diceResultFormula'

it('shows the negative modifier responsible for a total below the visible dice sum', () => {
  expect(diceResultFormula({ values: [3, 2], sides: 12, bonus: -1 })).toBe('2d12 - 1')
  expect(diceResultFormula({ values: [3, 2], sides: 12, bonus: 0 })).toBe('2d12')
  expect(diceResultFormula({ values: [3, 2], sides: 12, bonus: 4 })).toBe('2d12 + 4')
})

it('keeps explicit keep-high/low formulas and mixed dice', () => {
  expect(diceResultFormula({ values: [3, 2], sides: 20, bonus: 1, formula: '2d20kl1 + 1' })).toBe('2d20kl1 + 1')
  expect(diceResultFormula({ values: [3, 2], sides: 12, dieSides: [6, 12], bonus: -1 })).toBe('1d6 + 1d12 - 1')
})
