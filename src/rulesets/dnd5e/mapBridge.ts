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
import { createDnd5eCombatant, dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, dnd5eEffectiveDarkvisionRangeFeet, dnd5eEffectiveSizeRank, reconcileDnd5eSourceLinkedRelations, startDnd5eHeadlessCombat, type Dnd5eCombatant, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonsterMapSpeed, dnd5eMonsterProficiencyBonus, getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from './monsters'
import { dnd5eCanThreatenRangedAttacker, dnd5eClassPassiveDefenses, dnd5eConditionImmuneFromSource, dnd5eIsIncapacitated } from './passiveDefenses'
import { dnd5eChallengeRatingValue } from './wildShape'
import { DND5E_COMBAT_STATE_SCHEMA_VERSION } from './activeEffects'
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
  dnd5eMonsterHasImmutableForm,
  dnd5eMonsterHasMagicResistance,
  dnd5eMonsterLimitedMagicImmunityRule,
} from './monsterGenericAbilities'
import { compileDnd5eEffectiveVisionProfile } from '../../../shared/dnd5e-vision-profile.mjs'
import { dnd5eWeaponDamageSource } from './equipment'
import { applyDnd5eInventoryHeadlessSnapshotToCharacter } from './inventoryHeadlessRuntime'
import type { Dnd5eMoralAlignment } from './damageDefenses'
import { dnd5eUtilityProjectionDistanceKey } from './utilityProjectionState'
import {
  dnd5eCreatureHeightFeetForSizeRank,
  dnd5eMapTokenDistanceFeet,
} from './verticalCombatGeometry'

