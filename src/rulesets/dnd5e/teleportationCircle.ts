import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { cellKey, cellToPixel, mapCellExtent, occupiedCells, pixelToCell, tokenOccupiedCellsAt, tokenCenterForAnchorCell } from '../../lib/gridCombat'
import { dnd5ePersistentAreaTeleportationBlocker, mapGeometryPlacementBlocked, mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { dnd5ePersistentAreaAffectsTokenVerticallyAt } from './persistentAreaGeometry'

export interface TeleportationCircleExit {
  mapId: string
  x: number
  y: number
  /** Exploration has no initiative boundary; the portal lasts six seconds. */
  expiresAt?: number
  exploration?: boolean
  /** Original initiative boundary retained if the caster leaves this map. */
  closesBeforeTokenId?: string
  closesBeforeRound?: number
}

export function normalizeTeleportationCircleExit(value: unknown): TeleportationCircleExit | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as TeleportationCircleExit
  if (typeof v.mapId !== 'string' || !v.mapId.trim() || !Number.isFinite(v.x) || !Number.isFinite(v.y) ||
    (v.expiresAt != null && (!Number.isFinite(v.expiresAt) || v.expiresAt <= 0))) return undefined
  return { mapId: v.mapId, x: v.x, y: v.y, ...(v.expiresAt == null ? {} : { expiresAt: v.expiresAt }),
    ...(v.exploration === true ? { exploration: true } : {}),
    ...(typeof v.closesBeforeTokenId === 'string' ? { closesBeforeTokenId: v.closesBeforeTokenId } : {}),
    ...(Number.isInteger(v.closesBeforeRound) ? { closesBeforeRound: v.closesBeforeRound } : {}),
  }
}

export function createTeleportationCircle(input: {
  id: string; map: BattleMap; caster: Token; round: number; exit: TeleportationCircleExit
}): Dnd5ePluginArea {
  const { map, caster, round } = input
  const anchorCell = pixelToCell(caster.x, caster.y, map)
  const center = cellToPixel(anchorCell, map)
  const radius = 5 / (map.feetPerCell ?? 5) * map.gridSize
  const extent = mapCellExtent(map)
  const cells = []
  const n = Math.ceil(radius / map.gridSize)
  for (let col = Math.max(0, anchorCell.col - n); col <= Math.min(extent.cols - 1, anchorCell.col + n); col++) {
    for (let row = Math.max(0, anchorCell.row - n); row <= Math.min(extent.rows - 1, anchorCell.row + n); row++) {
      const p = cellToPixel({ col, row }, map)
      if (Math.hypot(p.x - center.x, p.y - center.y) <= radius) cells.push({ col, row })
    }
  }
  return {
    id: input.id, pluginId: 'srd-5.1', featureId: 'spell:teleportation-circle', sourceKind: 'core-spell',
    coreSpellId: 'teleportation-circle', label: '传送法阵', color: '#67e8f9',
    sourceCharacterId: caster.characterId ?? '', sourceTokenId: caster.id,
    cells, anchorCell, anchorMode: 'fixed', createdRound: round, expiresAfterRound: Math.max(round + 1, input.exit.closesBeforeRound ?? 0),
    ...(input.exit.exploration ? { permanent: true } : { expiresAtSourceTurnEndAfterRound: round + 1 }),
    vertical: { mode: 'ground' },
    visual: { preset: 'arcane', intensity: 'strong' }, teleportationExit: input.exit,
  }
}

export function teleportationCircleContains(map: BattleMap, area: Dnd5ePluginArea, token: Token) {
  if (!area.anchorCell || !area.teleportationExit) return false
  const center = cellToPixel(area.anchorCell, map)
  return Math.hypot(token.x - center.x, token.y - center.y) <= 5 * map.gridSize / (map.feetPerCell ?? 5) &&
    dnd5ePersistentAreaAffectsTokenVerticallyAt({ area, map, token, position: token })
}

