import { describe, expect, it } from 'vitest'
import {
  dnd5eFallingDamageDice,
  dnd5eHighJumpMaximumFeet,
  dnd5eLongJumpMaximumFeet,
  dnd5eTraversalMovementCost,
  resolveDnd5eFallingDamage,
} from './traversal'

const profile = { strengthScore: 16, strengthModifier: 3, walkSpeed: 30 }

describe('D&D 5e 2014 traversal', () => {
  it('uses Strength for running jumps and halves standing jumps', () => {
    expect(dnd5eLongJumpMaximumFeet(16, true)).toBe(16)
    expect(dnd5eLongJumpMaximumFeet(16, false)).toBe(8)
    expect(dnd5eHighJumpMaximumFeet(3, true)).toBe(6)
    expect(dnd5eHighJumpMaximumFeet(3, false)).toBe(3)
  })

  it('charges one extra foot for climbing and swimming without a matching speed', () => {
    expect(dnd5eTraversalMovementCost({ distanceFeet: 15, mode: 'climb', profile }))
      .toEqual({ ok: true, movementCostFeet: 30 })
    expect(dnd5eTraversalMovementCost({ distanceFeet: 15, mode: 'swim', profile: { ...profile, swimSpeed: 30 } }))
      .toEqual({ ok: true, movementCostFeet: 15 })
    expect(dnd5eTraversalMovementCost({ distanceFeet: 30, mode: 'climb', profile: { ...profile, climbSpeed: 60 } }))
      .toEqual({ ok: true, movementCostFeet: 15 })
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 15, mode: 'climb', profile: { ...profile, climbWithoutSpeedCostMultiplier: 1 },
    })).toEqual({ ok: true, movementCostFeet: 15 })
  })

  it('rejects jumps beyond the automatic distance', () => {
    expect(dnd5eTraversalMovementCost({ distanceFeet: 17, mode: 'long-jump-running', profile }))
      .toEqual({ ok: false, reason: 'jump-too-far' })
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 19, mode: 'long-jump-running', profile: { ...profile, runningLongJumpBonusFeet: 3 },
    })).toEqual({ ok: true, movementCostFeet: 19 })
  })

  it('deals 1d6 per 10 feet up to 20d6 and knocks the faller prone', () => {
    expect(dnd5eFallingDamageDice(9)).toBe(0)
    expect(dnd5eFallingDamageDice(250)).toBe(20)
    expect(resolveDnd5eFallingDamage(30, [2, 4, 6])).toEqual({ ok: true, dice: 3, damage: 12, landsProne: true })
  })
})
