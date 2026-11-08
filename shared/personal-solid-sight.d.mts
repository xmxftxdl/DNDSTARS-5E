import type {BattleMap,Token} from '../src/store/maps'
export function personalSolidSightMagicSuppressed(input:{map:BattleMap;token:Token;elevationFeet?:number;heightFeet?:number;elevationAt?:(point:{x:number;y:number;elevationFeet?:number})=>number;terrainAt?:(point:{x:number;y:number})=>number;lineOfEffectBlocked?:(from:{x:number;y:number;elevationFeet:number},to:{x:number;y:number;elevationFeet:number})=>boolean}):boolean
export function projectPersonalSolidSightSuppression<T extends object>(value:T,suppressed:boolean):T
