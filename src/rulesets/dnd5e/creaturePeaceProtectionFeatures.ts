import type { Dnd5eCombatant } from './headlessCombatEngine'
import type { Dnd5eClassId } from './classes'
import { dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass } from './headlessCombatPrimitives'
import { dnd5ePluginFeatureDefinition } from './pluginApi'

/** Shared ownership gate; individual source exclusions remain in damage settlement. */
export function dnd5eCreaturePeaceProtectionFeatures(owner: Dnd5eCombatant) {
  return owner.pluginFeatureIds.flatMap(id => {
    const feature = dnd5ePluginFeatureDefinition(id)
    const ability = feature?.declarativeAbility
    const rule = ability?.mechanic?.kind === 'passive-defense' ? ability.mechanic.creaturePeaceProtection : undefined
    if (!feature || feature.automation !== 'full' || ability?.trigger.kind !== 'passive' || !rule ||
      (feature.sourceClassId && dnd5eCombatantClassLevel(owner, feature.sourceClassId as Dnd5eClassId) < (feature.minimumLevel ?? 1)) ||
      (feature.sourceClassId && feature.sourceSubclassId && !dnd5eCombatantHasSubclass(owner, feature.sourceClassId, feature.sourceSubclassId))) return []
    return [{ feature, rule }]
  })
}
