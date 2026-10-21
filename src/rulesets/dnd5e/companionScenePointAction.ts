import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import { dnd5eAbilityCheckRollMode, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { prepareDnd5eCompanionObjectInteraction } from './companionObjectInteraction'
import { sceneInteractionReceiptId } from '../../lib/sceneOrchestration'
import { applyDnd5eInventoryGrantBundle, dnd5eInventoryHasAuthorityGrantReceipt } from './items'
import { prepareDnd5eMapInteractionOutcomeTransaction } from './mapInteractionOutcome'
import { normalizeSharedRoomJournal, type SharedRoomJournalState } from '../../lib/roomCommunications'
import type { resolveDnd5eMonsterDodge } from './monsterBasicAction'
import { prepareDnd5eCompanionSceneRewards } from './companionSceneRewards'
import { dnd5eCompanionCarriedWeightPounds } from './companionCarriedObjects'

type Input = Parameters<typeof resolveDnd5eMonsterDodge>[0] & { worldMinute?: number; d20?: number; d20Second?: number;
  damageRollsByEffectId?: Readonly<Record<string, readonly number[]>>; journal?: SharedRoomJournalState;
  /** Host-generated identity, reused while collecting dice and retrying this transaction. */
  attemptId?: string; readied?: boolean; currentInitiativeIndex?: number }

/** Authority-only transaction: point configuration is read from the Host scene snapshot. */
export function resolveDnd5eCompanionScenePointAction(input: Input) {
  if (input.attemptId != null && (typeof input.attemptId !== 'string' || !input.attemptId.trim() || input.attemptId.length > 160)) return undefined
  const token = input.map.tokens.find(entry => entry.id === input.actorTokenId)
  const summon = dnd5eCompanionControlBinding(input.map, token), order = token?.dnd5eCombatState?.companionCommand
  const ready = token?.dnd5eCombatState?.readiedAction
  const selected = input.readied ? ready?.objectInteraction : order?.objectInteraction
  if (token?.type !== 'enemy' || !summon?.commandPolicy || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) ||
    selected?.operation !== 'interact-point') return undefined
  if (input.readied ? ready?.actionKind !== 'interact-object' :
    order?.command !== 'use-object' || order.objectInteractionCompleted ||
    order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId) return undefined
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[token.id], index = snapshot.state.initiativeOrder.indexOf(token.id)
  if (!actor || actor.currentHp <= 0 || index < 0 || actor.summonedUncontrolledSubtype) return undefined
  if (input.readied && (!Number.isInteger(input.currentInitiativeIndex) || input.currentInitiativeIndex! < 0 ||
    input.currentInitiativeIndex! >= snapshot.state.initiativeOrder.length)) return undefined
  snapshot.state.initiativeIndex = input.readied ? input.currentInitiativeIndex! : index
  const executionOptions = input.readied ? { readiedSceneExecution: true as const } : {}
  if (input.turnEconomy) actor.turn = { actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0, reactionAvailable: input.turnEconomy.reaction.current > 0,
    objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0, movementRemaining: input.turnEconomy.movement.current }
  if (input.readied ? !actor.turn.reactionAvailable : !actor.turn.actionAvailable) return undefined
  const prepared = prepareDnd5eCompanionObjectInteraction(snapshot.state, actor, selected)
  const scene = snapshot.state.companionScene?.interactionScenes?.find(entry => entry.id === selected.sceneId)
  if (!prepared?.point || !prepared.checkAbility || !scene) return undefined
  // Currency requires a separate physical inventory representation.
  if ([...prepared.point.successEffects, ...prepared.point.failureEffects]
    .some(effect => effect.kind === 'currency')) return undefined
  const receiptId = sceneInteractionReceiptId(scene, prepared.point, `token:${token.id}`,
    input.readied ? `${input.combatId}:${token.id}:ready:${ready!.preparedTurnKey}` :
    input.attemptId == null ? `${input.combatId}:${input.round ?? 1}:${token.id}:${order!.issuedRound}` : `${token.id}:${input.attemptId}`)
  if (dnd5eInventoryHasAuthorityGrantReceipt(input.characters, receiptId)) return undefined
  const mode = dnd5eAbilityCheckRollMode(actor, { ability: prepared.checkAbility, skill: prepared.checkSkill, requestedMode: prepared.rollMode })
  if (!Number.isInteger(input.d20) || input.d20! < 1 || input.d20! > 20 ||
    (mode !== 'normal' || input.d20Second != null) && (!Number.isInteger(input.d20Second) || input.d20Second! < 1 || input.d20Second! > 20)) return undefined
  const check = resolveDnd5eHeadlessAction(snapshot.state, { type: 'ability-check', actorId: actor.id,
    ability: prepared.checkAbility, skill: prepared.checkSkill, dc: prepared.dc, mode: prepared.rollMode,
    d20: input.d20!, d20Second: input.d20Second }, {}, executionOptions)
  if (!check.ok) return { result: check, application: undefined }
  const checkEvent = check.events.find(event => event.type === 'ability-check-resolved' && event.actorId === actor.id)
  if (checkEvent?.type !== 'ability-check-resolved') return undefined
  const effects = checkEvent.success ? prepared.point.successEffects : prepared.point.failureEffects
  const carried = checkEvent.success && prepared.point.rewards.length
    ? prepareDnd5eCompanionSceneRewards(token, check.state.combatants[actor.id], prepared.point.rewards, receiptId) : undefined
  if (checkEvent.success && prepared.point.rewards.length && !carried) return undefined
  if (!input.journal && effects.some(effect => effect.kind === 'handout' || effect.kind === 'task')) {
    return { result: check, application: undefined, requiredJournal: true }
  }
  const requiredDamageEffects = effects.filter(effect => effect.kind === 'damage' && input.damageRollsByEffectId?.[effect.id] == null)
  if (requiredDamageEffects.length) return { result: check, application: undefined, requiredDamageEffects }
  const transaction = prepareDnd5eMapInteractionOutcomeTransaction({ effects,
    damageRollsByEffectId: input.damageRollsByEffectId ?? {}, journal: input.journal ?? normalizeSharedRoomJournal(undefined),
    triggeringMemberId: input.characters.find(character => character.id === summon.sourceCharacterId)?.roomMemberId, receiptId })
  if (!transaction.ok) return undefined
  if (carried) check.state.combatants[actor.id].carriedWeightLb = dnd5eCompanionCarriedWeightPounds(carried)
  const spent = input.readied ? resolveDnd5eHeadlessAction(check.state, { type: 'trigger-readied-action', actorId: actor.id }) :
    resolveDnd5eHeadlessAction(check.state, { type: 'interact-object', actorId: actor.id,
    interactionId: prepared.interactionId, useAction: true })
  if (!spent.ok) return { result: spent, application: undefined }
  const outcome = resolveDnd5eHeadlessAction(spent.state, { type: 'scene-interaction-outcome', actorId: actor.id,
    interactionId: prepared.interactionId, steps: transaction.transaction.headlessSteps }, {}, executionOptions)
  if (!outcome.ok) return { result: outcome, application: undefined }
  if (!input.readied && (checkEvent.success || prepared.point.repeat !== 'always')) outcome.state.combatants[actor.id].classState.companionCommand = undefined
  const events = [...check.events, ...spent.events, ...outcome.events]
  const rewardedMap = carried ? { ...input.map, tokens: input.map.tokens.map(entry => entry.id === actor.id
    ? { ...entry, dnd5eCarriedObjects: carried } : entry) } : input.map
  const application = planDnd5eMapResultApplication({ state: outcome.state, map: rewardedMap, characters: input.characters,
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events })
  const recipient = application.map.tokens.find(entry => entry.id === actor.id)
  if (carried && recipient?.dnd5eCarriedObjects) {
    application.tokenPatches = { ...application.tokenPatches, [actor.id]: {
      ...application.tokenPatches?.[actor.id], dnd5eCarriedObjects: recipient.dnd5eCarriedObjects } }
    application.changedTokenIds = [...new Set([...application.changedTokenIds, actor.id])]
  }
  // Use the existing shared receipt ledger without granting the caster the companion's rewards.
  const receipt = applyDnd5eInventoryGrantBundle(application.characters, { characterId: summon.sourceCharacterId,
    receiptId, grants: [] })
  if (!receipt.ok || receipt.deduplicated) return undefined
  application.characters = receipt.characters
  application.characterPatches = { ...application.characterPatches, [summon.sourceCharacterId]: {
    ...application.characterPatches?.[summon.sourceCharacterId],
    dnd5eInventory: receipt.characters.find(character => character.id === summon.sourceCharacterId)!.dnd5eInventory } }
  application.changedCharacterIds = [...new Set([...application.changedCharacterIds, summon.sourceCharacterId])]
  return { result: { ...outcome, events }, application, success: checkEvent.success, receiptId,
    journalMutations: transaction.transaction.journalMutations }
}
