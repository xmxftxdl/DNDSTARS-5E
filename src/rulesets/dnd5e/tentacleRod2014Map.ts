import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedPlayerActionState, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, prepareDnd5eExplorationActor } from './mapBridge'
import { resolveDnd5eTentacleRod2014, validateDnd5eTentacleRod2014 } from './tentacleRod2014'

export function prepareDnd5eTentacleRodMap(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  worldMinute?: number
}) {
  const {action,map,characters}=input, payload=action.dnd5eItemUse
  const owner=characters.find(character=>character.id===action.characterId)
  const token=map.tokens.find(candidate=>candidate.id===action.actorTokenId)
  if(action.type!=='dnd5e-item-use'||action.mapId!==map.id||!owner||!token||token.characterId!==owner.id||!payload||
    !Array.isArray(payload.targetTokenIds)||payload.targetTokenIds.length!==3||payload.targetTokenIds.some(id=>typeof id!=='string')||
    (action.combatId && (input.initiativeOrder[action.initiativeIndex]?.tokenId!==token.id||!input.turnEconomy||input.turnEconomy.action.current<1))) return undefined
  const order=action.combatId ? input.initiativeOrder : [token,...map.tokens.filter(candidate=>candidate.id!==token.id&&candidate.type!=='obstacle')]
    .map((candidate,index)=>({tokenId:candidate.id,label:candidate.label,roll:100-index,color:candidate.color,emoji:candidate.emoji}))
  const snapshot=createDnd5eMapCombatSnapshot({map,characters,combatId:action.combatId??`exploration:${map.id}`,round:action.round,
    initiativeOrder:order,worldMinute:input.worldMinute,additionalCreatureTokenIds:map.tokens.filter(candidate=>candidate.type!=='obstacle').map(candidate=>candidate.id)})
  const actor=snapshot.state.combatants[token.id]
  if(!actor)return undefined
  snapshot.state.initiativeIndex=dnd5eRequestedInitiativeActorIndex(snapshot.state,token.id,action.initiativeIndex)
  if(snapshot.state.initiativeIndex<0)return undefined
  if(!action.combatId)prepareDnd5eExplorationActor(snapshot.state,token.id)
  if(input.turnEconomy)actor.turn={...actor.turn,actionAvailable:input.turnEconomy.action.current>0,
    bonusActionAvailable:input.turnEconomy.bonusAction.current>0,reactionAvailable:input.turnEconomy.reaction.current>0,
    movementRemaining:input.turnEconomy.movement.current}
  const intent={actorId:token.id,instanceId:payload.instanceId,useActionId:payload.useActionId,receiptId:action.id,targetIds:payload.targetTokenIds}
  if(!validateDnd5eTentacleRod2014(snapshot.state,owner,intent))return undefined
  return {...input,...snapshot,owner,intent}
}

export async function resolvePreparedDnd5eTentacleRodMap(
  prepared: NonNullable<ReturnType<typeof prepareDnd5eTentacleRodMap>>,
  roll: Parameters<typeof resolveDnd5eTentacleRod2014>[0]['roll'],
) {
  const result=await resolveDnd5eTentacleRod2014({...prepared,roll})
  if(!result.ok)return result
  const characters=prepared.characters.map(character=>character.id===result.owner.id?result.owner:character)
  return {...result,application:planDnd5eMapResultApplication({map:prepared.map,characters,baselineCharacters:prepared.characters,
    state:result.state,characterIdByCombatantId:prepared.characterIdByCombatantId,events:[...result.events]})}
}
