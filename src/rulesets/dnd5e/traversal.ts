export type Dnd5eTraversalMode = 'walk' | 'climb' | 'swim' | 'fly' | 'long-jump-running' | 'long-jump-standing' | 'fall'

export interface Dnd5eTraversalProfile {
  strengthScore: number
  strengthModifier: number
  /**
   * Shared turn movement is stored against the creature's fastest available
   * speed. When this differs from walkSpeed, traversal costs are converted
   * into that common pool so each movement mode still keeps its own limit.
   */
  movementPoolSpeed?: number
  walkSpeed: number
  climbSpeed?: number
  swimSpeed?: number
  flySpeed?: number
  climbWithoutSpeedCostMultiplier?: number
  runningLongJumpBonusFeet?: number
  jumpDistanceMultiplier?: number
  /** Consecutive walking distance already committed immediately before this jump. */
  runningJumpApproachFeet?: number
  /** Defaults to 10 feet; features such as Athlete may reduce it. */
  runningJumpMinimumApproachFeet?: number
  ignoreUnderwaterMovementPenalty?: boolean
  /** Multiplier for each foot of vertical flight; Etherealness uses 2. */
  verticalFlightCostMultiplier?: number
}

export interface Dnd5eRunningJumpSegments {
  approachFeetAlready: number
  approachFeetIncluded: number
  jumpDistanceFeet: number
  hasRunningStart: boolean
}

/**
 * Splits a one-click running-jump path into its on-foot approach and airborne
 * distance. Previously the UI required two separate movement transactions,
 * making an otherwise legal running jump fail closed when selected directly.
 */
export function dnd5eRunningJumpSegments(input: {
  distanceFeet: number
  approachFeetAlready?: number
  minimumApproachFeet?: number
}): Dnd5eRunningJumpSegments {
  const distanceFeet = Math.max(0, input.distanceFeet)
  const minimumApproachFeet = Math.max(0, input.minimumApproachFeet ?? 10)
  const approachFeetAlready = Math.min(
    minimumApproachFeet,
    Math.max(0, input.approachFeetAlready ?? 0),
  )
  const approachFeetIncluded = Math.min(
    distanceFeet,
    Math.max(0, minimumApproachFeet - approachFeetAlready),
  )
  const jumpDistanceFeet = Math.max(0, distanceFeet - approachFeetIncluded)
  return {
    approachFeetAlready,
    approachFeetIncluded,
    jumpDistanceFeet,
    hasRunningStart: approachFeetAlready + approachFeetIncluded >= minimumApproachFeet - 1e-6 &&
      jumpDistanceFeet > 1e-6,
  }
}

export function dnd5eLongJumpMaximumFeet(
  strengthScore: number,
  runningStart: boolean,
  runningBonusFeet = 0,
  jumpDistanceMultiplier = 1,
): number {
  const maximum = Math.max(0, Math.floor(strengthScore))
  const base = runningStart ? maximum + Math.max(0, Math.floor(runningBonusFeet)) : Math.floor(maximum / 2)
  return Math.floor(base * Math.max(1, jumpDistanceMultiplier))
}

export function dnd5eHighJumpMaximumFeet(
  strengthModifier: number,
  runningStart: boolean,
  jumpDistanceMultiplier = 1,
): number {
  const maximum = Math.max(0, 3 + Math.floor(strengthModifier))
  const base = runningStart ? maximum : Math.floor(maximum / 2)
  return Math.floor(base * Math.max(1, jumpDistanceMultiplier))
}

