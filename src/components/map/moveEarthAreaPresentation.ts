import type { GridCell } from '../../lib/gridCombat'

export interface MoveEarthAreaPixelBounds {
  x: number
  y: number
  width: number
  height: number
  widthFeet: number
  heightFeet: number
}

/** One continuous boundary for the selected square instead of a grid of boxes. */
export function moveEarthAreaPixelBounds(
  cells: readonly GridCell[],
  map: {
    gridSize: number
    gridOffsetX: number
    gridOffsetY: number
    feetPerCell?: number
  },
): MoveEarthAreaPixelBounds | undefined {
  if (cells.length === 0) return undefined
  const gridSize = Math.max(1, map.gridSize)
  const minCol = Math.min(...cells.map((cell) => cell.col))
  const maxCol = Math.max(...cells.map((cell) => cell.col))
  const minRow = Math.min(...cells.map((cell) => cell.row))
  const maxRow = Math.max(...cells.map((cell) => cell.row))
  const columns = maxCol - minCol + 1
  const rows = maxRow - minRow + 1
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  return {
    x: map.gridOffsetX + minCol * gridSize,
    y: map.gridOffsetY + minRow * gridSize,
    width: columns * gridSize,
    height: rows * gridSize,
    widthFeet: columns * feetPerCell,
    heightFeet: rows * feetPerCell,
  }
}
