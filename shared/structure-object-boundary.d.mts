import type {StructureLifetime} from './structure-lifetime.mjs';
export function structureObjectOutsideBoundary(input:{
 binding:{mapId:string;structureId:string};
 geometry:{maps:{mapId:string;structureLifetimes?:StructureLifetime[]}[]};
 mapId:string;position:{x:number;y:number;elevationFeet:number};
}):boolean;
