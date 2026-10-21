import type { AbilityKey } from '../../lib/dnd'
import { dnd5eActiveSavingThrowBonus } from './activeEffects'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5ePluginRegistryStore } from './plugins/pluginRegistryStore'

/** Read current spell concentration rather than baking a conditional bonus into base statistics. */
export function dnd5eConcentrationDefenseBonus(
  featureIds: readonly string[],
  concentrationSpellId: string | undefined,
  kind: 'armorClass' | 'savingThrows',
): number {
  if (!concentrationSpellId?.trim()) return 0
  let bonus = 0
  for (const id of new Set(featureIds)) {
    const feature = dnd5ePluginRegistryStore.features.get(id)
    if (!feature || feature.automation === 'manual') continue
    const mechanic = feature.declarativeAbility?.mechanic
    if (mechanic?.kind === 'passive-defense') bonus += mechanic.concentrationBonuses?.[kind] ?? 0
  }
  return bonus
}

export function dnd5eCombatantSavingThrowEffectBonus(
  combatant: Pick<Dnd5eCombatant, 'classState' | 'concentrating' | 'pluginFeatureIds'> & Partial<Pick<Dnd5eCombatant, 'proficiencyBonus' | 'savingThrowProficiencies'>>,
  ability?: AbilityKey,
): number {
  return dnd5eActiveSavingThrowBonus(combatant.classState.activeEffects, ability, combatant) +
    dnd5eConcentrationDefenseBonus(combatant.pluginFeatureIds,
      combatant.concentrating ? combatant.classState.concentrationSpellId : undefined, 'savingThrows')
}
