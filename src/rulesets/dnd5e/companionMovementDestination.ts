import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import type { BattleMap, Token } from '../../store/maps'
import { mapCellExtent, tokenOccupiedCellsAt } from '../../lib/gridCombat'

export type Dnd5eCompanionMovementDestination = { mapId: string; x: number; y: number }

export function normalizeDnd5eCompanionMovementDestination(value: unknown): Dnd5eCompanionMovementDestination | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['mapId','x','y'].includes(key)) ||
    typeof raw.mapId !== 'string' || !raw.mapId.trim() || raw.mapId.length > 256 ||
    typeof raw.x !== 'number' || typeof raw.y !== 'number' ||
    !Number.isFinite(raw.x) || !Number.isFinite(raw.y) || raw.x < 0 || raw.y < 0) return undefined
  return { mapId: raw.mapId, x: raw.x, y: raw.y }
}

export function dnd5eCompanionDestinationFitsMap(map: BattleMap | undefined, tokenId: string,
  destination: Dnd5eCompanionMovementDestination): boolean {
  const token = map?.tokens.find(candidate => candidate.id === tokenId)
  if (!normalizeDnd5eCompanionMovementDestination(destination) || !map || !token || destination.mapId !== map.id || destination.x >= map.width || destination.y >= map.height) return false
  const cells = tokenOccupiedCellsAt(token, map, destination)
  const { cols, rows } = mapCellExtent(map)
  return cells.every(cell => cell.col >= 0 && cell.row >= 0 &&
    cell.col < cols && cell.row < rows)
}

export function isDnd5eCompanionMovementSelections(value: unknown): value is Record<string, Record<string, Dnd5eCompanionMovementDestination | null>> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 64) return false
  return Object.entries(value).every(([operationId, targets]) => operationId.trim().length > 0 && operationId.length <= 256 &&
    targets && typeof targets === 'object' && !Array.isArray(targets) && Object.keys(targets).length <= 1000 &&
    Object.entries(targets).every(([targetId, destination]) => targetId.trim().length > 0 && targetId.length <= 256 &&
      (destination === null || normalizeDnd5eCompanionMovementDestination(destination) != null)))
}

export function dnd5eOwnedCompanionMovementDestination(token: Token, map?: BattleMap): Dnd5eCompanionMovementDestination | undefined {
  const order = token.dnd5eCombatState?.companionCommand, summon = token.dnd5eSummon
  const grove = token.dnd5eGroveGuardian
  if (grove && order?.sourceOwnerId === grove.sourceTokenId && map?.dnd5ePluginAreas?.some(area =>
    area.id === grove.boundaryAreaId && area.sourceTokenId === grove.sourceTokenId &&
    area.effectGroup?.castId === grove.castId && area.effectGroup.effectId === 'guardians' &&
    area.featureId === order.sourceFeatureId)) return normalizeDnd5eCompanionMovementDestination(order.movementDestination)
  return summon && (!summon.controlEnded || dnd5eHasVoluntaryCompanionOrder(token)) && summon.commandPolicy && order?.sourceOwnerId === summon.sourceTokenId &&
    order.sourceFeatureId === summon.featureId ? normalizeDnd5eCompanionMovementDestination(order.movementDestination) : undefined
}
