import type{InitiativeEntry}from'../../components/map/InitiativeTracker'
import type{Dnd5eTurnEconomyByToken,Dnd5eTurnEconomyCounts}from'../../lib/sharedCombatTypes'
import type{Dnd5eHeadlessCombatState}from"../../application/combat/dnd5eCombatRules"
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'

/** Complete the real combat-start producer before its existing first-turn
 * settlement and atomic publication. Existing costs are never refreshed. */
export function completeDnd5eCombatStartEconomies(input:{state:Dnd5eHeadlessCombatState;initiativeOrder:readonly InitiativeEntry[];existing:Dnd5eTurnEconomyByToken;constrain:(actorId:string,economy:Dnd5eTurnEconomyCounts)=>Dnd5eTurnEconomyCounts}):Dnd5eTurnEconomyByToken{
 const result={...input.existing},active=input.initiativeOrder[input.state.initiativeIndex]
 for(const[actorId,actor]of Object.entries(input.state.combatants)){
  if(result[actorId])continue
  const turnKey=input.state.combatId+':'+input.state.round+':'+(active?.tokenId===actorId?active.slotId??actorId:actorId)
  result[actorId]=input.constrain(actorId,projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(turnKey,actor.speed),actor.turn,actor.speed))
 }
 return result
}
