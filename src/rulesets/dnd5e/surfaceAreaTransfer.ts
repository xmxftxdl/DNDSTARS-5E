import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {tokenAnchorCellFromPixel} from '../../lib/gridCombat'
import {type MapGeometryState,mapGeometryRuntimeForMap} from '../../lib/mapGeometry'
import {projectAttachedSurfaceArea} from './attachedSurfaceArea'

/** Move the one authoritative effect record; inventory never stores a second spell copy. */
export function transferDroppedObjectSurfaceAreas(maps:readonly BattleMap[],mapId:string,tokenId:string,worldMinute:number,geometry?:MapGeometryState):BattleMap[]{
 const target=maps.find(map=>map.id===mapId),token=target?.tokens.find(token=>token.id===tokenId)
 const identity=token?.dnd5eObjectState?.surfaceProfile?.surfaceId
 if(!target||!token||!identity)return [...maps]
 if(!Number.isSafeInteger(worldMinute)||worldMinute<0)throw Error('surface-transfer-clock-unavailable')
 const matching=maps.flatMap(map=>map.tokens.filter(candidate=>candidate.type==='obstacle'&&
   (candidate.dnd5eObjectState?.surfaceProfile?.surfaceId??candidate.id)===identity))
 if(matching.length!==1)throw Error('surface-transfer-identity-conflict')
 const entityId='surface-object:'+identity
 const attached=(area:Dnd5ePluginArea)=>['surface-inscription','surface-color','surface-drawing'].includes(area.visual?.preset??'')&&
   (area.visual?.horizontalSurface?.entityId??area.visual?.verticalSurface?.entityId)===entityId
 const records=maps.flatMap(map=>(map.dnd5ePluginAreas??[]).filter(attached))
 if(!records.length)return [...maps]
 const ids=new Set(records.map(area=>area.id))
 if(ids.size!==records.length||maps.some(map=>(map.dnd5ePluginAreas??[]).some(area=>ids.has(area.id)&&!attached(area))))throw Error('surface-transfer-area-conflict')
 const anchorCell=tokenAnchorCellFromPixel(token.x,token.y,token,target)
 const moved=records.filter(area=>area.expiresAtWorldMinute==null||area.expiresAtWorldMinute>worldMinute).map(area=>
   projectAttachedSurfaceArea(area,target,geometry??mapGeometryRuntimeForMap(target.id))??{...area,cells:[anchorCell],anchorCell})
 return maps.map(map=>{
   const keep=(map.dnd5ePluginAreas??[]).filter(area=>!attached(area))
   if(map.id===target.id)return {...map,dnd5ePluginAreas:[...keep,...moved]}
   return keep.length===(map.dnd5ePluginAreas??[]).length?map:{...map,dnd5ePluginAreas:keep}
 })
}

/** Apply the same transfer to newly materialized possessions after a bearer leaves. */
export function transferNewlyDroppedSurfaceAreas(before:readonly BattleMap[],after:readonly BattleMap[],worldMinute:number):BattleMap[]{
 let result=[...after]
 for(const map of after){
  const previousIds=new Set(before.find(previous=>previous.id===map.id)?.tokens.map(token=>token.id)??[])
  for(const token of map.tokens){
   if(token.type!=='obstacle'||!token.dnd5eObjectState?.surfaceProfile?.surfaceId||previousIds.has(token.id))continue
   result=transferDroppedObjectSurfaceAreas(result,map.id,token.id,worldMinute)
  }
 }
 return result
}
