import type { Dnd5eCombatant } from '../../rulesets/dnd5e/headlessCombatEngine'

export function dmTokenElevationPermission(combatant?: Dnd5eCombatant): { allowed: boolean; reason: string } {
  void combatant
  return { allowed: true, reason: 'DM 可直接调整高度，不要求飞行能力，也不消耗移动力。' }
}

import type { BattleMap, Token } from '../../store/maps'
import { cellKey, tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import { createMapTokenOccupancy } from '../../lib/mapTokenOccupancy'

export function resolveDmTokenElevation(map: BattleMap, geometry: MapGeometryState | undefined, token: Token, height: number, permission: { allowed: boolean; reason: string }) {
  if (!permission.allowed) throw new Error(permission.reason)
  const elevationFeet = mapGeometryTerrainElevationAtPoint(geometry, token) + height
  if (!Number.isFinite(height) || height < 0 || elevationFeet < -1000 || elevationFeet > 10000) {
    throw new Error('请输入有效的非负离地高度；绝对高度不能超过 10000 尺。')
  }
  const occupied = createMapTokenOccupancy(map, geometry, token)(elevationFeet)
  if (tokenOccupiedCellsAt(token, map, token).some(cell => occupied.has(cellKey(cell)))) {
    throw new Error('该高度与其他单位重叠，请选择其他高度或先移动单位。')
  }
  return elevationFeet
}
