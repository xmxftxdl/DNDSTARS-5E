import type { Dnd5ePredicateV1 } from './dnd5eEffectContracts'

/** Match identity, semantic tags and ownership on the same Host effect. */
export function dnd5eActivityEffectMatches(
  predicate: Extract<Dnd5ePredicateV1, { kind: 'active-effect' }>,
  effect: { definitionId: string; sourceActorId?: string; sourceCharacterId?: string; sourceRulesId?: string; sourcePluginId?: string; sourcePluginAvailable?: boolean; tags?: readonly string[]; suspended?: boolean },
  actorId: string,
  targetId?: string,
  actorCharacterId?: string,
  targetCharacterId?: string,
): boolean {
  const sameSource=(tokenId:string,characterId?:string)=>effect.sourceCharacterId
    ? effect.sourceCharacterId===characterId : effect.sourceActorId===tokenId
  if (predicate.source === 'self' && !sameSource(actorId,actorCharacterId)) return false
  if (predicate.source === 'target' && (!targetId || !sameSource(targetId,targetCharacterId) || effect.suspended)) return false
  return predicate.anyOf ? !effect.suspended && predicate.anyOf.some(selector =>
    (selector.sourceRulesId == null || selector.sourceRulesId === effect.sourceRulesId) &&
    (selector.sourcePluginId == null || (selector.sourcePluginId === effect.sourcePluginId && effect.sourcePluginAvailable === true)) &&
    (selector.effectId != null
      ? effect.definitionId === selector.effectId || effect.definitionId.endsWith(`:${selector.effectId}`)
      : selector.tags.every(tag => effect.tags?.includes(tag)))) :
    effect.definitionId === predicate.effectId || effect.definitionId.endsWith(`:${predicate.effectId}`) ||
      effect.definitionId.includes(`:${predicate.effectId}:`)
}
