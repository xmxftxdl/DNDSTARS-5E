import {cellKey,mapCellExtent,tokenAnchorCellFromPixel,tokenCenterForAnchorCell,tokenOccupiedCellsAt} from '../../lib/gridCombat'
import type { BattleMap, Token } from '../../store/maps'
import { mapGeometryPlacementBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { dnd5eEffectiveSizeRank, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eCarriedLoadPreventsMovement } from './carryingCapacity'
import { dnd5eMapTokenDistanceFeet, dnd5eTokenHeightFeet } from './verticalCombatGeometry'

export interface Dnd5eTeleportCompanionPolicy {
  maximumDepartureDistanceFeet: number
  maximumArrivalDistanceFeet: number
  maximumSize: 'actor'
  requiresWithinCarryingCapacity: true
}

/** Read only the Host departure snapshot; being an ally never supplies consent. */
export function dnd5eTeleportCompanionEligibility(input: {
  map: BattleMap
  state: Dnd5eHeadlessCombatState
  actorId: string
  targetId: string
  policy: Dnd5eTeleportCompanionPolicy
  /** Filled by the Host's controller choice window, never by the player's action payload. */
  willingTargetIds: readonly string[]
}): { ok: true; targetId: string } | { ok: false; reason: string } {
  const actor = input.state.combatants[input.actorId]
  const target = input.state.combatants[input.targetId]
  const actorToken = input.map.tokens.find(token => token.id === input.actorId)
  const targetToken = input.map.tokens.find(token => token.id === input.targetId)
  if (!actor || !target || !actorToken || !targetToken || actor.id === target.id || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-companion' }
  if (!input.willingTargetIds.includes(target.id)) return { ok: false, reason: 'companion-not-willing' }
  if (dnd5eEffectiveSizeRank(target) > dnd5eEffectiveSizeRank(actor)) return { ok: false, reason: 'companion-too-large' }
  if (dnd5eCarriedLoadPreventsMovement(target)) return { ok: false, reason: 'companion-over-capacity' }
  const distance = dnd5eMapTokenDistanceFeet({ map: input.map, geometry: mapGeometryRuntimeForMap(input.map.id),
    left: { ...actorToken, ...actor.position, elevationFeet: actor.elevationFeet },
    right: { ...targetToken, ...target.position, elevationFeet: target.elevationFeet },
    leftSizeRank: dnd5eEffectiveSizeRank(actor), rightSizeRank: dnd5eEffectiveSizeRank(target) })
  if (!Number.isFinite(input.policy.maximumDepartureDistanceFeet) || input.policy.maximumDepartureDistanceFeet < 0 || distance > input.policy.maximumDepartureDistanceFeet) return { ok: false, reason: 'companion-out-of-range' }
  return { ok: true, targetId: target.id }
}


/** Plan only: the caller validates the caster landing and commits both tokens atomically. */
export function planDnd5eTeleportCompanion(input: Parameters<typeof dnd5eTeleportCompanionEligibility>[0] & {
  actorDestination: { x: number; y: number; elevationFeet?: number }
}): { kind: 'travel'; targetId: string; position: { x: number; y: number; elevationFeet: number } } |
  { kind: 'left-behind'; reason: string } {
  const eligible = dnd5eTeleportCompanionEligibility(input)
  if (!eligible.ok) return { kind: 'left-behind', reason: eligible.reason }
  const radius = input.policy.maximumArrivalDistanceFeet
  if (!Number.isFinite(radius) || radius < 0 || radius > 100 ||
    !Number.isFinite(input.actorDestination.x) || !Number.isFinite(input.actorDestination.y) ||
    (input.actorDestination.elevationFeet != null && !Number.isFinite(input.actorDestination.elevationFeet))) return { kind: 'left-behind', reason: 'invalid-arrival' }
  const sizes = ['微型','小型','中型','大型','超大型','巨型'] as const
  const effective = (id: string): Token => {
    const token = input.map.tokens.find(t => t.id === id)!
    const state = input.state.combatants[id]
    return { ...token, ...state.position, elevationFeet: state.elevationFeet,
      creatureSize: sizes[dnd5eEffectiveSizeRank(state)] }
  }
  const actor = { ...effective(input.actorId), ...input.actorDestination }
  const companion = effective(input.targetId)
  const map = { ...input.map, tokens: input.map.tokens.map(token => token.id === actor.id ? actor : token) }
  const geometry = mapGeometryRuntimeForMap(map.id)
  const elevationFeet = mapGeometryTokenElevation(geometry, actor)
  const origin = tokenAnchorCellFromPixel(actor.x, actor.y, actor, map)
  const bounds = mapCellExtent(map)
  const reach = Math.ceil(radius / Math.max(1, map.feetPerCell ?? 5)) + 8
  const occupied = new Set(map.tokens.filter(token => token.id !== companion.id && !(token.type === 'obstacle' && token.obstacleKind === 'marker'))
    .filter(token => { const bottom = mapGeometryTokenElevation(geometry, token); return elevationFeet < bottom + dnd5eTokenHeightFeet(token) && elevationFeet + dnd5eTokenHeightFeet(companion) > bottom })
    .flatMap(token => tokenOccupiedCellsAt(token, map, token).map(cellKey)))
  for (let row = Math.max(0, origin.row - reach); row <= Math.min(bounds.rows - 1, origin.row + reach); row++) {
    for (let col = Math.max(0, origin.col - reach); col <= Math.min(bounds.cols - 1, origin.col + reach); col++) {
      const position = { ...tokenCenterForAnchorCell({col,row}, companion, map), elevationFeet }
      const landed = { ...companion, ...position }
      if (dnd5eMapTokenDistanceFeet({map,geometry,left:actor,right:landed}) > radius) continue
      const cells = tokenOccupiedCellsAt(landed, map, landed)
      if (cells.some(cell => cell.col < 0 || cell.row < 0 || cell.col >= bounds.cols || cell.row >= bounds.rows || occupied.has(cellKey(cell)))) continue
      if (mapGeometryPlacementBlocked({geometry,map,token:landed,at:position}).blocked) continue
      return { kind: 'travel', targetId: companion.id, position }
    }
  }
  return { kind: 'left-behind', reason: 'no-companion-space' }
}
