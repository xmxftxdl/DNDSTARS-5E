import type { BattleMap } from '../../store/maps'
import { mapGeometryPointInPolygon, mapGeometrySegmentsIntersect, mapGeometryFootprintTerrainSamples, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, mapGeometryEntityBodyHeightFeet, type MapGeometryPoint, type MapGeometryState } from '../../lib/mapGeometry'
import { buildLooseEarthTransferGeometry } from './looseEarthTransferGeometry'
import { selectLooseEarthExcavation } from './looseEarthExcavation'
import { geometryEntityDestroyed } from '../../../shared/map-geometry-durability.mjs'
import { convexPolygonSweep } from '../../lib/convexPolygonSweep'
import { partitionByConvexPolygon, polygonSignedArea } from '../../lib/convexPolygonPartition'
import { persistentAreaHeightSlices } from '../../../shared/persistent-area-columns.mjs'
import { looseEarthBarrierSegments } from './looseEarthBarrierSegments'
import { coalesceLooseEarth } from './coalesceLooseEarth'
import { triangulateSimplePolygon } from '../../lib/triangulateSimplePolygon'
import { mapGeometryWithObjectSurfaces } from './mapObjectSurfaceGeometry'
import { looseEarthTravelOrigins } from './looseEarthTravelOrigins'

