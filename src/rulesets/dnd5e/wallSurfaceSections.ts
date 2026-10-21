import {wallSurfaceCoordinate,wallSurfaceWorldPoint} from '../../../shared/wall-surface-sections.mjs'
import {persistentAreaVolumeRayIntersections} from '../../../shared/persistent-area-ray.mjs'
import {wallSurfaceLength as dnd5eWallSurfaceLength} from '../../../shared/wall-surface-sections.mjs'
export {wallSurfaceLength as dnd5eWallSurfaceLength,wallSurfaceCoordinate as dnd5eWallSurfacePoint} from '../../../shared/wall-surface-sections.mjs'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'

/** Coordinates on the wall surface: along its centreline, then absolute elevation, in feet. */
export interface Dnd5eWallSurfaceSection {startFeet:number;endFeet:number;bottomFeet:number;topFeet:number}
/** Disjoint sections at least five feet across; merge a short tail into the last section. */
export function dnd5eWallFreezingSectionAt(area:Dnd5ePluginArea,alongFeet:number,elevationFeet:number):Dnd5eWallSurfaceSection|undefined{
 const length=dnd5eWallSurfaceLength(area),vertical=area.vertical
 if(length==null||length<=0||vertical?.mode!=='volume'||!Number.isFinite(alongFeet)||!Number.isFinite(elevationFeet)||
  alongFeet<0||alongFeet>length||elevationFeet<vertical.baseElevationFeet||elevationFeet>=vertical.baseElevationFeet+vertical.heightFeet)return undefined
 const band=(position:number,size:number)=>{
  const count=Math.max(1,Math.floor(size/5))
  const index=Math.min(Math.floor(position/5),count-1)
  return {start:index*5,end:index===count-1?size:(index+1)*5}
 }
 const along=band(alongFeet,length),height=band(elevationFeet-vertical.baseElevationFeet,vertical.heightFeet)
 return {startFeet:along.start,endFeet:along.end,bottomFeet:vertical.baseElevationFeet+height.start,topFeet:vertical.baseElevationFeet+height.end}
}
/** Subtract only overlapping wall material; never refill a prior frozen/destroyed patch. */
export function subtractDnd5eWallSurfaceSection(source:readonly Dnd5eWallSurfaceSection[],cut:Dnd5eWallSurfaceSection):Dnd5eWallSurfaceSection[]{
 return source.flatMap(part=>{
  const left=Math.max(part.startFeet,cut.startFeet),right=Math.min(part.endFeet,cut.endFeet)
  const bottom=Math.max(part.bottomFeet,cut.bottomFeet),top=Math.min(part.topFeet,cut.topFeet)
  if(left>=right||bottom>=top)return [{...part}]
  return [
   ...(part.startFeet<left?[{...part,endFeet:left}]:[]),
   ...(right<part.endFeet?[{...part,startFeet:right}]:[]),
   ...(part.bottomFeet<bottom?[{startFeet:left,endFeet:right,bottomFeet:part.bottomFeet,topFeet:bottom}]:[]),
   ...(top<part.topFeet?[{startFeet:left,endFeet:right,bottomFeet:top,topFeet:part.topFeet}]:[]),
  ]
 })
}

/** Exact wall material versus an axis-aligned token footprint and its height span. */
export function dnd5eWallSurfaceIntersectsFootprint(input:{area:Dnd5ePluginArea;map:BattleMap;position:{x:number;y:number};halfSizePixels:number;bottomFeet:number;topFeet:number}):boolean{
 const {area,map,position}=input,vertical=area.vertical
 if(vertical?.mode!=='volume')return false
 const h=Math.max(0,input.halfSizePixels-1e-7)
 const corners=[{x:position.x-h,y:position.y-h},{x:position.x+h,y:position.y-h},{x:position.x+h,y:position.y+h},{x:position.x-h,y:position.y+h}]
 for(const section of area.wallSurfaceSections??[]){
  const bottom=Math.max(input.bottomFeet,section.bottomFeet,vertical.baseElevationFeet),top=Math.min(input.topFeet,section.topFeet,vertical.baseElevationFeet+vertical.heightFeet)
  if(bottom>=top)continue
  const z=(bottom+top)/2,part={...area,wallSurfaceSections:[section]}
  for(let i=0;i<4;i++)if(persistentAreaVolumeRayIntersections({map,area:part,from:corners[i],to:corners[(i+1)%4],fromElevationFeet:z,toElevationFeet:z}).length)return true
  const center=wallSurfaceWorldPoint(area,map,(section.startFeet+section.endFeet)/2)
  if(center&&Math.abs(center.x-position.x)<h&&Math.abs(center.y-position.y)<h&&area.cells.some(cell=>
    Math.floor((center.x-map.gridOffsetX)/map.gridSize)===cell.col&&Math.floor((center.y-map.gridOffsetY)/map.gridSize)===cell.row))return true
 }
 return false
}

/** Aim at remaining material, retaining its height instead of the parent wall's anchor. */
export function dnd5eWallSurfaceAttackPoint(map:BattleMap,area:Dnd5ePluginArea,origin:{x:number;y:number;elevationFeet?:number}):{x:number;y:number;elevationFeet:number}|undefined{
 const along=wallSurfaceCoordinate(area,map,origin),length=dnd5eWallSurfaceLength(area)
 if(along==null||length==null)return undefined
 const candidates:{x:number;y:number;elevationFeet:number}[]=[]
 for(const section of area.wallSurfaceSections??[]){
  const epsilon=Math.min(1e-6,(section.endFeet-section.startFeet)/4)
  const positions=[along,...(area.circularGeometry?[along-length,along+length]:[]),(section.startFeet+section.endFeet)/2,section.startFeet,section.endFeet]
  for(const candidate of positions){
   const s=Math.max(section.startFeet+epsilon,Math.min(section.endFeet-epsilon,candidate))
   const point=wallSurfaceWorldPoint(area,map,s);if(!point)continue
   const elevationFeet=Math.max(section.bottomFeet,Math.min(section.topFeet-1e-7,origin.elevationFeet??0))
   if(persistentAreaVolumeRayIntersections({map,area,from:point,to:point,fromElevationFeet:elevationFeet,toElevationFeet:elevationFeet}).length)candidates.push({...point,elevationFeet})
  }
 }
 const scale=(map.feetPerCell??5)/map.gridSize
 const distance=(p:typeof candidates[number])=>Math.max(Math.abs(p.x-origin.x)*scale,Math.abs(p.y-origin.y)*scale,Math.abs(p.elevationFeet-(origin.elevationFeet??0)))
 return candidates.reduce<typeof candidates[number]|undefined>((best,p)=>!best||distance(p)<distance(best)?p:best,undefined)
}
