import type {BattleMap} from '../src/store/maps';
import type {MapGeometryState,MapGeometryPoint} from '../src/lib/mapGeometry';
export function prepareStructureExpiry(map:BattleMap,geometry:MapGeometryState,worldMinute:number,replacedIds:readonly string[],terrainElevationAtPoint:(geometry:MapGeometryState,point:MapGeometryPoint)=>number):{changed:boolean;map:BattleMap;geometry:MapGeometryState;expiredIds:string[]};
export function prepareStructureRemoval(map:BattleMap,geometry:MapGeometryState,structureIds:readonly string[],terrainElevationAtPoint:(geometry:MapGeometryState,point:MapGeometryPoint)=>number):ReturnType<typeof prepareStructureExpiry>;
