import { stoneWallIntersects } from '../../../shared/stone-wall-geometry.mjs'
import { tokenAnchorCellFromPixel, tokenCenterForAnchorCell, tokenOccupiedCellsAt, cellKey } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation, mapGeometryMovementBlocked } from '../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
/** Occupied creature space, including large tokens and height, not just its anchor grid cell. */
export function wallOverlapsCreature(map: BattleMap, area: Dnd5ePluginArea, token: Token): boolean {
 if(token.type==='obstacle' || !['wall-of-stone','wall-of-ice','wall-of-force'].includes(area.coreSpellId??''))return false
 const feet=map.feetPerCell??5, size=Math.max(1,token.size), z=mapGeometryTokenElevation(mapGeometryRuntimeForMap(map.id),token)
 if(area.forceShell && area.anchorCell){
  const scale=feet/map.gridSize,cx=map.gridOffsetX+(area.anchorCell.col+.5)*map.gridSize,cy=map.gridOffsetY+(area.anchorCell.row+.5)*map.gridSize
  const base=area.vertical?.mode==='volume'?area.vertical.baseElevationFeet:0,r=area.forceShell.radiusFeet,cz=base+(area.forceShell.shape==='sphere'?r:0)
  const d=Math.hypot(token.x-cx,token.y-cy)*scale,half=size*feet*.5,top=z+size*feet
  if(area.forceShell.shape==='hemisphere'&&top<=base)return false
  const dz=cz<z?z-cz:cz>top?cz-top:0
  return Math.hypot(Math.max(0,d-half),dz)<=r && Math.hypot(d+half,Math.max(Math.abs(z-cz),Math.abs(top-cz)))>=r
 }
 return stoneWallIntersects(area,map,token,token,z,z,size*feet*.5,size*feet)
}
/** Local legal positions only; the forming wall may be crossed, existing walls and doors may not. */
export function wallPushDestinations(map: BattleMap,area:Dnd5ePluginArea,token:Token){
 if(!wallOverlapsCreature(map,area,token))return []
 const geometry=mapGeometryRuntimeForMap(map.id),origin=tokenAnchorCellFromPixel(token.x,token.y,token,map)
 const before={...map,dnd5ePluginAreas:map.dnd5ePluginAreas?.filter(a=>a.id!==area.id)}
 const occupied=new Set(map.tokens.filter(t=>t.id!==token.id&&t.type!=='obstacle').flatMap(t=>tokenOccupiedCellsAt(t,map,t)).map(cellKey))
 const columns=Math.floor((map.width-map.gridOffsetX)/map.gridSize),rows=Math.floor((map.height-map.gridOffsetY)/map.gridSize)
 const radius=Math.ceil(Math.max(1,token.size))+2,candidates=[]
 for(let dc=-radius;dc<=radius;dc++)for(let dr=-radius;dr<=radius;dr++){
  if(!dc&&!dr)continue
  const cell={col:origin.col+dc,row:origin.row+dr},to=tokenCenterForAnchorCell(cell,token,map),moved={...token,...to}
  if(tokenOccupiedCellsAt(token,map,to).some(c=>c.col<0||c.row<0||c.col>=columns||c.row>=rows||occupied.has(cellKey(c))))continue
  if(wallOverlapsCreature(map,area,moved)||mapGeometryMovementBlocked({geometry,map:before,token,to}).blocked)continue
  if(Math.abs(mapGeometryTokenElevation(geometry,moved)-mapGeometryTokenElevation(geometry,token))>.01)continue
  candidates.push({cell,distance:Math.hypot(to.x-token.x,to.y-token.y)})
 }
 const closest=Math.min(...candidates.map(c=>c.distance))
 return candidates.filter(c=>c.distance<=closest+map.gridSize*.5).sort((a,b)=>a.distance-b.distance).map(c=>c.cell)
}
export function resolveWallPush(map:BattleMap,areaId:string,tokenId:string,to:{col:number;row:number}):BattleMap|undefined{
 const area=map.dnd5ePluginAreas?.find(a=>a.id===areaId),token=map.tokens.find(t=>t.id===tokenId)
 if(!area||!token||!wallPushDestinations(map,area,token).some(c=>cellKey(c)===cellKey(to)))return undefined
 const position=tokenCenterForAnchorCell(to,token,map)
 return {...map,tokens:map.tokens.map(t=>t.id===tokenId?{...t,...position}:t)}
}
