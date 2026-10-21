import type { BattleMap } from '../../../store/maps'
import { normalizeDnd5eTraversalMode } from '../traversal'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../../lib/mapGeometry'
import { cellDistance, tokenAnchorCellFromPixel } from '../../../lib/gridCombat'
import { dnd5eMapTokenDistanceFeet } from '../verticalCombatGeometry'
import type { Dnd5eCombatEvent, Dnd5eActivityAuthorityHandoffs } from '../headlessCombatEngine'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { endDnd5eSourceLinkedEffectsForCommittedHarm } from '../headlessCombatEngine'
import { recordDnd5eStraightMovement } from '../straightMovementStreak'
import { refreshDnd5eMapSpatialRelations } from '../mapBridge'

/** Synchronize an accepted map handoff before discovering subsequent combat events. */
export function synchronizeDnd5eActivityMapMovement(input: {
  before: BattleMap; after: BattleMap; actorId: string; activityId: string
  movements: Dnd5eActivityAuthorityHandoffs['movements']
  carriedTargetIds?: readonly string[]
  /** Receipt produced by the successful map handoff, not by a player payload. */
  harmfulMovementTargetIds?: readonly string[]
  state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[]
}): Dnd5eCombatEvent[] {
  if (!input.movements.length && !input.carriedTargetIds?.length) return [...input.events]
  const events = dnd5eActivityMapMovementEvents(input)
  const geometry = mapGeometryRuntimeForMap(input.after.id)
  const targets = events.map(event => {
    if (event.type !== 'moved') throw new Error('activity-movement-event-invalid')
    const combatant = input.state.combatants[event.actorId]
    const token = input.after.tokens.find(token => token.id === event.actorId)
    if (!combatant || !token) throw new Error('activity-movement-combatant-missing')
    return { combatant, token }
  })
  for (const { combatant, token } of targets) {
    combatant.position = { x: token.x, y: token.y }
    combatant.elevationFeet = mapGeometryTokenElevation(geometry, token)
    combatant.traversalMode = normalizeDnd5eTraversalMode(token.dnd5eTraversalMode)
  }
  const resultEvents = [...input.events, ...events]
  recordDnd5eStraightMovement(input.state, events)
  refreshDnd5eMapSpatialRelations(input.state, input.after, resultEvents)
  for (const targetId of new Set(input.movements.filter(movement => movement.harmful === true).map(movement => movement.targetId))) {
    if (input.harmfulMovementTargetIds?.includes(targetId)) {
      endDnd5eSourceLinkedEffectsForCommittedHarm(input.state, input.actorId, targetId, resultEvents)
    }
  }
  return resultEvents
}

/** Called only after the map authority accepts every movement destination. */
export function dnd5eActivityMapMovementEvents(input: {
  before: BattleMap; after: BattleMap; actorId: string; activityId: string
  movements: Dnd5eActivityAuthorityHandoffs['movements']
  carriedTargetIds?: readonly string[]
}): Dnd5eCombatEvent[] {
  const source = input.after.tokens.find(token => token.id === input.actorId)
  if (!source) throw new Error('activity-movement-source-missing')
  const geometry = mapGeometryRuntimeForMap(input.after.id)
  const beforeGeometry = mapGeometryRuntimeForMap(input.before.id)
  // This handoff publishes the final map atomically. Report one final position
  // per creature rather than pretending intermediate positions were committed.
  const finalMovements = [...new Map([...input.movements,
    ...(input.carriedTargetIds ?? []).map(targetId => ({ targetId, mode: 'forced' as const })),
  ].map(movement => [movement.targetId, movement])).values()]
  return finalMovements.map(movement => {
    const before = input.before.tokens.find(token => token.id === movement.targetId)
    const after = input.after.tokens.find(token => token.id === movement.targetId)
    if (!before || !after) throw new Error('activity-movement-target-missing')
    const fromElevationFeet = mapGeometryTokenElevation(beforeGeometry, before)
    const toElevationFeet = mapGeometryTokenElevation(geometry, after)
    return {
      type: 'moved', actorId: after.id,
      fromMapId: input.before.id, toMapId: input.after.id,
      from: { x: before.x, y: before.y }, to: { x: after.x, y: after.y },
      fromElevationFeet, toElevationFeet,
      distance: Math.max(cellDistance(
        tokenAnchorCellFromPixel(before.x, before.y, before, input.before),
        tokenAnchorCellFromPixel(after.x, after.y, after, input.after),
      ) * (input.after.feetPerCell ?? 5), Math.abs(toElevationFeet - fromElevationFeet)),
      movementKind: movement.mode === 'teleport' || movement.mode === 'swap' ? 'teleport' : movement.mode === 'voluntary' ? 'voluntary' : 'forced',
      sourceActorId: input.actorId, activityId: input.activityId,
      distanceFromSourceFeet: dnd5eMapTokenDistanceFeet({ map: input.after, geometry, left: source, right: after }),
    }
  })
}
