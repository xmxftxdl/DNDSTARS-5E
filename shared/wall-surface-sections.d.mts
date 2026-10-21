import type {BattleMap,Dnd5ePluginArea} from '../src/store/maps'
type MapGrid=Pick<BattleMap,'gridSize'> & Partial<Pick<BattleMap,'gridOffsetX'|'gridOffsetY'|'feetPerCell'>>
export function wallSurfaceLength(area:Partial<Dnd5ePluginArea>):number|undefined
export function wallSurfaceCoordinate(area:Dnd5ePluginArea,map:MapGrid,point:{x:number;y:number}):number|undefined
export function validWallSurfaceSections(area:Partial<Dnd5ePluginArea>,sections:unknown):boolean
export function wallSurfaceRayIntervals(area:Dnd5ePluginArea,map:MapGrid,from:{x:number;y:number},to:{x:number;y:number},z:number,dz:number,interval:number[]):number[][]

export function wallSurfaceWorldPoint(area:Dnd5ePluginArea,map:MapGrid,alongFeet:number):{x:number;y:number}|undefined
