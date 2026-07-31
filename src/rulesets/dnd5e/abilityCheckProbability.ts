import type { D20RollMode } from '../contracts'

function d20OutcomeProbability(
  value: number,
  mode: D20RollMode,
): number {
  if (mode === 'advantage') return (2 * value - 1) / 400
  if (mode === 'disadvantage') return (41 - 2 * value) / 400
  return 1 / 20
}

/**
 * Exact probability that the actor wins a strict opposed check.
 * Ties fail, matching grapple, shove, and escape-grapple resolution.
 */
export function dnd5eOpposedAbilityCheckSuccessProbability(input: {
  actorModifier: number
  actorMode: D20RollMode
  targetModifier: number
  targetMode: D20RollMode
}): number {
  let probability = 0
  for (let actorD20 = 1; actorD20 <= 20; actorD20 += 1) {
    const actorProbability = d20OutcomeProbability(actorD20, input.actorMode)
    for (let targetD20 = 1; targetD20 <= 20; targetD20 += 1) {
      if (
        actorD20 + input.actorModifier <=
        targetD20 + input.targetModifier
      ) {
        continue
      }
      probability += actorProbability *
        d20OutcomeProbability(targetD20, input.targetMode)
    }
  }
  return Math.max(0, Math.min(1, probability))
}
