import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe } from '../../lib/skillTargeting'
import {
  mapGeometryCanSeeToken,
  mapGeometryLineOfEffectBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  previewDnd5eUnsupportedAirborneFalls,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eSpellTeleportDestination,
  type Dnd5eUnsupportedAirborneFallPreview,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eMonsterActionUsageId,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { createDnd5eMonsterPersistentArea } from './monsterPersistentAreas'
import { resolveDnd5eCoreSpellLightingConflicts } from './coreSpellAreas'
import { dnd5eTokenToPointDistanceFeet } from './verticalCombatGeometry'

export type Dnd5eMonsterSpecialActionRejectReason =
  | 'invalid-actor'
  | 'invalid-action'
  | 'combatant-missing'
  | 'resource-unavailable'
  | 'invalid-destination'
  | 'destination-out-of-range'
  | 'destination-occupied'
  | 'destination-blocked'
  | 'destination-not-visible'
  | 'invalid-target'

export interface PreparedDnd5eMonsterSpecialAction {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actorToken: Token
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  targetToken?: Token
  targetWilling?: boolean
  legendary: boolean
  teleportDestination?: Dnd5eSpellTeleportDestination
  persistentArea?: NonNullable<BattleMap['dnd5ePluginAreas']>[number]
}

function applyTurnEconomy(
  state: Dnd5eHeadlessCombatState,
  tokenId: string,
  economy: Dnd5eTurnEconomyCounts | undefined,
): void {
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

function actionResourceAvailable(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  action: Dnd5eMonsterAction,
  legendary: boolean,
): boolean {
  const actor = state.combatants[actorId]
  if (!actor) return false
  if (legendary) {
    return (actor.classState.monsterLegendaryActionPoints ?? 0) >=
      Math.max(1, action.legendaryCost ?? 1)
  }
  if (!actor.turn.actionAvailable) return false
  const usageActionId = dnd5eMonsterActionUsageId(action)
  if (action.usage?.kind === 'recharge') {
    return actor.classState.monsterRechargeReadyByActionId?.[usageActionId] !== false
  }
  if (action.usage?.kind === 'per-day') {
    return (actor.classState.monsterActionUsesByActionId?.[usageActionId]?.current ?? 0) > 0
  }
  return true
}

export function prepareDnd5eMonsterSpecialAction(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  actionId: string
  legendary?: boolean
  destinationCell?: GridCell
  destinationElevationFeet?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  targetTokenId?: string
  targetWilling?: boolean
  /** Current initiative cursor; required for an off-turn legendary action. */
  currentInitiativeIndex?: number
}): { ok: true; prepared: PreparedDnd5eMonsterSpecialAction } | {
  ok: false
  reason: Dnd5eMonsterSpecialActionRejectReason
} {
  const actorToken = input.map.tokens.find((candidate) =>
    candidate.id === input.actorTokenId && candidate.type === 'enemy')
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || !monster) return { ok: false, reason: 'invalid-actor' }
  const legendary = input.legendary === true
  const action = (legendary ? monster.legendaryActions : monster.actions)
    ?.find((candidate) => candidate.id === input.actionId)
  if (
    !action ||
    action.kind !== 'other' ||
    dnd5eMonsterActionAutomation(action) !== 'headless' ||
    action.rule?.kind !== 'teleport' &&
    action.rule?.kind !== 'toggle-planar-phase' &&
    action.rule?.kind !== 'invisibility' &&
    action.rule?.kind !== 'persistent-area' &&
    action.rule?.kind !== 'saving-throw-condition' &&
    action.rule?.kind !== 'saving-throw-damage-and-max-hp-reduction'
  ) return { ok: false, reason: 'invalid-action' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actor = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actor) return { ok: false, reason: 'combatant-missing' }
  snapshot.state.initiativeIndex = legendary
    ? Math.max(
        0,
        Math.min(
          snapshot.state.initiativeOrder.length - 1,
          input.currentInitiativeIndex ?? snapshot.state.initiativeIndex,
        ),
      )
    : actorIndex
  applyTurnEconomy(snapshot.state, actor.id, input.turnEconomy)
  if (!actionResourceAvailable(snapshot.state, actor.id, action, legendary)) {
    return { ok: false, reason: 'resource-unavailable' }
  }

  let teleportDestination: Dnd5eSpellTeleportDestination | undefined
  let persistentArea: PreparedDnd5eMonsterSpecialAction['persistentArea']
  let targetToken: Token | undefined
  if (
    action.rule.kind === 'saving-throw-condition' ||
    action.rule.kind === 'saving-throw-damage-and-max-hp-reduction'
  ) {
    targetToken = input.map.tokens.find((candidate) =>
      candidate.id === input.targetTokenId && candidate.type !== 'obstacle')
    if (!targetToken || !snapshot.state.combatants[targetToken.id]) {
      return { ok: false, reason: 'invalid-target' }
    }
  } else if (input.targetTokenId != null) {
    return { ok: false, reason: 'invalid-target' }
  }
  if (action.rule.kind === 'teleport') {
    const cell = input.destinationCell
    const columns = Math.max(
      1,
      Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)),
    )
    const rows = Math.max(
      1,
      Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)),
    )
    if (
      !cell ||
      !Number.isInteger(cell.col) ||
      !Number.isInteger(cell.row) ||
      cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows
    ) return { ok: false, reason: 'invalid-destination' }
    const to = tokenCenterForAnchorCell(cell, actorToken, input.map)
    const destinationElevationFeet = input.destinationElevationFeet ??
      mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), to)
    if (
      !Number.isFinite(destinationElevationFeet) ||
      destinationElevationFeet < -1_000 ||
      destinationElevationFeet > 10_000
    ) return { ok: false, reason: 'invalid-destination' }

    const footprint = tokenOccupiedCellsAt(actorToken, input.map, to)
    const occupied = occupiedCells(input.map.tokens, input.map, actorToken.id)
    if (footprint.some((candidate) =>
      candidate.col < 0 || candidate.row < 0 ||
      candidate.col >= columns || candidate.row >= rows
    )) return { ok: false, reason: 'invalid-destination' }
    if (footprint.some((candidate) => occupied.has(cellKey(candidate)))) {
      return { ok: false, reason: 'destination-occupied' }
    }

    const geometry = mapGeometryRuntimeForMap(input.map.id)
    const fromCell = tokenAnchorCellFromPixel(
      actorToken.x,
      actorToken.y,
      actorToken,
      input.map,
    )
    const horizontalDistanceFeet = Math.max(
      Math.abs(cell.col - fromCell.col),
      Math.abs(cell.row - fromCell.row),
    ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    const distanceFeet = Math.max(
      horizontalDistanceFeet,
      Math.abs(destinationElevationFeet - mapGeometryTokenElevation(geometry, actorToken)),
    )
    if (distanceFeet > action.rule.rangeFeet + 1e-4) {
      return { ok: false, reason: 'destination-out-of-range' }
    }
    if (mapGeometryPlacementBlocked({
      geometry,
      map: input.map,
      token: actorToken,
      at: to,
      elevationFeet: destinationElevationFeet,
    }).blocked) return { ok: false, reason: 'destination-blocked' }
    if (!mapGeometryCanSeeToken({
      geometry,
      map: input.map,
      viewer: actorToken,
      target: { ...actorToken, ...to, elevationFeet: destinationElevationFeet },
      forceEnabled: true,
      fallbackRangeFeet: action.rule.rangeFeet,
    })) return { ok: false, reason: 'destination-not-visible' }

    teleportDestination = {
      to,
      distanceFeet,
      toElevationFeet: destinationElevationFeet,
      toGroundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, to),
    }
  } else if (action.rule.kind === 'persistent-area') {
    const geometry = mapGeometryRuntimeForMap(input.map.id)
    if (
      action.rule.requiredEnvironment != null &&
      geometry?.environment !== action.rule.requiredEnvironment
    ) return { ok: false, reason: 'invalid-destination' }
    const sourceCell = tokenAnchorCellFromPixel(
      actorToken.x,
      actorToken.y,
      actorToken,
      input.map,
    )
    const anchorCell = action.rule.area.origin === 'self'
      ? sourceCell
      : input.destinationCell
    if (!anchorCell || !Number.isInteger(anchorCell.col) || !Number.isInteger(anchorCell.row)) {
      return { ok: false, reason: 'invalid-destination' }
    }
    const columns = Math.max(
      1,
      Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)),
    )
    const rows = Math.max(
      1,
      Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)),
    )
    if (
      anchorCell.col < 0 || anchorCell.row < 0 ||
      anchorCell.col >= columns || anchorCell.row >= rows ||
      !canPlaceAoe(action.rule.area, sourceCell, anchorCell)
    ) return { ok: false, reason: 'destination-out-of-range' }
    const anchorPoint = tokenCenterForAnchorCell(anchorCell, { size: 1 }, input.map)
    const baseElevationFeet = input.destinationElevationFeet ?? (
      action.rule.area.origin === 'self'
        ? mapGeometryTokenElevation(geometry, actorToken)
        : mapGeometryTerrainElevationAtPoint(geometry, anchorPoint)
    )
    if (!Number.isFinite(baseElevationFeet) || baseElevationFeet < -1_000 || baseElevationFeet > 10_000) {
      return { ok: false, reason: 'invalid-destination' }
    }
    if (action.rule.area.origin === 'point') {
      const placeRangeFeet = action.rule.area.shape === 'circle' || action.rule.area.shape === 'rect'
        ? action.rule.area.placeRangeFeet
        : undefined
      if (
        placeRangeFeet != null &&
        dnd5eTokenToPointDistanceFeet({
          geometry,
          token: actorToken,
          pointElevationFeet: baseElevationFeet,
          horizontalDistanceFeet: Math.max(
            Math.abs(anchorCell.col - sourceCell.col),
            Math.abs(anchorCell.row - sourceCell.row),
          ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
        }) > placeRangeFeet + 1e-4
      ) return { ok: false, reason: 'destination-out-of-range' }
      if (mapGeometryLineOfEffectBlocked({
        geometry,
        map: input.map,
        from: actorToken,
        to: anchorPoint,
        fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken),
        toElevationFeet: baseElevationFeet,
      })) return { ok: false, reason: 'destination-blocked' }
    }
    const orientFrom = aoeOrientFromCell(action.rule.area, sourceCell, anchorCell)
    const cells = cellsForAoe(action.rule.area, orientFrom, anchorCell).filter((cell) =>
      cell.col >= 0 && cell.row >= 0 && cell.col < columns && cell.row < rows)
    if (cells.length < 1) return { ok: false, reason: 'invalid-destination' }
    persistentArea = createDnd5eMonsterPersistentArea({
      combatId: snapshot.state.combatId,
      round: snapshot.state.round,
      sourceToken: actorToken,
      monster,
      action: action as Dnd5eMonsterAction & {
        rule: Extract<NonNullable<Dnd5eMonsterAction['rule']>, { kind: 'persistent-area' }>
      },
      cells,
      anchorCell,
      baseElevationFeet,
    })
  } else if (input.destinationCell != null || input.destinationElevationFeet != null) {
    return { ok: false, reason: 'invalid-destination' }
  }

  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: snapshot.state,
      actorToken,
      monster,
      action,
      targetToken,
      targetWilling: input.targetWilling,
      legendary,
      teleportDestination,
      persistentArea,
    },
  }
}

