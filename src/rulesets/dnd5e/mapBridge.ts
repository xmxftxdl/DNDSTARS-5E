import { dnd5eInherentFeatureLightEffects } from './inherentFeatureLight'
import { applyDnd5eCounterattackInventoryCosts } from './counterattackInventory'
import { dnd5eMapEtherealAccess } from './mapPlane'
import { dnd5eActiveEmittedLight } from './activeEffects'
import {recordDnd5eCreatureSightings, dnd5eSightingWorldMinute} from './recentCreatureSightings'
import {recordDnd5eWithinReachMapMovement} from './withinReachMovementMapProgress'
import {dnd5eCombatantCanSee} from './headlessCombatEngine'
import {projectDnd5eTempleRollPenalties} from './templeRollPenalty'
import {applyDnd5ePersistentAreaMapChanges} from './persistentAreaMapChanges'
import { normalizeSubmergedBreathingEffectDeadlines } from '../../../shared/submerged-breathing-state.mjs'
import {freezeDnd5eWaterWallsFromEvents} from './waterWallFreezing'
import { captureDnd5eLinkedTargetPresentations } from './linkedTargetPresentation'
import { dnd5eExhaustionState, dnd5eSourcedExhaustionLevel, normalizeDnd5eSourcedExhaustion } from './sourcedExhaustion'
import { normalizeDnd5eSubmergedBreathing } from './submergedBreathing'
import { projectDnd5eMapMagicPresences } from './mapMagicDetection'
import { dnd5eHasLinkedEffectLifetime } from './linkedEffectLifetimes'
import { projectDnd5eGroundItemEffectOrigins, clearEndedDnd5eGroundItemEffects } from './mapGroundItemEffectOrigins'
import { expireDnd5eGroundInventoryAlterations } from './mapInventoryAlteration'
import { projectDnd5ePersistentAreaEffectSources } from './persistentAreaObserverVision'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import { dnd5eCompanionCarriedWeightPounds } from './companionCarriedObjects'
import { dnd5eCompanionWornArmor } from './companionWornArmor'
import { sceneInteractionRuntimeForMap } from '../../lib/sceneInteractionRuntime'
import { dnd5eAttackableMapObject, dnd5eDestroyedMapObject } from './mapObjectCombatProfile'
import {reconcileDnd5eInventoryEffectBindings, dnd5eMapInventoryLifetimeEntries} from './inventoryEffectBindings'
import { dnd5eMappedUpwardClearance } from './verticalDisplacement'
import { dnd5eEntitySupportElevation } from './entitySupport'
import { normalizeDnd5eTraversalMode } from './traversal'
import { reconcileDnd5eAreaCaptivesAcrossMaps } from './persistentAreaEnd'
import { cancelDnd5eDelayedSummonsForEvents } from './activities/dnd5eDelayedSummonQueue'
import { reconcileDnd5eSourceEffectLifecycles } from './campaignTimeRules'
import { reconcileDnd5eBenefitDeathWitnesses, type Dnd5eBenefitDeathPeer } from './benefitHistoryRenewal'
import type { Dnd5eEffectLifetimePeer } from './linkedEffectLifetimes'
import { reconcileDnd5eSummonSourceDeathState, dnd5eSpellDurationIsInstantaneous } from './headlessCombatEngine'
import { recordDnd5eRestActivityWindow } from './restActivityWindows'
import { settleDnd5eEndedSpellMaterialEscrows } from './spellMaterialEscrow'
import { dnd5eCharacterKnownLanguagesV1, dnd5eCharacterBuildTagsV1 } from './buildChoices'
import { dnd5ePersistentWardProtectedFrom } from './persistentAreaGeometry'
import { expireDnd5eSourceBoundInventory, expireDnd5eReleasedWeapons } from './items'
import { projectSimulacrumCharacterForMapDetail } from './simulacrum'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import type { Character } from '../../types/character'
import type { Dnd5eAttackCoverOverride } from '../../lib/sharedCombatTypes'
import { getTokenTargetAc } from '../../lib/enemyCombatStats'
import {
  cellDistance,
  DND_FEET_PER_CELL,
  tokenFootprintCells,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import {
  DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  mapGeometryCanSeeToken,
  mapGeometryCoverBetween,
  mapGeometryIlluminationAtPoint,
  mapGeometrySunlightAtPoint,
  mapGeometryLineOfSightBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { createDnd5eCombatant, dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass, dnd5eCombatantPairKey, dnd5eDeclarativeCompanionProfileUpgrade, dnd5eDeclarativeEnvironmentalMovementSpeed, dnd5eDirectedCombatantPairKey, dnd5eEffectiveDarkvisionRangeFeet, dnd5eEffectiveSizeRank, dnd5eHeadlessTurnKey, hydrateDnd5eWildShapeCombatant, reconcileDnd5eSourceConditionAuras, reconcileDnd5eSourceLinkedRelations, reconcileDnd5eActivityExtraTurnGroups, startDnd5eHeadlessCombat, type Dnd5eCombatant, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonsterMapSpeed, dnd5eMonsterProficiencyBonus, getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from './monsters'
import { igniteDnd5eWebAreasFromFire, reconcileDnd5eWebRestraints } from './webAreaRules'
import { dnd5eCanThreatenRangedAttacker, dnd5eClassPassiveDefenses, dnd5eConditionImmuneFromSource, dnd5eIsIncapacitated } from './passiveDefenses'
import { dnd5eStandardConditionId } from './conditions'
import { dnd5eChallengeRatingValue } from './wildShape'
import {
  createDnd5eMechanicalEffect,
  createDnd5eConditionEffect,
  dnd5eConditionsFromActiveEffects,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eActiveForcedFleeSourceId,
  reconcileDnd5eEffectCompletionRequirements,
} from './activeEffects'
import {
  dnd5eEffectiveHitPointMaximum,
  normalizeDnd5eHitPointMaximumReductionLedger,
} from './hitPointMaximumReductions'
import { normalizeDnd5eSpecialSenses, type Dnd5eSpecialSense } from './specialSenses'
import { getRoomRulesSnapshot } from '../../lib/roomRulesState'
import { getRoomSession } from '../../lib/roomSession'
import {
  dnd5eEffectiveRulesContextForCombat,
  restoreDnd5eEffectiveRulesContextForCombat,
  type Dnd5eEffectiveRulesContextV1,
} from './effectiveRulesContext'
import { dnd5eMonsterHasStructuredShapechange } from './monsterAdvancedAbilities'
import {
  dnd5eMonsterHasAntimagicSusceptibility,
  dnd5eMonsterHasImmutableForm,
  dnd5eMonsterHasMagicResistance,
  dnd5eMonsterLimitedMagicImmunityRule,
} from './monsterGenericAbilities'
import { compileDnd5eEffectiveVisionProfile } from '../../../shared/dnd5e-vision-profile.mjs'
import { dnd5eCreatureFormVision } from './creatureFormVision'
import { dnd5eWeaponDamageSource } from './equipment'
import { applyDnd5eInventoryResourceSnapshotsToCharacter } from './inventoryHeadlessRuntime'
import { applyDnd5eInventoryReactionSpellSnapshotsToCharacter } from './inventoryReactionSpells'
import type { Dnd5eMoralAlignment } from './damageDefenses'
import { dnd5eUtilityProjectionDistanceKey } from './utilityProjectionState'
import {
  dnd5eCreatureHeightFeetForSizeRank,
  dnd5eMapTokenDistanceFeet,
} from './verticalCombatGeometry'
import { dnd5eRestoredSummonedOriginalObject } from './summonedCreatures'
import { dnd5ePluginFeatureDefinition, dnd5eCharacterHasDeferredRageDeath } from './pluginApi'
import {
  dnd5ePersistentAreaOccupantModifiersAt,
  dnd5eTokenIntersectsPersistentAreaAt,
} from './persistentAreaGeometry'

export interface Dnd5eMapCombatSnapshot {
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
}

/**
 * Per-action snapshots may contain several initiative slots for the same
 * creature (for example Time Stop's one-shot extra turns). Preserve the
 * exact UI-authoritative slot whenever it still belongs to the actor instead
 * of collapsing back to that actor's first/normal slot.
 */
export function dnd5eRequestedInitiativeActorIndex(
  state: Pick<Dnd5eHeadlessCombatState, 'initiativeOrder'>,
  actorId: string,
  requestedIndex: number,
): number {
  return Number.isInteger(requestedIndex) &&
    requestedIndex >= 0 &&
    state.initiativeOrder[requestedIndex] === actorId
    ? requestedIndex
    : state.initiativeOrder.indexOf(actorId)
}

/**
 * Exploration actions reuse the combat resolver but are not combat turns.
 * Pin the synthetic actor's turn-start boundary so an ongoing periodic effect
 * from an ended encounter is not incorrectly demanded as dice for this action.
 */
export function prepareDnd5eExplorationActor(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
): Dnd5eCombatant | undefined {
  state.active = true
  const actor = state.combatants[actorId]
  if (!actor) return undefined
  const actorIndex = state.initiativeOrder.indexOf(actorId)
  actor.classState.turnStartResolvedTurnKey = dnd5eHeadlessTurnKey(
    actorIndex >= 0 ? { ...state, initiativeIndex: actorIndex } : state,
    actorId,
  )
  return actor
}

export interface Dnd5eAttackCoverSnapshot {
  cover: Dnd5eAttackCoverOverride
  armorClassBonus: 0 | 2 | 5
  blocksLineOfEffect: boolean
}

const DND5E_WORN_ARMOR_NOTE_FRAGMENTS = [
  '皮甲', '兽皮甲', '镶钉皮甲', '链甲衫', '链甲', '鳞甲', '胸甲', '半身板甲',
  '环甲', '板条甲', '条板甲', '板甲',
  'padded', 'leather', 'studded leather', 'hide', 'chain shirt', 'scale mail',
  'breastplate', 'half plate', 'ring mail', 'chain mail', 'splint', 'plate',
] as const

function dnd5eMonsterArmorClassNoteMeansWornArmor(note: string | undefined): boolean {
  const normalized = note?.trim().toLowerCase()
  return !!normalized && DND5E_WORN_ARMOR_NOTE_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment))
}

function dnd5eMonsterHasFeyAncestry(monster: Dnd5eMonsterStatBlock | undefined): boolean {
  return monster?.traits.some((trait) => {
    const name = trait.name.trim().toLowerCase()
    const description = trait.description.trim().toLowerCase()
    return name === 'fey ancestry' || name === '妖精血统' || name === '精灵血统' ||
      description.includes('advantage on saving throws against being charmed') ||
      description.includes('对抗魅惑') ||
      description.includes("magic can't put") || description.includes('magic cannot put') ||
      description.includes('魔法无法使其入睡') || description.includes('魔法不能使其入睡')
  }) === true
}

function dnd5eMonsterConditionImmunities(monster: Dnd5eMonsterStatBlock | undefined): readonly string[] | undefined {
  if (!monster) return undefined
  // Reviewed monster translations localize presentation strings in the
  // catalog. Headless Activity checks, however, consume canonical condition
  // ids. Preserve the reviewed labels for UI/logging while projecting their
  // canonical ids so effects such as Compulsion can automatically succeed
  // for charm-immune monsters.
  const catalogImmunities = monster.conditionImmunities ?? []
  const normalizedImmunities = catalogImmunities.flatMap((condition) => {
    const standard = dnd5eStandardConditionId(condition)
    return standard ? [condition, standard] : [condition]
  })
  const hasMagicalSleepImmunity = dnd5eMonsterHasFeyAncestry(monster)
  return hasMagicalSleepImmunity
    ? [...new Set([...normalizedImmunities, 'magical-sleep', '魔法睡眠'])]
    : [...new Set(normalizedImmunities)]
}

export function dnd5eAttackCoverForPair(
  state: Pick<Dnd5eHeadlessCombatState, 'coverBonusByCombatantPair' | 'lineOfEffectBlockedByCombatantPair'>,
  attackerId: string,
  targetId: string,
): Dnd5eAttackCoverSnapshot {
  const key = dnd5eDirectedCombatantPairKey(attackerId, targetId)
  if (state.lineOfEffectBlockedByCombatantPair?.[key]) {
    return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true }
  }
  const armorClassBonus = state.coverBonusByCombatantPair?.[key] ?? 0
  return armorClassBonus === 5
    ? { cover: 'three-quarters', armorClassBonus, blocksLineOfEffect: false }
    : armorClassBonus === 2
      ? { cover: 'half', armorClassBonus, blocksLineOfEffect: false }
      : { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
}

/** Applies a DM ruling only to the ephemeral state used by one attack transaction. */
export function applyDnd5eAttackCoverOverride(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
  cover: Dnd5eAttackCoverOverride,
): Dnd5eAttackCoverSnapshot {
  const key = dnd5eDirectedCombatantPairKey(attackerId, targetId)
  state.coverBonusByCombatantPair ??= {}
  state.lineOfEffectBlockedByCombatantPair ??= {}
  delete state.coverBonusByCombatantPair[key]
  delete state.lineOfEffectBlockedByCombatantPair[key]
  if (cover === 'total') state.lineOfEffectBlockedByCombatantPair[key] = true
  else if (cover === 'half') state.coverBonusByCombatantPair[key] = 2
  else if (cover === 'three-quarters') state.coverBonusByCombatantPair[key] = 5
  return dnd5eAttackCoverForPair(state, attackerId, targetId)
}

const DEFAULT_ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function tokenSpecialSenses(token: Token): Dnd5eSpecialSense[] {
  return [
    token.blindsightRangeFeet ? { kind: 'blindsight' as const, rangeFeet: token.blindsightRangeFeet,
      ...(token.blindBeyondBlindsight ? { blindBeyond: true as const } : {}) } : undefined,
    token.tremorsenseRangeFeet ? { kind: 'tremorsense' as const, rangeFeet: token.tremorsenseRangeFeet } : undefined,
    token.truesightRangeFeet ? { kind: 'truesight' as const, rangeFeet: token.truesightRangeFeet } : undefined,
  ].filter((sense): sense is Dnd5eSpecialSense => !!sense && sense.rangeFeet > 0)
}

function mergeSpecialSenses(...groups: readonly Dnd5eSpecialSense[][]): Dnd5eSpecialSense[] {
  const maximumByKind = new Map<Dnd5eSpecialSense['kind'], number>()
  for (const sense of groups.flat()) {
    maximumByKind.set(sense.kind, Math.max(maximumByKind.get(sense.kind) ?? 0, sense.rangeFeet))
  }
  return [...maximumByKind].map(([kind, rangeFeet]) => ({ kind, rangeFeet,
    ...(kind === 'blindsight' && groups.some(group => group.some(sense => sense.kind === kind && sense.blindBeyond))
      ? { blindBeyond: true as const } : {}),
  }))
}

function normalizeDnd5eMoralAlignment(alignment: unknown): Dnd5eMoralAlignment | undefined {
  if (typeof alignment !== 'string') return undefined
  const normalized = alignment.trim().toLowerCase()
  if (
    !normalized ||
    /(?:任意|无阵营|any alignment|unaligned|non-|非善良|非邪恶|非中立)/.test(normalized)
  ) return undefined
  if (normalized.includes('善良') || /\bgood\b/.test(normalized)) return 'good'
  if (normalized.includes('邪恶') || /\bevil\b/.test(normalized)) return 'evil'
  if (normalized.includes('中立') || /\bneutral\b/.test(normalized)) return 'neutral'
  const abbreviation = normalized.replace(/[\s_-]+/g, '').toUpperCase()
  if (['LG', 'NG', 'CG'].includes(abbreviation)) return 'good'
  if (['LE', 'NE', 'CE'].includes(abbreviation)) return 'evil'
  return ['LN', 'N', 'TN', 'CN'].includes(abbreviation) ? 'neutral' : undefined
}

function characterWeaponDamageSources(
  character: Character,
): Record<string, { magical: boolean; specialMaterial?: 'silvered' | 'adamantine' }> | undefined {
  const sources = [
    dnd5eWeaponDamageSource(character.equipment?.mainWeapon),
    dnd5eWeaponDamageSource(character.equipment?.offHand),
  ].filter((source): source is NonNullable<typeof source> => source != null)
  if (sources.length === 0) return undefined
  return Object.fromEntries(sources.map(({ weaponId, ...source }) => [weaponId, source]))
}

function characterGrappleFreeHandCapacity(character: Character): number {
  const occupiedHands = Number(character.equipment?.mainWeapon != null) +
    Number(character.equipment?.offHand != null)
  return Math.max(0, 2 - occupiedHands)
}

const DND5E_SKILL_ABILITY: Readonly<Record<string, keyof typeof DEFAULT_ABILITIES>> = {
  athletics: 'str',
  acrobatics: 'dex',
  sleightOfHand: 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  animalHandling: 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
}

function dnd5eMonsterExpertiseSkills(monster: Dnd5eMonsterStatBlock | undefined): string[] {
  if (!monster) return []
  const proficiencyBonus = dnd5eMonsterProficiencyBonus(monster.challenge.rating)
  return monster.skills?.flatMap((skill) => {
    const ability = DND5E_SKILL_ABILITY[skill.key]
    if (!ability) return []
    const proficiencyContribution = skill.bonus - rules.abilityModifier(monster.abilities[ability])
    return proficiencyContribution >= proficiencyBonus * 1.5 ? [skill.key] : []
  }) ?? []
}

export function dnd5eMapTokenCanThreatenRangedAttacker(
  attacker: Dnd5eCombatant,
  hostileToken: Token,
  hostileCombatant?: Dnd5eCombatant,
): boolean {
  const currentHp = hostileCombatant?.currentHp ?? hostileToken.hp ?? hostileToken.maxHp ?? 1
  if (currentHp <= 0 || hostileCombatant?.deathSaves.dead) return false
  const tokenState = hostileToken.dnd5eCombatState
  return dnd5eCanThreatenRangedAttacker(attacker, hostileCombatant ?? {
    classState: tokenState ?? {},
    conditions: tokenState?.conditions ?? [],
  })
}

function compactOptionalRecord<T extends object>(value: T): Partial<T> | undefined {
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)
  return entries.length > 0 ? Object.fromEntries(entries) as Partial<T> : undefined
}

