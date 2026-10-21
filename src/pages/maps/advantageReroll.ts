/** Host highest-policy confirmation replaces the adopted result, preserving the lower die. */
export function applyDnd5eAdvantageReroll(values: readonly number[], confirmed: number): [number, number] {
  if (values.length !== 2 || [...values, confirmed].some(value => !Number.isInteger(value) || value < 1 || value > 20)) {
    throw Error('invalid-advantage-reroll-dice')
  }
  const [first, second] = values
  if (confirmed < Math.max(first, second)) throw Error('advantage-reroll-cannot-lower-result')
  if (confirmed === Math.max(first, second)) return [first, second]
  return first >= second ? [confirmed, second] : [first, confirmed]
}
