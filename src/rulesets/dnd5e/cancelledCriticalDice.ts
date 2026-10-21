/** Retain the original normal dice when a Host-authorized reaction cancels a
 * critical. Validate even discarded dice, so malformed submissions still fail. */
export function dnd5eCancelledCriticalDice(rolls: readonly number[], count: number, sides: number, cancelled: boolean): readonly number[] {
  if (!cancelled) return rolls
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(sides) || sides < 1 ||
    (rolls.length !== count && rolls.length !== count * 2) ||
    rolls.some(value => !Number.isInteger(value) || value < 1 || value > sides)) throw new Error('invalid-cancelled-critical-dice')
  return rolls.slice(0, count)
}