function applyPaladinAuras(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const paladins = combatants.filter((combatant) =>
    dnd5eCombatantClassLevel(combatant, 'paladin') >= 6 && combatant.currentHp > 0 && !combatant.classState.stunnedByActorId,
  )
  if (paladins.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    const targetToken = tokenById.get(target.id)
    if (!targetToken) continue
    let savingThrowAuraBonus = 0
    let courageAura = false
    let devotionAura = false
    let wardingAura = false
    for (const paladin of paladins) {
      const paladinToken = tokenById.get(paladin.id)
      if (!paladinToken || areOpposedCombatTokens(paladinToken, targetToken)) continue
      const paladinLevel = dnd5eCombatantClassLevel(paladin, 'paladin')
      const radius = paladinLevel >= 18 ? 30 : 10
      if (tokenFootprintDistanceCells(paladinToken, targetToken, map) * feetPerCell > radius) continue
      savingThrowAuraBonus = Math.max(savingThrowAuraBonus, Math.max(1, rules.abilityModifier(paladin.abilities.cha)))
      if (paladinLevel >= 10) courageAura = true
      if (dnd5eCombatantHasSubclass(paladin, 'paladin', 'devotion') && paladinLevel >= 7) devotionAura = true
      const wardingFeature = paladin.pluginFeatureIds
        .map((featureId) => dnd5ePluginFeatureDefinition(featureId))
        .find((feature) => feature?.automation === 'full' &&
          feature.declarativeAbility?.mechanic?.kind === 'spell-damage-resistance-aura')
      const wardingMechanic = wardingFeature?.declarativeAbility?.mechanic
      if (wardingFeature && wardingMechanic?.kind === 'spell-damage-resistance-aura' &&
        paladinLevel >= (wardingFeature.minimumLevel ?? 1)) {
        const wardingRadius = wardingMechanic.expandedRadius && paladinLevel >= wardingMechanic.expandedRadius.level
          ? wardingMechanic.expandedRadius.radiusFeet
          : wardingMechanic.radiusFeet
        if (tokenFootprintDistanceCells(paladinToken, targetToken, map) * feetPerCell <= wardingRadius) {
          wardingAura = true
        }
      }
    }
    if (savingThrowAuraBonus > 0) {
      for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
        const base = target.savingThrowBonuses[ability] ?? rules.abilityModifier(target.abilities[ability])
        target.savingThrowBonuses[ability] = base + savingThrowAuraBonus
      }
    }
    if (courageAura) {
      target.conditionImmunities = [...new Set([...target.conditionImmunities, 'frightened', '惊惧', '恐慌'])]
    }
    if (devotionAura) {
      target.conditionImmunities = [...new Set([...target.conditionImmunities, 'charmed', '魅惑'])]
    }
    if (wardingAura) target.spellDamageResistance = true
  }
}

/** Projects generic source-centered save-pressure auras from authoritative ActiveEffects. */
function applyDnd5eActiveEffectAuras(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const source of combatants) {
    if (source.currentHp <= 0 || source.deathSaves.dead) continue
    const sourceToken = tokenById.get(source.id)
    if (!sourceToken) continue
    for (const effect of source.classState.activeEffects ?? []) {
      const aura = effect.suspendedBy?.length ? undefined : effect.modifiers?.spellSaveDisadvantageAura
      if (!aura) continue
      for (const target of combatants) {
        if (target.id === source.id || target.currentHp <= 0 || target.deathSaves.dead) continue
        const targetToken = tokenById.get(target.id)
        if (!targetToken || !areOpposedCombatTokens(sourceToken, targetToken)) continue
        if (tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell > aura.radiusFeet) continue
        target.spellSavingThrowDisadvantageDamageTypes = [...new Set([
          ...(target.spellSavingThrowDisadvantageDamageTypes ?? []),
          ...aura.damageTypes,
        ])]
        target.spellSavingThrowDisadvantageCastingClassIds = [...new Set([
          ...(target.spellSavingThrowDisadvantageCastingClassIds ?? []),
          ...(aura.spellcastingClassIds ?? []),
        ])]
      }
    }
  }
}

function applyClassPassiveDefenses(combatants: Dnd5eCombatant[]): void {
  for (const combatant of combatants) {
    const passive = dnd5eClassPassiveDefenses(combatant)
    combatant.damageImmunities = [...new Set([...combatant.damageImmunities, ...passive.damageImmunities])]
    combatant.conditionImmunities = [...new Set([...combatant.conditionImmunities, ...passive.conditionImmunities])]
  }
}

/**
 * Rebuild area-provided weapon riders from current token occupancy for every
 * authoritative snapshot. No target effect is persisted, so entering,
 * leaving, moving the source aura, expiration and concentration cleanup are
 * reflected immediately.
 */
function applyPersistentAreaWeaponHitBonusDamage(
  map: BattleMap,
  combatants: Dnd5eCombatant[],
  round: number,
): void {
  const combatantById = new Map(combatants.map((combatant) => [combatant.id, combatant]))
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  for (const area of map.dnd5ePluginAreas ?? []) {
    const damage = area.weaponHitBonusDamage
    const source = combatantById.get(area.sourceTokenId)
    if (!damage || !source || area.expiresAfterRound < round) continue
    const areaCells = new Set(area.cells.map((cell) => `${cell.col}:${cell.row}`))
    for (const target of combatants) {
      if (area.excludedTargetIds?.includes(target.id)) continue
      if (target.id === source.id && area.includeSelf !== true) continue
      if (area.relation === 'ally' && target.controller !== source.controller) continue
      if (area.relation === 'enemy' && target.controller === source.controller) continue
      const token = tokenById.get(target.id)
      if (!token || !tokenOccupiedCellsAt(token, map, token).some((cell) =>
        areaCells.has(`${cell.col}:${cell.row}`))) continue
      target.persistentAreaWeaponHitBonusDamage = [
        ...(target.persistentAreaWeaponHitBonusDamage ?? []),
        {
          areaId: area.id,
          sourceTokenId: source.id,
          count: damage.count,
          sides: damage.sides,
          bonus: damage.bonus ?? 0,
          type: damage.type,
          magical: damage.magical === true,
        },
      ]
    }
  }
}

function applyPersistentAreaOccupantConditions(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  for (const combatant of combatants) {
    const token = map.tokens.find(candidate => candidate.id === combatant.id)
    if (!token) continue
    const modifiers = dnd5ePersistentAreaOccupantModifiersAt({ map, token, position: token })
    for (const source of modifiers.conditionSources) {
      const origin = combatants.find(candidate => candidate.id === source.sourceTokenId)
      for (const condition of source.conditions) {
        if (dnd5eConditionImmuneFromSource(combatant, condition, origin, { sourceMagical: true })) continue
        combatant.classState.activeEffects = [...(combatant.classState.activeEffects ?? []), createDnd5eConditionEffect({
          id: `persistent-area-occupant:${source.areaId}:${combatant.id}:${condition}`,
          definitionId: `persistent-area:${source.areaId}:${condition}`,
          condition, targetId: combatant.id,
          source: { kind: 'spell', label: source.label, actorId: source.sourceTokenId, rulesId: `persistent-area-occupant:${source.areaId}`, magical: true },
          duration: { type: 'permanent' },
          ...(combatant.magicSuppressed ? { suspendedBy: ['persistent-area:antimagic'] } : {}),
        })]
      }
    }
  }
}

function applyPersistentAreaOccupantModifiers(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  for (const combatant of combatants) {
    const token = tokenById.get(combatant.id)
    if (!token) continue
    const modifiers = dnd5ePersistentAreaOccupantModifiersAt({ map, token, position: token })
    for (const area of map.dnd5ePluginAreas ?? []) {
      if (area.sourceTokenId !== combatant.id || !area.sourceAbilityCheckRules?.length ||
        (area.sourceIncapacitatedBehavior === 'remove-area' && dnd5eIsIncapacitated(combatant))) continue
      combatant.classState.activeEffects = [...(combatant.classState.activeEffects ?? []), createDnd5eMechanicalEffect({
        id: `persistent-area-occupant:source-checks:${area.id}:${combatant.id}`,
        definitionId: `persistent-area:${area.id}:source-checks`, label: area.label,
        source: { kind: 'system', actorId: combatant.id, rulesId: `persistent-area-occupant:${area.id}`, magical: true },
        targetId: combatant.id, duration: { type: 'permanent' },
        modifiers: { abilityCheckRules: area.sourceAbilityCheckRules },
        ...(combatant.magicSuppressed || modifiers.suppressesMagic ? { suspendedBy: ['persistent-area:antimagic'] } : {}),
      })]
    }
    if (modifiers.savingThrowAdvantages.length) {
      combatant.classState.activeEffects = [...(combatant.classState.activeEffects ?? []), createDnd5eMechanicalEffect({
        id: `persistent-area-occupant:saves:${combatant.id}`, definitionId: 'persistent-area:saves',
        label: '区域豁免优势', source: { kind: 'system', magical: true, rulesId: `persistent-area-occupant:saves:${combatant.id}` }, targetId: combatant.id,
        duration: { type: 'permanent' }, modifiers: { savingThrowAdvantages: modifiers.savingThrowAdvantages },
        ...(combatant.magicSuppressed || modifiers.suppressesMagic ? { suspendedBy: ['persistent-area:antimagic'] } : {}),
      })]
    }
    combatant.persistentAreaAbilityCheckRules = modifiers.abilityCheckRules
    combatant.persistentAreaSkillBonuses = modifiers.skillCheckBonuses
    if (!combatant.magicSuppressed && !modifiers.suppressesMagic) {
      combatant.passivePerception += modifiers.skillCheckBonuses.perception ?? 0
      combatant.passiveInvestigation = (combatant.passiveInvestigation ?? 10) + (modifiers.skillCheckBonuses.investigation ?? 0)
    }
    if (modifiers.damageImmunities.length > 0) {
      combatant.damageImmunities = [...new Set([
        ...combatant.damageImmunities,
        ...modifiers.damageImmunities,
      ])]
    }
    if (modifiers.damageResistances.length > 0) {
      combatant.damageResistances = [...new Set([...combatant.damageResistances, ...modifiers.damageResistances])]
    }
    if (modifiers.damageVulnerabilities.length > 0) {
      combatant.damageVulnerabilities = [...new Set([
        ...(combatant.damageVulnerabilities ?? []),
        ...modifiers.damageVulnerabilities,
      ])]
    }
    if (modifiers.conditionImmunities.length > 0) {
      combatant.conditionImmunities = [...new Set([...combatant.conditionImmunities, ...modifiers.conditionImmunities])]
    }
    if (
      modifiers.conditionImmunitiesBySourceCreatureType.length > 0 ||
      modifiers.savingThrowAdvantagesBySourceCreatureType.length > 0 ||
      modifiers.spellTargetingImmunitySchools.length > 0 ||
      modifiers.magicallyHeldAloft ||
      modifiers.languageCapabilities != null
    ) {
      combatant.classState.activeEffects = [
        ...(combatant.classState.activeEffects ?? []),
        createDnd5eMechanicalEffect({
          id: `persistent-area-occupant:${combatant.id}`,
          definitionId: 'persistent-area:source-qualified-protection',
          label: '区域类型防护',
          source: {
            kind: 'system',
            rulesId: `persistent-area-occupant:${combatant.id}`,
            magical: true,
          },
          targetId: combatant.id,
          duration: { type: 'permanent' },
          modifiers: {
            conditionImmunitiesBySourceCreatureType:
              modifiers.conditionImmunitiesBySourceCreatureType,
            savingThrowAdvantagesBySourceCreatureType:
              modifiers.savingThrowAdvantagesBySourceCreatureType,
            spellTargetingImmunitySchools:
              modifiers.spellTargetingImmunitySchools,
            magicallyHeldAloft: modifiers.magicallyHeldAloft || undefined,
            languageCapabilities: modifiers.languageCapabilities,
          },
        }),
      ]
    }
    if (modifiers.attacksAgainstOccupantDisadvantageSources.length > 0) {
      combatant.classState.activeEffects = [
        ...(combatant.classState.activeEffects ?? []),
        ...modifiers.attacksAgainstOccupantDisadvantageSources.map((source) =>
          createDnd5eMechanicalEffect({
            id: `persistent-area-occupant:${source.areaId}:${combatant.id}`,
            definitionId: `persistent-area:${source.areaId}:attack-disadvantage`,
            label: source.label,
            source: {
              kind: 'system',
              rulesId: `persistent-area-occupant:${source.areaId}:${combatant.id}`,
              magical: true,
            },
            targetId: combatant.id,
            duration: { type: 'permanent' },
            modifiers: {
              attacksAgainstTargetDisadvantageCreatureTypes: source.creatureTypes,
            },
          })),
      ]
    }
    combatant.spellSavingThrowAdvantage ||= modifiers.spellSavingThrowAdvantage
    combatant.successfulSpellSaveNegatesDamage ||= modifiers.successfulSpellSaveNegatesDamage
    combatant.hitPointMaximumReductionImmunity ||= modifiers.hitPointMaximumReductionImmunity
    combatant.rangedWeaponAttacksPrevented ||= modifiers.preventsRangedWeaponAttacks
    combatant.concentrationSavingThrowDisadvantage ||= modifiers.concentrationSavingThrowDisadvantage
    combatant.soundSuppressed ||= modifiers.preventsVerbalComponents
    combatant.magicSuppressed ||= modifiers.suppressesMagic
    combatant.incapacitatedByAntimagicSusceptibility ||=
      modifiers.suppressesMagic &&
      dnd5eMonsterHasAntimagicSusceptibility(
        token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined,
      )
    combatant.spellSuppressionAreas = modifiers.spellSuppressionAreas.length > 0
      ? modifiers.spellSuppressionAreas.map((entry) => ({ ...entry }))
      : undefined
    if (modifiers.suppressesMagic) {
      combatant.classState.activeEffects = combatant.classState.activeEffects?.map((effect) =>
        effect.source.magical !== true ||
          (effect.source.kind === 'spell' && !!effect.source.rulesId && dnd5eSpellDurationIsInstantaneous(effect.source.rulesId))
          ? effect
          : {
              ...effect,
              suspendedBy: [...new Set([
                ...(effect.suspendedBy ?? []),
                'persistent-area:antimagic',
              ])],
            })
      if (combatant.classState.activeEffects) {
        combatant.classState.activeEffects = reconcileDnd5eEffectCompletionRequirements(combatant.classState.activeEffects)
      }
    }
  }
}

/**
 * UI turn scheduling uses persisted tokens rather than a Headless snapshot.
 * Recompute this transient map rule so an affected monster cannot retain an
 * interactive turn between snapshot creation and action submission.
 */
export function dnd5eTokenIsIncapacitatedByAntimagicArea(
  map: BattleMap,
  token: Token,
): boolean {
  if (!dnd5eMonsterHasAntimagicSusceptibility(
    token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined,
  )) return false
  return dnd5ePersistentAreaOccupantModifiersAt({ map, token, position: token })
    .suppressesMagic
}

function persistentActiveEffectsWithoutTransientAreaSuspension(
  effects: readonly import('./activeEffects').Dnd5eActiveEffectInstance[] | undefined,
) {
  return effects?.filter((effect) =>
    !effect.source.rulesId?.startsWith('persistent-area-occupant:'),
  ).map((effect) => {
    const suspendedBy = effect.suspendedBy?.filter((entry) =>
      entry !== 'persistent-area:antimagic')
    return {
      ...effect,
      source: { ...effect.source },
      duration: { ...effect.duration },
      repeatSave: effect.repeatSave ? { ...effect.repeatSave } : undefined,
      breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
      suspendedBy: suspendedBy?.length ? suspendedBy : undefined,
    }
  })
}

/** Remove only the condition projection whose sole source is an occupied area. */
function persistentConditionsWithoutTransientAreas(combatant: Dnd5eCombatant): string[] {
  const effects = combatant.classState.activeEffects ?? []
  const transient = new Set(effects.filter(effect => effect.source.rulesId?.startsWith('persistent-area-occupant:')).map(effect => effect.standardCondition).filter(Boolean))
  if (!transient.size) return [...combatant.conditions]
  const persistent = new Set(dnd5eConditionsFromActiveEffects(persistentActiveEffectsWithoutTransientAreaSuspension(effects)).map(dnd5eStandardConditionId))
  return combatant.conditions.filter(condition => {
    const standard = dnd5eStandardConditionId(condition)
    return !standard || !transient.has(standard) || persistent.has(standard)
  })
}

function applyBardCountercharm(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const sources = combatants.filter((combatant) => {
    if (dnd5eCombatantClassLevel(combatant, 'bard') < 6 || (combatant.classState.countercharmRoundsRemaining ?? 0) <= 0) return false
    const performanceEnded = combatant.currentHp <= 0 || dnd5eIsIncapacitated(combatant) ||
      combatant.conditions.some((condition) => ['silenced', '沉默'].includes(condition.toLowerCase()))
    if (performanceEnded) combatant.classState.countercharmRoundsRemaining = undefined
    return !performanceEnded
  })
  if (sources.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    if (target.conditions.some((condition) => ['deafened', '耳聋'].includes(condition.toLowerCase()))) continue
    const targetToken = tokenById.get(target.id)
    if (!targetToken) continue
    const sourceIds = sources.flatMap((source) => {
      const sourceToken = tokenById.get(source.id)
      if (!sourceToken || areOpposedCombatTokens(sourceToken, targetToken)) return []
      return tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell <= 30 ? [source.id] : []
    })
    if (sourceIds.length > 0) target.countercharmSourceIds = sourceIds
  }
}

function applyHolyNimbusSources(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const sources = combatants.filter((combatant) =>
    dnd5eCombatantClassLevel(combatant, 'paladin') >= 20 && dnd5eCombatantHasSubclass(combatant, 'paladin', 'devotion') &&
    combatant.currentHp > 0 && (combatant.classState.holyNimbusRoundsRemaining ?? 0) > 0,
  )
  if (sources.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    const targetToken = tokenById.get(target.id)
    if (!targetToken || target.currentHp <= 0) continue
    const sourceIds = sources.flatMap((source) => {
      const sourceToken = tokenById.get(source.id)
      if (!sourceToken || !areOpposedCombatTokens(sourceToken, targetToken)) return []
      return tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell <= 30 ? [source.id] : []
    })
    if (sourceIds.length > 0) target.holyNimbusSourceIds = sourceIds
  }
}

