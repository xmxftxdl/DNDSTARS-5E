import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { Dnd5ePluginStaticCombatModifiers } from './plugins/pluginMechanicsContracts'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginRaceDefinition, runtimeDnd5ePluginFeatures as registeredDnd5ePluginFeatures } from './plugins/pluginContentCatalog'

export function dnd5eInitiativeStaticModifierTotal(
  modifiers: readonly Dnd5ePluginStaticCombatModifiers[],
  abilities: Record<AbilityKey, number>,
): number {
  return modifiers.reduce((total, modifier) => total + (modifier.initiativeBonus ?? 0) +
    (modifier.initiativeBonusFromAbility == null ? 0 :
      Math.floor((Math.min(30, Math.max(1, abilities[modifier.initiativeBonusFromAbility])) - 10) / 2)), 0)
}

/** Uses the same ownership checks as character migration, without storing a derived bonus. */
export function dnd5eImportedInitiativeBonus(character: Character): number {
  const race = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  const modifiers = [
    ...(race?.staticModifiers ? [race.staticModifiers] : []),
    ...registeredDnd5ePluginFeatures().flatMap(feature =>
      feature.staticModifiers && dnd5eCharacterHasPluginFeature(character, feature.id) ? [feature.staticModifiers] : []),
  ]
  const abilities = { ...character.abilities }
  for (const ability of Object.keys(abilities) as AbilityKey[]) {
    abilities[ability] = Math.max(0, abilities[ability] -
      (character.dnd5eCombatState?.abilityScoreReductionLedger ?? []).reduce((sum, reduction) =>
        sum + (reduction.ability === ability ? Math.max(0, Math.floor(reduction.amount)) : 0), 0))
  }
  return dnd5eInitiativeStaticModifierTotal(modifiers, abilities)
}
