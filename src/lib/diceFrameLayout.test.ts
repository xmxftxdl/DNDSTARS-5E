import { describe, expect, it } from 'vitest'
import { DICE_BASE_SCALE, DICE_D4_BASE_SCALE } from './diceEngine'
import { diceFrameLayout, dicePhysicsDimensions, fittedDiceZoom, settledDiceGrid } from './diceFrameLayout'

describe('dice frame layout', () => {
  it('gives twenty physical bodies tumbling room even in a short room tray', () => {
    const size = dicePhysicsDimensions(20, { x: 350, y: 150 }, 120)
    expect(size.x * size.y * 4 * 0.93 ** 2).toBeGreaterThan(20 * (120 * 2) ** 2)
    expect(dicePhysicsDimensions(2, { x: 350, y: 150 }, 120)).toEqual({ x: 350, y: 150 })
  })
  it('fits an overflowing eight-die pool inside the visible rim without enlarging an already fitted pool', () => {
    const zoom = fittedDiceZoom(1, 1.6)
    expect(zoom * 1.6).toBeCloseTo(0.88)
    expect(fittedDiceZoom(zoom, 0.88)).toBe(zoom)
    expect(fittedDiceZoom(1, 0.5)).toBe(1)
    const portrait = settledDiceGrid(8, 320, 600)
    expect(new Set(portrait.map(point => point.rowOffset)).size).toBeGreaterThan(2)
  })
  it('keeps each die in an 8d6 roll the same apparent size as a normal d6', () => {
    const normal = diceFrameLayout(1, 6)
    const fireball = diceFrameLayout(8, 6)

    expect(fireball.tableMultiplier).toBeGreaterThan(normal.tableMultiplier)
    expect(fireball.visualScaleMultiplier / fireball.tableMultiplier)
      .toBeCloseTo(normal.visualScaleMultiplier / normal.tableMultiplier, 8)
  })

  it('keeps d4 the same apparent size as d6 and d8 for single and multi-die rolls', () => {
    expect(DICE_D4_BASE_SCALE).toBe(DICE_BASE_SCALE)
    expect(diceFrameLayout(1, 4)).toEqual(diceFrameLayout(1, 6))
    expect(diceFrameLayout(1, 4)).toEqual(diceFrameLayout(1, 8))
    expect(diceFrameLayout(9, 4)).toEqual(diceFrameLayout(9, 6))
    expect(diceFrameLayout(9, 4)).toEqual(diceFrameLayout(9, 8))
  })

  it('lays out every die in large pools without overlapping grid slots, with a bounded maximum', () => {
    for (const count of [20, 26, 40, 100]) {
      const points = settledDiceGrid(count, 320, 600)
      expect(points).toHaveLength(count)
      expect(new Set(points.map(point => `${point.columnOffset}:${point.rowOffset}`)).size).toBe(count)
    }
    expect(settledDiceGrid(200, 320, 600)).toHaveLength(100)
  })

  it('arranges an 8d6 result as four columns by two centered rows', () => {
    const points = settledDiceGrid(8, 680, 420)
    expect(points).toHaveLength(8)
    expect(new Set(points.map((point) => point.columnOffset))).toEqual(
      new Set([-1.5, -0.5, 0.5, 1.5]),
    )
    expect(new Set(points.map((point) => point.rowOffset))).toEqual(new Set([-0.5, 0.5]))
    expect(new Set(points.map((point) => `${point.columnOffset}:${point.rowOffset}`)).size)
      .toBe(8)
  })

  it('gathers a single secret die at the exact center', () => {
    expect(settledDiceGrid(1, 680, 420)).toEqual([
      { columnOffset: 0, rowOffset: 0 },
    ])
  })

  it('centers the final short row instead of leaving a diagonal tail', () => {
    const points = settledDiceGrid(6, 680, 420)
    const lastRow = points.filter((point) => point.rowOffset === 0.5)
    expect(lastRow.map((point) => point.columnOffset)).toEqual([-0.5, 0.5])
  })
})
