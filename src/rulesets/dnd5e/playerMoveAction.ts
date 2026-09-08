import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { isMovementLocked } from '../../lib/combatStatus'
import {
  resolveFreeDropCell,
  resolveTokenDropPosition,
  shouldSnapTokenOnDrop,
  snapTokenToGridCenter,
} from '../../lib/gridCombat'
import type { Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  mapGeometryRuntimeForMap,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import {
  dnd5eEffectiveFlySpeed,
  dnd5eEffectiveMovementPoolSpeed,
  dnd5eEffectiveOptionalMovementSpeed,
  dnd5eEffectiveSpeed,
  dnd5eEffectiveWalkSpeed,
  dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks,
  dnd5eGrappleDragExtraMovementFeet,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eOpeningAttackSavingThrowRoll,
} from './headlessCombatEngine'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './persistentAreaGeometry'
import {
  dnd5eFallingDamageDice,
  dnd5eRunningJumpSegments,
  dnd5eTraversalModeRemainingMovementFeet,
  dnd5eTraversalMovementCost,
} from './traversal'
import { dnd5eTurnMovementSpent } from './turnEconomy'
import { dnd5eClimbingMovementCost, dnd5eRunningJumpBonusFeet } from './classes'
import {
  dnd5eActiveJumpDistanceMultiplier,
  dnd5eActivePlanarPhase,
  dnd5eAvailableRestrictedExtraActionKinds,
  dnd5eActiveEnvironmentalCapabilities,
  dnd5eActiveAutomaticEscapePlan,
  dnd5eActiveConditionSpeedReductionApplies,
  dnd5eConditionsFromActiveEffects,
  removeDnd5eActiveEffectsByIds,
  dnd5eActiveMovementBoundarySaves,
  dnd5eActiveMovementRepeatSaves,
  dnd5eActiveRequiresFlightMovement,
  dnd5eActiveSafeFallFeet,
  dnd5eSwallowedCorpseEscapePlan,
  effectiveDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import { dnd5eIsIncapacitated, dnd5eSavingThrowMode } from './passiveDefenses'
import type { PreparedDnd5eOpeningAttackSavingThrow } from './spellAction'

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
  /** Horizontal airborne portion; the remaining path is the Host-derived run-up. */
  jumpDistanceFeet?: number
  toElevationFeet: number
  toGroundElevationFeet: number
  fallingDamageDice: number
  fallingDamageDiceByCombatantId: Readonly<Record<string, number>>
  movementTraces: readonly Dnd5eMapMovementTrace[]
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
  /** Derived from the Host pathfinder result, not from the player request. */
  straightLine: boolean
  standFromProne: boolean
  /** When present, the player attempted to stand but a rule keeps them prone. */
  standPreventedBy?: 'hideous-laughter'
  automaticEscape?: {
    removedEffects: readonly Dnd5eActiveEffectInstance[]
    movementCostFeet: number
  }
  boundarySavingThrows: readonly {
    effectId: string
    sourceActorId: string
    sourceName: string
    requirement: PreparedDnd5eOpeningAttackSavingThrow
  }[]
  movementRepeatSavingThrows: readonly {
    effectId: string
    sourceActorId: string
    sourceName: string
    requirement: PreparedDnd5eOpeningAttackSavingThrow
  }[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
}

function dnd5ePathIsStraightLine(points: readonly { x: number; y: number }[]): boolean {
  if (points.length < 3) return points.length >= 2
  const start = points[0]
  const end = points.at(-1)!
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-8) return false
  return points.slice(1, -1).every((point) => {
    const px = point.x - start.x
    const py = point.y - start.y
    const cross = Math.abs(px * dy - py * dx)
    const dot = px * dx + py * dy
    return cross <= Math.max(1, Math.sqrt(lengthSquared)) * 1e-6 &&
      dot >= -1e-6 && dot <= lengthSquared + 1e-6
  })
}

const CREATURE_SIZE_RANK = {
  微型: 0,
  小型: 1,
  中型: 2,
  大型: 3,
  超大型: 4,
  巨型: 5,
} as const

function explorationCreatureSizeRank(
  token: Token,
  characters: readonly Character[],
): number {
  if (token.creatureSize) return CREATURE_SIZE_RANK[token.creatureSize]
  const character = token.characterId
    ? characters.find((candidate) => candidate.id === token.characterId)
    : undefined
  return character ? migrateCharacterToDnd5e(character).sizeRank : 2
}

function explorationPassThroughTokenIds(input: {
  runtime: ReturnType<typeof createCombatantFromDnd5eCharacter>
  actorToken: Token
  map: BattleMap
  characters: readonly Character[]
}): string[] {
  const minimumDifference = dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks(input.runtime)
  if (minimumDifference == null) return []
  const actorSizeRank = explorationCreatureSizeRank(input.actorToken, input.characters)
  return input.map.tokens
    .filter((token) => token.id !== input.actorToken.id &&
      (token.type === 'player' || token.type === 'enemy') &&
      explorationCreatureSizeRank(token, input.characters) >= actorSizeRank + minimumDifference)
    .map((token) => token.id)
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

  const actorCombatant = createCombatantFromDnd5eCharacter({
    character: migrateCharacterToDnd5e(actor),
    controller: 'player',
    initiativeD20: 10,
    position: { x: actorToken.x, y: actorToken.y },
  })
  const environmentalCapabilities = dnd5eActiveEnvironmentalCapabilities(
    actorCombatant.classState.activeEffects,
  )
  const planarPhase = dnd5eActivePlanarPhase(actorCombatant.classState.activeEffects)
  const ignoresMaterialCollision = planarPhase.plane === 'ethereal' &&
    planarPhase.ignoresMaterialCollision
  // Player spell effects persist on the linked character, while map geometry
  // receives a Token. Project the authoritative effects onto the geometry-only
  // copy so conditional barriers (notably Wind Wall vs Gaseous Form) do not see
  // a stale effect-less Token.
  const actorGeometryToken: Token = {
    ...actorToken,
    dnd5eCombatState: {
      ...actorToken.dnd5eCombatState,
      activeEffects: [...(actorCombatant.classState.activeEffects ?? [])],
    },
  }

  const resolvedDrop = resolveTokenDropPosition(
    action.targetPosition.x,
    action.targetPosition.y,
    actorToken,
    input.map,
  )
  const snapsToGrid = shouldSnapTokenOnDrop(actorToken, input.map)
  const to = snapsToGrid
    ? ignoresMaterialCollision
      ? snapTokenToGridCenter(resolvedDrop.x, resolvedDrop.y, actorToken, input.map)
      : resolveFreeDropCell(resolvedDrop.x, resolvedDrop.y, actorToken.id, input.map)
    : resolvedDrop
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const fromElevationFeet = mapGeometryTokenElevation(geometry, actorToken)
  const fromTerrainElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, actorToken)
  const heightAboveGround = Math.max(0, fromElevationFeet - fromTerrainElevationFeet)
  const targetTerrainElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, to)
  const toElevationFeet = ignoresMaterialCollision
    ? fromElevationFeet
    : targetTerrainElevationFeet + heightAboveGround
  const path = findMapGeometryPath({
    map: {
      ...input.map,
      tokens: input.map.tokens.filter((token) => token.id !== actorToken.id),
    },
    geometry,
    token: actorGeometryToken,
    to,
    canClimb: false,
    canSwim: environmentalCapabilities.treatsLiquidSurfacesAsSolidGround,
    canFly: ignoresMaterialCollision || heightAboveGround > 0,
    targetElevationFeet: toElevationFeet,
    maximumTerrainStepFeet: 10,
    ignoreTokens: ignoresMaterialCollision,
    ignoreGeometryCollision: ignoresMaterialCollision,
    passThroughTokenIds: ignoresMaterialCollision || environmentalCapabilities.canOccupyCreatureSpaces
      ? input.map.tokens
        .filter((token) => token.id !== actorToken.id &&
          (token.type === 'player' || token.type === 'enemy'))
        .map((token) => token.id)
      : explorationPassThroughTokenIds({
          runtime: actorCombatant,
          actorToken,
          map: input.map,
          characters: input.characters,
        }),
    allowOccupiedDestination: ignoresMaterialCollision || environmentalCapabilities.canOccupyCreatureSpaces,
    minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
    ignoreDifficultTerrain: ignoresMaterialCollision || environmentalCapabilities.ignoresDifficultTerrain,
    additionalDifficultTerrainMultiplier: ignoresMaterialCollision
      ? undefined
      : (token, position) =>
          dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
    additionalSpeedCostMultiplier: ignoresMaterialCollision
      ? undefined
      : (token, position) =>
          dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
  })
  if (!path) return { ok: false, reason: 'movement-blocked' }
  const pathPoints = [...path.points]
  const pathElevationsFeet = [...path.elevationsFeet]
  const pathStart = pathPoints[0]
  if (!snapsToGrid && pathStart && Math.hypot(pathStart.x - actorToken.x, pathStart.y - actorToken.y) > 0.001) {
    const pathStartElevationFeet = pathElevationsFeet[0] ?? fromElevationFeet
    if (
      (!ignoresMaterialCollision && Math.abs(pathStartElevationFeet - fromElevationFeet) > 10.001) ||
      (!ignoresMaterialCollision &&
      mapGeometryPlacementBlocked({
        geometry,
        map: input.map,
        token: actorGeometryToken,
        at: pathStart,
        elevationFeet: pathStartElevationFeet,
        minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
      }).blocked) ||
      (!ignoresMaterialCollision &&
      mapGeometryMovementBlocked({
        geometry,
        map: input.map,
        token: actorGeometryToken,
        to: pathStart,
        fromElevationFeet,
        toElevationFeet: pathStartElevationFeet,
        minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
      }).blocked)
    ) return { ok: false, reason: 'movement-blocked' }
    pathPoints.unshift({ x: actorToken.x, y: actorToken.y })
    pathElevationsFeet.unshift(fromElevationFeet)
  }
  const pathEnd = pathPoints.at(-1)
  if (!snapsToGrid && pathEnd && Math.hypot(pathEnd.x - to.x, pathEnd.y - to.y) > 0.001) {
    const pathEndElevationFeet = pathElevationsFeet.at(-1) ?? fromElevationFeet
    if (
      (!ignoresMaterialCollision && Math.abs(toElevationFeet - pathEndElevationFeet) > 10.001) ||
      (!ignoresMaterialCollision &&
      mapGeometryPlacementBlocked({
        geometry,
        map: input.map,
        token: actorGeometryToken,
        at: to,
        elevationFeet: toElevationFeet,
        minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
      }).blocked) ||
      (!ignoresMaterialCollision &&
      mapGeometryMovementBlocked({
        geometry,
        map: input.map,
        token: { ...actorGeometryToken, ...pathEnd, elevationFeet: pathEndElevationFeet },
        to,
        fromElevationFeet: pathEndElevationFeet,
        toElevationFeet,
        minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
      }).blocked)
    ) return { ok: false, reason: 'movement-blocked' }
    pathPoints.push(to)
    pathElevationsFeet.push(toElevationFeet)
  }

  return {
    ok: true,
    prepared: {
      actor,
      actorToken,
      to,
      toElevationFeet,
      path: pathPoints,
      pathElevationsFeet,
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
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  const actorGeometryToken: Token = {
    ...actorToken,
    dnd5eCombatState: {
      ...actorToken.dnd5eCombatState,
      activeEffects: [...(actorCombatant.classState.activeEffects ?? [])],
    },
  }
  const activeTurnKey = `${action.combatId ?? `map-${input.map.id}`}:${Math.max(1, action.round)}:${
    input.initiativeOrder[action.initiativeIndex]?.slotId ?? actorToken.id
  }`
  if (actorCombatant.classState.movementStoppedTurnKey === activeTurnKey) {
    return { ok: false, reason: 'insufficient-movement' }
  }
  // A movement declaration may spend movement to release only the closed,
  // nonmagical locks granted by an automatic-escape Active Effect. Other zero
  // speed conditions remain authoritative and keep the move rejected.
  const automaticEscapePlan = dnd5eActiveAutomaticEscapePlan(actorCombatant.classState.activeEffects)
  const swallowedCorpseEscapePlan = dnd5eSwallowedCorpseEscapePlan(
    actorCombatant.classState.activeEffects,
  )
  const automaticEscapeEffects = automaticEscapePlan
    ? (actorCombatant.classState.activeEffects ?? []).filter((effect) =>
        automaticEscapePlan.effectIds.includes(effect.id))
    : []
  if (automaticEscapeEffects.length > 0) {
    const removal = removeDnd5eActiveEffectsByIds({
      effects: actorCombatant.classState.activeEffects,
      ids: automaticEscapeEffects.map((effect) => effect.id),
    })
    actorCombatant.classState.activeEffects = removal.effects
    actorCombatant.conditions = dnd5eConditionsFromActiveEffects(actorCombatant.classState.activeEffects)
  }
  // The snapshot reconciles source-linked effects first. Checking the projected
  // Headless conditions prevents a stale, already-invalid grapple from pinning
  // the player on the live map.
  if (isMovementLocked(actorCombatant.conditions.filter((condition) =>
    dnd5eActiveConditionSpeedReductionApplies(actorCombatant.classState.activeEffects, condition)))) {
    return { ok: false, reason: 'movement-locked' }
  }
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
  const usesLongJump = traversalMode === 'long-jump-running' || traversalMode === 'long-jump-standing'
  if (
    dnd5eActiveRequiresFlightMovement(actorCombatant.classState.activeEffects) &&
    traversalMode !== 'fly'
  ) return { ok: false, reason: 'movement-blocked' }
  const environmentalCapabilities = dnd5eActiveEnvironmentalCapabilities(
    actorCombatant.classState.activeEffects,
  )
  const planarPhase = dnd5eActivePlanarPhase(actorCombatant.classState.activeEffects)
  const ignoresMaterialCollision = planarPhase.plane === 'ethereal' &&
    planarPhase.ignoresMaterialCollision
  const requestedElevationFeet = Number.isFinite(action.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, Math.floor(action.targetElevationFeet!)))
    : fromElevationFeet
  const toGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, to)
  const toElevationFeet = ignoresMaterialCollision && traversalMode !== 'fly'
    ? fromElevationFeet
    : traversalMode === 'walk' || traversalMode === 'swim'
    ? toGroundElevationFeet
    : requestedElevationFeet
  const path = findMapGeometryPath({
    geometry, map: pathfindingMap, token: actorGeometryToken, to,
    canClimb: traversalMode === 'climb' || traversalMode === 'fly',
    canSwim: traversalMode === 'swim' || environmentalCapabilities.treatsLiquidSurfacesAsSolidGround,
    canFly: traversalMode === 'fly' || ignoresMaterialCollision,
    targetElevationFeet: toElevationFeet,
    // A jump is airborne between takeoff and landing. The traversal primitive
    // below validates its actual horizontal and vertical limits; the walking
    // pathfinder must not reject it first with the ordinary 10-foot step rule.
    maximumTerrainStepFeet: traversalMode === 'fall' || usesLongJump ? 10_000 : 10,
    ignoreTokens: ignoresMaterialCollision,
    ignoreGeometryCollision: ignoresMaterialCollision,
    passThroughTokenIds: (() => {
      if (ignoresMaterialCollision || environmentalCapabilities.canOccupyCreatureSpaces) {
        return input.map.tokens
          .filter((token) => token.id !== actorToken.id)
          .map((token) => token.id)
      }
      const minimumDifference = dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks(actorCombatant)
      if (minimumDifference == null) return []
      return input.map.tokens
        .filter((token) => token.id !== actorToken.id &&
          (snapshot.state.combatants[token.id]?.sizeRank ?? 2) >= actorCombatant.sizeRank + minimumDifference)
        .map((token) => token.id)
    })(),
    allowOccupiedDestination: ignoresMaterialCollision || environmentalCapabilities.canOccupyCreatureSpaces,
    minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
    ignoreDifficultTerrain: ignoresMaterialCollision || usesLongJump || environmentalCapabilities.ignoresDifficultTerrain || (
      actorCombatant.ignoreDifficultTerrainWhileDashing === true &&
      actorCombatant.classState.dashedTurnKey === `${action.combatId ?? `map-${input.map.id}`}:${Math.max(1, action.round)}:${input.initiativeOrder[action.initiativeIndex]?.slotId ?? actorToken.id}`
    ),
    additionalDifficultTerrainMultiplier: ignoresMaterialCollision
      ? undefined
      : (token, position) => usesLongJump
        ? 1
        : dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
    additionalSpeedCostMultiplier: ignoresMaterialCollision
      ? undefined
      : (token, position) =>
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
  const runningJump = traversalMode === 'long-jump-running'
    ? dnd5eRunningJumpSegments({
        distanceFeet: path.distanceFeet,
        approachFeetAlready: actorCombatant.classState.runningJumpApproachFeet,
        minimumApproachFeet: actorCombatant.runningJumpMinimumApproachFeet,
      })
    : undefined
  if (runningJump && !runningJump.hasRunningStart) return { ok: false, reason: 'movement-blocked' }
  const jumpDistanceFeet = runningJump?.jumpDistanceFeet ?? path.distanceFeet
  const traversalProfile = {
    strengthScore: actorCombatant.abilities.str,
    strengthModifier: Math.floor((actorCombatant.abilities.str - 10) / 2),
    movementPoolSpeed: dnd5eEffectiveMovementPoolSpeed(actorCombatant),
    walkSpeed: dnd5eEffectiveWalkSpeed(actorCombatant),
    climbSpeed: dnd5eEffectiveOptionalMovementSpeed(actorCombatant, 'climb'),
    swimSpeed: dnd5eEffectiveOptionalMovementSpeed(actorCombatant, 'swim'),
    flySpeed: planarPhase.unrestrictedVerticalMovement
      ? dnd5eEffectiveSpeed(actorCombatant)
      : dnd5eEffectiveFlySpeed(actorCombatant),
    verticalFlightCostMultiplier: planarPhase.unrestrictedVerticalMovement ? 2 : 1,
    climbWithoutSpeedCostMultiplier: Math.min(
      actorCombatant.climbWithoutSpeedCostMultiplier ?? 2,
      dnd5eClimbingMovementCost(actor, 1),
    ),
    runningLongJumpBonusFeet: dnd5eRunningJumpBonusFeet(actor),
    jumpDistanceMultiplier: dnd5eActiveJumpDistanceMultiplier(actorCombatant.classState.activeEffects),
    ignoreUnderwaterMovementPenalty: environmentalCapabilities.ignoresUnderwaterMovementPenalty,
  }
  const traversal = dnd5eTraversalMovementCost({
    distanceFeet: jumpDistanceFeet,
    baseMovementCostFeet: path.movementCostFeet,
    // Flight pays for absolute vertical change; walk/climb only charge ascent.
    elevationGainFeet: traversalMode === 'fly'
      ? Math.abs(toElevationFeet - fromElevationFeet)
      : Math.max(0, toElevationFeet - fromElevationFeet),
    mode: traversalMode,
    profile: traversalProfile,
  })
  if (!traversal.ok) return { ok: false, reason: 'movement-blocked' }
  const locomotionCostFeet = traversal.movementCostFeet +
    (action.dnd5eCarefulMovement ? path.distanceFeet : 0) +
    (isProne && !standFromProne ? path.distanceFeet : 0)
  const movementCostFeet = locomotionCostFeet +
    (standFromProne
      ? Math.min(
          Math.floor(dnd5eEffectiveSpeed(actorCombatant) / 2),
          actorCombatant.standFromProneMovementCostFeet ?? Number.POSITIVE_INFINITY,
        )
      : 0) +
    dnd5eGrappleDragExtraMovementFeet(snapshot.state, actorToken.id, locomotionCostFeet) +
    (automaticEscapePlan?.movementCostFeet ?? 0) +
    (swallowedCorpseEscapePlan?.movementCostFeet ?? 0)
  const movementSpentFeet = dnd5eTurnMovementSpent(input.turnEconomy)
  const modeMovementRemainingFeet = dnd5eTraversalModeRemainingMovementFeet({
    movementRemainingFeet: input.turnEconomy.movement.current,
    movementSpentFeet,
    mode: traversalMode,
    profile: traversalProfile,
  })
  if (
    movementCostFeet > input.turnEconomy.movement.current ||
    movementCostFeet > modeMovementRemainingFeet
  ) return { ok: false, reason: 'insufficient-movement' }
  const boundarySavingThrows = dnd5eActiveMovementBoundarySaves(actorCombatant.classState.activeEffects)
    .flatMap((boundary) => {
      const source = snapshot.state.combatants[boundary.sourceActorId]
      if (!source) return []
      const destinationDistance = Math.hypot(to.x - source.position.x, to.y - source.position.y)
      if (destinationDistance <= boundary.maximumDistanceFeet + 1e-6) return []
      const activeEffects = effectiveDnd5eActiveEffects(actorCombatant.classState.activeEffects)
      return [{
        effectId: boundary.effectId,
        sourceActorId: source.id,
        sourceName: source.name,
        requirement: {
          featureId: boundary.effectId,
          ability: boundary.ability,
          dc: boundary.dc,
          modifier: actorCombatant.savingThrowBonuses[boundary.ability] ??
            Math.floor((actorCombatant.abilities[boundary.ability] - 10) / 2),
          mode: dnd5eSavingThrowMode(actorCombatant, boundary.ability),
          blessed: activeEffects.some((effect) => effect.source.rulesId === 'bless'),
          baned: activeEffects.some((effect) => effect.source.rulesId === 'bane'),
          failureDamageMultiplier: 1,
        },
      }]
    })
  const movementRepeatSavingThrows = dnd5eActiveMovementRepeatSaves(actorCombatant.classState.activeEffects)
    .flatMap((repeat) => {
      const source = snapshot.state.combatants[repeat.sourceActorId]
      if (!source || distanceFeet <= 0) return []
      const activeEffects = effectiveDnd5eActiveEffects(actorCombatant.classState.activeEffects)
      return [{
        effectId: repeat.effectId,
        sourceActorId: source.id,
        sourceName: source.name,
        requirement: {
          featureId: repeat.effectId,
          ability: repeat.ability,
          dc: repeat.dc,
          modifier: actorCombatant.savingThrowBonuses[repeat.ability] ??
            Math.floor((actorCombatant.abilities[repeat.ability] - 10) / 2),
          mode: dnd5eSavingThrowMode(actorCombatant, repeat.ability),
          blessed: activeEffects.some((effect) => effect.source.rulesId === 'bless'),
          baned: activeEffects.some((effect) => effect.source.rulesId === 'bane'),
          failureDamageMultiplier: 1,
        },
      }]
    })
  actorCombatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    movementRemaining: input.turnEconomy.movement.current,
    movementSpent: movementSpentFeet,
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
      ...(runningJump ? { jumpDistanceFeet } : {}),
      toElevationFeet,
      toGroundElevationFeet,
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
      straightLine: dnd5ePathIsStraightLine(path.points),
      standFromProne,
      standPreventedBy: isProne && cannotStand && action.dnd5eStandFromProne !== false
        ? 'hideous-laughter'
        : undefined,
      automaticEscape: automaticEscapeEffects.length > 0 && automaticEscapePlan
        ? { removedEffects: automaticEscapeEffects, movementCostFeet: automaticEscapePlan.movementCostFeet }
        : undefined,
      boundarySavingThrows,
      movementRepeatSavingThrows,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    },
  }
}

