import type { BattleMap, Token } from '../store/maps'
import {
  mapGeometryFootprintTerrainSamples, mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked, type MapGeometryState,
} from './mapGeometry'
import { mapTokenSweepBlocked } from './mapTokenOccupancy'

/** Collision query only. Never store this view or use it for perception/damage. */
export function mapForObjectCreatureTraversal(map: BattleMap, enabled?: boolean): BattleMap {
  if (!enabled) return map
  return {
    ...map,
    tokens: map.tokens.filter(token => token.type !== 'obstacle' || token.obstacleKind === 'marker'),
    dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area => {
      if (area.forceWall || area.forceShell) return true
      return !area.stoneWall && !(area.entityProfile && area.circularGeometry && area.vertical?.mode === 'volume')
    }),
  }
}

/** Physical walls/doors remain opaque in the original geometry. Force structures remain solid. */
export function mapGeometryForObjectCreatureTraversal(
  geometry: MapGeometryState | undefined, enabled?: boolean,
): MapGeometryState | undefined {
  if (!geometry || !enabled) return geometry
  const force = new Set(geometry.structureLifetimes?.filter(record => record.templeWard).flatMap(record => record.entityIds))
  return {
    ...geometry,
    walls: geometry.walls.map(wall => force.has(wall.id) ? wall : { ...wall, blocksMovement: false }),
    doors: geometry.doors.map(door => force.has(door.id) ? door : {
      ...door, blocksMovement: false, state: 'open', openState: 'open',
    }),
    windows: geometry.windows?.map(window => force.has(window.id) ? window : {
      ...window, blocksMovement: false, windowState: 'open',
    }),
    obstacles: geometry.obstacles.map(obstacle => force.has(obstacle.id) ? obstacle : { ...obstacle, blocksMovement: false }),
  }
}

type TraversalProbe = {
  map: BattleMap; geometry?: MapGeometryState; token: Token
  from: { x: number; y: number }; to: { x: number; y: number }
  fromElevationFeet: number; toElevationFeet: number
}

/** A creature is traversable, but it is not an object for the end-of-turn penalty. */
export function mapObjectCreatureTraversalEndsInsideObject(input: {
  map: BattleMap; geometry?: MapGeometryState; token: Token
  at: { x: number; y: number }; elevationFeet: number
}): boolean {
  const projection = { ...input, map: mapForObjectCreatureTraversal(input.map, true),
    geometry: mapGeometryForObjectCreatureTraversal(input.geometry, true) }
  if (mapGeometryPlacementBlocked(projection).blocked) return false
  if (mapGeometryPlacementBlocked(input).blocked) return true
  if (mapGeometryFootprintTerrainSamples({ geometry: input.geometry, at: input.at,
    halfSizePixels: Math.max(1, input.token.size) * input.map.gridSize / 2 })
    .some(surface => input.elevationFeet < surface.elevationFeet - 1e-7)) return true
  return mapTokenSweepBlocked({ map: { ...input.map, tokens: input.map.tokens.filter(token => token.type === 'obstacle') },
    geometry: input.geometry, mover: input.token, from: input.at, to: input.at,
    fromElevationFeet: input.elevationFeet, toElevationFeet: input.elevationFeet })
}

/** Charges the actual body sweep, including thin walls between empty endpoint cells. */
export function mapObjectCreatureTraversalStepIsDifficult(input: TraversalProbe): boolean {
  return mapGeometryMovementBlocked({ map: input.map, geometry: input.geometry,
    token: { ...input.token, ...input.from }, to: input.to,
    fromElevationFeet: input.fromElevationFeet, toElevationFeet: input.toElevationFeet }).blocked ||
    mapObjectCreatureTraversalEndsInsideObject({ ...input, at: input.from, elevationFeet: input.fromElevationFeet }) ||
    mapObjectCreatureTraversalEndsInsideObject({ ...input, at: input.to, elevationFeet: input.toElevationFeet }) ||
    mapTokenSweepBlocked({ ...input, mover: input.token })
}
