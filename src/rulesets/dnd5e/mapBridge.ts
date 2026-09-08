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
  mapGeometryLineOfSightBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { createDnd5eCombatant, dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass, dnd5eCombatantPairKey, dnd5eDeclarativeCompanionProfileUpgrade, dnd5eDeclarativeEnvironmentalMovementSpeed, dnd5eDirectedCombatantPairKey, dnd5eEffectiveDarkvisionRangeFeet, dnd5eEffectiveSizeRank, dnd5eHeadlessTurnKey, hydrateDnd5eWildShapeCombatant, reconcileDnd5eSourceLinkedRelations, startDnd5eHeadlessCombat, type Dnd5eCombatant, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonsterMapSpeed, dnd5eMonsterProficiencyBonus, getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from './monsters'
import { dnd5eCanThreatenRangedAttacker, dnd5eClassPassiveDefenses, dnd5eConditionImmuneFromSource, dnd5eIsIncapacitated } from './passiveDefenses'
import { dnd5eStandardConditionId } from './conditions'
import { dnd5eChallengeRatingValue } from './wildShape'
import {
  createDnd5eMechanicalEffect,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eActiveForcedFleeSourceId,
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
import { dnd5eWeaponDamageSource } from './equipment'
import { applyDnd5eInventoryHeadlessSnapshotToCharacter } from './inventoryHeadlessRuntime'
import { applyDnd5eInventoryReactionSpellSnapshotsToCharacter } from './inventoryReactionSpells'
import type { Dnd5eMoralAlignment } from './damageDefenses'
import { dnd5eUtilityProjectionDistanceKey } from './utilityProjectionState'
import {
  dnd5eCreatureHeightFeetForSizeRank,
  dnd5eMapTokenDistanceFeet,
} from './verticalCombatGeometry'
import { dnd5eRestoredSummonedOriginalObject } from './summonedCreatures'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
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
    token.blindsightRangeFeet ? { kind: 'blindsight' as const, rangeFeet: token.blindsightRangeFeet } : undefined,
    token.tremorsenseRangeFeet ? { kind: 'tremorsense' as const, rangeFeet: token.tremorsenseRangeFeet } : undefined,
    token.truesightRangeFeet ? { kind: 'truesight' as const, rangeFeet: token.truesightRangeFeet } : undefined,
  ].filter((sense): sense is Dnd5eSpecialSense => !!sense && sense.rangeFeet > 0)
}

