import type { DiceRoll } from '../../components/DiceRollOverlay'

/** Retain modifiers when a combat result did not supply an explicit formula. */
export function diceResultFormula(roll: Pick<DiceRoll, 'formula' | 'values' | 'sides' | 'dieSides' | 'bonus'>): string {
  if (roll.formula) return roll.formula
  const dice = roll.dieSides?.length === roll.values.length && new Set(roll.dieSides).size > 1
    ? roll.dieSides.map(sides => `1d${sides}`).join(' + ')
    : `${roll.values.length}d${roll.sides}`
  return dice + (roll.bonus > 0 ? ` + ${roll.bonus}` : roll.bonus < 0 ? ` - ${Math.abs(roll.bonus)}` : '')
}
