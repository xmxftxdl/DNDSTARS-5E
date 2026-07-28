import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells } from '../../lib/skillTargeting'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eDirectedCombatantPairKey,
  dnd5eHitIsAutomaticCritical,
  dnd5eMonsterSpellAttackMode,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCounterspellReaction,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterCoreSpellResolutionV1,
  type Dnd5eSpellTeleportDestination,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterSpellcasting,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import {
  dnd5eSpellAttackDelivery,
  dnd5eSpellDiceCount,
  dnd5eSpellMaximumTargets,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'
import {
  mapGeometryCanSeeToken,
  mapGeometryLineOfEffectBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'

type ListedMonsterSpell = NonNullable<Dnd5eMonsterSpellcasting['spells']>[number]

export type Dnd5eMonsterCoreSpellRejectReason =
  | 'invalid-actor'
  | 'invalid-target'
  | 'invalid-stat-block'
  | 'invalid-spell'
  | 'manual-spell'
  | 'target-out-of-range'
  | 'line-of-effect-blocked'
  | 'resource-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eMonsterCoreSpell {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actorToken: Token
  targetTokens: readonly Token[]
  monster: Dnd5eMonsterStatBlock
  listedSpell: ListedMonsterSpell
  spell: Dnd5eSrdSpellDefinition
  slotLevel: number
  casterLevel: number
  diceCount: number
  maximumTargets: number
  spellAttackMode?: 'normal' | 'advantage' | 'disadvantage'
  spellAttackAutomaticCritical?: boolean
  areaTargetCell?: GridCell
  areaTargetOrientation?: 0 | 1 | 2 | 3
  teleportDestination?: Dnd5eSpellTeleportDestination
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

function monsterSpellResourceAvailable(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  listedSpell: ListedMonsterSpell,
  slotLevel: number,
): boolean {
  const actor = state.combatants[actorId]
  if (!actor) return false
  if (listedSpell.usage?.kind === 'at-will' || listedSpell.level === 0) return true
  if (listedSpell.usage?.kind === 'per-day') {
    return (actor.classState.monsterSpellUsesBySpellId?.[listedSpell.id]?.current ?? 0) > 0
  }
  return (actor.classState.monsterSpellSlots?.[String(slotLevel)]?.current ?? 0) > 0
}

export function dnd5eAvailableMonsterSpellSlotLevels(input: {
  monster: Dnd5eMonsterStatBlock
  token: Token
  spell: ListedMonsterSpell
}): readonly number[] {
  const { monster, token, spell } = input
  if (spell.usage?.kind === 'at-will' || spell.level === 0) return [spell.level]
  if (spell.usage?.kind === 'per-day') {
    const remaining = token.dnd5eCombatState?.monsterSpellUsesBySpellId?.[spell.id]?.current
      ?? spell.usage.max
    return remaining > 0 ? [spell.level] : []
  }
  return Object.entries(token.dnd5eCombatState?.monsterSpellSlots ?? monster.spellcasting?.slots ?? {})
    .flatMap(([level, resource]) => {
      const slotLevel = Number(level)
      const remaining = typeof resource === 'number' ? resource : resource.current
      return Number.isInteger(slotLevel) && slotLevel >= spell.level && remaining > 0 ? [slotLevel] : []
    })
    .sort((left, right) => left - right)
}

export function prepareDnd5eMonsterCoreSpell(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenIds: readonly string[]
  areaTargetCell?: GridCell
  areaTargetOrientation?: 0 | 1 | 2 | 3
  spellId: string
  slotLevel: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eMonsterCoreSpell } | {
  ok: false
  reason: Dnd5eMonsterCoreSpellRejectReason
} {
  const actorToken = input.map.tokens.find((token) =>
    token.id === input.actorTokenId && token.type === 'enemy')
  if (!actorToken?.poolId) return { ok: false, reason: 'invalid-actor' }
  const monster = getDnd5eSrdMonster(actorToken.poolId)
  if (!monster?.spellcasting) return { ok: false, reason: 'invalid-stat-block' }
  const listedSpell = monster.spellcasting.spells?.find((candidate) => candidate.id === input.spellId)
  const spell = listedSpell ? getDnd5eSrdCombatSpell(listedSpell.id) : undefined
  if (!listedSpell || !spell || listedSpell.level !== spell.level) {
    return { ok: false, reason: 'invalid-spell' }
  }
  if (dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full') {
    return { ok: false, reason: 'manual-spell' }
  }
  if (
    !Number.isInteger(input.slotLevel) ||
    input.slotLevel < listedSpell.level ||
    input.slotLevel > 9 ||
    !dnd5eAvailableMonsterSpellSlotLevels({ monster, token: actorToken, spell: listedSpell })
      .includes(input.slotLevel)
  ) return { ok: false, reason: 'resource-unavailable' }

  let targetIds = [...new Set(input.targetTokenIds)]
  const casterLevel = Math.max(1, monster.spellcasting.casterLevel ?? 1)
  const maximumTargets = dnd5eSpellMaximumTargets(spell, input.slotLevel, casterLevel)
  if (targetIds.length !== input.targetTokenIds.length) return { ok: false, reason: 'invalid-target' }
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  let teleportDestination: Dnd5eSpellTeleportDestination | undefined
  if (spell.area) {
    const casterCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
    const targetCell = spell.area.shape === 'circle' && spell.area.origin === 'self'
      ? casterCell
      : input.areaTargetCell
    const columns = Math.max(
      1,
      Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)),
    )
    const rows = Math.max(
      1,
      Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)),
    )
    if (
      !targetCell ||
      !Number.isInteger(targetCell.col) ||
      !Number.isInteger(targetCell.row) ||
      targetCell.col < 0 ||
      targetCell.row < 0 ||
      targetCell.col >= columns ||
      targetCell.row >= rows ||
      !canPlaceAoe(spell.area, casterCell, targetCell) ||
      (input.areaTargetOrientation != null && (
        spell.area.shape !== 'rect' ||
        !spell.area.rotatable ||
        !Number.isInteger(input.areaTargetOrientation) ||
        input.areaTargetOrientation < 0 ||
        input.areaTargetOrientation > 3
      ))
    ) {
      return { ok: false, reason: 'invalid-target' }
    }
    const orientFrom = aoeOrientFromCell(spell.area, casterCell, targetCell, {
      rectRotation: input.areaTargetOrientation,
    })
    const cells = cellsForAoe(spell.area, orientFrom, targetCell)
    const effectOrigin = spell.area.origin === 'point'
      ? {
          x: input.map.gridOffsetX + (targetCell.col + 0.5) * input.map.gridSize,
          y: input.map.gridOffsetY + (targetCell.row + 0.5) * input.map.gridSize,
        }
      : actorToken
    const effectOriginElevation = spell.area.origin === 'point'
      ? mapGeometryTerrainElevationAtPoint(geometry, effectOrigin)
      : mapGeometryTokenElevation(geometry, actorToken)
    if (
      spell.area.origin === 'point' &&
      (spell.effect === 'teleport'
        ? (() => {
            const destination = tokenCenterForAnchorCell(targetCell, actorToken, input.map)
            const footprint = tokenOccupiedCellsAt(actorToken, input.map, destination)
            const occupied = occupiedCells(input.map.tokens, input.map, actorToken.id)
            const blocked = footprint.some((cell) =>
              cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows ||
              occupied.has(cellKey(cell))) ||
              mapGeometryPlacementBlocked({
                geometry,
                map: input.map,
                token: actorToken,
                at: destination,
                elevationFeet: effectOriginElevation,
              }).blocked ||
              !mapGeometryCanSeeToken({
                geometry,
                map: input.map,
                viewer: actorToken,
                target: { ...actorToken, ...destination, elevationFeet: effectOriginElevation },
                forceEnabled: true,
                fallbackRangeFeet: 30,
              })
            if (!blocked) {
              teleportDestination = {
                to: destination,
                distanceFeet: Math.max(
                  Math.abs(targetCell.col - casterCell.col),
                  Math.abs(targetCell.row - casterCell.row),
                ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
                toElevationFeet: effectOriginElevation,
              }
            }
            return blocked
          })()
        : mapGeometryLineOfEffectBlocked({
            geometry,
            from: actorToken,
            to: effectOrigin,
            fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken),
            toElevationFeet: effectOriginElevation,
          }))
    ) return { ok: false, reason: 'line-of-effect-blocked' }
    const authoritativeTargets = tokensInCells(input.map, input.map.tokens, cells).filter((candidate) => {
      if (candidate.type === 'obstacle' || (candidate.id === actorToken.id && !spell.areaIncludesSelf)) return false
      const opposed = areOpposedCombatTokens(actorToken, candidate)
      if (spell.target === 'hostile' && !opposed) return false
      if (spell.target === 'ally' && opposed) return false
      return !mapGeometryLineOfEffectBlocked({
        geometry,
        from: effectOrigin,
        to: candidate,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
      })
    })
    if (
      (spell.effect !== 'teleport' && authoritativeTargets.length < 1) ||
      authoritativeTargets.length > maximumTargets
    ) {
      return { ok: false, reason: 'invalid-target' }
    }
    const supplied = [...targetIds].sort()
    const authoritative = spell.effect === 'teleport'
      ? []
      : authoritativeTargets.map((target) => target.id).sort()
    if (supplied.length !== authoritative.length || supplied.some((id, index) => id !== authoritative[index])) {
      return { ok: false, reason: 'invalid-target' }
    }
    targetIds = spell.effect === 'teleport'
      ? []
      : authoritativeTargets.map((target) => target.id)
  } else if (targetIds.length < 1 || targetIds.length > maximumTargets) {
    return { ok: false, reason: 'invalid-target' }
  }
  const targetTokens = targetIds.map((targetId) =>
    input.map.tokens.find((token) => token.id === targetId && token.type !== 'obstacle'))
  if (!spell.area && targetTokens.some((target) =>
    !target || (target.id === actorToken.id && spell.target === 'hostile')
  )) {
    return { ok: false, reason: 'invalid-target' }
  }
  if (targetTokens.some((target) => {
    const opposed = areOpposedCombatTokens(actorToken, target!)
    return (spell.target === 'hostile' && !opposed) ||
      (spell.target === 'ally' && opposed)
  })) return { ok: false, reason: 'invalid-target' }
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  if (!spell.area && targetTokens.some((target) =>
    tokenFootprintDistanceCells(actorToken, target!, input.map) * feetPerCell > spell.rangeFeet
  )) return { ok: false, reason: 'target-out-of-range' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  if (
    actorIndex < 0 ||
    !snapshot.state.combatants[actorToken.id] ||
    targetTokens.some((target) => !snapshot.state.combatants[target!.id])
  ) return { ok: false, reason: 'combatant-missing' }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    applyTurnEconomy(snapshot.state, tokenId, economy)
  }
  applyTurnEconomy(snapshot.state, actorToken.id, input.turnEconomy)
  if (!monsterSpellResourceAvailable(snapshot.state, actorToken.id, listedSpell, input.slotLevel)) {
    return { ok: false, reason: 'resource-unavailable' }
  }
  if (!spell.area && targetTokens.some((target) =>
    snapshot.state.lineOfEffectBlockedByCombatantPair?.[
      dnd5eDirectedCombatantPairKey(actorToken.id, target!.id)
    ]
  )) return { ok: false, reason: 'line-of-effect-blocked' }

  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actorToken,
      targetTokens: targetTokens as Token[],
      monster,
      listedSpell,
      spell,
      slotLevel: input.slotLevel,
      casterLevel,
      diceCount: dnd5eSpellDiceCount(spell, casterLevel, input.slotLevel),
      maximumTargets,
      spellAttackMode: spell.effect === 'spell-attack'
        ? dnd5eMonsterSpellAttackMode(
            snapshot.state,
            actorToken.id,
            targetTokens[0]!.id,
            dnd5eSpellAttackDelivery(spell),
          )
        : undefined,
      spellAttackAutomaticCritical: spell.effect === 'spell-attack'
        ? dnd5eHitIsAutomaticCritical(
            snapshot.state,
            actorToken.id,
            snapshot.state.combatants[targetTokens[0]!.id],
          )
        : undefined,
      areaTargetCell: input.areaTargetCell,
      areaTargetOrientation: input.areaTargetOrientation,
      teleportDestination,
    },
  }
}

export function resolvePreparedDnd5eMonsterCoreSpell(input: {
  prepared: PreparedDnd5eMonsterCoreSpell
  resolution: Omit<Dnd5eMonsterCoreSpellResolutionV1, 'schemaVersion' | 'targetIds'>
  counterspellReaction?: Dnd5eCounterspellReaction
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'monster-core-spell',
    actorId: prepared.actorToken.id,
    spellId: prepared.spell.id,
    slotLevel: prepared.slotLevel,
    counterspellReaction: input.counterspellReaction,
    resolution: {
      ...input.resolution,
      schemaVersion: 1,
      targetIds: prepared.targetTokens.map((target) => target.id),
      teleportDestination: prepared.teleportDestination,
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
