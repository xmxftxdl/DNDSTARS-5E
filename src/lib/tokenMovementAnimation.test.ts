import { truncateTokenMovementTrace } from './tokenMovementAnimation'
import { describe, expect, it } from 'vitest'
import {
  createTokenMovementAnimation,
  continueTokenMovementPath,
  normalizeTokenMovementAnimation,
  tokenMovementAnimationForObservation,
  tokenMovementAnimationPosition,
  tokenMovementAnimationOwnsPosition,
  truncateTokenMovementPath,
} from './tokenMovementAnimation'

describe('token movement path animation', () => {
  it('preserves an endpoint ejection back to an earlier checkpoint on a completed route', () => {
    const path = [{ x: 25, y: 75 }, { x: 75, y: 75 }, { x: 125, y: 75 }, { x: 75, y: 75 }]
    const suffix = continueTokenMovementPath(path, path[1], path[3], { completed: true })
    expect(suffix).toEqual([path[1], path[2], path[3]])
    const animation = createTokenMovementAnimation({ id: 'eject-back', path: suffix, finalPosition: path[3], issuedAt: 1 })!
    expect(animation.points).toEqual(suffix)
    expect(tokenMovementAnimationPosition(animation, animation.durationMs / 2)).toEqual(path[2])
  })
  it('releases position ownership after completion or a newer destination', () => {
    const animation = { id: 'first', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], issuedAt: 1000, durationMs: 500 }
    expect(tokenMovementAnimationOwnsPosition(animation, { x: 50, y: 0 }, 900)).toBe(true)
    expect(tokenMovementAnimationOwnsPosition(animation, { x: 50, y: 0 }, 1200)).toBe(true)
    expect(tokenMovementAnimationOwnsPosition(animation, { x: 50, y: 0 }, 1500)).toBe(false)
    expect(tokenMovementAnimationOwnsPosition(animation, { x: 100, y: 0 }, 1200)).toBe(false)
    expect(tokenMovementAnimationOwnsPosition(undefined, { x: 50, y: 0 }, 1200)).toBe(false)
  })
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


it('preserves descent and return heights at identical map coordinates', () => {
  const point={x:25,y:25}
  const trace={path:[point,point,point],pathElevationsFeet:[0,-5,0]}
  expect(truncateTokenMovementTrace({...trace,finalPosition:point,finalElevationFeet:0})).toEqual(trace)
  expect(truncateTokenMovementTrace({...trace,finalPosition:point,finalElevationFeet:-5})).toEqual({path:[point,point],pathElevationsFeet:[0,-5]})
  expect(truncateTokenMovementTrace({...trace,finalPosition:point,finalElevationFeet:0,stopPathIndex:0})).toEqual({path:[point],pathElevationsFeet:[0]})
})

it('keeps a stopping checkpoint aligned with its height when the route revisits a cell', () => {
  const start={x:25,y:25},other={x:75,y:25}
  const trace={path:[start,other,start,other],pathElevationsFeet:[0,-5,-10,-15]}
  expect(truncateTokenMovementTrace({...trace,finalPosition:other,finalElevationFeet:-5,stopPathIndex:1})).toEqual({path:[start,other],pathElevationsFeet:[0,-5]})
  expect(trace.pathElevationsFeet).toEqual([0,-5,-10,-15])
})
