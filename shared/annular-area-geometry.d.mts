import type {BattleMap,Dnd5ePluginArea} from '../src/store/maps'
type Map = Pick<BattleMap,'gridSize'> & Partial<Pick<BattleMap,'feetPerCell'|'gridOffsetX'|'gridOffsetY'>>
type Point = {x:number;y:number}
type Area = Pick<Dnd5ePluginArea,'anchorCell'|'circularGeometry'>
export function annularAreaOverlapsBox(area:Area,map:Map,point:Point,halfSizePixels:number):boolean
export function annularAreaRayIntervals(area:Area,map:Map,from:Point,to:Point):[number,number][]
