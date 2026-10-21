import type { MapGeometryObstacle, MapGeometryPoint, MapGeometryState } from '../../lib/mapGeometry'
import { partitionByConvexPolygon, polygonSignedArea } from '../../lib/convexPolygonPartition'
import { triangulateSimplePolygon } from '../../lib/triangulateSimplePolygon'
import { convexPolygonSweep } from '../../lib/convexPolygonSweep'
import { joinAdjacentPolygons } from '../../lib/joinAdjacentPolygons'

/** Split an authored soil volume into the selected top section and untouched
 * surrounding/deeper soil. No store mutation occurs while selecting. */
export function selectLooseEarthExcavation(input: {
  geometry: MapGeometryState; source: MapGeometryObstacle; footprint: readonly MapGeometryPoint[]
  maximumDepthFeet: number; executionId: string
}): {geometry:MapGeometryState;source:MapGeometryObstacle} | undefined {
  const {source}=input
  if(source.surfaceMaterial!=='loose-earth'||!Number.isFinite(input.maximumDepthFeet)||input.maximumDepthFeet<=0||
    !Number.isFinite(source.heightFeet)||source.heightFeet<=0||source.terrainElevationFeet!==source.baseHeightFeet+source.heightFeet)return undefined
  const pieces=partitionByConvexPolygon(source.points,source.points)?[source.points]:triangulateSimplePolygon(source.points)
  if(!pieces)return undefined
  const partitions=pieces.map(points=>partitionByConvexPolygon(points,input.footprint))
  if(partitions.some(part=>!part))return undefined
  const insidePieces=partitions.flatMap(part=>part!.inside.length?[part!.inside]:[])
  let inside=convexPolygonSweep(insidePieces.flat(),{x:0,y:0})
  if(Math.abs(Math.abs(polygonSignedArea(inside))-insidePieces.reduce((area,points)=>area+Math.abs(polygonSignedArea(points)),0))>1e-7){
    const remaining=insidePieces.slice(1)
    inside=insidePieces[0]
    while(remaining.length){
      const index=remaining.findIndex(points=>!!joinAdjacentPolygons(inside,points))
      if(index<0)return undefined
      inside=joinAdjacentPolygons(inside,remaining[index])!
      remaining.splice(index,1)
    }
  }
  const partition={inside,outside:partitions.flatMap(part=>part!.outside)}
  if(!partition?.inside.length)return undefined
  const depth=Math.min(input.maximumDepthFeet,source.heightFeet)
  // Preserve the existing identity if no splitting is required.
  if(!partition.outside.length&&depth===source.heightFeet)return {geometry:input.geometry,source}
  const prefix=`${input.executionId}:soil`
  const remaining:MapGeometryObstacle[]=partition.outside.map((points,index)=>({...source,id:`${prefix}:remainder:${index}`,points}))
  if(depth<source.heightFeet)remaining.push({...source,id:`${prefix}:below`,points:partition.inside.map(p=>({...p})),
    heightFeet:source.heightFeet-depth,terrainElevationFeet:source.terrainElevationFeet-depth})
  const selected:MapGeometryObstacle={...source,id:`${prefix}:selected`,points:partition.inside,
    baseHeightFeet:source.terrainElevationFeet-depth,heightFeet:depth}
  if([...remaining,selected].some(candidate=>input.geometry.obstacles.some(region=>region.id===candidate.id)))return undefined
  return {geometry:{...input.geometry,obstacles:input.geometry.obstacles.flatMap(region=>region.id===source.id?[...remaining,selected]:[region])},source:selected}
}
