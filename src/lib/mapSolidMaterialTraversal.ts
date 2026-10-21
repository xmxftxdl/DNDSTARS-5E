import { mapGeometryPlacementBlocked, mapGeometryTerrainElevationAtPoint, mapGeometryFootprintTerrainSamples, type MapGeometryState } from './mapGeometry'
import { cellKey, tokenCenterForAnchorCell, tokenOccupiedCellsAt } from './gridCombat'
import { createMapTokenOccupancy } from './mapTokenOccupancy'
import type { BattleMap, Token } from '../store/maps'

export type MapTraversableSolidMaterial = 'earth' | 'stone'

/** Collision-only map view. Never persist this projection or use it for damage/vision. */
export function mapForSolidMaterialTraversal(map: BattleMap,
  materials: readonly MapTraversableSolidMaterial[] | undefined): BattleMap {
  if (!materials?.length || !map.dnd5ePluginAreas?.length) return map
  return { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas.filter(area => {
    if (area.forceWall || area.forceShell || area.stoneWall?.mode === 'ice') return true
    if (area.stoneWall) return !materials.includes('stone')
    const material = area.entityProfile?.material
    return !(area.circularGeometry && area.vertical?.mode === 'volume' &&
      (material === 'stone' || material === 'earth') && materials.includes(material))
  }) }
}

/** Movement-only projection. Keep vision, terrain elevations and attached doors/windows intact. */
export function mapGeometryForSolidMaterialTraversal(
  geometry: MapGeometryState | undefined,
  materials: readonly MapTraversableSolidMaterial[] | undefined,
): MapGeometryState | undefined {
  if (!geometry || !materials?.length) return geometry
  const permitted = (material: string | undefined) =>
    (material === 'earth' || material === 'stone') && materials.includes(material)
  const forceEntityIds = new Set(geometry.structureLifetimes?.filter(record=>record.templeWard).flatMap(record=>record.entityIds))
  return {
    ...geometry,
    walls: geometry.walls.map(wall => !forceEntityIds.has(wall.id) && permitted(wall.material) ? { ...wall, blocksMovement: false } : wall),
    obstacles: geometry.obstacles.map(obstacle => !forceEntityIds.has(obstacle.id) && permitted(obstacle.surfaceMaterial)
      ? { ...obstacle, blocksMovement: false } : obstacle),
  }
}

/** Destination planner only; the caller must commit displacement and effect termination together. */
export function planSolidMaterialExit(input: {
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  at: { x: number; y: number }
  elevationFeet: number
  materials: readonly MapTraversableSolidMaterial[]
  /** Creatures physically contained by the mover retain their relative position. */
  carriedTokens?: readonly Token[]
}): { ok: true; displaced: boolean; position: { x: number; y: number }; elevationFeet: number } |
  { ok: false; reason: 'blocked-by-other-material' | 'no-free-ejection-space' } {
  const probe = { map: input.map, token: input.token, at: input.at, elevationFeet: input.elevationFeet }
  const terrainAt = (token: Token, at: { x: number; y: number }) =>
    mapGeometryFootprintTerrainSamples({ geometry: input.geometry, at,
      halfSizePixels: Math.max(1, input.map.gridSize * Math.max(1, token.size) / 2) })
  const buried = terrainAt(input.token, input.at).filter(surface => input.elevationFeet < surface.elevationFeet - 1e-7)
  const belowGround = buried.length > 0
  if (buried.some(({ material }) => (material !== 'earth' && material !== 'stone') || !input.materials.includes(material))) {
    return { ok: false, reason: 'blocked-by-other-material' }
  }
  if (!belowGround && !mapGeometryPlacementBlocked({ ...probe, geometry: input.geometry }).blocked) {
    return { ok: true, displaced: false, position: { ...input.at }, elevationFeet: input.elevationFeet }
  }
  if (mapGeometryPlacementBlocked({ ...probe,
    map: mapForSolidMaterialTraversal(input.map, input.materials),
    geometry: mapGeometryForSolidMaterialTraversal(input.geometry, input.materials),
  }).blocked) return { ok: false, reason: 'blocked-by-other-material' }

  return planNearestUnoccupiedExit(input)
}

