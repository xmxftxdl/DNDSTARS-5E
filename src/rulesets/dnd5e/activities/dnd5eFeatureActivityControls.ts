import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import type { RegisteredDnd5ePluginFeature } from '../pluginApi'
import { contentDefinitionRegistryRevision, listRegisteredContentActivities } from '../../../domain/content/contentDefinitionRegistry'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5ePluginHeadlessActionDefinition } from '../plugins/pluginHeadlessRuntimeRegistry'
import { scaleDnd5eActivityDefinitionV1, type Dnd5eActivityScalingContextV1 } from './dnd5eActivityScaling'

let indexedRevision = -1
const activitiesByPackageAndSource = new Map<string, Map<string, readonly Dnd5eActivityDefinitionV1[]>>()

/** Keep private snapshots; callers receive copies of only their own controls. */
function activitiesForSource(packageId: string, kind: string, id: string): readonly Dnd5eActivityDefinitionV1[] {
  const revision = contentDefinitionRegistryRevision()
  if (revision !== indexedRevision) {
    activitiesByPackageAndSource.clear()
    indexedRevision = revision
  }
  let index = activitiesByPackageAndSource.get(packageId)
  if (!index) {
    const next = new Map<string, Dnd5eActivityDefinitionV1[]>()
    for (const activity of listRegisteredContentActivities<Dnd5eActivityDefinitionV1>(packageId)) {
      if (!activity.legacySource) continue
      const key = JSON.stringify([activity.legacySource.kind, activity.legacySource.id])
      const entries = next.get(key) ?? []
      entries.push(activity)
      next.set(key, entries)
    }
    index = next
    activitiesByPackageAndSource.set(packageId, index)
  }
  return (index.get(JSON.stringify([kind, id])) ?? []).map(activity => structuredClone(activity))
}

/** Additional controls retain the owning feature's entitlement and prerequisites. */
export function dnd5eFeatureActivityControls(feature: RegisteredDnd5ePluginFeature, scaling?: Dnd5eActivityScalingContextV1) {
  // Subclass ownership also applies to independently authored features. Only
  // embedded declarative abilities use the subclass-ability source namespace.
  const subclassAbility = feature.sourceSubclassId && feature.declarativeAbility
  const sourceKind = subclassAbility ? 'subclass-ability' : feature.sourceFeatId ? 'feat' : 'feature'
  const sourceId = feature.sourceFeatId ?? feature.id
  const localFeatureId = sourceId.startsWith(`${feature.ownerPluginId}:`)
    ? sourceId.slice(feature.ownerPluginId.length + 1) : sourceId
  const localId = subclassAbility
    ? `${feature.sourceSubclassId!.slice(feature.ownerPluginId.length + 1)}:${subclassAbility.id}`
    : localFeatureId
  return activitiesForSource(feature.ownerPluginId, sourceKind, localId)
    .flatMap(activity => {
      if (activity.authorityBinding || activity.legacySource?.kind !== sourceKind || activity.legacySource.id !== localId) return []
      const invocation = activity.invocation
      if (invocation && invocation.kind !== 'active' && !(invocation.kind === 'triggered' &&
        ['long-rest-complete', 'short-rest-complete','long-rest-started','short-rest-started'].includes(invocation.event))) return []
      if (!['full', 'assisted'].includes(activity.automation.level)) return []
      if (!dnd5ePluginHeadlessActionDefinition(feature.ownerPluginId, activity.id)) return []
      const action = feature.action?.id === activity.id ? feature.action : dnd5ePluginFeatureActionFromActivityV1(activity)
      if (!action) return []
      const projected = scaling && activity.scaling?.length
        ? dnd5ePluginFeatureActionFromActivityV1(scaleDnd5eActivityDefinitionV1(activity, scaling).activity)
        : undefined
      return [{ activity, action: projected ? { ...action, targeting: projected.targeting } : action }]
    })
}

/** Resolve the room interaction from the same owned controls accepted by the
 * feature facade. Invalid explicit selections must not fall back to a default. */
export function dnd5eRequestedFeatureActivity(
  feature: RegisteredDnd5ePluginFeature | undefined,
  payload: unknown,
): Dnd5eActivityDefinitionV1 | undefined {
  if (!feature) return undefined
  const requested = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).selectedActivityId : undefined
  if (requested != null) {
    return typeof requested === 'string'
      ? dnd5eFeatureActivityControls(feature).find(control => control.activity.id === requested)?.activity
      : undefined
  }
  return feature.action ? getRegisteredDnd5eActivity(feature.ownerPluginId, feature.action.id) : undefined
}
