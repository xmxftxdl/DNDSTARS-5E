import { describe, expect, it } from 'vitest'
import { diceFrameLayout, settledDiceGrid } from './diceFrameLayout'

describe('dice frame layout', () => {
  it('keeps each die in an 8d6 roll the same apparent size as a normal d6', () => {
    const normal = diceFrameLayout(1, 6)
    const fireball = diceFrameLayout(8, 6)

    expect(fireball.tableMultiplier).toBeGreaterThan(normal.tableMultiplier)
    expect(fireball.visualScaleMultiplier / fireball.tableMultiplier)
      .toBeCloseTo(normal.visualScaleMultiplier / normal.tableMultiplier, 8)
  })

  it('keeps the existing dedicated d4 sizing path', () => {
    const d4 = diceFrameLayout(1, 4)
    expect(d4.tableMultiplier).toBe(1)
    expect(d4.visualScaleMultiplier).toBeCloseTo(0.828, 8)
  })

  it('clamps excessive quantities to the supported twelve-die frame', () => {
    expect(diceFrameLayout(100, 6)).toEqual(diceFrameLayout(12, 6))
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

  it('centers the final short row instead of leaving a diagonal tail', () => {
    const points = settledDiceGrid(6, 680, 420)
    const lastRow = points.filter((point) => point.rowOffset === 0.5)
    expect(lastRow.map((point) => point.columnOffset)).toEqual([-0.5, 0.5])
  })
})
