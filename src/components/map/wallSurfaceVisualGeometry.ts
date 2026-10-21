import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {wallSurfaceLength,wallSurfaceWorldPoint} from '../../../shared/wall-surface-sections.mjs'
export function wallSurfaceVisualGeometry(area:Dnd5ePluginArea,map:BattleMap){
 const length=wallSurfaceLength(area),v=area.vertical
 if(!length||!area.anchorCell||v?.mode!=='volume'||area.geometryDepleted||!area.cells.length)return []
 const sections=area.wallSurfaceSections??[{startFeet:0,endFeet:length,bottomFeet:v.baseElevationFeet,topFeet:v.baseElevationFeet+v.heightFeet}]
 const scale=map.gridSize/(map.feetPerCell??5),ring=area.circularGeometry?.innerRadiusFeet!=null
 const halfWidth=ring?(area.circularGeometry!.radiusFeet-area.circularGeometry!.innerRadiusFeet!)/2:(area.rectGeometry?.widthFeet??1)/2
 const center={x:map.gridOffsetX+(area.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(area.anchorCell.row+.5)*map.gridSize}
 return sections.map(section=>{
  const count=ring?Math.max(2,Math.ceil((section.endFeet-section.startFeet)*scale/4)):1
  const left:number[]=[],right:number[]=[],spine:number[]=[]
  for(let i=0;i<=count;i++){
   const along=section.startFeet+(section.endFeet-section.startFeet)*i/count
   const point=wallSurfaceWorldPoint(area,map,along)!
   const normal=ring?{x:(point.x-center.x)/Math.hypot(point.x-center.x,point.y-center.y),y:(point.y-center.y)/Math.hypot(point.x-center.x,point.y-center.y)}:
    {x:-area.rectGeometry!.direction.dr,y:area.rectGeometry!.direction.dc}
   left.push(point.x+normal.x*halfWidth*scale,point.y+normal.y*halfWidth*scale)
   right.unshift(point.x-normal.x*halfWidth*scale,point.y-normal.y*halfWidth*scale)
   spine.push(point.x,point.y)
  }
  return {section,points:[...left,...right],spine,heightFraction:(section.topFeet-section.bottomFeet)/v.heightFeet}
 })
}