export function resolvePreparedDnd5eMonsterSpecialAction(input: {
  prepared: PreparedDnd5eMonsterSpecialAction
  damageRolls?: readonly number[]
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
  savingThrow?: {
    d20: number
    d20Second?: number
    halflingLuckyD20?: number
    halflingLuckyD20Second?: number
    blessRoll?: number
    baneRoll?: number
    rerollD20?: number
    rerollD20Second?: number
    bardicInspirationRoll?: number
    darkOnesOwnLuckRoll?: number
  }
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]
} {
  const prepared = input.prepared
  const action = {
    type: prepared.legendary
      ? 'monster-legendary-special-action'
      : 'monster-special-action' as const,
    actorId: prepared.actorToken.id,
    actionId: prepared.action.id,
    targetId: prepared.targetToken?.id,
    targetWilling: prepared.targetWilling,
    ...input.savingThrow,
    damageRolls: input.damageRolls,
    teleportDestination: prepared.teleportDestination,
    airborneFallDamageRollsByCombatantId: input.airborneFallDamageRollsByCombatantId,
  } as const
  const preview = previewDnd5eUnsupportedAirborneFalls(prepared.state, action)
  const result = resolveDnd5eHeadlessAction(prepared.state, action)
  let applicationMap = prepared.map
  if (result.ok && prepared.persistentArea) {
    const featureId = prepared.persistentArea.featureId
    const retained = (prepared.map.dnd5ePluginAreas ?? []).filter((candidate) =>
      !(
        candidate.sourceTokenId === prepared.actorToken.id &&
        (candidate.featureId === featureId || candidate.concentrationId != null)
      ))
    applicationMap = {
      ...prepared.map,
      dnd5ePluginAreas: resolveDnd5eCoreSpellLightingConflicts(
        retained,
        prepared.persistentArea,
      ).areas,
    }
  }
  return {
    result,
    airborneFalls: preview.ok ? preview.falls : undefined,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: applicationMap,
          characters: prepared.characters,
          characterIdByCombatantId: prepared.characterIdByCombatantId,
          events: [...result.events],
        })
      : undefined,
  }
}