/** Shared destination search; callers decide whether and why an exit is required. */
export function planNearestUnoccupiedExit(input: {
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  at: { x: number; y: number }
  elevationFeet: number
  carriedTokens?: readonly Token[]
}): { ok: true; displaced: true; position: { x: number; y: number }; elevationFeet: number } |
  { ok: false; reason: 'no-free-ejection-space' } {
  const terrainAt = (token: Token, at: { x: number; y: number }) =>
    mapGeometryFootprintTerrainSamples({ geometry: input.geometry, at,
      halfSizePixels: Math.max(1, input.map.gridSize * Math.max(1, token.size) / 2) })
  const size = Math.max(1, input.map.gridSize), feet = Math.max(1, input.map.feetPerCell ?? 5)
  const columns = Math.ceil(input.map.width / size), rows = Math.ceil(input.map.height / size)
  const carriedIds = new Set(input.carriedTokens?.map(token => token.id))
  const occupancyMap = { ...input.map, tokens: input.map.tokens.filter(token => !carriedIds.has(token.id) && token.id !== input.token.id) }
  const occupiedAt = createMapTokenOccupancy(occupancyMap, input.geometry, input.token)
  const bodyHeight = Math.max(5, input.token.size * 5)
  const boundaryHeights = [input.elevationFeet,
    ...(input.map.dnd5ePluginAreas ?? []).flatMap(area => area.vertical?.mode === 'volume'
      ? [area.vertical.baseElevationFeet + area.vertical.heightFeet, area.vertical.baseElevationFeet - bodyHeight] : []),
    ...[...(input.geometry?.walls ?? []), ...(input.geometry?.doors ?? []),
      ...(input.geometry?.windows ?? []), ...(input.geometry?.obstacles ?? [])]
      .flatMap(entity => [entity.baseHeightFeet + entity.heightFeet, entity.baseHeightFeet - bodyHeight]),
    ...input.map.tokens.filter(token => token.id !== input.token.id).flatMap(token => {
      const base = token.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, token)
      return [base + Math.max(5, token.size * 5), base - bodyHeight]
    }),
  ].filter(Number.isFinite)
  let best: { position: { x: number; y: number }; elevationFeet: number; distance: number; aboveGround: number } | undefined
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const position = tokenCenterForAnchorCell({ col, row }, input.token, input.map)
    const ground = Math.max(...terrainAt(input.token, position).map(surface => surface.elevationFeet))
    for (const elevationFeet of new Set([ground, ...boundaryHeights])) {
      if (elevationFeet < ground || elevationFeet > 10_000) continue
      const distance = Math.max(Math.abs(position.x - input.at.x) / size * feet,
        Math.abs(position.y - input.at.y) / size * feet, Math.abs(elevationFeet - input.elevationFeet))
      // Prefer ground among equally near spaces, then stable row/column order.
      if (best && (distance > best.distance || (distance === best.distance && elevationFeet - ground >= best.aboveGround))) continue
      const cells = tokenOccupiedCellsAt(input.token, input.map, position)
      const occupied = occupiedAt(elevationFeet)
      if (cells.some(cell => cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows ||
        occupied.has(cellKey(cell)))) continue
      if (mapGeometryPlacementBlocked({ map: input.map, geometry: input.geometry, token: input.token,
        at: position, elevationFeet }).blocked) continue
      const carriesFit = (input.carriedTokens ?? []).every(carried => {
        const at = { x: carried.x + position.x - input.at.x, y: carried.y + position.y - input.at.y }
        const height = (carried.elevationFeet ?? input.elevationFeet) + elevationFeet - input.elevationFeet
        const ground = Math.max(...terrainAt(carried, at).map(surface => surface.elevationFeet))
        if (height < ground || height > 10_000) return false
        const occupied = createMapTokenOccupancy(occupancyMap, input.geometry, carried)(height)
        if (tokenOccupiedCellsAt(carried, input.map, at).some(cell => cell.col < 0 || cell.row < 0 ||
          cell.col >= columns || cell.row >= rows || occupied.has(cellKey(cell)))) return false
        return !mapGeometryPlacementBlocked({ map: input.map, geometry: input.geometry, token: carried,
          at, elevationFeet: height }).blocked
      })
      if (!carriesFit) continue
      best = { position, elevationFeet, distance, aboveGround: elevationFeet - ground }
    }
  }
  return best ? { ok: true, displaced: true, position: best.position, elevationFeet: best.elevationFeet }
    : { ok: false, reason: 'no-free-ejection-space' }
}
