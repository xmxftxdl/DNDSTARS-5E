import {
  registerContentDefinitionPackage,
  type RegisteredContentDefinition,
  type RegisteredContentPackage,
} from '../../../domain/content/contentDefinitionRegistry'
import { dnd5eCombinedAutomationCapabilityV1, dnd5eActivityWithDerivedAutomationV1 } from '../plugins/pluginMechanicsRegistry'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
import { validateDnd5eActivityDefinitionV1, validateDnd5eEffectDefinitionV1 } from './dnd5eActivityValidation'

function normalizeDefinition(definition: RegisteredContentDefinition): RegisteredContentDefinition {
  const activities = (definition.activities ?? []) as readonly Dnd5eActivityDefinitionV1[]
  const effects = (definition.effects ?? []) as readonly Dnd5eEffectDefinitionV1[]
  for (const activity of activities) {
    const errors = validateDnd5eActivityDefinitionV1(activity)
    if (errors.length) throw new Error(`Invalid Activity ${activity.id}: ${errors.join('; ')}`)
  }
  for (const effect of effects) {
    const errors = validateDnd5eEffectDefinitionV1(effect)
    if (errors.length) throw new Error(`Invalid Effect ${effect.id}: ${errors.join('; ')}`)
  }
  const normalizedActivities = activities.map(dnd5eActivityWithDerivedAutomationV1)
  return {
    ...structuredClone(definition),
    activities: normalizedActivities,
    effects: structuredClone(effects),
    automation: dnd5eCombinedAutomationCapabilityV1({ activities: normalizedActivities, effects }),
  }
}

/** The sole D&D 5e runtime content registration boundary. */
export function registerDnd5eUnifiedContentPackageV1(
  value: RegisteredContentPackage,
): { dispose(): void } {
  return registerContentDefinitionPackage({
    packageId: value.packageId,
    packageVersion: value.packageVersion,
    definitions: value.definitions.map(normalizeDefinition),
  })
}
