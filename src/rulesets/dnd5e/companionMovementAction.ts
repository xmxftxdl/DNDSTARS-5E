import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { dnd5eCompanionDestinationFitsMap, dnd5eOwnedCompanionMovementDestination } from './companionMovementDestination'
import { prepareDnd5eMonsterMovementSavingThrows, previewDnd5eMonsterMapMove } from './monsterMoveAction'
import { dnd5eCompanionGuardAreaFitsMap, dnd5eCompanionGuardCanTraverse, dnd5eGuardContainsTokenAt } from './companionGuardArea'
import { createMapGeometryPathTree } from '../../lib/mapPathfinding'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { mapCellExtent, tokenCenterForAnchorCell } from '../../lib/gridCombat'
import { getDnd5eSrdMonster } from './monsters'

type MoveInput = Parameters<typeof previewDnd5eMonsterMapMove>[0]
type MoveResult = Extract<ReturnType<typeof previewDnd5eMonsterMapMove>, { ok: true }>

/** Prepares the affordable prefix of a persistent order through the normal movement authority.
 * Nothing is committed here; callers must use the normal hazard/reaction settlement when applying it.
 */
export function prepareDnd5eOwnedCompanionMovement(input: Omit<MoveInput, 'to' | 'dash' | 'disengage' | 'nimbleEscape' | 'legendaryMovement'>):
  { destination: { x: number; y: number }; movement?: MoveResult; dash: boolean; disengage: boolean } | undefined {
  const actor = input.map.tokens.find(token => token.id === input.actorTokenId)
  let destination = actor && dnd5eOwnedCompanionMovementDestination(actor, input.map)
  const order = actor?.dnd5eCombatState?.companionCommand, summon = actor?.dnd5eSummon
  const guard = order?.guardArea
  if (actor && !destination && guard && (input.turnEconomy?.movement.current ?? 1) > 0 && summon?.commandPolicy && (!summon.controlEnded || dnd5eHasVoluntaryCompanionOrder(actor)) &&
    order.sourceOwnerId === summon.sourceTokenId && order.sourceFeatureId === summon.featureId &&
    dnd5eCompanionGuardAreaFitsMap(input.map, guard) && !dnd5eGuardContainsTokenAt(input.map, actor, guard, actor)) {
    const monster = actor.poolId ? getDnd5eSrdMonster(actor.poolId) : undefined
    const tree = createMapGeometryPathTree({ map: input.map, token: actor,
      geometry: mapGeometryRuntimeForMap(input.map.id), allowOpenUnlockedDoors: true,
      canClimb: (monster?.speed.climb ?? 0) > 0, canSwim: (monster?.speed.swim ?? 0) > 0,
      canFly: (monster?.speed.fly ?? 0) > 0, targetElevationFeet: actor.elevationFeet,
      canTraverseEdge: (from, to) => dnd5eCompanionGuardCanTraverse(input.map, actor, from, to) })
    const { cols, rows } = mapCellExtent(input.map)
    const grid = Math.max(1, input.map.gridSize)
    let nearestCost = Infinity
    for (let row = Math.max(0, Math.floor((guard.minY-input.map.gridOffsetY)/grid)); row < Math.min(rows,Math.ceil((guard.maxY-input.map.gridOffsetY)/grid)); row++) {
      for (let col = Math.max(0, Math.floor((guard.minX-input.map.gridOffsetX)/grid)); col < Math.min(cols,Math.ceil((guard.maxX-input.map.gridOffsetX)/grid)); col++) {
        const point = tokenCenterForAnchorCell({row,col}, actor, input.map)
        if (!dnd5eGuardContainsTokenAt(input.map, actor, guard, point)) continue
        const path = tree.pathTo(point)
        if (path && path.movementCostFeet < nearestCost) {
          nearestCost = path.movementCostFeet
          destination = { mapId: input.map.id, ...point }
        }
      }
    }
  }
  if (!actor || !destination) return undefined
  const command = actor.dnd5eCombatState!.companionCommand!
  const dash = command.command === 'dash', disengage = command.command === 'disengage'
  const waiting = { destination: { x: actor.x, y: actor.y }, dash: false, disengage: false }
  if (!dnd5eCompanionDestinationFitsMap(input.map, actor.id, destination) ||
    destination.x === actor.x && destination.y === actor.y) return waiting
  const resolve = (to: { x: number; y: number }) => previewDnd5eMonsterMapMove({ ...input, to, dash, disengage })
  const usable = (result: ReturnType<typeof resolve>, to: { x: number; y: number }): boolean => {
    if (!result.ok) return false
    if (result.result.ok) return true
    if (result.result.reason !== 'invalid-dice') return false
    const saves = prepareDnd5eMonsterMovementSavingThrows({ ...input, to })
    return Boolean(saves && (saves.boundarySavingThrows.length || saves.movementRepeatSavingThrows.length))
  }
  const full = resolve(destination)
  if (full.ok && usable(full, destination)) return { destination: { x: destination.x, y: destination.y }, movement: full, dash, disengage }
  const route = full.ok ? full.path : full.unaffordablePath
  if (!route) return waiting
  // A rejected over-budget move still contains its canonical route. Test prefixes
  // against the same authority rather than estimating costs from straight distance.
  // The movement trace may collapse a straight run to its two endpoints.
  // Restore grid-spaced candidates along each segment before looking for a prefix.
  const points = route.flatMap((end, index) => {
    if (!index) return [end]
    const start = route[index - 1]
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / Math.max(1, input.map.gridSize)))
    return Array.from({ length: steps }, (_, step) => ({
      x: start.x + (end.x - start.x) * (step + 1) / steps,
      y: start.y + (end.y - start.y) * (step + 1) / steps,
    }))
  })
  for (let index = points.length - 2; index > 0; index--) {
    const point = points[index]
    const prefix = resolve(point)
    if (prefix.ok && usable(prefix, point)) {
      return { destination: point, movement: prefix, dash, disengage }
    }
  }
  return waiting
}
