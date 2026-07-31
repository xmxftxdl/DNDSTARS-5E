import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5eCombatantClassLevel } from './headlessCombatPrimitives'
import { dnd5ePluginFeatureDefinition } from './pluginApi'

export interface Dnd5eHiddenSpellSaveDisadvantageFeature {
  featureId: string
}

function actorOwnsRegisteredFeature(
  actor: Dnd5eCombatant,
  featureId: string,
): boolean {
  const feature = dnd5ePluginFeatureDefinition(featureId)
  if (!feature || feature.automation !== 'full') return false
  if (
    feature.sourceClassId &&
    dnd5eCombatantClassLevel(actor, feature.sourceClassId) <
      (feature.minimumLevel ?? feature.declarativeAbility?.level ?? 1)
  ) return false
  if (
    feature.sourceClassId &&
    feature.sourceSubclassId &&
    actor.subclassIds?.[feature.sourceClassId] !== feature.sourceSubclassId
  ) return false
  return feature.declarativeAbility?.mechanic?.kind ===
    'hidden-spell-save-disadvantage'
}

export function dnd5eHiddenSpellSaveDisadvantageFeatures(
  actor: Dnd5eCombatant,
): readonly Dnd5eHiddenSpellSaveDisadvantageFeature[] {
  return actor.pluginFeatureIds.flatMap((featureId) =>
    actorOwnsRegisteredFeature(actor, featureId)
      ? [{ featureId }]
      : [],
  )
}

export function dnd5eHiddenSpellSaveDisadvantageApplies(
  actor: Dnd5eCombatant,
  castingFromHidden = actor.classState.hiddenCheckTotal != null,
): boolean {
  return castingFromHidden &&
    dnd5eHiddenSpellSaveDisadvantageFeatures(actor).length > 0
}
