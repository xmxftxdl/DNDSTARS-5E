import type { BattleMap, Dnd5ePluginArea } from '../src/store/maps'
type Point3={x:number;y:number;elevationFeet:number}
export function clippedPrismLightOrigin(map:BattleMap,area:Dnd5ePluginArea,target:Point3):Point3|undefined
export function rectangularLightHasClippedCells(map:BattleMap,area:Dnd5ePluginArea):boolean
export function clippedPrismDistanceToBox(map:BattleMap,area:Dnd5ePluginArea,minimum:Point3,maximum:Point3):number
