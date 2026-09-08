import { describe, expect, it } from 'vitest'
import {
  createTokenMovementAnimation,
  continueTokenMovementPath,
  normalizeTokenMovementAnimation,
  tokenMovementAnimationForObservation,
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

  it('continues from a passed hazard checkpoint without replaying the earlier route', () => {
    expect(continueTokenMovementPath(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }],
      { x: 10, y: 0 },
      { x: 30, y: 0 },
    )).toEqual([{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }])
  })

  it('continues from a checkpoint projected between sparse route points', () => {
    expect(continueTokenMovementPath(
      [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }],
      { x: 10, y: 0 },
      { x: 30, y: 30 },
    )).toEqual([{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }])
  })

  it('fails closed for malformed or oversized shared paths', () => {
    expect(normalizeTokenMovementAnimation({ id: 'bad', points: [{ x: 0, y: 0 }], durationMs: 500, issuedAt: 1 })).toBeUndefined()
    expect(normalizeTokenMovementAnimation({
      id: 'bad', points: Array.from({ length: 129 }, (_, x) => ({ x, y: 0 })), durationMs: 500, issuedAt: 1,
    })).toBeUndefined()
  })

  it('compacts long summoned-token movement ids within the shared-state boundary', () => {
    const sharedPrefix = `monster-move:${'combat:'.padEnd(60, 'c')}:${'plugin-summon:'.padEnd(170, 's')}`
    const first = createTokenMovementAnimation({
      id: `${sharedPrefix}:first`,
      path: [{ x: 0, y: 0 }, { x: 70, y: 0 }],
      finalPosition: { x: 70, y: 0 },
      issuedAt: 100,
    })
    const second = createTokenMovementAnimation({
      id: `${sharedPrefix}:second`,
      path: [{ x: 0, y: 0 }, { x: 70, y: 0 }],
      finalPosition: { x: 70, y: 0 },
      issuedAt: 100,
    })

    expect(first?.id.length).toBe(200)
    expect(normalizeTokenMovementAnimation(first)).toEqual(first)
    expect(second?.id).not.toBe(first?.id)
  })

  it('rebases a recently received path when synchronization consumed its animation window', () => {
    const animation = createTokenMovementAnimation({
      id: 'late-move',
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      finalPosition: { x: 100, y: 0 },
      issuedAt: 1_000,
    })!
    const observedAt = animation.issuedAt + animation.durationMs + 250
    const displayed = tokenMovementAnimationForObservation(animation, observedAt)

    expect(displayed).not.toBe(animation)
    expect(displayed.issuedAt).toBe(observedAt)
    expect(tokenMovementAnimationPosition(displayed, 0)).toEqual({ x: 0, y: 0 })
  })

  it('does not replay historical movement metadata after a later refresh', () => {
    const animation = createTokenMovementAnimation({
      id: 'historical-move',
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      finalPosition: { x: 100, y: 0 },
      issuedAt: 1_000,
    })!
    const observedAt = animation.issuedAt + animation.durationMs + 5_001

    expect(tokenMovementAnimationForObservation(animation, observedAt)).toBe(animation)
  })

  it('preserves a shared timeline that still has a useful visible window', () => {
    const animation = createTokenMovementAnimation({
      id: 'live-move',
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      finalPosition: { x: 100, y: 0 },
      issuedAt: 1_000,
    })!
    const observedAt = animation.issuedAt + animation.durationMs - 200

    expect(tokenMovementAnimationForObservation(animation, observedAt)).toBe(animation)
  })
})