function applyDraconicPresenceSources(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const sources = combatants.filter((combatant) =>
    dnd5eCombatantClassLevel(combatant, 'sorcerer') >= 18 && dnd5eCombatantHasSubclass(combatant, 'sorcerer', 'draconic') &&
    combatant.currentHp > 0 && combatant.concentrating &&
    combatant.classState.concentrationSpellId?.startsWith('class:draconic-presence:'),
  )
  if (sources.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    const targetToken = tokenById.get(target.id)
    if (!targetToken || target.currentHp <= 0) continue
    const sourceIds = sources.flatMap((source) => {
      const sourceToken = tokenById.get(source.id)
      const effectId = source.classState.concentrationSpellId!
      const mode = effectId.endsWith(':fear') ? 'fear' : 'awe'
      const condition = mode === 'fear' ? 'frightened' : 'charmed'
      if (
        !sourceToken || !areOpposedCombatTokens(sourceToken, targetToken) ||
        (target.classState.draconicPresenceImmunityRoundsBySource?.[source.id] ?? 0) > 0 ||
        target.classState.concentrationEffectsBySource?.[source.id] === effectId ||
        dnd5eConditionImmuneFromSource(target, condition, source)
      ) return []
      return tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell <= 60 ? [source.id] : []
    })
    if (sourceIds.length > 0) target.draconicPresenceSourceIds = sourceIds
  }
}

function reconcileShapechangerReversionAreaLocks(
  map: BattleMap,
  combatants: Dnd5eCombatant[],
): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const areaById = new Map((map.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  for (const combatant of combatants) {
    const lockedAreaIds = combatant.classState.shapechangerReversionAreaIds
    if (!lockedAreaIds?.length) continue
    const token = tokenById.get(combatant.id)
    const retained = token ? lockedAreaIds.filter((areaId) => {
      const area = areaById.get(areaId)
      return area?.sourceKind === 'core-spell' && area.coreSpellId === 'moonbeam' &&
        dnd5eTokenIntersectsPersistentAreaAt(token, map, area, token)
    }) : []
    combatant.classState.shapechangerReversionAreaIds = retained.length > 0
      ? [...new Set(retained)]
      : undefined
  }
}

/** Reconcile persisted companions even when their owner is on another map. */
export function reconcileDnd5eSummonSourceDeathsOnMap(input: {
  map: BattleMap; characters: readonly Character[]; round: number; lifetimePeers?: readonly Dnd5eEffectLifetimePeer[]
}): { map: BattleMap; characters: readonly Character[]; events: Dnd5eCombatEvent[] } {
  if (!input.map.tokens.some(token => token.dnd5eSummon?.sourceDeathBehavior === 'die' ||
    token.dnd5eCombatState?.activeEffects?.some(dnd5eHasLinkedEffectLifetime) ||
    (token.characterId && input.characters.find(character => character.id === token.characterId)?.dnd5eCombatState?.activeEffects?.some(dnd5eHasLinkedEffectLifetime)))) {
    return { ...input, events: [] }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    ...input, combatId: `summon-lifetime:${input.map.id}`,
    initiativeOrder: input.map.tokens.map(token => ({ tokenId: token.id, label: token.label,
      roll: 0, color: token.color, emoji: token.emoji })),
  })
  const settled = reconcileDnd5eSummonSourceDeathState(snapshot.state, input.lifetimePeers)
  const changed = new Set(Object.keys(settled.state.combatants).filter(id =>
    JSON.stringify(settled.state.combatants[id]) !== JSON.stringify(snapshot.state.combatants[id])))
  if (!changed.size) return { ...input, events: [] }
  const applied = planDnd5eMapResultApplication({ ...input, state: settled.state,
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: settled.events })
  // Snapshot construction may normalize unrelated creatures. Only persist
  // creatures actually changed by this lifecycle transaction.
  const tokens = input.map.tokens.map(token => changed.has(token.id)
    ? applied.map.tokens.find(candidate => candidate.id === token.id) ?? token : token)
  const changedCharacters = new Set([...changed].map(id => snapshot.characterIdByCombatantId[id]).filter(Boolean))
  const characters = changedCharacters.size ? input.characters.map(character => changedCharacters.has(character.id)
    ? applied.characters.find(candidate => candidate.id === character.id) ?? character : character) : input.characters
  return { map: { ...input.map, tokens }, characters, events: settled.events }
}

export function reconcileDnd5eSummonSourceDeathsAcrossMaps(input: {
  maps: readonly BattleMap[]; characters: readonly Character[]; round: number; deletedMapIds?: readonly string[]; worldMinute?: number
}): { maps: readonly BattleMap[]; characters: readonly Character[]; events: Dnd5eCombatEvent[] } {
  const captives = reconcileDnd5eAreaCaptivesAcrossMaps(input)
  const inventoryLifetimes = reconcileDnd5eInventoryEffectBindings(captives.characters, dnd5eMapInventoryLifetimeEntries(captives.maps))
  let characters: readonly Character[] = inventoryLifetimes.some((character, index) => character !== captives.characters[index])
    ? inventoryLifetimes : captives.characters
  const events: Dnd5eCombatEvent[] = [...captives.events]
  let maps = captives.maps.map(map => {
    const result = reconcileDnd5eSummonSourceDeathsOnMap({ map, characters, round: input.round })
    characters = result.characters
    events.push(...result.events)
    return result.map
  })
  const hasLinks = () => characters.some(character => character.dnd5eCombatState?.activeEffects?.some(dnd5eHasLinkedEffectLifetime)) ||
    maps.some(map => map.tokens.some(token => token.dnd5eCombatState?.activeEffects?.some(dnd5eHasLinkedEffectLifetime)))
  const limit = characters.reduce((sum, character) => sum + (character.dnd5eCombatState?.activeEffects?.length ?? 0), 0) +
    maps.reduce((sum, map) => sum + map.tokens.reduce((count, token) => count + (token.dnd5eCombatState?.activeEffects?.length ?? 0), 0), 0)
  for (let pass = 0; pass <= limit && hasLinks(); pass++) {
    // Read all room maps, including unopened maps. Snapshot construction supplies
    // authoritative creature death semantics; token HP zero alone is insufficient.
    const remotePeers = maps.flatMap(map => {
      const snapshot = createDnd5eMapCombatSnapshot({ map, characters, round: input.round, combatId: `linked-lifetime:${map.id}`,
        initiativeOrder: map.tokens.map(token => ({ tokenId: token.id, label: token.label, roll: 0, color: token.color, emoji: token.emoji })) })
      return Object.values(snapshot.state.combatants).filter(combatant => !snapshot.characterIdByCombatantId[combatant.id]).map(combatant => ({
        mapId: map.id, peer: { actorId: combatant.id, dead: combatant.deathSaves.dead, effects: combatant.classState.activeEffects ?? [] } as Dnd5eEffectLifetimePeer,
      }))
    })
    const reconciled = reconcileDnd5eSourceEffectLifecycles(characters, remotePeers.map(entry => entry.peer))
    let changed = reconciled.some((character, index) => character !== characters[index])
    if (changed) characters = reconciled
    const rosterPeers: Dnd5eEffectLifetimePeer[] = characters.map(character => ({ actorId: character.id, characterId: character.id,
      dead: character.currentHp <= 0 && (character.deathSaveFailures ?? 0) >= 3 && !dnd5eCharacterHasDeferredRageDeath(character), effects: character.dnd5eCombatState?.activeEffects ?? [] }))
    maps = maps.map(map => {
      const result = reconcileDnd5eSummonSourceDeathsOnMap({ map, characters, round: input.round,
        lifetimePeers: [...rosterPeers, ...remotePeers.filter(entry => entry.mapId !== map.id).map(entry => entry.peer)] })
      changed ||= result.map !== map || result.characters !== characters
      characters = result.characters
      events.push(...result.events)
      return result.map
    })
    if (!changed) break
  }
  const benefits = reconcileDnd5eBenefitDeathsAcrossMaps({ maps, characters, worldMinute: input.worldMinute })
  return { maps: benefits.maps.some((map, index) => map !== input.maps[index]) ? benefits.maps : input.maps,
    characters: benefits.characters, events }
}

interface Dnd5eMapCombatProjectionInput {
  /** Resolve a creature as a target without granting it an initiative slot. */
  additionalCreatureTokenIds?: readonly string[]
  objectAttackTargetIds?: readonly string[]
  /** Already qualified by the Host's object-animation contract. No physical stats are inferred. */
  objectInteractionTargetIds?: readonly string[]
  worldMinute?: number
  worldSecondRemainder?: number
  /** Explicit snapshot geometry; null means a verified absence, not runtime fallback. */
  geometry?: import('../../lib/mapGeometry').MapGeometryState | null
  combatId: string
  round?: number
  turnSlotId?: string
  effectiveRules?: Dnd5eEffectiveRulesContextV1
  map: BattleMap
  characters: readonly Character[]
  /** Authoritative room scope, including unopened maps; never supplied by player actions. */
  roomMaps?: readonly BattleMap[]
  roomScenes?: readonly import('../../lib/sceneOrchestration').OrchestratedScene[]
  initiativeOrder: readonly InitiativeEntry[]
}

