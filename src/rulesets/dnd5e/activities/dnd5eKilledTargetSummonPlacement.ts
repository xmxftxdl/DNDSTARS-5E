import type {BattleMap,Token} from '../../../store/maps'
import {cellDistance,mapCellExtent,tokenOccupiedCellsAt,type GridCell} from '../../../lib/gridCombat'
import {planDnd5eSummonedCreature} from '../summonedCreatures'
import type {Dnd5eActivityAuthorityHandoffs} from '../headlessCombatEngine'
/** Local creation at the real killed creature, keeping its body. Only an existing
 * legal adjacent footprint may replace an occupied origin; no arbitrary range. */
export function dnd5eKilledTargetSummonPlacementCells(input:{map:BattleMap;actorToken:Token;proposal:Dnd5eActivityAuthorityHandoffs['summons'][number];packageId:string;activityId:string}):GridCell[]{
 const {map,proposal}=input,origin=map.tokens.find(token=>token.id===proposal.killedCreatureOriginId)
 if(!origin||proposal.count!==1||origin.type==='obstacle'||(origin.hp??origin.maxHp??1)>0||![origin.x,origin.y,origin.size,map.gridSize,map.width,map.height].every(Number.isFinite)||origin.size<=0||map.gridSize<=0||origin.elevationFeet!=null&&!Number.isFinite(origin.elevationFeet))return[]
 const cells=tokenOccupiedCellsAt(origin,map,origin),extent=mapCellExtent(map)
 if(!cells.length)return[]
 const candidates:Array<{cell:GridCell;distance:number}>=[]
 for(let row=Math.max(0,Math.min(...cells.map(cell=>cell.row))-1);row<=Math.min(extent.rows-1,Math.max(...cells.map(cell=>cell.row))+1);row++)for(let col=Math.max(0,Math.min(...cells.map(cell=>cell.col))-1);col<=Math.min(extent.cols-1,Math.max(...cells.map(cell=>cell.col))+1);col++){
  const cell={col,row};candidates.push({cell,distance:Math.min(...cells.map(source=>cellDistance(source,cell)))})
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.cell.row-b.cell.row||a.cell.col-b.cell.col)
 const legal:GridCell[]=[];let best=Infinity
 for(const candidate of candidates){
  if(candidate.distance>best)break
  const placed=planDnd5eSummonedCreature({map,actorToken:{...input.actorToken,x:origin.x,y:origin.y,elevationFeet:origin.elevationFeet},sourceCharacterId:input.actorToken.characterId??input.actorToken.id,featureId:input.activityId,pluginId:input.packageId,actionId:'killed-target-placement-preview',round:1,targetCell:candidate.cell,initiativeD20:10,summon:{...proposal}})
  if(placed.ok){best=candidate.distance;legal.push(candidate.cell)}
 }
 return legal
}
