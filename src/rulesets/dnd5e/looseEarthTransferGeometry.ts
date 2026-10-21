import type { MapGeometryObstacle, MapGeometryPoint, MapGeometryState } from '../../lib/mapGeometry'
import { normalizeMapGeometry, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { partitionByConvexPolygon } from '../../lib/convexPolygonPartition'
import { triangulateSimplePolygon } from '../../lib/triangulateSimplePolygon'
import { looseEarthTravelPartitions } from './looseEarthTravelOrigins'
import { geometryEntityDestroyed } from '../../../shared/map-geometry-durability.mjs'

/** Geometry construction only. The casting transaction must validate range, path,
 * occupants and the authored material volume before publishing this candidate. */
export function buildLooseEarthTransferGeometry(input: {
  geometry: MapGeometryState
  sourceVolumeId: string
  translation: MapGeometryPoint
  pixelsPerFoot: number
  maximumSideFeet: number
  maximumDisplacementFeet: number
  destinationGroundFeet: number
  followDestinationTerrain?: true
  executionId: string
  now: number
}): MapGeometryState | undefined {
  const source = input.geometry.obstacles.find(region => region.id === input.sourceVolumeId)
  if (!source || source.surfaceMaterial !== 'loose-earth' || source.heightFeet <= 0 ||
    !Number.isFinite(source.heightFeet) || !Number.isFinite(source.baseHeightFeet) ||
    ![input.translation.x, input.translation.y, input.destinationGroundFeet, input.now,
      input.pixelsPerFoot, input.maximumSideFeet, input.maximumDisplacementFeet].every(Number.isFinite) ||
    input.pixelsPerFoot <= 0 || input.maximumSideFeet <= 0 || input.maximumDisplacementFeet <= 0 ||
    !input.executionId || source.points.length < 3 ||
    source.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)) ||
    source.terrainElevationFeet !== source.baseHeightFeet + source.heightFeet) return undefined
  if (source.heightFeet > input.maximumSideFeet ||
    Math.hypot(input.translation.x, input.translation.y) / input.pixelsPerFoot > input.maximumDisplacementFeet + 1e-7 ||
    Math.hypot(input.translation.x, input.translation.y) < 1e-7) return undefined
  // Test edge-aligned bounding squares too, so a rotated legal cube is not
  // rejected merely because its map-axis bounding box is wider.
  const fits = source.points.some((point, index) => {
    const next = source.points[(index + 1) % source.points.length]
    const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy)
    if (length < 1e-7) return false
    const xs = source.points.map(p => (p.x * dx + p.y * dy) / length)
    const ys = source.points.map(p => (-p.x * dy + p.y * dx) / length)
    const maximum = input.maximumSideFeet * input.pixelsPerFoot + 1e-7
    return Math.max(...xs) - Math.min(...xs) <= maximum && Math.max(...ys) - Math.min(...ys) <= maximum
  })
  const signedArea = source.points.reduce((sum, point, index) => {
    const next = source.points[(index + 1) % source.points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0)
  if (!fits || Math.abs(signedArea) < 1e-7) return undefined
  const pitId = `${input.executionId}:excavation`, pileId = `${input.executionId}:deposit`
  if (input.geometry.obstacles.some(region => region.id === pitId || region.id === pileId)) return undefined
  // Do not inherit enchantments, durability, movement costs or other semantics
  // from the source volume onto either new surface.
  const surface = (id: string, label: string, points: MapGeometryPoint[], elevation: number): MapGeometryObstacle => ({
    id, kind: 'obstacle', label, points, terrainRegion: true,
    terrainElevationFeet: elevation, traversal: 'ground',
    baseHeightFeet: elevation, heightFeet: 0, cover: 'none',
    blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, createdAt: input.now,
  })
  const pit = surface(pitId, '挖掘后的地面', source.points.map(point => ({ ...point })), source.baseHeightFeet)
  const destination = source.points.map(point => ({
    x: point.x + input.translation.x, y: point.y + input.translation.y,
  }))
  const partition = partitionByConvexPolygon(destination, source.points)
  let regions: {points: MapGeometryPoint[]; base: number; withinExcavation?: true}[]
  if(partition) regions = [...partition.outside.map(points => ({points,base:input.destinationGroundFeet})),
    ...(partition.inside.length ? [{points:partition.inside,base:source.baseHeightFeet,withinExcavation:true as const}] : [])]
  else {
    const sourcePieces=triangulateSimplePolygon(source.points),destinationPieces=triangulateSimplePolygon(destination)
    if(!sourcePieces||!destinationPieces)return undefined
    regions=[]
    let outside=destinationPieces
    for(const clip of sourcePieces){
      const next:MapGeometryPoint[][]=[]
      for(const points of outside){
        const part=partitionByConvexPolygon(points,clip)
        if(!part)return undefined
        if(part.inside.length)regions.push({points:part.inside,base:source.baseHeightFeet,withinExcavation:true})
        next.push(...part.outside)
      }
      outside=next
    }
    regions.push(...outside.map(points=>({points,base:input.destinationGroundFeet})))
  }
  if(input.followDestinationTerrain){
    const terrain=input.geometry.obstacles.filter(region=>region.terrainElevationFeet!=null&&!geometryEntityDestroyed(region)).map(region=>region.points)
    regions=regions.flatMap(region=>region.withinExcavation?[region]:
      looseEarthTravelPartitions(region.points,terrain,{x:0,y:0}).map(part=>({points:part.points,
        base:mapGeometryTerrainElevationAtPoint(input.geometry,part.origin)})))
  }
  const piles = regions.map(({points,base},index)=>{
    const pile=surface(index===0?pileId:`${pileId}:${index}`, '搬移的松土', points, base+source.heightFeet)
    pile.baseHeightFeet=base;pile.heightFeet=source.heightFeet;pile.surfaceMaterial='loose-earth'
    return pile
  })
  const candidate = { ...input.geometry, obstacles: [
    ...input.geometry.obstacles.filter(region => region.id !== source.id), pit, ...piles,
  ] }
  // Reject candidates that the authority store cannot preserve before any
  // caller commits action economy or other character resources.
  return normalizeMapGeometry(candidate) ?? undefined
}
