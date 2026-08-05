import type {
  Dnd5eClassDamageDefinition,
  Dnd5eClassDamageRolls,
} from '../../rulesets/dnd5e/headlessCombatEngine'

export function dnd5eWeaponDamagePreviewTotal(
  baseDamageTotal: number,
  definitions: readonly Dnd5eClassDamageDefinition[],
  rolls: readonly Dnd5eClassDamageRolls[],
): number {
  let additionalDamage = 0
  let weaponDamageReduction = 0
  for (const definition of definitions) {
    const supplied = rolls.find((entry) => entry.source === definition.source)?.rolls ?? []
    const total = Math.max(0, supplied.reduce((sum, value) => sum + value, 0) + (definition.bonus ?? 0))
    if (definition.operation === 'subtract-from-weapon') weaponDamageReduction += total
    else additionalDamage += total
  }
  const normalizedBaseDamage = Math.max(0, baseDamageTotal)
  const reducedWeaponDamage = normalizedBaseDamage > 0
    ? Math.max(1, normalizedBaseDamage - weaponDamageReduction)
    : 0
  return reducedWeaponDamage + additionalDamage
}
