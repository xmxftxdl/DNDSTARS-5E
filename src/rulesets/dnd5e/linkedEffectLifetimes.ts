import type { Dnd5eActiveEffectInstance } from './activeEffects'

export interface Dnd5eEffectLifetimePeer {
  actorId: string
  characterId?: string
  dead: boolean
  effects: readonly Dnd5eActiveEffectInstance[]
}

export function dnd5eHasLinkedEffectLifetime(effect: Dnd5eActiveEffectInstance): boolean {
  return !!effect.linkedLifetime || effect.removal?.sourceLink?.sourceRequiresEffectSameApplication === true
}

/** Unknown/ambiguous peers are not evidence of expiry. Stable character IDs
 * prevent a reused token ID from binding an unrelated character after reload. */
export function dnd5eLinkedEffectLifetimeEnded(
  effect: Dnd5eActiveEffectInstance, bearerDead: boolean, peers: readonly Dnd5eEffectLifetimePeer[],
): boolean {
  const sourceLink = effect.removal?.sourceLink
  if (sourceLink?.sourceRequiresEffectSameApplication && sourceLink.sourceRequiresEffectInstanceId) {
    const matches = peers.filter(peer => effect.source.characterId
      ? peer.characterId === effect.source.characterId : peer.actorId === effect.source.actorId)
    // Captivity binds a corpse and can outlive its caster. Only a confirmed
    // controller removal ends this link; absence from a map is not removal.
    if (matches.length === 1 && !matches[0].effects.some(candidate => candidate.id === sourceLink.sourceRequiresEffectInstanceId)) return true
  }
  const link = effect.linkedLifetime
  if (!link) return false
  if (bearerDead) return true
  const matches = peers.filter(peer => link.characterId
    ? peer.characterId === link.characterId
    : peer.actorId === link.actorId)
  if (matches.length !== 1) return false
  return matches[0].dead || !matches[0].effects.some(candidate => candidate.id === link.effectId)
}
