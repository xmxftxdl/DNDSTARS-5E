import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import { dnd5eAbilityCheckRollMode } from './headlessCombatEngine'
import { resolvePreparedDnd5ePlayerBasicAction, type PreparedDnd5eBasicActionResolution } from './playerBasicAction'
import type { resolveDnd5eMonsterDodge } from './monsterBasicAction'

/** Preview the same Hide action that authority will resolve after the roll. */
export function prepareDnd5eCompanionHide(input: Parameters<typeof resolveDnd5eMonsterDodge>[0]): PreparedDnd5eBasicActionResolution | undefined {
  const token = input.map.tokens.find(t => t.id === input.actorTokenId)
  const order = token?.dnd5eCombatState?.companionCommand, summon = dnd5eCompanionControlBinding(input.map, token)
  if (!token || token.type !== 'enemy' || !summon?.commandPolicy || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) ||
    order?.command !== 'hide' || order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId) return undefined
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[token.id], index = snapshot.state.initiativeOrder.indexOf(token.id)
  if (!actor || index < 0) return undefined
  if (input.turnEconomy) actor.turn = {
    actionAvailable: input.turnEconomy.action.current > 0, bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0, objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const prepared: PreparedDnd5eBasicActionResolution = {
    map: input.map, characters: input.characters, state: { ...snapshot.state, initiativeIndex: index },
    characterIdByCombatantId: snapshot.characterIdByCombatantId, actorTokenId: token.id, payload: { kind: 'hide' },
    spendsAction: true, spendsBonusAction: false,
    actorRollMode: dnd5eAbilityCheckRollMode(actor, { ability: 'dex', skill: 'stealth' }), targetRollMode: 'normal',
  }
  return resolvePreparedDnd5ePlayerBasicAction({ prepared, actorD20: 10, actorD20Second: 10 }).result.ok ? prepared : undefined
}
