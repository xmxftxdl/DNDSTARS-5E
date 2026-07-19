import type { Token } from '../store/maps'
import { dnd5eConditionsFromActiveEffects } from '../rulesets/dnd5e/activeEffects'
import { dnd5eStandardConditionId } from '../rulesets/dnd5e/conditions'

const ZERO_SPEED_CONDITIONS = new Set([
  'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious',
])

export function isMovementLocked(conditions: readonly string[]): boolean {
  return conditions.some((condition) => {
    const id = dnd5eStandardConditionId(condition)
    return !!id && ZERO_SPEED_CONDITIONS.has(id)
  })
}

export function isTokenMovementLocked(token: Pick<Token, 'dnd5eCombatState'>): boolean {
  const conditions = token.dnd5eCombatState?.conditions ??
    dnd5eConditionsFromActiveEffects(token.dnd5eCombatState?.activeEffects)
  return isMovementLocked(conditions)
}
