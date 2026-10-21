import { droppedDnd5eCompanionObjects } from './companionCarriedObjects'
import { applyDnd5eEffectiveVisionProfile, compileDnd5eEffectiveVisionProfile } from '../../../shared/dnd5e-vision-profile.mjs'
import { dnd5eSummonDurationExpired } from '../../../shared/summon-linger.mjs'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { dnd5eCreatureSubtypeMatches } from './persistentAreaCreatureFilter'
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
import { createDnd5eSummonControlEffect, detachDnd5eUncontrolledSummon, isDnd5eSummonLingerPolicy, type Dnd5eSummonControlSave } from './summonedControl'

export type Dnd5eSummonPlanFailure = 'invalid-summon' | 'summon-position-blocked'

export interface Dnd5eSummonPlan {
  token: Token
  initiativeEntry: InitiativeEntry
}

export interface Dnd5eSummonedCreatureSpec {
  bondKey?:string
  bondEffectId?:string
  understoodLanguage?:string
  telepathyRangeFeet?:number
  controlSave?: Dnd5eSummonControlSave
  uncontrolledLinger?: import('./summonedControl').Dnd5eSummonLingerPolicy
  maximumChallengeRating?: number
  requiredCreatureSubtype?: string
  autonomousBehavior?: 'attack-nearest-visible' | 'attack-nearest-other-subtype' | 'protect-source'
      commandPolicy?: 'persistent-order' | 'turn-order'
  /** SRD or room-local monster catalog id. */
  monsterId: string
  label?: string
  durationRounds: number
  concentration?: boolean
  side?: 'ally' | 'enemy'
  persistent?: boolean
  independentPersistent?: true
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
  naturalWeaponAttacksMagical?: true
  weaponAttacksMagical?: boolean
  attacksPerAction?: number
  shareSelfSpellsRangeFeet?: number
  shareSelfSpellsRequiresMounted?: boolean
  creatureTypeOverride?: 'celestial' | 'fey' | 'fiend'
  minimumIntelligence?: number
  cannotAttack?: boolean
  walkingSpeedFeet?: number
  dismissAfterDamageRounds?: number
  sourceDeathBehavior?: 'die'
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
  sourceSpellId?: string
  pluginId: string
  actionId: string
  /** Optional stable occurrence suffix for multi-creature Activity summons. */
  occurrenceIndex?: number
  /** Authority-owned concentration id when the caller is not a legacy plugin action. */
  concentrationId?: string
  createdWorldMinute?: number
  round: number
  targetCell: GridCell
  /** Host-qualified object being replaced in place; conversion does not require an empty summon cell. */
  animatedObject?: Token
  initiativeD20: number
  summon: Dnd5eSummonedCreatureSpec
  geometry?: MapGeometryState
}): { ok: true; plan: Dnd5eSummonPlan } | { ok: false; reason: Dnd5eSummonPlanFailure } {
  if (input.summon.independentPersistent && (!input.summon.persistent || input.summon.bondKey)) return {ok:false,reason:'invalid-summon'}
  if (input.summon.autonomousBehavior != null && (!['attack-nearest-visible','attack-nearest-other-subtype','protect-source'].includes(input.summon.autonomousBehavior) || (input.summon.autonomousBehavior==='attack-nearest-other-subtype' && !input.summon.requiredCreatureSubtype?.trim()) || (input.summon.commandPolicy != null && input.summon.autonomousBehavior !== 'protect-source') || input.summon.controlSave != null || input.summon.cannotAttack)) return {ok:false,reason:'invalid-summon'}
  const monster = getDnd5eSrdMonster(input.summon.monsterId)
  if (input.summon.uncontrolledLinger != null && (!isDnd5eSummonLingerPolicy(input.summon.uncontrolledLinger) ||
    !input.summon.concentration || input.summon.persistent || input.summon.becomesHostileAfterConcentrationEnds || input.summon.persistAfterConcentrationCompletes)) return { ok: false, reason: 'invalid-summon' }
  if (monster) {
    const [numerator,denominator='1']=monster.challenge.rating.split('/')
    const rating=Number(numerator)/Number(denominator)
    if (input.summon.maximumChallengeRating != null && (!Number.isFinite(rating)||rating>input.summon.maximumChallengeRating)) return {ok:false,reason:'invalid-summon'}
    const required=input.summon.requiredCreatureSubtype
    if (required && !dnd5eCreatureSubtypeMatches(monster.subtypes,required)) return {ok:false,reason:'invalid-summon'}
  }
  const template = DND5E_SRD_ENEMY_POOL.find((candidate) => candidate.id === input.summon.monsterId) ??
    (monster ? dnd5eMonsterToEnemyTemplate(monster) : undefined)
  if (
    (input.summon.creatureTypeOverride != null && !['celestial','fey','fiend'].includes(input.summon.creatureTypeOverride)) ||
    (input.summon.minimumIntelligence != null && (!Number.isInteger(input.summon.minimumIntelligence) || input.summon.minimumIntelligence < 1 || input.summon.minimumIntelligence > 30)) ||
    (input.summon.shareSelfSpellsRequiresMounted === true && input.summon.shareSelfSpellsRangeFeet == null) ||
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
  const position = input.animatedObject
    ? { x: input.animatedObject.x, y: input.animatedObject.y }
    : tokenCenterForAnchorCell(input.targetCell, tokenBase, input.map)
  const footprint = tokenOccupiedCellsAt(tokenBase, input.map, position)
  const geometry = input.geometry ?? mapGeometryRuntimeForMap(input.map.id)
  const placementToken = {
    ...input.actorToken,
    ...tokenBase,
    ...position,
    elevationFeet: input.animatedObject?.elevationFeet ?? input.actorToken.elevationFeet,
  }
  if (
    footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
    (!input.animatedObject && footprint.some((cell) => occupied.has(cellKey(cell)))) ||
    mapGeometryPlacementBlocked({ geometry, map: input.map, token: placementToken, at: position }).blocked ||
    mapGeometryLineOfEffectBlocked({
      geometry,
      map: input.map,
      from: input.actorToken,
      to: position,
      fromElevationFeet: input.actorToken.elevationFeet,
      toElevationFeet: placementToken.elevationFeet,
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
    ...applyDnd5eEffectiveVisionProfile({}, compileDnd5eEffectiveVisionProfile({ monster })),
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
    creatureTypes: input.summon.creatureTypeOverride ? [input.summon.creatureTypeOverride] : patch.creatureTypes,
    creatureSize: patch.creatureSize,
    showHpOnToken: true,
    showDetailOnToken: true,
    dnd5eSummon: {
      schemaVersion: 1,
      pluginId: input.pluginId,
      featureId: input.featureId,
      sourceSpellId: input.sourceSpellId,
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
      naturalWeaponAttacksMagical: input.summon.naturalWeaponAttacksMagical === true ? true : undefined,
      weaponAttacksMagical: input.summon.weaponAttacksMagical === true ? true : undefined,
      attacksPerAction: input.summon.attacksPerAction,
      shareSelfSpellsRangeFeet: input.summon.shareSelfSpellsRangeFeet,
      shareSelfSpellsRequiresMounted: input.summon.shareSelfSpellsRequiresMounted,
      creatureTypeOverride: input.summon.creatureTypeOverride,
      minimumIntelligence: input.summon.minimumIntelligence,
      autonomousBehavior:input.summon.autonomousBehavior,
      independentPersistent:input.summon.independentPersistent,
      commandPolicy:input.summon.commandPolicy,
      bondKey:input.summon.bondKey,
      bondEffectId:input.summon.bondEffectId,
      understoodLanguage:input.summon.understoodLanguage,
      telepathyRangeFeet:input.summon.telepathyRangeFeet,
      controlSave:input.summon.controlSave,
      uncontrolledLinger: input.summon.uncontrolledLinger ? { ...input.summon.uncontrolledLinger } : undefined,
      requiredCreatureSubtype:input.summon.requiredCreatureSubtype,
      cannotAttack: input.summon.cannotAttack === true ? true : undefined,
      walkingSpeedFeet: input.summon.walkingSpeedFeet,
      dismissAfterDamageRounds: input.summon.dismissAfterDamageRounds,
      sourceDeathBehavior: input.summon.sourceDeathBehavior,
    },
  }
  if(input.summon.controlSave) token.dnd5eCombatState={...token.dnd5eCombatState,activeEffects:[createDnd5eSummonControlEffect(token,input.summon.controlSave)]}
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
  if (token.dnd5eSummon?.animatedCorpse) {
    const original = structuredClone(token.dnd5eSummon.animatedCorpse)
    return { ...original, x: token.x, y: token.y, hp: 0,
      elevationFeet: token.elevationFeet ?? original.elevationFeet }
  }
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
  worldMinute?: number
}): { map: BattleMap; removedTokenIds: string[]; promotedTokenIds: string[]; hostileTokenIds: string[] } {
  const characters = new Map(input.characters.map((character) => [character.id, character]))
  const tokensById = new Map(input.map.tokens.map((token) => [token.id, token]))
  const removedTokenIds: string[] = []
  const promotedTokenIds: string[] = []
  const hostileTokenIds: string[] = []
  let transitioned=false
  const tokens = input.map.tokens.flatMap((token) => {
    const summon = token.dnd5eSummon
    if (!summon) return [token]
    const source = characters.get(summon.sourceCharacterId)
    const sourceToken = tokensById.get(summon.sourceTokenId)
    const sourceEffects=source?.dnd5eCombatState?.activeEffects??sourceToken?.dnd5eCombatState?.activeEffects??[]
    const bondEnded=!!summon.bondKey && !sourceEffects.some(effect=>effect.definitionId===`summon-bond:${summon.bondKey}` && (!summon.bondEffectId || effect.id===summon.bondEffectId) && !effect.tags?.includes('bond-dismissed'))
    const expired = dnd5eSummonDurationExpired(summon, input.round, input.worldMinute)
    const damageDismissed = summon.dismissAtRound != null && input.round >= summon.dismissAtRound
    const defeated = (token.hp ?? token.maxHp ?? 1) <= 0
    // Independent permanent creatures leave their own corpse, not the remains
    // consumed at creation, and do not disappear with their former creator.
    if (summon.independentPersistent && defeated) {
      if (token.dnd5eCombatState?.undeadFortitudePending || token.dnd5eCombatState?.monsterRegenerationPendingAtZero || token.dnd5eCombatState?.stableAtZero) return [token]
      transitioned = true
      return [{ ...token, dnd5eSummon: undefined }]
    }
    // A death-bound creature leaves a body; it is not a dismissed conjuration.
    if (defeated && summon.sourceDeathBehavior === 'die' && summon.sourceDeathHandled) return [token]
    // Absence of a persistent companion's owner is not evidence of death or
    // dismissal (for example while another map's roster is unavailable).
    if (!source && !sourceToken && summon.persistent && summon.sourceDeathBehavior === 'die' && !summon.dismissed) return [token]
    const concentrationEnded = !!summon.concentrationId &&
      (source?.dnd5eCombatState?.concentrationSpellId ??
        sourceToken?.dnd5eCombatState?.concentrationSpellId) !== summon.concentrationId
    if (concentrationEnded && summon.controlEnded && (summon.uncontrolledLinger || summon.controlSave?.lingerDieSides) && !expired && !defeated && !damageDismissed) {
      transitioned=true
      return [detachDnd5eUncontrolledSummon(token,input.round,undefined,input.worldMinute)]
    }
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
    if ((!source && !sourceToken && !summon.independentPersistent) || bondEnded || summon.dismissed || expired || damageDismissed || defeated || concentrationEnded) {
      removedTokenIds.push(token.id)
      const restoredObject = dnd5eRestoredSummonedOriginalObject(token)
      const possessions = droppedDnd5eCompanionObjects(token)
      if (restoredObject) return [restoredObject, ...possessions]
      return possessions
    }
    return [token]
  })
  return transitioned || removedTokenIds.length > 0 || promotedTokenIds.length > 0 || hostileTokenIds.length > 0
    ? { map: { ...input.map, tokens }, removedTokenIds, promotedTokenIds, hostileTokenIds }
    : { map: input.map, removedTokenIds, promotedTokenIds, hostileTokenIds }
}
