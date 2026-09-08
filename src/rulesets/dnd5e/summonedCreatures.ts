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
  persistAfterConcentrationCompletes?: boolean
  becomesHostileAfterConcentrationEnds?: boolean
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
  cannotAttack?: boolean
  walkingSpeedFeet?: number
  dismissAfterDamageRounds?: number
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

/** Starts a bounded delayed dismissal once a summon takes positive damage. */
export function markDnd5eSummonsDamaged(
  map: BattleMap,
  damagedTokenIds: ReadonlySet<string>,
  round: number,
): BattleMap {
  let changed = false
  const tokens = map.tokens.map((token) => {
    const summon = token.dnd5eSummon
    if (
      !summon?.dismissAfterDamageRounds || summon.dismissAtRound != null ||
      !damagedTokenIds.has(token.id)
    ) return token
    changed = true
    return {
      ...token,
      dnd5eSummon: {
        ...summon,
        dismissAtRound: Math.min(
          summon.expiresAfterRound,
          round + summon.dismissAfterDamageRounds,
        ),
      },
    }
  })
  return changed ? { ...map, tokens } : map
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
  createdWorldMinute?: number
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
    input.initiativeD20 < 1 || input.initiativeD20 > 20 ||
    (input.createdWorldMinute != null &&
      (!Number.isSafeInteger(input.createdWorldMinute) || input.createdWorldMinute < 0)) ||
    (input.summon.persistAfterConcentrationCompletes === true &&
      (input.summon.concentration !== true || input.summon.persistent === true)) ||
    (input.summon.becomesHostileAfterConcentrationEnds === true &&
      (input.summon.concentration !== true || input.summon.persistent === true ||
        input.summon.persistAfterConcentrationCompletes === true))
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
    ? `plugin-companion:${input.sourceCharacterId}:${input.featureId}${input.occurrenceIndex == null ? '' : `:${input.actionId}:${input.occurrenceIndex + 1}`}`
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
      persistAfterConcentrationCompletes: input.summon.persistAfterConcentrationCompletes === true
        ? true
        : undefined,
      becomesHostileAfterConcentrationEnds: input.summon.becomesHostileAfterConcentrationEnds === true
        ? true
        : undefined,
      createdWorldMinute: input.createdWorldMinute,
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
      cannotAttack: input.summon.cannotAttack === true ? true : undefined,
      walkingSpeedFeet: input.summon.walkingSpeedFeet,
      dismissAfterDamageRounds: input.summon.dismissAfterDamageRounds,
    },
  }
  const initiativeModifier = rules.abilityModifier(monster.abilities.dex)
  const initiative = input.initiativeD20 + initiativeModifier
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
        initiativeCalculation: {
          rolls: [input.initiativeD20],
          d20: input.initiativeD20,
          modifier: initiativeModifier,
          mode: 'normal',
        },
      },
    },
  }
}

export function dnd5eRestoredSummonedOriginalObject(
  token: Token,
  overflowDamage = 0,
): Token | undefined {
  const originalSnapshot = token.dnd5eSummon?.truePolymorphOriginalObject
  if (!originalSnapshot) return undefined
  const { schemaVersion: _schemaVersion, ...original } = originalSnapshot
  const transferredDamage = Math.max(0, Math.floor(overflowDamage))
  const originalHitPoints = original.hp ?? original.maxHp
  return {
    ...original,
    type: 'obstacle',
    x: token.x,
    y: token.y,
    hp: originalHitPoints == null
      ? undefined
      : Math.max(0, originalHitPoints - transferredDamage),
    elevationFeet: token.elevationFeet ?? original.elevationFeet,
    lightSource: original.lightSource ? { ...original.lightSource } : undefined,
    dnd5eObjectState: original.dnd5eObjectState
      ? structuredClone(original.dnd5eObjectState)
      : undefined,
  }
}

export function reconcileDnd5eSummonedCreatures(input: {
  map: BattleMap
  characters: readonly Character[]
  round: number
}): { map: BattleMap; removedTokenIds: string[]; promotedTokenIds: string[]; hostileTokenIds: string[] } {
  const characters = new Map(input.characters.map((character) => [character.id, character]))
  const tokensById = new Map(input.map.tokens.map((token) => [token.id, token]))
  const removedTokenIds: string[] = []
  const promotedTokenIds: string[] = []
  const hostileTokenIds: string[] = []
  const tokens = input.map.tokens.flatMap((token) => {
    const summon = token.dnd5eSummon
    if (!summon) return [token]
    const source = characters.get(summon.sourceCharacterId)
    const sourceToken = tokensById.get(summon.sourceTokenId)
    const expired = summon.persistent !== true && input.round > summon.expiresAfterRound
    const damageDismissed = summon.dismissAtRound != null && input.round >= summon.dismissAtRound
    const defeated = (token.hp ?? token.maxHp ?? 1) <= 0
    const concentrationEnded = !!summon.concentrationId &&
      (source?.dnd5eCombatState?.concentrationSpellId ??
        sourceToken?.dnd5eCombatState?.concentrationSpellId) !== summon.concentrationId
    const completion = source?.dnd5eCombatState?.lastCompletedConcentration ??
      sourceToken?.dnd5eCombatState?.lastCompletedConcentration
    const completedAfterCreation = !!summon.concentrationId &&
      completion?.spellId === summon.concentrationId && (
      summon.createdWorldMinute != null && completion.completedWorldMinute != null
        ? completion.completedWorldMinute >= summon.createdWorldMinute
        : completion.completedRound != null && completion.completedRound >= summon.createdRound
    )
    if (
      concentrationEnded && summon.becomesHostileAfterConcentrationEnds === true &&
      !expired && !defeated && !damageDismissed
    ) {
      hostileTokenIds.push(token.id)
      return [{
        ...token,
        dnd5eSummon: {
          ...summon,
          concentrationId: undefined,
          becomesHostileAfterConcentrationEnds: undefined,
          side: summon.side === 'player' ? 'enemy' as const : 'player' as const,
          controlEnded: true as const,
        },
      }]
    }
    if (
      concentrationEnded && summon.persistAfterConcentrationCompletes === true &&
      completedAfterCreation && !defeated && !damageDismissed
    ) {
      promotedTokenIds.push(token.id)
      return [{
        ...token,
        dnd5eSummon: {
          ...summon,
          concentrationId: undefined,
          persistAfterConcentrationCompletes: undefined,
          persistent: true as const,
          controlEnded: true as const,
          truePolymorphOriginalObject: undefined,
        },
      }]
    }
    if ((!source && !sourceToken) || expired || damageDismissed || defeated || concentrationEnded) {
      removedTokenIds.push(token.id)
      const restoredObject = dnd5eRestoredSummonedOriginalObject(token)
      if (restoredObject) return [restoredObject]
      return []
    }
    return [token]
  })
  return removedTokenIds.length > 0 || promotedTokenIds.length > 0 || hostileTokenIds.length > 0
    ? { map: { ...input.map, tokens }, removedTokenIds, promotedTokenIds, hostileTokenIds }
    : { map: input.map, removedTokenIds, promotedTokenIds, hostileTokenIds }
}
