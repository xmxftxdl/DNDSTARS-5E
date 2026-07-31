import type { D20RollMode } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'

export type Dnd5eMonsterForcedMovementDirection =
  | 'away-from-source'
  | 'toward-source'

export interface Dnd5eMonsterForcedMovementPayload {
  to: { x: number; y: number }
  distanceFeet: number
  toElevationFeet?: number
  fallingDamageRolls?: readonly number[]
}

export interface Dnd5eMonsterOpposedAbilityCheckResolution {
  source: {
    d20: number
    modifier: number
    total: number
    mode: D20RollMode
  }
  target: {
    d20: number
    modifier: number
    total: number
    mode: D20RollMode
  }
  /** Contests require the source to strictly beat the target; a tie resists. */
  sourceWins: boolean
}

/**
 * Shared opposed-check kernel for Host preview, authoritative Headless
 * validation and deterministic simulation. `resolveD20` also enforces the
 * exact number and range of supplied dice for advantage/disadvantage.
 */
export function resolveDnd5eMonsterOpposedAbilityCheck(input: {
  sourceRolls: readonly number[]
  sourceMode: D20RollMode
  sourceModifier: number
  targetRolls: readonly number[]
  targetMode: D20RollMode
  targetModifier: number
}): Dnd5eMonsterOpposedAbilityCheckResolution {
  const source = rules.resolveD20({
    rolls: input.sourceRolls,
    mode: input.sourceMode,
    modifier: input.sourceModifier,
  })
  const target = rules.resolveD20({
    rolls: input.targetRolls,
    mode: input.targetMode,
    modifier: input.targetModifier,
  })
  return {
    source,
    target,
    sourceWins: source.total > target.total,
  }
}

/**
 * Validates a Host-authored forced-movement destination without depending on
 * browser map geometry. The Host is responsible for wall and occupancy
 * truncation; Headless independently verifies distance and straight-line
 * direction so a forged payload cannot move a target somewhere unrelated.
 */
export function dnd5eMonsterForcedMovementPayloadIsValid(input: {
  source: { x: number; y: number }
  target: { x: number; y: number }
  movement: Dnd5eMonsterForcedMovementPayload
  direction: Dnd5eMonsterForcedMovementDirection
  maximumDistanceFeet: number
  resisted: boolean
  gridDistance?: {
    cellUnits: number
    feetPerCell: number
  }
  coordinateUnitsPerFoot?: number
}): boolean {
  const { movement } = input
  if (
    !Number.isFinite(movement.to.x) ||
    !Number.isFinite(movement.to.y) ||
    !Number.isFinite(movement.distanceFeet) ||
    movement.distanceFeet < 0 ||
    movement.distanceFeet > input.maximumDistanceFeet
  ) return false

  const deltaX = movement.to.x - input.target.x
  const deltaY = movement.to.y - input.target.y
  const samePosition = deltaX === 0 && deltaY === 0
  if (movement.distanceFeet === 0) {
    return samePosition &&
      movement.toElevationFeet == null &&
      (movement.fallingDamageRolls?.length ?? 0) === 0
  }
  if (input.resisted || samePosition) return false

  const sourceVectorX = input.source.x - input.target.x
  const sourceVectorY = input.source.y - input.target.y
  const expectedDirectionX = Math.sign(
    input.direction === 'toward-source' ? sourceVectorX : -sourceVectorX,
  )
  const expectedDirectionY = Math.sign(
    input.direction === 'toward-source' ? sourceVectorY : -sourceVectorY,
  )
  const movementDirectionX = Math.sign(deltaX)
  const movementDirectionY = Math.sign(deltaY)
  const directionMatches =
    (expectedDirectionX !== 0 || expectedDirectionY !== 0) &&
    movementDirectionX === expectedDirectionX &&
    movementDirectionY === expectedDirectionY &&
    (
      expectedDirectionX === 0 ||
      expectedDirectionY === 0 ||
      Math.abs(Math.abs(deltaX) - Math.abs(deltaY)) <= 1e-6
    )
  if (!directionMatches) return false

  const grid = input.gridDistance
  const usesGrid = !!grid &&
    Number.isFinite(grid.cellUnits) &&
    grid.cellUnits > 0 &&
    Number.isFinite(grid.feetPerCell) &&
    grid.feetPerCell > 0
  const actualDistanceFeet = usesGrid
    ? Math.max(Math.abs(deltaX), Math.abs(deltaY)) /
      grid.cellUnits * grid.feetPerCell
    : Math.max(Math.abs(deltaX), Math.abs(deltaY)) /
      (
        Number.isFinite(input.coordinateUnitsPerFoot) &&
        (input.coordinateUnitsPerFoot ?? 0) > 0
          ? input.coordinateUnitsPerFoot!
          : 1
      )
  return Math.abs(actualDistanceFeet - movement.distanceFeet) <= 1e-6
}

/**
 * Fling is intentionally direction-agnostic (the direction is random in the
 * stat block), but the submitted endpoint must still describe one exact,
 * finite straight displacement no farther than the reviewed maximum.
 */
export function dnd5eMonsterThrowMovementPayloadIsValid(input: {
  target: { x: number; y: number }
  movement: Dnd5eMonsterForcedMovementPayload
  maximumDistanceFeet: number
  gridDistance?: {
    cellUnits: number
    feetPerCell: number
  }
  coordinateUnitsPerFoot?: number
}): boolean {
  const { movement } = input
  if (
    !Number.isFinite(movement.to.x) ||
    !Number.isFinite(movement.to.y) ||
    !Number.isFinite(movement.distanceFeet) ||
    movement.distanceFeet < 0 ||
    movement.distanceFeet > input.maximumDistanceFeet
  ) return false
  const deltaX = movement.to.x - input.target.x
  const deltaY = movement.to.y - input.target.y
  const samePosition = deltaX === 0 && deltaY === 0
  if (movement.distanceFeet === 0) {
    return samePosition &&
      movement.toElevationFeet == null &&
      (movement.fallingDamageRolls?.length ?? 0) === 0
  }
  if (samePosition) return false

  const grid = input.gridDistance
  const usesGrid = !!grid &&
    Number.isFinite(grid.cellUnits) &&
    grid.cellUnits > 0 &&
    Number.isFinite(grid.feetPerCell) &&
    grid.feetPerCell > 0
  const actualDistanceFeet = usesGrid
    ? Math.max(Math.abs(deltaX), Math.abs(deltaY)) /
      grid!.cellUnits * grid!.feetPerCell
    : Math.max(Math.abs(deltaX), Math.abs(deltaY)) /
      (
        Number.isFinite(input.coordinateUnitsPerFoot) &&
        (input.coordinateUnitsPerFoot ?? 0) > 0
          ? input.coordinateUnitsPerFoot!
          : 1
      )
  return Math.abs(actualDistanceFeet - movement.distanceFeet) <= 1e-6
}
