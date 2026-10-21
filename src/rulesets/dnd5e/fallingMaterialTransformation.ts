import {clipAbovePlane,normalizeHeightPlane,planeHeight,type HeightPlane} from '../../lib/heightPlane'
import {normalizeMapGeometry,mapGeometryObstacleIsGroundSurfaceOverlay,type MapGeometryPoint,type MapGeometryState} from '../../lib/mapGeometry'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {triangulateSimplePolygon} from '../../lib/triangulateSimplePolygon'
import {prepareMaterialVolumeTransformation,normalizeMaterialVolumeTransformationReceipt,type MaterialVolumeTransformationReceipt} from './materialVolumeTransformation'

type LandingZone={points:MapGeometryPoint[];plane:HeightPlane}
const flat=(offset:number):HeightPlane=>({xSlope:0,ySlope:0,offset})
export interface MaterialFallVolume {points:MapGeometryPoint[];bottomFeet:number;topFeet:number;bottomPlane?:HeightPlane}
export function normalizeMaterialFallVolumes(value:unknown):MaterialFallVolume[]|undefined{
 if(!Array.isArray(value)||!value.length||value.length>4096)return undefined
 const result:MaterialFallVolume[]=[]
 for(const item of value){
  if(!item||typeof item!=='object'||!Number.isFinite(item.bottomFeet)||!Number.isFinite(item.topFeet)||
   item.bottomFeet< -1000||item.topFeet>10000||item.topFeet<=item.bottomFeet||!Array.isArray(item.points)||item.points.length<3||item.points.length>128||
   item.points.some((p:MapGeometryPoint)=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))||!triangulateSimplePolygon(item.points))return undefined
  const bottomPlane=item.bottomPlane==null?undefined:normalizeHeightPlane(item.bottomPlane)
  if(item.bottomPlane!=null&&(!bottomPlane||item.points.some((p:MapGeometryPoint)=>planeHeight(bottomPlane,p)<item.bottomFeet-1e-6||planeHeight(bottomPlane,p)>=item.topFeet)))return undefined
  result.push({bottomFeet:item.bottomFeet,topFeet:item.topFeet,points:item.points.map((p:MapGeometryPoint)=>({x:p.x,y:p.y})),...(bottomPlane?{bottomPlane}:{})})
 }
 return result
}

/** Resolve the whole footprint, including small platforms missed by point samples.
 * Painted terrain follows map ordering; solid obstacles then intercept falling mud. */
function landingZones(geometry:MapGeometryState,points:MapGeometryPoint[],ceiling:number,excluded:Set<string>,scale:number):LandingZone[]|undefined{
 let zones:LandingZone[]=[{points,plane:flat(0)}]
 const bodies=geometry.obstacles.filter(o=>!excluded.has(o.id)&&!geometryEntityDestroyed(o))
 const surfaces:{points:MapGeometryPoint[];plane:HeightPlane;solid:boolean}[]=[
  ...bodies.filter(o=>!o.stairPath&&o.terrainElevationFeet!=null&&!mapGeometryObstacleIsGroundSurfaceOverlay(o)&&!(o.heightFeet>0&&o.baseHeightFeet>=ceiling-1e-7)).map(o=>({points:o.points,plane:flat(o.terrainElevationFeet!),solid:false})),
  ...bodies.filter(o=>!o.stairPath&&o.blocksMovement&&o.heightFeet>0&&o.baseHeightFeet<ceiling-1e-7).map(o=>({points:o.points,plane:flat(o.baseHeightFeet+o.heightFeet),solid:true})),
 ]
 for(const body of bodies){
  if(!body.blocksMovement||!body.stairPath)continue
  const path=body.stairPath
  for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
   if(Math.min(a.elevationFeet,b.elevationFeet)-(path.thicknessInches??0)/12>=ceiling-1e-7)continue
   const rise=b.elevationFeet-a.elevationFeet,xSlope=rise*dx/(length*length),ySlope=rise*dy/(length*length)
   const half=path.widthFeet*scale/2,ox=-dy/length*half,oy=dx/length*half
   surfaces.push({points:[{x:a.x+ox,y:a.y+oy},{x:b.x+ox,y:b.y+oy},{x:b.x-ox,y:b.y-oy},{x:a.x-ox,y:a.y-oy}],
    plane:{xSlope,ySlope,offset:a.elevationFeet-xSlope*a.x-ySlope*a.y},solid:true})
  }
 }
 for(const surface of surfaces){
  if(!overlaps(surface.points,points))continue
  const triangles=triangulateSimplePolygon(surface.points)
  if(!triangles)return undefined
  for(const triangle of triangles){
   const next:LandingZone[]=[]
   for(const zone of zones){
    const partition=partitionByConvexPolygon(zone.points,triangle)
    if(!partition)return undefined
    next.push(...partition.outside.map(points=>({points,plane:zone.plane})))
    if(partition.inside.length){
     if(!surface.solid)next.push({points:partition.inside,plane:surface.plane})
     else{
      const heights=partition.inside.map(p=>planeHeight(surface.plane,p)-planeHeight(zone.plane,p))
      if(heights.every(h=>h>=-1e-8))next.push({points:partition.inside,plane:surface.plane})
      else if(heights.every(h=>h<=1e-8))next.push({points:partition.inside,plane:zone.plane})
      else{
       const higher=clipAbovePlane(partition.inside,surface.plane,zone.plane),lower=clipAbovePlane(partition.inside,zone.plane,surface.plane)
       if(higher.length)next.push({points:higher,plane:surface.plane})
       if(lower.length)next.push({points:lower,plane:zone.plane})
      }
     }
    }
   }
   zones=next
   if(zones.length>2048)return undefined
  }
 }
 return zones
}

