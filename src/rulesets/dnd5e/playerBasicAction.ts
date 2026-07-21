import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eBasicActionPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import {
  dnd5eBestGrappleDefense,
  resolveDnd5eHeadlessAction,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eAttacksPerAttackAction } from './classes'
import { dnd5eConditionAbilityCheckDisadvantage } from './conditions'
import { resolveDnd5eRollMode } from './rollMode'
import {
  cellKey,
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import {
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
} from '../../lib/mapGeometry'

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
  actorRollMode: D20RollMode
  targetRollMode: D20RollMode
  actorContestSkill?: 'athletics' | 'acrobatics'
  targetDefense?: 'athletics' | 'acrobatics'
  pushTo?: { x: number; y: number }
}

function planDnd5eShovePushDestination(map: BattleMap, actorTokenId: string, targetTokenId: string) {
  const actor = map.tokens.find((token) => token.id === actorTokenId)
  const target = map.tokens.find((token) => token.id === targetTokenId)
  if (!actor || !target) return undefined
  const actorCell = tokenAnchorCellFromPixel(actor.x, actor.y, actor, map)
  const targetCell = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const dc = Math.sign(targetCell.col - actorCell.col)
  const dr = Math.sign(targetCell.row - actorCell.row)
  if (dc === 0 && dr === 0) return undefined
  const destinationCell = { col: targetCell.col + dc, row: targetCell.row + dr }
  const { cols, rows } = mapCellExtent(map)
  const to = tokenCenterForAnchorCell(destinationCell, target, map)
  const footprint = tokenOccupiedCellsAt(target, map, to)
  const occupied = new Set(map.tokens
    .filter((token) => token.id !== target.id && (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
    .flatMap((token) => tokenOccupiedCellsAt(token, map, token))
    .map(cellKey))
  const geometry = mapGeometryRuntimeForMap(map.id)
  if (
    footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
    footprint.some((cell) => occupied.has(cellKey(cell))) ||
    mapGeometryMovementBlocked({ geometry, map, token: target, to }).blocked ||
    mapGeometryPlacementBlocked({ geometry, map, token: target, at: to }).blocked
  ) return undefined
  return to
}

export function triggerDnd5eReadiedAction(input: {
  combatId: string
  round: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  turnEconomy: Dnd5eTurnEconomyCounts
}): {
  ok: true
  actor: Character
  result: Extract<Dnd5eActionResult, { ok: true }>
  application: Dnd5eMapResultPlan
} | { ok: false; reason: Dnd5eBasicActionRejectReason | 'reaction-unavailable' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.characterId)
  const actor = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  if (!actorToken || !actor || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (!actor.dnd5eCombatState?.readiedAction) return { ok: false, reason: 'invalid-action' }
  if (input.turnEconomy.reaction.current < 1) return { ok: false, reason: 'reaction-unavailable' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    turnSlotId: input.initiativeOrder.find((entry) => entry.tokenId === actorToken.id)?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const combatant = snapshot.state.combatants[actorToken.id]
  if (!combatant) return { ok: false, reason: 'combatant-missing' }
  combatant.turn.reactionAvailable = true
  const result = resolveDnd5eHeadlessAction(snapshot.state, {
    type: 'trigger-readied-action',
    actorId: actorToken.id,
  })
  if (!result.ok) {
    return { ok: false, reason: result.reason === 'reaction-unavailable' ? result.reason : 'invalid-action' }
  }
  return {
    ok: true,
    actor,
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    }),
  }
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
  const targetCombatant = targetTokenId ? snapshot.state.combatants[targetTokenId] : undefined
  const escapingGrapple = payload.kind === 'escape-grapple'
  if (escapingGrapple && (!targetCombatant || !combatant.classState.activeEffects?.some((effect) =>
    effect.standardCondition === 'grappled' && effect.source.actorId === targetCombatant.id))) {
    return { ok: false, reason: 'invalid-target' }
  }
  const actorContestSkill = escapingGrapple
    ? dnd5eBestGrappleDefense(combatant).skill
    : replacesAttack ? 'athletics' : undefined
  const targetDefense = escapingGrapple
    ? 'athletics'
    : targetCombatant && replacesAttack ? dnd5eBestGrappleDefense(targetCombatant).skill : undefined
  const pushTo = payload.kind === 'shove' && payload.outcome === 'push' && targetTokenId
    ? planDnd5eShovePushDestination(input.map, token.id, targetTokenId)
    : undefined
  if (payload.kind === 'shove' && payload.outcome === 'push' && !pushTo) return { ok: false, reason: 'invalid-target' }
  const actorRollMode = resolveDnd5eRollMode({
    advantage: [{
      active: actorContestSkill === 'athletics' && combatant.classState.raging === true,
      reason: 'rage-strength-check',
    }],
    disadvantage: [{
      active: combatant.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(combatant),
      reason: payload.kind === 'hide' ? 'hide-disadvantage' : 'contest-disadvantage',
    }],
  }).mode
  const targetRollMode = resolveDnd5eRollMode({
    advantage: [{
      active: targetDefense === 'athletics' && targetCombatant?.classState.raging === true,
      reason: 'rage-strength-check',
    }],
    disadvantage: [{
      active: !!targetCombatant && (
        targetCombatant.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(targetCombatant)
      ),
      reason: 'contest-disadvantage',
    }],
  }).mode
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
      actorRollMode,
      targetRollMode,
      actorContestSkill,
      targetDefense,
      pushTo,
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
      actorD20, actorD20Second, targetD20, targetD20Second,
      targetDefense: prepared.targetDefense ?? payload.targetDefense,
      spendAction: prepared.spendsAction,
    }; break
    case 'shove': action = {
      type: 'shove', actorId: prepared.actorTokenId, targetId: payload.targetTokenId,
      actorD20, actorD20Second, targetD20, targetD20Second,
      targetDefense: prepared.targetDefense ?? payload.targetDefense, outcome: payload.outcome,
      pushTo: prepared.pushTo,
      spendAction: prepared.spendsAction,
    }; break
    case 'escape-grapple': action = {
      type: 'escape-grapple', actorId: prepared.actorTokenId, grapplerId: payload.targetTokenId,
      actorD20, actorD20Second, targetD20, targetD20Second,
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
