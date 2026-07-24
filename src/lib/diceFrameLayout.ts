export interface DiceFrameLayout {
  tableMultiplier: number
  visualScaleMultiplier: number
}

export interface SettledDiceGridPoint {
  columnOffset: number
  rowOffset: number
}

export function settledDiceGrid(
  qty: number,
  width: number,
  height: number,
): SettledDiceGridPoint[] {
  const safeQty = Math.max(1, Math.min(12, Math.round(Number(qty) || 1)))
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

export function diceFrameLayout(qty: number, sides: number): DiceFrameLayout {
  const safeQty = Math.max(1, Math.min(12, Math.round(Number(qty) || 1)))
  const safeSides = Math.max(2, Math.min(100, Math.round(Number(sides) || 6)))
  const isD4 = safeSides === 4
  const tableMultiplier = isD4
    ? Math.min(1.45, 1 + Math.max(0, safeQty - 1) * 0.1)
    : safeQty <= 3
      ? 1
      : Math.min(1.55, 1 + Math.max(0, safeQty - 3) * 0.12)

  if (isD4) {
    return {
      tableMultiplier,
      visualScaleMultiplier: 0.92 * 0.9,
    }
  }

  // The renderer frames the whole physics table. When that table grows for a
  // multi-die roll, scale the dice by the same factor so one die remains the
  // same on-screen size as a normal 1d6 instead of shrinking with the camera.
  return {
    tableMultiplier,
    visualScaleMultiplier: 1.15 * tableMultiplier * 0.9,
  }
}
