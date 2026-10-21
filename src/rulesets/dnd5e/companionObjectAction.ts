import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import { resolveDnd5eHeadlessAction, dnd5eAbilityCheckRollMode } from './headlessCombatEngine'
import { prepareDnd5eCompanionObjectInteraction, dnd5eCompanionObjectInteractionId } from './companionObjectInteraction'
import type { resolveDnd5eMonsterDodge } from './monsterBasicAction'
import { resolveDnd5eCompanionScenePointAction } from './companionScenePointAction'

export function prepareDnd5eCompanionObjectCheck(input: Parameters<typeof resolveDnd5eMonsterDodge>[0] & { worldMinute?: number; readied?: boolean }) {
  const snapshot = createDnd5eMapCombatSnapshot(input), actor = snapshot.state.combatants[input.actorTokenId]
  if (!actor || actor.currentHp <= 0) return undefined
  const order = actor.classState.companionCommand
  const ready = actor.classState.readiedAction
  if (input.readied) {
    if (ready?.actionKind !== 'interact-object' ||
      !(input.turnEconomy ? input.turnEconomy.reaction.current > 0 : actor.turn.reactionAvailable)) return undefined
  } else if (order?.command !== 'use-object' || order.objectInteractionCompleted ||
    !(input.turnEconomy ? input.turnEconomy.action.current > 0 : actor.turn.actionAvailable)) return undefined
  const selected = input.readied ? actor.classState.readiedAction?.objectInteraction : actor.classState.companionCommand?.objectInteraction
  const prepared = prepareDnd5eCompanionObjectInteraction(snapshot.state, actor, selected)
  if (!prepared || prepared.automaticSuccess || !prepared.checkAbility) return undefined
  return { ...prepared, mode: dnd5eAbilityCheckRollMode(actor, {
    ability: prepared.checkAbility, skill: prepared.checkSkill, requestedMode: prepared.rollMode }) }
}

export function resolveDnd5eCompanionObjectAction(input: Parameters<typeof resolveDnd5eMonsterDodge>[0] & { worldMinute?: number; d20?: number; d20Second?: number; damageRollsByEffectId?: Readonly<Record<string, readonly number[]>>; journal?: import('../../lib/roomCommunications').SharedRoomJournalState; attemptId?: string }) {
  const token = input.map.tokens.find(t => t.id === input.actorTokenId), summon = dnd5eCompanionControlBinding(input.map, token)
  const order = token?.dnd5eCombatState?.companionCommand
  if (order?.objectInteraction?.operation === 'interact-point') {
    const resolved = resolveDnd5eCompanionScenePointAction(input)
    return resolved ? { ...resolved, door: undefined } : undefined
  }
  if (!token || token.type !== 'enemy' || !summon?.commandPolicy || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) || order?.command !== 'use-object' || order.objectInteractionCompleted ||
    order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId) return undefined
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[token.id], index = snapshot.state.initiativeOrder.indexOf(token.id)
  if (!actor || index < 0) return undefined
  snapshot.state.initiativeIndex = index
  if (input.turnEconomy) actor.turn = {
    actionAvailable: input.turnEconomy.action.current > 0, bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0, objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const prepared = prepareDnd5eCompanionObjectInteraction(snapshot.state, actor)
  if (!order.objectInteraction || (!prepared?.door && order.objectInteraction.operation!=='pickup-item')) return undefined
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'use-object', actorId: token.id, interactionId: dnd5eCompanionObjectInteractionId(order.objectInteraction),
    d20: input.d20, d20Second: input.d20Second })
  return { result,
    door: result.ok ? result.state.companionScene?.geometry?.doors.find(door => door.id === prepared?.door?.id) : undefined,
    application: result.ok ? planDnd5eMapResultApplication({ state: result.state, map: input.map, characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] }) : undefined,
  }
}
