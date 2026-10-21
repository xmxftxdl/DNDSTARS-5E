import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActiveEffectInstance } from './activeEffects'

/** Never restore an expired concentration enchantment from an unattended item snapshot. */
export function liveDnd5eMapInventoryBoundEffects(effects: readonly Dnd5eActiveEffectInstance[], map: BattleMap,
  characters: readonly Character[]): Dnd5eActiveEffectInstance[] {
  return effects.filter(effect => {
    const duration = effect.duration
    if (duration.type !== 'concentration') return duration.type !== 'rounds' || duration.remainingRounds > 0
    if (duration.remainingRounds != null && duration.remainingRounds <= 0) return false
    const token = map.tokens.find(t => t.id === duration.sourceActorId)
    const character = characters.find(c => c.id === (effect.source.characterId ?? token?.characterId ?? duration.sourceActorId))
    const state = character?.dnd5eCombatState ?? token?.dnd5eCombatState
    if (effect.source.executionId && !state?.activeEffects?.some(anchor => anchor.source.executionId === effect.source.executionId &&
      anchor.source.rulesId === effect.source.rulesId && anchor.duration.type === 'concentration')) return false
    return (!character || character.concentrating === true) && !!state?.concentrationSpellId &&
      state.concentrationSpellId === (duration.concentrationId ?? effect.source.rulesId)
  })
}
