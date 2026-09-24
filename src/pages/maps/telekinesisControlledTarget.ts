import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { effectiveDnd5eActiveEffects } from '../../rulesets/dnd5e/activeEffects'

/** Control belongs to this caster, never to another caster's restrained target. */
export function telekinesisControlledTarget(map: BattleMap, characters: readonly Character[], casterTokenId: string): Token | undefined {
  return map.tokens.find(token => {
    if (token.type === 'obstacle') return false
    const character = token.characterId ? characters.find(candidate => candidate.id === token.characterId) : undefined
    return effectiveDnd5eActiveEffects(character?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects).some(effect =>
      effect.source.actorId === casterTokenId && effect.tags?.includes('telekinesis-controlled'))
  })
}
