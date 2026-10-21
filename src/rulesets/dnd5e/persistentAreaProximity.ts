import {tokenOccupiedCellsAt} from '../../lib/gridCombat'
import {mapGeometryRuntimeForMap, mapGeometryTokenElevation, mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'
import {cellToPixel} from '../../lib/gridCombat'
import {persistentAreaHeightSlices} from '../../../shared/persistent-area-columns.mjs'
import type {BattleMap, Dnd5ePluginArea, Token} from '../../store/maps'
import {dnd5eTokenHeightFeet} from './verticalCombatGeometry'
import {dnd5eTokenIntersectsPersistentAreaAt} from './persistentAreaGeometry'

/** Grid distance to an area's body, including target footprint and vertical gap. */
export function dnd5ePersistentAreaProximityIncludes(token: Token, map: BattleMap, area: Dnd5ePluginArea, feet?: number): boolean {
  if (feet == null) return dnd5eTokenIntersectsPersistentAreaAt(token, map, area, token)
  if (!Number.isFinite(feet) || feet < 0) return false
  const occupied = tokenOccupiedCellsAt(token, map, token)
  const scale = Math.max(1, map.feetPerCell ?? 5)
  const geometry = mapGeometryRuntimeForMap(map.id)
  const bottom = mapGeometryTokenElevation(geometry, token), top = bottom + dnd5eTokenHeightFeet(token)
  return persistentAreaHeightSlices(area).some(slice => {
    const vertical = slice.vertical
    if (vertical?.mode === 'volume') {
      const anchor = map.tokens.find(t => t.id === (slice.anchorTokenId ?? slice.sourceTokenId))
      const base = anchor && slice.anchorMode !== 'fixed' && Number.isFinite(vertical.anchorOffsetFeet)
        ? mapGeometryTokenElevation(geometry, anchor) + Number(vertical.anchorOffsetFeet) : vertical.baseElevationFeet
      if (Math.max(0, bottom - (base + vertical.heightFeet), base - top) > feet + 1e-7) return false
    }
    return occupied.some(target => slice.cells.some(cell => {
      if (vertical?.mode === 'ground') {
        const height = mapGeometryTerrainElevationAtPoint(geometry, cellToPixel(cell, map))
        if (Math.max(0, bottom - height, height - top) > feet + 1e-7) return false
      }
      return Math.max(Math.abs(cell.col - target.col), Math.abs(cell.row - target.row)) * scale <= feet + 1e-7
    }))
  })
}
