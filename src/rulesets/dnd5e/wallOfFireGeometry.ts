import { cellKey, type GridCell } from '../../lib/gridCombat'
import { cellsInRect } from '../../lib/skillTargeting'
import type { BattleMap } from '../../store/maps'

export type Dnd5eWallOfFireShape = 'line' | 'ring'
export type Dnd5eWallOfFireDamagingSide = 'left' | 'right' | 'inside' | 'outside'

export interface Dnd5eWallOfFireGeometry {
  shape: Dnd5eWallOfFireShape
  angleDegrees: number
  damagingSide: Dnd5eWallOfFireDamagingSide
}

type WallMap = Pick<BattleMap, 'width' | 'height' | 'gridSize' | 'gridOffsetX' | 'gridOffsetY'>

export function normalizeWallOfFireAngle(angleDegrees: number): number {
  return ((angleDegrees % 360) + 360) % 360
}

function mapBounds(map: WallMap) {
  return {
    columns: Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize))),
    rows: Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize))),
  }
}

function clipped(cells: readonly GridCell[], map: WallMap): GridCell[] {
  const { columns, rows } = mapBounds(map)
  const unique = new Map<string, GridCell>()
  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows) continue
    unique.set(cellKey(cell), cell)
  }
  return [...unique.values()]
}

/** Authoritative 5-foot-grid approximation of either a 60-foot line or 20-foot-diameter ring. */
export function dnd5eWallOfFireCells(input: {
  anchor: GridCell
  shape: Dnd5eWallOfFireShape
  angleDegrees: number
  map: WallMap
}): GridCell[] {
  if (input.shape === 'ring') {
    const radius = 2
    const halfCellDiagonal = Math.SQRT1_2
    const cells: GridCell[] = []
    for (let row = input.anchor.row - 3; row <= input.anchor.row + 3; row += 1) {
      for (let col = input.anchor.col - 3; col <= input.anchor.col + 3; col += 1) {
        const distance = Math.hypot(col - input.anchor.col, row - input.anchor.row)
        if (Math.abs(distance - radius) <= halfCellDiagonal) cells.push({ col, row })
      }
    }
    return clipped(cells, input.map)
  }
  const angle = normalizeWallOfFireAngle(input.angleDegrees)
  // A 1-foot-thick wall is represented by exactly one 5-foot grid lane. The
  // generic polygon-touching helper includes cells that merely touch both
  // long edges, which turns axis-aligned walls into a 15-by-60-foot strip.
  if (angle === 0 || angle === 180) {
    return clipped(Array.from({ length: 12 }, (_, index) => ({
      col: input.anchor.col + index - 5,
      row: input.anchor.row,
    })), input.map)
  }
  if (angle === 90 || angle === 270) {
    return clipped(Array.from({ length: 12 }, (_, index) => ({
      col: input.anchor.col,
      row: input.anchor.row + index - 5,
    })), input.map)
  }
  const radians = angle * Math.PI / 180
  // cellsInRect's direction is its short axis; the requested angle is the wall's long axis.
  const normal = { x: -Math.sin(radians), y: Math.cos(radians) }
  const orientFrom = {
    col: input.anchor.col - normal.x * 10,
    row: input.anchor.row - normal.y * 10,
  }
  return clipped(cellsInRect(input.anchor, orientFrom, 60, 5), input.map)
}

/** Selected 10-foot damage band. Ring walls choose inside/outside; line walls choose left/right. */
export function dnd5eWallOfFireDamageCells(input: {
  anchor: GridCell
  wallCells: readonly GridCell[]
  shape: Dnd5eWallOfFireShape
  angleDegrees: number
  damagingSide: Dnd5eWallOfFireDamagingSide
  map: WallMap
}): GridCell[] {
  const wallKeys = new Set(input.wallCells.map(cellKey))
  const { columns, rows } = mapBounds(input.map)
  const result = new Map<string, GridCell>(input.wallCells.map((cell) => [cellKey(cell), cell]))
  if (input.shape === 'ring') {
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
      const distance = Math.hypot(col - input.anchor.col, row - input.anchor.row)
      const selected = input.damagingSide === 'inside'
        ? distance < 2
        : input.damagingSide === 'outside' && distance > 2 && distance <= 4
      if (selected) result.set(cellKey({ col, row }), { col, row })
    }
    return [...result.values()]
  }
  const angle = normalizeWallOfFireAngle(input.angleDegrees)
  if (angle === 0 || angle === 90 || angle === 180 || angle === 270) {
    const normal = angle === 0
      ? { col: 0, row: 1 }
      : angle === 90
        ? { col: -1, row: 0 }
        : angle === 180
          ? { col: 0, row: -1 }
          : { col: 1, row: 0 }
    const sign = input.damagingSide === 'left' ? 1 : -1
    for (const wallCell of input.wallCells) {
      for (let distance = 1; distance <= 2; distance += 1) {
        const candidate = {
          col: wallCell.col + normal.col * sign * distance,
          row: wallCell.row + normal.row * sign * distance,
        }
        if (candidate.col < 0 || candidate.row < 0 || candidate.col >= columns || candidate.row >= rows) continue
        result.set(cellKey(candidate), candidate)
      }
    }
    return [...result.values()]
  }
  const radians = angle * Math.PI / 180
  const along = { x: Math.cos(radians), y: Math.sin(radians) }
  const left = { x: -along.y, y: along.x }
  const sign = input.damagingSide === 'left' ? 1 : -1
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
    const delta = { x: col - input.anchor.col, y: row - input.anchor.row }
    const longitudinal = delta.x * along.x + delta.y * along.y
    const lateral = (delta.x * left.x + delta.y * left.y) * sign
    if (Math.abs(longitudinal) <= 6.5 && lateral >= 0 && lateral <= 2.5) {
      result.set(`${col},${row}`, { col, row })
    }
  }
  for (const key of wallKeys) if (!result.has(key)) {
    const [col, row] = key.split(',').map(Number)
    result.set(key, { col, row })
  }
  return [...result.values()]
}
