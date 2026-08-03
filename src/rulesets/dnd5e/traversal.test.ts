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
    expect(dnd5eTraversalMovementCost({ distanceFeet: 15, baseMovementCostFeet: 30, mode: 'climb', profile }))
      .toEqual({ ok: true, movementCostFeet: 45 })
  })

  it('charges flight for absolute vertical change when callers pass descent as elevationGainFeet', () => {
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 0,
      elevationGainFeet: 20,
      mode: 'fly',
      profile: { ...profile, flySpeed: 60 },
    })).toEqual({ ok: true, movementCostFeet: 10 })
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 30,
      elevationGainFeet: 30,
      mode: 'fly',
      profile: { ...profile, flySpeed: 30 },
    })).toEqual({ ok: true, movementCostFeet: 60 })
  })

  it('rejects jumps beyond the automatic distance', () => {
    expect(dnd5eTraversalMovementCost({ distanceFeet: 17, mode: 'long-jump-running', profile }))
      .toEqual({ ok: false, reason: 'jump-too-far' })
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 19, mode: 'long-jump-running', profile: { ...profile, runningLongJumpBonusFeet: 3 },
    })).toEqual({ ok: true, movementCostFeet: 19 })
  })

  it('triples both long-jump and high-jump limits under Jump without discounting movement cost', () => {
    expect(dnd5eLongJumpMaximumFeet(16, true, 0, 3)).toBe(48)
    expect(dnd5eHighJumpMaximumFeet(3, true, 3)).toBe(18)
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 40,
      elevationGainFeet: 15,
      mode: 'long-jump-running',
      profile: { ...profile, jumpDistanceMultiplier: 3 },
    })).toEqual({ ok: true, movementCostFeet: 55 })
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 49,
      mode: 'long-jump-running',
      profile: { ...profile, jumpDistanceMultiplier: 3 },
    })).toEqual({ ok: false, reason: 'jump-too-far' })
  })

  it('deals 1d6 per 10 feet up to 20d6 and knocks the faller prone', () => {
    expect(dnd5eFallingDamageDice(9)).toBe(0)
    expect(dnd5eFallingDamageDice(250)).toBe(20)
    expect(resolveDnd5eFallingDamage(30, [2, 4, 6])).toEqual({ ok: true, dice: 3, damage: 12, landsProne: true })
  })
})
