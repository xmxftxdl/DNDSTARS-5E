import { cellKey, type GridCell } from '../../lib/gridCombat'
import { dnd5eWallOfFireCells, type Dnd5eWallOfFireGeometry } from '../../rulesets/dnd5e/wallOfFireGeometry'
import type { BattleMap } from '../../store/maps'

type ClipContext = { beginPath(): void; rect(x: number, y: number, width: number, height: number): void; closePath(): void }

/** Clip genuine missing cells, not the staircase used to approximate a continuous wall. */
export function fireWallVisualClip(input: {
  cells: readonly GridCell[]
  anchor: GridCell
  geometry: Dnd5eWallOfFireGeometry
  map: Pick<BattleMap, 'width' | 'height' | 'gridSize' | 'gridOffsetX' | 'gridOffsetY'>
}): (context: ClipContext) => void {
  const occupied = new Set(input.cells.map(cellKey))
  const excluded = dnd5eWallOfFireCells({ anchor: input.anchor, ...input.geometry, map: input.map })
    .filter(cell => !occupied.has(cellKey(cell)))
  const grid = Math.max(1, input.map.gridSize)
  return context => {
    context.beginPath()
    if (input.cells.length) {
      context.rect(0, 0, input.map.width, input.map.height)
      for (const cell of excluded) {
        // Reverse winding subtracts these squares from the outer rectangle.
        context.rect(input.map.gridOffsetX + (cell.col + 1) * grid,
          input.map.gridOffsetY + cell.row * grid, -grid, grid)
      }
    }
    context.closePath()
  }
}
