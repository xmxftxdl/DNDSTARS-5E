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
  const normalizedActivities = activities.map(activity => {
    // A damage-interruption reaction always spends the reaction. Imported
    // recipes may specify only their limited-use resource; supply the missing
    // economy cost without duplicating an explicitly declared reaction cost.
    const consumption = activity.consumption ?? []
    const needsReactionCost = activity.activation.kind === 'reaction' &&
      activity.invocation?.kind === 'triggered' && activity.invocation.event === 'before-damage' &&
      !consumption.some(cost => cost.kind === 'action-economy' && cost.economy === 'reaction')
    return dnd5eActivityWithDerivedAutomationV1(needsReactionCost ? {
      ...activity, consumption: [...consumption, {kind:'action-economy',economy:'reaction',amount:1,consumeOn:'confirm'}],
    } : activity)
  })
  return {
    ...structuredClone(definition),
    activities: normalizedActivities,
    effects: structuredClone(effects),
    automation: dnd5eCombinedAutomationCapabilityV1({ activities: normalizedActivities, effects }),
  }
}

/** Resolve only resource IDs declared by this package. Core and external IDs
 * must remain unchanged; a coincidentally named resource in another package
 * must never satisfy a local cost.
 */
function resolveDeclaredResourceReferences(value: RegisteredContentPackage): readonly RegisteredContentDefinition[] {
  const resourceIds = new Map<string, string>()
  for (const definition of value.definitions) {
    if (definition.kind !== 'feature' && definition.kind !== 'feat') continue
    const payload = definition.payload as { resources?: readonly { id?: unknown }[] } | undefined
    if (!Array.isArray(payload?.resources)) continue
    for (const resource of payload.resources) {
      if (typeof resource.id !== 'string') continue
      resourceIds.set(resource.id, `${value.packageId}:${resource.id}`)
    }
  }
  const rewrite = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(rewrite)
    if (!input || typeof input !== 'object') return input
    return Object.fromEntries(Object.entries(input).map(([key, child]) => [key,
      key === 'resourceId' && typeof child === 'string' ? resourceIds.get(child) ?? child : rewrite(child),
    ]))
  }
  return value.definitions.map(definition => ({ ...definition,
    activities: definition.activities?.map(activity => rewrite(activity)),
  }))
}

/** The sole D&D 5e runtime content registration boundary. */
export function registerDnd5eUnifiedContentPackageV1(
  value: RegisteredContentPackage,
): { dispose(): void } {
  return registerContentDefinitionPackage({
    packageId: value.packageId,
    packageVersion: value.packageVersion,
    definitions: resolveDeclaredResourceReferences(value).map(normalizeDefinition),
  })
}
