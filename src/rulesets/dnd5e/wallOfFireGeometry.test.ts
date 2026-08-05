import { describe, expect, it } from 'vitest'
import { dnd5eWallOfFireCells, dnd5eWallOfFireDamageCells } from './wallOfFireGeometry'

const map = { width: 1000, height: 1000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0 }

describe('Wall of Fire geometry', () => {
  it.each([0, 180])('uses exactly one 5-foot row by twelve cells at %i degrees', (angleDegrees) => {
    const cells = dnd5eWallOfFireCells({
      anchor: { col: 10, row: 10 },
      shape: 'line',
      angleDegrees,
      map,
    })

    expect(cells).toHaveLength(12)
    expect(new Set(cells.map((cell) => cell.row))).toEqual(new Set([10]))
  })

  it.each([90, 270])('uses exactly one 5-foot column by twelve cells at %i degrees', (angleDegrees) => {
    const cells = dnd5eWallOfFireCells({
      anchor: { col: 10, row: 10 },
      shape: 'line',
      angleDegrees,
      map,
    })

    expect(cells).toHaveLength(12)
    expect(new Set(cells.map((cell) => cell.col))).toEqual(new Set([10]))
  })

  it('keeps the selected axis-aligned burning side to a 10-by-60-foot band', () => {
    const anchor = { col: 10, row: 10 }
    const wallCells = dnd5eWallOfFireCells({ anchor, shape: 'line', angleDegrees: 0, map })
    const wallKeys = new Set(wallCells.map((cell) => `${cell.col},${cell.row}`))
    const leftHazard = dnd5eWallOfFireDamageCells({
      anchor,
      wallCells,
      shape: 'line',
      angleDegrees: 0,
      damagingSide: 'left',
      map,
    }).filter((cell) => !wallKeys.has(`${cell.col},${cell.row}`))

    expect(leftHazard).toHaveLength(24)
    expect(new Set(leftHazard.map((cell) => cell.row))).toEqual(new Set([11, 12]))
  })

  it('supports arbitrary line angles and independently selected sides', () => {
    const anchor = { col: 10, row: 10 }
    const wallCells = dnd5eWallOfFireCells({ anchor, shape: 'line', angleDegrees: 37, map })
    const left = dnd5eWallOfFireDamageCells({ anchor, wallCells, shape: 'line', angleDegrees: 37, damagingSide: 'left', map })
    const right = dnd5eWallOfFireDamageCells({ anchor, wallCells, shape: 'line', angleDegrees: 37, damagingSide: 'right', map })
    expect(wallCells.length).toBeGreaterThan(12)
    expect(left).not.toEqual(right)
    expect(left).toEqual(expect.arrayContaining(wallCells))
    expect(right).toEqual(expect.arrayContaining(wallCells))
  })

  it('supports a ring with independently selected inside and outside damage bands', () => {
    const anchor = { col: 10, row: 10 }
    const wallCells = dnd5eWallOfFireCells({ anchor, shape: 'ring', angleDegrees: 0, map })
    const inside = dnd5eWallOfFireDamageCells({ anchor, wallCells, shape: 'ring', angleDegrees: 0, damagingSide: 'inside', map })
    const outside = dnd5eWallOfFireDamageCells({ anchor, wallCells, shape: 'ring', angleDegrees: 0, damagingSide: 'outside', map })
    expect(wallCells.length).toBeGreaterThanOrEqual(8)
    expect(inside).toContainEqual(anchor)
    expect(outside).not.toContainEqual(anchor)
  })
})
