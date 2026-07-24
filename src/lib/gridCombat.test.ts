import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import {
  cellToPixel,
  occupiedCells,
  pixelToCell,
  resolveFreeDropCell,
  resolveTokenDropPosition,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
} from './gridCombat'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'enemy',
    ...patch,
  }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 1000,
    height: 1000,
    gridSize: 100,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

// Place a token at the center of a specific cell.
function atCell(id: string, col: number, row: number, m: BattleMap, type: Token['type'] = 'enemy'): Token {
  const p = cellToPixel({ col, row }, m)
  return token({ id, x: p.x, y: p.y, type })
}

function atAnchor(id: string, col: number, row: number, m: BattleMap, patch: Partial<Token> = {}): Token {
  const base = token({ id, ...patch })
  const p = tokenCenterForAnchorCell({ col, row }, base, m)
  return { ...base, x: p.x, y: p.y }
}

describe('grid token occupancy on drop', () => {
  it('keeps unsnapped monster footprints inside every map edge', () => {
    const m = { ...map([]), snapMonstersToGrid: false }
    const monster = token({ id: 'edge-monster', creatureSize: '大型', size: 2 })

    expect(resolveTokenDropPosition(-100, 1_200, monster, m)).toEqual({
      x: 100,
      y: 900,
    })
  })

  it('excludes the moving token from occupied cells', () => {
    const m = map([])
    const a = atCell('a', 0, 0, m)
    const b = atCell('b', 1, 0, m)
    const full = map([a, b])
    const blockedForA = occupiedCells(full.tokens, full, 'a')
    expect(blockedForA.has('0,0')).toBe(false) // Own cell is ignored.
    expect(blockedForA.has('1,0')).toBe(true)
  })

  it('snaps drops on an empty cell to that cell center', () => {
    const m = map([])
    const a = atCell('a', 0, 0, m)
    const full = map([a])
    // Drag to cell (3,3).
    const targetPx = cellToPixel({ col: 3, row: 3 }, full)
    const pos = resolveFreeDropCell(targetPx.x, targetPx.y, 'a', full)
    expect(pixelToCell(pos.x, pos.y, full)).toEqual({ col: 3, row: 3 })
  })

  it('moves a drop on an occupied cell to the nearest free cell', () => {
    const m = map([])
    const a = atCell('a', 0, 0, m)
    const b = atCell('b', 2, 2, m)
    const full = map([a, b])
    // Drag token a to token b at cell (2,2).
    const targetPx = cellToPixel({ col: 2, row: 2 }, full)
    const pos = resolveFreeDropCell(targetPx.x, targetPx.y, 'a', full)
    const landed = pixelToCell(pos.x, pos.y, full)
    // Should not land on b.
    expect(landed).not.toEqual({ col: 2, row: 2 })
    // Should land on a nearest adjacent empty cell (Chebyshev distance 1).
    expect(Math.max(Math.abs(landed.col - 2), Math.abs(landed.row - 2))).toBe(1)
    // The landing cell must be unoccupied.
    const blocked = occupiedCells(full.tokens, full, 'a')
    expect(blocked.has(`${landed.col},${landed.row}`)).toBe(false)
  })

  it('allows dropping on the token original cell', () => {
    const m = map([])
    const a = atCell('a', 4, 4, m)
    const full = map([a])
    // Dropping token a in place should keep it on its own cell.
    const targetPx = cellToPixel({ col: 4, row: 4 }, full)
    const pos = resolveFreeDropCell(targetPx.x, targetPx.y, 'a', full)
    expect(pixelToCell(pos.x, pos.y, full)).toEqual({ col: 4, row: 4 })
  })

  it('large tokens occupy 2x2 cells and center on the four-cell intersection', () => {
    const m = map([])
    const large = atAnchor('large', 2, 3, m, { creatureSize: '\u5927\u578b', size: 2 })
    expect({ x: large.x, y: large.y }).toEqual({ x: 300, y: 400 })
    const keys = tokenOccupiedCellsAt(large, m, large).map((cell) => `${cell.col},${cell.row}`).sort()
    expect(keys).toEqual(['2,3', '2,4', '3,3', '3,4'])
  })

  it('huge centers on the middle cell and gargantuan centers on a four-cell intersection', () => {
    const m = map([])
    const huge = atAnchor('huge', 5, 5, m, { creatureSize: '\u8d85\u5927\u578b', size: 3 })
    const gargantuan = atAnchor('gargantuan', 5, 5, m, { creatureSize: '\u5de8\u578b', size: 4 })
    expect({ x: huge.x, y: huge.y }).toEqual(cellToPixel({ col: 6, row: 6 }, m))
    expect(tokenOccupiedCellsAt(huge, m, huge)).toHaveLength(9)
    expect({ x: gargantuan.x, y: gargantuan.y }).toEqual({ x: 700, y: 700 })
    expect(tokenOccupiedCellsAt(gargantuan, m, gargantuan)).toHaveLength(16)
  })

  it('drop resolution avoids every covered cell of a large token', () => {
    const m = map([])
    const a = atCell('a', 0, 0, m)
    const large = atAnchor('large', 2, 2, m, { creatureSize: '\u5927\u578b', size: 2 })
    const full = map([a, large])
    const targetPx = cellToPixel({ col: 2, row: 2 }, full)
    const pos = resolveFreeDropCell(targetPx.x, targetPx.y, 'a', full)
    const landed = pixelToCell(pos.x, pos.y, full)
    const blocked = occupiedCells(full.tokens, full, 'a')
    expect(blocked.has(`${landed.col},${landed.row}`)).toBe(false)
  })
})
