import {refreshDnd5eMapSpatialRelations} from './mapBridge'
import type {Dnd5eCombatEvent} from './headlessCombatEngine'
import type{BattleMap}from'../../store/maps'
import type{MapGeometryState}from'../../lib/mapGeometry'
import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
type GeometryScope={parentId:string;actorId:string;map:BattleMap;geometry?:MapGeometryState|null};let active:GeometryScope|undefined
/** Host map facts only. This scope issues no feature, cast, choice, die, native
 * result or publication capability; the actual native consumer validates them. */
export function withTempestuousCastGeometry<T>(scope:GeometryScope,run:()=>T):T{if(!scope.parentId||!scope.actorId||!scope.map.id||scope.geometry&&scope.geometry.mapId!==scope.map.id)throw Error('tempestuous:actual-map-facts-required');const previous=active;active=scope;try{return run()}finally{active=previous}}
export function readTempestuousCastGeometry(parentId:string,actorId:string,state:Dnd5eHeadlessCombatState){const scope=active;if(!scope||scope.parentId!==parentId||scope.actorId!==actorId||state.mapId!==scope.map.id)throw Error('tempestuous:current-cast-map-facts-required');const map={...scope.map,tokens:scope.map.tokens.map(token=>{const actor=state.combatants[token.id];return actor?{...token,x:actor.position.x,y:actor.position.y,elevationFeet:actor.elevationFeet,groundElevationFeet:actor.groundElevationFeet,hp:actor.currentHp}:token})};return{map,geometry:scope.geometry,actorToken:map.tokens.find(token=>token.id===actorId)}}

/** Rebuild the actual post-flight facts before any later effect of this cast. */
export function refreshTempestuousCastSpatialFacts(parentId:string,actorId:string,state:Dnd5eHeadlessCombatState,events:Dnd5eCombatEvent[]){const facts=readTempestuousCastGeometry(parentId,actorId,state);refreshDnd5eMapSpatialRelations(state,facts.map,events,{geometry:facts.geometry})}