/** Host-owned geometry supplies landing heights. No player-selected landing plane. */
export function prepareHostFallingMaterialTransformation(input:Omit<Parameters<typeof prepareMaterialVolumeTransformation>[0],'mode'>){
 const converted=prepareMaterialVolumeTransformation({...input,mode:'rock-to-mud'})
 if(!converted)return undefined
 const moving=new Set(converted.receipt.replacements.flatMap(r=>r.fragments.filter(f=>f.surfaceMaterial==='mud'&&f.materialMagic==='magical').map(f=>f.id)))
 const occupied=new Set([...converted.geometry.obstacles,...converted.geometry.walls,...converted.geometry.doors,...converted.geometry.windows??[],...converted.geometry.lights??[]].map(o=>o.id))
 const receipt=structuredClone(converted.receipt)
 const falls:MaterialFallVolume[]=[]
 const replacements=new Map<string,typeof converted.geometry.obstacles>()
 for(const replacement of receipt.replacements){
  const fragments:typeof replacement.fragments=[]
  for(const fragment of replacement.fragments){
   if(!moving.has(fragment.id)){fragments.push(fragment);continue}
   if(Math.abs(fragment.baseHeightFeet-replacement.original.baseHeightFeet)>1e-7)return undefined
   const zones=landingZones(converted.geometry,fragment.points,fragment.baseHeightFeet,moving,input.pixelsPerFoot)
   if(!zones)return undefined
   const fallen:typeof fragments=[]
   for(const [index,zone] of zones.entries()){
    const heights=zone.points.map(p=>planeHeight(zone.plane,p)),bottom=Math.min(...heights),top=Math.max(...heights)
    // Liquid depth is retained for volume accounting, not a solid stacking rule.
    // The printed fall has no minimum clearance equal to the source thickness.
    if(top>=fragment.baseHeightFeet-1e-7)return undefined
    const sloped=Math.abs(zone.plane.xSlope)>1e-10||Math.abs(zone.plane.ySlope)>1e-10
    const id=`${fragment.id}:landing:${index}`
    if(occupied.has(id))return undefined
    occupied.add(id)
    const body={...structuredClone(fragment),id,points:zone.points,baseHeightFeet:bottom,heightFeet:top-bottom+fragment.heightFeet,
     ...(sloped?{materialLayer:{basePlane:{...zone.plane},depthFeet:fragment.heightFeet}}:{})}
    delete body.terrainElevationFeet
    fallen.push(body)
    falls.push({points:zone.points.map(p=>({...p})),bottomFeet:bottom,topFeet:fragment.baseHeightFeet,...(sloped?{bottomPlane:{...zone.plane}}:{})})
   }
   fragments.push(...fallen);replacements.set(fragment.id,fallen)
  }
  replacement.fragments=fragments
 }
 const geometry=normalizeMapGeometry({...converted.geometry,obstacles:converted.geometry.obstacles.flatMap(o=>replacements.get(o.id)??[o])})
 if(!geometry)return undefined
 for(const replacement of receipt.replacements)replacement.fragments=replacement.fragments.map(f=>structuredClone(geometry.obstacles.find(o=>o.id===f.id)!))
 const normalizedReceipt=normalizeMaterialVolumeTransformationReceipt(receipt)
 return normalizedReceipt?{geometry,receipt:normalizedReceipt,falls}:undefined
}