export function resolvePreparedDnd5ePlayerMove(input: {
  prepared: PreparedDnd5ePlayerMove
  boundarySavingThrows?: readonly (Dnd5eOpeningAttackSavingThrowRoll & { effectId: string })[]
  movementRepeatSavingThrows?: readonly (Dnd5eOpeningAttackSavingThrowRoll & { effectId: string })[]
  fallingDamageRolls?: readonly number[]
  fallingDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'move',
    actorId: prepared.actorToken.id,
    to: prepared.to,
    distance: prepared.distanceFeet,
    jumpDistance: prepared.jumpDistanceFeet,
    straightLine: prepared.straightLine,
    movementCost: prepared.movementCostFeet,
    movementCostIncludesDrag: true,
    standFromProne: prepared.standFromProne,
    carefulMovement: prepared.action.dnd5eCarefulMovement,
    traversalMode: prepared.action.dnd5eTraversalMode,
    toElevationFeet: prepared.toElevationFeet,
    toGroundElevationFeet: prepared.toGroundElevationFeet,
    boundarySavingThrows: input.boundarySavingThrows,
    movementRepeatSavingThrows: input.movementRepeatSavingThrows,
    fallingDamageRolls: input.fallingDamageRolls,
    fallingDamageRollsByCombatantId: input.fallingDamageRollsByCombatantId,
  })
  if (!result.ok) return { result }
  const escapeEvents = prepared.automaticEscape?.removedEffects.flatMap((effect) => [
    {
      type: 'active-effect-removed' as const,
      targetId: prepared.actorToken.id,
      effectId: effect.id,
      definitionId: effect.definitionId,
      reason: 'escaped' as const,
    },
    ...(effect.standardCondition ? [{
      type: 'condition-ended' as const,
      targetId: prepared.actorToken.id,
      condition: effect.standardCondition,
    }] : []),
  ]) ?? []
  const resolvedResult: Dnd5eActionResult = escapeEvents.length
    ? { ...result, events: [...result.events, ...escapeEvents] }
    : result
  return {
    result: resolvedResult,
    application: planDnd5eMapResultApplication({
      state: resolvedResult.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events: [...resolvedResult.events],
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
  const restrictedDisengageAvailable = dnd5eAvailableRestrictedExtraActionKinds({
    effects: actor.dnd5eCombatState?.activeEffects,
    usesByEffect: actor.dnd5eCombatState?.restrictedExtraActionUsesByEffect,
    turnKey: input.turnEconomy.turnKey,
  }).includes('disengage')
  if (input.turnEconomy.action.current < 1 && !restrictedDisengageAvailable) {
    return { ok: false, reason: 'action-unavailable' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    token.id,
    input.action.initiativeIndex,
  )
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
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    token.id,
    input.action.initiativeIndex,
  )
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
      events: [...result.events],
    }),
  }
}
