import { collectMapDifficultTerrainCells } from '../../lib/mapDifficultTerrain'
import { cellKey, tokenAnchorCellFromPixel, tokenCenterForAnchorCell, tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { mapGeometryMovementBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { stoneWallCells, stoneWallEnclosedCells, type StoneWallPanel } from './stoneWall'

/** Compare connected space before/after construction, including existing
 * room walls and closed doors. An already enclosed room alone is not a new
 * enclosure; there must be additional open space cut off by the new panels. */
export function stoneWallEnclosure(map: BattleMap, panels: readonly StoneWallPanel[], token: Token): Set<string> {
  const walls = new Set(stoneWallCells(panels).map(cellKey))
  const start = tokenAnchorCellFromPixel(token.x, token.y, token, map)
  if (walls.has(cellKey(start))) return new Set()
  const columns = Math.floor((map.width - map.gridOffsetX) / map.gridSize)
  const rows = Math.floor((map.height - map.gridOffsetY) / map.gridSize)
  const geometry = mapGeometryRuntimeForMap(map.id)
  if (!(geometry?.walls.length || geometry?.obstacles.length || map.dnd5ePluginAreas?.some(a => a.blocking?.movement))) {
    const enclosed = stoneWallEnclosedCells(panels)
    return enclosed.has(cellKey(start)) ? enclosed : new Set()
  }
  const edgeCache = new Map<string, boolean>()
  const blocked = (a: typeof start, b: typeof start) => {
    const key = `${cellKey(a)}:${cellKey(b)}`
    if (edgeCache.has(key)) return edgeCache.get(key)!
    const from = tokenCenterForAnchorCell(a, { size: 1 }, map), to = tokenCenterForAnchorCell(b, { size: 1 }, map)
    const value = mapGeometryMovementBlocked({ map, geometry, token: { ...token, size: 1, ...from }, to }).blocked
    edgeCache.set(key, value)
    return value
  }
  const neighbours = (cell: typeof start) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => ({ col: cell.col + dc, row: cell.row + dr }))
  const seen = new Set([cellKey(start)]), queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]
    if (cell.col <= 0 || cell.row <= 0 || cell.col >= columns - 1 || cell.row >= rows - 1 || seen.size > 20_000) return new Set()
    for (const next of neighbours(cell)) {
      if (seen.has(cellKey(next)) || walls.has(cellKey(next)) || blocked(cell, next)) continue
      seen.add(cellKey(next)); queue.push(next)
    }
  }
  const beforeSeen = new Set(seen), throughWalls: typeof start[] = []
  for (const cell of queue) for (const next of neighbours(cell)) {
    if (!beforeSeen.has(cellKey(next)) && !blocked(cell, next)) { beforeSeen.add(cellKey(next)); throughWalls.push(next) }
  }
  for (let i = 0; i < throughWalls.length; i++) {
    const cell = throughWalls[i]
    if (!walls.has(cellKey(cell))) return seen
    for (const next of neighbours(cell)) {
      if (beforeSeen.has(cellKey(next)) || blocked(cell, next)) continue
      beforeSeen.add(cellKey(next)); throughWalls.push(next)
    }
  }
  return new Set()
}

/** Reaction movement occurs while this particular wall is still forming.
 * Existing walls/doors and other stone walls remain solid. */
export function stoneWallEscapeDestinations(map: BattleMap, area: Dnd5ePluginArea, token: Token, speed: number) {
  if (!area.stoneWall || speed <= 0) return []
  const geometry = mapGeometryRuntimeForMap(map.id)
  const beforeMap = { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(a => a.id !== area.id) }
  const terrain = new Map(collectMapDifficultTerrainCells({ map: beforeMap, geometry }).map(c => [cellKey(c), c.multiplier]))
  const start = tokenAnchorCellFromPixel(token.x, token.y, token, map)
  const walls = new Set(area.cells.map(cellKey))
  const enclosed = stoneWallEnclosure(beforeMap, area.stoneWall.panels, token)
  const occupied = new Set(map.tokens.filter(t => t.id !== token.id && t.type !== 'obstacle').flatMap(t => tokenOccupiedCellsAt(t, map, t)).map(cellKey))
  const columns = Math.floor((map.width - map.gridOffsetX) / map.gridSize)
  const rows = Math.floor((map.height - map.gridOffsetY) / map.gridSize)
  const queue = [{ cell: start, cost: 0 }], costs = new Map([[cellKey(start), 0]])
  const destinations: typeof start[] = []
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]
    const from = tokenCenterForAnchorCell(current.cell, token, map)
    const footprint = tokenOccupiedCellsAt(token, map, from)
    if (current.cost > 0 && footprint.every(c => !walls.has(cellKey(c)) && !enclosed.has(cellKey(c)))) destinations.push(current.cell)
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const cell = { col: current.cell.col + dc, row: current.cell.row + dr }
      const to = tokenCenterForAnchorCell(cell, token, map)
      const nextFootprint = tokenOccupiedCellsAt(token, map, to)
      if (nextFootprint.some(c => c.col < 0 || c.row < 0 || c.col >= columns || c.row >= rows || occupied.has(cellKey(c)))) continue
      if (mapGeometryMovementBlocked({ geometry, map: beforeMap, token: { ...token, ...from }, to }).blocked) continue
      const multiplier = Math.max(1, ...nextFootprint.map(c => terrain.get(cellKey(c)) ?? 1))
      const cost = current.cost + (map.feetPerCell ?? 5) * multiplier
      if (cost > speed || (costs.get(cellKey(cell)) ?? Infinity) <= cost) continue
      costs.set(cellKey(cell), cost)
      queue.push({ cell, cost })
    }
  }
  return destinations
}

export function resolveStoneWallEscape(input: {
  map: BattleMap; areaId: string; tokenId: string; to: { col: number; row: number }
  round: number; activeTokenId?: string; speed: number; reactionAvailable: boolean
}): BattleMap | undefined {
  const { map } = input
  const area = map.dnd5ePluginAreas?.find(a => a.id === input.areaId)
  const token = map.tokens.find(t => t.id === input.tokenId)
  const escape = area?.stoneWall?.escapes?.find(e => e.tokenId === input.tokenId)
  if (!area?.stoneWall || !token || escape?.status !== 'ready' || !input.reactionAvailable ||
    area.createdRound !== input.round || (input.activeTokenId && input.activeTokenId !== area.sourceTokenId) ||
    cellKey(tokenAnchorCellFromPixel(token.x, token.y, token, map)) !== cellKey(escape.origin) ||
    !stoneWallEscapeDestinations(map, area, token, input.speed).some(c => cellKey(c) === cellKey(input.to))) return undefined
  const to = tokenCenterForAnchorCell(input.to, token, map)
  return { ...map, tokens: map.tokens.map(t => t.id === token.id ? { ...t, ...to } : t),
    dnd5ePluginAreas: map.dnd5ePluginAreas?.map(a => a.id === area.id ? { ...a, stoneWall: { ...area.stoneWall!,
      escapes: area.stoneWall!.escapes?.map(e => e.tokenId === token.id ? { ...e, status: 'done' as const } : e) } } : a) }
}