export interface Dnd5eMapCombatSnapshot {
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
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

function dnd5eMonsterConditionImmunities(monster: Dnd5eMonsterStatBlock | undefined): readonly string[] | undefined {
  if (!monster) return undefined
  const hasMagicalSleepImmunity = monster.traits.some((trait) => {
    const name = trait.name.trim().toLowerCase()
    const description = trait.description.trim().toLowerCase()
    return name === 'fey ancestry' || name === '妖精血统' || name === '精灵血统' ||
      description.includes("magic can't put") || description.includes('magic cannot put') ||
      description.includes('魔法无法使其入睡') || description.includes('魔法不能使其入睡')
  })
  return hasMagicalSleepImmunity
    ? [...new Set([...(monster.conditionImmunities ?? []), 'magical-sleep', '魔法睡眠'])]
    : monster.conditionImmunities
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
    for (const paladin of paladins) {
      const paladinToken = tokenById.get(paladin.id)
      if (!paladinToken || areOpposedCombatTokens(paladinToken, targetToken)) continue
      const paladinLevel = dnd5eCombatantClassLevel(paladin, 'paladin')
      const radius = paladinLevel >= 18 ? 30 : 10
      if (tokenFootprintDistanceCells(paladinToken, targetToken, map) * feetPerCell > radius) continue
      savingThrowAuraBonus = Math.max(savingThrowAuraBonus, Math.max(1, rules.abilityModifier(paladin.abilities.cha)))
      if (paladinLevel >= 10) courageAura = true
      if (dnd5eCombatantHasSubclass(paladin, 'paladin', 'devotion') && paladinLevel >= 7) devotionAura = true
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
  }
}

function applyClassPassiveDefenses(combatants: Dnd5eCombatant[]): void {
  for (const combatant of combatants) {
    const passive = dnd5eClassPassiveDefenses(combatant)
    combatant.damageImmunities = [...new Set([...combatant.damageImmunities, ...passive.damageImmunities])]
    combatant.conditionImmunities = [...new Set([...combatant.conditionImmunities, ...passive.conditionImmunities])]
  }
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
    if (token.type !== 'player' && token.type !== 'enemy') return []
    const initiative = initiativeByTokenId.get(token.id)
    if (initiative == null) return []
    const character = token.characterId ? charactersById.get(token.characterId) : undefined
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
      characterIdByCombatantId[token.id] = character.id
      const combatant = createCombatantFromDnd5eCharacter({
        character: migrated,
        controller: dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
        initiativeD20: Math.max(1, Math.min(20, initiative - migrated.initiativeBonus)),
        position: { x: token.x, y: token.y },
      })
      const weaponDamageSources = characterWeaponDamageSources(character)
      const mainWeaponId = character.equipment?.mainWeapon?.id
      return [{
        ...combatant,
        mainWeaponId,
        mainWeaponMagical: !!mainWeaponId && weaponDamageSources?.[mainWeaponId]?.magical === true,
        weaponDamageSources,
        grappleFreeHandCapacity: characterGrappleFreeHandCapacity(character),
        moralAlignment: normalizeDnd5eMoralAlignment(character.alignment),
        id: token.id,
        name: token.label,
        initiative,
        sizeRank: ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[token.creatureSize ?? '中型'],
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
      controller: dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
      initiative,
      abilities: monster ? { ...monster.abilities } : { ...DEFAULT_ABILITIES },
      savingThrowBonuses: monster?.savingThrows,
      skillProficiencies: monster?.skills?.map((skill) => skill.key),
      classSelections: {
        expertise: dnd5eMonsterExpertiseSkills(monster),
      },
      passivePerception: 10 + (monster?.skills?.find((skill) => skill.key === 'perception')?.bonus ??
        rules.abilityModifier(monster?.abilities.wis ?? DEFAULT_ABILITIES.wis)),
      proficiencyBonus: monster ? dnd5eMonsterProficiencyBonus(monster.challenge.rating) : 2,
      challengeRating: monster ? dnd5eChallengeRatingValue(monster.challenge.rating) : undefined,
      sizeRank: ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[token.creatureSize ?? monster?.size ?? '中型'],
      armorClass: monster?.armorClass.value ?? getTokenTargetAc(token) ?? 10,
      currentHp: Math.max(0, Math.min(maxHp, token.hp ?? maxHp)),
      maxHp,
      temporaryHp: Math.max(0, Math.floor(tokenTemporaryHp ?? 0)),
      exhaustionLevel: 0,
      speed: monster ? dnd5eMonsterMapSpeed(monster) : 30,
      movementSpeeds: monster ? {
        walk: monster.speed.walk ?? 0,
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
      weaponAttacksMagical: monster?.traits.some((trait) =>
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
      creatureType: monster?.creatureType,
      damageVulnerabilities: monster?.damageVulnerabilities,
      damageResistances: monster?.damageResistances,
      damageImmunities: monster?.damageImmunities,
      damageDefenseRules: monster?.damageDefenseRules,
      moralAlignment: normalizeDnd5eMoralAlignment(monster?.alignment),
      conditionImmunities: dnd5eMonsterConditionImmunities(monster),
    })
    if (!token.characterId && combatant.currentHp === 0 && tokenStableAtZero === true) {
      combatant.deathSaves = {
        successes: 0,
        failures: 0,
        stable: true,
        dead: false,
      }
    }
    return [combatant]
  })
  applyClassPassiveDefenses(combatants)
  applyPaladinAuras(input.map, combatants)
  applyBardCountercharm(input.map, combatants)
  applyHolyNimbusSources(input.map, combatants)
  applyDraconicPresenceSources(input.map, combatants)
  const state = startDnd5eHeadlessCombat(input.combatId, combatants)
  const authoritativeSlots = input.initiativeOrder.filter((entry) =>
    state.combatants[entry.tokenId] != null,
  )
  if (authoritativeSlots.length > 0) {
    state.initiativeOrder = authoritativeSlots.map((entry) => entry.tokenId)
    state.initiativeSlotIds = authoritativeSlots.map((entry) => entry.slotId ?? entry.tokenId)
    const firstRoundOnlyInitiativeSlotIds = authoritativeSlots.flatMap((entry) =>
      entry.firstRoundOnly ? [entry.slotId ?? entry.tokenId] : [],
    )
    state.firstRoundOnlyInitiativeSlotIds = firstRoundOnlyInitiativeSlotIds.length > 0
      ? firstRoundOnlyInitiativeSlotIds
      : undefined
  }
  state.mapId = input.map.id
  state.coordinateUnitsPerFoot = input.map.gridSize /
    Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  state.environment = geometry?.environment
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
  state.magicalDarknessByCombatantPair = {}
  const snapshotRound = Math.max(1, Math.floor(input.round ?? 1))
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      area.sourceKind !== 'core-spell' ||
      !area.coreSpellId ||
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
        area.coreSpellId,
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
          from: effectiveViewer,
          to: target,
          fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
          toElevationFeet: mapGeometryTokenElevation(geometry, target),
          fromEyeHeightFeet: attackerHeightFeet / 2,
          toEyeHeightFeet: targetHeightFeet / 2,
        })
        if (physicalLineOfSightBlocked) state.physicalLineOfSightBlockedByCombatantPair[directedKey] = true
        if (mapGeometryIlluminationAtPoint({
          geometry,
          map: input.map,
          tokens: input.map.tokens,
          point: target,
          elevationFeet: target.elevationFeet ?? 0,
        }) === 'magical-darkness') state.magicalDarknessByCombatantPair[directedKey] = true
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
  const map: BattleMap = {
    ...input.map,
    tokens: input.map.tokens.map((token) => {
      const combatant = input.state.combatants[token.id]
      if (!combatant) return token
      const nextTokenClassState = !token.characterId
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
              ? { ...combatant.classState.monsterOnHitSavePending }
              : undefined,
            activeEffectDamageSavePendingIds: combatant.classState.activeEffectDamageSavePendingIds
              ? [...combatant.classState.activeEffectDamageSavePendingIds]
              : undefined,
            activeEffects: combatant.classState.activeEffects?.map((effect) => ({
              ...effect,
              source: { ...effect.source },
              duration: { ...effect.duration },
              repeatSave: effect.repeatSave ? { ...effect.repeatSave } : undefined,
              breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
            })),
            caltropsSpeedPenaltyFeet: combatant.classState.caltropsSpeedPenaltyFeet,
            attacksMadeTurnKey: combatant.classState.attacksMadeTurnKey,
            attacksMadeThisTurn: combatant.classState.attacksMadeThisTurn,
            turnStartResolvedTurnKey: combatant.classState.turnStartResolvedTurnKey,
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
            turnedByClericId: combatant.classState.turnedByClericId,
            turnedRoundsRemaining: combatant.classState.turnedRoundsRemaining,
            holyNimbusRoundsRemaining: combatant.classState.holyNimbusRoundsRemaining,
            conditions: combatant.conditions.length > 0 ? [...combatant.conditions] : undefined,
            stunnedByActorId: combatant.classState.stunnedByActorId,
            stunnedAppliedTurnKey: combatant.classState.stunnedAppliedTurnKey,
            openHandNoReactionsAppliedTurnKeysBySource: combatant.classState.openHandNoReactionsAppliedTurnKeysBySource,
            declarativeUsedTurnKeys: combatant.classState.declarativeUsedTurnKeys,
            declarativeTransactionIds: combatant.classState.declarativeTransactionIds,
            droppedEquipmentIds: combatant.classState.droppedEquipmentIds,
            spellSavePressureBySource: combatant.classState.spellSavePressureBySource,
            bonusProneEligibleTargetIds:
              combatant.classState.bonusProneEligibleTargetIds,
            bonusProneEligibleTurnKey:
              combatant.classState.bonusProneEligibleTurnKey,
            monsterMechanicRollModifiers: combatant.classState.monsterMechanicRollModifiers,
            pendingMonsterMechanicTriggers: combatant.classState.pendingMonsterMechanicTriggers,
            monsterMechanicTriggerSequence: combatant.classState.monsterMechanicTriggerSequence,
            concentrationSpellId: combatant.classState.concentrationSpellId,
            concentrationSpellLevel: combatant.classState.concentrationSpellLevel,
            concentrationTargetIds: combatant.classState.concentrationTargetIds,
            concentrationRoundsRemaining: combatant.classState.concentrationRoundsRemaining,
            concentrationEffectsBySource: combatant.classState.concentrationEffectsBySource,
            viciousMockeryAttackDisadvantage: combatant.classState.viciousMockeryAttackDisadvantage,
            helpedAttackSourceId: combatant.classState.helpedAttackSourceId,
            helpedAttackSourceTurnKey: combatant.classState.helpedAttackSourceTurnKey,
            shieldSpellActive: combatant.classState.shieldSpellActive,
            legendaryResistanceUses: combatant.classState.legendaryResistanceUses,
            monsterLegendaryActionPoints: combatant.classState.monsterLegendaryActionPoints,
            monsterLairActionRoundUsed: combatant.classState.monsterLairActionRoundUsed,
            monsterLairActionLastId: combatant.classState.monsterLairActionLastId,
            monsterRechargeReadyByActionId: combatant.classState.monsterRechargeReadyByActionId,
            monsterActionUsesByActionId: combatant.classState.monsterActionUsesByActionId,
            monsterSpellSlots: combatant.classState.monsterSpellSlots,
            monsterSpellUsesBySpellId: combatant.classState.monsterSpellUsesBySpellId,
            monsterMultiattackContinuation: combatant.classState.monsterMultiattackContinuation,
            monsterShapechangeOriginalStatBlockId: combatant.classState.monsterShapechangeOriginalStatBlockId,
            monsterShapechangeFormId: combatant.classState.monsterShapechangeFormId,
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
            monsterThreatByTargetId: combatant.classState.monsterThreatByTargetId,
            hurlThroughHellSourceId: combatant.classState.hurlThroughHellSourceId,
            hurlThroughHellDamage: combatant.classState.hurlThroughHellDamage,
            hurlThroughHellAppliedTurnKey: combatant.classState.hurlThroughHellAppliedTurnKey,
          })
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
        ...(!token.characterId && combatant.statBlockId && combatant.statBlockId !== token.poolId
          ? { poolId: combatant.statBlockId }
          : {}),
        ...(!token.characterId ? { dnd5eCombatState: nextTokenClassState } : {}),
      }
      const tokenClassStateUnchanged = token.characterId ||
        JSON.stringify(token.dnd5eCombatState ?? {}) === JSON.stringify(nextTokenClassState ?? {})
      if (
        token.x === patch.x && token.y === patch.y && token.size === patch.size &&
        token.elevationFeet === patch.elevationFeet && token.hp === patch.hp && token.maxHp === patch.maxHp &&
        token.poolId === (patch.poolId ?? token.poolId) &&
        tokenClassStateUnchanged
      ) return token
      changedTokenIds.push(token.id)
      tokenPatches[token.id] = patch
      return { ...token, ...patch }
    }),
  }
  const characters = input.characters.map((character) => {
    const combatantId = Object.keys(input.characterIdByCombatantId).find((id) => input.characterIdByCombatantId[id] === character.id)
    const combatant = combatantId ? input.state.combatants[combatantId] : undefined
    if (!combatant) return character
    const nextClassResources = Object.keys(combatant.classResources).length > 0
      ? Object.fromEntries(Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }]))
      : undefined
    const nextClassState = compactOptionalRecord({
      ...combatant.classState,
      hitPointMaximumReductionLedger:
        combatant.classState.hitPointMaximumReductionLedger
          ? {
              ...combatant.classState.hitPointMaximumReductionLedger,
              entries:
                combatant.classState.hitPointMaximumReductionLedger.entries
                  .map((entry) => ({ ...entry })),
            }
          : undefined,
    })
    const nextCharacterCurrentHp = combatant.classState.wildShapeFormId
      ? combatant.classState.wildShapeOriginalCurrentHp ?? character.currentHp
      : combatant.currentHp
    const inventoryCharacter = applyDnd5eInventoryHeadlessSnapshotToCharacter({
      character,
      snapshots: combatant.inventoryHeadlessEffects,
      revision: combatant.inventoryRevision,
    })
    const resourcesUnchanged = JSON.stringify(character.classResources ?? {}) === JSON.stringify(nextClassResources ?? {})
    const inventoryUnchanged = JSON.stringify(character.dnd5eInventory ?? {}) === JSON.stringify(inventoryCharacter.dnd5eInventory ?? {})
    const classStateUnchanged = JSON.stringify(character.dnd5eCombatState ?? {}) === JSON.stringify(nextClassState ?? {})
    const conditionsUnchanged = JSON.stringify(character.conditions) === JSON.stringify(combatant.conditions)
    if (
      character.currentHp === nextCharacterCurrentHp &&
      character.maxHp === combatant.maxHp &&
      character.tempHp === combatant.temporaryHp &&
      (character.exhaustionLevel ?? 0) === combatant.exhaustionLevel &&
      (character.deathSaveSuccesses ?? 0) === combatant.deathSaves.successes &&
      (character.deathSaveFailures ?? 0) === combatant.deathSaves.failures &&
      (character.deathSaveStable ?? false) === combatant.deathSaves.stable &&
      (character.concentrating ?? false) === combatant.concentrating &&
      resourcesUnchanged &&
      inventoryUnchanged &&
      classStateUnchanged &&
      conditionsUnchanged
    ) return character
    const patch: Partial<Character> = {
      currentHp: nextCharacterCurrentHp,
      maxHp: combatant.maxHp,
      tempHp: combatant.temporaryHp,
      exhaustionLevel: combatant.exhaustionLevel,
      deathSaveSuccesses: combatant.deathSaves.successes,
      deathSaveFailures: combatant.deathSaves.failures,
      deathSaveStable: combatant.deathSaves.stable,
      concentrating: combatant.concentrating,
      conditions: [...combatant.conditions],
      classResources: nextClassResources,
      dnd5eInventory: inventoryCharacter.dnd5eInventory,
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
