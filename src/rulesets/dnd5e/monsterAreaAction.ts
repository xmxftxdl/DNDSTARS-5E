import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  tokenAnchorCellFromPixel,
  type GridCell,
} from '../../lib/gridCombat'
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
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterAreaActionResolutionV1,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eMonsterAreaSavingThrowEffect,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterAreaSavingThrowVariant,
  type Dnd5eMonsterStatBlock,
} from './monsters'

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
  const effectOrigin = variant.area.origin === 'point'
    ? {
        x: input.map.gridOffsetX + (targetCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (targetCell.row + 0.5) * input.map.gridSize,
      }
    : actorToken
  const effectOriginElevation = variant.area.origin === 'point'
    ? mapGeometryTerrainElevationAtPoint(geometry, effectOrigin)
    : mapGeometryTokenElevation(geometry, actorToken)
  if (
    variant.area.origin === 'point' && mapGeometryLineOfEffectBlocked({
      geometry,
      from: actorToken,
      to: effectOrigin,
      fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken),
      toElevationFeet: effectOriginElevation,
    })
  ) return { ok: false, reason: 'line-of-effect-blocked' }

  const authoritativeTargets = tokensInCells(input.map, input.map.tokens, cellsForAoe(variant.area, orientFrom, targetCell))
    .filter((candidate) =>
      candidate.type !== 'obstacle' && candidate.id !== actorToken.id &&
      areOpposedCombatTokens(actorToken, candidate) &&
      !mapGeometryLineOfEffectBlocked({
        geometry,
        from: effectOrigin,
        to: candidate,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
      }))
  const supplied = [...input.targetTokenIds].sort()
  const authoritative = authoritativeTargets.map((target) => target.id).sort()
  if (supplied.length !== authoritative.length || supplied.some((id, index) => id !== authoritative[index])) {
    return { ok: false, reason: 'invalid-target' }
  }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
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
  if (!monsterActionResourceAvailable(snapshot.state, actorToken.id, action)) {
    return { ok: false, reason: 'resource-unavailable' }
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
    },
  }
}

export function resolvePreparedDnd5eMonsterAreaAction(input: {
  prepared: PreparedDnd5eMonsterAreaAction
  resolution: Omit<Dnd5eMonsterAreaActionResolutionV1, 'schemaVersion' | 'targetIds' | 'variantId'>
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'monster-area-action',
    actorId: prepared.actorToken.id,
    actionId: prepared.action.id,
    resolution: {
      ...input.resolution,
      schemaVersion: 1,
      variantId: prepared.variant.id === 'default' ? undefined : prepared.variant.id,
      targetIds: prepared.targetTokens.map((target) => target.id),
    },
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
