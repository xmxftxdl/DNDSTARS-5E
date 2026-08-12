import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells } from '../../lib/skillTargeting'
import {
  mapGeometryLineOfEffectBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  resolveDnd5eHeadlessAction,
  previewDnd5eUnsupportedAirborneFalls,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterAreaActionResolutionV1,
  type Dnd5eSpellForcedMovement,
  type Dnd5eUnsupportedAirborneFallPreview,
} from './headlessCombatEngine'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eMonsterAreaSavingThrowEffect,
  dnd5eMonsterRequiredAreaSavingThrowVariantId,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterAreaSavingThrowVariant,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import {
  dnd5eForcedMovementFall,
  dnd5eForcedPushDestination,
} from './spellAction'
import {
  dnd5eInstantAoeAffectsTokenVertically,
  dnd5eTokenToPointDistanceFeet,
} from './verticalCombatGeometry'
import { dnd5eTraversalMovementCost } from './traversal'

export type Dnd5eMonsterAreaActionRejectReason =
  | 'invalid-actor'
  | 'invalid-action'
  | 'invalid-target'
  | 'line-of-effect-blocked'
  | 'resource-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eMonsterAreaAction {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actorToken: Token
  targetTokens: readonly Token[]
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  variant: Dnd5eMonsterAreaSavingThrowVariant
  areaTargetCell: GridCell
  areaTargetOrientation?: 0 | 1 | 2 | 3
  areaTargetElevationFeet?: number
  actorMovement?: Dnd5eMonsterAreaActionResolutionV1['actorMovement']
}

export interface Dnd5eMonsterAreaForcedMovementPlan extends Dnd5eSpellForcedMovement {
  sourceElevationFeet: number
  sourceGroundElevationFeet: number
  landingGroundElevationFeet: number
  groundedAtSource: boolean
  fallDistanceFeet: number
}

export interface Dnd5eMonsterAreaExitOption extends Dnd5eMonsterAreaForcedMovementPlan {
  cell: GridCell
}

function isBanishedMonsterAreaCreature(
  token: Token,
  character: Character | undefined,
): boolean {
  const tokenState = token.dnd5eCombatState
  const characterState = character?.dnd5eCombatState
  if (
    tokenState?.hurlThroughHellSourceId ||
    characterState?.hurlThroughHellSourceId
  ) return true
  const conditions = [
    ...(character?.conditions ?? []),
    ...(tokenState?.conditions ?? []),
    ...dnd5eConditionsFromActiveEffects(tokenState?.activeEffects),
    ...dnd5eConditionsFromActiveEffects(characterState?.activeEffects),
  ]
  return conditions.some((condition) =>
    ['banished', '\u653e\u9010'].includes(condition.trim().toLowerCase()))
}

function isPresentMonsterAreaCreature(
  token: Token,
  characters: readonly Character[],
): boolean {
  if (token.type === 'obstacle') return false
  const character = token.characterId
    ? characters.find((candidate) => candidate.id === token.characterId)
    : undefined
  if (isBanishedMonsterAreaCreature(token, character)) return false
  if (character) {
    // An unconscious or stable player at 0 HP remains a creature in the area.
    // Three failed death saves is the persisted marker for a dead character.
    return character.currentHp > 0 || (character.deathSaveFailures ?? 0) < 3
  }
  if (token.maxHp != null) {
    return (token.hp ?? token.maxHp) > 0 ||
      token.dnd5eCombatState?.stableAtZero === true ||
      token.dnd5eCombatState?.monsterRegenerationPendingAtZero === true ||
      token.dnd5eCombatState?.undeadFortitudePending != null
  }
  return true
}

/**
 * Converts a structured monster-area push into map-authoritative destinations.
 * A zero-distance entry is intentional: Headless still requires one signed
 * outcome for every submitted target, even when a wall, token or map edge
 * prevents movement.
 */
