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
import {
  mapGeometryCanSeeToken,
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
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
} from './monsters'

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

export interface PreparedDnd5eMonsterSpecialAction {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actorToken: Token
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  legendary: boolean
  teleportDestination?: Dnd5eSpellTeleportDestination
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
  if (action.usage?.kind === 'recharge') {
    return actor.classState.monsterRechargeReadyByActionId?.[action.id] !== false
  }
  if (action.usage?.kind === 'per-day') {
    return (actor.classState.monsterActionUsesByActionId?.[action.id]?.current ?? 0) > 0
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
    (action.rule?.kind !== 'teleport' && action.rule?.kind !== 'invisibility')
  ) return { ok: false, reason: 'invalid-action' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actor = snapshot.state.combatants[actorToken.id]
  if (!actor) return { ok: false, reason: 'combatant-missing' }
  applyTurnEconomy(snapshot.state, actor.id, input.turnEconomy)
  if (!actionResourceAvailable(snapshot.state, actor.id, action, legendary)) {
    return { ok: false, reason: 'resource-unavailable' }
  }

  let teleportDestination: Dnd5eSpellTeleportDestination | undefined
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
      legendary,
      teleportDestination,
    },
  }
}

export function resolvePreparedDnd5eMonsterSpecialAction(input: {
  prepared: PreparedDnd5eMonsterSpecialAction
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
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
    teleportDestination: prepared.teleportDestination,
    airborneFallDamageRollsByCombatantId: input.airborneFallDamageRollsByCombatantId,
  } as const
  const preview = previewDnd5eUnsupportedAirborneFalls(prepared.state, action)
  const result = resolveDnd5eHeadlessAction(prepared.state, action)
  return {
    result,
    airborneFalls: preview.ok ? preview.falls : undefined,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: prepared.map,
          characters: prepared.characters,
          characterIdByCombatantId: prepared.characterIdByCombatantId,
          events: [...result.events],
        })
      : undefined,
  }
}
