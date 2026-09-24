import { getRegisteredContentDefinition } from '../../../domain/content/contentDefinitionRegistry'
import type { StarModPackage } from '../../../domain/packages/starmodArchive'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'

/** Resolve namespaced condition templates before the ordinary Activity validator runs. */
export function dnd5eActivitiesWithConditionReferences(pkg: StarModPackage, entryId: string, entryType: string): readonly unknown[] | undefined {
  const entry = pkg.entries.find(e => e.id === entryId && e.type === entryType)
  const automation = entry?.automationData
  const activities = structuredClone(automation?.activities) as Dnd5eActivityDefinitionV1[] | undefined
  for (const reference of automation?.conditionRefs ?? []) {
    const owner = reference.packageId ?? pkg.manifest.packageId
    if (owner !== pkg.manifest.packageId && !pkg.manifest.dependencies.some(d => d.packageId === owner)) throw new Error(`condition-dependency-undeclared: ${owner}`)
    const local = pkg.entries.find(e => owner === pkg.manifest.packageId && e.type === 'Condition' && e.id === reference.conditionId)
    const external = owner === pkg.manifest.packageId ? undefined : getRegisteredContentDefinition(owner,'condition',reference.conditionId)
    const payload = (local?.rulesData ?? external?.payload) as {effectId?: string} | undefined
    const effects = (local?.automationData?.effects ?? external?.effects) as readonly Dnd5eEffectDefinitionV1[] | undefined
    const effect = effects?.find(e => e.id === payload?.effectId)
    const activity = activities?.find(a => a.id === reference.activityId)
    if (!effect || !activity) throw new Error(`condition-reference-unavailable: ${owner}:${reference.conditionId}`)
    const existing = activity.effects?.find(e => e.id === effect.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(effect)) throw new Error(`condition-effect-conflict: ${effect.id}`)
    if (!existing) activity.effects = [...(activity.effects ?? []), structuredClone(effect)]
  }
  return activities
}
