import type {BattleMap,Dnd5ePluginArea} from '../src/store/maps'
type MapFrame=Pick<BattleMap,'gridSize'> & Partial<Pick<BattleMap,'gridOffsetX'|'gridOffsetY'|'feetPerCell'>>
type Point3={x:number;y:number;elevationFeet:number}
export function rectangularPrism(map:MapFrame,area:Dnd5ePluginArea):{
 axes:number[][];half:number[];center:Point3;local(point:Point3):number[];world(values:number[]):Point3
}|undefined
export function rectangularPrismNearestPoint(map:MapFrame,area:Dnd5ePluginArea,point:Point3):Point3|undefined
export function rectangularPrismRayInterval(map:MapFrame,area:Dnd5ePluginArea,from:Point3,to:Point3):[number,number]|undefined
export function rectangularPrismOverlapsBox(map:MapFrame,area:Dnd5ePluginArea,minimum:Point3,maximum:Point3):boolean
export function rectangularPrismDistanceToBox(map:MapFrame,area:Dnd5ePluginArea,minimum:Point3,maximum:Point3):number
export function rectangularPrismCells(map:MapFrame & Pick<BattleMap,'width'|'height'>,area:Dnd5ePluginArea):{col:number;row:number}[]|undefined
export function rectangularPrismOutline(map:MapFrame,area:Dnd5ePluginArea):number[]|undefined
