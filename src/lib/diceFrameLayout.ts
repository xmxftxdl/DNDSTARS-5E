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

export function diceFrameLayout(qty: number, _sides: number): DiceFrameLayout {
  void _sides
  const safeQty = Math.max(1, Math.min(12, Math.round(Number(qty) || 1)))
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
