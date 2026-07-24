import { describe, expect, it } from 'vitest'
import {
  createTokenMovementAnimation,
  normalizeTokenMovementAnimation,
  tokenMovementAnimationPosition,
  truncateTokenMovementPath,
} from './tokenMovementAnimation'

describe('token movement path animation', () => {
  it('interpolates across each path segment by traveled distance', () => {
    const animation = createTokenMovementAnimation({
      id: 'move',
      path: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }],
      finalPosition: { x: 10, y: 30 },
      issuedAt: 1,
    })!
    expect(tokenMovementAnimationPosition(animation, animation.durationMs * 0.25)).toEqual({ x: 10, y: 0 })
    expect(tokenMovementAnimationPosition(animation, animation.durationMs * 0.5)).toEqual({ x: 10, y: 10 })
    expect(tokenMovementAnimationPosition(animation, animation.durationMs)).toBeUndefined()
  })

  it('keeps fractional frame positions instead of snapping movement to coarse steps', () => {
    const animation = createTokenMovementAnimation({
      id: 'smooth-move',
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      finalPosition: { x: 100, y: 0 },
      issuedAt: 1,
    })!
    const first = tokenMovementAnimationPosition(animation, 10)!
    const second = tokenMovementAnimationPosition(animation, 20)!
    expect(first.x).toBeGreaterThan(0)
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.x - first.x).toBeCloseTo(1000 / animation.durationMs, 5)
    expect(first.y).toBe(0)
    expect(second.y).toBe(0)
  })

  it('truncates a route at an authoritative hazard stop', () => {
    expect(truncateTokenMovementPath(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
      { x: 10, y: 0 },
    )).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }])
  })

  it('fails closed for malformed or oversized shared paths', () => {
    expect(normalizeTokenMovementAnimation({ id: 'bad', points: [{ x: 0, y: 0 }], durationMs: 500, issuedAt: 1 })).toBeUndefined()
    expect(normalizeTokenMovementAnimation({
      id: 'bad', points: Array.from({ length: 129 }, (_, x) => ({ x, y: 0 })), durationMs: 500, issuedAt: 1,
    })).toBeUndefined()
  })
})