function overlaps(a:readonly MapGeometryPoint[],b:readonly MapGeometryPoint[]):boolean{
 const triangles=triangulateSimplePolygon(a)
 return !triangles||triangles.some(t=>{
  const clipped=partitionByConvexPolygon(t,b)
  return !clipped||Math.abs(polygonSignedArea(clipped.inside))>1e-7
 })
}

/** Ceiling branch: caller supplies a Host-validated landing plane, never a
 * player-authored restore snapshot. Unsupported intervening platforms fail
 * closed until the caller splits their footprints into separate landing zones. */
export function prepareFallingMaterialTransformation(input:Omit<Parameters<typeof prepareMaterialVolumeTransformation>[0],'mode'> & {landingElevationFeet:number}):{
 geometry:MapGeometryState;receipt:MaterialVolumeTransformationReceipt;
 falls:{points:MapGeometryPoint[];bottomFeet:number;topFeet:number}[]
}|undefined{
 if(!Number.isFinite(input.landingElevationFeet)||input.landingElevationFeet< -1000||input.landingElevationFeet>10000)return undefined
 const converted=prepareMaterialVolumeTransformation({...input,mode:'rock-to-mud'})
 if(!converted)return undefined
 const movingIds=new Set(converted.receipt.replacements.flatMap(r=>r.fragments.filter(f=>f.surfaceMaterial==='mud'&&f.materialMagic==='magical').map(f=>f.id)))
 const falls:MaterialFallVolume[]=[]
 for(const replacement of converted.receipt.replacements){
  for(const fragment of replacement.fragments.filter(f=>movingIds.has(f.id))){
   // The exposed underside must turn to mud; unconverted stone beneath it
   // would otherwise keep the converted material from falling.
   if(Math.abs(fragment.baseHeightFeet-replacement.original.baseHeightFeet)>1e-7||
     input.landingElevationFeet>=fragment.baseHeightFeet-1e-7)return undefined
   for(const obstruction of converted.geometry.obstacles){
    if(obstruction.blocksMovement&&obstruction.stairPath&&!geometryEntityDestroyed(obstruction)&&
      Math.min(...obstruction.stairPath.points.map(p=>p.elevationFeet))-(obstruction.stairPath.thicknessInches??0)/12<fragment.baseHeightFeet-1e-7&&
      Math.max(...obstruction.stairPath.points.map(p=>p.elevationFeet))>input.landingElevationFeet+1e-7&&
      overlaps(obstruction.points,fragment.points))return undefined
    if(movingIds.has(obstruction.id)||obstruction.baseHeightFeet>=fragment.baseHeightFeet-1e-7||
      obstruction.baseHeightFeet+obstruction.heightFeet<=input.landingElevationFeet+1e-7)continue
    if(overlaps(obstruction.points,fragment.points))return undefined
   }
   falls.push({points:fragment.points.map(p=>({...p})),bottomFeet:input.landingElevationFeet,topFeet:fragment.baseHeightFeet})
  }
 }
 const geometry=normalizeMapGeometry({...converted.geometry,obstacles:converted.geometry.obstacles.map(obstacle=>{
  if(!movingIds.has(obstacle.id))return obstacle
  const fallen={...obstacle,baseHeightFeet:input.landingElevationFeet}
  // Falling liquid is not a solid standing platform.
  delete fallen.terrainElevationFeet
  return fallen
 })})
 if(!geometry)return undefined
 const receipt=structuredClone(converted.receipt)
 for(const replacement of receipt.replacements)replacement.fragments=replacement.fragments.map(fragment=>structuredClone(geometry.obstacles.find(o=>o.id===fragment.id)!))
 return {geometry,receipt,falls}
}
