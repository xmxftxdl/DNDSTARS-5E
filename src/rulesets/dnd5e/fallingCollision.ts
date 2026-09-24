import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { D20RollMode } from '../contracts'

export interface Dnd5eFallingCollisionPreview {
  targetId: string
  targetName: string
  rollKey: string
  mode: D20RollMode
  modifier: number
  automaticallyFails: boolean
}

/** Namespaced D20 entries share the existing serializable airborne dice ledger. */
export const fallingCollisionRollKey = (fallId: string, targetId: string) =>
  `fall-collision:${JSON.stringify([fallId, targetId])}`

export function fallingFootprintsOverlap(state: Dnd5eHeadlessCombatState, a: Dnd5eCombatant, b: Dnd5eCombatant): boolean {
  const grid = state.gridDistance
  const width = (c: Dnd5eCombatant) => grid
    ? (grid.footprintCellsByCombatantId[c.id] ?? 1) * grid.cellUnits
    : Math.max(5, (c.sizeRank - 1) * 5) * (state.coordinateUnitsPerFoot ?? 1)
  const combinedHalfWidth = (width(a) + width(b)) / 2
  return Math.abs(a.position.x - b.position.x) < combinedHalfWidth - 1e-4 &&
    Math.abs(a.position.y - b.position.y) < combinedHalfWidth - 1e-4
}

/** Ground contact only; intermediate airborne collisions need a separate path adjudication. */
export function fallingGroundTargets(state: Dnd5eHeadlessCombatState, faller: Dnd5eCombatant): Dnd5eCombatant[] {
  const ground = faller.groundElevationFeet ?? 0
  return Object.values(state.combatants).filter(other => other.id !== faller.id &&
    Math.abs((other.elevationFeet ?? other.groundElevationFeet ?? 0) - ground) < 1e-4 &&
    fallingFootprintsOverlap(state, faller, other)).sort((a, b) => a.id.localeCompare(b.id))
}
