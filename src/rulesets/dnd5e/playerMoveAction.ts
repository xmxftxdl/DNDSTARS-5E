import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { isMovementLocked } from '../../lib/combatStatus'
import {
  resolveFreeDropCell,
  resolveTokenDropPosition,
  snapTokenToGridCenter,
} from '../../lib/gridCombat'
import type { Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import {
  dnd5eEffectiveFlySpeed,
  dnd5eEffectiveSpeed,
  dnd5eGrappleDragExtraMovementFeet,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './pluginAreas'
import { dnd5eFallingDamageDice, dnd5eTraversalMovementCost } from './traversal'
import { dnd5eClimbingMovementCost, dnd5eRunningJumpBonusFeet } from './classes'
import { dnd5eActiveJumpDistanceMultiplier, dnd5eActiveSafeFallFeet } from './activeEffects'
import { dnd5eIsIncapacitated } from './passiveDefenses'

export type Dnd5ePlayerMoveRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'movement-locked'
  | 'movement-blocked'
  | 'insufficient-movement'
  | 'combatant-missing'

export type Dnd5eExplorationMoveRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'movement-locked'
  | 'movement-blocked'

export interface PreparedDnd5eExplorationMove {
  actor: Character
  actorToken: Token
  to: { x: number; y: number }
  toElevationFeet: number
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
}

export interface Dnd5eMapMovementTrace {
  tokenId: string
  to: { x: number; y: number }
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
}

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
  fallingDamageDiceByCombatantId: Readonly<Record<string, number>>
  movementTraces: readonly Dnd5eMapMovementTrace[]
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
  standFromProne: boolean
  /** When present, the player attempted to stand but a rule keeps them prone. */
  standPreventedBy?: 'hideous-laughter'
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
}

/**
 * Validates free exploration movement without creating a combat turn or
 * spending turn economy. The DM Host canonicalizes the destination and path,
 * so a player cannot bypass walls, occupied cells, terrain steps, ownership,
 * or movement-locking conditions by forging the client request.
 */
export function prepareDnd5eExplorationMove(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
}): { ok: true; prepared: PreparedDnd5eExplorationMove } | {
  ok: false
  reason: Dnd5eExplorationMoveRejectReason
} {
  const { action } = input
  if (
    action.type !== 'move-token' ||
    action.combatId != null ||
    !action.targetPosition ||
    !Number.isFinite(action.targetPosition.x) ||
    !Number.isFinite(action.targetPosition.y)
  ) return { ok: false, reason: 'invalid-action' }

  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) =>
    token.id === action.actorTokenId &&
    token.type === 'player' &&
    token.characterId === action.characterId,
  )
  if (
    !actor ||
    actor.rulesetId !== 'dnd5e-2014-srd-5.1' ||
    actor.currentHp <= 0 ||
    !actorToken
  ) return { ok: false, reason: 'invalid-actor' }
  if (isMovementLocked(actor.conditions)) return { ok: false, reason: 'movement-locked' }

  const snapped = resolveTokenDropPosition(
    action.targetPosition.x,
    action.targetPosition.y,
    actorToken,
    input.map,
  )
  const to = resolveFreeDropCell(snapped.x, snapped.y, actorToken.id, input.map)
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const fromElevationFeet = mapGeometryTokenElevation(geometry, actorToken)
  const fromTerrainElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, actorToken)
  const heightAboveGround = Math.max(0, fromElevationFeet - fromTerrainElevationFeet)
  const targetTerrainElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, to)
  const toElevationFeet = targetTerrainElevationFeet + heightAboveGround
  const path = findMapGeometryPath({
    map: {
      ...input.map,
      tokens: input.map.tokens.filter((token) => token.id !== actorToken.id),
    },
    geometry,
    token: actorToken,
    to,
    canClimb: false,
    canSwim: false,
    canFly: heightAboveGround > 0,
    targetElevationFeet: toElevationFeet,
    maximumTerrainStepFeet: 10,
  })
  if (!path) return { ok: false, reason: 'movement-blocked' }

  return {
    ok: true,
    prepared: {
      actor,
      actorToken,
      to,
      toElevationFeet,
      path: path.points,
      pathElevationsFeet: path.elevationsFeet,
    },
  }
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
  // The snapshot reconciles source-linked effects first. Checking the projected
  // Headless conditions prevents a stale, already-invalid grapple from pinning
  // the player on the live map.
  if (isMovementLocked(actorCombatant.conditions)) return { ok: false, reason: 'movement-locked' }
  const draggedTargetTokens = input.map.tokens.filter((candidate) => {
    const targetCombatant = snapshot.state.combatants[candidate.id]
    return targetCombatant?.classState.activeEffects?.some((effect) =>
      effect.standardCondition === 'grappled' &&
      !effect.dependsOnEffectId &&
      effect.relation?.kind === 'grapple' &&
      effect.relation.movement === 'drag-target' &&
      effect.relation.sourceActorId === actorToken.id &&
      effect.source.actorId === actorToken.id)
  })
  // The actor and all attached targets form one moving body. Leaving a dragged
  // target in the occupancy map makes it incorrectly block the source path.
  const movingIds = new Set([actorToken.id, ...draggedTargetTokens.map((target) => target.id)])
  const pathfindingMap = {
    ...input.map,
    tokens: input.map.tokens.filter((candidate) => !movingIds.has(candidate.id)),
  }

  const to = snapTokenToGridCenter(action.targetPosition.x, action.targetPosition.y, actorToken, input.map)
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const fromElevationFeet = mapGeometryTokenElevation(geometry, actorToken)
  const traversalMode = action.dnd5eTraversalMode ?? 'walk'
  const requestedElevationFeet = Number.isFinite(action.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, Math.floor(action.targetElevationFeet!)))
    : fromElevationFeet
  const toElevationFeet = traversalMode === 'walk' || traversalMode === 'swim'
    ? mapGeometryTerrainElevationAtPoint(geometry, to)
    : requestedElevationFeet
  const path = findMapGeometryPath({
    geometry, map: pathfindingMap, token: actorToken, to,
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
  const distanceFeet = path.distanceFeet
  const draggedMovementTraces: Dnd5eMapMovementTrace[] = []
  if (draggedTargetTokens.length > 0) {
    const dragMap = pathfindingMap
    const sourcePathStart = path.points[0] ?? { x: actorToken.x, y: actorToken.y }
    const sourceElevationStart = path.elevationsFeet[0] ?? fromElevationFeet
    for (const draggedTarget of draggedTargetTokens) {
      const draggedElevationStart = mapGeometryTokenElevation(geometry, draggedTarget)
      let draggedToken = { ...draggedTarget, elevationFeet: draggedElevationStart }
      let expectedFrom = { x: draggedTarget.x, y: draggedTarget.y }
      const translatedPath = [{ ...expectedFrom }]
      const translatedElevationsFeet = [draggedElevationStart]
      for (let index = 1; index < path.points.length; index += 1) {
        const sourcePoint = path.points[index]
        const expectedTo = {
          x: draggedTarget.x + sourcePoint.x - sourcePathStart.x,
          y: draggedTarget.y + sourcePoint.y - sourcePathStart.y,
        }
        const expectedElevation = draggedElevationStart +
          (path.elevationsFeet[index] ?? sourceElevationStart) - sourceElevationStart
        const draggedSegment = findMapGeometryPath({
          geometry,
          map: dragMap,
          token: draggedToken,
          to: expectedTo,
          canClimb: traversalMode === 'climb' || traversalMode === 'fly',
          canSwim: traversalMode === 'swim',
          canFly: traversalMode === 'fly',
          targetElevationFeet: expectedElevation,
          maximumTerrainStepFeet: traversalMode === 'fall' ? 10_000 : 10,
          additionalDifficultTerrainMultiplier: (token, position) =>
            dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
          additionalSpeedCostMultiplier: (token, position) =>
            dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
        })
        const followsTranslatedSegment = draggedSegment?.points.length === 2 &&
          draggedSegment.points[0].x === expectedFrom.x &&
          draggedSegment.points[0].y === expectedFrom.y &&
          draggedSegment.points[1].x === expectedTo.x &&
          draggedSegment.points[1].y === expectedTo.y &&
          draggedSegment.elevationsFeet.at(-1) === expectedElevation
        if (!followsTranslatedSegment) return { ok: false, reason: 'movement-blocked' }
        expectedFrom = expectedTo
        draggedToken = { ...draggedToken, ...expectedTo, elevationFeet: expectedElevation }
        translatedPath.push(expectedTo)
        translatedElevationsFeet.push(expectedElevation)
      }
      draggedMovementTraces.push({
        tokenId: draggedTarget.id,
        to: { ...expectedFrom },
        path: translatedPath,
        pathElevationsFeet: translatedElevationsFeet,
      })
    }
  }
  const isProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const cannotStand = actorCombatant.classState.activeEffects?.some((effect) =>
    effect.source.kind === 'spell' && effect.source.rulesId === 'hideous-laughter',
  ) === true
  const standFromProne = isProne && !cannotStand && action.dnd5eStandFromProne !== false
  const traversal = dnd5eTraversalMovementCost({
    distanceFeet: path.distanceFeet,
    baseMovementCostFeet: path.movementCostFeet,
    elevationGainFeet: Math.max(0, toElevationFeet - fromElevationFeet),
    mode: traversalMode,
    profile: {
      strengthScore: actorCombatant.abilities.str,
      strengthModifier: Math.floor((actorCombatant.abilities.str - 10) / 2),
      walkSpeed: actorCombatant.movementSpeeds?.walk ?? actorCombatant.speed,
      climbSpeed: actorCombatant.movementSpeeds?.climb,
      swimSpeed: actorCombatant.movementSpeeds?.swim,
      flySpeed: dnd5eEffectiveFlySpeed(actorCombatant),
      climbWithoutSpeedCostMultiplier: dnd5eClimbingMovementCost(actor, 1),
      runningLongJumpBonusFeet: dnd5eRunningJumpBonusFeet(actor),
      jumpDistanceMultiplier: dnd5eActiveJumpDistanceMultiplier(actorCombatant.classState.activeEffects),
    },
  })
  if (!traversal.ok) return { ok: false, reason: 'movement-blocked' }
  const locomotionCostFeet = traversal.movementCostFeet +
    (action.dnd5eCarefulMovement ? path.distanceFeet : 0) +
    (isProne && !standFromProne ? path.distanceFeet : 0)
  const movementCostFeet = locomotionCostFeet +
    (standFromProne ? Math.floor(dnd5eEffectiveSpeed(actorCombatant) / 2) : 0) +
    dnd5eGrappleDragExtraMovementFeet(snapshot.state, actorToken.id, locomotionCostFeet)
  if (movementCostFeet > input.turnEconomy.movement.current) return { ok: false, reason: 'insufficient-movement' }
  actorCombatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const fallDistanceFeet = traversalMode === 'fall'
    ? Math.max(0, fromElevationFeet - toElevationFeet)
    : 0
  const fallingDamageDiceByCombatantId = Object.fromEntries(
    [actorToken, ...draggedTargetTokens].map((token) => {
      const combatant = snapshot.state.combatants[token.id]
      const safeFall = !!combatant &&
        fallDistanceFeet <= dnd5eActiveSafeFallFeet(combatant.classState.activeEffects) &&
        !dnd5eIsIncapacitated(combatant)
      return [
        token.id,
        traversalMode === 'fall' && !safeFall ? dnd5eFallingDamageDice(fallDistanceFeet) : 0,
      ]
    }),
  )
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
      fallingDamageDice: fallingDamageDiceByCombatantId[actorToken.id] ?? 0,
      fallingDamageDiceByCombatantId,
      movementTraces: [
        {
          tokenId: actorToken.id,
          to,
          path: path.points,
          pathElevationsFeet: path.elevationsFeet,
        },
        ...draggedMovementTraces,
      ],
      path: path.points,
      pathElevationsFeet: path.elevationsFeet,
      standFromProne,
      standPreventedBy: isProne && cannotStand && action.dnd5eStandFromProne !== false
        ? 'hideous-laughter'
        : undefined,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    },
  }
}

export function resolvePreparedDnd5ePlayerMove(input: {
  prepared: PreparedDnd5ePlayerMove
  fallingDamageRolls?: readonly number[]
  fallingDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'move',
    actorId: prepared.actorToken.id,
    to: prepared.to,
    distance: prepared.distanceFeet,
    movementCost: prepared.movementCostFeet,
    movementCostIncludesDrag: true,
    standFromProne: prepared.standFromProne,
    carefulMovement: prepared.action.dnd5eCarefulMovement,
    traversalMode: prepared.action.dnd5eTraversalMode,
    toElevationFeet: prepared.toElevationFeet,
    fallingDamageRolls: input.fallingDamageRolls,
    fallingDamageRollsByCombatantId: input.fallingDamageRollsByCombatantId,
  })
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events: [...result.events],
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
