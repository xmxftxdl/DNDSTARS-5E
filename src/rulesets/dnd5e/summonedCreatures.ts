import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  assignEnemyVisualVariants,
  DND5E_SRD_ENEMY_POOL,
  dnd5eMonsterToEnemyTemplate,
  enemyTemplateToTokenPatch,
} from '../../lib/enemyPool'
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

export type Dnd5eSummonPlanFailure = 'invalid-summon' | 'summon-position-blocked'

export interface Dnd5eSummonPlan {
  token: Token
  initiativeEntry: InitiativeEntry
}

export interface Dnd5eSummonedCreatureSpec {
  /** SRD or room-local monster catalog id. */
  monsterId: string
  label?: string
  durationRounds: number
  concentration?: boolean
  side?: 'ally' | 'enemy'
  persistent?: boolean
  temporaryHitPoints?: number
  minimumMaximumHitPoints?: number
  maximumHitPointBonus?: number
  armorClassBonus?: number
  weaponAttackBonus?: number
  weaponDamageBonus?: number
  savingThrowBonus?: number
  proficientSkillCheckBonus?: number
  weaponAttacksMagical?: boolean
  attacksPerAction?: number
  shareSelfSpellsRangeFeet?: number
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
  /** Optional stable occurrence suffix for multi-creature Activity summons. */
  occurrenceIndex?: number
  /** Authority-owned concentration id when the caller is not a legacy plugin action. */
  concentrationId?: string
  round: number
  targetCell: GridCell
  initiativeD20: number
  summon: Dnd5eSummonedCreatureSpec
  geometry?: MapGeometryState
}): { ok: true; plan: Dnd5eSummonPlan } | { ok: false; reason: Dnd5eSummonPlanFailure } {
  const monster = getDnd5eSrdMonster(input.summon.monsterId)
  const template = DND5E_SRD_ENEMY_POOL.find((candidate) => candidate.id === input.summon.monsterId) ??
    (monster ? dnd5eMonsterToEnemyTemplate(monster) : undefined)
  if (
    !monster || !template || !Number.isInteger(input.initiativeD20) ||
    input.initiativeD20 < 1 || input.initiativeD20 > 20
  ) return { ok: false, reason: 'invalid-summon' }

  const [templateWithVisual] = assignEnemyVisualVariants([template], input.map.tokens)
  const patch = enemyTemplateToTokenPatch(templateWithVisual)
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
      map: input.map,
      from: input.actorToken,
      to: position,
      fromElevationFeet: input.actorToken.elevationFeet,
      toElevationFeet: input.actorToken.elevationFeet,
    })
  ) return { ok: false, reason: 'summon-position-blocked' }

  const side = summonSide(input.actorToken, input.summon.side)
  const concentrationId = input.summon.concentration
    ? input.concentrationId ?? `plugin-summon:${input.actionId}`
    : undefined
  const tokenId = input.summon.persistent
    ? `plugin-companion:${input.sourceCharacterId}:${input.featureId}`
    : `plugin-summon:${input.actionId}${input.occurrenceIndex == null ? '' : `:${input.occurrenceIndex + 1}`}`
  const baseMaximumHitPoints = Math.max(
    1,
    (patch.maxHp ?? monster.hitPoints.average) + Math.max(0, input.summon.maximumHitPointBonus ?? 0),
  )
  const maximumHitPoints = Math.max(
    baseMaximumHitPoints,
    Math.max(1, Math.floor(input.summon.minimumMaximumHitPoints ?? 1)),
  )
  const token: Token = {
    id: tokenId,
    label: input.summon.label?.trim() || monster.name,
    x: position.x,
    y: position.y,
    color: patch.color ?? '#8b5cf6',
    emoji: patch.emoji ?? '✦',
    size: tokenBase.size,
    type: 'enemy',
    hp: maximumHitPoints,
    maxHp: maximumHitPoints,
    dnd5eCombatState: input.summon.temporaryHitPoints
      ? { temporaryHp: input.summon.temporaryHitPoints }
      : undefined,
    poolId: patch.poolId,
    visualVariantId: patch.visualVariantId,
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
      persistent: input.summon.persistent === true ? true : undefined,
      minimumMaximumHitPoints: input.summon.minimumMaximumHitPoints,
      maximumHitPointBonus: input.summon.maximumHitPointBonus,
      armorClassBonus: input.summon.armorClassBonus,
      weaponAttackBonus: input.summon.weaponAttackBonus,
      weaponDamageBonus: input.summon.weaponDamageBonus,
      savingThrowBonus: input.summon.savingThrowBonus,
      proficientSkillCheckBonus: input.summon.proficientSkillCheckBonus,
      weaponAttacksMagical: input.summon.weaponAttacksMagical === true ? true : undefined,
      attacksPerAction: input.summon.attacksPerAction,
      shareSelfSpellsRangeFeet: input.summon.shareSelfSpellsRangeFeet,
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
  const tokensById = new Map(input.map.tokens.map((token) => [token.id, token]))
  const removedTokenIds: string[] = []
  const tokens = input.map.tokens.filter((token) => {
    const summon = token.dnd5eSummon
    if (!summon) return true
    const source = characters.get(summon.sourceCharacterId)
    const sourceToken = tokensById.get(summon.sourceTokenId)
    const expired = summon.persistent !== true && input.round > summon.expiresAfterRound
    const defeated = (token.hp ?? token.maxHp ?? 1) <= 0
    const concentrationEnded = !!summon.concentrationId &&
      (source?.dnd5eCombatState?.concentrationSpellId ??
        sourceToken?.dnd5eCombatState?.concentrationSpellId) !== summon.concentrationId
    if ((!source && !sourceToken) || expired || defeated || concentrationEnded) {
      removedTokenIds.push(token.id)
      return false
    }
    return true
  })
  return removedTokenIds.length > 0
    ? { map: { ...input.map, tokens }, removedTokenIds }
    : { map: input.map, removedTokenIds }
}
