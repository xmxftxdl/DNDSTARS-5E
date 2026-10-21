import type {MapGeometryState} from '../../lib/mapGeometry'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'

/** UI choices come from surviving owned surfaces; the Host still requires a walkable route. */
export function dnd5eFortressMovementLevels(geometry:MapGeometryState,structureId:string,currentHeight:number){
 const record=geometry.structureLifetimes?.find(record=>record.id===structureId)
 if(!record?.objectBoundary)return []
 const levels=new Map<number,Set<string>>()
 const add=(height:number,label:string)=>{
  if(!Number.isFinite(height))return
  const key=Math.round(height*1000000)/1000000,labels=levels.get(key)??new Set<string>()
  labels.add(label);levels.set(key,labels)
 }
 add(record.objectBoundary.bottomFeet,'地面')
 add(currentHeight,'当前位置')
 const owned=new Set(record.entityIds)
 for(const entity of geometry.obstacles){
  if(!owned.has(entity.id)||geometryEntityDestroyed(entity))continue
  if(entity.id.startsWith(`${structureId}:floor:`)){
   const label=entity.label==='keep-level-2'?'主楼二层':entity.label==='keep-level-3'?'主楼三层':entity.label==='keep-roof'?'主楼屋顶':'塔楼屋顶'
   add(entity.baseHeightFeet+entity.heightFeet,label)
  }
  for(const point of entity.stairPath?.points??[])add(point.elevationFeet,'楼梯')
 }
 return [...levels.entries()].sort(([a],[b])=>a-b).map(([elevationFeet,labels])=>({elevationFeet,label:[...labels].join(' / ')}))
}
