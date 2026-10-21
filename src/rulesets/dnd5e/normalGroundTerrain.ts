import type { BattleMap, Token } from '../../store/maps'
import { tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'

/** Ground-only terrain overlay; does not remove geometry or alter climbing/swimming. */
export function dnd5eNormalGroundTerrainAt(map: BattleMap | undefined, point: { x: number; y: number },
  elevationFeet: number, token?: Token, geometry?: MapGeometryState): boolean {
  if (!map || !Number.isFinite(elevationFeet)) return false
  const ground = mapGeometryTerrainElevationAtPoint(geometry ?? mapGeometryRuntimeForMap(map.id), point)
  if (Math.abs(elevationFeet - ground) > 1e-4) return false
  const col = Math.floor((point.x - (map.gridOffsetX ?? 0)) / map.gridSize)
  const row = Math.floor((point.y - (map.gridOffsetY ?? 0)) / map.gridSize)
  const cells = token ? tokenOccupiedCellsAt(token, map, point) : [{ col, row }]
  // Host area commits append new casts. Preserve this order across save/reload,
  // so removing the latest overlay reveals the still-active earlier terrain.
  const areas = map.dnd5ePluginAreas ?? []
  return cells.length > 0 && cells.every(cell => {
    for (let index = areas.length - 1; index >= 0; index--) {
      const area = areas[index]
      if (area.vertical?.mode !== 'ground' || area.coreSpellId === 'spirit-guardians' ||
        !area.cells.some(covered => covered.col === cell.col && covered.row === cell.row)) continue
      if (area.normalGroundTerrain === true) return true
      if ((area.movementCostMultiplier ?? 1) > 1) return false
    }
    return false
  })
}
