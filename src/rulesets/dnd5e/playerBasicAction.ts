import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eBasicActionPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  resolveDnd5eHeadlessAction,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eAttacksPerAttackAction } from './classes'

export type Dnd5eBasicActionRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'action-unavailable'
  | 'combatant-missing'
  | 'invalid-dice'

export interface PreparedDnd5eBasicAction {
  action: SharedPlayerActionState
  payload: Dnd5eBasicActionPayload
  map: BattleMap
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Readonly<Record<string, string>>
  actor: Character
  actorTokenId: string
  spendsAction: boolean
  attackNumber?: number
}

export function prepareDnd5ePlayerBasicAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
}): { ok: true; prepared: PreparedDnd5eBasicAction } | { ok: false; reason: Dnd5eBasicActionRejectReason } {
  const payload = input.action.dnd5eBasicAction
  if (input.action.type !== 'dnd5e-basic-action' || !payload) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const token = input.map.tokens.find((candidate) =>
    candidate.id === input.action.actorTokenId && candidate.characterId === input.action.characterId,
  )
  if (!actor || actor.rulesetId !== 'dnd5e-2014-srd-5.1' || actor.currentHp <= 0 || !token) {
    return { ok: false, reason: 'invalid-actor' }
  }
  const replacesAttack = payload.kind === 'grapple' || payload.kind === 'shove'
  const attacksPerAction = dnd5eAttacksPerAttackAction(actor)
  const attacksAllowed = attacksPerAction * Math.max(1, input.turnEconomy.action.max)
  const attackNumber = replacesAttack ? input.turnEconomy.attacksUsed + 1 : undefined
  const spendsAction = !replacesAttack || input.turnEconomy.attacksUsed % attacksPerAction === 0
  if (replacesAttack && input.turnEconomy.attacksUsed >= attacksAllowed) return { ok: false, reason: 'action-unavailable' }
  if (spendsAction && input.turnEconomy.action.current < 1) return { ok: false, reason: 'action-unavailable' }
  const targetTokenId = 'targetTokenId' in payload ? payload.targetTokenId : undefined
  if (targetTokenId && !input.map.tokens.some((candidate) => candidate.id === targetTokenId)) {
    return { ok: false, reason: 'invalid-target' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(token.id)
  const combatant = snapshot.state.combatants[token.id]
  if (actorIndex < 0 || !combatant) return { ok: false, reason: 'combatant-missing' }
  combatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  return {
    ok: true,
    prepared: {
      action: input.action,
      payload,
      map: input.map,
      characters: input.characters,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      actor,
      actorTokenId: token.id,
      spendsAction,
      attackNumber,
    },
  }
}

export function resolvePreparedDnd5ePlayerBasicAction(input: {
  prepared: PreparedDnd5eBasicAction
  actorD20?: number
  actorD20Second?: number
  targetD20?: number
  targetD20Second?: number
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared, actorD20 = 0, actorD20Second, targetD20 = 0, targetD20Second } = input
  const payload = prepared.payload
  let action: Dnd5eAction
  switch (payload.kind) {
    case 'dash': action = { type: 'dash', actorId: prepared.actorTokenId }; break
    case 'hide': action = { type: 'hide', actorId: prepared.actorTokenId, d20: actorD20, d20Second: actorD20Second }; break
    case 'help': action = { type: 'help', actorId: prepared.actorTokenId, targetId: payload.targetTokenId, helpKind: payload.helpKind }; break
    case 'ready': action = { type: 'ready', actorId: prepared.actorTokenId, trigger: payload.trigger, actionKind: payload.actionKind, targetId: payload.targetTokenId }; break
    case 'use-object': action = { type: 'use-object', actorId: prepared.actorTokenId, interactionId: payload.interactionId }; break
    case 'grapple': action = {
      type: 'grapple', actorId: prepared.actorTokenId, targetId: payload.targetTokenId,
      actorD20, actorD20Second, targetD20, targetD20Second, targetDefense: payload.targetDefense,
      spendAction: prepared.spendsAction,
    }; break
    case 'shove': action = {
      type: 'shove', actorId: prepared.actorTokenId, targetId: payload.targetTokenId,
      actorD20, actorD20Second, targetD20, targetD20Second,
      targetDefense: payload.targetDefense, outcome: payload.outcome,
      spendAction: prepared.spendsAction,
    }; break
  }
  const result = resolveDnd5eHeadlessAction(prepared.state, action)
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