/** Transfers authored soil along unoccupied ground within the displacement budget. */
export function prepareLooseEarthTransfer(input: {
  map: BattleMap; geometry: MapGeometryState; anchor: MapGeometryPoint
  angleDegrees: number; distanceFeet: number; maximumSideFeet: number
  widthFeet?: number; lengthFeet?: number; depthFeet?: number
  maximumDisplacementFeet?: number
  executionId: string; now: number
}): MapGeometryState | undefined {
  const {map}=input
  const geometry=coalesceLooseEarth(input.geometry)
  if(geometry.mapId!==map.id || ![map.gridSize,map.feetPerCell??5,input.angleDegrees,input.distanceFeet,input.maximumSideFeet].every(Number.isFinite) ||
    map.gridSize<=0 || (map.feetPerCell??5)<=0 || input.distanceFeet<=0 || input.maximumSideFeet<=0) return undefined
  const ground=mapGeometryTerrainElevationAtPoint(geometry,input.anchor)
  const volumes=geometry.obstacles.filter(region=>!geometryEntityDestroyed(region) && region.surfaceMaterial==='loose-earth' && region.heightFeet>0 && region.terrainElevationFeet===ground &&
    mapGeometryPointInPolygon(input.anchor,region.points))
  if(volumes.length!==1)return undefined
  const original=volumes[0], scale=map.gridSize/(map.feetPerCell??5), angle=input.angleDegrees*Math.PI/180
  const width=input.widthFeet??input.maximumSideFeet,length=input.lengthFeet??input.maximumSideFeet,depth=input.depthFeet??input.maximumSideFeet
  if([width,length,depth].some(value=>!Number.isFinite(value)||value<=0||value>input.maximumSideFeet))return undefined
  const halfWidth=width*scale/2,halfLength=length*scale/2
  const footprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({
    x:input.anchor.x+halfLength*x*Math.cos(angle)-halfWidth*y*Math.sin(angle),
    y:input.anchor.y+halfLength*x*Math.sin(angle)+halfWidth*y*Math.cos(angle),
  }))
  const excavation=selectLooseEarthExcavation({geometry,source:original,footprint,maximumDepthFeet:depth,executionId:input.executionId})
  if(!excavation)return undefined
  const source=excavation.source
  const exposed=mapGeometryFootprintTerrainSamples({geometry,at:input.anchor,halfSizePixels:input.maximumSideFeet*scale/2,footprint:source.points})
  if(!exposed.length||exposed.some(sample=>sample.material!=='loose-earth'||sample.elevationFeet!==source.terrainElevationFeet))return undefined
  const translation={x:Math.cos(angle)*input.distanceFeet*scale,y:Math.sin(angle)*input.distanceFeet*scale}
  const bounds=(points:readonly MapGeometryPoint[])=>({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))})
  const from=bounds(source.points),to=bounds(source.points.map(p=>({x:p.x+translation.x,y:p.y+translation.y})))
  const sourcePieces=triangulateSimplePolygon(source.points)
  if(!sourcePieces)return undefined
  const sweeps=sourcePieces.map(points=>convexPolygonSweep(points,translation))
  const destination=source.points.map(point=>({x:point.x+translation.x,y:point.y+translation.y}))
  const destinationSamples=mapGeometryFootprintTerrainSamples({geometry,
    at:{x:input.anchor.x+translation.x,y:input.anchor.y+translation.y},
    halfSizePixels:input.maximumSideFeet*scale/2,footprint:destination})
  const destinationGround=destinationSamples[0]?.elevationFeet
  const pathSamples=sweeps.flatMap(footprint=>mapGeometryFootprintTerrainSamples({geometry,
    at:input.anchor,halfSizePixels:input.maximumSideFeet*scale/2,footprint}))
  const lowestGround=Math.min(...pathSamples.map(sample=>sample.elevationFeet))
  const highestGround=Math.max(...pathSamples.map(sample=>sample.elevationFeet))
  const maximumDisplacement=input.maximumDisplacementFeet??input.distanceFeet
  if(!Number.isFinite(destinationGround)||!Number.isFinite(maximumDisplacement)||maximumDisplacement<=0||
    !Number.isFinite(lowestGround)||!Number.isFinite(highestGround)||
    destinationSamples.some(sample=>input.distanceFeet+Math.abs(sample.elevationFeet-ground)>maximumDisplacement+1e-7))return undefined
  // Count every crossed terrain edge: equal endpoint heights must not hide
  // an intermediate climb and descent. Include both sides of each crossing.
  const travelOrigins=looseEarthTravelOrigins(source.points,
    geometry.obstacles.filter(region=>region.terrainElevationFeet!=null&&!geometryEntityDestroyed(region)).map(region=>region.points),translation)
  if(!travelOrigins.length)return undefined
  for(const origin of travelOrigins){
    const crossings=[0,1]
    for(const region of geometry.obstacles)for(let i=0;i<region.points.length;i++){
      const a=region.points[i],b=region.points[(i+1)%region.points.length]
      const sx=b.x-a.x,sy=b.y-a.y,den=translation.x*sy-translation.y*sx
      if(Math.abs(den)<1e-9)continue
      const dx=a.x-origin.x,dy=a.y-origin.y
      const t=(dx*sy-dy*sx)/den,u=(dx*translation.y-dy*translation.x)/den
      if(t>0&&t<1&&u>=0&&u<=1)crossings.push(t)
    }
    const ordered=[...new Set(crossings)].sort((a,b)=>a-b)
    const heights=[ground,...ordered.slice(1).map((end,i)=>{
      const t=(ordered[i]+end)/2
      return mapGeometryTerrainElevationAtPoint(geometry,{x:origin.x+translation.x*t,y:origin.y+translation.y*t})
    }),mapGeometryTerrainElevationAtPoint(geometry,{x:origin.x+translation.x,y:origin.y+translation.y})]
    const climb=heights.slice(1).reduce((sum,height,i)=>sum+Math.abs(height-heights[i]),0)
    if(input.distanceFeet+climb>maximumDisplacement+1e-7)return undefined
  }
  const rectangle=(left:number,top:number,right:number,bottom:number)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}]
  const touches=(points:readonly MapGeometryPoint[])=>sweeps.some(sweep=>Math.abs(polygonSignedArea(partitionByConvexPolygon(points,sweep)?.inside??[]))>1e-7)
  const intersectsHeight=(base:number,height:number,low:number,high:number)=>base<high-1e-7&&base+height>low+1e-7
  const travelHeight=(base:number,height:number)=>intersectsHeight(base,height,
    lowestGround,highestGround+source.heightFeet)
  const travelTouches=(points:readonly MapGeometryPoint[],base:number,height:number)=>{
    if(!travelHeight(base,height))return false
    const pieces=triangulateSimplePolygon(points)
    if(!pieces)return true
    return pieces.some(piece=>sweeps.some(sweep=>{
      const overlap=partitionByConvexPolygon(piece,sweep)?.inside
      if(!overlap?.length)return false
      return mapGeometryFootprintTerrainSamples({geometry,at:input.anchor,
        halfSizePixels:input.maximumSideFeet*scale/2,footprint:overlap})
        .some(sample=>intersectsHeight(base,height,sample.elevationFeet,sample.elevationFeet+source.heightFeet))
    }))
  }
  const travelLineTouches=(points:readonly MapGeometryPoint[],base:number,height:number)=>{
    if(!travelHeight(base,height))return false
    const boundaries=[...sweeps,...geometry.obstacles.filter(region=>region.terrainElevationFeet!=null&&!geometryEntityDestroyed(region)).map(region=>region.points)]
    return points.slice(1).some((b,i)=>{
      const a=points[i],rx=b.x-a.x,ry=b.y-a.y,cuts=new Set([0,1])
      for(const polygon of boundaries)for(let j=0;j<polygon.length;j++){
        const c=polygon[j],d=polygon[(j+1)%polygon.length],sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx
        if(Math.abs(den)<1e-9)continue
        const dx=c.x-a.x,dy=c.y-a.y,t=(dx*sy-dy*sx)/den,u=(dx*ry-dy*rx)/den
        if(t>0&&t<1&&u>=0&&u<=1)cuts.add(t)
      }
      const ordered=[...cuts].sort((a,b)=>a-b)
      return [...ordered,...ordered.slice(1).map((end,j)=>(ordered[j]+end)/2)].some(t=>{
        const point={x:a.x+rx*t,y:a.y+ry*t}
        const elevation=mapGeometryTerrainElevationAtPoint(geometry,point)
        return sweeps.some(sweep=>mapGeometryPointInPolygon(point,sweep))&&
          intersectsHeight(base,height,elevation,elevation+source.heightFeet)
      })
    })
  }
  const excavationHeight=(base:number,height:number)=>intersectsHeight(base,height,source.baseHeightFeet,ground)
  const touchesSource=(points:readonly MapGeometryPoint[])=>sourcePieces.some(clip=>Math.abs(polygonSignedArea(partitionByConvexPolygon(points,clip)?.inside??[]))>1e-7)
  const lineTouches=(points:readonly MapGeometryPoint[],polygon:readonly MapGeometryPoint[])=>points.some(p=>mapGeometryPointInPolygon(p,polygon))||
    points.slice(1).some((b,i)=>polygon.some((a,j)=>mapGeometrySegmentsIntersect(points[i],b,a,polygon[(j+1)%polygon.length])))
  const overlaps=(a:typeof from,b:typeof from)=>a.left<b.right-1e-7&&a.right>b.left+1e-7&&a.top<b.bottom-1e-7&&a.bottom>b.top+1e-7
  const swept={left:Math.min(from.left,to.left),right:Math.max(from.right,to.right),top:Math.min(from.top,to.top),bottom:Math.max(from.bottom,to.bottom)}
  if(swept.left<0||swept.top<0||swept.right>map.width||swept.bottom>map.height)return undefined
  // Reject body intersections rather than silently burying or damaging a token.
  if(map.tokens.some(token=>{
    const half=token.size*map.gridSize/2
    const projected=token.type==='obstacle'&&token.dnd5eObjectState?.surfaceProfile
      ? mapGeometryWithObjectSurfaces({...map,tokens:[token]},geometry) : geometry
    const physical=projected.obstacles.length>geometry.obstacles.length?projected.obstacles.at(-1):undefined
    const points=physical?.points??rectangle(token.x-half,token.y-half,token.x+half,token.y+half)
    const base=physical?.baseHeightFeet??mapGeometryTokenElevation(geometry,token)
    const height=physical?.heightFeet??mapGeometryEntityBodyHeightFeet(token)??5
    return travelTouches(points,base,height)||(excavationHeight(base,height)&&touchesSource(points))
  }))return undefined
  const barriers=[...looseEarthBarrierSegments(geometry).map(segment=>({id:segment.entityId,kind:segment.entityKind,
    points:[segment.a,segment.b],baseHeightFeet:segment.baseHeightFeet,heightFeet:segment.heightFeet,
    blocksMovement:segment.blocksMovement,blocksLineOfEffect:segment.blocksLineOfEffect})),...geometry.obstacles.filter(r=>r.id!==original.id&&!geometryEntityDestroyed(r))]
  if(barriers
    .some(entity=>(entity.blocksMovement||entity.blocksLineOfEffect)&&
      overlaps(swept,{
      left:Math.min(...entity.points.map(p=>p.x))-0.001,right:Math.max(...entity.points.map(p=>p.x))+0.001,
      top:Math.min(...entity.points.map(p=>p.y))-0.001,bottom:Math.max(...entity.points.map(p=>p.y))+0.001,
    })&&((entity.kind==='obstacle'?travelTouches(entity.points,entity.baseHeightFeet,entity.heightFeet):
      travelLineTouches(entity.points,entity.baseHeightFeet,entity.heightFeet))||
      (excavationHeight(entity.baseHeightFeet,entity.heightFeet)&&
        (entity.kind==='obstacle'?touchesSource(entity.points):lineTouches(entity.points,source.points))))))return undefined
  if(map.dnd5ePluginAreas?.some(area=>(area.blocking?.movement||area.blocking?.lineOfEffect) && persistentAreaHeightSlices(area).some(slice=>slice.cells.some(cell=>{
    const x=cell.col*map.gridSize+(map.gridOffsetX??0),y=cell.row*map.gridSize+(map.gridOffsetY??0)
    const points=rectangle(x,y,x+map.gridSize,y+map.gridSize)
    if(slice.vertical?.mode!=='volume')return touches(points)
    const {baseElevationFeet:base,heightFeet:height}=slice.vertical
    return travelTouches(points,base,height)||(excavationHeight(base,height)&&touchesSource(points))
  }))))return undefined
  return buildLooseEarthTransferGeometry({geometry:excavation.geometry,sourceVolumeId:source.id,translation,pixelsPerFoot:scale,
    maximumSideFeet:input.maximumSideFeet,maximumDisplacementFeet:input.distanceFeet,
    destinationGroundFeet:destinationGround,followDestinationTerrain:true,executionId:input.executionId,now:input.now})
}
