import { describe, expect, it } from 'vitest'
import { diceThrowMotion } from './diceThrowMotion'

describe('dice release motion', () => {
  it('carries the direction and speed of a recent flick into the throw', () => {
    const motion = diceThrowMotion([{ x: 0, y: 0, time: 0 }, { x: 40, y: -20, time: 50 }], 55, 60)
    expect(motion.velocity.x).toBe(800)
    expect(motion.velocity.y).toBe(-400)
    expect(motion.angularVelocity.x).toBeGreaterThan(0)
    expect(motion.angularVelocity.y).toBeGreaterThan(0)
  })
  it('drops without a new launch impulse after the hand stops', () => {
    expect(diceThrowMotion([{ x: 0, y: 0, time: 0 }, { x: 50, y: 10, time: 50 }], 180, 60))
      .toEqual({ velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: -0, y: 0, z: 0 } })
  })
  it('bounds fast flicks and ignores zero-duration samples', () => {
    const fast = diceThrowMotion([{ x: 0, y: 0, time: 0 }, { x: 10000, y: 10000, time: 1 }], 1, 40)
    expect(Math.hypot(fast.velocity.x, fast.velocity.y)).toBeCloseTo(1600)
    expect(Math.abs(fast.angularVelocity.x)).toBeLessThanOrEqual(16)
    expect(diceThrowMotion([{ x: 10, y: 10, time: 5 }], 5, 40).velocity.z).toBe(0)
  })
})
