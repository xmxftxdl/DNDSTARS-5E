import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export interface Dnd5eStraightMovementStreak {
  turnKey: string
  end: { x: number; y: number; elevationFeet?: number }
  direction: { x: number; y: number; z?: number }
  distanceFeet: number
}

/** Host-only committed paths; elevation-changing paths require explicit endpoint heights. */
export function recordDnd5eStraightMovement(state: Dnd5eHeadlessCombatState, events: readonly Dnd5eCombatEvent[]): void {
  const vertical = new Set(events.filter(event => event.type === 'elevation-changed').map(event => event.actorId))
  const turnKey = `${state.combatId}:${state.round}:${state.initiativeSlotIds?.[state.initiativeIndex] ?? state.turnSlotId ?? state.initiativeOrder[state.initiativeIndex]}`
  for (const event of events) {
    if (event.type === 'turn-ended') {
      for (const actor of Object.values(state.combatants)) actor.classState.straightMovementStreak = undefined
      continue
    }
    if (event.type === 'attack-resolved') {
      const actor = state.combatants[event.actorId]
      const prior = actor?.classState.straightMovementStreak
      if (event.precedingStraightMovementFeet == null && state.active && prior?.turnKey === turnKey &&
        Number.isFinite(prior.distanceFeet) && prior.distanceFeet > 0) {
        event.precedingStraightMovementFeet = prior.distanceFeet
      }
      if (actor) actor.classState.straightMovementStreak = undefined
      continue
    }
    if (event.type !== 'moved') continue
    const actor = state.combatants[event.actorId]
    if (!actor) continue
    const knownHeights = Number.isFinite(event.fromElevationFeet) && Number.isFinite(event.toElevationFeet)
    const unknownVertical = !knownHeights && (vertical.has(actor.id) || event.fromElevationFeet != null || event.toElevationFeet != null)
    const fromElevation = knownHeights ? event.fromElevationFeet! : 0
    const toElevation = knownHeights ? event.toElevationFeet! : 0
    const delta = { x: event.to.x - event.from.x, y: event.to.y - event.from.y, z: toElevation - fromElevation }
    const length = Math.hypot(delta.x, delta.y, delta.z)
    if (!state.active || !['voluntary', 'mounted'].includes(event.movementKind ?? '') || event.straightLine !== true || unknownVertical ||
      !Number.isFinite(length) || length <= 1e-6 || !Number.isFinite(event.distance) || event.distance <= 0) {
      actor.classState.straightMovementStreak = undefined
      event.straightDistanceFeet = 0
      continue
    }
    const direction = { x: delta.x / length, y: delta.y / length, z: delta.z / length }
    const prior = actor.classState.straightMovementStreak
    const continuous = prior?.turnKey === turnKey && prior.end != null && prior.direction != null &&
      [prior.end.x, prior.end.y, prior.end.elevationFeet ?? 0, prior.direction.x, prior.direction.y, prior.direction.z ?? 0, prior.distanceFeet].every(Number.isFinite) && prior.distanceFeet >= 0 &&
      Math.hypot(prior.end.x - event.from.x, prior.end.y - event.from.y, (prior.end.elevationFeet ?? 0) - fromElevation) <= 1e-6 &&
      Math.hypot(prior.direction.x - direction.x, prior.direction.y - direction.y, (prior.direction.z ?? 0) - direction.z) <= 1e-6
    const distanceFeet = Math.min(100_000, event.distance + (continuous ? prior!.distanceFeet : 0))
    actor.classState.straightMovementStreak = { turnKey, end: { ...event.to, elevationFeet: toElevation }, direction, distanceFeet }
    event.straightDistanceFeet = distanceFeet
  }
}
