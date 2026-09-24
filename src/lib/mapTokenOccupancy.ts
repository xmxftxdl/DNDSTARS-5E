import type { BattleMap, Token } from '../store/maps'
import { occupiedCells } from './gridCombat'
import { mapGeometryTokenElevation, type MapGeometryState } from './mapGeometry'

/** Match the body volume used by map geometry, cover and movement. */
export const mapTokenBodyHeight = (token: Token): number => Math.max(5, Math.max(1, token.size) * 5)

/** Half-open vertical intervals: touching feet/ceiling boundaries do not overlap. */
export function createMapTokenOccupancy(
  map: BattleMap, geometry: MapGeometryState | undefined, mover: Token,
  ignoreTokens = false, excludedIds: readonly string[] = [],
) {
  const excluded = new Set([mover.id, ...excludedIds])
  const bodies = ignoreTokens ? [] : map.tokens.filter(token => !excluded.has(token.id) && !token.dnd5eSpellEffect)
    .map(token => ({ token, base: mapGeometryTokenElevation(geometry, token), height: mapTokenBodyHeight(token) }))
  const cache = new Map<string, Set<string>>()
  return (base: number, top = base + mapTokenBodyHeight(mover)): Set<string> => {
    const key = `${base}:${top}`
    if (!cache.has(key)) cache.set(key, occupiedCells(bodies.filter(body =>
      base < body.base + body.height && top > body.base).map(body => body.token), map, mover.id))
    return cache.get(key)!
  }
}