export function dnd5eMonsterAreaForcedMovementPlans(
  prepared: PreparedDnd5eMonsterAreaAction,
): readonly Dnd5eMonsterAreaForcedMovementPlan[] {
  const forcedMovement = prepared.variant.forcedMovementOnFailedSave
  if (!forcedMovement) return []
  const geometry = mapGeometryRuntimeForMap(prepared.map.id)
  return prepared.targetTokens.map((target) => {
    const destination = dnd5eForcedPushDestination(
      prepared.map,
      prepared.actorToken,
      target,
      forcedMovement.maximumDistanceFeet,
    )
    const fall = dnd5eForcedMovementFall({
      geometry,
      target,
      targetCombatant: prepared.state.combatants[target.id],
      to: destination.to,
    })
    return {
      targetId: target.id,
      ...destination,
      toElevationFeet: fall.toElevationFeet,
      toGroundElevationFeet: fall.landingGroundElevationFeet,
      sourceElevationFeet: fall.sourceElevationFeet,
      sourceGroundElevationFeet: fall.sourceGroundElevationFeet,
      landingGroundElevationFeet: fall.landingGroundElevationFeet,
      groundedAtSource: fall.groundedAtSource,
      fallDistanceFeet: fall.fallDistanceFeet,
    }
  })
}

/**
 * Legal player-selected exits after a successful save against an overlapping
 * monster landing. Geometry, walls, occupied cells and vertical falls are all
 * derived by the Host; the client only returns one stable cell choice.
 */
export function dnd5eMonsterAreaSuccessfulSaveExitOptions(input: {
  prepared: PreparedDnd5eMonsterAreaAction
  targetId: string
  reservedDestinations?: readonly { x: number; y: number }[]
}): readonly Dnd5eMonsterAreaExitOption[] {
  const { prepared } = input
  const rule = prepared.variant.forcedMovementOnSuccessfulSave
  const landing = prepared.actorMovement
  const target = prepared.targetTokens.find((candidate) => candidate.id === input.targetId)
  if (!rule || !landing || !target) return []
  const feetPerCell = Math.max(1, prepared.map.feetPerCell ?? DND_FEET_PER_CELL)
  const maximumCells = Math.max(1, Math.floor(rule.maximumDistanceFeet / feetPerCell))
  const targetAnchor = tokenAnchorCellFromPixel(target.x, target.y, target, prepared.map)
  const actorLandingCells = new Set(
    tokenOccupiedCellsAt(prepared.actorToken, prepared.map, landing.to)
      .map((cell) => `${cell.col},${cell.row}`),
  )
  const { cols, rows } = mapCellExtent(prepared.map)
  const geometry = mapGeometryRuntimeForMap(prepared.map.id)
  const reserved = input.reservedDestinations ?? []
  const pathfindingMap: BattleMap = {
    ...prepared.map,
    tokens: prepared.map.tokens.filter((candidate) =>
      candidate.id !== prepared.actorToken.id && candidate.id !== target.id),
  }
  const options: Dnd5eMonsterAreaExitOption[] = []
  for (let rowDelta = -maximumCells; rowDelta <= maximumCells; rowDelta += 1) {
    for (let colDelta = -maximumCells; colDelta <= maximumCells; colDelta += 1) {
      const cellDistance = Math.max(Math.abs(colDelta), Math.abs(rowDelta))
      if (cellDistance < 1 || cellDistance * feetPerCell > rule.maximumDistanceFeet) continue
      const cell = { col: targetAnchor.col + colDelta, row: targetAnchor.row + rowDelta }
      const to = tokenCenterForAnchorCell(cell, target, prepared.map)
      const occupiedCells = tokenOccupiedCellsAt(target, prepared.map, to)
      if (
        occupiedCells.some((occupied) =>
          occupied.col < 0 || occupied.row < 0 || occupied.col >= cols || occupied.row >= rows) ||
        occupiedCells.some((occupied) => actorLandingCells.has(`${occupied.col},${occupied.row}`)) ||
        reserved.some((position) => position.x === to.x && position.y === to.y)
      ) continue
      const occupiedByAnotherToken = pathfindingMap.tokens.some((candidate) => {
        if (candidate.type === 'obstacle' || isPresentMonsterAreaCreature(candidate, prepared.characters)) {
          const candidateCells = new Set(
            tokenOccupiedCellsAt(candidate, prepared.map, candidate)
              .map((occupied) => `${occupied.col},${occupied.row}`),
          )
          return occupiedCells.some((occupied) => candidateCells.has(`${occupied.col},${occupied.row}`))
        }
        return false
      })
      if (occupiedByAnotherToken) continue
      const targetElevationFeet = mapGeometryTokenElevation(geometry, target)
      const path = findMapGeometryPath({
        geometry,
        map: pathfindingMap,
        token: target,
        to,
        allowOpenUnlockedDoors: false,
        canFly: false,
        targetElevationFeet,
      })
      if (!path || path.doorsToOpen.length > 0 || path.distanceFeet > rule.maximumDistanceFeet + 1e-4) {
        continue
      }
      const fall = dnd5eForcedMovementFall({
        geometry,
        target,
        targetCombatant: prepared.state.combatants[target.id],
        to,
      })
      options.push({
        targetId: target.id,
        cell,
        to,
        distanceFeet: path.distanceFeet,
        toElevationFeet: fall.toElevationFeet,
        toGroundElevationFeet: fall.landingGroundElevationFeet,
        sourceElevationFeet: fall.sourceElevationFeet,
        sourceGroundElevationFeet: fall.sourceGroundElevationFeet,
        landingGroundElevationFeet: fall.landingGroundElevationFeet,
        groundedAtSource: fall.groundedAtSource,
        fallDistanceFeet: fall.fallDistanceFeet,
      })
    }
  }
  return options.sort((left, right) =>
    left.fallDistanceFeet - right.fallDistanceFeet ||
    left.cell.row - right.cell.row ||
    left.cell.col - right.cell.col)
}

