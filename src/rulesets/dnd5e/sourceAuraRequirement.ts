import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from './headlessCombatPrimitives'

/** A recipient Effect remains conditional on its original source's live aura. */
export interface Dnd5eSourceAuraRequirement {
  radiusFeet: number
  requiresRage?: true
  requiresLineOfEffect?: true
}

/** Shared by damage settlement and defensive-trait disclosure. */
export function dnd5eSourceAuraRequirementSatisfied(
  state: Dnd5eHeadlessCombatState | undefined, sourceId: string | undefined,
  targetId: string, requirement: Dnd5eSourceAuraRequirement,
): boolean {
  const source = sourceId && state?.combatants[sourceId]
  if (!state || !sourceId || !source || source.currentHp <= 0) return false
  if (requirement.requiresRage && source.classState.raging !== true) return false
  const distance = sourceId === targetId ? 0
    : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(sourceId, targetId)]
  if (distance == null || !Number.isFinite(distance) || distance < 0 || distance > requirement.radiusFeet) return false
  return !requirement.requiresLineOfEffect ||
    !state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(sourceId, targetId)]
}

export function isDnd5eSourceAuraRequirement(value: unknown): value is Dnd5eSourceAuraRequirement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rule = value as Record<string, unknown>
  return Object.keys(rule).every(key => ['radiusFeet', 'requiresRage', 'requiresLineOfEffect'].includes(key)) &&
    typeof rule.radiusFeet === 'number' && Number.isFinite(rule.radiusFeet) && rule.radiusFeet >= 0 && rule.radiusFeet <= 10_000 &&
    (rule.requiresRage == null || rule.requiresRage === true) &&
    (rule.requiresLineOfEffect == null || rule.requiresLineOfEffect === true)
}
