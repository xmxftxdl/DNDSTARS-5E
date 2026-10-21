import type { BattleMap } from '../../store/maps'
import { cellKey, mapCellExtent, tokenCenterForAnchorCell, tokenOccupiedCellsAt, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { mapGeometryMovementBlocked, mapGeometryPlacementBlocked, mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'

export type Dnd5eDismountDirection = 'current' | 'north' | 'east' | 'south' | 'west' | 'northeast' | 'southeast' | 'southwest' | 'northwest'

/** Resolves a direction against current authoritative footprints, never client coordinates. */
export function planDnd5eDismountPlacement(map: BattleMap, riderId: string, mountId: string, direction: Dnd5eDismountDirection = 'current') {
  const rider = map.tokens.find(token => token.id === riderId)
  const mount = map.tokens.find(token => token.id === mountId)
  if (!rider || !mount || rider.id === mount.id) return undefined
  const cells = tokenOccupiedCellsAt(mount, map, mount)
  const riderCells = tokenOccupiedCellsAt(rider, map, rider)
  if (!cells.length || !riderCells.length) return undefined
  const minCol = Math.min(...cells.map(cell => cell.col)), maxCol = Math.max(...cells.map(cell => cell.col))
  const minRow = Math.min(...cells.map(cell => cell.row)), maxRow = Math.max(...cells.map(cell => cell.row))
  const width = Math.max(...riderCells.map(cell => cell.col)) - Math.min(...riderCells.map(cell => cell.col)) + 1
  const height = Math.max(...riderCells.map(cell => cell.row)) - Math.min(...riderCells.map(cell => cell.row)) + 1
  const offsets: Record<Exclude<Dnd5eDismountDirection, 'current'>, readonly [number, number]> = {
    north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0],
    northeast: [1, -1], southeast: [1, 1], southwest: [-1, 1], northwest: [-1, -1],
  }
  const offset = direction === 'current' || !Object.prototype.hasOwnProperty.call(offsets, direction) ? undefined : offsets[direction]
  if (direction !== 'current' && !offset) return undefined
  const to = offset ? tokenCenterForAnchorCell({
    col: offset[0] < 0 ? minCol - width : offset[0] > 0 ? maxCol + 1 : Math.floor((minCol + maxCol + 1 - width) / 2),
    row: offset[1] < 0 ? minRow - height : offset[1] > 0 ? maxRow + 1 : Math.floor((minRow + maxRow + 1 - height) / 2),
  }, rider, map) : { x: rider.x, y: rider.y }
  const footprint = tokenOccupiedCellsAt(rider, map, to), { cols, rows } = mapCellExtent(map)
  const occupied = new Set(map.tokens.filter(token => token.id !== riderId && (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
    .flatMap(token => tokenOccupiedCellsAt(token, map, token)).map(cellKey))
  const geometry = mapGeometryRuntimeForMap(map.id)
  const groundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, to)
  if (footprint.some(cell => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows || occupied.has(cellKey(cell))) ||
    tokenFootprintDistanceCells({ ...rider, ...to }, mount, map) * (map.feetPerCell ?? 5) > 5 ||
    mapGeometryMovementBlocked({ geometry, map, token: rider, to }).blocked ||
    mapGeometryPlacementBlocked({ geometry, map, token: rider, at: to }).blocked ||
    mapGeometryPlacementBlocked({ geometry, map, token: rider, at: to, elevationFeet: groundElevationFeet }).blocked) return undefined
  return to
}
