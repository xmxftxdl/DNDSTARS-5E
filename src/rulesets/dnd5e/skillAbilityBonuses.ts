import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { Dnd5eSkillCheckAbilityBonus } from './plugins/pluginMechanicsContracts'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginRaceDefinition, runtimeDnd5ePluginFeatures } from './plugins/pluginContentCatalog'

export function dnd5eSkillAbilityBonusTotal(
  bonuses: readonly Dnd5eSkillCheckAbilityBonus[] | undefined,
  abilities: Record<AbilityKey, number>, ability: AbilityKey, skill: string,
): number {
  return (bonuses ?? []).reduce((sum, rule) => sum +
    (rule.skill === skill && (rule.ability == null || rule.ability === ability)
      ? Math.floor((Math.min(30, Math.max(1, abilities[rule.bonusAbility])) - 10) / 2) : 0), 0)
}

/** Derive from owned definitions and current scores; never save a computed bonus. */
export function dnd5eImportedSkillAbilityBonus(character: Character, ability: AbilityKey, skill: string): number {
  const race = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  const bonuses = [
    ...(race?.staticModifiers?.skillCheckAbilityBonuses ?? []),
    ...runtimeDnd5ePluginFeatures().flatMap(feature =>
      feature.staticModifiers?.skillCheckAbilityBonuses && dnd5eCharacterHasPluginFeature(character, feature.id)
        ? feature.staticModifiers.skillCheckAbilityBonuses : []),
  ]
  const abilities = { ...character.abilities }
  for (const reduction of character.dnd5eCombatState?.abilityScoreReductionLedger ?? []) {
    abilities[reduction.ability] -= Math.max(0, Math.floor(reduction.amount))
  }
  return dnd5eSkillAbilityBonusTotal(bonuses, abilities, ability, skill)
}
