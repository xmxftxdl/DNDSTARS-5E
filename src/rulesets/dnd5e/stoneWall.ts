import type { GridCell } from '../../lib/gridCombat'
import type { BattleMap } from '../../store/maps'

export interface StoneWallLayout {
  mode: 'thick' | 'thin'
  start: GridCell
  /** Consecutive panels share their endpoints; angles are in map degrees. */
  angles: number[]
}
export interface StoneWallPanel {
  id: string
  start: GridCell
  end: GridCell
  cells: GridCell[]
  hitPoints: number
  maxHitPoints: number
}
export interface StoneWallState {
  /** Shared panel HP/geometry state; ice uses 1-foot-thick, 30-HP panels. */
  mode: 'thick' | 'thin' | 'ice'
  panels: StoneWallPanel[]
  saveDc: number
  escapes?: { tokenId: string; status: 'pending' | 'ready' | 'failed' | 'done'; origin: GridCell }[]
}

export function stoneWallPanels(layout: StoneWallLayout, map: Pick<BattleMap, 'feetPerCell'>): StoneWallPanel[] {
  let start = { ...layout.start }
  const length = (layout.mode === 'thin' ? 20 : 10) / (map.feetPerCell ?? 5)
  return layout.angles.map((angle, index) => {
    const radians = angle * Math.PI / 180
    const end = { col: start.col + Math.cos(radians) * length, row: start.row + Math.sin(radians) * length }
    const cells = new Map<string, GridCell>()
    // Sample the wall centreline, including joints. This is the same grid
    // occupancy used for targeting, collision, destruction and persistence.
    const samples = Math.ceil(length * 8)
    for (let i = 0; i <= samples; i++) {
      const cell = { col: Math.round(start.col + (end.col - start.col) * i / samples), row: Math.round(start.row + (end.row - start.row) * i / samples) }
      cells.set(`${cell.col},${cell.row}`, cell)
    }
    const maxHitPoints = layout.mode === 'thin' ? 90 : 180
    const panel = { id: `panel-${index + 1}`, start, end, cells: [...cells.values()], hitPoints: maxHitPoints, maxHitPoints }
    start = end
    return panel
  })
}

export function stoneWallCells(panels: readonly StoneWallPanel[]): GridCell[] {
  return [...new Map(panels.filter(panel => panel.hitPoints > 0).flatMap(panel => panel.cells).map(cell => [`${cell.col},${cell.row}`, cell])).values()]
}

export function stoneWallNextAngle(layout: StoneWallLayout, pointer: GridCell, map: Pick<BattleMap, 'feetPerCell'>): number {
  const panels = stoneWallPanels(layout, map)
  const start = panels.at(-1)?.end ?? layout.start
  const dx = pointer.col - start.col, dy = pointer.row - start.row
  // Keep the previous heading when the cursor is exactly on the joint.
  if (Math.hypot(dx, dy) < 1e-8) return layout.angles.at(-1) ?? 0
  return Math.atan2(dy, dx) * 180 / Math.PI
}

export function validStoneWallLayout(value: StoneWallLayout | undefined): value is StoneWallLayout {
  return !!value && (value.mode === 'thick' || value.mode === 'thin') &&
    Number.isInteger(value.start?.col) && Number.isInteger(value.start?.row) &&
    Array.isArray(value.angles) && value.angles.length > 0 && value.angles.length <= 10 &&
    value.angles.every(angle => Number.isFinite(angle) && Math.abs(angle) <= 360)
}

export function normalizeStoneWallState(value: StoneWallState | undefined): StoneWallState | undefined {
  if (!value || !['thick', 'thin', 'ice'].includes(value.mode) || !Array.isArray(value.panels) ||
    value.panels.length < 1 || value.panels.length > 10 || !Number.isFinite(value.saveDc)) return undefined
  const maxHp = value.mode === 'ice' ? 30 : value.mode === 'thin' ? 90 : 180
  const point = (p: GridCell) => p && Number.isFinite(p.col) && Number.isFinite(p.row) && Math.abs(p.col) < 100_000 && Math.abs(p.row) < 100_000
  if (new Set(value.panels.map(p => p?.id)).size !== value.panels.length || value.panels.some(p => !p || typeof p.id !== 'string' ||
    !point(p.start) || !point(p.end) || !Number.isInteger(p.hitPoints) || p.hitPoints < 0 || p.hitPoints > maxHp ||
    !Array.isArray(p.cells) || p.cells.length > 100 || p.cells.some(c => !point(c) || !Number.isInteger(c.col) || !Number.isInteger(c.row)))) return undefined
  return { mode: value.mode, saveDc: value.saveDc, panels: value.panels.map(p => ({ ...p, maxHitPoints: maxHp })),
    escapes: Array.isArray(value.escapes) ? value.escapes.filter(e => e && typeof e.tokenId === 'string' &&
      ['pending', 'ready', 'failed', 'done'].includes(e.status) && point(e.origin)).slice(0, 256) : undefined }
}

/** Flood the local footprint: only pockets closed by the new wall qualify.
 * Existing map barriers are supplied by the caller for walls joining rooms. */
export function stoneWallEnclosedCells(panels: readonly StoneWallPanel[], blocked?: (from: GridCell, to: GridCell) => boolean): Set<string> {
  const cells = stoneWallCells(panels)
  if (!cells.length) return new Set()
  const walls = new Set(cells.map(cell => `${cell.col},${cell.row}`))
  const minCol = Math.min(...cells.map(cell => cell.col)) - 1
  const maxCol = Math.max(...cells.map(cell => cell.col)) + 1
  const minRow = Math.min(...cells.map(cell => cell.row)) - 1
  const maxRow = Math.max(...cells.map(cell => cell.row)) + 1
  const flood = (withWall: boolean) => {
    const seen = new Set<string>(), queue: GridCell[] = []
    for (let col = minCol; col <= maxCol; col++) for (const row of [minRow, maxRow]) queue.push({ col, row })
    for (let row = minRow; row <= maxRow; row++) for (const col of [minCol, maxCol]) queue.push({ col, row })
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i], key = `${cell.col},${cell.row}`
      if (seen.has(key) || (withWall && walls.has(key))) continue
      seen.add(key)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { col: cell.col + dc, row: cell.row + dr }
        if (next.col < minCol || next.col > maxCol || next.row < minRow || next.row > maxRow || seen.has(`${next.col},${next.row}`) || blocked?.(cell, next)) continue
        queue.push(next)
      }
    }
    return seen
  }
  const before = flood(false), after = flood(true)
  return new Set([...before].filter(key => !after.has(key) && !walls.has(key)))
}
