import { cellToPixel, pixelToCell } from '../../lib/gridCombat'
import { groveCellVisionSegments } from '../../../shared/grove-volume.mjs'
import { mapGeometryPointInPolygon, mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { planDnd5eDruidGroveGround, type Dnd5eDruidGrovePlacement } from './druidGrovePlacement'

/** These classifications must be collected by the Host, never inferred from labels. */
export interface Dnd5eDruidGroveMapQualifications {
  structureObstacleIds: readonly string[]
  treeTokenIds: readonly string[]
}

export function prepareDnd5eDruidGroveMapPlacement(input: {
  map: BattleMap
  geometry: MapGeometryState
  placement: Dnd5eDruidGrovePlacement
  baseElevationFeet: number
  qualifications: Dnd5eDruidGroveMapQualifications
}) {
  const { map, geometry, placement, qualifications, baseElevationFeet } = input
  const reject = (reason: string) => ({ ok: false as const, reason })
  if (geometry.mapId !== map.id || (map.feetPerCell ?? 5) !== 5 || !Number.isFinite(map.gridSize) || map.gridSize <= 0) return reject('invalid-map')
  if (!Number.isFinite(baseElevationFeet) || baseElevationFeet < -1_000 || baseElevationFeet > 10_000) return reject('invalid-elevation')
  if (geometry.environment !== 'outdoors' && geometry.environment !== 'underground') return reject('invalid-environment')
  const unique = (ids: readonly string[]) => new Set(ids).size === ids.length
  if (!unique(qualifications.structureObstacleIds) || !unique(qualifications.treeTokenIds)) return reject('invalid-qualifications')
  const structures = qualifications.structureObstacleIds.map(id => geometry.obstacles.filter(obstacle => obstacle.id === id))
  if (structures.some(matches => matches.length !== 1 || matches[0].terrainRegion || matches[0].points.length < 3 || matches[0].heightFeet <= 0)) return reject('invalid-structure')
  const trees = qualifications.treeTokenIds.map(id => map.tokens.filter(token => token.id === id))
  if (trees.some(matches => matches.length !== 1 || matches[0].type !== 'obstacle' ||
    normalizeDnd5eMapObjectStateV1(matches[0].dnd5eObjectState)?.vegetation !== 'living')) return reject('invalid-tree')
  const origin = cellToPixel(placement.origin, map)
  const minX = origin.x - map.gridSize / 2, minY = origin.y - map.gridSize / 2
  const width = placement.sideFeet / 5 * map.gridSize
  if (minX < 0 || minY < 0 || minX + width > map.width || minY + width > map.height) return reject('outside-map')
  const excludedStructures = structures.map(([obstacle]) => ({ points: obstacle.points.map(point => ({ ...point })),
    baseElevationFeet: obstacle.baseHeightFeet, heightFeet: obstacle.heightFeet }))
  const volume = { minX, minY, widthPixels: width, baseElevationFeet, heightFeet: placement.sideFeet, excludedStructures }
  const containsPoint = (point: { x: number; y: number; elevationFeet: number }) =>
    Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.elevationFeet) &&
    point.x >= minX && point.x < minX + width && point.y >= minY && point.y < minY + width &&
    point.elevationFeet >= baseElevationFeet && point.elevationFeet < baseElevationFeet + placement.sideFeet &&
    !excludedStructures.some(solid => point.elevationFeet >= solid.baseElevationFeet &&
      point.elevationFeet < solid.baseElevationFeet + solid.heightFeet && mapGeometryPointInPolygon(point, solid.points))
  const cells = [], structureCells = []
  if (!Number.isInteger(placement.sideFeet / 5) || placement.sideFeet < 30 || placement.sideFeet > 90) return reject('invalid-volume')
  for (let row = placement.origin.row; row < placement.origin.row + placement.sideFeet / 5; row++) {
    for (let col = placement.origin.col; col < placement.origin.col + placement.sideFeet / 5; col++) {
      const cell = { col, row }, point = cellToPixel(cell, map), elevationFeet = mapGeometryTerrainElevationAtPoint(geometry, point)
      if (elevationFeet < baseElevationFeet || elevationFeet >= baseElevationFeet + placement.sideFeet) continue
      cells.push(cell)
      // A grid cell can contain both indoor and outdoor ground. Retain its
      // outdoor portion; the saved volume clips actual effects at use time.
      if (!containsPoint({ ...point, elevationFeet }) && !groveCellVisionSegments(volume,
        { x: point.x - map.gridSize / 2, y: point.y - map.gridSize / 2, size: map.gridSize },
        elevationFeet, Math.min(1e-4, baseElevationFeet + placement.sideFeet - elevationFeet)).length) structureCells.push(cell)
    }
  }
  const ground = planDnd5eDruidGroveGround(placement, { environment: geometry.environment, cells, structureCells,
    trees: trees.flatMap(([token]) => {
      const elevationFeet = token.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, token)
      return containsPoint({ ...token, elevationFeet }) ? [{ tokenId: token.id, cell: pixelToCell(token.x, token.y, map) }] : []
    }) })
  if (!ground.ok) return ground
  return { ...ground, volume, containsPoint }
}