/** Follow the approved polyline, never the straight chord across a detour. */
export function teleportationCircleCrossed(map: BattleMap, area: Dnd5ePluginArea, old: Token, token: Token) {
  if (!area.anchorCell || !area.teleportationExit || old.x === token.x && old.y === token.y) return false
  const animation = token.movementAnimation
  const end = animation?.points.at(-1)
  const start = animation?.points[0]
  const points = animation && animation.id !== old.movementAnimation?.id && start && end &&
    Math.hypot(start.x - old.x, start.y - old.y) < .01 && Math.hypot(end.x - token.x, end.y - token.y) < .01
    ? animation.points : [old, token]
  const center = cellToPixel(area.anchorCell, map)
  return points.slice(1).some((to, index) => {
    const from = points[index], dx = to.x - from.x, dy = to.y - from.y
    const t = Math.max(0, Math.min(1, ((center.x - from.x) * dx + (center.y - from.y) * dy) / (dx * dx + dy * dy || 1)))
    return teleportationCircleContains(map, area, { ...token, x: from.x + t * dx, y: from.y + t * dy })
  })
}

export function teleportationCircleExpiredAfterDeparture(area: Dnd5ePluginArea, map: BattleMap, round: number, currentTokenId?: string) {
  const exit = area.teleportationExit
  if (!exit || exit.exploration || map.tokens.some(token => token.id === area.sourceTokenId)) return false
  const boundary = exit.closesBeforeRound ?? area.createdRound + 2
  return round > boundary || round === boundary && (!exit.closesBeforeTokenId || currentTokenId === exit.closesBeforeTokenId || !map.tokens.some(token => token.id === exit.closesBeforeTokenId))
}

/** Exhaustive nearest-free-cell search. Never falls back to an occupied square. */
export function teleportationCircleLanding(map: BattleMap, token: Token, exit: TeleportationCircleExit) {
  if (exit.x < 0 || exit.y < 0 || exit.x > map.width || exit.y > map.height) return undefined
  const occupied = occupiedCells(map.tokens, map, token.id)
  const extent = mapCellExtent(map)
  const geometry = mapGeometryRuntimeForMap(map.id)
  const candidates: Array<{ x: number; y: number; distance: number }> = []
  for (let col = 0; col < extent.cols; col++) for (let row = 0; row < extent.rows; row++) {
    const p = tokenCenterForAnchorCell({ col, row }, token, map)
    candidates.push({ ...p, distance: Math.hypot(p.x - exit.x, p.y - exit.y) })
  }
  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x)
  for (const p of candidates) {
    const cells = tokenOccupiedCellsAt(token, map, p)
    if (cells.some(c => c.col < 0 || c.row < 0 || c.col >= extent.cols || c.row >= extent.rows || occupied.has(cellKey(c)))) continue
    const elevationFeet = mapGeometryTerrainElevationAtPoint(geometry, p)
    if (dnd5ePersistentAreaTeleportationBlocker({ geometry, map, token,
      from: { x: -1e6, y: -1e6 }, to: p, toElevationFeet: elevationFeet })) continue
    if (mapGeometryPlacementBlocked({ geometry, map, token, at: p, elevationFeet }).blocked) continue
    return { x: p.x, y: p.y, elevationFeet }
  }
  return undefined
}

export function travelThroughTeleportationCircle(maps: readonly BattleMap[], sourceMapId: string, areaId: string, tokenId: string) {
  const source = maps.find(m => m.id === sourceMapId)
  const area = source?.dnd5ePluginAreas?.find(a => a.id === areaId)
  const exit = area?.teleportationExit
  const token = source?.tokens.find(t => t.id === tokenId && t.type !== 'obstacle')
  const destination = maps.find(m => m.id === exit?.mapId)
  if (!source || !area || !exit || !token || !destination || (exit.expiresAt != null && exit.expiresAt <= Date.now())) return undefined
  if (source.id !== destination.id && destination.tokens.some(t => t.id === token.id || token.characterId && t.characterId === token.characterId)) return undefined
  if (dnd5ePersistentAreaTeleportationBlocker({ geometry: mapGeometryRuntimeForMap(source.id),
    map: source, token, from: token, to: { x: -1e6, y: -1e6 } })) return undefined
  const position = teleportationCircleLanding(destination, token, exit)
  if (!position) return undefined
  const moved = { ...token, ...position, movementAnimation: undefined, teleportationArrivalMapId: destination.id }
  return maps.map(m => m.id === destination.id
    ? { ...m, tokens: [...m.tokens.filter(t => t.id !== token.id), moved] }
    : m.id === source.id ? { ...m, tokens: m.tokens.filter(t => t.id !== token.id) } : m)
}
