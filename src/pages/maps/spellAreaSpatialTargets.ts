import { type GridCell } from '../../lib/gridCombat'
import { mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import { aoeOrientFromCell, cellsForAoe, resolveAoeDimensions, tokensInCells } from '../../lib/skillTargeting'
import { dnd5eInstantAoeAffectsTokenVertically } from '../../rulesets/dnd5e/verticalCombatGeometry'
import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import type { BattleMap, Token } from '../../store/maps'
import { wallOfFireTargetingCells } from './wallOfFireTargeting'
import { resolveSpellAreaObstruction } from '../../rulesets/dnd5e/spellAreaObstruction'

/** Spatial candidates only; targeting policy and creature state are checked by the caller. */
export function spellAreaSpatialTargets(input: {
  targeting: Dnd5eSpellTargetingSession
  map: BattleMap
  geometry?: MapGeometryState
  source: Token
  casterCell: GridCell
  anchor: GridCell
  rotation: number
}): Token[] {
  const { targeting, map, geometry, source, casterCell, anchor, rotation } = input
  if (!targeting.area) return []
  const area = resolveAoeDimensions(targeting.area, {
    radiusFeet: targeting.areaTargetRadiusFeet, widthFeet: targeting.areaTargetWidthFeet,
    heightFeet: targeting.areaTargetHeightFeet, lengthFeet: targeting.areaTargetLengthFeet,
  })
  if (!area) return []
  const orientFrom = aoeOrientFromCell(area, casterCell, anchor, {
    rectRotation: rotation,
    ...(area.shape === 'rect' && area.rotatable && targeting.spellId !== 'wall-of-fire'
      ? { rectAngleDegrees: targeting.areaTargetAngleDegrees ?? 0 } : {}),
  })
  const cells = wallOfFireTargetingCells(targeting, anchor, map) ?? cellsForAoe(area, orientFrom, anchor)
  const aim = { x: map.gridOffsetX + (anchor.col + 0.5) * map.gridSize,
    y: map.gridOffsetY + (anchor.row + 0.5) * map.gridSize }
  const aimElevation = targeting.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, aim)
  const origin = area.origin === 'point' ? aim : source
  const elevation = area.origin === 'point' ? aimElevation : mapGeometryTokenElevation(geometry, source)
  const obstruction = resolveSpellAreaObstruction({ spellId: targeting.spellId, map, geometry, cells, area, origin, elevationFeet: elevation })
  return tokensInCells(map, map.tokens, cells).filter((target) =>
    target.type !== 'obstacle' && target.type !== 'npc' &&
    dnd5eInstantAoeAffectsTokenVertically({
      spellId: targeting.spellId, area, map, geometry, sourceToken: source, targetToken: target,
      effectOrigin: origin, effectOriginElevationFeet: elevation,
      effectAim: aim, effectAimElevationFeet: aimElevation,
    }) && obstruction.affectsToken(target))
}
