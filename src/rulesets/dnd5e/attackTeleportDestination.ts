import { cellKey, tokenAnchorCellFromPixel, tokenCenterForAnchorCell, tokenOccupiedCellsAt, type GridCell } from '../../lib/gridCombat'
import {
  mapGeometryEntityBodyHeightFeet, mapGeometryPlacementBlocked, mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eActivityPointVisible } from './activityPointVisibility'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'

/** Preview destinations at the chosen height (or terrain) within target reach. */
export function dnd5eAttackTeleportCellsForTarget(input: {
  map: BattleMap; actorTokenId: string; targetTokenId: string
  characters: readonly Character[]; rangeFeet: number; worldMinute?: number
  targetReachFeet?: number; targetElevationFeet?: number
}): GridCell[] {
  const actor = input.map.tokens.find(token => token.id === input.actorTokenId)
  const target = input.map.tokens.find(token => token.id === input.targetTokenId)
  if (!actor || !target || actor.id === target.id || !Number.isFinite(input.rangeFeet) ||
    input.rangeFeet <= 0 || input.rangeFeet > 1_000) return []
  const anchor = tokenAnchorCellFromPixel(actor.x, actor.y, actor, input.map)
  const radius = Math.ceil(input.rangeFeet / Math.max(1, input.map.feetPerCell ?? 5))
  const geometry = mapGeometryRuntimeForMap(input.map.id), cells: GridCell[] = []
  for (let row = Math.max(0, anchor.row - radius); row <= anchor.row + radius; row++) {
    for (let col = Math.max(0, anchor.col - radius); col <= anchor.col + radius; col++) {
      const targetCell = { col, row }
      const result = prepareDnd5eAttackTeleportDestination({ ...input, targetCell })
      if (!result.ok) continue
      const origin = { ...actor, ...result.to, elevationFeet: result.elevationFeet }
      if (dnd5eMapTokenDistanceFeet({ map: input.map, geometry, left: origin, right: target }) <= (input.targetReachFeet ?? 5))
        cells.push(targetCell)
    }
  }
  return cells
}

/**
 * Host-only destination check. This grants neither movement nor an attack:
 * the caller must authorize the feature and commit it with the ensuing attack.
 */
export function prepareDnd5eAttackTeleportDestination(input: {
  map: BattleMap
  actorTokenId: string
  characters: readonly Character[]
  targetCell: GridCell
  targetElevationFeet?: number
  /** Range obtained from the owned feature, never from the player request. */
  rangeFeet: number
  worldMinute?: number
}): { ok: true; to: { x: number; y: number }; elevationFeet: number; distanceFeet: number } |
  { ok: false; reason: 'invalid-target' | 'target-out-of-range' | 'target-not-visible' } {
  const { map, targetCell } = input
  const actor = map.tokens.find(token => token.id === input.actorTokenId)
  if (!actor || actor.type === 'obstacle' || !targetCell ||
    !Number.isSafeInteger(targetCell.col) || !Number.isSafeInteger(targetCell.row) ||
    !Number.isFinite(input.rangeFeet) || input.rangeFeet <= 0 ||
    !Number.isFinite(map.gridSize) || map.gridSize <= 0 ||
    !Number.isFinite(map.feetPerCell ?? 5) || (map.feetPerCell ?? 5) <= 0 ||
    (input.targetElevationFeet != null && !Number.isFinite(input.targetElevationFeet)))
    return { ok: false, reason: 'invalid-target' }
  const geometry = mapGeometryRuntimeForMap(map.id)
  const to = tokenCenterForAnchorCell(targetCell, actor, map)
  const elevationFeet = input.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, to)
  if (elevationFeet < mapGeometryTerrainElevationAtPoint(geometry, to))
    return { ok: false, reason: 'invalid-target' }
  const distanceFeet = Math.max(
    Math.abs(to.x - actor.x) / map.gridSize * (map.feetPerCell ?? 5),
    Math.abs(to.y - actor.y) / map.gridSize * (map.feetPerCell ?? 5),
    Math.abs(elevationFeet - mapGeometryTokenElevation(geometry, actor)),
  )
  if (!Number.isFinite(distanceFeet) || distanceFeet > input.rangeFeet)
    return { ok: false, reason: 'target-out-of-range' }
  const cells = tokenOccupiedCellsAt(actor, map, to)
  const columns = Math.floor((map.width - map.gridOffsetX) / map.gridSize)
  const rows = Math.floor((map.height - map.gridOffsetY) / map.gridSize)
  if (cells.some(cell => cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows))
    return { ok: false, reason: 'invalid-target' }
  const footprint = new Set(cells.map(cellKey))
  const bodyHeight = (token: Token) => mapGeometryEntityBodyHeightFeet(token) ?? Math.max(5, token.size * 5)
  const top = elevationFeet + bodyHeight(actor)
  if (map.tokens.some(token => token.id !== actor.id &&
    mapGeometryTokenElevation(geometry, token) < top && mapGeometryTokenElevation(geometry, token) + bodyHeight(token) > elevationFeet &&
    tokenOccupiedCellsAt(token, map, token).some(cell => footprint.has(cellKey(cell)))))
    return { ok: false, reason: 'invalid-target' }
  if (mapGeometryPlacementBlocked({ geometry, map, token: actor, at: to, elevationFeet }).blocked)
    return { ok: false, reason: 'invalid-target' }
  if (!dnd5eActivityPointVisible({ map, viewer: actor, characters: input.characters, geometry,
    worldMinute: input.worldMinute, point: { ...to, elevationFeet } }))
    return { ok: false, reason: 'target-not-visible' }
  return { ok: true, to, elevationFeet, distanceFeet }
}
