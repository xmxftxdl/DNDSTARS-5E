import type {MapGeometryState} from './mapGeometry'
import {mapGeometryFootprintTerrainSamples, mapGeometryPlacementBlocked} from './mapGeometry'
import {cellKey, tokenOccupiedCellsAt} from './gridCombat'
import {createMapTokenOccupancy} from './mapTokenOccupancy'
import {planNearestUnoccupiedExit} from './mapSolidMaterialTraversal'
import type {BattleMap, Token} from '../store/maps'

/** Ordinary matter is bypassed; a temple extends into the Ethereal Plane. */
export function mapGeometryForEtherealTravel(geometry:MapGeometryState|undefined):MapGeometryState|undefined {
 const ids=new Set(geometry?.structureLifetimes?.filter(record=>record.templeWard).flatMap(record=>record.entityIds))
 if(!geometry||!ids.size)return undefined
 return {...geometry,walls:geometry.walls.filter(entity=>ids.has(entity.id)),
  // The temple's ward bars ethereal entry even while its material entrance is open.
  doors:geometry.doors.filter(entity=>ids.has(entity.id)).map(door=>({...door,state:'closed',openState:'closed',blocksMovement:true})),
  windows:geometry.windows?.filter(entity=>ids.has(entity.id)),obstacles:geometry.obstacles.filter(entity=>ids.has(entity.id))}
}

/** Plans a return to material space. The caller commits displacement and damage atomically. */
export function planEtherealReturn(input: {
 map: BattleMap
 geometry?: MapGeometryState
 token: Token
 at: {x:number;y:number}
 elevationFeet:number
}): {ok:true;displaced:boolean;position:{x:number;y:number};elevationFeet:number;distanceFeet:number;forceDamage:number} |
 {ok:false;reason:'no-free-ejection-space'} {
 const {map,geometry,token,at,elevationFeet}=input
 const occupancy=createMapTokenOccupancy({...map,tokens:map.tokens.filter(other=>other.id!==token.id)},geometry,token)(elevationFeet)
 const cells=tokenOccupiedCellsAt(token,map,at)
 const columns=Math.ceil(map.width/map.gridSize),rows=Math.ceil(map.height/map.gridSize)
 const overlapsCreatureOrBoundary=cells.some(cell=>cell.col<0||cell.row<0||cell.col>=columns||cell.row>=rows||occupancy.has(cellKey(cell)))
 const insideGround=mapGeometryFootprintTerrainSamples({geometry,at,halfSizePixels:map.gridSize*Math.max(1,token.size)/2})
  .some(surface=>elevationFeet<surface.elevationFeet-1e-7)
 if(!overlapsCreatureOrBoundary&&!insideGround&&!mapGeometryPlacementBlocked({map,geometry,token,at,elevationFeet}).blocked){
  return {ok:true,displaced:false,position:{...at},elevationFeet,distanceFeet:0,forceDamage:0}
 }
 const exit=planNearestUnoccupiedExit(input)
 if(!exit.ok)return exit
 const distanceFeet=Math.max(
  Math.abs(exit.position.x-at.x)/Math.max(1,map.gridSize)*(map.feetPerCell??5),
  Math.abs(exit.position.y-at.y)/Math.max(1,map.gridSize)*(map.feetPerCell??5),
  Math.abs(exit.elevationFeet-elevationFeet))
 return {...exit,distanceFeet,forceDamage:Math.floor(distanceFeet*2)}
}
