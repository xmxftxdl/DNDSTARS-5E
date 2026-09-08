/** Minimal Host snapshot required to resolve source-relative hearing. */
export interface Dnd5eAudibilitySnapshot {
  conditions: readonly string[]
  soundSuppressed?: boolean
}

/** Closed Host predicate shared by audible spells and class features. */
export function dnd5eCombatantCanHearSource(
  listener: Dnd5eAudibilitySnapshot,
  source: Dnd5eAudibilitySnapshot,
): boolean {
  if (listener.soundSuppressed || source.soundSuppressed) return false
  if (listener.conditions.some((condition) =>
    ['deafened', '耳聋'].includes(condition.trim().toLowerCase()))) return false
  return !source.conditions.some((condition) =>
    ['silenced', '沉默'].includes(condition.trim().toLowerCase()))
}
