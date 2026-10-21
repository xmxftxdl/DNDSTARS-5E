import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { resolveDnd5eActionWithAirborneFallPreview } from './airborneFallActionResolution'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'

export function resolveDnd5eMonsterShapechangeChoice(input:
  Parameters<typeof createDnd5eMapCombatSnapshot>[0] & {
    actorTokenId: string
    formId: string
    turnEconomy: Dnd5eTurnEconomyCounts
    airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
  },
) {
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[input.actorTokenId]
  const actorIndex = snapshot.state.initiativeOrder.indexOf(input.actorTokenId)
  if (actor && actorIndex >= 0) {
    snapshot.state.initiativeIndex = actorIndex
    actor.turn = { ...actor.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current }
  }
  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(snapshot.state, {
    type: 'monster-shapechange', actorId: input.actorTokenId, formId: input.formId,
  }, input.airborneFallDamageRollsByCombatantId)
  return { result, airborneFalls, application: result.ok ? planDnd5eMapResultApplication({
    state: result.state, map: input.map, characters: input.characters,
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events],
  }) : undefined }
}
