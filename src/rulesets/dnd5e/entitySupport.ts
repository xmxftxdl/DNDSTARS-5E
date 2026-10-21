import type { BattleMap, Token } from '../../store/maps'
import { tokenOccupiedCellsAt, tokenCenterForAnchorCell } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, type MapGeometryState } from '../../lib/mapGeometry'
import { structureSupportingElevation } from '../../../shared/structure-support.mjs'

/** Highest physical entity surface fully supporting this footprint below its current feet. */
export function dnd5eEntitySupportElevation(input: {
  map: BattleMap; token: Token; terrainElevationFeet: number; elevationFeet: number; geometry?: MapGeometryState | null
}): number {
  const { map, token, terrainElevationFeet, elevationFeet } = input
  const levels = new Map<number, Set<string>>()
  let circularSupport = terrainElevationFeet
  const geometry = input.geometry === undefined ? mapGeometryRuntimeForMap(map.id) : input.geometry
  circularSupport=structureSupportingElevation({map,geometry,position:token,elevationFeet,terrainElevationFeet,
    creatureWidthFeet:token.size*(map.feetPerCell??5)})
  for (const area of map.dnd5ePluginAreas ?? []) {
    if (area.entityProfile?.supportsStanding !== true || area.vertical?.mode !== 'volume' ||
      area.vertical.shape === 'sphere' || (area.entityCurrentHitPoints ?? area.entityProfile.hitPoints) <= 0) continue
    const top = area.vertical.baseElevationFeet + area.vertical.heightFeet
    if (!Number.isFinite(top) || top <= terrainElevationFeet || top > elevationFeet + 1e-4) continue
    if (area.circularGeometry) {
      const anchor = area.anchorCell ?? area.cells[0]
      if (!anchor) continue
      const center = tokenCenterForAnchorCell(anchor, { size: 1 }, map)
      const feetPerPixel = (map.feetPerCell ?? 5) / map.gridSize
      // A round pillar supports a creature's nominal width, not the whole
      // containing grid square (which can be larger than the pillar itself).
      const requiredRadius = Math.hypot(token.x - center.x, token.y - center.y) * feetPerPixel +
        token.size * (map.feetPerCell ?? 5) / 2
      if (requiredRadius <= area.circularGeometry.radiusFeet + 1e-4) circularSupport = Math.max(circularSupport, top)
      continue
    }
    const cells = levels.get(top) ?? new Set<string>()
    area.cells.forEach(cell => cells.add(`${cell.col}:${cell.row}`))
    levels.set(top, cells)
  }
  const footprint = tokenOccupiedCellsAt(token, map, token)
  if (!footprint.length) return terrainElevationFeet
  for (const top of [...levels.keys()].sort((a, b) => b - a)) {
    if (footprint.every(cell => levels.get(top)!.has(`${cell.col}:${cell.row}`))) return Math.max(circularSupport, top)
  }
  return circularSupport
}
