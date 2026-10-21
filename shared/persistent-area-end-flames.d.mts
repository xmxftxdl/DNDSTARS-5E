import type {BattleMap,Token} from '../src/store/maps'
import type {MapGeometryState} from '../src/lib/mapGeometry'
export function settleAreaEndFlames(input:{before:BattleMap;after:BattleMap;geometry:MapGeometryState;worldMinute?:number;
 groundAt:(geometry:MapGeometryState,point:{x:number;y:number})=>number;
 tokenElevation:(geometry:MapGeometryState,token:Token)=>number;
}):{map:BattleMap;geometry:MapGeometryState;changedTokenIds:string[];changedLightIds:string[]}
