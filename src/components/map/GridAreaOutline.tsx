import { Group, Shape } from 'react-konva'
import { cellTopLeft, type GridCell } from '../../lib/gridCombat'
import type { BattleMap } from '../../store/maps'

/** Exposed cell edges preserve holes and the exact rules footprint. */
export function gridAreaBoundaryEdges(cells: readonly GridCell[]): number[][] {
  const unique = new Map(cells.map(cell => [`${cell.col},${cell.row}`, cell]))
  const edges: number[][] = []
  for (const { col: x, row: y } of unique.values()) {
    if (!unique.has(`${x},${y - 1}`)) edges.push([x, y, x + 1, y])
    if (!unique.has(`${x + 1},${y}`)) edges.push([x + 1, y, x + 1, y + 1])
    if (!unique.has(`${x},${y + 1}`)) edges.push([x + 1, y + 1, x, y + 1])
    if (!unique.has(`${x - 1},${y}`)) edges.push([x, y + 1, x, y])
  }
  return edges
}

export function GridAreaOutline({ cells, map, color = '#fde68a', dashed = false }: {
  cells: readonly GridCell[]; map: BattleMap; color?: string; dashed?: boolean
}) {
  const edges = gridAreaBoundaryEdges(cells)
  if (!edges.length) return null
  return <Group listening={false}>
    {[true, false].map(backing => <Shape key={String(backing)}
      stroke={backing ? '#291408' : color} strokeWidth={backing ? 4.5 : 2}
      strokeScaleEnabled={false} opacity={backing ? 0.9 : 1} dash={!backing && dashed ? [7, 4] : undefined}
      sceneFunc={(context, shape) => {
        context.beginPath()
        for (const [x1, y1, x2, y2] of edges) {
          const a = cellTopLeft({ col: x1, row: y1 }, map)
          const b = cellTopLeft({ col: x2, row: y2 }, map)
          context.moveTo(a.x, a.y); context.lineTo(b.x, b.y)
        }
        context.strokeShape(shape)
      }} />)}
  </Group>
}
