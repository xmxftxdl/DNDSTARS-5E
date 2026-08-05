import type { GridCell } from '../../lib/gridCombat'
import {
  aoeOrientFromCell,
  canPlaceAoe,
  cellsForAoe,
  type SkillAoeTargeting,
} from '../../lib/skillTargeting'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import type { BattleMap } from '../../store/maps'
import type { AoeHighlight } from '../../components/map/mapCanvasContracts'
import { wallOfFireTargetingPreview } from './wallOfFireTargeting'

export function buildSpellOrSkillAoeHighlight(input: {
  targeting: SkillAoeTargeting | null | undefined
  previewCell: GridCell | null
  casterCell: GridCell | null
  map: BattleMap | null | undefined
  rectRotation: number
  spellTargeting: Dnd5eSpellTargetingSession | null
}): AoeHighlight | undefined {
  const { targeting, previewCell, casterCell, map, rectRotation, spellTargeting } = input
  if (!targeting || !previewCell || !casterCell) return undefined
  if (map) {
    const wallPreview = wallOfFireTargetingPreview({
      targeting: spellTargeting,
      anchor: previewCell,
      caster: casterCell,
      map,
    })
    if (wallPreview) return wallPreview
  }

  const gridSize = map?.gridSize ?? 1
  const gridOffsetX = map?.gridOffsetX ?? 0
  const gridOffsetY = map?.gridOffsetY ?? 0
  const valid = canPlaceAoe(targeting, casterCell, previewCell)
  const orientFrom = aoeOrientFromCell(targeting, casterCell, previewCell, {
    rectRotation,
    ...(targeting.shape === 'rect' && targeting.rotatable && spellTargeting?.spellId !== 'wall-of-fire'
      ? { rectAngleDegrees: spellTargeting?.areaTargetAngleDegrees ?? 0 }
      : {}),
  })
  const cells = cellsForAoe(targeting, orientFrom, previewCell)
  const isSelfCircle = targeting.shape === 'circle' && targeting.origin === 'self'
  const mapDiagonalFeet = map
    ? Math.hypot(
        Math.ceil(map.width / Math.max(1, map.gridSize)),
        Math.ceil(map.height / Math.max(1, map.gridSize)),
      ) * Math.max(1, map.feetPerCell ?? 5)
    : Number.POSITIVE_INFINITY
  const rangeCells =
    targeting.shape === 'circle' && targeting.origin === 'point' && targeting.placeRangeFeet != null
      && targeting.placeRangeFeet < mapDiagonalFeet
      ? cellsForAoe(
          { shape: 'circle', origin: 'self', radiusFeet: targeting.placeRangeFeet },
          casterCell,
          casterCell,
        )
      : targeting.shape === 'rect' && targeting.placeRangeFeet != null
        ? cellsForAoe(
            { shape: 'circle', origin: 'self', radiusFeet: targeting.placeRangeFeet },
            casterCell,
            casterCell,
          )
        : undefined
  const cellCenterToPixel = (cell: GridCell) => ({
    x: gridOffsetX + (cell.col + 0.5) * gridSize,
    y: gridOffsetY + (cell.row + 0.5) * gridSize,
  })
  const areaCenter = cellCenterToPixel(isSelfCircle ? casterCell : previewCell)
  const areaCircle = targeting.shape === 'circle'
    ? {
        centerX: areaCenter.x,
        centerY: areaCenter.y,
        radiusPx: targeting.radiusFeet / 5 * gridSize,
      }
    : undefined
  const committedAreaCircles = targeting.shape === 'circle'
    ? (spellTargeting?.areaTargetCells ?? []).map((cell) => {
        const center = cellCenterToPixel(cell)
        return {
          centerX: center.x,
          centerY: center.y,
          radiusPx: targeting.radiusFeet / 5 * gridSize,
        }
      })
    : undefined
  const areaPolygon = (() => {
    if (targeting.shape === 'circle') return undefined
    if (targeting.shape === 'cone') {
      const origin = cellCenterToPixel(casterCell)
      const aim = cellCenterToPixel(previewCell)
      const dx = aim.x - origin.x
      const dy = aim.y - origin.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const px = -uy
      const py = ux
      const length = targeting.lengthFeet / 5 * gridSize
      const halfWidth = length / 2
      const endX = origin.x + ux * length
      const endY = origin.y + uy * length
      return [origin.x, origin.y, endX + px * halfWidth, endY + py * halfWidth, endX - px * halfWidth, endY - py * halfWidth]
    }
    const origin = cellCenterToPixel(targeting.shape === 'line' ? casterCell : previewCell)
    const aim = targeting.shape === 'line'
      ? cellCenterToPixel(previewCell)
      : cellCenterToPixel({
          col: previewCell.col * 2 - orientFrom.col,
          row: previewCell.row * 2 - orientFrom.row,
        })
    const dx = aim.x - origin.x
    const dy = aim.y - origin.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const px = -uy
    const py = ux
    const width = targeting.widthFeet / 5 * gridSize
    const height = (targeting.shape === 'line' ? targeting.lengthFeet : targeting.heightFeet) / 5 * gridSize
    if (targeting.shape === 'line') {
      const end = { x: origin.x + ux * height, y: origin.y + uy * height }
      return [
        origin.x + px * width / 2, origin.y + py * width / 2,
        end.x + px * width / 2, end.y + py * width / 2,
        end.x - px * width / 2, end.y - py * width / 2,
        origin.x - px * width / 2, origin.y - py * width / 2,
      ]
    }
    return [
      origin.x - ux * height / 2 + px * width / 2, origin.y - uy * height / 2 + py * width / 2,
      origin.x + ux * height / 2 + px * width / 2, origin.y + uy * height / 2 + py * width / 2,
      origin.x + ux * height / 2 - px * width / 2, origin.y + uy * height / 2 - py * width / 2,
      origin.x - ux * height / 2 - px * width / 2, origin.y - uy * height / 2 - py * width / 2,
    ]
  })()

  return {
    cells,
    hazardCells: undefined,
    rangeCells,
    valid,
    variant: isSelfCircle ? ('range' as const) : ('attack' as const),
    areaCircle,
    committedAreaCircles,
    areaPolygon,
  }
}

export function buildGuessedSpellTargetHighlight(input: {
  targeting: Dnd5eSpellTargetingSession | null
  previewCell: GridCell | null
  casterCell: GridCell | null
  map: BattleMap | null | undefined
  spell?: {
    id: string
    allowsGuessedTargetCell?: boolean
    rangeFeet: number
    sustainedAttack?: { rangeFeet: number }
  }
}) {
  const { targeting, previewCell, casterCell, map, spell } = input
  if (
    !targeting?.guessedTargeting ||
    (targeting.area && !targeting.areaTargetSelected) ||
    !previewCell || !casterCell || !map || !spell?.allowsGuessedTargetCell
  ) return undefined
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const originCell = targeting.areaTargetCell ?? casterCell
  const targetRangeFeet = spell.id === 'spiritual-weapon'
    ? spell.sustainedAttack?.rangeFeet ?? 5
    : spell.rangeFeet
  const rangeInCells = Math.floor(targetRangeFeet / feetPerCell)
  const distanceInCells = Math.max(
    Math.abs(previewCell.col - originCell.col),
    Math.abs(previewCell.row - originCell.row),
  )
  return {
    cells: [previewCell],
    rangeCells: cellsForAoe(
      { shape: 'circle', origin: 'self', radiusFeet: targetRangeFeet },
      originCell,
      originCell,
    ),
    valid: distanceInCells <= rangeInCells,
    variant: 'attack' as const,
  }
}
