import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'

/** The optional choice travels through the same authoritative state as attacks. */
export function resolveDnd5eMonsterRecklessChoice(input:
  Parameters<typeof createDnd5eMapCombatSnapshot>[0] & {
    actorTokenId: string
    turnEconomy: Dnd5eTurnEconomyCounts
  },
) {
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[input.actorTokenId]
  const actorIndex = snapshot.state.initiativeOrder.indexOf(input.actorTokenId)
  if (actor && actorIndex >= 0) {
    snapshot.state.initiativeIndex = actorIndex
    actor.turn = {
      ...actor.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const result = resolveDnd5eHeadlessAction(snapshot.state, {
    type: 'monster-reckless', actorId: input.actorTokenId,
  })
  return {
    result,
    application: result.ok ? planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      events: [...result.events],
    }) : undefined,
  }
}
