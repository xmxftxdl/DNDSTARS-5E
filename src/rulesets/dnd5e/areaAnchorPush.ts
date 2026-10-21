import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {cellKey,mapCellExtent,tokenCenterForAnchorCell,tokenAnchorCellFromPixel,tokenOccupiedCellsAt} from '../../lib/gridCombat'
import {mapGeometryRuntimeForMap,mapGeometryTokenElevation,mapGeometryTerrainElevationAtPoint,mapGeometryMovementBlocked,mapGeometryPlacementBlocked} from '../../lib/mapGeometry'
import {dnd5eTokenHeightFeet} from './verticalCombatGeometry'
import {dnd5eMappedVerticalDisplacement} from './verticalDisplacement'

/** Host-owned 3D displacement from a fixed volume's center; stops at physical obstruction. */
export function dnd5eAreaAnchorPush(input:{map:BattleMap;area:Dnd5ePluginArea;targetTokenId:string;distanceFeet:number}):
 {position:{x:number;y:number};elevationFeet:number;groundElevationFeet:number;distanceFeet:number}|undefined {
 const {map,area}=input,target=map.tokens.find(token=>token.id===input.targetTokenId)
 if(!target||!area.anchorCell||area.vertical?.mode!=='volume'||!Number.isFinite(input.distanceFeet)||input.distanceFeet<=0)return undefined
 const geometry=mapGeometryRuntimeForMap(map.id),start=mapGeometryTokenElevation(geometry,target),height=dnd5eTokenHeightFeet(target)
 const from=tokenCenterForAnchorCell(area.anchorCell,{size:1},map),scale=Math.max(1,map.feetPerCell??5),grid=Math.max(1,map.gridSize)
 const dx=(target.x-from.x)/grid*scale,dy=(target.y-from.y)/grid*scale,dz=start+height/2-(area.vertical.baseElevationFeet+area.vertical.heightFeet/2)
 const length=Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))
 if(length<1e-7)return {position:{x:target.x,y:target.y},elevationFeet:start,groundElevationFeet:mapGeometryTerrainElevationAtPoint(geometry,target),distanceFeet:0}
 let position={x:target.x,y:target.y},elevationFeet=start,distanceFeet=0
 const extent=mapCellExtent(map)
 for(let step=Math.min(scale,input.distanceFeet);step<=input.distanceFeet+1e-7;step=Math.min(input.distanceFeet,step+scale)) {
  const desired={x:target.x+dx/length*step/scale*grid,y:target.y+dy/length*step/scale*grid}
  const cell=tokenAnchorCellFromPixel(desired.x,desired.y,target,map),next=tokenCenterForAnchorCell(cell,target,map)
  const elevation=start+dz/length*step,occupied=tokenOccupiedCellsAt(target,map,next)
  if(elevation<mapGeometryTerrainElevationAtPoint(geometry,next)-1e-7 || occupied.some(c=>c.col<0||c.row<0||c.col>=extent.cols||c.row>=extent.rows))break
  const keys=new Set(occupied.map(cellKey))
  if(map.tokens.some(other=>other.id!==target.id && !(other.type==='obstacle'&&other.obstacleKind==='marker') &&
   Math.min(elevation+height,mapGeometryTokenElevation(geometry,other)+dnd5eTokenHeightFeet(other))-Math.max(elevation,mapGeometryTokenElevation(geometry,other))>1e-7 && tokenOccupiedCellsAt(other,map,other).some(c=>keys.has(cellKey(c)))))break
  if(mapGeometryMovementBlocked({geometry,map,token:{...target,...position},to:next,fromElevationFeet:elevationFeet,toElevationFeet:elevation}).blocked ||
   mapGeometryPlacementBlocked({geometry,map,token:target,at:next,elevationFeet:elevation}).blocked)break
  if(dnd5eMappedVerticalDisplacement({map,geometry,token:{...target,...next},fromFeet:elevationFeet,toFeet:elevation,bodyHeightFeet:height}).blocked)break
  position=next;elevationFeet=elevation;distanceFeet=Math.max(Math.abs(next.x-target.x)/grid*scale,Math.abs(next.y-target.y)/grid*scale,Math.abs(elevation-start))
  if(step===input.distanceFeet)break
 }
 return {position,elevationFeet,groundElevationFeet:mapGeometryTerrainElevationAtPoint(geometry,position),distanceFeet}
}
