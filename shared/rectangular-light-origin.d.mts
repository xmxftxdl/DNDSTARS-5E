import type {BattleMap,Dnd5ePluginArea} from '../src/store/maps'
type Point={x:number;y:number}
type Point3=Point & {elevationFeet:number}
export function rectangularLightOrigin(map:BattleMap,area:Dnd5ePluginArea,target:Point3):Point3|undefined
export function rectangularLightFootprint(map:BattleMap,area:Dnd5ePluginArea,radiusFeet:number,planeElevationFeet?:number):Point[]|undefined
export function rectangularLightCandidateOrigins(map:BattleMap,area:Dnd5ePluginArea,target:Point3,occluderEndpoints?:readonly Point[],occluderSegments?:readonly {a:Point;b:Point;baseHeightFeet:number;heightFeet:number}[]):Point3[]

export function refineRectangularLightOrigin(map:BattleMap,area:Dnd5ePluginArea,target:Point3,origin:Point3,isVisible:(point:Point3)=>boolean):Point3
