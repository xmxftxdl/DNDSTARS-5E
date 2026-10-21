import type {MapGeometryState,MapGeometryObstacle} from '../../lib/mapGeometry'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'
import {mapGeometryTokenElevation} from '../../lib/mapGeometry'
import type {Token} from '../../store/maps'

/** Story filtering is presentation only; authoritative visibility must run first. */
export function fortressFurnitureOnViewedStory(token:Token,geometry:MapGeometryState|undefined,elevationFeet:number):boolean {
 const binding=token.dnd5eObjectState?.structureBinding
 if(!binding||!token.dnd5eObjectState?.inventoryItem||!geometry||binding.mapId!==geometry.mapId)return true
 const record=geometry.structureLifetimes?.find(entry=>entry.id===binding.structureId&&entry.replacementGroup==='mighty-fortress')
 if(!record)return true
 const owned=new Set(record.entityIds)
 const floors=geometry.obstacles.filter(entity=>owned.has(entity.id)&&entity.id.startsWith(record.id+':floor:')&&!geometryEntityDestroyed(entity))
 const base=record.objectBoundary?.bottomFeet??0
 const story=(height:number)=>Math.max(base,...floors.map(entity=>entity.baseHeightFeet+entity.heightFeet).filter(top=>top<=height+0.01))
 return Math.abs(story(mapGeometryTokenElevation(geometry,token))-story(elevationFeet))<0.01
}

export interface FortressVisualPart {entity:MapGeometryObstacle;kind:'wall'|'floor'|'stairs'}
/** Render owned construction at the viewer's story, never ordinary DM collision guides. */
export function fortressVisualParts(geometry:MapGeometryState|undefined,elevationFeet:number,worldMinute:number):FortressVisualPart[]{
 if(!geometry||!Number.isFinite(elevationFeet))return []
 const result:FortressVisualPart[]=[]
 for(const record of geometry.structureLifetimes??[]){
  if(record.replacementGroup!=='mighty-fortress'||worldMinute<record.createdWorldMinute||
   record.expiresWorldMinute!=null&&worldMinute>=record.expiresWorldMinute)continue
  const owned=new Set(record.entityIds)
  const entities=geometry.obstacles.filter(entity=>owned.has(entity.id)&&!geometryEntityDestroyed(entity))
  const floorPrefix=record.id+':floor:'
  const floorTops=entities.filter(entity=>entity.id.startsWith(floorPrefix)).map(entity=>(entity.baseHeightFeet??0)+(entity.heightFeet??0))
  const base=record.objectBoundary?.bottomFeet??0
  const story=Math.max(base,...floorTops.filter(top=>top<=elevationFeet+0.01))
  for(const entity of entities){
   const bottom=entity.baseHeightFeet??0,top=bottom+(entity.heightFeet??0)
   if(entity.id.startsWith(floorPrefix)){
    if(Math.abs(top-story)<0.01)result.push({entity,kind:'floor'})
   }else if(entity.stairPath){
    const heights=entity.stairPath.points.map(point=>point.elevationFeet)
    if(Math.max(...heights)>story&&Math.min(...heights)<story+10)result.push({entity,kind:'stairs'})
   }else if(bottom<=story+5&&top>story+5)result.push({entity,kind:'wall'})
  }
 }
 return result.sort((a,b)=>Number(a.kind!=='floor')-Number(b.kind!=='floor'))
}
