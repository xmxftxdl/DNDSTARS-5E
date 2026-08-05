import {
  dnd5eActiveSpeedBonus,
  dnd5eActiveSpeedMultiplier,
  dnd5eActiveSpeedPenalty,
  type Dnd5eActiveEffectInstance,
} from '../../rulesets/dnd5e/activeEffects'

export interface MonsterMovementProjectionSource {
  dnd5eCombatState?: {
    activeEffects?: Dnd5eActiveEffectInstance[]
    caltropsSpeedPenaltyFeet?: number
  }
}

export function dnd5eMonsterTokenEffectiveSpeed(
  token: MonsterMovementProjectionSource,
  baseSpeed: number,
): number {
  const effects = token.dnd5eCombatState?.activeEffects
  const adjusted = Math.max(
    0,
    Math.floor(baseSpeed) -
      dnd5eActiveSpeedPenalty(effects) -
      Math.max(0, token.dnd5eCombatState?.caltropsSpeedPenaltyFeet ?? 0) +
      dnd5eActiveSpeedBonus(effects),
  )
  return Math.max(0, Math.floor(adjusted * dnd5eActiveSpeedMultiplier(effects)))
}
