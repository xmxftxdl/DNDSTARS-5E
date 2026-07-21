import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND5E_SRD_ENEMY_POOL, enemyTemplateToTokenPatch } from '../../lib/enemyPool'
import {
  cellKey,
  mapCellExtent,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import {
  mapGeometryLineOfEffectBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { getDnd5eSrdMonster } from './monsters'
import type { Dnd5ePluginFeatureAction } from './pluginApi'

export type Dnd5eSummonPlanFailure = 'invalid-summon' | 'summon-position-blocked'

export interface Dnd5eSummonPlan {
  token: Token
  initiativeEntry: InitiativeEntry
}

/**
 * Rebase a resolved plugin transaction onto the latest map immediately before
 * committing its summon. Only tokens explicitly changed by the transaction
 * replace current values; unrelated movement/HP edits remain intact.
 */
export function rebaseDnd5eSummonedCreatureTokens(input: {
  latestMap: BattleMap
  resolvedTokens: readonly Token[]
  changedTokenIds: readonly string[]
  summonedToken: Token
}): Token[] {
  const changedIds = new Set(input.changedTokenIds)
  const resolvedById = new Map(input.resolvedTokens.map((token) => [token.id, token]))
  return [
    ...input.latestMap.tokens
      .filter((token) => token.id !== input.summonedToken.id)
      .map((token) => changedIds.has(token.id) ? (resolvedById.get(token.id) ?? token) : token),
    input.summonedToken,
  ]
}

function summonSide(actorToken: Token, relation: 'ally' | 'enemy' | undefined): 'player' | 'enemy' {
  const actorSide = dnd5eCombatTokenSide(actorToken) ?? 'player'
  if (relation !== 'enemy') return actorSide
  return actorSide === 'player' ? 'enemy' : 'player'
}

export function planDnd5eSummonedCreature(input: {
  map: BattleMap
  actorToken: Token
  sourceCharacterId: string
  featureId: string
  pluginId: string
  actionId: string
  round: number
  targetCell: GridCell
  initiativeD20: number
  summon: NonNullable<Dnd5ePluginFeatureAction['summon']>
  geometry?: MapGeometryState
}): { ok: true; plan: Dnd5eSummonPlan } | { ok: false; reason: Dnd5eSummonPlanFailure } {
  const monster = getDnd5eSrdMonster(input.summon.monsterId)
  const template = DND5E_SRD_ENEMY_POOL.find((candidate) => candidate.id === input.summon.monsterId)
  if (
    !monster || !template || !Number.isInteger(input.initiativeD20) ||
    input.initiativeD20 < 1 || input.initiativeD20 > 20
  ) return { ok: false, reason: 'invalid-summon' }

  const patch = enemyTemplateToTokenPatch(template)
  const tokenBase = {
    size: patch.size ?? 1,
    creatureSize: patch.creatureSize,
  }
  const { cols, rows } = mapCellExtent(input.map)
  const occupied = new Set(
    input.map.tokens
      .filter((token) => token.type !== 'obstacle' || token.obstacleKind !== 'marker')
      .flatMap((token) => tokenOccupiedCellsAt(token, input.map, token))
      .map(cellKey),
  )
  const position = tokenCenterForAnchorCell(input.targetCell, tokenBase, input.map)
  const footprint = tokenOccupiedCellsAt(tokenBase, input.map, position)
  const geometry = input.geometry ?? mapGeometryRuntimeForMap(input.map.id)
  const placementToken = {
    ...input.actorToken,
    ...tokenBase,
    ...position,
    elevationFeet: input.actorToken.elevationFeet,
  }
  if (
    footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
    footprint.some((cell) => occupied.has(cellKey(cell))) ||
    mapGeometryPlacementBlocked({ geometry, map: input.map, token: placementToken, at: position }).blocked ||
    mapGeometryLineOfEffectBlocked({
      geometry,
      from: input.actorToken,
      to: position,
      fromElevationFeet: input.actorToken.elevationFeet,
      toElevationFeet: input.actorToken.elevationFeet,
    })
  ) return { ok: false, reason: 'summon-position-blocked' }

  const side = summonSide(input.actorToken, input.summon.side)
  const concentrationId = input.summon.concentration ? `plugin-summon:${input.actionId}` : undefined
  const tokenId = `plugin-summon:${input.actionId}`
  const token: Token = {
    id: tokenId,
    label: input.summon.label?.trim() || monster.name,
    x: position.x,
    y: position.y,
    color: patch.color ?? '#8b5cf6',
    emoji: patch.emoji ?? '✦',
    size: tokenBase.size,
    type: 'enemy',
    hp: patch.hp,
    maxHp: patch.maxHp,
    poolId: monster.id,
    creatureTypes: patch.creatureTypes,
    creatureSize: patch.creatureSize,
    showHpOnToken: true,
    showDetailOnToken: true,
    dnd5eSummon: {
      schemaVersion: 1,
      pluginId: input.pluginId,
      featureId: input.featureId,
      sourceCharacterId: input.sourceCharacterId,
      sourceTokenId: input.actorToken.id,
      createdRound: input.round,
      expiresAfterRound: input.round + input.summon.durationRounds - 1,
      concentrationId,
      side,
    },
  }
  const initiative = input.initiativeD20 + rules.abilityModifier(monster.abilities.dex)
  return {
    ok: true,
    plan: {
      token,
      initiativeEntry: {
        slotId: `${tokenId}:normal`,
        tokenId,
        label: token.label,
        emoji: token.emoji,
        color: token.color,
        roll: initiative,
      },
    },
  }
}

export function reconcileDnd5eSummonedCreatures(input: {
  map: BattleMap
  characters: readonly Character[]
  round: number
}): { map: BattleMap; removedTokenIds: string[] } {
  const characters = new Map(input.characters.map((character) => [character.id, character]))
  const removedTokenIds: string[] = []
  const tokens = input.map.tokens.filter((token) => {
    const summon = token.dnd5eSummon
    if (!summon) return true
    const source = characters.get(summon.sourceCharacterId)
    const expired = input.round > summon.expiresAfterRound
    const defeated = (token.hp ?? token.maxHp ?? 1) <= 0
    const concentrationEnded = !!summon.concentrationId &&
      source?.dnd5eCombatState?.concentrationSpellId !== summon.concentrationId
    if (!source || expired || defeated || concentrationEnded) {
      removedTokenIds.push(token.id)
      return false
    }
    return true
  })
  return removedTokenIds.length > 0
    ? { map: { ...input.map, tokens }, removedTokenIds }
    : { map: input.map, removedTokenIds }
}
