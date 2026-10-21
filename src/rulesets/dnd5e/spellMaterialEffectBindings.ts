import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { Dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'

/** Called only after authoritative material revalidation. No input mutation on failure. */
export function bindDnd5eSpellMaterialEffects(
  plan: Dnd5eSpellMaterialConsumptionPlan,
  before: readonly Dnd5eActiveEffectInstance[],
  after: readonly Dnd5eActiveEffectInstance[],
  existing: readonly Dnd5eActiveEffectInstance[],
  sourceRulesId?: string,
  sourcePackageId?: string,
): Dnd5eActiveEffectInstance[] | undefined {
  const previousIds = new Set(before.map(effect => effect.id))
  const bindings = new Map<string, string>()
  const items = new Set<string>()
  for (const allocation of plan.allocations) {
    if (!allocation.bindEffectId) continue
    if (plan.consumptionTiming === 'spell-end' || allocation.consumed || allocation.quantity !== 1 || items.has(allocation.instanceId)) return undefined
    if (existing.some(effect => effect.removal?.onInventoryInstanceDestroyed === allocation.instanceId)) return undefined
    const candidates = after.filter(effect => {
      const definitionId = effect.definitionId.replace(/:(?:modifiers:\d+|extension|marker)$/, '')
      const matches = definitionId === allocation.bindEffectId ||
        (sourceRulesId != null && definitionId.startsWith('activity:') && definitionId.endsWith(`:${allocation.bindEffectId}`))
      const sourceMatches = sourceRulesId == null || effect.source.rulesId === sourceRulesId ||
        (sourcePackageId != null && effect.source.pluginId === sourcePackageId &&
          `${sourcePackageId}:${effect.source.rulesId}` === sourceRulesId)
      return matches && !previousIds.has(effect.id) && sourceMatches
    })
    if (candidates.length !== 1 || bindings.has(candidates[0].id) || candidates[0].removal?.onInventoryInstanceDestroyed) return undefined
    bindings.set(candidates[0].id, allocation.instanceId)
    items.add(allocation.instanceId)
  }
  return after.map(effect => {
    const instanceId = bindings.get(effect.id)
    return instanceId ? { ...effect, removal: { ...effect.removal, onInventoryInstanceDestroyed: instanceId } } : effect
  })
}
