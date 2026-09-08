import {
  normalizeDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
} from '../../rulesets/dnd5e/activeEffects'

/**
 * Condition labels are only a projection of authoritative Active Effects.
 * Mechanical effects such as Mirror Image have no standard condition, so a
 * condition-only comparison must not suppress their add/remove transaction.
 */
export function dnd5eActiveEffectListsDiffer(
  current: readonly Dnd5eActiveEffectInstance[] | undefined,
  next: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return JSON.stringify(normalizeDnd5eActiveEffects(current)) !==
    JSON.stringify(normalizeDnd5eActiveEffects(next))
}
