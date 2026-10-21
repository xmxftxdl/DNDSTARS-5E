import { geometryEntityDestroyed } from '../../../shared/map-geometry-durability.mjs'
import {partitionVerticalMaterialSurfaces,type VerticalSurfaceFragment} from './verticalSurfaceFragments'
import { partitionByConvexPolygon, polygonSignedArea } from '../../lib/convexPolygonPartition'
import { triangulateSimplePolygon } from '../../lib/triangulateSimplePolygon'
import { mapGeometryFootprintTerrainSamples, type MapGeometryPoint, type MapGeometryState, type MapGeometrySurfaceMaterial } from '../../lib/mapGeometry'

export interface VerticalMaterialSurface {
  entityId: string
  edgeIndex: number
  a: MapGeometryPoint
  b: MapGeometryPoint
  outward: MapGeometryPoint
  baseElevationFeet: number
  heightFeet: number
  material: MapGeometrySurfaceMaterial
  attachment?: { centerFraction: number; widthFeet: number; baseOffsetFeet: number }
  fragments?: VerticalSurfaceFragment[]
}

/** Select a bounded, exposed patch on an authored solid's vertical face.
 * Range and caster visibility remain the casting transaction's responsibility. */
export function selectSingleVerticalMaterialSurface(input: {
  geometry: MapGeometryState; entityId: string; edgeIndex: number; centerFraction: number
  widthFeet: number; heightFeet: number; baseElevationFeet: number
  pixelsPerFoot: number; maximumSideFeet: number; materials: readonly MapGeometrySurfaceMaterial[]
}): VerticalMaterialSurface | undefined {
  const {geometry}=input
  const matching=geometry.obstacles.filter(o=>o.id===input.entityId)
  if(matching.length!==1)return undefined
  const solid=matching[0]
  if(geometryEntityDestroyed(solid)||solid.terrainRegion||solid.heightFeet<=0||!solid.surfaceMaterial||!input.materials.includes(solid.surfaceMaterial)||
    !Number.isInteger(input.edgeIndex)||input.edgeIndex<0||input.edgeIndex>=solid.points.length||
    ![input.centerFraction,input.widthFeet,input.heightFeet,input.baseElevationFeet,input.pixelsPerFoot,input.maximumSideFeet,solid.baseHeightFeet,solid.heightFeet].every(Number.isFinite)||
    input.centerFraction<0||input.centerFraction>1||input.pixelsPerFoot<=0||input.maximumSideFeet<=0||
    input.widthFeet<=0||input.widthFeet>input.maximumSideFeet||input.heightFeet<=0||input.heightFeet>input.maximumSideFeet||
    input.baseElevationFeet<solid.baseHeightFeet||input.baseElevationFeet+input.heightFeet>solid.baseHeightFeet+solid.heightFeet||
    !triangulateSimplePolygon(solid.points))return undefined
  const first=solid.points[input.edgeIndex],last=solid.points[(input.edgeIndex+1)%solid.points.length]
  const dx=last.x-first.x,dy=last.y-first.y,length=Math.hypot(dx,dy),width=input.widthFeet*input.pixelsPerFoot
  if(length<1e-7)return undefined
  const start=input.centerFraction*length-width/2,end=start+width
  if(start < -1e-7 || end > length+1e-7)return undefined
  const a={x:first.x+dx*start/length,y:first.y+dy*start/length},b={x:first.x+dx*end/length,y:first.y+dy*end/length}
  const winding=Math.sign(polygonSignedArea(solid.points))
  const outward={x:winding*dy/length || 0,y:-winding*dx/length || 0}
  // A thin exterior strip detects even narrow obstructions on the selected face.
  const epsilon=0.001
  const offset=(p:MapGeometryPoint,n:number)=>({x:p.x+outward.x*n,y:p.y+outward.y*n})
  const strip=[offset(a,epsilon/4),offset(b,epsilon/4),offset(b,epsilon),offset(a,epsilon)]
  const low=input.baseElevationFeet,high=low+input.heightFeet
  const ground=mapGeometryFootprintTerrainSamples({geometry,at:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},halfSizePixels:width/2+epsilon,footprint:strip})
  if(!ground.length||ground.some(sample=>sample.elevationFeet>low+1e-7))return undefined
  for(const obstacle of geometry.obstacles){
    if(geometryEntityDestroyed(obstacle)||obstacle.terrainRegion||obstacle.heightFeet<=0||
      obstacle.baseHeightFeet>=high-1e-7||obstacle.baseHeightFeet+obstacle.heightFeet<=low+1e-7)continue
    const triangles=triangulateSimplePolygon(obstacle.points)
    if(!triangles)return undefined
    if(triangles.some(points=>Math.abs(polygonSignedArea(partitionByConvexPolygon(points,strip)?.inside??[]))>1e-9))return undefined
  }
  return {entityId:solid.id,edgeIndex:input.edgeIndex,a,b,outward,baseElevationFeet:low,heightFeet:input.heightFeet,material:solid.surfaceMaterial,
    attachment:{centerFraction:input.centerFraction,widthFeet:input.widthFeet,baseOffsetFeet:low-solid.baseHeightFeet}}
}

export function selectVerticalMaterialSurface(input:Parameters<typeof selectSingleVerticalMaterialSurface>[0]):VerticalMaterialSurface|undefined{
  const single=selectSingleVerticalMaterialSurface(input)
  if(single)return single
  const fragments=partitionVerticalMaterialSurfaces(input)
  if(!fragments)return undefined
  const solid=input.geometry.obstacles.find(s=>s.id===input.entityId)!
  const a=solid.points[input.edgeIndex],b=solid.points[(input.edgeIndex+1)%solid.points.length]
  const length=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/length,uy=(b.y-a.y)/length
  const start=input.centerFraction*length-input.widthFeet*input.pixelsPerFoot/2
  return {...fragments[0].surface,entityId:input.entityId,edgeIndex:input.edgeIndex,
    a:{x:a.x+ux*start,y:a.y+uy*start},b:{x:a.x+ux*(start+input.widthFeet*input.pixelsPerFoot),y:a.y+uy*(start+input.widthFeet*input.pixelsPerFoot)},
    baseElevationFeet:input.baseElevationFeet,heightFeet:input.heightFeet,attachment:undefined,fragments}
}

/** Reconstructs the same physical patch after its mapped solid moves or rotates. */
export function resolveAttachedVerticalSurface(surface: VerticalMaterialSurface, geometry: MapGeometryState, pixelsPerFoot: number): VerticalMaterialSurface | undefined {
  if(surface.fragments){
    const fragments=surface.fragments.flatMap(part=>{
      const resolved=resolveAttachedVerticalSurface(part.surface,geometry,pixelsPerFoot)
      return resolved?[{...part,surface:resolved}]:[]
    })
    return fragments.length?{...surface,fragments}:undefined
  }
  const attachment=surface.attachment
  if(!attachment)return surface
  const solids=geometry.obstacles.filter(entity=>entity.id===surface.entityId)
  if(solids.length!==1)return undefined
  return selectSingleVerticalMaterialSurface({geometry,entityId:surface.entityId,edgeIndex:surface.edgeIndex,
    centerFraction:attachment.centerFraction,widthFeet:attachment.widthFeet,heightFeet:surface.heightFeet,
    baseElevationFeet:solids[0].baseHeightFeet+attachment.baseOffsetFeet,pixelsPerFoot,
    maximumSideFeet:Math.max(attachment.widthFeet,surface.heightFeet),materials:[surface.material]})
}
