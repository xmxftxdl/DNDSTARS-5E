import { normalizeDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from '../../rulesets/dnd5e'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'

/**
 * A linked character and its map token are both durable combat-state sources.
 * Read their effect union for DM presentation and editing so a partially
 * persisted historical mirror never becomes invisible or impossible to remove.
 */
export function dnd5eMergedCombatantActiveEffects(input: {
  character?: Pick<Character, 'dnd5eCombatState'>
  token?: Pick<Token, 'dnd5eCombatState'>
}): Dnd5eActiveEffectInstance[] {
  return normalizeDnd5eActiveEffects([
    ...(input.character?.dnd5eCombatState?.activeEffects ?? []),
    ...(input.token?.dnd5eCombatState?.activeEffects ?? []),
  ])
}
