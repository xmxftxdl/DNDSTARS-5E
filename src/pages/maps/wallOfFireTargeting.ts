import type { GridCell } from '../../lib/gridCombat'
import { cellsForAoe, canPlaceAoe } from '../../lib/skillTargeting'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import { cellKey } from '../../lib/gridCombat'
import {
  dnd5eWallOfFireCells,
  dnd5eWallOfFireDamageCells,
} from '../../rulesets/dnd5e/wallOfFireGeometry'
import type { BattleMap } from '../../store/maps'
export { WallOfFireTargetingControls } from './WallOfFireTargetingControls'

export function wallOfFireTargetingCells(
  targeting: Dnd5eSpellTargetingSession | null,
  anchor: GridCell,
  map: BattleMap,
): GridCell[] | undefined {
  if (targeting?.spellId !== 'wall-of-fire') return undefined
  return dnd5eWallOfFireCells({
    anchor,
    shape: targeting.wallOfFireShape ?? 'line',
    angleDegrees: targeting.wallOfFireAngleDegrees ?? 0,
    map,
  })
}

export function wallOfFireTargetingPreview(input: {
  targeting: Dnd5eSpellTargetingSession | null
  anchor: GridCell
  caster: GridCell
  map: BattleMap
}) {
  const cells = wallOfFireTargetingCells(input.targeting, input.anchor, input.map)
  if (!cells || !input.targeting?.area) return undefined
  const valid = canPlaceAoe(input.targeting.area, input.caster, input.anchor)
  const rangeCells = cellsForAoe(
    { shape: 'circle', origin: 'self', radiusFeet: ('placeRangeFeet' in input.targeting.area ? input.targeting.area.placeRangeFeet : undefined) ?? 120 },
    input.caster,
    input.caster,
  )
  const shape = input.targeting.wallOfFireShape ?? 'line'
  const angleDegrees = input.targeting.wallOfFireAngleDegrees ?? 0
  const damagingSide = input.targeting.wallOfFireDamagingSide ??
    (shape === 'ring' ? 'outside' : 'right')
  const wallCellKeys = new Set(cells.map(cellKey))
  const hazardCells = dnd5eWallOfFireDamageCells({
    anchor: input.anchor,
    wallCells: cells,
    shape,
    angleDegrees,
    damagingSide,
    map: input.map,
  }).filter((cell) => !wallCellKeys.has(cellKey(cell)))
  const radians = angleDegrees * Math.PI / 180
  const center = {
    x: input.map.gridOffsetX + (input.anchor.col + 0.5) * input.map.gridSize,
    y: input.map.gridOffsetY + (input.anchor.row + 0.5) * input.map.gridSize,
  }
  const along = { x: Math.cos(radians), y: Math.sin(radians) }
  const normal = { x: -along.y, y: along.x }
  const halfLength = input.map.gridSize * 6
  const halfWidth = input.map.gridSize * 0.5
  const areaPolygon = shape === 'line' ? [
    center.x - along.x * halfLength + normal.x * halfWidth, center.y - along.y * halfLength + normal.y * halfWidth,
    center.x + along.x * halfLength + normal.x * halfWidth, center.y + along.y * halfLength + normal.y * halfWidth,
    center.x + along.x * halfLength - normal.x * halfWidth, center.y + along.y * halfLength - normal.y * halfWidth,
    center.x - along.x * halfLength - normal.x * halfWidth, center.y - along.y * halfLength - normal.y * halfWidth,
  ] : undefined
  return { cells, hazardCells, rangeCells, valid, variant: 'attack' as const, areaPolygon }
}

export function wallOfFirePayload(targeting: Dnd5eSpellTargetingSession | null) {
  return targeting?.spellId === 'wall-of-fire' ? {
    wallOfFireShape: targeting.wallOfFireShape ?? 'line' as const,
    wallOfFireAngleDegrees: targeting.wallOfFireAngleDegrees ?? 0,
    wallOfFireDamagingSide: targeting.wallOfFireDamagingSide ??
      ((targeting.wallOfFireShape ?? 'line') === 'ring' ? 'outside' as const : 'right' as const),
  } : {}
}
