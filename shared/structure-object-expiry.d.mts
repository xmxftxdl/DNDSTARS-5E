import type {BattleMap,Token} from '../src/store/maps';
export function expireStructureMapObjects(map:BattleMap,expired:readonly {mapId:string;structureId:string}[],dropObjects:(token:Token)=>Token[]):BattleMap;
