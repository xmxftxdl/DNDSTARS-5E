import { effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'

/** Project live, source-qualified charm facts for Activity authority and previews. */
export function dnd5eActiveCharmSourceIds(effects: readonly Dnd5eActiveEffectInstance[] | undefined, magicSuppressed?: boolean): string[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(effect =>
    effect.standardCondition === 'charmed' && effect.source.actorId &&
    !(magicSuppressed && (effect.source.magical === true || (effect.source.kind === 'spell' && effect.source.magical !== false)))
      ? [effect.tags?.find(tag => tag.startsWith('condition-entity:'))?.slice('condition-entity:'.length) ?? effect.source.actorId] : []))]
}

/** Source-specific attitude is separate from faction membership and control. */
export function dnd5eActiveAttitudeTowardSource(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  source: { actorId: string; characterId?: string },
  magicSuppressed = false,
): 'friendly' | undefined {
  return effectiveDnd5eActiveEffects(effects).some(effect =>
    effect.sourceAttitude === 'friendly' && !!effect.source.actorId &&
    (effect.source.actorId === source.actorId || !!source.characterId && effect.source.characterId === source.characterId) &&
    !(magicSuppressed && (effect.source.magical === true || (effect.source.kind === 'spell' && effect.source.magical !== false))))
    ? 'friendly' : undefined
}
