import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import type { BattleMap, Token } from '../../store/maps'

/** Map-space rectangle selected for a persistent guard order. */
export type Dnd5eCompanionGuardArea = { mapId: string; minX: number; minY: number; maxX: number; maxY: number }

export function normalizeDnd5eCompanionGuardArea(value: unknown): Dnd5eCompanionGuardArea | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const area = value as Record<string, unknown>
  if (Object.keys(area).some(key => !['mapId','minX','minY','maxX','maxY'].includes(key)) ||
    typeof area.mapId !== 'string' || !area.mapId.trim() || area.mapId.length > 256 ||
    !['minX','minY','maxX','maxY'].every(key => typeof area[key] === 'number' && Number.isFinite(area[key]) && Number(area[key]) >= 0)) return undefined
  const { minX, minY, maxX, maxY } = area as Dnd5eCompanionGuardArea
  if (minX >= maxX || minY >= maxY) return undefined
  return { mapId: area.mapId, minX, minY, maxX, maxY }
}

export function dnd5eCompanionGuardAreaFitsMap(map: BattleMap | undefined, value: unknown): boolean {
  const area = normalizeDnd5eCompanionGuardArea(value)
  return !!map && !!area && area.mapId === map.id && area.maxX <= map.width && area.maxY <= map.height
}

export function isDnd5eCompanionGuardSelections(value: unknown): value is Record<string, Dnd5eCompanionGuardArea> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 64 &&
    Object.entries(value).every(([id,area]) => id.trim().length > 0 && id.length <= 256 && !!normalizeDnd5eCompanionGuardArea(area))
}

export function dnd5eTokenIntersectsGuardArea(map: BattleMap, token: Token, area: Dnd5eCompanionGuardArea): boolean {
  if (!dnd5eCompanionGuardAreaFitsMap(map, area)) return false
  const half = Math.max(1, token.size ?? 1) * map.gridSize / 2
  return token.x + half > area.minX && token.x - half < area.maxX && token.y + half > area.minY && token.y - half < area.maxY
}

export function dnd5eGuardContainsTokenAt(map: BattleMap, token: Token, area: Dnd5eCompanionGuardArea,
  position: { x: number; y: number }): boolean {
  if (!dnd5eCompanionGuardAreaFitsMap(map, area)) return false
  const half = Math.max(1, token.size ?? 1) * map.gridSize / 2
  return position.x - half >= area.minX && position.x + half <= area.maxX &&
    position.y - half >= area.minY && position.y + half <= area.maxY
}

/** An approaching guard may enter the region, but must not leave it again. */
export function dnd5eCompanionGuardCanTraverse(map: BattleMap, token: Token,
  from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const order = token.dnd5eCombatState?.companionCommand, summon = token.dnd5eSummon
  if (!order?.guardArea || !summon?.commandPolicy || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) ||
    order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId) return true
  if (!dnd5eCompanionGuardAreaFitsMap(map, order.guardArea)) return false
  return !dnd5eGuardContainsTokenAt(map, token, order.guardArea, from) || dnd5eGuardContainsTokenAt(map, token, order.guardArea, to)
}