function projectDnd5eMapCombatants(input: Dnd5eMapCombatProjectionInput) {
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  // Lighting participates in Host perception even before the first action has
  // persisted a character effect. Do not write this derived source into the map.
  input = { ...input, map: { ...input.map, tokens: input.map.tokens.map(token => {
    const character = token.characterId ? charactersById.get(token.characterId) : undefined
    if (!character || dnd5ePersistentAreaOccupantModifiersAt({map:input.map,token,position:token}).suppressesMagic) return token
    const effects = dnd5eInherentFeatureLightEffects(character, [
      ...character.dnd5eCombatState?.activeEffects ?? [], ...token.dnd5eCombatState?.activeEffects ?? [],
    ])
    const light = dnd5eActiveEmittedLight(effects.filter(effect => effect.tags?.some(tag => tag.startsWith('feature-light:'))))
    if (!light) return token
    const existing = token.lightSource?.enabled ? token.lightSource : undefined
    const brightRadiusFeet = Math.max(existing?.brightRadiusFeet ?? 0, light.brightRadiusFeet)
    const existingOuter = (existing?.brightRadiusFeet ?? 0) + (existing?.dimRadiusFeet ?? 0)
    const inherentOuter = light.brightRadiusFeet + light.dimRadiusFeet
    return {...token,lightSource:{enabled:true,brightRadiusFeet,
      dimRadiusFeet:Math.max(existingOuter,inherentOuter)-brightRadiusFeet,
      color:existing && existingOuter >= inherentOuter ? existing.color : light.color,sourceKind:'spell' as const,
      ...(existing?.sunlight ? {sunlight:true as const} : {})}}
  }) } }
  const initiativeByTokenId = new Map<string, number>()
  for (const entry of input.initiativeOrder) {
    // Extra first-round slots must not replace the creature's normal initiative
    // when a per-action Headless snapshot builds its unique combatant order.
    if (!initiativeByTokenId.has(entry.tokenId) || !entry.turnKind) {
      initiativeByTokenId.set(entry.tokenId, entry.roll)
    }
  }
  const characterIdByCombatantId: Record<string, string> = {}
  const geometry = input.geometry === undefined ? mapGeometryRuntimeForMap(input.map.id) : input.geometry ?? undefined
  const combatants = input.map.tokens.flatMap((token) => {
    // NPC tokens are still creatures for spell saves and damage even when the
    // table does not give them turns. Spell-resolution callers provide a
    // synthetic initiative entry so they can participate in an ephemeral
    // Headless snapshot without joining the persisted combat turn order.
    if (token.type === 'obstacle' && input.objectInteractionTargetIds?.includes(token.id)) {
      // These neutral values satisfy the shared execution snapshot shape only.
      // The closed animation contract does not use them for damage, saves or attacks.
      return [createDnd5eCombatant({ id: token.id, name: token.label, controller: 'dm', initiative: -1000,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 0,
        armorClass: 0, currentHp: 1, maxHp: 1, temporaryHp: 0, speed: 0,
        position: { x: token.x, y: token.y }, elevationFeet: mapGeometryTokenElevation(geometry, token),
        concentrating: false, usesDeathSaves: false, objectDamageThreshold: 0, objectInteractionOnly: true })]
    }
    if (token.type === 'obstacle' && input.objectAttackTargetIds?.includes(token.id)) {
      const profile = dnd5eAttackableMapObject(token)
      if (!profile) return []
      return [createDnd5eCombatant({ id:token.id,name:token.label,controller:'dm',initiative:-1000,
        abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:0,
        armorClass:profile.armorClass,currentHp:profile.currentHp,maxHp:profile.maxHp,temporaryHp:0,
        speed:0,position:{x:token.x,y:token.y},concentrating:false,usesDeathSaves:false,
        objectDamageThreshold:profile.damageThreshold??0,
        damageImmunities:[...new Set(['poison' as const,'psychic' as const,...profile.damageImmunities??[]])],
        damageResistances:[...profile.damageResistances??[]],damageVulnerabilities:[...profile.damageVulnerabilities??[]] })]
    }
    if (token.type !== 'player' && token.type !== 'enemy' && token.type !== 'npc') return []
    const initiative = initiativeByTokenId.get(token.id) ??
      (input.additionalCreatureTokenIds?.includes(token.id) ? 0 : undefined)
    if (initiative == null) return []
    const character = token.characterId ? charactersById.get(token.characterId) : undefined
    const simulacrum = token.dnd5eSimulacrum
    // A player token that names a character must never silently fall through to
    // the generic monster path while the character resource is still syncing.
    // Omitting it makes the action fail closed instead of accepting an attack
    // that loses class, subclass, equipment, and plugin mechanics.
    if (token.type === 'player' && token.characterId && !character) return []
    if (character) {
      const migrated = migrateCharacterToDnd5e(projectSimulacrumCharacterForMapDetail(token, character))
      const visionProfile = compileDnd5eEffectiveVisionProfile({
        token,
        character: migrated,
        fallbackRangeFeet: geometry?.vision.defaultRangeFeet ??
          DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
      })
      if (!simulacrum) characterIdByCombatantId[token.id] = character.id
      const combatant = createCombatantFromDnd5eCharacter({
        character: migrated,
        controller: dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
        initiativeD20: Math.max(1, Math.min(20, initiative - migrated.initiativeBonus)),
        position: { x: token.x, y: token.y },
      })
      // Character effects persist between maps, while Headless concentration
      // ownership uses map-token ids. Rebind self-hosted concentration effects
      // to the new token before the combat starts; otherwise replacing a
      // concentration spell on another map cannot find and remove the old
      // effect (for example Magic Weapon cast on the caster's own weapon).
      const persistedConcentrationId = combatant.classState.concentrationSpellId
      if (persistedConcentrationId && combatant.classState.activeEffects?.length) {
        let hasSelfConcentrationEffect = false
        const staleSelfSourceIds = new Set<string>()
        combatant.classState.activeEffects = combatant.classState.activeEffects.flatMap((effect) => {
          const selfHostedConcentration = effect.duration.type === 'concentration' && (
            effect.source.characterId === character.id ||
            effect.source.actorId === character.id ||
            effect.duration.sourceActorId === character.id ||
            (effect.source.characterId == null && effect.source.actorName === character.name)
          )
          if (effect.duration.type === 'concentration' && selfHostedConcentration) {
            if (effect.source.actorId) staleSelfSourceIds.add(effect.source.actorId)
            if (effect.duration.sourceActorId) staleSelfSourceIds.add(effect.duration.sourceActorId)
          }
          const effectConcentrationId = effect.duration.type === 'concentration'
            ? effect.duration.concentrationId ?? effect.source.rulesId
            : undefined
          const ownConcentration = effect.duration.type === 'concentration' &&
            selfHostedConcentration &&
            effectConcentrationId === persistedConcentrationId
          if (ownConcentration) hasSelfConcentrationEffect = true
          // A character can only maintain one concentration spell. Activity
          // effects created before their outer spell transaction committed do
          // not always have duration.concentrationId, so use the spell source
          // id as the fallback and discard any older self-hosted concentration
          // row left behind on another map token.
          if (selfHostedConcentration && !ownConcentration) return []
          return [{
            ...effect,
            targetId: token.id,
            source: ownConcentration
              ? { ...effect.source, actorId: token.id }
              : { ...effect.source },
            duration: ownConcentration
              ? { ...effect.duration, sourceActorId: token.id }
              : { ...effect.duration },
          }]
        })
        if (hasSelfConcentrationEffect) {
          const currentMapTokenIds = new Set(input.map.tokens.map((candidate) => candidate.id))
          combatant.classState.concentrationTargetIds = [...new Set([
            ...(combatant.classState.concentrationTargetIds ?? [])
              .filter((targetId) => currentMapTokenIds.has(targetId)),
            token.id,
          ])]
          const concentrationEffectsBySource = Object.fromEntries(Object.entries(
            combatant.classState.concentrationEffectsBySource ?? {},
          ).filter(([sourceId]) => !staleSelfSourceIds.has(sourceId)))
          combatant.classState.concentrationEffectsBySource = {
            ...concentrationEffectsBySource,
            [token.id]: persistedConcentrationId,
          }
        }
      }
      if (simulacrum) {
        combatant.level = simulacrum.level
        combatant.proficiencyBonus = simulacrum.proficiencyBonus
        combatant.abilities = { ...simulacrum.abilities }
        combatant.armorClass = simulacrum.armorClass
        combatant.currentHp = Math.max(0, Math.min(simulacrum.maximumHitPoints, token.hp ?? simulacrum.maximumHitPoints))
        combatant.maxHp = simulacrum.maximumHitPoints
        combatant.speed = simulacrum.speed
        combatant.sizeRank = simulacrum.sizeRank
        combatant.creatureType = simulacrum.creatureType
        combatant.saveDc = simulacrum.saveDc
        combatant.classLevels = simulacrum.classLevels ? { ...simulacrum.classLevels } : undefined
        combatant.classResources = Object.fromEntries(Object.entries(simulacrum.classResources).map(([id, resource]) => [id, {
          current: resource.current, max: resource.maximum,
        }]))
        combatant.classState = { ...combatant.classState, ...(token.dnd5eCombatState ?? {}) }
        combatant.summonedSourceCombatantId = simulacrum.sourceTokenId
        combatant.summonedPersistent = true
        combatant.simulacrumCannotRegainSpellSlots = true
        combatant.simulacrumCannotRegainHitPoints = true
      }
      if (combatant.classState.spellControlMentalAbilities) {
        combatant.abilities = {
          ...combatant.abilities,
          ...combatant.classState.spellControlMentalAbilities,
        }
      }
      const weaponDamageSources = simulacrum ? {} : characterWeaponDamageSources(character)
      const mainWeaponId = simulacrum ? undefined : character.equipment?.mainWeapon?.id
      return [{
        ...combatant,
        protectedFromActorIds:dnd5ePersistentWardProtectedFrom(input.map,token),
        campaignWorldMinute: Number.isSafeInteger(character.dnd5eWorldTimeAppliedMinute)
          ? character.dnd5eWorldTimeAppliedMinute
          : undefined,
        languages: [...dnd5eCharacterKnownLanguagesV1(character)],
        communicationCreatureTypes: [...dnd5eCharacterBuildTagsV1(character, 'creature-communication')].map(type => type.toLowerCase()),
        mainWeaponId,
        mainWeaponMagical: !!mainWeaponId && weaponDamageSources?.[mainWeaponId]?.magical === true,
        weaponDamageSources,
        grappleFreeHandCapacity: characterGrappleFreeHandCapacity(character),
        moralAlignment: normalizeDnd5eMoralAlignment(character.alignment),
        id: token.id,
        name: token.label,
        initiative,
        // createCombatantFromDnd5eCharacter has already hydrated an active
        // creature form, including its size. Do not replace that form size
        // with the map token's original creatureSize during each action
        // snapshot: the following map projection would otherwise shrink a
        // Large-or-bigger polymorphed token back to Medium after it moved.
        sizeRank: combatant.classState.wildShapeFormId
          ? combatant.sizeRank
          : ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[token.creatureSize ?? '中型'],
        inSunlight: mapGeometrySunlightAtPoint({map:input.map,geometry,point:token,elevationFeet:mapGeometryTokenElevation(geometry,token)}),
        illumination: mapGeometryIlluminationAtPoint({
          geometry,
          map: input.map,
          tokens: input.map.tokens,
          point: token,
          elevationFeet: mapGeometryTokenElevation(geometry, token),
        }),
        elevationFeet: mapGeometryTokenElevation(geometry, token),
        groundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, token),
        traversalMode: normalizeDnd5eTraversalMode(token.dnd5eTraversalMode),
        airborne: mapGeometryTokenElevation(geometry, token) >
          mapGeometryTerrainElevationAtPoint(geometry, token),
        darkvisionRangeFeet: combatant.classState.wildShapeFormId ? combatant.darkvisionRangeFeet : (visionProfile.intrinsicDarkvisionRangeFeet ?? visionProfile.darkvisionRangeFeet) || undefined,
        darknessSightRangeFeet: visionProfile.darknessSightRangeFeet || undefined,
        magicalDarknessSightRangeFeet:
          visionProfile.magicalDarknessSightRangeFeet || undefined,
        specialSenses: tokenSpecialSenses(token),
      }]
    }
    const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
    const visionProfile = compileDnd5eEffectiveVisionProfile({
      token,
      monster,
      fallbackRangeFeet: geometry?.vision.defaultRangeFeet ??
        DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
    })
    const maximumReductionLedger =
      normalizeDnd5eHitPointMaximumReductionLedger(
        token.dnd5eCombatState?.hitPointMaximumReductionLedger,
      )
    const maxHp = maximumReductionLedger
      ? dnd5eEffectiveHitPointMaximum(
          maximumReductionLedger.baseMaximum,
          maximumReductionLedger,
        )
      : Math.max(1, token.maxHp ?? monster?.hitPoints.average ?? token.hp ?? 1)
    const {
      conditions: tokenConditions,
      temporaryHp: tokenTemporaryHp,
      stableAtZero: tokenStableAtZero,
      ...tokenClassState
    } = token.dnd5eCombatState ?? {}
    const controlBinding = dnd5eCompanionControlBinding(input.map, token, true)
    const wornArmor = dnd5eCompanionWornArmor(token, monster)
    const walkingSpeed = Math.max(0, (token.dnd5eSummon?.walkingSpeedFeet ?? (monster ? dnd5eMonsterMapSpeed(monster) : 30)) - (wornArmor?.speedPenaltyFeet ?? 0))
    const combatant = createDnd5eCombatant({
      id: token.id,
      name: token.label,
      carriedWeightLb: dnd5eCompanionCarriedWeightPounds(token.dnd5eCarriedObjects),
      // The two humanoid forms used by Danse Macabre retain two grasping hands.
      // Project equipment before reconciling grapples, or the generic fallback
      // silently drops a second maintained grapple during save/load.
      grappleFreeHandCapacity: monster?.id === 'srd-5.1:skeleton' || monster?.id === 'srd-5.1:zombie'
        ? 2 - Number(token.dnd5eCarriedObjects?.some(item => item.wieldedWeapon) === true)
        : undefined,
      alignment: token.dnd5eAlignment,
      originalAlignment: token.dnd5eOriginalAlignment,
      // True Polymorph's object-to-creature branch may remain friendly after
      // becoming permanent, but the caster explicitly loses control. Keep
      // relationship/targeting on the player side while assigning its turns
      // to the DM once the authority-owned control-ended flag is present.
      controller: token.dnd5eSummon?.controlEnded === true
        ? 'dm'
        : dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
      initiative,
      abilities: monster ? { ...monster.abilities, int: Math.max(monster.abilities.int, token.dnd5eSummon?.minimumIntelligence ?? 1) } : { ...DEFAULT_ABILITIES },
      savingThrowBonuses: monster?.savingThrows
        ? Object.fromEntries(Object.entries(monster.savingThrows).map(([ability, bonus]) => [
            ability,
            bonus + Math.max(0, token.dnd5eSummon?.savingThrowBonus ?? 0),
          ]))
        : undefined,
      skillProficiencies: monster?.skills?.map((skill) => skill.key),
      languages:[...(monster?.languages??[]),...token.dnd5eSummon?.understoodLanguage?[token.dnd5eSummon.understoodLanguage]:[]],
      protectedFromActorIds:dnd5ePersistentWardProtectedFrom(input.map,token),
      classSelections: {
        expertise: dnd5eMonsterExpertiseSkills(monster),
      },
      passivePerception: 10 + (monster?.skills?.find((skill) => skill.key === 'perception')?.bonus ??
        rules.abilityModifier(monster?.abilities.wis ?? DEFAULT_ABILITIES.wis)) +
        (monster?.skills?.some((skill) => skill.key === 'perception')
          ? Math.max(0, token.dnd5eSummon?.proficientSkillCheckBonus ?? 0)
          : 0),
      proficiencyBonus: monster ? dnd5eMonsterProficiencyBonus(monster.challenge.rating) : 2,
      saveDc: monster?.spellcasting?.saveDc,
      challengeRating: monster ? dnd5eChallengeRatingValue(monster.challenge.rating) : undefined,
      sizeRank: ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[token.creatureSize ?? monster?.size ?? '中型'],
      inSunlight: mapGeometrySunlightAtPoint({map:input.map,geometry,point:token,elevationFeet:mapGeometryTokenElevation(geometry,token)}),
      illumination: mapGeometryIlluminationAtPoint({
        geometry,
        map: input.map,
        tokens: input.map.tokens,
        point: token,
        elevationFeet: mapGeometryTokenElevation(geometry, token),
      }),
      armorClass: (wornArmor?.armorClass ?? monster?.armorClass.value ?? getTokenTargetAc(token) ?? 10) +
        Math.max(0, token.dnd5eSummon?.armorClassBonus ?? 0),
      currentHp: Math.max(0, Math.min(dnd5eSourcedExhaustionLevel(dnd5eExhaustionState(tokenClassState.sourcedExhaustion)) >= 4
        ? Math.floor(maxHp / 2) : maxHp, token.hp ?? maxHp)),
      maxHp: dnd5eSourcedExhaustionLevel(dnd5eExhaustionState(tokenClassState.sourcedExhaustion)) >= 4
        ? Math.floor(maxHp / 2) : maxHp,
      temporaryHp: Math.max(0, Math.floor(tokenTemporaryHp ?? 0)),
      exhaustionLevel: dnd5eSourcedExhaustionLevel(dnd5eExhaustionState(tokenClassState.sourcedExhaustion)),
      speed: walkingSpeed,
      movementSpeeds: monster ? {
        walk: Math.max(0, (token.dnd5eSummon?.walkingSpeedFeet ?? monster.speed.walk ?? 0) - (wornArmor?.speedPenaltyFeet ?? 0)),
        climb: monster.speed.climb,
        swim: monster.speed.swim,
        fly: monster.speed.fly,
        hover: monster.speed.hover,
      } : { walk: 30 },
      position: { x: token.x, y: token.y },
      elevationFeet: mapGeometryTokenElevation(geometry, token),
      groundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, token),
      traversalMode: normalizeDnd5eTraversalMode(token.dnd5eTraversalMode),
      // Elevation is physical state, independent of where the flight speed
      // came from. A walking monster held aloft by Fly must remain airborne in
      // the Headless snapshot so losing that effect can trigger a real fall.
      airborne: mapGeometryTokenElevation(geometry, token) >
        mapGeometryTerrainElevationAtPoint(geometry, token),
      darkvisionRangeFeet: (visionProfile.intrinsicDarkvisionRangeFeet ?? visionProfile.darkvisionRangeFeet) || undefined,
      darknessSightRangeFeet: visionProfile.darknessSightRangeFeet || undefined,
      magicalDarknessSightRangeFeet:
        visionProfile.magicalDarknessSightRangeFeet || undefined,
      specialSenses: mergeSpecialSenses(normalizeDnd5eSpecialSenses(monster?.senses), tokenSpecialSenses(token)),
      magicResistance: dnd5eMonsterHasMagicResistance(monster),
      limitedMagicImmunity: dnd5eMonsterLimitedMagicImmunityRule(monster),
      shapechanger: monster?.capabilities?.shapechanger === true ||
        (!!monster && dnd5eMonsterHasStructuredShapechange(monster.id)),
      immutableForm: dnd5eMonsterHasImmutableForm(monster),
      naturalWeaponAttacksMagical: token.dnd5eSummon?.naturalWeaponAttacksMagical,
      weaponAttacksMagical: token.dnd5eSummon?.weaponAttacksMagical === true || monster?.traits.some((trait) =>
        trait.rule?.kind === 'magic-weapons' && trait.rule.weaponAttacksMagical
      ),
      mainWeaponId: monster?.actions.find((action) => action.kind === 'weapon-attack')?.id,
      concentrating: !!tokenClassState.concentrationSpellId,
      classState: {
        ...tokenClassState,
        exhaustionBaseMaxHp: dnd5eSourcedExhaustionLevel(dnd5eExhaustionState(tokenClassState.sourcedExhaustion)) >= 4 ? maxHp : undefined,
        bodyPartPresence: tokenClassState.bodyPartPresence ?? (monster?.bodyPartPresence ? { ...monster.bodyPartPresence } : undefined),
        legendaryResistanceUses: tokenClassState.legendaryResistanceUses ?? monster?.legendaryResistanceUses,
        monsterLegendaryActionPoints: tokenClassState.monsterLegendaryActionPoints ??
          ((monster?.legendaryActions?.length ?? 0) > 0 ? (monster?.legendaryActionPoints ?? 3) : undefined),
        monsterActionUsesByActionId: tokenClassState.monsterActionUsesByActionId ?? (monster
          ? Object.fromEntries([
              ...monster.actions,
              ...(monster.bonusActions ?? []),
              ...(monster.reactions ?? []),
              ...(monster.legendaryActions ?? []),
              ...(monster.lairActions ?? []),
            ].flatMap((action) => action.usage?.kind === 'per-day'
              ? [[action.id, { current: action.usage.max, max: action.usage.max }]]
              : []))
          : undefined),
        monsterSpellSlots: tokenClassState.monsterSpellSlots ?? (monster?.spellcasting?.slots
          ? Object.fromEntries(Object.entries(monster.spellcasting.slots).map(([level, maximum]) => [
              level,
              { current: maximum, max: maximum },
            ]))
          : undefined),
        monsterSpellUsesBySpellId: tokenClassState.monsterSpellUsesBySpellId ?? (monster?.spellcasting?.spells
          ? Object.fromEntries(monster.spellcasting.spells.flatMap((spell) => spell.usage?.kind === 'per-day'
            ? [[spell.id, { current: spell.usage.max, max: spell.usage.max }]]
            : []))
          : undefined),
      },
      wearingArmor: wornArmor?.wearingArmor ?? (monster?.id === 'srd-5.1:skeleton' || dnd5eMonsterArmorClassNoteMeansWornArmor(monster?.armorClass.note)),
      wearingHeavyArmor: wornArmor?.wearingHeavyArmor,
      wearingUnproficientArmor: wornArmor?.wearingUnproficientArmor,
      armorStealthDisadvantage: wornArmor?.armorStealthDisadvantage,
      wearingMetalArmor: wornArmor?.wearingMetalArmor ?? (!!monster?.armorClass.note && [
        '链甲', '鳞甲', '胸甲', '半身板甲', '环甲', '板条甲', '板甲',
        'chain', 'scale', 'breastplate', 'half plate', 'ring mail', 'splint', 'plate',
      ].some((name) => monster.armorClass.note!.toLowerCase().includes(name))),
      conditions: tokenConditions,
      statBlockId: monster?.id,
      summonedWeaponDamageBonus: token.dnd5eSummon?.weaponDamageBonus,
      summonedWeaponAttackBonus: token.dnd5eSummon?.weaponAttackBonus,
      summonedProficientSkillCheckBonus: token.dnd5eSummon?.proficientSkillCheckBonus,
      summonedAttacksPerAction: token.dnd5eSummon?.attacksPerAction,
      summonedShareSelfSpellsRangeFeet: token.dnd5eSummon?.shareSelfSpellsRangeFeet,
      summonedShareSelfSpellsRequiresMounted: token.dnd5eSummon?.shareSelfSpellsRequiresMounted,
      summonedCannotAttack: token.dnd5eSummon?.cannotAttack === true,
      summonedAutonomousBehavior: token.dnd5eSummon?.autonomousBehavior,
      summonedCommandPolicy: controlBinding?.commandPolicy,
      summonedBondKey:token.dnd5eSummon?.bondKey,
      summonedUncontrolledSubtype:token.dnd5eSummon?.autonomousBehavior==='attack-nearest-other-subtype' || token.dnd5eSummon?.controlEnded && token.dnd5eSummon.controlSave ? token.dnd5eSummon.requiredCreatureSubtype ?? 'demon' : undefined,
      summonedControlSubtype:token.dnd5eSummon?.controlSave ? token.dnd5eSummon.requiredCreatureSubtype : undefined,
      summonedSourceActivityId:controlBinding?.featureId,
      summonedSourcePackageId: controlBinding?.pluginId,
      summonedDeathSourceCombatantId: token.dnd5eSummon?.sourceDeathBehavior === 'die' ? token.dnd5eSummon.sourceTokenId : undefined,
      summonedDeathSourceCharacterId: token.dnd5eSummon?.sourceDeathBehavior === 'die' ? token.dnd5eSummon.sourceCharacterId : undefined,
      summonedDeathSourceConfirmedDead: token.dnd5eSummon?.sourceDeathBehavior === 'die' ? (() => {
        const source = charactersById.get(token.dnd5eSummon.sourceCharacterId)
        return !source ? undefined : source.currentHp > 0 ? false
          : (source.deathSaveFailures ?? 0) >= 3 && !dnd5eCharacterHasDeferredRageDeath(source) ? true : undefined
      })() : undefined,
      summonedSourceDeathHandled: token.dnd5eSummon?.sourceDeathHandled,
      summonedSourceCombatantId: controlBinding?.controlEnded === true
        ? undefined
        : controlBinding?.sourceTokenId,
      summonedPersistent: token.dnd5eSummon?.persistent === true,
      // Custom and unlinked combat tokens carry their creature taxonomy on
      // the map token. Dropping it here bypassed creature-type rules such as
      // Spare the Dying's construct/undead immunity.
      creatureType: token.dnd5eSummon?.creatureTypeOverride ?? monster?.creatureType ?? token.creatureTypes?.[0],
      damageVulnerabilities: monster?.damageVulnerabilities,
      damageResistances: monster?.damageResistances,
      damageImmunities: monster?.damageImmunities,
      damageDefenseRules: monster?.damageDefenseRules,
      moralAlignment: normalizeDnd5eMoralAlignment(monster?.alignment),
      conditionImmunities: dnd5eMonsterConditionImmunities(monster),
      racialSavingThrowAdvantages: dnd5eMonsterHasFeyAncestry(monster)
        ? { conditions: ['charmed', '魅惑'] }
        : undefined,
    })
    if (simulacrum) {
      combatant.level = simulacrum.level
      combatant.proficiencyBonus = simulacrum.proficiencyBonus
      combatant.abilities = { ...simulacrum.abilities }
      combatant.armorClass = simulacrum.armorClass
      combatant.currentHp = Math.max(0, Math.min(simulacrum.maximumHitPoints, token.hp ?? simulacrum.maximumHitPoints))
      combatant.maxHp = simulacrum.maximumHitPoints
      combatant.speed = simulacrum.speed
      combatant.sizeRank = simulacrum.sizeRank
      combatant.creatureType = simulacrum.creatureType
      combatant.saveDc = simulacrum.saveDc
      combatant.classLevels = simulacrum.classLevels ? { ...simulacrum.classLevels } : undefined
      combatant.classResources = Object.fromEntries(Object.entries(simulacrum.classResources).map(([id, resource]) => [id, {
        current: resource.current, max: resource.maximum,
      }]))
      combatant.summonedSourceCombatantId = simulacrum.sourceTokenId
      combatant.summonedPersistent = true
      combatant.simulacrumCannotRegainSpellSlots = true
      combatant.simulacrumCannotRegainHitPoints = true
    }
    if (tokenClassState.spellControlMentalAbilities) {
      combatant.abilities = {
        ...combatant.abilities,
        ...tokenClassState.spellControlMentalAbilities,
      }
    }
    if (!token.characterId && combatant.currentHp === 0 && tokenClassState.deathRound != null) {
      // Player-controlled summons also need their confirmed death restored.
      combatant.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    } else if (!token.characterId && combatant.currentHp === 0 && tokenStableAtZero === true) {
      combatant.deathSaves = {
        successes: 0,
        failures: 0,
        stable: true,
        dead: false,
      }
    }
    return [hydrateDnd5eWildShapeCombatant(combatant)]
  })
  for (const companion of combatants) {
    if (!companion.summonedSourceCombatantId) continue
    const owner = combatants.find((candidate) => candidate.id === companion.summonedSourceCombatantId)
    if (!owner) continue
    // Grove guardians keep monster UI control, but obey their caster's side in
    // mechanical friend/enemy checks (Help, targeting and other effects).
    const companionToken = input.map.tokens.find(token => token.id === companion.id)
    if (companionToken?.dnd5eGroveGuardian && dnd5eCompanionControlBinding(input.map, companionToken)) {
      companion.controller = owner.controller
    }
    const upgrade = dnd5eDeclarativeCompanionProfileUpgrade(owner)
    companion.weaponAttacksMagical = companion.weaponAttacksMagical || upgrade.weaponAttacksMagical
    companion.summonedAttacksPerAction = Math.max(
      companion.summonedAttacksPerAction ?? 1,
      upgrade.attacksPerAction,
    )
    companion.summonedShareSelfSpellsRangeFeet = Math.max(
      companion.summonedShareSelfSpellsRangeFeet ?? 0,
      upgrade.shareSelfSpellsRangeFeet ?? 0,
    ) || undefined
  }
  for (const combatant of combatants) {
    const environment = geometry?.environment
    const climb = dnd5eDeclarativeEnvironmentalMovementSpeed(combatant, environment, 'climb')
    const swim = dnd5eDeclarativeEnvironmentalMovementSpeed(combatant, environment, 'swim')
    const fly = dnd5eDeclarativeEnvironmentalMovementSpeed(combatant, environment, 'fly')
    if (climb || swim || fly) combatant.movementSpeeds = {
      walk: combatant.movementSpeeds?.walk ?? combatant.speed,
      ...combatant.movementSpeeds,
      ...(climb ? { climb: Math.max(combatant.movementSpeeds?.climb ?? 0, climb) } : {}),
      ...(swim ? { swim: Math.max(combatant.movementSpeeds?.swim ?? 0, swim) } : {}),
      ...(fly ? { fly: Math.max(combatant.movementSpeeds?.fly ?? 0, fly) } : {}),
    }
  }
  reconcileShapechangerReversionAreaLocks(input.map, combatants)
  applyClassPassiveDefenses(combatants)
  applyPersistentAreaWeaponHitBonusDamage(
    input.map,
    combatants,
    Math.max(1, Math.floor(input.round ?? 1)),
  )
  applyPersistentAreaOccupantModifiers(input.map, combatants)
  applyPaladinAuras(input.map, combatants)
  applyDnd5eActiveEffectAuras(input.map, combatants)
  applyBardCountercharm(input.map, combatants)
  applyHolyNimbusSources(input.map, combatants)
  applyDraconicPresenceSources(input.map, combatants)
  // Immunity auras must be available before evaluating area conditions.
  applyPersistentAreaOccupantConditions(input.map, combatants)
  // Only the current Host map can supply these one-attack reaction offers.
  // Do not infer them from stored character effects or a player command.
  for (const target of combatants) {
    const token = input.map.tokens.find(candidate => candidate.id === target.id)
    target.persistentAreaAttackAdvantageSources = token ? (input.map.dnd5ePluginAreas ?? []).flatMap(area => {
      if (area.attackAdvantageReaction !== 'area-source' ||
        area.expiresAfterRound < (input.round ?? 1) ||
        (input.worldMinute != null && area.expiresAtWorldMinute != null && input.worldMinute >= area.expiresAtWorldMinute) ||
        !combatants.some(source => source.id === area.sourceTokenId) ||
        !dnd5eTokenIntersectsPersistentAreaAt(token, input.map, area, token)) return []
      return [{ areaId: area.id, sourceId: area.sourceTokenId }]
    }) : []
  }
  projectDnd5eTempleRollPenalties(geometry,combatants,input.worldMinute)
  return { combatants, characterIdByCombatantId, geometry }
}

