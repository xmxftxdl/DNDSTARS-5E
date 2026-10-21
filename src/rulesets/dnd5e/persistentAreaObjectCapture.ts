import type {BattleMap,Dnd5ePluginArea,Token} from '../../store/maps'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'
import {dnd5eTokenIntersectsPersistentAreaAt} from './persistentAreaGeometry'
import {firstCylinderPathContact} from './sweptSphereContact'
import {mapGeometryRuntimeForMap,mapGeometryTokenElevation,mapGeometryEntityBodyHeightFeet,mapGeometryVolumeMovementBlocked,type MapGeometryState} from '../../lib/mapGeometry'
import {mapCellExtent,tokenOccupiedCellsAt} from '../../lib/gridCombat'
import {planDnd5eMapObjectLanding} from './mapObjectFlight'

export function dnd5eAreaMayCaptureObject(token:Token,maximumSizeRank:number):boolean {
 const object=normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState)
 const rank=['tiny','small','medium','large','huge','gargantuan'].indexOf(object?.animateObjects?.size??'')
 return token.type==='obstacle'&&object!=null&&object.structureBinding==null&&object.attached===false&&
  object.wornOrCarried===false&&object.carrierTokenId==null&&rank>=0&&rank<=maximumSizeRank&&
  Number.isInteger(maximumSizeRank)&&maximumSizeRank>=0&&maximumSizeRank<=5
}

/** Capture and translate only map objects with explicit physical facts; no creature damage or saves. */
export function captureDnd5eAreaObjects(map:BattleMap,area:Dnd5ePluginArea,
 path?:readonly {x:number;y:number;elevationFeet:number}[], suppliedGeometry?:MapGeometryState):BattleMap|undefined {
 const maximum=area.movement?.collectObjectsMaximumSizeRank
 if(maximum==null||area.vertical?.mode!=='volume'||!area.circularGeometry||!area.anchorCell)return map
 const geometry=suppliedGeometry??mapGeometryRuntimeForMap(map.id),scale=map.gridSize/(map.feetPerCell??5),end=path?.at(-1)
 let changed=false,invalid=false
 const tokens=map.tokens.map(token=>{
  if(token.type!=='obstacle')return token
  const capture=token.dnd5eObjectState?.areaCapture
  if(capture&&(capture.mapId!==map.id||capture.areaId!==area.id||capture.sourceTokenId!==area.sourceTokenId))return token
  if(!dnd5eAreaMayCaptureObject(token,maximum)){
   if(!capture)return token
   changed=true
   return {...token,dnd5eObjectState:{...token.dnd5eObjectState!,areaCapture:undefined}}
  }
  const bottom=mapGeometryTokenElevation(geometry,token),half=token.size*map.gridSize/2
  const contact=path?firstCylinderPathContact(path,scale,area.circularGeometry!.radiusFeet,area.vertical!.mode==='volume'?area.vertical!.heightFeet:0,
    [(token.x-half)/scale,(token.y-half)/scale,bottom],[(token.x+half)/scale,(token.y+half)/scale,bottom+(mapGeometryEntityBodyHeightFeet(token)??5)]):undefined
  const start=capture?path?.[0]:contact?.point
  if(!capture&&!contact&&!dnd5eTokenIntersectsPersistentAreaAt(token,map,area,token))return token
  if(start&&path){
   // Newly collected objects travel only the remaining path after first contact.
   const remaining=[start,...path.slice(capture?1:(contact?.segment??0)+1)]
   for(let i=1;i<remaining.length;i++){
    const position=(point:typeof start)=>({x:token.x+point.x-start.x,y:token.y+point.y-start.y,
     elevationFeet:bottom+point.elevationFeet-start.elevationFeet})
    const from=position(remaining[i-1]),to=position(remaining[i])
    if(mapGeometryVolumeMovementBlocked({map,geometry,from,to,fromElevationFeet:from.elevationFeet,
     toElevationFeet:to.elevationFeet,halfSizePixels:half,heightFeet:mapGeometryEntityBodyHeightFeet(token)??5}).blocked)invalid=true
   }
  }
  changed=true
  const next={...token,...(start&&end?{x:token.x+end.x-start.x,y:token.y+end.y-start.y,elevationFeet:bottom+end.elevationFeet-start.elevationFeet}:{}),
    dnd5eObjectState:{...token.dnd5eObjectState!,areaCapture:{mapId:map.id,areaId:area.id,sourceTokenId:area.sourceTokenId}}}
  const extent=mapCellExtent(map)
  if(tokenOccupiedCellsAt(next,map,next).some(c=>c.col<0||c.row<0||c.col>=extent.cols||c.row>=extent.rows))invalid=true
  return next
 })
 return invalid?undefined:changed?{...map,tokens}:map
}

/** Release objects whose local support or unattended physical state no longer exists. */
export function releaseDnd5eEndedAreaObjects(map:BattleMap, suppliedGeometry?:MapGeometryState):BattleMap {
 let changed=false
 const landingIds=new Set<string>()
 const tokens=map.tokens.map(token=>{
  const capture=token.dnd5eObjectState?.areaCapture
  if(!capture)return token
  const area=capture.mapId===map.id?map.dnd5ePluginAreas?.find(a=>a.id===capture.areaId&&a.sourceTokenId===capture.sourceTokenId):undefined
  if(area?.movement?.collectObjectsMaximumSizeRank!=null&&dnd5eAreaMayCaptureObject(token,area.movement.collectObjectsMaximumSizeRank))return token
  if(capture.mapId===map.id&&!area&&dnd5eAreaMayCaptureObject(token,5))landingIds.add(token.id)
  changed=true
  return {...token,dnd5eObjectState:{...token.dnd5eObjectState!,areaCapture:undefined}}
 })
 if(!changed)return map
 const geometry=suppliedGeometry??mapGeometryRuntimeForMap(map.id)
 const released={...map,tokens}
 // Lower objects settle first so upper ones cannot rest on obsolete suspended positions.
 for(const token of tokens.filter(t=>landingIds.has(t.id)).sort((a,b)=>mapGeometryTokenElevation(geometry,a)-mapGeometryTokenElevation(geometry,b))){
  const landing=planDnd5eMapObjectLanding({map:released,geometry,objectId:token.id,point:token,elevationFeet:mapGeometryTokenElevation(geometry,token)})
  if(landing)released.tokens=released.tokens.map(t=>t.id===token.id?{...t,elevationFeet:landing.elevationFeet}:t)
 }
 return released
}
