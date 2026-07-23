import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { isMovementLocked } from '../../lib/combatStatus'
import { snapTokenToGridCenter } from '../../lib/gridCombat'
import type { Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { dnd5eEffectiveSpeed, resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './pluginAreas'
import { dnd5eFallingDamageDice, dnd5eTraversalMovementCost } from './traversal'
import { dnd5eClimbingMovementCost, dnd5eRunningJumpBonusFeet } from './classes'

export type Dnd5ePlayerMoveRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'movement-locked'
  | 'movement-blocked'
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
  toElevationFeet: number
  fallingDamageDice: number
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
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
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const traversalMode = action.dnd5eTraversalMode ?? 'walk'
  const requestedElevationFeet = Number.isFinite(action.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, Math.floor(action.targetElevationFeet!)))
    : actorToken.elevationFeet ?? 0
  const toElevationFeet = traversalMode === 'walk' || traversalMode === 'swim'
    ? mapGeometryTerrainElevationAtPoint(geometry, to)
    : requestedElevationFeet
  const path = findMapGeometryPath({
    geometry, map: input.map, token: actorToken, to,
    canClimb: traversalMode === 'climb' || traversalMode === 'fly',
    canSwim: traversalMode === 'swim',
    canFly: traversalMode === 'fly',
    targetElevationFeet: toElevationFeet,
    maximumTerrainStepFeet: traversalMode === 'fall' ? 10_000 : 10,
    additionalDifficultTerrainMultiplier: (token, position) =>
      dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
    additionalSpeedCostMultiplier: (token, position) =>
      dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
  })
  if (!path) return { ok: false, reason: 'movement-blocked' }
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
  const distanceFeet = path.distanceFeet
  const isProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const cannotStand = actorCombatant.classState.activeEffects?.some((effect) =>
    effect.source.kind === 'spell' && effect.source.rulesId === 'hideous-laughter',
  ) === true
  const standFromProne = isProne && !cannotStand && action.dnd5eStandFromProne !== false
  const traversal = dnd5eTraversalMovementCost({
    distanceFeet: path.distanceFeet,
    baseMovementCostFeet: path.movementCostFeet,
    elevationGainFeet: Math.max(0, toElevationFeet - (actorToken.elevationFeet ?? 0)),
    mode: traversalMode,
    profile: {
      strengthScore: actorCombatant.abilities.str,
      strengthModifier: Math.floor((actorCombatant.abilities.str - 10) / 2),
      walkSpeed: actorCombatant.movementSpeeds?.walk ?? actorCombatant.speed,
      climbSpeed: actorCombatant.movementSpeeds?.climb,
      swimSpeed: actorCombatant.movementSpeeds?.swim,
      flySpeed: actorCombatant.movementSpeeds?.fly,
      climbWithoutSpeedCostMultiplier: dnd5eClimbingMovementCost(actor, 1),
      runningLongJumpBonusFeet: dnd5eRunningJumpBonusFeet(actor),
    },
  })
  if (!traversal.ok) return { ok: false, reason: 'movement-blocked' }
  const movementCostFeet = traversal.movementCostFeet +
    (action.dnd5eCarefulMovement ? path.distanceFeet : 0) +
    (isProne && !standFromProne ? path.distanceFeet : 0) +
    (standFromProne ? Math.floor(dnd5eEffectiveSpeed(actorCombatant) / 2) : 0)
  if (movementCostFeet > input.turnEconomy.movement.current) return { ok: false, reason: 'insufficient-movement' }
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
      toElevationFeet,
      fallingDamageDice: traversalMode === 'fall'
        ? dnd5eFallingDamageDice(Math.max(0, (actorToken.elevationFeet ?? 0) - toElevationFeet))
        : 0,
      path: path.points,
      pathElevationsFeet: path.elevationsFeet,
      standFromProne,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    },
  }
}

export function resolvePreparedDnd5ePlayerMove(input: {
  prepared: PreparedDnd5ePlayerMove
  fallingDamageRolls?: readonly number[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'move',
    actorId: prepared.actorToken.id,
    to: prepared.to,
    distance: prepared.distanceFeet,
    movementCost: prepared.movementCostFeet,
    standFromProne: prepared.standFromProne,
    carefulMovement: prepared.action.dnd5eCarefulMovement,
    traversalMode: prepared.action.dnd5eTraversalMode,
    toElevationFeet: prepared.toElevationFeet,
    fallingDamageRolls: input.fallingDamageRolls,
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

export function resolveDnd5ePlayerDodge(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
}): {
  ok: true
  result: Dnd5eActionResult
  actor: Character
  application: Dnd5eMapResultPlan
} | { ok: false; reason: Dnd5eDisengageRejectReason } {
  if (input.action.type !== 'dodge') return { ok: false, reason: 'invalid-action' }
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
    actionAvailable: true,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const result = resolveDnd5eHeadlessAction(
    { ...snapshot.state, initiativeIndex: actorIndex },
    { type: 'dodge', actorId: token.id },
  )
  if (!result.ok) return { ok: false, reason: result.reason as Dnd5eDisengageRejectReason }
  return {
    ok: true,
    result,
    actor,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    }),
  }
}
