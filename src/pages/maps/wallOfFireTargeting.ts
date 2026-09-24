import { stoneWallPanels, stoneWallCells, stoneWallNextAngle } from '../../rulesets/dnd5e/stoneWall'
import type { GridCell } from '../../lib/gridCombat'
import { cellsForAoe, canPlaceAoe } from '../../lib/skillTargeting'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import { cellKey } from '../../lib/gridCombat'
import {
  dnd5eSpellUsesThinWallCells,
  dnd5eThinWallCells,
  dnd5eWallOfFireCells,
  dnd5eWallOfFireDamageCells,
} from '../../rulesets/dnd5e/wallOfFireGeometry'
import type { BattleMap } from '../../store/maps'
export { WallOfFireTargetingControls } from './WallOfFireTargetingControls'

export function stoneWallTargetingPanels(targeting: Dnd5eSpellTargetingSession, anchor: GridCell, map: BattleMap) {
  if (!targeting.areaTargetCell || !targeting.stoneWall) return []
  const layout = targeting.stoneWall
  const angles = !targeting.areaTargetSelected && layout.angles.length < 10
    ? [...layout.angles, stoneWallNextAngle(layout, anchor, map)] : layout.angles
  return stoneWallPanels({ ...layout, angles }, map)
}

export function wallOfFireTargetingCells(
  targeting: Dnd5eSpellTargetingSession | null,
  anchor: GridCell,
  map: BattleMap,
): GridCell[] | undefined {
  if (!targeting) return undefined
  if ((targeting.spellId === 'wall-of-stone' || targeting.spellId === 'wall-of-ice' || (targeting.spellId === 'wall-of-force' && (targeting.wallOfForceShape ?? 'plane') === 'plane'))) {
    return stoneWallCells(stoneWallTargetingPanels(targeting, anchor, map))
  }
  if (targeting.spellId === 'wall-of-force' && targeting.wallOfForceShape && targeting.wallOfForceShape !== 'plane') {
    return cellsForAoe({ shape: 'circle', origin: 'point', radiusFeet: targeting.areaTargetRadiusFeet ?? 10 }, anchor, anchor)
  }
  if (targeting.spellId !== 'wall-of-fire' && targeting.spellId !== 'blade-barrier') {
    if (!dnd5eSpellUsesThinWallCells(targeting.spellId) || targeting.area?.shape !== 'rect') return undefined
    return dnd5eThinWallCells({
      anchor,
      angleDegrees: targeting.areaTargetAngleDegrees ?? 0,
      lengthFeet: targeting.areaTargetWidthFeet ?? targeting.area.widthFeet,
      maximumLengthFeet: targeting.area.widthFeet,
      map,
    })
  }
  const blade = targeting.spellId === 'blade-barrier'
  return dnd5eWallOfFireCells({
    anchor,
    shape: blade ? targeting.bladeBarrierShape ?? 'line' : targeting.wallOfFireShape ?? 'line',
    angleDegrees: blade ? targeting.bladeBarrierAngleDegrees ?? 0 : targeting.wallOfFireAngleDegrees ?? 0,
    lengthFeet: blade ? targeting.bladeBarrierLengthFeet ?? 100 : targeting.wallOfFireLengthFeet,
    diameterFeet: blade ? targeting.bladeBarrierDiameterFeet ?? 60 : targeting.wallOfFireDiameterFeet,
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
  const valid = (input.targeting.spellId === 'wall-of-stone' || input.targeting.spellId === 'wall-of-ice' || (input.targeting.spellId === 'wall-of-force' && (input.targeting.wallOfForceShape ?? 'plane') === 'plane'))
    ? (cells.length ? cells : [input.anchor]).every(cell => cell.col >= 0 && cell.row >= 0 &&
      cell.col < Math.floor((input.map.width - input.map.gridOffsetX) / input.map.gridSize) &&
      cell.row < Math.floor((input.map.height - input.map.gridOffsetY) / input.map.gridSize) &&
      Math.max(Math.abs(cell.col - input.caster.col), Math.abs(cell.row - input.caster.row)) * (input.map.feetPerCell ?? 5) <= 120)
    : canPlaceAoe(input.targeting.area, input.caster, input.anchor)
  const rangeCells = cellsForAoe(
    { shape: 'circle', origin: 'self', radiusFeet: ('placeRangeFeet' in input.targeting.area ? input.targeting.area.placeRangeFeet : undefined) ?? 120 },
    input.caster,
    input.caster,
  )
  if ((input.targeting.spellId === 'wall-of-stone' || input.targeting.spellId === 'wall-of-ice' || (input.targeting.spellId === 'wall-of-force' && (input.targeting.wallOfForceShape ?? 'plane') === 'plane'))) {
    const panels = stoneWallTargetingPanels(input.targeting, input.anchor, input.map)
    const draft = !input.targeting.areaTargetSelected && (input.targeting.stoneWall?.angles.length ?? 0) < 10
    return { cells: panels.length ? [] : [input.anchor], rangeCells, valid, variant: 'attack' as const,
      iceWallPreview: input.targeting.spellId === 'wall-of-ice', forceWallPreview: input.targeting.spellId === 'wall-of-force', stoneWallPanels: panels, stoneWallDraftPanelId: draft ? panels.at(-1)?.id : undefined }
  }
  if (input.targeting.spellId !== 'wall-of-fire' && input.targeting.spellId !== 'blade-barrier') {
    return { cells, hazardCells: [], rangeCells, valid, variant: 'attack' as const, areaPolygon: undefined }
  }
  if (input.targeting.spellId === 'blade-barrier') {
    return { cells, hazardCells: [], rangeCells, valid, variant: 'attack' as const, areaPolygon: undefined }
  }
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
    lengthFeet: input.targeting.wallOfFireLengthFeet,
    diameterFeet: input.targeting.wallOfFireDiameterFeet,
    map: input.map,
  }).filter((cell) => !wallCellKeys.has(cellKey(cell)))
  const radians = angleDegrees * Math.PI / 180
  const center = {
    x: input.map.gridOffsetX + (input.anchor.col + 0.5) * input.map.gridSize,
    y: input.map.gridOffsetY + (input.anchor.row + 0.5) * input.map.gridSize,
  }
  const along = { x: Math.cos(radians), y: Math.sin(radians) }
  const normal = { x: -along.y, y: along.x }
  const halfLength = input.map.gridSize * ((input.targeting.wallOfFireLengthFeet ?? 60) / 10)
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
  if (targeting?.spellId === 'wall-of-stone' || targeting?.spellId === 'wall-of-ice') return { stoneWall: targeting.stoneWall }
  if (targeting?.spellId === 'wall-of-force') return { wallOfForceShape: targeting.wallOfForceShape ?? 'plane' as const, stoneWall: (targeting.wallOfForceShape ?? 'plane') === 'plane' ? targeting.stoneWall : undefined }
  if (targeting?.spellId === 'blade-barrier') return {
    bladeBarrierShape: targeting.bladeBarrierShape ?? 'line' as const,
    bladeBarrierAngleDegrees: targeting.bladeBarrierAngleDegrees ?? 0,
    bladeBarrierLengthFeet: targeting.bladeBarrierLengthFeet ?? 100,
    bladeBarrierDiameterFeet: targeting.bladeBarrierDiameterFeet ?? 60,
  }
  return targeting?.spellId === 'wall-of-fire' ? {
    wallOfFireShape: targeting.wallOfFireShape ?? 'line' as const,
    wallOfFireAngleDegrees: targeting.wallOfFireAngleDegrees ?? 0,
    wallOfFireDamagingSide: targeting.wallOfFireDamagingSide ??
      ((targeting.wallOfFireShape ?? 'line') === 'ring' ? 'outside' as const : 'right' as const),
    wallOfFireLengthFeet: targeting.wallOfFireLengthFeet ?? 60,
    wallOfFireDiameterFeet: targeting.wallOfFireDiameterFeet ?? 20,
  } : {}
}
