import type { Character } from '../../types/character'
import { dnd5eCharacterHasPluginFeature, registeredDnd5ePluginFeatures } from './pluginApi'
import type { Dnd5eCombatant } from './headlessCombatEngine'

export type Dnd5eEnvironmentalHazard = 'extreme-heat' | 'extreme-cold'

export function dnd5eCombatantEnvironmentalImmunities(actor: Dnd5eCombatant): readonly Dnd5eEnvironmentalHazard[] {
  const result = new Set<Dnd5eEnvironmentalHazard>()
  for (const feature of registeredDnd5ePluginFeatures()) {
    const ability = feature.declarativeAbility, classId = feature.sourceClassId
    if (feature.automation === 'manual' || ability?.automation !== 'full' || ability.mechanic?.kind !== 'passive-defense' ||
      !actor.pluginFeatureIds.includes(feature.id)) continue
    if (classId) {
      const level = actor.classLevels?.[classId] ?? (actor.classId === classId ? actor.level : 0)
      const subclass = actor.subclassIds?.[classId] ?? (actor.classId === classId ? actor.subclassId : undefined)
      if (level < (feature.minimumLevel ?? 1) || (feature.sourceSubclassId && subclass !== feature.sourceSubclassId)) continue
      if (ability.predicates?.subclassChoices?.some(choice => {
        const key = `${feature.sourceSubclassId}/${choice.groupId}`
        const selected = actor.classSelectionsByClass?.[classId]?.[key] ?? (actor.classId === classId ? actor.classSelections[key] : undefined)
        return !selected?.includes(choice.optionId)
      })) continue
    }
    for (const hazard of ability.mechanic.environmentalImmunities ?? []) result.add(hazard)
  }
  return [...result]
}

/** Re-evaluate actual ownership, class level and selected environment on every query. */
export function dnd5eCharacterEnvironmentalImmunities(character: Character): readonly Dnd5eEnvironmentalHazard[] {
  const result = new Set<Dnd5eEnvironmentalHazard>()
  for (const feature of registeredDnd5ePluginFeatures()) {
    const ability = feature.declarativeAbility
    if (feature.automation === 'manual' || ability?.automation !== 'full' ||
      ability.mechanic?.kind !== 'passive-defense' || !dnd5eCharacterHasPluginFeature(character, feature.id)) continue
    for (const hazard of ability.mechanic.environmentalImmunities ?? []) result.add(hazard)
  }
  return [...result]
}