/** Map status projection shares defenses with Headless but never starts a turn. */
/** Character identity uses the room roster; unrelated NPC tokens use certified map death state. */
export function projectDnd5eRoomBenefitDeathPeers(input: { maps: readonly BattleMap[]; characters: readonly Character[] }): Dnd5eBenefitDeathPeer[] {
  const peers: Dnd5eBenefitDeathPeer[] = input.characters.map(character => ({ actorId: character.id, characterId: character.id,
    dead: character.currentHp <= 0 && (character.deathSaveFailures ?? 0) >= 3 && !dnd5eCharacterHasDeferredRageDeath(character) }))
  for (const map of input.maps) {
    const projected = projectDnd5eMapCombatants({ map, characters: input.characters, geometry: null,
      combatId: `benefit-deaths:${map.id}`, initiativeOrder: map.tokens.map(token => ({ tokenId: token.id,
        label: token.label, emoji: token.emoji, color: token.color, roll: 0 })) })
    for (const peer of projected.combatants) {
      if (projected.characterIdByCombatantId[peer.id]) continue
      // Generic monster projection treats zero HP as death for combat cleanup.
      // A permanent lifetime benefit needs explicit saved death evidence.
      const token = map.tokens.find(token => token.id === peer.id)
      peers.push({ actorId: peer.id, dead: peer.currentHp <= 0 && peer.deathSaves.dead &&
        token?.dnd5eCombatState?.deathRound != null })
    }
  }
  return peers
}

export function reconcileDnd5eBenefitDeathsAcrossMaps(input: {
  maps: readonly BattleMap[]; characters: readonly Character[]; worldMinute?: number
}): { maps: readonly BattleMap[]; characters: readonly Character[] } {
  const peers = projectDnd5eRoomBenefitDeathPeers(input)
  const update = <T extends { spellAuthorityRecords?: Record<string, import('./spellAuthorityState').Dnd5eSpellAuthorityRecordV1> }>(state: T | undefined): T | undefined => {
    if (!state?.spellAuthorityRecords) return state
    const next = Object.fromEntries(Object.entries(state.spellAuthorityRecords).map(([id, record]) => [id,
      record.kind === 'benefit-history' ? reconcileDnd5eBenefitDeathWitnesses(record, peers, input.worldMinute) : record]))
    return Object.entries(next).some(([id, record]) => record !== state.spellAuthorityRecords![id])
      ? { ...state, spellAuthorityRecords: next } : state
  }
  const characters = input.characters.map(character => {
    const state = update(character.dnd5eCombatState)
    return state === character.dnd5eCombatState ? character : { ...character, dnd5eCombatState: state }
  })
  const maps = input.maps.map(map => {
    const tokens = map.tokens.map(token => {
      const state = update(token.dnd5eCombatState)
      return state === token.dnd5eCombatState ? token : { ...token, dnd5eCombatState: state }
    })
    return tokens.some((token, index) => token !== map.tokens[index]) ? { ...map, tokens } : map
  })
  return { maps: maps.some((map, index) => map !== input.maps[index]) ? maps : input.maps,
    characters: characters.some((character, index) => character !== input.characters[index]) ? characters : input.characters }
}

export function projectDnd5eMapAreaStatusEffects(map: BattleMap, characters: readonly Character[]) {
  if (!map.dnd5ePluginAreas?.some(area => area.occupantModifiers?.conditions?.length || area.occupantModifiers?.suppressesMagic)) return {}
  const { combatants } = projectDnd5eMapCombatants({
    map, characters, combatId: 'map-status-projection',
    initiativeOrder: map.tokens.map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })),
  })
  return Object.fromEntries(combatants.map(combatant => [combatant.id, combatant.classState.activeEffects ?? []]))
}

export function createDnd5eMapCombatSnapshot(input: Dnd5eMapCombatProjectionInput): Dnd5eMapCombatSnapshot {
  const { combatants, characterIdByCombatantId, geometry } = projectDnd5eMapCombatants(input)
  const state = startDnd5eHeadlessCombat(input.combatId, combatants)
  const scope = input.roomMaps ?? [input.map]
  const hasRenewal = input.characters.some(character => Object.values(character.dnd5eCombatState?.spellAuthorityRecords ?? {})
    .some(record => record.kind === 'benefit-history' && record.renewal)) || scope.some(map => map.tokens.some(token =>
      Object.values(token.dnd5eCombatState?.spellAuthorityRecords ?? {}).some(record => record.kind === 'benefit-history' && record.renewal)))
  if (hasRenewal) {
    state.benefitHistoryDeathPeers = projectDnd5eRoomBenefitDeathPeers({ maps: scope, characters: input.characters })
    state.benefitHistoryRoomComplete = input.roomMaps ? true : undefined
  }
  const authoritativeSlots = input.initiativeOrder.filter((entry) =>
    state.combatants[entry.tokenId] != null,
  )
  if (authoritativeSlots.length > 0) {
    // The generic engine keeps a sole-combatant constructor useful as an
    // out-of-combat sandbox. A map snapshot carrying an authoritative
    // initiative slot is different: the UI has explicitly published a combat,
    // so every action rebuilt from that one-slot order must remain resolvable.
    state.active = true
    state.initiativeOrder = authoritativeSlots.map((entry) => entry.tokenId)
    state.initiativeSlotIds = authoritativeSlots.map((entry) => entry.slotId ?? entry.tokenId)
    const firstRoundOnlyInitiativeSlotIds = authoritativeSlots.flatMap((entry) =>
      entry.firstRoundOnly ? [entry.slotId ?? entry.tokenId] : [],
    )
    state.firstRoundOnlyInitiativeSlotIds = firstRoundOnlyInitiativeSlotIds.length > 0
      ? firstRoundOnlyInitiativeSlotIds
      : undefined
    // Activity-granted turns span multiple player requests. Their durable
    // owner/group lives on the character or token state, while the shared
    // initiative tracker carries the generated slot ids. Reconnect those two
    // projections whenever a per-action Headless snapshot is rebuilt so an
    // ended extra turn is removed instead of becoming a permanent duplicate.
    const activityExtraTurnSlotIds = new Set(combatants.flatMap((combatant) =>
      [...(combatant.classState.activityExtraTurnGroup?.slotIds ?? []),
        ...(combatant.classState.zeroHitPointExtraTurn ? [combatant.classState.zeroHitPointExtraTurn.slotId] : []),
        ...(combatant.classState.interruptedTurnResume ? [combatant.classState.interruptedTurnResume.receipt.extraSlotId] : [])],
    ))
    const oneShotInitiativeSlotIds = authoritativeSlots.flatMap((entry) => {
      const slotId = entry.slotId ?? entry.tokenId
      return entry.turnKind === 'activity-extra-turn' ||
        activityExtraTurnSlotIds.has(slotId) ||
        slotId.startsWith('activity-extra-turns:')
        ? [slotId]
        : []
    })
    state.oneShotInitiativeSlotIds = oneShotInitiativeSlotIds.length > 0
      ? oneShotInitiativeSlotIds
      : undefined
  }
  if (authoritativeSlots.length > 0) reconcileDnd5eActivityExtraTurnGroups(state)
  state.mapId = input.map.id
  state.sceneEtherealAccess = dnd5eMapEtherealAccess(input.map)
  state.companionScene = {
    roomPlaneFacts: (input.roomMaps ?? [input.map]).map(map => ({ id: map.id, dnd5ePlane: map.dnd5ePlane })),
    interactionScenes: structuredClone(input.roomScenes?.filter(scene => scene.mapId === input.map.id) ??
      sceneInteractionRuntimeForMap(input.map.id)),
    map: structuredClone({ id: input.map.id, name: input.map.name, width: input.map.width, height: input.map.height,
      gridSize: input.map.gridSize, dnd5ePlane: input.map.dnd5ePlane, gridOffsetX: input.map.gridOffsetX, gridOffsetY: input.map.gridOffsetY,
      feetPerCell: input.map.feetPerCell, showGrid: input.map.showGrid,
      dnd5ePluginAreas: input.map.dnd5ePluginAreas,
      tokens: input.map.tokens.map(token => ({ id: token.id, characterId: token.characterId, type: token.type,
        x: token.x, y: token.y, size: token.size, creatureSize: token.creatureSize, hp: token.hp,
        elevationFeet: token.elevationFeet, label: token.label, color: token.color, emoji: token.emoji,
        dnd5eSummon: token.dnd5eSummon, dnd5eSpellEffect: token.dnd5eSpellEffect,
        dnd5eGroveGuardian: token.dnd5eGroveGuardian, dnd5eGroveControl: token.dnd5eGroveControl,
        dnd5eObjectState: token.dnd5eObjectState, dnd5eCarriedObjects: token.dnd5eCarriedObjects,
      })),
    }),
    geometry: geometry ? structuredClone(geometry) : null,
    worldMinute: input.worldMinute,
    worldSecondRemainder: input.worldSecondRemainder,
    projectedTokenIds: Object.keys(state.combatants),
  }

  state.coordinateUnitsPerFoot = input.map.gridSize /
    Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  state.environment = geometry?.environment
  state.weather = geometry?.weather
  state.overheadSpace = geometry?.overheadSpace
  const roomRules = getRoomRulesSnapshot()
  state.effectiveRules = input.effectiveRules
    ? restoreDnd5eEffectiveRulesContextForCombat(input.combatId, input.effectiveRules) ?? undefined
    : getRoomSession() && !roomRules
      ? undefined
      : dnd5eEffectiveRulesContextForCombat(input.combatId, roomRules)
  const combatantTokens = input.map.tokens.filter((token) => state.combatants[token.id])
  for (const token of combatantTokens) {
    const combatant = state.combatants[token.id]
    combatant.groundElevationFeet = dnd5eEntitySupportElevation({ map: input.map, token, geometry,
      terrainElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, token),
      elevationFeet: mapGeometryTokenElevation(geometry, token) })
    combatant.airborne = mapGeometryTokenElevation(geometry, token) > combatant.groundElevationFeet + 1e-4
    combatant.upwardClearanceFeet = dnd5eMappedUpwardClearance({ map: input.map, geometry, token,
      elevationFeet: mapGeometryTokenElevation(geometry, token) })
    combatant.symbolFearSourceVisible = (combatant.classState.activeEffects ?? []).some(effect => {
      if (effect.standardCondition !== 'frightened' || effect.suspendedBy?.length) return false
      const origin = effect.tags?.find(tag => tag.startsWith('symbol-origin:'))?.split(':').slice(1).map(Number)
      if (!origin || origin.length !== 2 || !origin.every(Number.isFinite)) return false
      return !mapGeometryLineOfSightBlocked({ geometry, map: input.map, from: token, to: { x: origin[0], y: origin[1] } })
    })
  }

  const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  state.gridDistance = {
    cellUnits: Math.max(1, input.map.gridSize),
    feetPerCell,
    offsetX: input.map.gridOffsetX,
    offsetY: input.map.gridOffsetY,
    footprintCellsByCombatantId: Object.fromEntries(
      combatantTokens.map((token) => [token.id, tokenFootprintCells(token)]),
    ),
  }
  state.distanceFeetByCombatantPair = {}
  state.utilityProjectionDistanceFeetByPair = {}
  state.coverBonusByCombatantPair = {}
  state.lineOfEffectBlockedByCombatantPair = {}
  state.lineOfSightBlockedByCombatantPair = {}
  state.physicalLineOfSightBlockedByCombatantPair = {}
  state.ordinaryDarknessByCombatantPair = {}
  state.magicalDarknessByCombatantPair = {}
  const snapshotRound = Math.max(1, Math.floor(input.round ?? 1))
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    const projectionId = area.utilityProjectionId ?? area.coreSpellId
    if (
      !projectionId ||
      !state.combatants[area.sourceTokenId] ||
      area.expiresAfterRound < snapshotRound
    ) continue
    for (const targetToken of combatantTokens) {
      const targetCells = tokenOccupiedCellsAt(targetToken, input.map, targetToken)
      let minimumCells = Number.POSITIVE_INFINITY
      for (const projectionCell of area.cells) {
        for (const targetCell of targetCells) {
          minimumCells = Math.min(
            minimumCells,
            cellDistance(projectionCell, targetCell),
          )
        }
      }
      if (!Number.isFinite(minimumCells)) continue
      const key = dnd5eUtilityProjectionDistanceKey(
        area.sourceTokenId,
        projectionId,
        targetToken.id,
      )
      state.utilityProjectionDistanceFeetByPair[key] = Math.min(
        state.utilityProjectionDistanceFeetByPair[key] ??
          Number.POSITIVE_INFINITY,
        minimumCells * feetPerCell,
      )
    }
  }
  for (let leftIndex = 0; leftIndex < combatantTokens.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < combatantTokens.length; rightIndex += 1) {
      const left = combatantTokens[leftIndex]
      const right = combatantTokens[rightIndex]
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(left.id, right.id)] =
        dnd5eMapTokenDistanceFeet({
          map: input.map,
          geometry,
          left,
          right,
          leftSizeRank: dnd5eEffectiveSizeRank(state.combatants[left.id]),
          rightSizeRank: dnd5eEffectiveSizeRank(state.combatants[right.id]),
        })
      for (const [attacker, target] of [[left, right], [right, left]] as const) {
        const attackerHeightFeet = dnd5eCreatureHeightFeetForSizeRank(
          dnd5eEffectiveSizeRank(state.combatants[attacker.id]),
        )
        const targetHeightFeet = dnd5eCreatureHeightFeetForSizeRank(
          dnd5eEffectiveSizeRank(state.combatants[target.id]),
        )
        const cover = mapGeometryCoverBetween(geometry, attacker, target, input.map, {
          attackerHeightFeet,
          targetHeightFeet,
        })
        const directedKey = dnd5eDirectedCombatantPairKey(attacker.id, target.id)
        if (cover.blocksLineOfEffect) state.lineOfEffectBlockedByCombatantPair[directedKey] = true
        else if (cover.armorClassBonus === 2 || cover.armorClassBonus === 5) {
          state.coverBonusByCombatantPair[directedKey] = cover.armorClassBonus
        }
        refreshDnd5eMapSightPair(state, input.map, geometry, attacker, target)
      }
    }
  }
  state.round = snapshotRound
  state.mapMagicDetection = { worldMinute: input.worldMinute, presencesByDetector: projectDnd5eMapMagicPresences({
    map: input.map, tokens: combatantTokens, geometry, round: snapshotRound, worldMinute: input.worldMinute,
    detectorHeightFeetById: Object.fromEntries(combatantTokens.map(token => [token.id,
      dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(state.combatants[token.id]))])) }) }
  state.turnSlotId = input.turnSlotId ??
    state.initiativeSlotIds?.[state.initiativeIndex] ??
    state.initiativeOrder[state.initiativeIndex]
  reconcileDnd5eSourceLinkedRelations(state)
  projectDnd5eGroundItemEffectOrigins(state, input.map, geometry)
  projectDnd5ePersistentAreaEffectSources(state, input.map, geometry)
  recordDnd5eCreatureSightings(state,dnd5eSightingWorldMinute(input.worldMinute,input.worldSecondRemainder),dnd5eCombatantCanSee)
  reconcileDnd5eSourceConditionAuras(state)
  return { state, characterIdByCombatantId }
}

