import type {BattleMap} from '../../store/maps'
import {mapGeometryEntityBodyHeightFeet,mapGeometryFootprintTerrainSamples,mapGeometryPointInPolygon,mapGeometryTerrainElevationAtPoint,mapGeometryTokenElevation,type MapGeometryPoint,type MapGeometryState} from '../../lib/mapGeometry'
import {segmentIntersectionParameter} from '../../../shared/map-geometry-kernel.mjs'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'

/** The temple requires an empty volume; it does not inherit the fortress's natural-object exemptions.
 * Range, visibility, casting time and material authority remain responsibilities of the cast boundary.
 */
export function validateDnd5eTempleSite(input:{map:BattleMap;geometry:MapGeometryState;origin:MapGeometryPoint;
 rotationDegrees:number;elevationFeet:number;widthFeet:number;depthFeet:number;heightFeet:number}){
 const {map,geometry,origin,widthFeet,depthFeet,heightFeet,elevationFeet}=input
 const reject=(reason:string)=>({ok:false as const,reason})
 const scale=map.gridSize/(map.feetPerCell??5)
 if(map.id!==geometry.mapId||![origin.x,origin.y,input.rotationDegrees,elevationFeet,scale].every(Number.isFinite)||scale<=0||
  ![widthFeet,depthFeet,heightFeet].every(n=>Number.isFinite(n)&&n>0&&n<=120))return reject('temple-site-invalid')
 if(Math.abs(mapGeometryTerrainElevationAtPoint(geometry,origin)-elevationFeet)>1e-6)return reject('temple-site-ground-required')
 const angle=input.rotationDegrees*Math.PI/180
 const corners=[[0,0],[widthFeet,0],[widthFeet,depthFeet],[0,depthFeet]].map(([x,y])=>({
  x:origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,y:origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale}))
 if(corners.some(p=>p.x<0||p.y<0||p.x>map.width||p.y>map.height))return reject('temple-site-outside-map')
 // An unoccupied volume cannot intersect raised ground elsewhere in the footprint.
 // Exact terrain partitions preserve small patches and later-painted overrides.
 if(mapGeometryFootprintTerrainSamples({geometry,at:origin,halfSizePixels:Math.max(widthFeet,depthFeet)*scale/2,footprint:corners})
  .some(sample=>sample.elevationFeet>elevationFeet+1e-7))return reject('temple-site-occupied')
 const overlaps=(points:readonly MapGeometryPoint[])=>{
  if(points.some(p=>mapGeometryPointInPolygon(p,corners)))return true
  if(points.length>=3&&corners.some(p=>mapGeometryPointInPolygon(p,points)))return true
  for(let i=0;i<(points.length===2?1:points.length);i++)for(let j=0;j<4;j++)
   if(segmentIntersectionParameter(points[i],points[(i+1)%points.length],corners[j],corners[(j+1)%4])!=null)return true
  return false
 }
 const verticalOverlap=(bottom:number,top:number)=>bottom<elevationFeet+heightFeet-1e-7&&top>elevationFeet+1e-7
 for(const entity of [...geometry.walls,...geometry.doors,...geometry.windows??[],...geometry.obstacles]){
  if(geometryEntityDestroyed(entity))continue
  const bottom=entity.baseHeightFeet,top=bottom+entity.heightFeet
  if(verticalOverlap(bottom,top)&&overlaps(entity.points))return reject('temple-site-occupied')
 }
 for(const token of map.tokens){
  // Spell markers are not physical occupants. Corpses and ordinary objects still occupy space.
  if(token.dnd5eSpellEffect)continue
  const bottom=mapGeometryTokenElevation(geometry,token),top=bottom+(mapGeometryEntityBodyHeightFeet(token)??5)
  if(!verticalOverlap(bottom,top))continue
  const half=map.gridSize*token.size/2
  if(overlaps([{x:token.x-half,y:token.y-half},{x:token.x+half,y:token.y-half},
   {x:token.x+half,y:token.y+half},{x:token.x-half,y:token.y+half}]))return reject('temple-site-occupied')
 }
 return {ok:true as const,corners,siteKey:JSON.stringify([corners.map(p=>[Math.round(p.x*1e6)/1e6,Math.round(p.y*1e6)/1e6]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),elevationFeet])}
}
