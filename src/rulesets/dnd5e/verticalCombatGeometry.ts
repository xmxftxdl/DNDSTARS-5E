import { tokenFootprintDistanceCells } from '../../lib/gridCombat'
import {
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'

const GROUND_AREA_SPELLS = new Set([
  'grease',
  'entangle',
  'black-tentacles',
  'spike-growth',
])

const COLUMN_HEIGHT_BY_SPELL: Readonly<Record<string, number>> = {
  'faerie-fire': 20,
  'hypnotic-pattern': 30,
  slow: 40,
  'flaming-sphere': 10,
  moonbeam: 40,
  'wall-of-fire': 20,
  'flame-strike': 40,
  'ice-storm': 40,
  thunderwave: 15,
}

/** D&D space height used by the grid rules, rather than portrait pixel size. */
export function dnd5eCreatureHeightFeetForSizeRank(sizeRank: number): number {
  const normalized = Math.max(0, Math.min(5, Math.floor(sizeRank)))
  if (normalized <= 2) return 5
  return (normalized - 1) * 5
}

export function dnd5eTokenHeightFeet(token: Pick<Token, 'creatureSize' | 'size'>): number {
  const rank = token.creatureSize === '巨型'
    ? 5
    : token.creatureSize === '超大型'
      ? 4
      : token.creatureSize === '大型'
        ? 3
        : token.creatureSize === '小型' || token.creatureSize === '微型'
          ? 1
          : Math.max(2, Math.min(5, Math.round(token.size) + 1))
  return dnd5eCreatureHeightFeetForSizeRank(rank)
}

export function dnd5eVerticalIntervalDistanceFeet(
  leftBottomFeet: number,
  leftHeightFeet: number,
  rightBottomFeet: number,
  rightHeightFeet: number,
): number {
  const leftTopFeet = leftBottomFeet + Math.max(0, leftHeightFeet)
  const rightTopFeet = rightBottomFeet + Math.max(0, rightHeightFeet)
  if (leftTopFeet < rightBottomFeet) return rightBottomFeet - leftTopFeet
  if (rightTopFeet < leftBottomFeet) return leftBottomFeet - rightTopFeet
  return 0
}

export function dnd5eCombatantVerticalDistanceFeet(
  left: { elevationFeet?: number; sizeRank: number },
  right: { elevationFeet?: number; sizeRank: number },
): number {
  return dnd5eVerticalIntervalDistanceFeet(
    left.elevationFeet ?? 0,
    dnd5eCreatureHeightFeetForSizeRank(left.sizeRank),
    right.elevationFeet ?? 0,
    dnd5eCreatureHeightFeetForSizeRank(right.sizeRank),
  )
}

export function dnd5eMapTokenDistanceFeet(input: {
  map: BattleMap
  geometry?: MapGeometryState
  left: Token
  right: Token
  leftSizeRank?: number
  rightSizeRank?: number
}): number {
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const leftBottom = mapGeometryTokenElevation(input.geometry, input.left)
  const rightBottom = mapGeometryTokenElevation(input.geometry, input.right)
  const vertical = dnd5eVerticalIntervalDistanceFeet(
    leftBottom,
    input.leftSizeRank == null
      ? dnd5eTokenHeightFeet(input.left)
      : dnd5eCreatureHeightFeetForSizeRank(input.leftSizeRank),
    rightBottom,
    input.rightSizeRank == null
      ? dnd5eTokenHeightFeet(input.right)
      : dnd5eCreatureHeightFeetForSizeRank(input.rightSizeRank),
  )
  return Math.max(
    tokenFootprintDistanceCells(input.left, input.right, input.map) * feetPerCell,
    vertical,
  )
}

export function dnd5eTokenToPointDistanceFeet(input: {
  geometry?: MapGeometryState
  token: Token
  pointElevationFeet: number
  horizontalDistanceFeet: number
  sizeRank?: number
}): number {
  const bottom = mapGeometryTokenElevation(input.geometry, input.token)
  const top = bottom + (input.sizeRank == null
    ? dnd5eTokenHeightFeet(input.token)
    : dnd5eCreatureHeightFeetForSizeRank(input.sizeRank))
  const vertical = input.pointElevationFeet < bottom
    ? bottom - input.pointElevationFeet
    : input.pointElevationFeet > top
      ? input.pointElevationFeet - top
      : 0
  return Math.max(Math.max(0, input.horizontalDistanceFeet), vertical)
}

function intervalOverlaps(
  tokenBottom: number,
  tokenHeight: number,
  volumeBottom: number,
  volumeTop: number,
): boolean {
  const tokenTop = tokenBottom + tokenHeight
  return tokenTop >= volumeBottom - 1e-4 && tokenBottom <= volumeTop + 1e-4
}

interface MutableVerticalInterval {
  bottom: number
  top: number
}

function constrainLinearValueBetween(
  interval: MutableVerticalInterval,
  coefficient: number,
  offset: number,
  minimum: number,
  maximum: number,
): boolean {
  if (Math.abs(coefficient) <= 1e-8) {
    return offset >= minimum - 1e-4 && offset <= maximum + 1e-4
  }
  const first = (minimum - offset) / coefficient
  const second = (maximum - offset) / coefficient
  interval.bottom = Math.max(interval.bottom, Math.min(first, second))
  interval.top = Math.min(interval.top, Math.max(first, second))
  return interval.bottom <= interval.top + 1e-4
}

function constrainLinearValueAtMost(
  interval: MutableVerticalInterval,
  coefficient: number,
  offset: number,
  maximum: number,
): boolean {
  if (Math.abs(coefficient) <= 1e-8) return offset <= maximum + 1e-4
  const boundary = (maximum - offset) / coefficient
  if (coefficient > 0) interval.top = Math.min(interval.top, boundary)
  else interval.bottom = Math.max(interval.bottom, boundary)
  return interval.bottom <= interval.top + 1e-4
}

/**
 * Intersects a creature's vertical occupied segment with a pitched line/cone.
 * The existing square-grid template remains the authoritative XY broad phase;
 * this is its narrow phase in the vertical plane through the template axis.
 */
function pitchedSelfAreaIntersectsToken(input: {
  area: Extract<SkillAoeTargeting, { shape: 'line' | 'cone' }>
  map: BattleMap
  targetToken: Token
  targetBottom: number
  targetHeight: number
  effectOrigin: { x: number; y: number }
  effectOriginElevationFeet: number
  effectAim: { x: number; y: number }
  effectAimElevationFeet: number
}): boolean | undefined {
  const pixelsPerCell = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const pixelsToFeet = feetPerCell / pixelsPerCell
  const aimXFeet = (input.effectAim.x - input.effectOrigin.x) * pixelsToFeet
  const aimYFeet = (input.effectAim.y - input.effectOrigin.y) * pixelsToFeet
  const aimVerticalFeet = input.effectAimElevationFeet - input.effectOriginElevationFeet
  const horizontalAimFeet = Math.hypot(aimXFeet, aimYFeet)
  const axisMagnitude = Math.hypot(horizontalAimFeet, aimVerticalFeet)
  if (axisMagnitude <= 1e-8) return undefined

  const horizontalCosine = horizontalAimFeet / axisMagnitude
  const verticalSine = aimVerticalFeet / axisMagnitude
  const targetXFeet = (input.targetToken.x - input.effectOrigin.x) * pixelsToFeet
  const targetYFeet = (input.targetToken.y - input.effectOrigin.y) * pixelsToFeet
  // A purely vertical aim has no top-down direction. The broad phase currently
  // uses the grid template's deterministic fallback direction, while this
  // narrow phase correctly measures radial distance from the vertical axis.
  const horizontalForwardFeet = horizontalAimFeet > 1e-8
    ? (targetXFeet * aimXFeet + targetYFeet * aimYFeet) / horizontalAimFeet
    : Math.hypot(targetXFeet, targetYFeet)

  const vertical = {
    bottom: input.targetBottom,
    top: input.targetBottom + input.targetHeight,
  }
  // Axis coordinate t and signed perpendicular coordinate p are both linear
  // in the sampled point's Z value. A hit exists when any point of the
  // creature's occupied height satisfies the finite volume constraints.
  const tCoefficient = verticalSine
  const tOffset = horizontalCosine * horizontalForwardFeet -
    verticalSine * input.effectOriginElevationFeet
  if (!constrainLinearValueBetween(
    vertical,
    tCoefficient,
    tOffset,
    0,
    input.area.lengthFeet,
  )) return false

  const pCoefficient = horizontalCosine
  const pOffset = -verticalSine * horizontalForwardFeet -
    horizontalCosine * input.effectOriginElevationFeet
  if (input.area.shape === 'line') {
    return constrainLinearValueBetween(
      vertical,
      pCoefficient,
      pOffset,
      -input.area.widthFeet / 2,
      input.area.widthFeet / 2,
    )
  }

  // 2014 cone width at axial distance t equals t. Its vertical half-width is
  // therefore t / 2, matching the existing top-down triangular template.
  if (!constrainLinearValueAtMost(
    vertical,
    pCoefficient - tCoefficient / 2,
    pOffset - tOffset / 2,
    0,
  )) return false
  return constrainLinearValueAtMost(
    vertical,
    -pCoefficient - tCoefficient / 2,
    -pOffset - tOffset / 2,
    0,
  )
}

/**
 * Completes the top-down template with an authoritative Z-axis volume.
 * Horizontal membership remains owned by `cellsForAoe`; this function only
 * answers whether the creature's occupied vertical interval intersects it.
 */
export function dnd5eInstantAoeAffectsTokenVertically(input: {
  spellId: string
  area: SkillAoeTargeting
  map: BattleMap
  geometry?: MapGeometryState
  sourceToken: Token
  targetToken: Token
  effectOrigin: { x: number; y: number }
  effectOriginElevationFeet: number
  /** Selected aim point for self-origin line/cone pitch. */
  effectAim?: { x: number; y: number }
  /** Absolute elevation of the selected aim point. */
  effectAimElevationFeet?: number
}): boolean {
  const targetBottom = mapGeometryTokenElevation(input.geometry, input.targetToken)
  const targetHeight = dnd5eTokenHeightFeet(input.targetToken)

  if (GROUND_AREA_SPELLS.has(input.spellId)) {
    const ground = mapGeometryTerrainElevationAtPoint(
      input.geometry,
      input.targetToken,
    )
    return Math.abs(targetBottom - ground) <= 1e-4
  }

  const columnHeight = COLUMN_HEIGHT_BY_SPELL[input.spellId]
  if (columnHeight != null) {
    return intervalOverlaps(
      targetBottom,
      targetHeight,
      input.effectOriginElevationFeet,
      input.effectOriginElevationFeet + columnHeight,
    )
  }

  if (input.area.origin === 'self') {
    if (
      (input.area.shape === 'line' || input.area.shape === 'cone') &&
      input.effectAim != null &&
      input.effectAimElevationFeet != null &&
      Number.isFinite(input.effectAim.x) &&
      Number.isFinite(input.effectAim.y) &&
      Number.isFinite(input.effectAimElevationFeet)
    ) {
      const pitchedIntersection = pitchedSelfAreaIntersectsToken({
        area: input.area,
        map: input.map,
        targetToken: input.targetToken,
        targetBottom,
        targetHeight,
        effectOrigin: input.effectOrigin,
        effectOriginElevationFeet: input.effectOriginElevationFeet,
        effectAim: input.effectAim,
        effectAimElevationFeet: input.effectAimElevationFeet,
      })
      if (pitchedIntersection != null) return pitchedIntersection
    }
    const sourceBottom = mapGeometryTokenElevation(input.geometry, input.sourceToken)
    const verticalGap = dnd5eVerticalIntervalDistanceFeet(
      sourceBottom,
      dnd5eTokenHeightFeet(input.sourceToken),
      targetBottom,
      targetHeight,
    )
    const reach = input.area.shape === 'circle'
      ? input.area.radiusFeet
      : input.area.lengthFeet
    return verticalGap <= reach + 1e-4
  }

  if (input.area.shape === 'circle') {
    const verticalGap = input.effectOriginElevationFeet < targetBottom
      ? targetBottom - input.effectOriginElevationFeet
      : input.effectOriginElevationFeet > targetBottom + targetHeight
        ? input.effectOriginElevationFeet - (targetBottom + targetHeight)
        : 0
    return verticalGap <= input.area.radiusFeet + 1e-4
  }

  const height = Math.max(input.area.widthFeet, input.area.heightFeet)
  return intervalOverlaps(
    targetBottom,
    targetHeight,
    input.effectOriginElevationFeet,
    input.effectOriginElevationFeet + height,
  )
}
