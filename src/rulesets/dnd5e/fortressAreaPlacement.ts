import type {BattleMap} from '../../store/maps'
import {cellToPixel,cellKey} from '../../lib/gridCombat'
import {aoeOrientFromCell,cellsForAoe} from '../../lib/skillTargeting'
import type {Dnd5eActivityAreaMapSelectionV1} from './activities/dnd5eActivityMapInteraction'

/** Shared by Host preview and commit. Legacy aligned packages retain their exact origin. */
export function fortressAreaPlacement(map:BattleMap,area:Dnd5eActivityAreaMapSelectionV1){
 return structureAreaPlacement(map,area,{widthFeet:120,depthFeet:120})
}

export function structureAreaPlacement(map:BattleMap,area:Dnd5eActivityAreaMapSelectionV1,dimensions:{widthFeet:number;depthFeet:number}){
 const width=dimensions.widthFeet/(map.feetPerCell??5),depth=dimensions.depthFeet/(map.feetPerCell??5),angle=area.areaPlacement.angleDegrees??0
 if(![width,depth].every(n=>Number.isFinite(n)&&n>0)||!area.cells.length||!Number.isFinite(angle)||angle<0||angle>=360)return undefined
 const keys=new Set(area.cells.map(cellKey))
 if(keys.size!==area.cells.length)return undefined
 if(area.rectGeometry?.gridAligned!==false){
  if(angle!==0||!Number.isInteger(width)||!Number.isInteger(depth)||keys.size!==width*depth)return undefined
  const col=Math.min(...area.cells.map(c=>c.col)),row=Math.min(...area.cells.map(c=>c.row))
  for(let y=0;y<depth;y++)for(let x=0;x<width;x++)if(!keys.has(cellKey({col:col+x,row:row+y})))return undefined
  const corner=cellToPixel({col,row},map)
  return {origin:{x:corner.x-map.gridSize/2,y:corner.y-map.gridSize/2},rotationDegrees:0}
 }
 const center=cellToPixel(area.anchorCell,map)
 if(Math.abs(center.x-area.areaPlacement.x)>1e-4||Math.abs(center.y-area.areaPlacement.y)>1e-4)return undefined
 // Targeting uses five-foot units; convert the physical square to that coordinate system.
 const template={shape:'rect' as const,origin:'point' as const,widthFeet:width*5,heightFeet:depth*5,rotatable:true,gridAligned:false}
 const from=aoeOrientFromCell(template,area.anchorCell,area.anchorCell,{rectAngleDegrees:angle})
 const expected=cellsForAoe(template,from,area.anchorCell)
 if(expected.length!==keys.size||expected.some(cell=>!keys.has(cellKey(cell))))return undefined
 const radians=angle*Math.PI/180,halfWidth=width*map.gridSize/2,halfDepth=depth*map.gridSize/2
 return {origin:{x:center.x-halfWidth*Math.cos(radians)+halfDepth*Math.sin(radians),y:center.y-halfWidth*Math.sin(radians)-halfDepth*Math.cos(radians)},rotationDegrees:angle}
}