export interface Dnd5eMapResultPlan {
  /** A damage reaction changed initiative before this map result was derived. */
  interruptedTurnState?: Dnd5eHeadlessCombatState
  spentReactions?: { round: number; tokenIds: readonly string[] }
  geometry?: import('../../lib/mapGeometry').MapGeometryState
  map: BattleMap
  characters: Character[]
  changedTokenIds: readonly string[]
  changedCharacterIds: readonly string[]
  tokenPatches?: Readonly<Record<string, Partial<Token>>>
  characterPatches?: Readonly<Record<string, Partial<Character>>>
}

/**
 * Rebuilds spatial facts after a Headless transaction has changed positions.
 * Snapshot geometry describes the pre-transaction map, so source-linked
 * relations must not reuse its old LoE/cover pairs when the result is mapped.
 */
function refreshDnd5eMapSightPair(state: Dnd5eHeadlessCombatState, map: BattleMap,
  geometry: import('../../lib/mapGeometry').MapGeometryState | undefined, attacker: Token, target: Token): void {
  const directedKey = dnd5eDirectedCombatantPairKey(attacker.id, target.id)
  const attackerHeightFeet = dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(state.combatants[attacker.id]))
  const targetHeightFeet = dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(state.combatants[target.id]))
  const effectiveViewer = {
    ...attacker,
    ...dnd5eCreatureFormVision(state.combatants[attacker.id].classState),
    dnd5eBaseDarkvisionRangeFeet: state.combatants[attacker.id].darkvisionRangeFeet ?? 0,
    classState: state.combatants[attacker.id].classState,
    darkvisionRangeFeet: Math.max(
      attacker.darkvisionRangeFeet ?? 0,
      dnd5eEffectiveDarkvisionRangeFeet(state.combatants[attacker.id]),
    ),
    darknessSightRangeFeet:
      state.combatants[attacker.id]?.darknessSightRangeFeet,
    magicalDarknessSightRangeFeet:
      state.combatants[attacker.id]?.magicalDarknessSightRangeFeet,
  }
  const physicalLineOfSightBlocked = mapGeometryLineOfSightBlocked({
    geometry,
    map: map,
    from: effectiveViewer,
    to: target,
    fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
    toElevationFeet: mapGeometryTokenElevation(geometry, target),
    fromEyeHeightFeet: attackerHeightFeet / 2,
    toEyeHeightFeet: targetHeightFeet / 2,
  })
  if (physicalLineOfSightBlocked) (state.physicalLineOfSightBlockedByCombatantPair ??= {})[directedKey] = true
  const targetIllumination = mapGeometryIlluminationAtPoint({
    geometry,
    map: map,
    tokens: map.tokens,
    point: target,
    elevationFeet: target.elevationFeet ?? 0,
  })
  if (targetIllumination === 'magical-darkness') {
    (state.magicalDarknessByCombatantPair ??= {})[directedKey] = true
  } else if (targetIllumination === 'darkness') {
    (state.ordinaryDarknessByCombatantPair ??= {})[directedKey] = true
  }
  const lineOfSightBlocked = physicalLineOfSightBlocked ||
    !mapGeometryCanSeeToken({
      geometry,
      map: map,
      viewer: effectiveViewer,
      target,
      viewerHeightFeet: attackerHeightFeet,
      targetHeightFeet,
    })
  if (lineOfSightBlocked) (state.lineOfSightBlockedByCombatantPair ??= {})[directedKey] = true
}

export function refreshDnd5eMapSpatialRelations(
  state: Dnd5eHeadlessCombatState,
  map: BattleMap,
  events: Dnd5eCombatEvent[] = [],
  options: { openedDoorIds?: readonly string[]; geometry?: import('../../lib/mapGeometry').MapGeometryState | null } = {},
): void {
  const runtimeGeometry = options.geometry === undefined ? mapGeometryRuntimeForMap(map.id) : options.geometry ?? undefined
  const openedDoorIds = new Set(options.openedDoorIds ?? [])
  const geometry = runtimeGeometry && openedDoorIds.size > 0
    ? {
        ...runtimeGeometry,
        doors: runtimeGeometry.doors.map((door) => openedDoorIds.has(door.id)
          ? { ...door, state: 'open' as const, openState: 'open' as const }
          : door),
      }
    : runtimeGeometry
  const positionedTokens = map.tokens.flatMap((token) => {
    const combatant = state.combatants[token.id]
    return combatant
      ? [{
          ...token,
          x: combatant.position.x,
          y: combatant.position.y,
          elevationFeet: combatant.elevationFeet,
        }]
      : []
  })
  const positionedById = new Map(positionedTokens.map((token) => [token.id, token]))
  const spatialMap: BattleMap = {
    ...map,
    tokens: map.tokens.map((token) => positionedById.get(token.id) ?? token),
  }
  for (const token of positionedTokens) {
    state.combatants[token.id].inSunlight=mapGeometrySunlightAtPoint({map:spatialMap,geometry,point:token,elevationFeet:mapGeometryTokenElevation(geometry,token)})
    const support = dnd5eEntitySupportElevation({ map: spatialMap, token, geometry,
      terrainElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, token),
      elevationFeet: mapGeometryTokenElevation(geometry, token) })
    state.combatants[token.id].groundElevationFeet = support
    state.combatants[token.id].airborne = mapGeometryTokenElevation(geometry, token) > support + 1e-4
    state.combatants[token.id].upwardClearanceFeet = dnd5eMappedUpwardClearance({ map: spatialMap, geometry, token,
      elevationFeet: mapGeometryTokenElevation(geometry, token) })
    state.combatants[token.id].protectedFromActorIds = dnd5ePersistentWardProtectedFrom(spatialMap, token)
  }
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  state.gridDistance = {
    cellUnits: Math.max(1, map.gridSize),
    feetPerCell,
    offsetX: map.gridOffsetX,
    offsetY: map.gridOffsetY,
    footprintCellsByCombatantId: Object.fromEntries(
      positionedTokens.map((token) => [token.id, tokenFootprintCells(token)]),
    ),
  }
  state.distanceFeetByCombatantPair = {}
  state.coverBonusByCombatantPair = {}
  state.lineOfEffectBlockedByCombatantPair = {}
  state.lineOfSightBlockedByCombatantPair = {}
  state.physicalLineOfSightBlockedByCombatantPair = {}
  state.ordinaryDarknessByCombatantPair = {}
  state.magicalDarknessByCombatantPair = {}
  for (let leftIndex = 0; leftIndex < positionedTokens.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positionedTokens.length; rightIndex += 1) {
      const left = positionedTokens[leftIndex]
      const right = positionedTokens[rightIndex]
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(left.id, right.id)] =
        dnd5eMapTokenDistanceFeet({
          map: spatialMap,
          geometry,
          left,
          right,
          leftSizeRank: dnd5eEffectiveSizeRank(state.combatants[left.id]),
          rightSizeRank: dnd5eEffectiveSizeRank(state.combatants[right.id]),
        })
      for (const [source, target] of [[left, right], [right, left]] as const) {
        refreshDnd5eMapSightPair(state, spatialMap, geometry, source, target)
        const cover = mapGeometryCoverBetween(geometry, source, target, spatialMap, {
          attackerHeightFeet: dnd5eCreatureHeightFeetForSizeRank(
            dnd5eEffectiveSizeRank(state.combatants[source.id]),
          ),
          targetHeightFeet: dnd5eCreatureHeightFeetForSizeRank(
            dnd5eEffectiveSizeRank(state.combatants[target.id]),
          ),
        })
        const directedKey = dnd5eDirectedCombatantPairKey(source.id, target.id)
        if (cover.blocksLineOfEffect) {
          state.lineOfEffectBlockedByCombatantPair[directedKey] = true
        } else if (cover.armorClassBonus === 2 || cover.armorClassBonus === 5) {
          state.coverBonusByCombatantPair[directedKey] = cover.armorClassBonus
        }
      }
    }
  }
  state.mapMagicDetection = { worldMinute: state.mapMagicDetection?.worldMinute, presencesByDetector: projectDnd5eMapMagicPresences({
    map: spatialMap, tokens: positionedTokens, geometry, round: state.round, worldMinute: state.mapMagicDetection?.worldMinute,
    detectorHeightFeetById: Object.fromEntries(positionedTokens.map(token => [token.id,
      dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(state.combatants[token.id]))])) }) }
  reconcileDnd5eSourceLinkedRelations(state, events)
  reconcileDnd5eWebRestraints(state, spatialMap, events)
  projectDnd5eGroundItemEffectOrigins(state, spatialMap, geometry)
  projectDnd5ePersistentAreaEffectSources(state, spatialMap, geometry)
  projectDnd5eTempleRollPenalties(geometry,Object.values(state.combatants),state.companionScene?.worldMinute)
  recordDnd5eCreatureSightings(state,dnd5eSightingWorldMinute(state.companionScene?.worldMinute,state.companionScene?.worldSecondRemainder),dnd5eCombatantCanSee)
}