export function dnd5eTraversalMovementCost(input: {
  distanceFeet: number
  /** Terrain-adjusted horizontal cost; jump distance still uses distanceFeet. */
  baseMovementCostFeet?: number
  elevationGainFeet?: number
  mode: Dnd5eTraversalMode
  profile: Dnd5eTraversalProfile
}): { ok: true; movementCostFeet: number } | { ok: false; reason: 'jump-too-far' | 'jump-too-high' | 'cannot-fly' } {
  const distanceFeet = Math.max(0, input.distanceFeet)
  const baseMovementCostFeet = Math.max(distanceFeet, input.baseMovementCostFeet ?? distanceFeet)
  const elevationGainFeet = Math.max(0, input.elevationGainFeet ?? 0)
  const movementPoolSpeed = Math.max(
    0,
    input.profile.movementPoolSpeed ?? input.profile.walkSpeed,
  )
  const costInMovementPool = (costFeet: number, modeSpeed: number): number =>
    modeSpeed > 0
      ? input.profile.movementPoolSpeed == null
        // Legacy callers store the turn pool against walking speed.
        ? costFeet * (movementPoolSpeed / modeSpeed)
        // Modern map combat stores the fastest speed as the shared pool. Each
        // foot still spends one foot; the selected mode's own cap is enforced
        // separately against movement already spent this turn.
        : costFeet
      : Number.POSITIVE_INFINITY
  // Falling itself does not consume vertical movement. Any horizontal step or
  // run used to leave the ledge remains part of the declared map path.
  if (input.mode === 'fall') return {
    ok: true,
    movementCostFeet: costInMovementPool(baseMovementCostFeet, input.profile.walkSpeed),
  }
  if (input.mode === 'long-jump-running' || input.mode === 'long-jump-standing') {
    const running = input.mode === 'long-jump-running'
    if (distanceFeet > dnd5eLongJumpMaximumFeet(
      input.profile.strengthScore,
      running,
      running ? input.profile.runningLongJumpBonusFeet : 0,
      input.profile.jumpDistanceMultiplier,
    )) {
      return { ok: false, reason: 'jump-too-far' }
    }
    if (elevationGainFeet > dnd5eHighJumpMaximumFeet(
      input.profile.strengthModifier,
      running,
      input.profile.jumpDistanceMultiplier,
    )) {
      return { ok: false, reason: 'jump-too-high' }
    }
    return {
      ok: true,
      movementCostFeet: costInMovementPool(
        baseMovementCostFeet + elevationGainFeet,
        input.profile.walkSpeed,
      ),
    }
  }
  if (input.mode === 'climb') {
    const cost = input.profile.climbSpeed && input.profile.climbSpeed > 0
      ? costInMovementPool(baseMovementCostFeet, input.profile.climbSpeed)
      : costInMovementPool(
          baseMovementCostFeet + distanceFeet *
            (Math.max(1, input.profile.climbWithoutSpeedCostMultiplier ?? 2) - 1),
          input.profile.walkSpeed,
        )
    return {
      ok: true,
      movementCostFeet: cost + costInMovementPool(
        elevationGainFeet,
        input.profile.climbSpeed ?? input.profile.walkSpeed,
      ),
    }
  }
  if (input.mode === 'swim') {
    const cost = input.profile.ignoreUnderwaterMovementPenalty
      ? costInMovementPool(baseMovementCostFeet, input.profile.walkSpeed)
      : input.profile.swimSpeed && input.profile.swimSpeed > 0
      ? costInMovementPool(baseMovementCostFeet, input.profile.swimSpeed)
      : costInMovementPool(baseMovementCostFeet + distanceFeet, input.profile.walkSpeed)
    return {
      ok: true,
      movementCostFeet: cost + costInMovementPool(
        elevationGainFeet,
        input.profile.swimSpeed ?? input.profile.walkSpeed,
      ),
    }
  }
  if (input.mode === 'fly') {
    if (!input.profile.flySpeed || input.profile.flySpeed <= 0) return { ok: false, reason: 'cannot-fly' }
    return {
      ok: true, movementCostFeet: costInMovementPool(
        baseMovementCostFeet + elevationGainFeet *
          Math.max(1, input.profile.verticalFlightCostMultiplier ?? 1),
        input.profile.flySpeed,
      ),
    }
  }
  return {
    ok: true,
    movementCostFeet: costInMovementPool(
      baseMovementCostFeet + elevationGainFeet,
      input.profile.walkSpeed,
    ),
  }
}

/**
 * Converts the normalized turn movement budget back into physical map feet for
 * the currently selected traversal mode. The map targeting circle is only an
 * optimistic upper bound; terrain and elevation are still validated against
 * the concrete path before a move is submitted.
 */
