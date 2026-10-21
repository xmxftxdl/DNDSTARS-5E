import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { isDnd5eCompanionReady } from './companionReady'
import type { resolveDnd5eMonsterDodge } from './monsterBasicAction'

export function resolveDnd5eCompanionReadyAction(input: Parameters<typeof resolveDnd5eMonsterDodge>[0]) {
  const token = input.map.tokens.find(candidate => candidate.id === input.actorTokenId)
  const summon = dnd5eCompanionControlBinding(input.map, token), order = token?.dnd5eCombatState?.companionCommand
  if (!token || token.type !== 'enemy' || !summon?.commandPolicy || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) || order?.command !== 'ready' ||
    !isDnd5eCompanionReady(order.ready) || order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId) return undefined
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[token.id], index = snapshot.state.initiativeOrder.indexOf(token.id)
  if (!actor || index < 0) return undefined
  snapshot.state.initiativeIndex = index
  if (input.turnEconomy) actor.turn = {
    actionAvailable: input.turnEconomy.action.current > 0, bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0, objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'ready', actorId: token.id,
    objectInteraction: order.objectInteraction, trigger: order.ready.trigger, actionKind: order.ready.actionKind, targetId: order.attackTargetId })
  return { result, application: result.ok ? planDnd5eMapResultApplication({ state: result.state, map: input.map,
    characters: input.characters, characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] }) : undefined }
}
