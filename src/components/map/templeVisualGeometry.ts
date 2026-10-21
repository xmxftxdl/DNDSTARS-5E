import type {MapGeometryState,MapGeometryObstacle} from '../../lib/mapGeometry'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'

export interface TempleVisualPart {entity:MapGeometryObstacle;kind:'floor'|'wall'|'roof'}
/** Display actual owned slabs, beneath fog/vision, without exposing ordinary DM guides. */
export function templeVisualParts(geometry:MapGeometryState|undefined,elevationFeet:number,worldMinute:number):TempleVisualPart[]{
 if(!geometry||!Number.isFinite(elevationFeet)||!Number.isFinite(worldMinute))return []
 const parts:TempleVisualPart[]=[]
 for(const record of geometry.structureLifetimes??[]){
  if(record.replacementGroup!=='temple-of-the-gods'||!record.templeWard||!record.objectBoundary||
   worldMinute<record.createdWorldMinute||record.expiresWorldMinute!=null&&worldMinute>=record.expiresWorldMinute)continue
  const owned=new Set(record.entityIds)
  const roofView=elevationFeet>=record.objectBoundary.topFeet-0.01
  const bottom=record.objectBoundary.bottomFeet,top=record.objectBoundary.topFeet
  const eye=Math.min(Math.max(elevationFeet,bottom)+5,top-(top-bottom)/100)
  for(const entity of geometry.obstacles){
   if(!owned.has(entity.id)||geometryEntityDestroyed(entity))continue
   if(entity.id===record.id+':roof'){
    if(roofView)parts.push({entity,kind:'roof'})
   }else if(!roofView&&entity.id===record.id+':floor')parts.push({entity,kind:'floor'})
   else if(!roofView&&entity.baseHeightFeet<=eye&&entity.baseHeightFeet+entity.heightFeet>eye)parts.push({entity,kind:'wall'})
  }
 }
 return parts.sort((a,b)=>Number(a.kind==='wall')-Number(b.kind==='wall'))
}