export function dnd5eTraversalTargetingDistanceFeet(input: {
  movementBudgetFeet: number
  /** Full remaining pool before fixed costs such as standing are deducted. */
  totalMovementRemainingFeet?: number
  movementSpentFeet?: number
  mode: Dnd5eTraversalMode
  profile: Dnd5eTraversalProfile
  additionalDistanceCostMultiplier?: number
}): number {
  const movementBudgetFeet = Math.max(0, input.movementBudgetFeet)
  const oneFoot = dnd5eTraversalMovementCost({
    distanceFeet: 1,
    mode: input.mode,
    profile: input.profile,
  })
  if (!oneFoot.ok) return 0
  const perPhysicalFoot = oneFoot.movementCostFeet + Math.max(0, input.additionalDistanceCostMultiplier ?? 0)
  if (!Number.isFinite(perPhysicalFoot) || perPhysicalFoot <= 0) return 0
  const totalMovementRemainingFeet = Math.max(
    movementBudgetFeet,
    input.totalMovementRemainingFeet ?? movementBudgetFeet,
  )
  const fixedMovementCostFeet = Math.max(0, totalMovementRemainingFeet - movementBudgetFeet)
  const modeMovementRemainingFeet = dnd5eTraversalModeRemainingMovementFeet({
    movementRemainingFeet: totalMovementRemainingFeet,
    movementSpentFeet: input.movementSpentFeet ?? 0,
    mode: input.mode,
    profile: input.profile,
  })
  const usableMovementBudgetFeet = Math.min(
    movementBudgetFeet,
    Math.max(0, modeMovementRemainingFeet - fixedMovementCostFeet),
  )
  const budgetDistance = Math.floor(usableMovementBudgetFeet / perPhysicalFoot)
  if (input.mode !== 'long-jump-running' && input.mode !== 'long-jump-standing') return budgetDistance
  const runningApproachDeficit = input.mode === 'long-jump-running'
    ? Math.max(
        0,
        (input.profile.runningJumpMinimumApproachFeet ?? 10) -
          (input.profile.runningJumpApproachFeet ?? 0),
      )
    : 0
  return Math.min(
    budgetDistance,
    runningApproachDeficit + dnd5eLongJumpMaximumFeet(
      input.profile.strengthScore,
      input.mode === 'long-jump-running',
      input.mode === 'long-jump-running' ? input.profile.runningLongJumpBonusFeet : 0,
      input.profile.jumpDistanceMultiplier,
    ),
  )
}

/**
 * Remaining shared-pool movement available to one selected movement mode.
 *
 * 5e subtracts distance already moved from the newly selected speed. Thus a
 * creature with walk 10 / fly 60 can walk 10 feet and then fly 50 feet; the
 * first 10 feet must not be scaled into the entire 60-foot pool.
 */
export function dnd5eTraversalModeRemainingMovementFeet(input: {
  movementRemainingFeet: number
  movementSpentFeet: number
  mode: Dnd5eTraversalMode
  profile: Dnd5eTraversalProfile
}): number {
  const movementRemainingFeet = Math.max(0, input.movementRemainingFeet)
  const movementSpentFeet = Math.max(0, input.movementSpentFeet)
  const movementPoolSpeed = Math.max(
    0,
    input.profile.movementPoolSpeed ?? input.profile.walkSpeed,
  )
  const modeSpeed = input.mode === 'fly'
    ? Math.max(0, input.profile.flySpeed ?? 0)
    : input.mode === 'climb'
      ? Math.max(0, input.profile.climbSpeed ?? input.profile.walkSpeed)
      : input.mode === 'swim'
        ? Math.max(
            0,
            input.profile.ignoreUnderwaterMovementPenalty
              ? input.profile.walkSpeed
              : input.profile.swimSpeed ?? input.profile.walkSpeed,
          )
        : Math.max(0, input.profile.walkSpeed)
  if (modeSpeed <= 0) return 0
  const extraMovementFeet = Math.max(
    0,
    movementRemainingFeet + movementSpentFeet - movementPoolSpeed,
  )
  return Math.min(
    movementRemainingFeet,
    Math.max(0, modeSpeed + extraMovementFeet - movementSpentFeet),
  )
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