export function planDnd5eMapResultApplication(input: {
  geometry?: import('../../lib/mapGeometry').MapGeometryState | null
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  /**
   * Optional pre-transaction character snapshots. Some authoritative costs
   * (consumed spell materials and item charges) settle outside the combatant
   * state; comparing only against `characters` would make a cost-only ritual
   * look unchanged and omit its inventory patch from the live commit.
   */
  baselineCharacters?: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  openedDoorIds?: readonly string[]
  events?: Dnd5eCombatEvent[]
}): Dnd5eMapResultPlan {
  recordDnd5eWithinReachMapMovement({...input,events:input.events??[]})
  captureDnd5eLinkedTargetPresentations(input.state, input.map, input.characters)
  // Token IDs identify a scene instance. Persist the character identity too so
  // linked effects can find their controller after the source changes scenes.
  for (const combatant of Object.values(input.state.combatants)) {
    for (const effect of combatant.classState.activeEffects ?? []) {
      const characterId = effect.source.actorId && input.characterIdByCombatantId[effect.source.actorId]
      if (!effect.source.characterId && characterId) {
        effect.source = { ...effect.source, characterId }
      }
    }
  }
  refreshDnd5eMapSpatialRelations(input.state, input.map, input.events, {
    geometry: input.geometry,
    openedDoorIds: input.openedDoorIds,
  })
  const changedTokenIds: string[] = []
  const changedCharacterIds: string[] = []
  const tokenPatches: Record<string, Partial<Token>> = {}
  const characterPatches: Record<string, Partial<Character>> = {}
  const tokenById = new Map(input.map.tokens.map((token) => [token.id, token]))
  let map: BattleMap = {
    ...input.map,
    tokens: input.map.tokens.map((token) => {
      const combatant = input.state.combatants[token.id]
      if (!combatant) return token
      if (combatant.objectInteractionOnly) return token
      if (token.type === 'obstacle' && combatant.objectDamageThreshold != null) {
        const instance = token.dnd5eObjectState?.inventoryItem?.instance
        const destroyed = instance && !instance.condition?.destroyed &&
          dnd5eDestroyedMapObject({ ...token, hp: combatant.currentHp })
        if (token.hp === combatant.currentHp && !destroyed) return token
        const patch: Partial<Token> = { hp: combatant.currentHp,
          ...(destroyed ? { dnd5eObjectState: { ...token.dnd5eObjectState!,
            inventoryItem: { ...token.dnd5eObjectState!.inventoryItem!,
              instance: { ...instance, condition: { ...instance.condition, destroyed: true } } } } } : {}),
        }
        changedTokenIds.push(token.id)
        tokenPatches[token.id] = patch
        return { ...token, ...patch }
      }

      const independentlyPersistedToken = !token.characterId || token.dnd5eSimulacrum != null
      // Character-bound tokens may still carry a mirrored combat-state copy
      // written by the DM status editor. The authoritative Headless result is
      // persisted on the character below; retaining the old token copy makes
      // the map details panel resurrect effects that the transaction removed.
      const clearsMirroredCharacterTokenClassState =
        !independentlyPersistedToken && token.dnd5eCombatState != null
      const nextTokenClassState = independentlyPersistedToken
          ? compactOptionalRecord({
            schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
            stableAtZero: combatant.currentHp === 0 &&
              combatant.deathSaves.stable &&
              !combatant.deathSaves.dead
                ? true as const
                : undefined,
            temporaryHp: combatant.temporaryHp > 0 ? combatant.temporaryHp : undefined,
            sourcedExhaustion: normalizeDnd5eSourcedExhaustion(combatant.classState.sourcedExhaustion),
            submergedBreathing: normalizeDnd5eSubmergedBreathing(combatant.classState.submergedBreathing),
      submergedBreathingEffectDeadlines: normalizeSubmergedBreathingEffectDeadlines(combatant.classState.submergedBreathingEffectDeadlines),
            exhaustionBaseMaxHp: combatant.classState.exhaustionBaseMaxHp,
            hitPointMaximumReductionLedger:
              combatant.classState.hitPointMaximumReductionLedger
                ? {
                    ...combatant.classState.hitPointMaximumReductionLedger,
                    entries:
                      combatant.classState.hitPointMaximumReductionLedger.entries
                        .map((entry) => ({ ...entry })),
                  }
                : undefined,
            undeadFortitudePending: combatant.classState.undeadFortitudePending
              ? { ...combatant.classState.undeadFortitudePending }
              : undefined,
            monsterOnHitSavePending: combatant.classState.monsterOnHitSavePending
              ? {
                  ...combatant.classState.monsterOnHitSavePending,
                  chargeFollowUp: combatant.classState.monsterOnHitSavePending.chargeFollowUp
                    ? { ...combatant.classState.monsterOnHitSavePending.chargeFollowUp }
                    : undefined,
                }
              : undefined,
            monsterTriggeredBonusAction: combatant.classState.monsterTriggeredBonusAction
              ? { ...combatant.classState.monsterTriggeredBonusAction }
              : undefined,
            activeEffectDamageSavePendingIds: combatant.classState.activeEffectDamageSavePendingIds
              ? [...combatant.classState.activeEffectDamageSavePendingIds]
              : undefined,
            activeEffectDamageSavePendingQueue: combatant.classState.activeEffectDamageSavePendingQueue
              ? combatant.classState.activeEffectDamageSavePendingQueue.map(entry => ({ ...entry }))
              : undefined,
            activeEffectDamageSavePendingModes: combatant.classState.activeEffectDamageSavePendingModes
              ? { ...combatant.classState.activeEffectDamageSavePendingModes }
              : undefined,
            deathRound: combatant.classState.deathRound,
            deathInitiativeIndex: combatant.classState.deathInitiativeIndex,
            deathCause: combatant.classState.deathCause,
            soulReturnStatus: combatant.classState.soulReturnStatus,
            bodyPresent: combatant.classState.bodyPresent,
            bodyPartPresence: combatant.classState.bodyPartPresence ? { ...combatant.classState.bodyPartPresence } : undefined,
            missingBodyParts: combatant.classState.missingBodyParts
              ? [...combatant.classState.missingBodyParts]
              : undefined,
            vitalBodyPartsMissing: combatant.classState.vitalBodyPartsMissing,
            activeEffects: persistentActiveEffectsWithoutTransientAreaSuspension(
              combatant.classState.activeEffects,
            ),
            companionCommand:combatant.classState.companionCommand,
            summonAttackerIds:combatant.classState.summonAttackerIds,
            summonAutonomousTurnKey:combatant.classState.summonAutonomousTurnKey,
            summonSelfDefenseTurnKey:combatant.classState.summonSelfDefenseTurnKey,
            disengagedTurnKey: combatant.classState.disengagedTurnKey,
            dodgingTurnKey: combatant.classState.dodgingTurnKey,
            hiddenCheckTotal: combatant.classState.hiddenCheckTotal,
            readiedAction: combatant.classState.readiedAction ? { ...combatant.classState.readiedAction } : undefined,
            spellAuthorityRecords: combatant.classState.spellAuthorityRecords,
            spellControlledByActorId: combatant.classState.spellControlledByActorId,
            spellControlMentalAbilities: combatant.classState.spellControlMentalAbilities,
            spellControlledBodyMentalAbilities: combatant.classState.spellControlledBodyMentalAbilities,
            caltropsSpeedPenaltyFeet: combatant.classState.caltropsSpeedPenaltyFeet,
            attacksMadeTurnKey: combatant.classState.attacksMadeTurnKey,
            attacksMadeThisTurn: combatant.classState.attacksMadeThisTurn,
            straightMovementStreak: combatant.classState.straightMovementStreak
              ? structuredClone(combatant.classState.straightMovementStreak) : undefined,
            withinReachMovementByAttacker: combatant.classState.withinReachMovementByAttacker
              ? structuredClone(combatant.classState.withinReachMovementByAttacker) : undefined,
            firstOwnCombatTurn: combatant.classState.firstOwnCombatTurn ? { ...combatant.classState.firstOwnCombatTurn } : undefined,
            firstOwnTurnWeaponAttack: combatant.classState.firstOwnTurnWeaponAttack ? { ...combatant.classState.firstOwnTurnWeaponAttack } : undefined,
            attackActionHistory: combatant.classState.attackActionHistory
              ? structuredClone(combatant.classState.attackActionHistory) : undefined,
            turnStartResolvedTurnKey: combatant.classState.turnStartResolvedTurnKey,
            deathSaveTurn: combatant.classState.deathSaveTurn ? {...combatant.classState.deathSaveTurn} : undefined,
            activityExtraTurnGroup: combatant.classState.activityExtraTurnGroup,
            activityExtraTurnSuspension: combatant.classState.activityExtraTurnSuspension,
            slowSpellGate: combatant.classState.slowSpellGate,
            slowDelayedMonsterSpell: combatant.classState.slowDelayedMonsterSpell,
            slowDelayedSpell: combatant.classState.slowDelayedSpell
              ? structuredClone(combatant.classState.slowDelayedSpell)
              : undefined,
            recklessAttackTurnKey: combatant.classState.recklessAttackTurnKey,
            monsterReactiveAvailableTurnKey: combatant.classState.monsterReactiveAvailableTurnKey,
            monsterReactiveUsedTurnKey: combatant.classState.monsterReactiveUsedTurnKey,
            interruptedTurnResume: combatant.classState.interruptedTurnResume ? structuredClone(combatant.classState.interruptedTurnResume) : undefined,
            zeroHitPointExtraTurn: combatant.classState.zeroHitPointExtraTurn
              ? {...combatant.classState.zeroHitPointExtraTurn} : undefined,
            movementStoppedTurnKey: combatant.classState.movementStoppedTurnKey,
            jumpMovementProgress: combatant.classState.jumpMovementProgress,
            runningJumpApproachFeet: combatant.classState.runningJumpApproachFeet,
            normalReactionSpentThisTurn: combatant.classState.normalReactionSpentThisTurn,
            specialOpportunityReactionUsed: combatant.classState.specialOpportunityReactionUsed,
            reactionAvailableBeforeSpecial: combatant.classState.reactionAvailableBeforeSpecial,
            bardicInspirationDie: combatant.classState.bardicInspirationDie,
            bardicInspirationSourceId: combatant.classState.bardicInspirationSourceId,
            bardicInspirationRoundsRemaining: combatant.classState.bardicInspirationRoundsRemaining,
            surprisedCombatId: combatant.classState.surprisedCombatId,
            surpriseResolvedCombatId: combatant.classState.surpriseResolvedCombatId,
            countercharmRoundsRemaining: combatant.classState.countercharmRoundsRemaining,
            intimidatingPresenceSourceId: combatant.classState.intimidatingPresenceSourceId,
            intimidatingPresenceRoundsRemaining: combatant.classState.intimidatingPresenceRoundsRemaining,
            intimidatingPresenceImmunityRoundsBySource: combatant.classState.intimidatingPresenceImmunityRoundsBySource,
            natureSanctuaryImmunityRoundsByTarget: combatant.classState.natureSanctuaryImmunityRoundsByTarget,
            draconicPresenceImmunityRoundsBySource: combatant.classState.draconicPresenceImmunityRoundsBySource,
            monsterFrightfulPresenceImmunityRoundsBySource: combatant.classState.monsterFrightfulPresenceImmunityRoundsBySource,
            monsterActionImmunityRoundsByKey: combatant.classState.monsterActionImmunityRoundsByKey,
            turnedByClericId: combatant.classState.turnedByClericId ??
              dnd5eActiveForcedFleeSourceId(combatant.classState.activeEffects),
            turnedRoundsRemaining: combatant.classState.turnedRoundsRemaining,
            holyNimbusRoundsRemaining: combatant.classState.holyNimbusRoundsRemaining,
            conditions: persistentConditionsWithoutTransientAreas(combatant).length > 0 ? persistentConditionsWithoutTransientAreas(combatant) : undefined,
            stunnedByActorId: combatant.classState.stunnedByActorId,
            stunnedAppliedTurnKey: combatant.classState.stunnedAppliedTurnKey,
            openHandNoReactionsAppliedTurnKeysBySource: combatant.classState.openHandNoReactionsAppliedTurnKeysBySource,
            declarativeUsedTurnKeys: combatant.classState.declarativeUsedTurnKeys,
            declarativeTransactionIds: combatant.classState.declarativeTransactionIds,
            activityTriggerReceipts: combatant.classState.activityTriggerReceipts,
            declarativeAttackRetargetImmunityFeatureIds:
              combatant.classState.declarativeAttackRetargetImmunityFeatureIds,
            declarativeWardPools: combatant.classState.declarativeWardPools
              ? Object.fromEntries(Object.entries(combatant.classState.declarativeWardPools)
                  .map(([featureId, pool]) => [featureId, { ...pool }]))
              : undefined,
            declarativeMarkedTargets: combatant.classState.declarativeMarkedTargets
              ? Object.fromEntries(Object.entries(combatant.classState.declarativeMarkedTargets)
                  .map(([featureId, mark]) => [featureId, { ...mark }]))
              : undefined,
            declarativeReactionWeaponAttackOpportunities:
              combatant.classState.declarativeReactionWeaponAttackOpportunities
                ? Object.fromEntries(Object.entries(
                    combatant.classState.declarativeReactionWeaponAttackOpportunities,
                  ).map(([featureId, opportunity]) => [featureId, { ...opportunity }]))
                : undefined,
            abilityScoreReductionLedger: combatant.classState.abilityScoreReductionLedger
              ?.map((entry) => ({ ...entry })),
            droppedEquipmentIds: combatant.classState.droppedEquipmentIds,
            spellSavePressureBySource: combatant.classState.spellSavePressureBySource,
            bonusProneEligibleTargetIds:
              combatant.classState.bonusProneEligibleTargetIds,
            bonusProneEligibleTurnKey:
              combatant.classState.bonusProneEligibleTurnKey,
            monsterMechanicRollModifiers: combatant.classState.monsterMechanicRollModifiers,
            pendingMonsterMechanicTriggers: combatant.classState.pendingMonsterMechanicTriggers,
            monsterMechanicTriggerSequence: combatant.classState.monsterMechanicTriggerSequence,
            monsterMechanicMovementTurnKey: combatant.classState.monsterMechanicMovementTurnKey,
            monsterDiveMovement: combatant.classState.monsterDiveMovement,
            monsterMechanicMovementFeet: combatant.classState.monsterMechanicMovementFeet,
            monsterMechanicMovementOrigin: combatant.classState.monsterMechanicMovementOrigin,
            monsterMechanicMovementLast: combatant.classState.monsterMechanicMovementLast,
            monsterMechanicMovementStraight: combatant.classState.monsterMechanicMovementStraight,
            concentrationSpellId: combatant.classState.concentrationSpellId,
            concentrationSpellLevel: combatant.classState.concentrationSpellLevel,
            concentrationTargetIds: combatant.classState.concentrationTargetIds,
            concentrationRoundsRemaining: combatant.classState.concentrationRoundsRemaining,
            concentrationStartedTurnKey: combatant.classState.concentrationStartedTurnKey,
            concentrationTickOn: combatant.classState.concentrationTickOn,
            concentrationLastTickTurnKey: combatant.classState.concentrationLastTickTurnKey,
            lastGrantedShortRest: combatant.classState.lastGrantedShortRest ? { ...combatant.classState.lastGrantedShortRest } : undefined,
            lastCompletedConcentration: combatant.classState.lastCompletedConcentration
              ? { ...combatant.classState.lastCompletedConcentration }
              : undefined,
            concentrationEffectsBySource: combatant.classState.concentrationEffectsBySource,
            wildShapeFormId: combatant.classState.wildShapeFormId,
            wildShapeMode: combatant.classState.wildShapeMode,
            wildShapeSourceActorId: combatant.classState.wildShapeSourceActorId,
            wildShapeSourceActivityId: combatant.classState.wildShapeSourceActivityId,
            wildShapeConcentrationSpellId: combatant.classState.wildShapeConcentrationSpellId,
            recentCreatureSightings: combatant.classState.recentCreatureSightings,
            knownCreatureLocations: combatant.classState.knownCreatureLocations,
            damageTraitReports: combatant.classState.damageTraitReports,
            planarPortalReports: combatant.classState.planarPortalReports,
            activityContinuations: combatant.classState.activityContinuations,
            wildShapeRequiresConcentration: combatant.classState.wildShapeRequiresConcentration,
            wildShapeRetainsHitPoints: combatant.classState.wildShapeRetainsHitPoints,
            wildShapeMaximumChallengeRating: combatant.classState.wildShapeMaximumChallengeRating,
            wildShapeMaximumSizeRank: combatant.classState.wildShapeMaximumSizeRank,
            wildShapeCurrentHp: combatant.classState.wildShapeCurrentHp,
            wildShapeRoundsRemaining: combatant.classState.wildShapeRoundsRemaining,
            wildShapePermanent: combatant.classState.wildShapePermanent,
            wildShapePermanentAfterConcentrationCompletes:
              combatant.classState.wildShapePermanentAfterConcentrationCompletes,
            shapechangeEquipmentDisposition: combatant.classState.shapechangeEquipmentDisposition,
            wildShapeOriginalCurrentHp: combatant.classState.wildShapeOriginalCurrentHp,
            wildShapeOriginalMaxHp: combatant.classState.wildShapeOriginalMaxHp,
            wildShapeOriginalArmorClass: combatant.classState.wildShapeOriginalArmorClass,
            wildShapeOriginalSpeed: combatant.classState.wildShapeOriginalSpeed,
            wildShapeOriginalMovementSpeeds: combatant.classState.wildShapeOriginalMovementSpeeds,
            wildShapeOriginalSizeRank: combatant.classState.wildShapeOriginalSizeRank,
            wildShapeOriginalAbilities: combatant.classState.wildShapeOriginalAbilities,
            wildShapeOriginalSavingThrowBonuses: combatant.classState.wildShapeOriginalSavingThrowBonuses,
            wildShapeOriginalSavingThrowProficiencies: combatant.classState.wildShapeOriginalSavingThrowProficiencies,
            wildShapeOriginalSkillProficiencies: combatant.classState.wildShapeOriginalSkillProficiencies,
            wildShapeOriginalPassivePerception: combatant.classState.wildShapeOriginalPassivePerception,
            wildShapeOriginalStatBlockId: combatant.classState.wildShapeOriginalStatBlockId,
            wildShapeOriginalCreatureType: combatant.classState.wildShapeOriginalCreatureType,
            wildShapeOriginalDamageVulnerabilities: combatant.classState.wildShapeOriginalDamageVulnerabilities,
            wildShapeOriginalDamageResistances: combatant.classState.wildShapeOriginalDamageResistances,
            wildShapeOriginalDamageImmunities: combatant.classState.wildShapeOriginalDamageImmunities,
            wildShapeOriginalDamageDefenseRules: combatant.classState.wildShapeOriginalDamageDefenseRules,
            wildShapeOriginalMagicResistance: combatant.classState.wildShapeOriginalMagicResistance,
            wildShapeOriginalLimitedMagicImmunity: combatant.classState.wildShapeOriginalLimitedMagicImmunity,
            wildShapeOriginalWeaponAttacksMagical: combatant.classState.wildShapeOriginalWeaponAttacksMagical,
            wildShapeOriginalConditionImmunities: combatant.classState.wildShapeOriginalConditionImmunities,
            viciousMockeryAttackDisadvantage: combatant.classState.viciousMockeryAttackDisadvantage,
            helpedAttackSourceId: combatant.classState.helpedAttackSourceId,
            helpedAbilityCheckSourceId: combatant.classState.helpedAbilityCheckSourceId,
            helpedAbilityCheckSourceTurnKey: combatant.classState.helpedAbilityCheckSourceTurnKey,
            helpedAttackSourceTurnKey: combatant.classState.helpedAttackSourceTurnKey,
            shieldSpellActive: combatant.classState.shieldSpellActive,
            legendaryResistanceUses: combatant.classState.legendaryResistanceUses,
            monsterLegendaryActionPoints: combatant.classState.monsterLegendaryActionPoints,
            monsterLegendaryMovement: combatant.classState.monsterLegendaryMovement,
            monsterLairActionRoundUsed: combatant.classState.monsterLairActionRoundUsed,
            monsterLairActionLastId: combatant.classState.monsterLairActionLastId,
            monsterRechargeReadyByActionId: combatant.classState.monsterRechargeReadyByActionId,
            monsterActionUsesByActionId: combatant.classState.monsterActionUsesByActionId,
            monsterSpellSlots: combatant.classState.monsterSpellSlots,
            monsterSpellUsesBySpellId: combatant.classState.monsterSpellUsesBySpellId,
            monsterMultiattackContinuation: combatant.classState.monsterMultiattackContinuation,
            monsterShapechangeOriginalStatBlockId: combatant.classState.monsterShapechangeOriginalStatBlockId,
            monsterShapechangeFormId: combatant.classState.monsterShapechangeFormId,
            shapechangerReversionAreaIds: combatant.classState.shapechangerReversionAreaIds,
            monsterRegenerationSuppressedDamageTypes: combatant.classState.monsterRegenerationSuppressedDamageTypes,
            monsterRegenerationPendingAtZero: combatant.classState.monsterRegenerationPendingAtZero,
            monsterBerserk: combatant.classState.monsterBerserk,
            monsterDamageAversionActive: combatant.classState.monsterDamageAversionActive,
            monsterDamageAversionSourceActorId: combatant.classState.monsterDamageAversionSourceActorId,
            monsterHydraHeadCount: combatant.classState.monsterHydraHeadCount,
            monsterHydraHeadsLostSinceLastTurn: combatant.classState.monsterHydraHeadsLostSinceLastTurn,
            monsterHydraDamageTurnKey: combatant.classState.monsterHydraDamageTurnKey,
            monsterHydraDamageTakenThisTurn: combatant.classState.monsterHydraDamageTakenThisTurn,
            monsterHydraHeadSeveredTurnKey: combatant.classState.monsterHydraHeadSeveredTurnKey,
            monsterHydraFireDamageSinceLastTurn: combatant.classState.monsterHydraFireDamageSinceLastTurn,
            monsterSwallowedInternalDamageTurnKey:
              combatant.classState.monsterSwallowedInternalDamageTurnKey,
            monsterSwallowedInternalDamageBySourceId:
              combatant.classState.monsterSwallowedInternalDamageBySourceId,
            monsterThreatByTargetId: combatant.classState.monsterThreatByTargetId,
            hurlThroughHellSourceId: combatant.classState.hurlThroughHellSourceId,
            hurlThroughHellDamage: combatant.classState.hurlThroughHellDamage,
            hurlThroughHellPendingRolls: combatant.classState.hurlThroughHellPendingRolls
              ? [...combatant.classState.hurlThroughHellPendingRolls] : undefined,
            hurlThroughHellAppliedTurnKey: combatant.classState.hurlThroughHellAppliedTurnKey,
          })
        : undefined
      const changedMonsterStatBlock = !token.characterId && combatant.statBlockId &&
        combatant.statBlockId !== token.poolId
      const previousMonster = changedMonsterStatBlock && token.poolId
        ? getDnd5eSrdMonster(token.poolId)
        : undefined
      const nextMonster = changedMonsterStatBlock
        ? getDnd5eSrdMonster(combatant.statBlockId!)
        : undefined
      const patch: Partial<Token> = {
        x: combatant.position.x,
        y: combatant.position.y,
        size: [1, 1, 1, 2, 3, 4][dnd5eEffectiveSizeRank(combatant)] ?? 1,
        elevationFeet: combatant.elevationFeet === 0 && token.elevationFeet == null
          ? undefined
          : combatant.elevationFeet,
        dnd5eTraversalMode: normalizeDnd5eTraversalMode(combatant.traversalMode),
        hp: combatant.currentHp,
        maxHp: combatant.classState.exhaustionBaseMaxHp ?? combatant.maxHp,
        ...(independentlyPersistedToken && combatant.alignment != null ? { dnd5eAlignment: combatant.alignment } : {}),
        ...(changedMonsterStatBlock
          ? {
              poolId: combatant.statBlockId,
              ...(previousMonster && nextMonster && token.label === previousMonster.name
                ? { label: nextMonster.name }
                : {}),
            }
          : {}),
        ...(independentlyPersistedToken ? {
          dnd5eCombatState: nextTokenClassState,
          ...(token.dnd5eSimulacrum ? {
            dnd5eSimulacrum: {
              ...token.dnd5eSimulacrum,
              classResources: Object.fromEntries(Object.entries(combatant.classResources).map(([id, resource]) => [id, {
                current: resource.current, maximum: resource.max,
              }])),
            },
          } : {}),
        } : clearsMirroredCharacterTokenClassState
          ? { dnd5eCombatState: undefined }
          : {}),
      }
      const tokenClassStateUnchanged = independentlyPersistedToken
        ? JSON.stringify(token.dnd5eCombatState ?? {}) === JSON.stringify(nextTokenClassState ?? {})
        : !clearsMirroredCharacterTokenClassState
      const simulacrumStateUnchanged = !token.dnd5eSimulacrum ||
        JSON.stringify(token.dnd5eSimulacrum) === JSON.stringify(patch.dnd5eSimulacrum)
      if (
        token.x === patch.x && token.y === patch.y && token.size === patch.size &&
        token.elevationFeet === patch.elevationFeet && token.hp === patch.hp && token.maxHp === patch.maxHp &&
        token.dnd5eTraversalMode === patch.dnd5eTraversalMode &&
        token.label === (patch.label ?? token.label) &&
        token.poolId === (patch.poolId ?? token.poolId) &&
        token.dnd5eAlignment === (patch.dnd5eAlignment ?? token.dnd5eAlignment) &&
        tokenClassStateUnchanged && simulacrumStateUnchanged
      ) return token
      changedTokenIds.push(token.id)
      tokenPatches[token.id] = patch
      return { ...token, ...patch }
    }),
  }
  for(const event of input.events??[])if(event.type==='companion-item-picked-up' && input.state.companionScene?.map.id===map.id){
    const scene=input.state.companionScene.map
    map={...map,tokens:map.tokens.flatMap(token=>{
      if(token.id!==event.actorId && token.id!==event.objectTokenId)return [token]
      const settled=scene.tokens.find(candidate=>candidate.id===token.id)
      if(!changedTokenIds.includes(token.id))changedTokenIds.push(token.id)
      if(!settled){delete tokenPatches[token.id];return []}
      const patch=token.id===event.actorId?{dnd5eCarriedObjects:settled.dnd5eCarriedObjects}:{dnd5eObjectState:settled.dnd5eObjectState}
      tokenPatches[token.id]={...tokenPatches[token.id],...patch}
      return [{...token,...patch}]
    })}
  }
  for (const event of input.events ?? []) if (event.type === 'companion-ammunition-consumed' && input.state.companionScene?.map.id === map.id) {
    const settled = input.state.companionScene.map.tokens.find(token => token.id === event.actorId)
    if (!settled) continue
    const patch = { dnd5eCarriedObjects: settled.dnd5eCarriedObjects }
    if (!changedTokenIds.includes(event.actorId)) changedTokenIds.push(event.actorId)
    tokenPatches[event.actorId] = { ...tokenPatches[event.actorId], ...patch }
    map = { ...map, tokens: map.tokens.map(token => token.id === event.actorId ? { ...token, ...patch } : token) }
  }
  // Object animation ends for an individual target as soon as that creature
  // reaches 0 HP. Resolve that replacement in the same Headless transaction
  // so the damage event still carries the exact overkill amount; a later map
  // reconciliation only sees a clamped 0 HP token and cannot reconstruct it.
  map = {
    ...map,
    tokens: map.tokens.flatMap((token) => {
      if (
        !token.dnd5eSummon?.truePolymorphOriginalObject ||
        (token.hp ?? token.maxHp ?? 1) > 0
      ) return [token]
      const defeatEvent = input.events?.find((event) =>
        event.type === 'damage-applied' &&
        event.targetId === token.id &&
        event.hpBefore > 0 &&
        event.hpAfter === 0)
      const temporaryHitPointsAbsorbed = defeatEvent?.type === 'damage-applied'
        ? Math.max(0, defeatEvent.temporaryHpBefore - defeatEvent.temporaryHpAfter)
        : 0
      const overflowDamage = defeatEvent?.type === 'damage-applied'
        ? Math.max(0, defeatEvent.amount - temporaryHitPointsAbsorbed - defeatEvent.hpBefore)
        : 0
      const restored = dnd5eRestoredSummonedOriginalObject(token, overflowDamage)
      if (!restored) return [token]
      if (!changedTokenIds.includes(token.id)) changedTokenIds.push(token.id)
      if (!changedTokenIds.includes(restored.id)) changedTokenIds.push(restored.id)
      delete tokenPatches[token.id]
      return [restored]
    }),
  }
  const meltedSimulacrumIds = map.tokens
    .filter((token) => token.dnd5eSimulacrum && (token.hp ?? token.maxHp ?? 0) <= 0)
    .map((token) => token.id)
  if (meltedSimulacrumIds.length > 0) {
    const melted = new Set(meltedSimulacrumIds)
    map = { ...map, tokens: map.tokens.filter((token) => !melted.has(token.id)) }
    for (const tokenId of meltedSimulacrumIds) {
      if (!changedTokenIds.includes(tokenId)) changedTokenIds.push(tokenId)
      delete tokenPatches[tokenId]
    }
  }

  let characters = input.characters.map((character) => {
    const baselineCharacter = input.baselineCharacters?.find((candidate) => candidate.id === character.id) ?? character
    const combatantId = Object.keys(input.characterIdByCombatantId).find((id) => input.characterIdByCombatantId[id] === character.id)
    const combatant = combatantId ? input.state.combatants[combatantId] : undefined
    if (!combatant) return character
    const nextClassResources = Object.keys(combatant.classResources).length > 0
      ? Object.fromEntries(Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }]))
      : undefined
    const nextClassState = compactOptionalRecord({
      ...combatant.classState,
      interruptedTurnResume: combatant.classState.interruptedTurnResume ? structuredClone(combatant.classState.interruptedTurnResume) : undefined,
      zeroHitPointExtraTurn: combatant.classState.zeroHitPointExtraTurn
        ? {...combatant.classState.zeroHitPointExtraTurn} : undefined,
      activeEffects: persistentActiveEffectsWithoutTransientAreaSuspension(
        combatant.classState.activeEffects,
      ),
      sourcedExhaustion: normalizeDnd5eSourcedExhaustion(combatant.classState.sourcedExhaustion),
      submergedBreathing: normalizeDnd5eSubmergedBreathing(combatant.classState.submergedBreathing),
      submergedBreathingEffectDeadlines: normalizeSubmergedBreathingEffectDeadlines(combatant.classState.submergedBreathingEffectDeadlines),
      exhaustionBaseMaxHp: combatant.classState.exhaustionBaseMaxHp,
      hitPointMaximumReductionLedger:
        combatant.classState.hitPointMaximumReductionLedger
          ? {
              ...combatant.classState.hitPointMaximumReductionLedger,
              entries:
                combatant.classState.hitPointMaximumReductionLedger.entries
                  .map((entry) => ({ ...entry })),
            }
          : undefined,
      abilityScoreReductionLedger: combatant.classState.abilityScoreReductionLedger
        ?.map((entry) => ({ ...entry })),
    })
    const nextCharacterCurrentHp = combatant.classState.wildShapeFormId
      ? combatant.classState.wildShapeOriginalCurrentHp ?? character.currentHp
      : combatant.currentHp
    const nextCharacterMaxHp = combatant.classState.wildShapeFormId
      ? combatant.classState.wildShapeOriginalMaxHp ?? character.maxHp
      : combatant.classState.exhaustionBaseMaxHp ?? combatant.maxHp
    let inventoryCharacter = applyDnd5eInventoryResourceSnapshotsToCharacter({
      character,
      snapshots: [...combatant.inventoryResourceSnapshots ?? [], ...combatant.inventoryHeadlessEffects ?? []],
      revision: combatant.inventoryRevision,
    })
    inventoryCharacter = applyDnd5eInventoryReactionSpellSnapshotsToCharacter({
      character: inventoryCharacter,
      snapshots: combatant.inventoryReactionSpells,
      revision: combatant.inventoryRevision,
    })
    inventoryCharacter = applyDnd5eCounterattackInventoryCosts(
      inventoryCharacter, input.events ?? [], input.characterIdByCombatantId,
    )
    const armorState = combatant.equippedArmor
    const persistedArmorEntry = armorState
      ? inventoryCharacter.dnd5eInventory?.entries.find((entry) =>
          entry.instanceId === armorState.instanceId)
      : undefined
    const armorStateChanged = !!armorState && !!persistedArmorEntry && (
      Math.max(0, Math.floor(persistedArmorEntry.condition?.armorClassPenalty ?? 0)) !==
        armorState.armorClassPenalty ||
      (persistedArmorEntry.condition?.destroyed === true) !== armorState.destroyed ||
      (persistedArmorEntry.equippedSlot === 'armor') === armorState.destroyed
    )
    if (armorStateChanged && armorState && inventoryCharacter.dnd5eInventory) {
      inventoryCharacter = {
        ...inventoryCharacter,
        dnd5eInventory: {
          ...inventoryCharacter.dnd5eInventory,
          revision: (inventoryCharacter.dnd5eInventory.revision ?? 0) + 1,
          entries: inventoryCharacter.dnd5eInventory.entries.map((entry) =>
            entry.instanceId === armorState.instanceId
              ? {
                  ...entry,
                  equippedSlot: armorState.destroyed ? undefined : entry.equippedSlot,
                  condition: {
                    ...entry.condition,
                    armorClassPenalty: armorState.armorClassPenalty || undefined,
                    destroyed: armorState.destroyed || undefined,
                  },
                }
              : entry),
        },
        equipment: armorState.destroyed
          ? { ...inventoryCharacter.equipment, armor: undefined }
          : inventoryCharacter.equipment,
      }
    }
    const hitDiceUnchanged = combatant.hitPointDice == null ||
      JSON.stringify(baselineCharacter.hitPointDice ?? []) === JSON.stringify(combatant.hitPointDice)
    const resourcesUnchanged = JSON.stringify(baselineCharacter.classResources ?? {}) === JSON.stringify(nextClassResources ?? {})
    const inventoryUnchanged = JSON.stringify(baselineCharacter.dnd5eInventory ?? {}) === JSON.stringify(inventoryCharacter.dnd5eInventory ?? {})
    const equipmentUnchanged = JSON.stringify(baselineCharacter.equipment ?? {}) === JSON.stringify(inventoryCharacter.equipment ?? {})
    const classStateUnchanged = JSON.stringify(baselineCharacter.dnd5eCombatState ?? {}) === JSON.stringify(nextClassState ?? {})
    const conditionsUnchanged = JSON.stringify(baselineCharacter.conditions) === JSON.stringify(persistentConditionsWithoutTransientAreas(combatant))
    const alignmentUnchanged = combatant.alignment == null || combatant.alignment === baselineCharacter.alignment
    if (
      baselineCharacter.currentHp === nextCharacterCurrentHp &&
      baselineCharacter.maxHp === combatant.maxHp &&
      baselineCharacter.tempHp === combatant.temporaryHp &&
      (baselineCharacter.exhaustionLevel ?? 0) === combatant.exhaustionLevel &&
      (baselineCharacter.deathSaveSuccesses ?? 0) === combatant.deathSaves.successes &&
      (baselineCharacter.deathSaveFailures ?? 0) === combatant.deathSaves.failures &&
      (baselineCharacter.deathSaveStable ?? false) === combatant.deathSaves.stable &&
      (baselineCharacter.concentrating ?? false) === combatant.concentrating &&
      resourcesUnchanged &&
      hitDiceUnchanged &&
      inventoryUnchanged &&
      equipmentUnchanged &&
      classStateUnchanged &&
      alignmentUnchanged &&
      conditionsUnchanged
    ) return character
    const patch: Partial<Character> = {
      ...(!alignmentUnchanged ? { alignment: combatant.alignment } : {}),
      currentHp: nextCharacterCurrentHp,
      maxHp: nextCharacterMaxHp,
      tempHp: combatant.temporaryHp,
      exhaustionLevel: combatant.exhaustionLevel,
      deathSaveSuccesses: combatant.deathSaves.successes,
      deathSaveFailures: combatant.deathSaves.failures,
      deathSaveStable: combatant.deathSaves.stable,
      concentrating: combatant.concentrating,
      conditions: persistentConditionsWithoutTransientAreas(combatant),
      classResources: nextClassResources,
      ...(!hitDiceUnchanged ? { hitPointDice: combatant.hitPointDice?.map(pool => ({ ...pool })) } : {}),
      dnd5eInventory: inventoryCharacter.dnd5eInventory,
      ...(!equipmentUnchanged ? { equipment: inventoryCharacter.equipment } : {}),
      dnd5eCombatState: nextClassState,
    }
    const grantedRest = nextClassState?.lastGrantedShortRest
    if (grantedRest?.completedWorldMinute != null &&
      grantedRest.receiptId !== character.dnd5eCombatState?.lastGrantedShortRest?.receiptId) {
      patch.dnd5eRestActivityWindow = recordDnd5eRestActivityWindow(
        { ...character, ...patch }, 'short-rest-complete', grantedRest.completedWorldMinute,
      ).dnd5eRestActivityWindow
    }
    changedCharacterIds.push(character.id)
    characterPatches[character.id] = patch
    return { ...character, ...patch }
  })
  const rebound = reconcileDnd5eInventoryEffectBindings(characters, dnd5eMapInventoryLifetimeEntries([map]))
  rebound.forEach((character,index)=>{
    if (JSON.stringify(character.dnd5eCombatState)===JSON.stringify(characters[index].dnd5eCombatState)) return
    if (!changedCharacterIds.includes(character.id)) changedCharacterIds.push(character.id)
    characterPatches[character.id]={...characterPatches[character.id],conditions:character.conditions,dnd5eCombatState:character.dnd5eCombatState}
  })
  characters=rebound
  const liveEffectTags = new Set([
    ...characters.flatMap(character => (character.dnd5eCombatState?.activeEffects ?? []).flatMap(effect => effect.tags ?? [])),
    ...map.tokens.filter(token => !token.characterId || token.dnd5eSimulacrum != null).flatMap(token => (token.dnd5eCombatState?.activeEffects ?? []).flatMap(effect => effect.tags ?? [])),
  ])
  const knownSourceOwnerIds = new Set(characters.map(character => character.id))
  const endedCharacterIds = new Set((input.events ?? []).flatMap(event => event.type === 'turn-ended' ? [input.characterIdByCombatantId[event.actorId] ?? event.actorId] : []))
  const materialOwnerIds = new Set(Object.entries(input.characterIdByCombatantId).flatMap(([tokenId, characterId]) =>
    input.state.combatants[tokenId] && !tokenById.get(tokenId)?.dnd5eSimulacrum ? [characterId] : [],
  ))
  characters = characters.map(character => {
    let next = expireDnd5eReleasedWeapons(expireDnd5eSourceBoundInventory(character,liveEffectTags,knownSourceOwnerIds),endedCharacterIds)
    // Only reconcile owners represented by this authoritative snapshot. Off-map
    // characters may still have effects absent from the current combat state.
    if (materialOwnerIds.has(character.id)) next = settleDnd5eEndedSpellMaterialEscrows(next,
      new Set((next.dnd5eCombatState?.activeEffects ?? []).map(effect => effect.id)),
    ).character
    if (next === character) return character
    if (!changedCharacterIds.includes(character.id)) changedCharacterIds.push(character.id)
    characterPatches[character.id] = {...characterPatches[character.id], dnd5eInventory:next.dnd5eInventory, equipment:next.equipment, dnd5eCombatState:next.dnd5eCombatState}
    return next
  })
  for (const tokenId of Object.keys(input.state.combatants)) {
    if (!tokenById.has(tokenId)) throw new Error(`Headless combatant has no map token: ${tokenId}`)
  }
  map = applyDnd5ePersistentAreaMapChanges(map,input.events??[])
  map = freezeDnd5eWaterWallsFromEvents({map,events:input.events,round:input.state.round,worldMinute:input.state.companionScene?.worldMinute})
  map = igniteDnd5eWebAreasFromFire({ map, events: input.events,
    round: input.state.round,
    turnTokenId: input.state.initiativeOrder[input.state.initiativeIndex] ?? '',
  })
  const freed=new Set((input.events??[]).flatMap(event=>event.type==='active-effect-removed' && event.definitionId==='summon-control' && event.reason==='save-succeeded' ? [event.targetId] : []))
  map = { ...map, tokens: map.tokens.map(token => {
    const combatant = input.state.combatants[token.id]
    if (token.dnd5eSummon?.sourceDeathBehavior !== 'die' || !combatant ||
      token.dnd5eSummon.sourceDeathHandled === combatant.summonedSourceDeathHandled) return token
    const next = { ...token, dnd5eSummon: { ...token.dnd5eSummon,
      sourceDeathHandled: combatant.summonedSourceDeathHandled ? true as const : undefined } }
    if (!changedTokenIds.includes(token.id)) changedTokenIds.push(token.id)
    tokenPatches[token.id] = { ...tokenPatches[token.id], dnd5eSummon: next.dnd5eSummon }
    return next
  }) }
  const released = (input.events ?? []).filter((event): event is Extract<Dnd5eCombatEvent, { type: 'companion-control-ended' }> => event.type === 'companion-control-ended')
  const temporaryDismissals = (input.events ?? []).filter((event): event is Extract<Dnd5eCombatEvent, {type:'temporary-summons-dismissed'}> => event.type === 'temporary-summons-dismissed')
  if (temporaryDismissals.length) map = {...map, tokens: map.tokens.map(token => {
    const summon = token.dnd5eSummon
    if (!summon || summon.persistent || !temporaryDismissals.some(event => event.actorId === summon.sourceTokenId &&
      (event.packageId ?? 'srd-5.1') === summon.pluginId && event.sourceActivityIds.includes(summon.featureId))) return token
    const next = {...token, dnd5eSummon: {...summon, dismissed: true as const}}
    if (!changedTokenIds.includes(token.id)) changedTokenIds.push(token.id)
    tokenPatches[token.id] = {...tokenPatches[token.id], dnd5eSummon: next.dnd5eSummon}
    return next
  })}
  const dismissed=(input.events??[]).filter((event):event is Extract<Dnd5eCombatEvent,{type:'summon-dismissed'}>=>event.type==='summon-dismissed')
  if(dismissed.length)map={...map,tokens:map.tokens.map(token=>{
    if(!token.dnd5eSummon || !dismissed.some(event=>event.actorId===token.dnd5eSummon!.sourceTokenId && event.bondKey===token.dnd5eSummon!.bondKey && (event.packageId ?? 'srd-5.1')===token.dnd5eSummon!.pluginId))return token
    const next={...token,dnd5eSummon:{...token.dnd5eSummon,dismissed:true as const}}
    if(!changedTokenIds.includes(token.id))changedTokenIds.push(token.id)
    tokenPatches[token.id]={...tokenPatches[token.id],dnd5eSummon:next.dnd5eSummon}
    return next
  })}
  if(freed.size || released.length) map={...map,tokens:map.tokens.map(token=>{
    const summon = token.dnd5eSummon
    if (!summon || summon.controlEnded) return token
    const release = released.find(event => event.targetId === token.id && event.actorId === summon.sourceTokenId && event.sourceActivityId === summon.featureId)
    const escapedSave = freed.has(token.id) && !!summon.controlSave
    if (!escapedSave && !release) return token
    const hostile = escapedSave || release?.becomesHostile === true
    const next={...token,dnd5eSummon:{...summon,controlEnded:true as const,
      side:hostile ? (summon.side==='player'?'enemy' as const:'player' as const) : summon.side}}
    if(!changedTokenIds.includes(token.id))changedTokenIds.push(token.id)
    tokenPatches[token.id]={...tokenPatches[token.id],dnd5eSummon:next.dnd5eSummon}
    return next
  })}
  map = cancelDnd5eDelayedSummonsForEvents(map, input.state.combatId, input.events ?? [])
  map = { ...map, tokens: map.tokens.map(token => {
    const object = clearEndedDnd5eGroundItemEffects(input.state, token.dnd5eObjectState)
    const carried = token.dnd5eCarriedObjects?.map(item => {
      const objectState = clearEndedDnd5eGroundItemEffects(input.state, item.objectState)!
      return objectState === item.objectState ? item : { ...item, objectState }
    })
    const carriedChanged = carried?.some((item, index) => item !== token.dnd5eCarriedObjects![index])
    if (object === token.dnd5eObjectState && !carriedChanged) return token
    const patch = { ...(object !== token.dnd5eObjectState ? { dnd5eObjectState: object } : {}),
      ...(carriedChanged ? { dnd5eCarriedObjects: carried } : {}) }
    if (!changedTokenIds.includes(token.id)) changedTokenIds.push(token.id)
    tokenPatches[token.id] = { ...tokenPatches[token.id], ...patch }
    return { ...token, ...patch }
  }) }
  const restoredGround = expireDnd5eGroundInventoryAlterations(map, characters)
  if (restoredGround !== map) {
    for (const token of restoredGround.tokens) {
      if (token === map.tokens.find(previous => previous.id === token.id)) continue
      if (!changedTokenIds.includes(token.id)) changedTokenIds.push(token.id)
      tokenPatches[token.id] = { ...tokenPatches[token.id], label: token.label, dnd5eObjectState: token.dnd5eObjectState }
    }
    map = restoredGround
  }
  const reactionIds = [...new Set((input.events ?? []).flatMap(event =>
    event.type === 'turn-resource-spent' && event.resource === 'reaction' &&
    input.state.combatants[event.actorId]?.turn.reactionAvailable === false && map.tokens.some(token => token.id === event.actorId)
      ? [event.actorId] : []))]
  const currentTurnActor = input.state.combatants[input.state.initiativeOrder[input.state.initiativeIndex]]
  const interruptedTurnState = currentTurnActor?.classState.zeroHitPointExtraTurn?.phase === 'active' &&
    currentTurnActor.classState.zeroHitPointExtraTurn.slotId === input.state.initiativeSlotIds?.[input.state.initiativeIndex]
    ? structuredClone(input.state) : undefined
  return { map, characters, changedTokenIds, changedCharacterIds, tokenPatches, characterPatches, interruptedTurnState,
    ...(reactionIds.length ? { spentReactions: { round: input.state.round, tokenIds: reactionIds } } : {}) }
}



