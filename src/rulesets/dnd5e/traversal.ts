export type Dnd5eTraversalMode = 'walk' | 'climb' | 'swim' | 'long-jump-running' | 'long-jump-standing' | 'fall'

export interface Dnd5eTraversalProfile {
  strengthScore: number
  strengthModifier: number
  walkSpeed: number
  climbSpeed?: number
  swimSpeed?: number
}

export function dnd5eLongJumpMaximumFeet(strengthScore: number, runningStart: boolean): number {
  const maximum = Math.max(0, Math.floor(strengthScore))
  return runningStart ? maximum : Math.floor(maximum / 2)
}

export function dnd5eHighJumpMaximumFeet(strengthModifier: number, runningStart: boolean): number {
  const maximum = Math.max(0, 3 + Math.floor(strengthModifier))
  return runningStart ? maximum : Math.floor(maximum / 2)
}

export function dnd5eTraversalMovementCost(input: {
  distanceFeet: number
  elevationGainFeet?: number
  mode: Dnd5eTraversalMode
  profile: Dnd5eTraversalProfile
}): { ok: true; movementCostFeet: number } | { ok: false; reason: 'jump-too-far' | 'jump-too-high' } {
  const distanceFeet = Math.max(0, input.distanceFeet)
  const elevationGainFeet = Math.max(0, input.elevationGainFeet ?? 0)
  // Falling itself does not consume vertical movement. Any horizontal step or
  // run used to leave the ledge remains part of the declared map path.
  if (input.mode === 'fall') return { ok: true, movementCostFeet: distanceFeet }
  if (input.mode === 'long-jump-running' || input.mode === 'long-jump-standing') {
    const running = input.mode === 'long-jump-running'
    if (distanceFeet > dnd5eLongJumpMaximumFeet(input.profile.strengthScore, running)) {
      return { ok: false, reason: 'jump-too-far' }
    }
    if (elevationGainFeet > dnd5eHighJumpMaximumFeet(input.profile.strengthModifier, running)) {
      return { ok: false, reason: 'jump-too-high' }
    }
    return { ok: true, movementCostFeet: distanceFeet + elevationGainFeet }
  }
  if (input.mode === 'climb') {
    const cost = input.profile.climbSpeed && input.profile.climbSpeed > 0
      ? distanceFeet * Math.max(1, input.profile.walkSpeed / input.profile.climbSpeed)
      : distanceFeet * 2
    return { ok: true, movementCostFeet: cost + elevationGainFeet }
  }
  if (input.mode === 'swim') {
    const cost = input.profile.swimSpeed && input.profile.swimSpeed > 0
      ? distanceFeet * Math.max(1, input.profile.walkSpeed / input.profile.swimSpeed)
      : distanceFeet * 2
    return { ok: true, movementCostFeet: cost + elevationGainFeet }
  }
  return { ok: true, movementCostFeet: distanceFeet + elevationGainFeet }
}

export function dnd5eFallingDamageDice(fallDistanceFeet: number): number {
  return Math.min(20, Math.max(0, Math.floor(fallDistanceFeet / 10)))
}

export function resolveDnd5eFallingDamage(
  fallDistanceFeet: number,
  rolls: readonly number[],
): { ok: true; dice: number; damage: number; landsProne: boolean } | { ok: false; reason: 'invalid-dice' } {
  const dice = dnd5eFallingDamageDice(fallDistanceFeet)
  if (rolls.length !== dice || rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > 6)) {
    return { ok: false, reason: 'invalid-dice' }
  }
  return {
    ok: true,
    dice,
    damage: rolls.reduce((sum, roll) => sum + roll, 0),
    landsProne: dice > 0,
  }
}
