import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eAbilityCheckRollMode, dnd5eBestGrappleDefense } from './headlessCombatEngine'
import { planDnd5eShovePushDestination, resolvePreparedDnd5ePlayerBasicAction, type PreparedDnd5eBasicActionResolution } from './playerBasicAction'
import type { resolveDnd5eMonsterDodge } from './monsterBasicAction'

/** Uses the normal contested-action resolver; never invents a player sheet for a monster. */
export function prepareDnd5eCompanionSpecialAttack(input: Parameters<typeof resolveDnd5eMonsterDodge>[0]): PreparedDnd5eBasicActionResolution | undefined {
  const token = input.map.tokens.find(t => t.id === input.actorTokenId)
  const order = token?.dnd5eCombatState?.companionCommand
  const summon = token?.dnd5eSummon
  const kind = order?.attackKind
  if (!token || token.type !== 'enemy' || !summon || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) || !summon.commandPolicy ||
    order?.command !== 'attack' || order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId ||
    !order.attackTargetId || !kind || kind === 'weapon') return undefined
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[token.id], target = snapshot.state.combatants[order.attackTargetId]
  const index = snapshot.state.initiativeOrder.indexOf(token.id)
  if (!actor || !target || index < 0) return undefined
  if (input.turnEconomy) actor.turn = {
    actionAvailable: input.turnEconomy.action.current > 0, bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0, objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const targetDefense = dnd5eBestGrappleDefense(target).skill
  const pushTo = kind === 'shove-push' ? planDnd5eShovePushDestination(input.map, token.id, target.id) : undefined
  if (kind === 'shove-push' && !pushTo) return undefined
  const prepared: PreparedDnd5eBasicActionResolution = {
    map: input.map, characters: input.characters, state: { ...snapshot.state, initiativeIndex: index },
    characterIdByCombatantId: snapshot.characterIdByCombatantId, actorTokenId: token.id,
    payload: kind === 'grapple' ? { kind: 'grapple', targetTokenId: target.id, targetDefense }
      : { kind: 'shove', targetTokenId: target.id, targetDefense, outcome: kind === 'shove-prone' ? 'prone' : 'push' },
    spendsAction: true, spendsBonusAction: false, actorContestSkill: 'athletics', targetDefense,
    actorRollMode: dnd5eAbilityCheckRollMode(actor, { ability: 'str', skill: 'athletics' }),
    targetRollMode: dnd5eAbilityCheckRollMode(target, { ability: targetDefense === 'acrobatics' ? 'dex' : 'str', skill: targetDefense }),
    pushTo, pushDistanceFeet: kind === 'shove-push' ? 5 : undefined,
  }
  const preview = resolvePreparedDnd5ePlayerBasicAction({ prepared, actorD20: 10, actorD20Second: 10, targetD20: 10, targetD20Second: 10 })
  return preview.result.ok || preview.airborneFalls?.length ? prepared : undefined
}
