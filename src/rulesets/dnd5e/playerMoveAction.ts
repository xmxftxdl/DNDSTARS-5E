import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { isMovementLocked } from '../../lib/combatStatus'
import { DND_FEET_PER_CELL, cellDistance, snapTokenToGridCenter, tokenAnchorCellFromPixel } from '../../lib/gridCombat'
import type { Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'

export type Dnd5ePlayerMoveRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'movement-locked'
  | 'insufficient-movement'
  | 'combatant-missing'

export interface PreparedDnd5ePlayerMove {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  actor: Character
  actorToken: Token
  to: { x: number; y: number }
  distanceFeet: number
  movementCostFeet: number
  standFromProne: boolean
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
}

export function prepareDnd5ePlayerMove(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
}): { ok: true; prepared: PreparedDnd5ePlayerMove } | { ok: false; reason: Dnd5ePlayerMoveRejectReason } {
  const { action } = input
  if (action.type !== 'move-token' || !action.targetPosition) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) =>
    token.id === action.actorTokenId && token.type === 'player' && token.characterId === action.characterId,
  )
  if (!actor || actor.rulesetId !== 'dnd5e-2014-srd-5.1' || actor.currentHp <= 0 || !actorToken) {
    return { ok: false, reason: 'invalid-actor' }
  }
  if (isMovementLocked(actor.conditions)) return { ok: false, reason: 'movement-locked' }

  const to = snapTokenToGridCenter(action.targetPosition.x, action.targetPosition.y, actorToken, input.map)
  const fromCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
  const toCell = tokenAnchorCellFromPixel(to.x, to.y, actorToken, input.map)
  const distanceFeet = cellDistance(fromCell, toCell) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  const standFromProne = actor.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const movementCostFeet = distanceFeet * (action.dnd5eCarefulMovement ? 2 : 1) +
    (standFromProne ? Math.floor(actor.speed / 2) : 0)
  if (movementCostFeet > input.turnEconomy.movement.current) return { ok: false, reason: 'insufficient-movement' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  actorCombatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  return {
    ok: true,
    prepared: {
      action,
      map: input.map,
      characters: input.characters,
      actor,
      actorToken,
      to,
      distanceFeet,
      movementCostFeet,
      standFromProne,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    },
  }
}

export function resolvePreparedDnd5ePlayerMove(input: {
  prepared: PreparedDnd5ePlayerMove
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'move',
    actorId: prepared.actorToken.id,
    to: prepared.to,
    distance: prepared.distanceFeet,
    standFromProne: prepared.standFromProne,
    carefulMovement: prepared.action.dnd5eCarefulMovement,
  })
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

export type Dnd5eDisengageRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'action-unavailable'
  | 'combatant-missing'

export function resolveDnd5ePlayerDisengage(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
}): { ok: true; result: Dnd5eActionResult; actor: Character } | { ok: false; reason: Dnd5eDisengageRejectReason } {
  if (input.action.type !== 'disengage') return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const token = input.map.tokens.find((item) =>
    item.id === input.action.actorTokenId && item.characterId === input.action.characterId && item.type === 'player',
  )
  if (!actor || actor.rulesetId !== 'dnd5e-2014-srd-5.1' || actor.currentHp <= 0 || !token) {
    return { ok: false, reason: 'invalid-actor' }
  }
  if (input.turnEconomy.action.current < 1) return { ok: false, reason: 'action-unavailable' }
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
    movementRemaining: input.turnEconomy.movement.current,
  }
  const result = resolveDnd5eHeadlessAction(
    { ...snapshot.state, initiativeIndex: actorIndex },
    { type: 'disengage', actorId: token.id },
  )
  return result.ok ? { ok: true, result, actor } : { ok: false, reason: result.reason as Dnd5eDisengageRejectReason }
}
