import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5eInitialSpaceAllowsPerception } from './initialSpacePerception'

/** Minimal Host snapshot required to resolve source-relative hearing. */
export interface Dnd5eAudibilitySnapshot {
  conditions: readonly string[]
  soundSuppressed?: boolean
  position?: { x: number; y: number }
  elevationFeet?: number
  groundElevationFeet?: number
  classState?: { activeEffects?: readonly Dnd5eActiveEffectInstance[] }
}

/** Closed Host predicate shared by audible spells and class features. */
export function dnd5eCombatantCanHearSource(
  listener: Dnd5eAudibilitySnapshot,
  source: Dnd5eAudibilitySnapshot,
  mapId?: string,
): boolean {
  if (!dnd5eInitialSpaceAllowsPerception(listener.classState?.activeEffects, source.position ? {
    mapId, ...source.position, elevationFeet: source.elevationFeet ?? source.groundElevationFeet ?? 0,
  } : undefined)) return false
  if (listener.soundSuppressed || source.soundSuppressed) return false
  if (listener.conditions.some((condition) =>
    ['deafened', '耳聋'].includes(condition.trim().toLowerCase()))) return false
  return !source.conditions.some((condition) =>
    ['silenced', '沉默'].includes(condition.trim().toLowerCase()))
}
