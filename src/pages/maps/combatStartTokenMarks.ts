/**
 * Presentation-only combat state that must never leak into a new combat.
 *
 * Deliberately keep authoritative effects, conditions and concentration out of
 * this shape: those can remain valid across a combat boundary and are cleared
 * only by their own rule transaction.
 */
export interface Dnd5eTransientCombatStartTokenMarkState {
  monsterDamageAversionActive?: boolean
  monsterDamageAversionSourceActorId?: string
  monsterRegenerationSuppressedDamageTypes?: string[]
  /** One-shot initiative ownership cannot survive the combat that created it. */
  activityExtraTurnGroup?: unknown
  /** Time Stop suspension is paired with the one-shot group above. */
  activityExtraTurnSuspension?: unknown
  activeEffects?: unknown[]
}

const ACTIVITY_EXTRA_TURN_SUSPENSION_PREFIX = 'activity-extra-turns:suspension:'

function isActivityExtraTurnSuspensionEffect(effect: unknown): boolean {
  return !!effect && typeof effect === 'object' &&
    typeof (effect as { definitionId?: unknown }).definitionId === 'string' &&
    (effect as { definitionId: string }).definitionId.startsWith(
      ACTIVITY_EXTRA_TURN_SUSPENSION_PREFIX,
    )
}

/**
 * Starting initiative does not end ongoing D&D effects. Status cleanup is an
 * explicit scenario-reset option, never the default for the ordinary UI flow.
 */
export function shouldClearDnd5eStatusesAtCombatStart(
  isDm: boolean,
  requested?: boolean,
): boolean {
  return isDm && requested === true
}

interface Dnd5eStatusTokenMarkState extends Dnd5eTransientCombatStartTokenMarkState {
  activeEffects?: unknown[]
  conditions?: string[]
  concentrationSpellId?: string
  concentrationSpellLevel?: number
  concentrationTargetIds?: string[]
  concentrationRoundsRemaining?: number
  concentrationEffectsBySource?: Record<string, string>
}

/** Remove stale, combat-local Token badges before the new snapshot is built. */
export function clearDnd5eTransientTokenMarksAtCombatStart<
  T extends object,
>(state: T | undefined): T | undefined {
  if (!state) return state
  const activityEffects = (state as Dnd5eTransientCombatStartTokenMarkState).activeEffects
  const hasActivitySuspensionEffect = activityEffects?.some(
    isActivityExtraTurnSuspensionEffect,
  ) === true
  if (
    !Object.prototype.hasOwnProperty.call(state, 'monsterDamageAversionActive') &&
    !Object.prototype.hasOwnProperty.call(state, 'monsterDamageAversionSourceActorId') &&
    !Object.prototype.hasOwnProperty.call(state, 'monsterRegenerationSuppressedDamageTypes') &&
    !Object.prototype.hasOwnProperty.call(state, 'activityExtraTurnGroup') &&
    !Object.prototype.hasOwnProperty.call(state, 'activityExtraTurnSuspension') &&
    !hasActivitySuspensionEffect
  ) {
    return state
  }

  const persistentState = { ...state } as T & Dnd5eTransientCombatStartTokenMarkState
  delete persistentState.monsterDamageAversionActive
  delete persistentState.monsterDamageAversionSourceActorId
  delete persistentState.monsterRegenerationSuppressedDamageTypes
  delete persistentState.activityExtraTurnGroup
  delete persistentState.activityExtraTurnSuspension
  if (hasActivitySuspensionEffect) {
    persistentState.activeEffects = activityEffects!.filter(
      (effect) => !isActivityExtraTurnSuspensionEffect(effect),
    )
  }
  return persistentState
}

/**
 * Clear status badges that should not leak into a newly started combat.
 * Concentration is deliberately retained: it is an ongoing spell lifecycle,
 * not a presentation-only badge, and a spell cast during exploration remains
 * active when initiative begins. Persistent-area entities are likewise
 * separate map objects and are not silently deleted by this reset.
 */
export function clearDnd5eStatusTokenMarksAtCombatStart<
  T extends object,
>(state: T | undefined): T | undefined {
  if (!state) return state
  const transientCleared = clearDnd5eTransientTokenMarksAtCombatStart(state) ?? state
  return {
    ...transientCleared,
    activeEffects: [],
    conditions: undefined,
  } as T & Dnd5eStatusTokenMarkState
}
