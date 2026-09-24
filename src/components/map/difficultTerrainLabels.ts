import type { MapDifficultTerrainCell } from '../../lib/mapDifficultTerrain'

/** One top-edge label per connected region with the same movement cost. */
export function difficultTerrainLabelCells(cells: readonly MapDifficultTerrainCell[]) {
  const key = (cell: { col: number; row: number }) => `${cell.col},${cell.row}`
  const remaining = new Map(cells.map(cell => [key(cell), cell]))
  const labels = new Set<string>()
  for (const seed of cells) {
    if (!remaining.delete(key(seed))) continue
    const region = [seed]
    for (let index = 0; index < region.length; index++) {
      const cell = region[index]
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighborKey = `${cell.col + dc},${cell.row + dr}`
        const neighbor = remaining.get(neighborKey)
        if (!neighbor || neighbor.multiplier !== seed.multiplier) continue
        remaining.delete(neighborKey)
        region.push(neighbor)
      }
    }
    const top = Math.min(...region.map(cell => cell.row))
    const edge = region.filter(cell => cell.row === top).sort((a, b) => a.col - b.col)
    labels.add(key(edge[Math.floor(edge.length / 2)]))
  }
  return labels
}
