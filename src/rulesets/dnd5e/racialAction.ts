import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  tokenAnchorCellFromPixel,
  type GridCell,
} from '../../lib/gridCombat'
import {
  mapGeometryLineOfEffectBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import type {
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import {
  aoeOrientFromCell,
  canPlaceAoe,
  cellsForAoe,
  tokensInCells,
  type SkillAoeTargeting,
} from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterAreaActionResolutionV1,
} from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  DND5E_RACIAL_RESOURCE_KEYS,
  dnd5eRacialRulesForCharacter,
  type Dnd5eDragonbornAncestry,
} from './racialAutomation'
import { dnd5eInstantAoeAffectsTokenVertically } from './verticalCombatGeometry'

export type Dnd5eRacialActionRejectReason =
  | 'invalid-actor'
  | 'invalid-action'
  | 'invalid-target'
  | 'resource-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eDragonbornBreathAction {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetTokens: readonly Token[]
  ancestry: Dnd5eDragonbornAncestry
  areaTargetCell: GridCell
}

export function dnd5eDragonbornBreathArea(
  ancestry: Dnd5eDragonbornAncestry,
): SkillAoeTargeting {
  return ancestry.area.shape === 'line'
    ? {
        shape: 'line',
        origin: 'self',
        lengthFeet: ancestry.area.lengthFeet,
        widthFeet: ancestry.area.widthFeet ?? 5,
        aimRangeFeet: ancestry.area.lengthFeet,
      }
    : {
        shape: 'cone',
        origin: 'self',
        lengthFeet: ancestry.area.lengthFeet,
        aimRangeFeet: ancestry.area.lengthFeet,
      }
}

function isPresentCreature(
  token: Token,
  characters: readonly Character[],
): boolean {
  if (token.type === 'obstacle') return false
  const character = token.characterId
    ? characters.find((candidate) => candidate.id === token.characterId)
    : undefined
  if (character) {
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

export function prepareDnd5eDragonbornBreathAction(input: {
  action: SharedPlayerActionState
  combatId: string
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eDragonbornBreathAction } | {
  ok: false
  reason: Dnd5eRacialActionRejectReason
} {
  const { action } = input
  if (
    action.type !== 'dnd5e-racial-action' ||
    action.dnd5eRacialAction?.feature !== 'dragonborn-breath'
  ) return { ok: false, reason: 'invalid-action' }

  const actor = input.characters.find((character) =>
    character.id === action.characterId &&
    character.rulesetId === 'dnd5e-2014-srd-5.1')
  const actorToken = input.map.tokens.find((token) =>
    token.id === action.actorTokenId &&
    token.characterId === action.characterId &&
    token.type === 'player')
  const ancestry = actor ? dnd5eRacialRulesForCharacter(actor).dragonbornAncestry : undefined
  if (!actor || !actorToken || !ancestry) return { ok: false, reason: 'invalid-actor' }
  if (new Set(action.targetTokenIds ?? []).size !== (action.targetTokenIds?.length ?? 0)) {
    return { ok: false, reason: 'invalid-target' }
  }

  const targetCell = action.targetCell
  const columns = Math.max(
    1,
    Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)),
  )
  const rows = Math.max(
    1,
    Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)),
  )
  const area = dnd5eDragonbornBreathArea(ancestry)
  const casterCell = tokenAnchorCellFromPixel(
    actorToken.x,
    actorToken.y,
    actorToken,
    input.map,
  )
  if (
    !targetCell ||
    !Number.isInteger(targetCell.col) ||
    !Number.isInteger(targetCell.row) ||
    targetCell.col < 0 ||
    targetCell.row < 0 ||
    targetCell.col >= columns ||
    targetCell.row >= rows ||
    !canPlaceAoe(area, casterCell, targetCell)
  ) return { ok: false, reason: 'invalid-target' }
  if (
    action.targetElevationFeet != null &&
    (!Number.isFinite(action.targetElevationFeet) ||
      action.targetElevationFeet < -1_000 ||
      action.targetElevationFeet > 10_000)
  ) return { ok: false, reason: 'invalid-target' }

  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const sourceElevationFeet = mapGeometryTokenElevation(geometry, actorToken)
  const effectAim = {
    x: input.map.gridOffsetX + (targetCell.col + 0.5) * input.map.gridSize,
    y: input.map.gridOffsetY + (targetCell.row + 0.5) * input.map.gridSize,
  }
  const effectAimElevationFeet = action.targetElevationFeet ??
    mapGeometryTerrainElevationAtPoint(geometry, effectAim)
  const orientFrom = aoeOrientFromCell(area, casterCell, targetCell)
  const authoritativeTargets = tokensInCells(
    input.map,
    input.map.tokens,
    cellsForAoe(area, orientFrom, targetCell),
  ).filter((candidate) =>
    candidate.id !== actorToken.id &&
    isPresentCreature(candidate, input.characters) &&
    dnd5eInstantAoeAffectsTokenVertically({
      spellId: 'racial:dragonborn-breath',
      area,
      map: input.map,
      geometry,
      sourceToken: actorToken,
      targetToken: candidate,
      effectOrigin: actorToken,
      effectOriginElevationFeet: sourceElevationFeet,
      effectAim,
      effectAimElevationFeet,
    }) &&
    !mapGeometryLineOfEffectBlocked({
      geometry,
      from: actorToken,
      to: candidate,
      fromElevationFeet: sourceElevationFeet,
      toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
    }))
  const supplied = [...(action.targetTokenIds ?? [])].sort()
  const authoritative = authoritativeTargets.map((target) => target.id).sort()
  if (
    supplied.length !== authoritative.length ||
    supplied.some((id, index) => id !== authoritative[index])
  ) return { ok: false, reason: 'invalid-target' }

  const authoritativeTargetIds = new Set(authoritativeTargets.map((target) => target.id))
  const snapshotMap: BattleMap = {
    ...input.map,
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
    round: action.round,
    map: snapshotMap,
    characters: input.characters,
    initiativeOrder: snapshotInitiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  if (
    actorIndex < 0 ||
    !snapshot.state.combatants[actorToken.id] ||
    authoritativeTargets.some((target) => !snapshot.state.combatants[target.id])
  ) return { ok: false, reason: 'combatant-missing' }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    applyTurnEconomy(snapshot.state, tokenId, economy)
  }
  applyTurnEconomy(snapshot.state, actorToken.id, input.turnEconomy)
  const breathResource = snapshot.state.combatants[actorToken.id]
    ?.classResources[DND5E_RACIAL_RESOURCE_KEYS.dragonbornBreath]
  if (!breathResource || breathResource.current < 1) {
    return { ok: false, reason: 'resource-unavailable' }
  }
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      targetTokens: authoritativeTargets,
      ancestry,
      areaTargetCell: targetCell,
    },
  }
}

export function resolvePreparedDnd5eDragonbornBreathAction(input: {
  prepared: PreparedDnd5eDragonbornBreathAction
  resolution: Omit<
    Dnd5eMonsterAreaActionResolutionV1,
    'schemaVersion' | 'targetIds' | 'variantId' | 'forcedMovements'
  >
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} {
  const { prepared } = input
  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'dragonborn-breath',
    actorId: prepared.actorToken.id,
    resolution: {
      ...input.resolution,
      schemaVersion: 1,
      targetIds: prepared.targetTokens.map((target) => target.id),
    },
  }, input.airborneFallDamageRollsByCombatantId)
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
