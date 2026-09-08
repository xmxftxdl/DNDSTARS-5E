import { describe, expect, it } from 'vitest'
import {
  dnd5eFallingDamageDice,
  dnd5eHighJumpMaximumFeet,
  dnd5eLongJumpMaximumFeet,
  dnd5eRunningJumpSegments,
  dnd5eTraversalMovementCost,
  dnd5eTraversalTargetingDistanceFeet,
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
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 30,
      mode: 'swim',
      profile: { ...profile, ignoreUnderwaterMovementPenalty: true },
    })).toBe(30)
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

  it('charges Etherealness vertical movement at two feet per vertical foot', () => {
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 10,
      elevationGainFeet: 10,
      mode: 'fly',
      profile: { ...profile, flySpeed: 30, verticalFlightCostMultiplier: 2 },
    })).toEqual({ ok: true, movementCostFeet: 30 })
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 0,
      elevationGainFeet: 15,
      mode: 'fly',
      profile: { ...profile, flySpeed: 30, verticalFlightCostMultiplier: 2 },
    })).toEqual({ ok: true, movementCostFeet: 30 })
  })

  it('projects the targeting circle through the selected movement speed', () => {
    const windWalk = { ...profile, flySpeed: 300 }
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 60,
      mode: 'fly',
      profile: windWalk,
    })).toBe(600)
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 60,
      mode: 'fly',
      profile: windWalk,
      additionalDistanceCostMultiplier: 1,
    })).toBe(54)
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 60,
      mode: 'fly',
      profile,
    })).toBe(0)
  })

  it('keeps walk and flight on their own limits inside a fastest-speed turn pool', () => {
    const flyingForm = {
      strengthScore: 16,
      strengthModifier: 3,
      movementPoolSpeed: 60,
      walkSpeed: 10,
      flySpeed: 60,
    }
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 60,
      mode: 'walk',
      profile: flyingForm,
    })).toBe(10)
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 60,
      mode: 'fly',
      profile: flyingForm,
    })).toBe(60)
    expect(dnd5eTraversalMovementCost({
      distanceFeet: 10,
      mode: 'walk',
      profile: flyingForm,
    })).toEqual({ ok: true, movementCostFeet: 10 })
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 50,
      movementSpentFeet: 10,
      mode: 'fly',
      profile: flyingForm,
    })).toBe(50)
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 50,
      movementSpentFeet: 10,
      mode: 'walk',
      profile: flyingForm,
    })).toBe(0)
  })

  it('reserves planned vertical flight before drawing the horizontal targeting radius', () => {
    const flyingForm = {
      strengthScore: 16,
      strengthModifier: 3,
      movementPoolSpeed: 80,
      walkSpeed: 10,
      flySpeed: 80,
    }
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 70,
      totalMovementRemainingFeet: 80,
      movementSpentFeet: 0,
      mode: 'fly',
      profile: flyingForm,
    })).toBe(70)
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

  it('splits a one-click running jump into its run-up and airborne distance', () => {
    expect(dnd5eRunningJumpSegments({ distanceFeet: 30 })).toEqual({
      approachFeetAlready: 0,
      approachFeetIncluded: 10,
      jumpDistanceFeet: 20,
      hasRunningStart: true,
    })
    expect(dnd5eRunningJumpSegments({
      distanceFeet: 25,
      approachFeetAlready: 5,
      minimumApproachFeet: 10,
    })).toEqual({
      approachFeetAlready: 5,
      approachFeetIncluded: 5,
      jumpDistanceFeet: 20,
      hasRunningStart: true,
    })
    expect(dnd5eRunningJumpSegments({ distanceFeet: 10 }).hasRunningStart).toBe(false)
  })

  it('includes the required run-up in the running-jump targeting radius', () => {
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 30,
      mode: 'long-jump-running',
      profile: {
        strengthScore: 10,
        strengthModifier: 0,
        walkSpeed: 30,
        jumpDistanceMultiplier: 3,
      },
    })).toBe(30)
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: 30,
      mode: 'long-jump-running',
      profile: { strengthScore: 10, strengthModifier: 0, walkSpeed: 30 },
    })).toBe(20)
  })

  it('deals 1d6 per 10 feet up to 20d6 and knocks the faller prone', () => {
    expect(dnd5eFallingDamageDice(9)).toBe(0)
    expect(dnd5eFallingDamageDice(250)).toBe(20)
    expect(resolveDnd5eFallingDamage(30, [2, 4, 6])).toEqual({ ok: true, dice: 3, damage: 12, landsProne: true })
  })
})
