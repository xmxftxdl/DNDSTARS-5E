import type { DeclarativeDamageMitigationInterruptMechanicV1 } from './declarativeSubclassAbility'
import type { Dnd5eClassId } from './classes'

/** Shared by the dice UI and Host; multiclass scaling uses only the declared class. */
export function dnd5eDamageMitigationDice(mechanic: DeclarativeDamageMitigationInterruptMechanicV1, classLevel: (id: Dnd5eClassId) => number) {
  const dice = mechanic.reductionDice
  if (!dice) return undefined
  const level = dice.classId ? classLevel(dice.classId) : 0
  const upgrade = dice.upgrades?.filter(entry => entry.level <= level).sort((a, b) => b.level - a.level)[0]
  return { count: upgrade?.count ?? dice.count, sides: dice.sides }
}
