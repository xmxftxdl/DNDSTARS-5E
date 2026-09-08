import type { GridCell } from '../../lib/gridCombat'

export const CIRCULAR_PERSISTENT_AREA_RANGE_PRESETS = new Set([
  'fog-cloud',
  'toxic-cloud',
  'stinking-cloud',
  'cloudkill',
  'sleet-storm',
  'insect-plague',
])

export function persistentAreaPresetUsesCircularRange(preset: string): boolean {
  return CIRCULAR_PERSISTENT_AREA_RANGE_PRESETS.has(preset)
}

/**
 * Persistent-area snapshots retain their occupied cells and anchor rather than
 * duplicating the targeting template. Circle targeting includes every square
 * touched by the radius, so the farthest axial cell offset recovers the exact
 * radius used by the template (including Fog Cloud's slot-scaled radius).
 */
export function persistentAreaCircularRangeGeometry(input: {
  cells: readonly GridCell[]
  anchorCell?: GridCell
  gridSize: number
  gridOffsetX?: number
  gridOffsetY?: number
}): { x: number; y: number; radius: number } | undefined {
  if (input.cells.length === 0) return undefined
  const grid = Math.max(1, input.gridSize)
  const minCol = Math.min(...input.cells.map((cell) => cell.col))
  const maxCol = Math.max(...input.cells.map((cell) => cell.col))
  const minRow = Math.min(...input.cells.map((cell) => cell.row))
  const maxRow = Math.max(...input.cells.map((cell) => cell.row))
  const anchor = input.anchorCell ?? {
    col: (minCol + maxCol) / 2,
    row: (minRow + maxRow) / 2,
  }
  const axialRadiusCells = Math.max(
    ...input.cells.map((cell) => Math.max(
      Math.abs(cell.col - anchor.col),
      Math.abs(cell.row - anchor.row),
    )),
  )
  return {
    x: (input.gridOffsetX ?? 0) + (anchor.col + 0.5) * grid,
    y: (input.gridOffsetY ?? 0) + (anchor.row + 0.5) * grid,
    radius: Math.max(grid * 0.5, axialRadiusCells * grid),
  }
}
