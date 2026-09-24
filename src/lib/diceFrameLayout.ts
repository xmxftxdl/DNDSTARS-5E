import { MAX_DICE_POOL_COUNT } from './dicePoolLimits'
export interface DiceFrameLayout {
  tableMultiplier: number
  visualScaleMultiplier: number
}

export interface SettledDiceGridPoint {
  columnOffset: number
  rowOffset: number
}

/** Physics bounds are half extents, independent of the canvas pixel size. */
export function dicePhysicsDimensions(qty: number, dimensions: { x: number; y: number }, scale: number) {
  if (qty <= 12) return dimensions
  const grid = settledDiceGrid(qty, dimensions.x, dimensions.y)
  const columns = new Set(grid.map(point => point.columnOffset)).size
  const rows = new Set(grid.map(point => point.rowOffset)).size
  // Leave room to tumble, not just enough area to pack the resting bodies.
  return {
    x: Math.max(dimensions.x, columns * scale * 1.6 / 0.93),
    y: Math.max(dimensions.y, rows * scale * 1.6 / 0.93),
  }
}

/** Choose one size before a throw; gathering never changes it. */
export function dicePixelSize(qty: number, width: number, height: number): number {
  const grid = settledDiceGrid(qty, width, height)
  const columns = 1 + Math.max(...grid.map(p => p.columnOffset)) - Math.min(...grid.map(p => p.columnOffset))
  const rows = 1 + Math.max(...grid.map(p => p.rowOffset)) - Math.min(...grid.map(p => p.rowOffset))
  return Math.min(64, width * 0.8 / (columns * 1.24), height * 0.8 / (rows * 1.24))
}

/** NDC bounds are -1..1. Reserve a rim around the whole settled pool. */
export function fittedDiceZoom(zoom: number, projectedExtent: number): number {
  return zoom / Math.max(1, projectedExtent / 0.88)
}

export function settledDiceGrid(
  qty: number,
  width: number,
  height: number,
): SettledDiceGridPoint[] {
  const safeQty = Math.max(1, Math.min(MAX_DICE_POOL_COUNT, Math.round(Number(qty) || 1)))
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(1, Number(height) || 1)
  const aspect = Math.max(0.6, Math.min(2.4, safeWidth / safeHeight))
  const columns = Math.min(safeQty, Math.max(1, Math.ceil(Math.sqrt(safeQty * aspect))))
  const rows = Math.ceil(safeQty / columns)

  return Array.from({ length: safeQty }, (_, index) => {
    const row = Math.floor(index / columns)
    const entriesInRow = Math.min(columns, safeQty - row * columns)
    const column = index % columns
    return {
      columnOffset: column - (entriesInRow - 1) / 2,
      rowOffset: row - (rows - 1) / 2,
    }
  })
}

export function diceFrameLayout(qty: number, _sides: number): DiceFrameLayout {
  void _sides
  const safeQty = Math.max(1, Math.min(MAX_DICE_POOL_COUNT, Math.round(Number(qty) || 1)))
  const tableMultiplier = safeQty <= 3
    ? 1
    : Math.min(1.55, 1 + Math.max(0, safeQty - 3) * 0.12)

  // The renderer frames the whole physics table. When that table grows for a
  // multi-die roll, scale every die type by the same factor so d4, d6 and d8
  // retain the same apparent size instead of shrinking with the camera.
  return {
    tableMultiplier,
    visualScaleMultiplier: 1.15 * tableMultiplier * 0.9,
  }
}
