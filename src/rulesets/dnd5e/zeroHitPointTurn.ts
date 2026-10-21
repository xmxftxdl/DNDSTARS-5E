import {captureDnd5eInterruptedTurnUsage} from './interruptedTurn'
import { dnd5eHeadlessTurnKey, resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** Host continuation of the same uncommitted damage transaction. Publish only
 * after this succeeds; missing lifecycle dice must leave the whole replay pending. */
export function beginDnd5eAcceptedZeroHitPointTurn(
  source: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, {type: 'begin-turn'}>,
) {
  const actor = source.combatants[action.actorId]
  const marker = actor?.classState.zeroHitPointExtraTurn
  const resume = actor?.classState.interruptedTurnResume
  if (!actor || marker?.phase !== 'pending' || !resume || actor.deathSaves.dead ||
    resume.receipt.actorId !== actor.id || resume.receipt.extraSlotId !== marker.slotId ||
    resume.receipt.combatId !== source.combatId || resume.receipt.round !== source.round ||
    !source.combatants[resume.receipt.interruptedActorId]) return undefined
  const slots = source.initiativeSlotIds ?? source.initiativeOrder.map((id, index) => `${id}:base:${index}`)
  if (slots.length !== source.initiativeOrder.length || slots.includes(marker.slotId)) return undefined
  // Multiple accepted reactions from one damage batch nest in Host settlement
  // order. Only walk an intact chain of already-started, matching interrupts;
  // ordinary initiative changes must still invalidate the old receipt.
  let originalIndex = source.initiativeIndex
  while (slots[originalIndex] !== resume.receipt.interruptedSlotId) {
    const parent = source.combatants[source.initiativeOrder[originalIndex]]
    const parentTurn = parent?.classState.zeroHitPointExtraTurn
    const parentResume = parent?.classState.interruptedTurnResume?.receipt
    if (!parent || parentTurn?.phase !== 'active' || parentTurn.slotId !== slots[originalIndex] ||
      !source.oneShotInitiativeSlotIds?.includes(parentTurn.slotId) || !parentResume ||
      parentResume.combatId !== source.combatId || parentResume.round !== source.round ||
      parentResume.interruptedSlotId !== slots[originalIndex+1] ||
      parentResume.interruptedActorId !== source.initiativeOrder[originalIndex+1]) return undefined
    originalIndex++
  }
  if (source.initiativeOrder[originalIndex] !== resume.receipt.interruptedActorId) return undefined
  const state = structuredClone(source)
  const next = state.combatants[actor.id]
  const paused = state.combatants[state.initiativeOrder[state.initiativeIndex]]
  const saved = next.classState.interruptedTurnResume!
  saved.receipt.interruptedActorId = paused.id
  saved.receipt.interruptedSlotId = slots[state.initiativeIndex]
  // Capture after the triggering attack has completed its action and hit bookkeeping.
  saved.economy = structuredClone(paused.turn)
  saved.turnStartResolvedTurnKey = paused.classState.turnStartResolvedTurnKey
  saved.nativeUsage = captureDnd5eInterruptedTurnUsage(paused.classState, dnd5eHeadlessTurnKey(state, paused.id))
  saved.attackProgress = {
    weaponAttackActionTurnKey: paused.classState.weaponAttackActionTurnKey,
    attacksMadeTurnKey: paused.classState.attacksMadeTurnKey,
    attacksMadeThisTurn: paused.classState.attacksMadeThisTurn,
    meleeAttackTargetIdsThisTurn: paused.classState.meleeAttackTargetIdsThisTurn?.slice(),
    usedFeatureTurnKeys: Object.fromEntries(Object.entries(paused.classState.declarativeUsedTurnKeys ?? {})
      .filter(([,key]) => key === dnd5eHeadlessTurnKey(state, paused.id))),
  }
  const index = state.initiativeIndex
  state.initiativeOrder = [...state.initiativeOrder.slice(0,index),actor.id,...state.initiativeOrder.slice(index)]
  state.initiativeSlotIds = [...slots.slice(0,index),marker.slotId,...slots.slice(index)]
  state.oneShotInitiativeSlotIds = [...(state.oneShotInitiativeSlotIds ?? []),marker.slotId]
  state.turnSlotId = marker.slotId
  next.classState.zeroHitPointExtraTurn = {...marker,phase:'active'}
  return resolveDnd5eHeadlessAction(state, action)
}