function mergeSpecialSenses(...groups: readonly Dnd5eSpecialSense[][]): Dnd5eSpecialSense[] {
  const maximumByKind = new Map<Dnd5eSpecialSense['kind'], number>()
  for (const sense of groups.flat()) {
    maximumByKind.set(sense.kind, Math.max(maximumByKind.get(sense.kind) ?? 0, sense.rangeFeet))
  }
  return [...maximumByKind].map(([kind, rangeFeet]) => ({ kind, rangeFeet }))
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

function applyPersistentAreaOccupantModifiers(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  for (const combatant of combatants) {
    const token = tokenById.get(combatant.id)
    if (!token) continue
    const modifiers = dnd5ePersistentAreaOccupantModifiersAt({ map, token, position: token })
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
        effect.source.magical !== true
          ? effect
          : {
              ...effect,
              suspendedBy: [...new Set([
                ...(effect.suspendedBy ?? []),
                'persistent-area:antimagic',
              ])],
            })
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

export function createDnd5eMapCombatSnapshot(input: {
  combatId: string
  round?: number
  turnSlotId?: string
  effectiveRules?: Dnd5eEffectiveRulesContextV1
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
}): Dnd5eMapCombatSnapshot {
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  const initiativeByTokenId = new Map<string, number>()
  for (const entry of input.initiativeOrder) {
    // Extra first-round slots must not replace the creature's normal initiative
    // when a per-action Headless snapshot builds its unique combatant order.
    if (!initiativeByTokenId.has(entry.tokenId) || !entry.turnKind) {
      initiativeByTokenId.set(entry.tokenId, entry.roll)
    }
  }
  const characterIdByCombatantId: Record<string, string> = {}
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const combatants = input.map.tokens.flatMap((token) => {
    // NPC tokens are still creatures for spell saves and damage even when the
    // table does not give them turns. Spell-resolution callers provide a
    // synthetic initiative entry so they can participate in an ephemeral
    // Headless snapshot without joining the persisted combat turn order.
    if (token.type !== 'player' && token.type !== 'enemy' && token.type !== 'npc') return []
    const initiative = initiativeByTokenId.get(token.id)
    if (initiative == null) return []
    const character = token.characterId ? charactersById.get(token.characterId) : undefined
    const simulacrum = token.dnd5eSimulacrum
    // A player token that names a character must never silently fall through to
    // the generic monster path while the character resource is still syncing.
    // Omitting it makes the action fail closed instead of accepting an attack
    // that loses class, subclass, equipment, and plugin mechanics.
    if (token.type === 'player' && token.characterId && !character) return []
    if (character) {
      const migrated = migrateCharacterToDnd5e(character)
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
        campaignWorldMinute: Number.isSafeInteger(character.dnd5eWorldTimeAppliedMinute)
          ? character.dnd5eWorldTimeAppliedMinute
          : undefined,
        languages: [...new Set([
          'common',
          ...(character.dnd5eBackgroundLanguages ?? []),
        ])],
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
        illumination: mapGeometryIlluminationAtPoint({
          geometry,
          map: input.map,
          tokens: input.map.tokens,
          point: token,
          elevationFeet: mapGeometryTokenElevation(geometry, token),
        }),
        elevationFeet: mapGeometryTokenElevation(geometry, token),
        groundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, token),
        airborne: mapGeometryTokenElevation(geometry, token) >
          mapGeometryTerrainElevationAtPoint(geometry, token),
        darkvisionRangeFeet: visionProfile.darkvisionRangeFeet || undefined,
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
    const combatant = createDnd5eCombatant({
      id: token.id,
      name: token.label,
      // True Polymorph's object-to-creature branch may remain friendly after
      // becoming permanent, but the caster explicitly loses control. Keep
      // relationship/targeting on the player side while assigning its turns
      // to the DM once the authority-owned control-ended flag is present.
      controller: token.dnd5eSummon?.controlEnded === true
        ? 'dm'
        : dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
      initiative,
      abilities: monster ? { ...monster.abilities } : { ...DEFAULT_ABILITIES },
      savingThrowBonuses: monster?.savingThrows
        ? Object.fromEntries(Object.entries(monster.savingThrows).map(([ability, bonus]) => [
            ability,
            bonus + Math.max(0, token.dnd5eSummon?.savingThrowBonus ?? 0),
          ]))
        : undefined,
      skillProficiencies: monster?.skills?.map((skill) => skill.key),
      languages: monster?.languages ? [...monster.languages] : [],
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
      illumination: mapGeometryIlluminationAtPoint({
        geometry,
        map: input.map,
        tokens: input.map.tokens,
        point: token,
        elevationFeet: mapGeometryTokenElevation(geometry, token),
      }),
      armorClass: (monster?.armorClass.value ?? getTokenTargetAc(token) ?? 10) +
        Math.max(0, token.dnd5eSummon?.armorClassBonus ?? 0),
      currentHp: Math.max(0, Math.min(maxHp, token.hp ?? maxHp)),
      maxHp,
      temporaryHp: Math.max(0, Math.floor(tokenTemporaryHp ?? 0)),
      exhaustionLevel: 0,
      speed: token.dnd5eSummon?.walkingSpeedFeet ?? (monster ? dnd5eMonsterMapSpeed(monster) : 30),
      movementSpeeds: monster ? {
        walk: token.dnd5eSummon?.walkingSpeedFeet ?? monster.speed.walk ?? 0,
        climb: monster.speed.climb,
        swim: monster.speed.swim,
        fly: monster.speed.fly,
        hover: monster.speed.hover,
      } : { walk: 30 },
      position: { x: token.x, y: token.y },
      elevationFeet: mapGeometryTokenElevation(geometry, token),
      groundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, token),
      // Elevation is physical state, independent of where the flight speed
      // came from. A walking monster held aloft by Fly must remain airborne in
      // the Headless snapshot so losing that effect can trigger a real fall.
      airborne: mapGeometryTokenElevation(geometry, token) >
        mapGeometryTerrainElevationAtPoint(geometry, token),
      darkvisionRangeFeet: visionProfile.darkvisionRangeFeet || undefined,
      darknessSightRangeFeet: visionProfile.darknessSightRangeFeet || undefined,
      magicalDarknessSightRangeFeet:
        visionProfile.magicalDarknessSightRangeFeet || undefined,
      specialSenses: mergeSpecialSenses(normalizeDnd5eSpecialSenses(monster?.senses), tokenSpecialSenses(token)),
      magicResistance: dnd5eMonsterHasMagicResistance(monster),
      limitedMagicImmunity: dnd5eMonsterLimitedMagicImmunityRule(monster),
      shapechanger: monster?.capabilities?.shapechanger === true ||
        (!!monster && dnd5eMonsterHasStructuredShapechange(monster.id)),
      immutableForm: dnd5eMonsterHasImmutableForm(monster),
      weaponAttacksMagical: token.dnd5eSummon?.weaponAttacksMagical === true || monster?.traits.some((trait) =>
        trait.rule?.kind === 'magic-weapons' && trait.rule.weaponAttacksMagical
      ),
      mainWeaponId: monster?.actions.find((action) => action.kind === 'weapon-attack')?.id,
      concentrating: !!tokenClassState.concentrationSpellId,
      classState: {
        ...tokenClassState,
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
      wearingArmor: dnd5eMonsterArmorClassNoteMeansWornArmor(monster?.armorClass.note),
      wearingMetalArmor: !!monster?.armorClass.note && [
        '链甲', '鳞甲', '胸甲', '半身板甲', '环甲', '板条甲', '板甲',
        'chain', 'scale', 'breastplate', 'half plate', 'ring mail', 'splint', 'plate',
      ].some((name) => monster.armorClass.note!.toLowerCase().includes(name)),
      conditions: tokenConditions,
      statBlockId: monster?.id,
      summonedWeaponDamageBonus: token.dnd5eSummon?.weaponDamageBonus,
      summonedWeaponAttackBonus: token.dnd5eSummon?.weaponAttackBonus,
      summonedProficientSkillCheckBonus: token.dnd5eSummon?.proficientSkillCheckBonus,
      summonedAttacksPerAction: token.dnd5eSummon?.attacksPerAction,
      summonedShareSelfSpellsRangeFeet: token.dnd5eSummon?.shareSelfSpellsRangeFeet,
      summonedCannotAttack: token.dnd5eSummon?.cannotAttack === true,
      summonedSourceCombatantId: token.dnd5eSummon?.controlEnded === true
        ? undefined
        : token.dnd5eSummon?.sourceTokenId,
      summonedPersistent: token.dnd5eSummon?.persistent === true,
      // Custom and unlinked combat tokens carry their creature taxonomy on
      // the map token. Dropping it here bypassed creature-type rules such as
      // Spare the Dying's construct/undead immunity.
      creatureType: monster?.creatureType ?? token.creatureTypes?.[0],
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
    if (!token.characterId && combatant.currentHp === 0 && tokenStableAtZero === true) {
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
  const state = startDnd5eHeadlessCombat(input.combatId, combatants)
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
      combatant.classState.activityExtraTurnGroup?.slotIds ?? [],
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
  state.mapId = input.map.id
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
        const effectiveViewer = {
          ...attacker,
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
          map: input.map,
          from: effectiveViewer,
          to: target,
          fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
          toElevationFeet: mapGeometryTokenElevation(geometry, target),
          fromEyeHeightFeet: attackerHeightFeet / 2,
          toEyeHeightFeet: targetHeightFeet / 2,
        })
        if (physicalLineOfSightBlocked) state.physicalLineOfSightBlockedByCombatantPair[directedKey] = true
        const targetIllumination = mapGeometryIlluminationAtPoint({
          geometry,
          map: input.map,
          tokens: input.map.tokens,
          point: target,
          elevationFeet: target.elevationFeet ?? 0,
        })
        if (targetIllumination === 'magical-darkness') {
          state.magicalDarknessByCombatantPair[directedKey] = true
        } else if (targetIllumination === 'darkness') {
          state.ordinaryDarknessByCombatantPair[directedKey] = true
        }
        const lineOfSightBlocked = physicalLineOfSightBlocked ||
          !mapGeometryCanSeeToken({
            geometry,
            map: input.map,
            viewer: effectiveViewer,
            target,
            viewerHeightFeet: attackerHeightFeet,
            targetHeightFeet,
          })
        if (lineOfSightBlocked) state.lineOfSightBlockedByCombatantPair[directedKey] = true
      }
    }
  }
  state.round = snapshotRound
  state.turnSlotId = input.turnSlotId ??
    state.initiativeSlotIds?.[state.initiativeIndex] ??
    state.initiativeOrder[state.initiativeIndex]
  reconcileDnd5eSourceLinkedRelations(state)
  return { state, characterIdByCombatantId }
}

export interface Dnd5eMapResultPlan {
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
export function refreshDnd5eMapSpatialRelations(
  state: Dnd5eHeadlessCombatState,
  map: BattleMap,
  events: Dnd5eCombatEvent[] = [],
  options: { openedDoorIds?: readonly string[] } = {},
): void {
  const runtimeGeometry = mapGeometryRuntimeForMap(map.id)
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
  reconcileDnd5eSourceLinkedRelations(state, events)
}

export function planDnd5eMapResultApplication(input: {
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
  refreshDnd5eMapSpatialRelations(input.state, input.map, input.events, {
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
            activeEffectDamageSavePendingModes: combatant.classState.activeEffectDamageSavePendingModes
              ? { ...combatant.classState.activeEffectDamageSavePendingModes }
              : undefined,
            deathRound: combatant.classState.deathRound,
            deathInitiativeIndex: combatant.classState.deathInitiativeIndex,
            deathCause: combatant.classState.deathCause,
            soulReturnStatus: combatant.classState.soulReturnStatus,
            bodyPresent: combatant.classState.bodyPresent,
            missingBodyParts: combatant.classState.missingBodyParts
              ? [...combatant.classState.missingBodyParts]
              : undefined,
            vitalBodyPartsMissing: combatant.classState.vitalBodyPartsMissing,
            activeEffects: persistentActiveEffectsWithoutTransientAreaSuspension(
              combatant.classState.activeEffects,
            ),
            spellAuthorityRecords: combatant.classState.spellAuthorityRecords,
            spellControlledByActorId: combatant.classState.spellControlledByActorId,
            spellControlMentalAbilities: combatant.classState.spellControlMentalAbilities,
            spellControlledBodyMentalAbilities: combatant.classState.spellControlledBodyMentalAbilities,
            caltropsSpeedPenaltyFeet: combatant.classState.caltropsSpeedPenaltyFeet,
            attacksMadeTurnKey: combatant.classState.attacksMadeTurnKey,
            attacksMadeThisTurn: combatant.classState.attacksMadeThisTurn,
            turnStartResolvedTurnKey: combatant.classState.turnStartResolvedTurnKey,
            slowDelayedSpell: combatant.classState.slowDelayedSpell
              ? structuredClone(combatant.classState.slowDelayedSpell)
              : undefined,
            recklessAttackTurnKey: combatant.classState.recklessAttackTurnKey,
            monsterReactiveAvailableTurnKey: combatant.classState.monsterReactiveAvailableTurnKey,
            monsterReactiveUsedTurnKey: combatant.classState.monsterReactiveUsedTurnKey,
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
            conditions: combatant.conditions.length > 0 ? [...combatant.conditions] : undefined,
            stunnedByActorId: combatant.classState.stunnedByActorId,
            stunnedAppliedTurnKey: combatant.classState.stunnedAppliedTurnKey,
            openHandNoReactionsAppliedTurnKeysBySource: combatant.classState.openHandNoReactionsAppliedTurnKeysBySource,
            declarativeUsedTurnKeys: combatant.classState.declarativeUsedTurnKeys,
            declarativeTransactionIds: combatant.classState.declarativeTransactionIds,
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
            monsterMechanicMovementFeet: combatant.classState.monsterMechanicMovementFeet,
            monsterMechanicMovementOrigin: combatant.classState.monsterMechanicMovementOrigin,
            monsterMechanicMovementLast: combatant.classState.monsterMechanicMovementLast,
            monsterMechanicMovementStraight: combatant.classState.monsterMechanicMovementStraight,
            concentrationSpellId: combatant.classState.concentrationSpellId,
            concentrationSpellLevel: combatant.classState.concentrationSpellLevel,
            concentrationTargetIds: combatant.classState.concentrationTargetIds,
            concentrationRoundsRemaining: combatant.classState.concentrationRoundsRemaining,
            concentrationStartedTurnKey: combatant.classState.concentrationStartedTurnKey,
            lastCompletedConcentration: combatant.classState.lastCompletedConcentration
              ? { ...combatant.classState.lastCompletedConcentration }
              : undefined,
            concentrationEffectsBySource: combatant.classState.concentrationEffectsBySource,
            wildShapeFormId: combatant.classState.wildShapeFormId,
            wildShapeMode: combatant.classState.wildShapeMode,
            wildShapeSourceActorId: combatant.classState.wildShapeSourceActorId,
            wildShapeSourceActivityId: combatant.classState.wildShapeSourceActivityId,
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
        hp: combatant.currentHp,
        maxHp: combatant.maxHp,
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
        token.label === (patch.label ?? token.label) &&
        token.poolId === (patch.poolId ?? token.poolId) &&
        tokenClassStateUnchanged && simulacrumStateUnchanged
      ) return token
      changedTokenIds.push(token.id)
      tokenPatches[token.id] = patch
      return { ...token, ...patch }
    }),
  }
  // Animate Objects ends for an individual target as soon as that creature
  // reaches 0 HP. Resolve that replacement in the same Headless transaction
  // so the damage event still carries the exact overkill amount; a later map
  // reconciliation only sees a clamped 0 HP token and cannot reconstruct it.
  map = {
    ...map,
    tokens: map.tokens.flatMap((token) => {
      if (
        token.dnd5eSummon?.featureId !== 'spell:animate-objects' ||
        !token.dnd5eSummon.truePolymorphOriginalObject ||
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

  const characters = input.characters.map((character) => {
    const baselineCharacter = input.baselineCharacters?.find((candidate) => candidate.id === character.id) ?? character
    const combatantId = Object.keys(input.characterIdByCombatantId).find((id) => input.characterIdByCombatantId[id] === character.id)
    const combatant = combatantId ? input.state.combatants[combatantId] : undefined
    if (!combatant) return character
    const nextClassResources = Object.keys(combatant.classResources).length > 0
      ? Object.fromEntries(Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }]))
      : undefined
    const nextClassState = compactOptionalRecord({
      ...combatant.classState,
      activeEffects: persistentActiveEffectsWithoutTransientAreaSuspension(
        combatant.classState.activeEffects,
      ),
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
      : combatant.maxHp
    let inventoryCharacter = applyDnd5eInventoryHeadlessSnapshotToCharacter({
      character,
      snapshots: combatant.inventoryHeadlessEffects,
      revision: combatant.inventoryRevision,
    })
    inventoryCharacter = applyDnd5eInventoryReactionSpellSnapshotsToCharacter({
      character: inventoryCharacter,
      snapshots: combatant.inventoryReactionSpells,
      revision: combatant.inventoryRevision,
    })
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
    const resourcesUnchanged = JSON.stringify(baselineCharacter.classResources ?? {}) === JSON.stringify(nextClassResources ?? {})
    const inventoryUnchanged = JSON.stringify(baselineCharacter.dnd5eInventory ?? {}) === JSON.stringify(inventoryCharacter.dnd5eInventory ?? {})
    const equipmentUnchanged = JSON.stringify(baselineCharacter.equipment ?? {}) === JSON.stringify(inventoryCharacter.equipment ?? {})
    const classStateUnchanged = JSON.stringify(baselineCharacter.dnd5eCombatState ?? {}) === JSON.stringify(nextClassState ?? {})
    const conditionsUnchanged = JSON.stringify(baselineCharacter.conditions) === JSON.stringify(combatant.conditions)
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
      inventoryUnchanged &&
      equipmentUnchanged &&
      classStateUnchanged &&
      conditionsUnchanged
    ) return character
    const patch: Partial<Character> = {
      currentHp: nextCharacterCurrentHp,
      maxHp: nextCharacterMaxHp,
      tempHp: combatant.temporaryHp,
      exhaustionLevel: combatant.exhaustionLevel,
      deathSaveSuccesses: combatant.deathSaves.successes,
      deathSaveFailures: combatant.deathSaves.failures,
      deathSaveStable: combatant.deathSaves.stable,
      concentrating: combatant.concentrating,
      conditions: [...combatant.conditions],
      classResources: nextClassResources,
      dnd5eInventory: inventoryCharacter.dnd5eInventory,
      ...(!equipmentUnchanged ? { equipment: inventoryCharacter.equipment } : {}),
      dnd5eCombatState: nextClassState,
    }
    changedCharacterIds.push(character.id)
    characterPatches[character.id] = patch
    return { ...character, ...patch }
  })
  for (const tokenId of Object.keys(input.state.combatants)) {
    if (!tokenById.has(tokenId)) throw new Error(`Headless combatant has no map token: ${tokenId}`)
  }
  return { map, characters, changedTokenIds, changedCharacterIds, tokenPatches, characterPatches }
}
