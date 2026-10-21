import { effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import type { Dnd5eStandardConditionId } from './conditions'

export function dnd5ePersistentAreaEffectTag(areaId: string): string {
  return `persistent-area:${areaId}`
}

export function dnd5ePersistentAreaEffectMatchesOrigin(
  effect: Pick<Dnd5eActiveEffectInstance, 'tags' | 'areaLifetime'>, areaId: string, allowUnscopedLegacy = false,
): boolean {
  const origins = effect.tags?.filter(value => value.startsWith('persistent-area:')) ?? []
  // Runtime area IDs can exceed the short tag limit. The structured lifetime
  // link survives normalization; reject contradictory tags if they are present.
  if (effect.areaLifetime) return effect.areaLifetime.areaId === areaId &&
    (origins.length === 0 || origins.length === 1 && origins[0] === dnd5ePersistentAreaEffectTag(areaId))
  return origins.length ? origins.length === 1 && origins[0] === dnd5ePersistentAreaEffectTag(areaId) : allowUnscopedLegacy
}

/** Exact instance provenance is required for new effects. Legacy native saves retain their old fallback. */
export function dnd5ePersistentAreaConditionEffects(input: {
  effects: readonly Dnd5eActiveEffectInstance[] | undefined
  areaId: string
  sourceId: string
  condition: Dnd5eStandardConditionId
  legacyCoreSpellId?: string
}): Dnd5eActiveEffectInstance[] {
  return effectiveDnd5eActiveEffects(input.effects).filter(effect => {
    if (effect.standardCondition !== input.condition || effect.source.actorId !== input.sourceId) return false
    return dnd5ePersistentAreaEffectMatchesOrigin(effect, input.areaId,
      !!input.legacyCoreSpellId && effect.source.kind === 'spell' && effect.source.rulesId === input.legacyCoreSpellId)
  })
}
