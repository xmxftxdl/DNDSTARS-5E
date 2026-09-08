import { cellKey, type GridCell } from '../../lib/gridCombat'
import type { BattleMap } from '../../store/maps'

export type Dnd5eWallOfFireShape = 'line' | 'ring'
export type Dnd5eWallOfFireDamagingSide = 'left' | 'right' | 'inside' | 'outside'

export interface Dnd5eWallOfFireGeometry {
  shape: Dnd5eWallOfFireShape
  angleDegrees: number
  damagingSide: Dnd5eWallOfFireDamagingSide
  lengthFeet?: number
  diameterFeet?: number
}

export const WALL_OF_FIRE_MAX_LENGTH_FEET = 60
export const WALL_OF_FIRE_MAX_DIAMETER_FEET = 20

export function normalizeWallOfFireDimension(value: number | undefined, maximum: number): number {
  if (value == null || !Number.isFinite(value)) return maximum
  return Math.max(5, Math.min(maximum, Math.round(value / 5) * 5))
}

type WallMap = Pick<BattleMap, 'width' | 'height' | 'gridSize' | 'gridOffsetX' | 'gridOffsetY'>

const DND5E_THIN_WALL_SPELL_IDS = new Set([
  'wall-of-fire',
  'wind-wall',
  'wall-of-force',
  'wall-of-stone',
  'wall-of-ice',
  'wall-of-thorns',
])

export function dnd5eSpellUsesThinWallCells(spellId: string): boolean {
  return DND5E_THIN_WALL_SPELL_IDS.has(spellId)
}

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

/**
 * Rasterizes a rules-thin wall as one connected grid lane.
 *
 * `cellsInRect` deliberately includes every cell whose closed polygon touches
 * a template. That is useful for ordinary areas, but a 5-foot-wide rectangle
 * then grows to three grid lanes because the neighboring cells touch its long
 * edges. Walls need a center-line raster instead.
 */
export function dnd5eThinWallCells(input: {
  anchor: GridCell
  angleDegrees: number
  lengthFeet: number | undefined
  maximumLengthFeet: number
  map: WallMap
}): GridCell[] {
  const normalizedAngle = normalizeWallOfFireAngle(input.angleDegrees)
  // A wall is undirected: 0° and 180° (likewise 90° and 270°) must produce
  // identical cells. Canonicalizing also keeps even-length anchor bias stable.
  const angle = normalizedAngle >= 180 ? normalizedAngle - 180 : normalizedAngle
  const lengthFeet = normalizeWallOfFireDimension(input.lengthFeet, input.maximumLengthFeet)
  const lengthCells = Math.round(lengthFeet / 5)
  const radians = angle * Math.PI / 180
  const cellsBeforeAnchor = Math.floor(lengthCells / 2)
  const cellsAfterAnchor = lengthCells - cellsBeforeAnchor - 1
  const start = {
    col: Math.round(input.anchor.col - Math.cos(radians) * cellsBeforeAnchor),
    row: Math.round(input.anchor.row - Math.sin(radians) * cellsBeforeAnchor),
  }
  const end = {
    col: Math.round(input.anchor.col + Math.cos(radians) * cellsAfterAnchor),
    row: Math.round(input.anchor.row + Math.sin(radians) * cellsAfterAnchor),
  }
  const deltaCol = end.col - start.col
  const deltaRow = end.row - start.row
  const columns = Math.abs(deltaCol)
  const rows = Math.abs(deltaRow)
  const stepCol = Math.sign(deltaCol)
  const stepRow = Math.sign(deltaRow)
  let col = start.col
  let row = start.row
  let columnSteps = 0
  let rowSteps = 0
  const cells: GridCell[] = [{ col, row }]
  while (columnSteps < columns || rowSteps < rows) {
    const decision = (1 + 2 * columnSteps) * rows - (1 + 2 * rowSteps) * columns
    if (decision === 0) {
      col += stepCol
      row += stepRow
      columnSteps += 1
      rowSteps += 1
    } else if (decision < 0) {
      col += stepCol
      columnSteps += 1
    } else {
      row += stepRow
      rowSteps += 1
    }
    cells.push({ col, row })
  }
  return clipped(cells, input.map)
}

/** Authoritative 5-foot-grid approximation of either a 60-foot line or 20-foot-diameter ring. */
export function dnd5eWallOfFireCells(input: {
  anchor: GridCell
  shape: Dnd5eWallOfFireShape
  angleDegrees: number
  lengthFeet?: number
  diameterFeet?: number
  map: WallMap
}): GridCell[] {
  if (input.shape === 'ring') {
    const radius = normalizeWallOfFireDimension(input.diameterFeet, WALL_OF_FIRE_MAX_DIAMETER_FEET) / 10
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
  return dnd5eThinWallCells({
    anchor: input.anchor,
    angleDegrees: input.angleDegrees,
    lengthFeet: input.lengthFeet,
    maximumLengthFeet: WALL_OF_FIRE_MAX_LENGTH_FEET,
    map: input.map,
  })
}

/** Selected 10-foot damage band. Ring walls choose inside/outside; line walls choose left/right. */
export function dnd5eWallOfFireDamageCells(input: {
  anchor: GridCell
  wallCells: readonly GridCell[]
  shape: Dnd5eWallOfFireShape
  angleDegrees: number
  damagingSide: Dnd5eWallOfFireDamagingSide
  lengthFeet?: number
  diameterFeet?: number
  map: WallMap
}): GridCell[] {
  const wallKeys = new Set(input.wallCells.map(cellKey))
  const { columns, rows } = mapBounds(input.map)
  const result = new Map<string, GridCell>(input.wallCells.map((cell) => [cellKey(cell), cell]))
  if (input.shape === 'ring') {
    const radius = normalizeWallOfFireDimension(input.diameterFeet, WALL_OF_FIRE_MAX_DIAMETER_FEET) / 10
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
      const distance = Math.hypot(col - input.anchor.col, row - input.anchor.row)
      const selected = input.damagingSide === 'inside'
        ? distance < radius
        : input.damagingSide === 'outside' && distance > radius && distance <= radius + 2
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
  const halfLength = normalizeWallOfFireDimension(input.lengthFeet, WALL_OF_FIRE_MAX_LENGTH_FEET) / 10
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
    const delta = { x: col - input.anchor.col, y: row - input.anchor.row }
    const longitudinal = delta.x * along.x + delta.y * along.y
    const lateral = (delta.x * left.x + delta.y * left.y) * sign
    if (Math.abs(longitudinal) <= halfLength + 0.5 && lateral >= 0 && lateral <= 2.5) {
      result.set(`${col},${row}`, { col, row })
    }
  }
  for (const key of wallKeys) if (!result.has(key)) {
    const [col, row] = key.split(',').map(Number)
    result.set(key, { col, row })
  }
  return [...result.values()]
}
