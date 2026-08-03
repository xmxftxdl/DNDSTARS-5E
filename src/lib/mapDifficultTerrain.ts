import type { BattleMap } from '../store/maps'
import type { GridCell } from './gridCombat'
import {
  mapGeometryPointInPolygon,
  type MapGeometryState,
} from './mapGeometry'

export interface MapDifficultTerrainCell extends GridCell {
  multiplier: number
}

type DifficultTerrainMap = Pick<
  BattleMap,
  | 'width'
  | 'height'
  | 'gridSize'
  | 'gridOffsetX'
  | 'gridOffsetY'
  | 'dnd5ePluginAreas'
>

function difficultTerrainMultiplier(value: number | undefined): number | undefined {
  return Number.isFinite(value) && Number(value) > 1 ? Number(value) : undefined
}

function cellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`
}

/**
 * Projects every authoritative difficult-terrain source onto map grid cells.
 *
 * Geometry polygons use cell-center sampling, matching the point sampled by
 * map pathfinding when a creature enters a grid cell. Persistent-area cells
 * are already authoritative grid coordinates. Overlapping sources do not
 * stack: the highest multiplier wins, as it does in the movement rules.
 */
export function collectMapDifficultTerrainCells(input: {
  map: DifficultTerrainMap
  geometry?: Pick<MapGeometryState, 'obstacles'>
}): MapDifficultTerrainCell[] {
  const { map, geometry } = input
  const gridSize = Math.max(1, map.gridSize)
  // Keep the grid domain identical to mapPathfinding. Grid offsets move cell
  // centers but do not remove the last addressable pathfinding column/row.
  const cols = Math.max(1, Math.ceil(map.width / gridSize))
  const rows = Math.max(1, Math.ceil(map.height / gridSize))
  const cells = new Map<string, MapDifficultTerrainCell>()

  const record = (cell: GridCell, multiplier: number) => {
    if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) return
    const key = cellKey(cell)
    const current = cells.get(key)
    if (!current || multiplier > current.multiplier) {
      cells.set(key, { ...cell, multiplier })
    }
  }

  for (const obstacle of geometry?.obstacles ?? []) {
    const multiplier = difficultTerrainMultiplier(obstacle.terrainCostMultiplier)
    if (!multiplier || obstacle.points.length < 3) continue

    const xs = obstacle.points.map((point) => point.x)
    const ys = obstacle.points.map((point) => point.y)
    const minCol = Math.max(
      0,
      Math.ceil((Math.min(...xs) - map.gridOffsetX) / gridSize - 0.5),
    )
    const maxCol = Math.min(
      cols - 1,
      Math.floor((Math.max(...xs) - map.gridOffsetX) / gridSize - 0.5),
    )
    const minRow = Math.max(
      0,
      Math.ceil((Math.min(...ys) - map.gridOffsetY) / gridSize - 0.5),
    )
    const maxRow = Math.min(
      rows - 1,
      Math.floor((Math.max(...ys) - map.gridOffsetY) / gridSize - 0.5),
    )

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const center = {
          x: map.gridOffsetX + (col + 0.5) * gridSize,
          y: map.gridOffsetY + (row + 0.5) * gridSize,
        }
        if (mapGeometryPointInPolygon(center, obstacle.points)) {
          record({ col, row }, multiplier)
        }
      }
    }
  }

  for (const area of map.dnd5ePluginAreas ?? []) {
    // Spirit Guardians halves an affected enemy's speed rather than making
    // its cells difficult terrain. It is rendered and costed separately.
    if (area.coreSpellId === 'spirit-guardians') continue
    const multiplier = difficultTerrainMultiplier(area.movementCostMultiplier)
    if (!multiplier) continue
    for (const cell of area.cells) record(cell, multiplier)
  }

  return [...cells.values()].sort((left, right) =>
    left.row - right.row || left.col - right.col)
}
