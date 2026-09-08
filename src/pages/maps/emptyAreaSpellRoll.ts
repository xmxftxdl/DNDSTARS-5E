export interface Dnd5eEmptyAreaSpellRollInput {
  effect: string
  diceCount: number
  dieSides: number
  maximizedDamage?: boolean
}

/**
 * HP-pool spells still roll their pool when a legal area contains no creature.
 * Unlike ordinary area damage, the roll is part of the spell's effect rather
 * than damage assigned to a target.
 */
export function dnd5eEmptyAreaSpellRollPlan(
  input: Dnd5eEmptyAreaSpellRollInput,
): { count: number; sides: number } | undefined {
  if (input.maximizedDamage) return undefined
  if (
    input.effect !== 'sleep-hit-point-pool' &&
    input.effect !== 'color-spray-hit-point-pool'
  ) return undefined
  if (!Number.isInteger(input.diceCount) || input.diceCount < 1) return undefined
  if (!Number.isInteger(input.dieSides) || input.dieSides < 2) return undefined
  return { count: input.diceCount, sides: input.dieSides }
}
