import type {BattleMap,Dnd5ePluginArea,Token} from '../src/store/maps'
export function pillarBlocksMovement(area:Dnd5ePluginArea,map:BattleMap,token:Token,from:{x:number;y:number},to:{x:number;y:number},fromHeight:number,toHeight:number):boolean
