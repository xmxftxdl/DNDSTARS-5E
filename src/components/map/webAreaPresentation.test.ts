import { describe, expect, it } from 'vitest'
import { createWebAreaStrands } from './webAreaPresentation'

describe('createWebAreaStrands', () => {
  it('shares a deterministic mature web made of spokes and rings', () => {
    const first = createWebAreaStrands(240, 180)
    const second = createWebAreaStrands(240, 180)

    expect(first).toEqual(second)
    expect(first).toHaveLength(19)
    expect(first.filter((strand) => strand.closed)).toHaveLength(5)
    expect(first.filter((strand) => !strand.closed)).toHaveLength(14)
  })

  it('keeps every strand inside the requested area bounds', () => {
    const width = 320
    const height = 200
    const strands = createWebAreaStrands(width, height)

    for (const strand of strands) {
      for (let index = 0; index < strand.points.length; index += 2) {
        expect(Math.abs(strand.points[index])).toBeLessThanOrEqual(width / 2 + 0.001)
        expect(Math.abs(strand.points[index + 1])).toBeLessThanOrEqual(height / 2 + 0.001)
      }
    }
  })
})
