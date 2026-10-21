import {dnd5eCanActAtZeroHitPoints,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eIsIncapacitated} from './passiveDefenses'
import {planDnd5eWeaponHitPushAndFollow} from './weaponHitMovement'
import {planDnd5eMapResultApplication} from './mapBridge'
import {findDnd5eOpportunityWindowsForMove} from './opportunityAttackAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import type {GridCell} from '../../lib/gridCombat'

/** Re-evaluate the same path against the current projected scene and reactions. */
export function findDnd5eHitFollowOpportunityWindows(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];
 actorId:string;path:readonly {x:number;y:number}[];pathElevationsFeet?:readonly number[]}){
 const token=input.map.tokens.find(token=>token.id===input.actorId),first=input.path[0],last=input.path.at(-1)
 if(!token||!first||!last)return []
 const moving={...token,...first,elevationFeet:input.pathElevationsFeet?.[0]??token.elevationFeet}
 const turnEconomyByToken=Object.fromEntries(Object.values(input.state.combatants).map(actor=>{
  const economy=createDnd5eTurnEconomyCounts('hit-follow',actor.speed)
  economy.reaction.current=actor.turn.reactionAvailable&&!actor.deathSaves.dead&&!dnd5eIsIncapacitated(actor)&&
   (actor.currentHp>0||dnd5eCanActAtZeroHitPoints(actor))?1:0
  return [actor.id,economy]
 }))
 return findDnd5eOpportunityWindowsForMove({combatContext:{combatId:input.state.combatId,round:input.state.round,initiativeIndex:input.state.initiativeIndex,active:input.state.active,initiativeOrder:input.state.initiativeOrder.map(id=>({tokenId:id,label:id,emoji:"",color:"",roll:input.state.combatants[id].initiative}))},map:input.map,characters:input.characters,movingToken:moving,
  to:last,path:[...input.path],pathElevationsFeet:input.pathElevationsFeet,toElevationFeet:input.pathElevationsFeet?.at(-1),movementMode:'walk',turnEconomyByToken})
  .sort((a,b)=>(a.pathSegmentIndex+(a.trigger==='leave-reach'?0:1))-(b.pathSegmentIndex+(b.trigger==='leave-reach'?0:1)))
}

/** Read-only Host plan from transaction-local positions, effects, HP and reaction budgets. */
export function planDnd5eHitFollowContinuation(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];
 actorId:string;targetId:string;cell:GridCell}){
 const characterIdByCombatantId=Object.fromEntries(input.map.tokens.flatMap(token=>token.characterId?[[token.id,token.characterId]]:[]))
 const state=structuredClone(input.state)
 const projected=planDnd5eMapResultApplication({state,map:input.map,characters:input.characters,characterIdByCombatantId,events:[]})
 const plan=planDnd5eWeaponHitPushAndFollow({...input,map:projected.map,maximumPushFeet:0,followCell:input.cell})
 if(!plan.ok)return plan
 const moving=projected.map.tokens.find(token=>token.id===input.actorId)
 if(!plan.follow||!moving)return {ok:false as const,reason:'follow-destination-required'}
 const opportunities=findDnd5eHitFollowOpportunityWindows({state:input.state,map:projected.map,characters:projected.characters,
  actorId:input.actorId,path:plan.follow.path,pathElevationsFeet:plan.follow.pathElevationsFeet})
 return {ok:true as const,movement:plan.follow,opportunities,map:projected.map,characters:projected.characters}
}

