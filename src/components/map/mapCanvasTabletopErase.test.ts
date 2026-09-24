import { describe, expect, it } from 'vitest'
import { tabletopStrokeIntersectsBox } from './mapCanvasGeometry'

describe('freehand box deletion', () => {
  const from = { x: 10, y: 10 }, to = { x: 20, y: 20 }
  it('includes a crossing segment even when both endpoints are outside', () => {
    expect(tabletopStrokeIntersectsBox([{ x: 0, y: 15 }, { x: 30, y: 15 }], from, to)).toBe(true)
  })
  it('does not delete a stroke merely because its bounding box overlaps', () => {
    expect(tabletopStrokeIntersectsBox([{ x: 0, y: 11 }, { x: 11, y: 30 }], from, to)).toBe(false)
  })
  it('supports reverse drags and fully enclosed strokes', () => {
    expect(tabletopStrokeIntersectsBox([{ x: 12, y: 12 }, { x: 18, y: 18 }], to, from)).toBe(true)
  })
})
