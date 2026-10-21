import {collectDnd5ePersistentAreaTriggers} from './pluginAreas'
import {dnd5eCombatantIsFlying,dnd5eHeadlessTurnKey,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {BattleMap} from '../../store/maps'

/** Revisit the travelled prefix so distance intervals carry across path nodes.
 * Only return contacts at the newly reached node; earlier receipts remain on map. */
export function collectDnd5eHitFollowAreaCandidates(input:{
 state:Dnd5eHeadlessCombatState;map:BattleMap;actorId:string;
 path:readonly {x:number;y:number}[];pathElevationsFeet?:readonly number[];pathIndex:number
}){
 const token=input.map.tokens.find(token=>token.id===input.actorId)
 if(!token||input.pathIndex<1||input.pathIndex>=input.path.length)return []
 const path=input.path.slice(0,input.pathIndex+1)
 const movement={token:{...token,...path[0],elevationFeet:input.pathElevationsFeet?.[0]??token.elevationFeet},
  to:path[path.length-1],path,pathElevationsFeet:input.pathElevationsFeet?.slice(0,input.pathIndex+1)}
 const context={map:input.map,round:input.state.round,turnKey:dnd5eHeadlessTurnKey(input.state,input.actorId),movement,
  sizeRanksByTokenId:new Map(Object.values(input.state.combatants).map(actor=>[actor.id,actor.sizeRank])),
  flightCapableTokenIds:new Set(Object.values(input.state.combatants).filter(dnd5eCombatantIsFlying).map(actor=>actor.id))}
 return (['on-enter','on-move-distance'] as const).flatMap(timing=>collectDnd5ePersistentAreaTriggers({...context,timing}))
  .filter(candidate=>candidate.pathIndex===input.pathIndex)
}
