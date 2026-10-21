import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eSightingWorldMinute } from './recentCreatureSightings'

/** A past location, not visibility, targeting permission, or a live tracking effect. */
export interface Dnd5eKnownCreatureLocation {
  mapId: string
  targetId: string
  label: string
  x: number
  y: number
  elevationFeet: number
  round: number
  worldMinute?: number
  sourceActivityId: string
}

export function recordDnd5eTargetLocation(state: Dnd5eHeadlessCombatState, actorId: string,
  targetId: string, sourceActivityId: string): boolean {
  const actor = state.combatants[actorId], target = state.combatants[targetId]
  if (!actor || !target || !state.mapId || actorId === targetId ||
    ![target.position.x, target.position.y, target.elevationFeet ?? 0].every(Number.isFinite)) return false
  actor.classState.knownCreatureLocations = { ...actor.classState.knownCreatureLocations,
    [targetId]: { mapId: state.mapId, targetId, label: target.name,
      x: target.position.x, y: target.position.y, elevationFeet: target.elevationFeet ?? 0,
      round: state.round, sourceActivityId,
      worldMinute: dnd5eSightingWorldMinute(state.companionScene?.worldMinute, state.companionScene?.worldSecondRemainder),
    },
  }
  return true
}
