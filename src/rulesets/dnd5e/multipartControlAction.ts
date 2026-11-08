import {resolveDnd5eActionWithAirborneFallPreview, type Dnd5eAirborneFallDamageRolls} from './airborneFallActionResolution'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { type Dnd5eAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'

export type MultipartControlCommand = Extract<Dnd5eAction, {type:'multipart-control'}>

export function resolveMultipartControlChoice(input: Parameters<typeof createDnd5eMapCombatSnapshot>[0] & {
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  command: MultipartControlCommand
  currentActorTokenId: string
  turnEconomy: Dnd5eTurnEconomyCounts
}) {
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[input.command.actorId]
  snapshot.state.initiativeIndex = snapshot.state.initiativeOrder.indexOf(input.currentActorTokenId)
  if (actor) actor.turn = {...actor.turn,actionAvailable:input.turnEconomy.action.current>0,
    bonusActionAvailable:input.turnEconomy.bonusAction.current>0,reactionAvailable:input.turnEconomy.reaction.current>0,
    movementRemaining:input.turnEconomy.movement.current}
  const {result,airborneFalls} = resolveDnd5eActionWithAirborneFallPreview(snapshot.state,input.command,input.airborneFallDamageRollsByCombatantId)
  return {result,airborneFalls,application:result.ok?planDnd5eMapResultApplication({state:result.state,map:input.map,characters:input.characters,
    characterIdByCombatantId:snapshot.characterIdByCombatantId,events:[...result.events],geometry:input.geometry}):undefined}
}