function applyTurnEconomy(
  state: Dnd5eHeadlessCombatState,
  tokenId: string,
  economy: Dnd5eTurnEconomyCounts | undefined,
) {
  if (!economy) return
  const combatant = state.combatants[tokenId]
  if (!combatant) return
  combatant.turn = {
    ...combatant.turn,
    actionAvailable: economy.action.current > 0,
    bonusActionAvailable: economy.bonusAction.current > 0,
    reactionAvailable: economy.reaction.current > 0,
    movementRemaining: economy.movement.current,
  }
}

function monsterActionResourceAvailable(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  action: Dnd5eMonsterAction,
): boolean {
  const actor = state.combatants[actorId]
  if (!actor) return false
  if (action.usage?.kind === 'recharge') {
    return actor.classState.monsterRechargeReadyByActionId?.[action.id] !== false
  }
  if (action.usage?.kind === 'per-day') {
    return (actor.classState.monsterActionUsesByActionId?.[action.id]?.current ?? 0) > 0
  }
  return true
}

export function prepareDnd5eMonsterAreaAction(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  actionId: string
  variantId?: string
  targetTokenIds: readonly string[]
  areaTargetCell?: GridCell
  areaTargetOrientation?: 0 | 1 | 2 | 3
  areaTargetElevationFeet?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eMonsterAreaAction } | {
  ok: false
  reason: Dnd5eMonsterAreaActionRejectReason
} {
  const actorToken = input.map.tokens.find((token) =>
    token.id === input.actorTokenId && token.type === 'enemy')
  if (!actorToken?.poolId) return { ok: false, reason: 'invalid-actor' }
  const monster = getDnd5eSrdMonster(actorToken.poolId)
  const action = monster?.actions.find((candidate) => candidate.id === input.actionId)
  const variant = action
    ? dnd5eMonsterAreaSavingThrowEffect(action, input.variantId)
    : undefined
  if (
    !monster || !action || dnd5eMonsterActionAutomation(action) !== 'headless' ||
    !variant
  ) return { ok: false, reason: 'invalid-action' }
  if (new Set(input.targetTokenIds).size !== input.targetTokenIds.length) {
    return { ok: false, reason: 'invalid-target' }
  }

  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const casterCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
  const targetCell = variant.area.shape === 'circle' && variant.area.origin === 'self'
    ? casterCell
    : input.areaTargetCell
  const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
  const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
  if (
    !targetCell || !Number.isInteger(targetCell.col) || !Number.isInteger(targetCell.row) ||
    targetCell.col < 0 || targetCell.row < 0 || targetCell.col >= columns || targetCell.row >= rows ||
    !canPlaceAoe(variant.area, casterCell, targetCell) ||
    (input.areaTargetOrientation != null && (
      variant.area.shape !== 'rect' || !variant.area.rotatable ||
      !Number.isInteger(input.areaTargetOrientation) ||
      input.areaTargetOrientation < 0 || input.areaTargetOrientation > 3
    ))
  ) return { ok: false, reason: 'invalid-target' }

  const orientFrom = aoeOrientFromCell(variant.area, casterCell, targetCell, {
    rectRotation: input.areaTargetOrientation,
  })
  const effectAim = {
    x: input.map.gridOffsetX + (targetCell.col + 0.5) * input.map.gridSize,
    y: input.map.gridOffsetY + (targetCell.row + 0.5) * input.map.gridSize,
  }
  const effectOrigin = variant.area.origin === 'point' ? effectAim : actorToken
  if (
    input.areaTargetElevationFeet != null &&
    (!Number.isFinite(input.areaTargetElevationFeet) ||
      input.areaTargetElevationFeet < -1_000 ||
      input.areaTargetElevationFeet > 10_000)
  ) return { ok: false, reason: 'invalid-target' }
  const effectAimElevation = input.areaTargetElevationFeet ??
    mapGeometryTerrainElevationAtPoint(geometry, effectAim)
  const effectOriginElevation = variant.area.origin === 'point'
    ? effectAimElevation
    : mapGeometryTokenElevation(geometry, actorToken)
  if (variant.area.origin === 'point') {
    const areaPointToken = {
      ...actorToken,
      id: `${actorToken.id}:monster-area-placement`,
      characterId: undefined,
      type: 'obstacle' as const,
      size: 1,
      ...effectOrigin,
      elevationFeet: effectOriginElevation,
    }
    const horizontalPlacementDistanceFeet = tokenFootprintDistanceCells(
      actorToken,
      areaPointToken,
      input.map,
    ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    if (
      variant.area.placeRangeFeet != null &&
      dnd5eTokenToPointDistanceFeet({
        geometry,
        token: actorToken,
        pointElevationFeet: effectOriginElevation,
        horizontalDistanceFeet: horizontalPlacementDistanceFeet,
      }) > variant.area.placeRangeFeet + 1e-4
    ) {
      return { ok: false, reason: 'invalid-target' }
    }
  }
  let actorMovement: Dnd5eMonsterAreaActionResolutionV1['actorMovement']
  let landingTargets: Token[] | undefined
  if (variant.actorLanding) {
    const landingPosition = tokenCenterForAnchorCell(targetCell, actorToken, input.map)
    const landingCells = tokenOccupiedCellsAt(actorToken, input.map, landingPosition)
    const landingCellKeys = new Set(landingCells.map((cell) => `${cell.col},${cell.row}`))
    const actorFootprintIsInsideMap = landingCells.every((cell) =>
      cell.col >= 0 && cell.row >= 0 && cell.col < columns && cell.row < rows)
    if (!actorFootprintIsInsideMap) return { ok: false, reason: 'invalid-target' }
    const allLandingCreatures = input.map.tokens.filter((candidate) =>
      candidate.id !== actorToken.id &&
      candidate.type !== 'obstacle' &&
      isPresentMonsterAreaCreature(candidate, input.characters) &&
      tokenOccupiedCellsAt(candidate, input.map, candidate).some((cell) =>
        landingCellKeys.has(`${cell.col},${cell.row}`)))
    landingTargets = allLandingCreatures.filter((candidate) =>
      variant.target === 'all-creatures-except-self' || areOpposedCombatTokens(actorToken, candidate))
    if (
      landingTargets.length === 0 ||
      landingTargets.length !== allLandingCreatures.length
    ) return { ok: false, reason: 'invalid-target' }
    const pathfindingMap: BattleMap = {
      ...input.map,
      tokens: input.map.tokens.filter((candidate) =>
        candidate.id !== actorToken.id &&
        !allLandingCreatures.some((target) => target.id === candidate.id)),
    }
    const landingElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, landingPosition)
    const path = findMapGeometryPath({
      geometry,
      map: pathfindingMap,
      token: actorToken,
      to: landingPosition,
      allowOpenUnlockedDoors: false,
      canFly: false,
      targetElevationFeet: landingElevationFeet,
    })
    if (
      !path ||
      path.doorsToOpen.length > 0 ||
      path.distanceFeet < variant.actorLanding.minimumDistanceFeet
    ) return { ok: false, reason: 'invalid-target' }
    const traversal = dnd5eTraversalMovementCost({
      distanceFeet: path.distanceFeet,
      baseMovementCostFeet: path.movementCostFeet,
      elevationGainFeet: Math.max(
        0,
        landingElevationFeet - mapGeometryTokenElevation(geometry, actorToken),
      ),
      mode: variant.actorLanding.traversalMode,
      profile: {
        strengthScore: monster.abilities.str,
        strengthModifier: Math.floor((monster.abilities.str - 10) / 2),
        walkSpeed: monster.speed.walk,
      },
    })
    if (!traversal.ok) return { ok: false, reason: 'invalid-target' }
    actorMovement = {
      to: landingPosition,
      distanceFeet: path.distanceFeet,
      movementCostFeet: traversal.movementCostFeet,
      traversalMode: variant.actorLanding.traversalMode,
      toElevationFeet: landingElevationFeet,
      toGroundElevationFeet: landingElevationFeet,
    }
  }
  if (
    variant.area.origin === 'point' && mapGeometryLineOfEffectBlocked({
      geometry,
      from: actorToken,
      to: effectOrigin,
      fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken),
      toElevationFeet: effectOriginElevation,
    })
  ) return { ok: false, reason: 'line-of-effect-blocked' }

  const eligibleTargets = (landingTargets ??
    tokensInCells(input.map, input.map.tokens, cellsForAoe(variant.area, orientFrom, targetCell)))
    .filter((candidate) =>
      candidate.type !== 'obstacle' && candidate.id !== actorToken.id &&
      isPresentMonsterAreaCreature(candidate, input.characters) &&
      (variant.target === 'all-creatures-except-self' ||
        areOpposedCombatTokens(actorToken, candidate)) &&
      (
        variant.actorLanding != null ||
        (
          dnd5eInstantAoeAffectsTokenVertically({
            spellId: `monster:${action.id}`,
            area: variant.area,
            map: input.map,
            geometry,
            sourceToken: actorToken,
            targetToken: candidate,
            effectOrigin,
            effectOriginElevationFeet: effectOriginElevation,
            effectAim,
            effectAimElevationFeet: effectAimElevation,
          }) &&
          !mapGeometryLineOfEffectBlocked({
            geometry,
            from: effectOrigin,
            to: candidate,
            fromElevationFeet: effectOriginElevation,
            toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
          })
        )
      ))
  const supplied = [...input.targetTokenIds].sort()
  const eligible = eligibleTargets.map((target) => target.id).sort()
  const usesBoundedSelection = variant.minimumTargets != null || variant.maximumTargets != null
  if (
    usesBoundedSelection
      ? (
          supplied.length < (variant.minimumTargets ?? 0) ||
          supplied.length > (variant.maximumTargets ?? Number.POSITIVE_INFINITY) ||
          supplied.some((id) => !eligible.includes(id))
        )
      : (
          supplied.length !== eligible.length ||
          supplied.some((id, index) => id !== eligible[index])
        )
  ) return { ok: false, reason: 'invalid-target' }
  const suppliedSet = new Set(supplied)
  const authoritativeTargets = usesBoundedSelection
    ? eligibleTargets.filter((target) => suppliedSet.has(target.id))
    : eligibleTargets

  const authoritativeTargetIds = new Set(authoritativeTargets.map((target) => target.id))
  const snapshotMap: BattleMap = {
    ...input.map,
    // Neutral NPCs are valid creature targets for indiscriminate breaths.
    // Promote only this transaction's affected NPCs into the Headless snapshot;
    // the result is mapped back onto the original token type by stable ID.
    tokens: input.map.tokens.map((token) =>
      authoritativeTargetIds.has(token.id) && token.type === 'npc'
        ? { ...token, type: 'enemy' as const }
        : token),
  }
  const initiativeTokenIds = new Set(input.initiativeOrder.map((entry) => entry.tokenId))
  const snapshotInitiativeOrder = [
    ...input.initiativeOrder,
    ...authoritativeTargets.flatMap((target) =>
      initiativeTokenIds.has(target.id)
        ? []
        : [{
            tokenId: target.id,
            label: target.label,
            emoji: target.emoji ?? '',
            color: target.color ?? '',
            roll: 0,
          }]),
  ]
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: snapshotMap,
    characters: input.characters,
    initiativeOrder: snapshotInitiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  if (
    actorIndex < 0 || !snapshot.state.combatants[actorToken.id] ||
    authoritativeTargets.some((target) => !snapshot.state.combatants[target.id])
  ) return { ok: false, reason: 'combatant-missing' }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    applyTurnEconomy(snapshot.state, tokenId, economy)
  }
  applyTurnEconomy(snapshot.state, actorToken.id, input.turnEconomy)
  if (
    actorMovement &&
    actorMovement.movementCostFeet >
      (snapshot.state.combatants[actorToken.id]?.turn.movementRemaining ?? 0)
  ) return { ok: false, reason: 'resource-unavailable' }
  if (!monsterActionResourceAvailable(snapshot.state, actorToken.id, action)) {
    return { ok: false, reason: 'resource-unavailable' }
  }
  const requiredVariantId = dnd5eMonsterRequiredAreaSavingThrowVariantId(
    action,
    snapshot.state.combatants[actorToken.id]?.classState
      .monsterActionUsesByActionId?.[action.id]?.current,
  )
  if (requiredVariantId != null && variant.id !== requiredVariantId) {
    return { ok: false, reason: 'invalid-action' }
  }
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actorToken,
      targetTokens: authoritativeTargets,
      monster,
      action,
      variant,
      areaTargetCell: targetCell,
      areaTargetOrientation: input.areaTargetOrientation,
      areaTargetElevationFeet: input.areaTargetElevationFeet,
      actorMovement,
    },
  }
}

export function resolvePreparedDnd5eMonsterAreaAction(input: {
  prepared: PreparedDnd5eMonsterAreaAction
  resolution: Omit<Dnd5eMonsterAreaActionResolutionV1, 'schemaVersion' | 'targetIds' | 'variantId'>
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]
} {
  const { prepared } = input
  const action = {
    type: 'monster-area-action',
    actorId: prepared.actorToken.id,
    actionId: prepared.action.id,
    resolution: {
      ...input.resolution,
      schemaVersion: 1,
      variantId: prepared.variant.id === 'default' ? undefined : prepared.variant.id,
      targetIds: prepared.targetTokens.map((target) => target.id),
      actorMovement: prepared.actorMovement,
    },
    airborneFallDamageRollsByCombatantId: input.airborneFallDamageRollsByCombatantId,
  } as const
  const fallPreview = input.airborneFallDamageRollsByCombatantId == null
    ? previewDnd5eUnsupportedAirborneFalls(prepared.state, action)
    : undefined
  const airborneFalls = fallPreview?.ok ? fallPreview.falls : undefined
  const result = resolveDnd5eHeadlessAction(prepared.state, action)
  if (!result.ok) return { result, airborneFalls }
  return {
    result,
    airborneFalls,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
