import {readActivityMovementCell} from './activityMovementChoice'
import type {GridCell} from './gridCombat'

export interface ActivityAreaAim {
  anchorCell: GridCell
  rectAngleDegrees?: number
}

export function readActivityAreaAim(value: unknown): ActivityAreaAim | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const anchorCell = readActivityMovementCell(input.anchorCell)
  if (!anchorCell || (input.rectAngleDegrees !== undefined &&
    (typeof input.rectAngleDegrees !== 'number' || !Number.isFinite(input.rectAngleDegrees) ||
      Math.abs(input.rectAngleDegrees) > 360))) return undefined
  return {anchorCell,...(input.rectAngleDegrees === undefined ? {} : {rectAngleDegrees:input.rectAngleDegrees as number})}
}

/** The recipient resolves this reference from its room-approved content registry. */
export interface ActivityAreaChoice {
  packageId: string
  activityId: string
  actorTokenId: string
}

export function readActivityAreaChoice(value: unknown): ActivityAreaChoice | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const valid = (key: string) => typeof input[key] === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(input[key] as string)
  if (!valid('packageId') || !valid('activityId') || !valid('actorTokenId')) return undefined
  return {packageId:input.packageId as string,activityId:input.activityId as string,actorTokenId:input.actorTokenId as string}
}
