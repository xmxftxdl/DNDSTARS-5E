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
  if (
    !Object.prototype.hasOwnProperty.call(state, 'monsterDamageAversionActive') &&
    !Object.prototype.hasOwnProperty.call(state, 'monsterDamageAversionSourceActorId')
  ) {
    return state
  }

  const persistentState = { ...state } as T & Dnd5eTransientCombatStartTokenMarkState
  delete persistentState.monsterDamageAversionActive
  delete persistentState.monsterDamageAversionSourceActorId
  return persistentState
}

/**
 * Clear every authoritative field that projects a status badge on a Token.
 * Combat resources, HP, spell slots and unrelated rule state are deliberately
 * retained. Persistent-area entities are separate map objects and are not
 * silently deleted by this presentation/status reset.
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
    concentrationSpellId: undefined,
    concentrationSpellLevel: undefined,
    concentrationTargetIds: undefined,
    concentrationRoundsRemaining: undefined,
    concentrationEffectsBySource: undefined,
  } as T & Dnd5eStatusTokenMarkState
}
