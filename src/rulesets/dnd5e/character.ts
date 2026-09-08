import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryHeadlessEffectSnapshot, Dnd5eInventoryMagicDetectionSnapshot, Dnd5eInventoryReactionSpellSnapshot } from '../../types/inventory'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { createDnd5eCombatant, hydrateDnd5eWildShapeCombatant } from './headlessCombatEngine'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import {
  dnd5eArmorClass,
  dnd5eArmorImposesStealthDisadvantage,
  dnd5eArmorProficiencies,
  dnd5eArmorProficient,
  dnd5eWeaponProficient,
  dnd5eWeaponPropertyIds,
  dnd5eWearingUnproficientArmor,
} from './equipment'
import { dnd5eEquippedEffectTotal } from './equipmentEffects'
import { FIGHTER_RESOURCE_KEYS, fighterResourceState, fighterSelectedFightingStyles } from './fighter'
import {
  dnd5eClassDefinitionForCharacter,
  dnd5eEffectiveSavingThrowProficiencies,
  dnd5eWalkingSpeed,
  type Dnd5eClassId,
} from './classes'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import { syncDnd5ePrimalChampion } from './hitPoints'
import { dnd5eInventoryHeadlessEffectSnapshots } from './inventoryHeadlessRuntime'
import { dnd5eInventoryReactionSpellSnapshots } from './inventoryReactionSpells'
import { normalizeDnd5eInventory } from './items'
import { normalizeDnd5eHitPointMaximumReductionLedger } from './hitPointMaximumReductions'
import {
  dnd5ePluginFeaturePassiveEffectSnapshots,
  type Dnd5ePluginFeaturePassiveEffectSnapshot,
} from './pluginFeaturePassiveEffects'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginRaceDefinition,
  registeredDnd5ePluginFeatures,
  type Dnd5ePluginRacialSavingThrowAdvantages,
  type Dnd5ePluginStaticCombatModifiers,
} from './pluginApi'
import { dnd5eCharacterBuildTagsV1 } from './buildChoices'
import { dnd5eCharacterClassLevel, dnd5eTotalCharacterLevel, normalizeDnd5eClassLevels, type Dnd5eClassLevels } from './multiclass'
import {
  dnd5eCoreRaceMechanics,
  mergeDnd5eRacialSavingThrowAdvantages,
} from './coreRaceMechanics'
import {
  dnd5eRacialResourceDefinitions,
  dnd5eIndependentSpellRulesForCharacter,
  type Dnd5eRacialRulesSnapshot,
} from './racialAutomation'
import { declarativeClassResourceDefinitionsV1 } from './declarativeClass'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
import type { EquipmentItem } from '../../types/equipment'
import { mergeClassResourceDefinitions } from '../../lib/classDefinitionTypes'
import type {
  Dnd5eActivityEquipmentSnapshotV1,
  Dnd5eActivityHeldItemSnapshotV1,
} from './activities/dnd5eActivityExecutor'
import { dnd5eBaseSpellcastingCapabilityV1 } from './characterCapabilities'
import { dnd5eSkillCheckModifier } from './checks'
import {
  dnd5ePluginClassResourceDefinitions,
  dnd5ePluginFeatResourceDefinitions,
} from './plugins/pluginContentCatalog'
import { dnd5eActiveHitPointMaximumBonus } from './activeEffects'

export interface Dnd5eDeathSaves {
  successes: number
  failures: number
  stable: boolean
  dead: boolean
}

export interface Dnd5eCharacter {
  id: string
  name: string
  player: string
  /** 保留种族身份，以便 Headless 投影种族被动规则。 */
  race?: string
  raceId?: string
  level: number
  abilities: Record<AbilityKey, number>
  savingThrowProficiencies: readonly AbilityKey[]
  skillProficiencies: readonly string[]
  passivePerception: number
  passiveInvestigation: number
  saveDc?: number
  armorClass: number
  currentHp: number
  maxHp: number
  temporaryHp: number
  exhaustionLevel: number
  speed: number
  movementSpeeds?: { walk: number; climb?: number; swim?: number; fly?: number; hover?: boolean }
  initiativeBonus: number
  hitPointDice: readonly { sides: number; current: number; max: number }[]
  deathSaves: Dnd5eDeathSaves
  concentrating: boolean
  inspiration: boolean
  conditions: readonly string[]
  classResources: Record<string, { current: number; max: number }>
  inventoryHeadlessEffects?: readonly Dnd5eInventoryHeadlessEffectSnapshot[]
  inventoryMagicItems?: readonly Dnd5eInventoryMagicDetectionSnapshot[]
  inventoryReactionSpells?: readonly Dnd5eInventoryReactionSpellSnapshot[]
  pluginFeaturePassiveEffects?: readonly Dnd5ePluginFeaturePassiveEffectSnapshot[]
  inventoryRevision?: number
  classId?: Dnd5eClassId
  subclassId?: string
  classLevels: Dnd5eClassLevels
  subclassIds: Partial<Record<Dnd5eClassId, string>>
  classSelections: Record<string, string[]>
  classSelectionsByClass: Partial<Record<Dnd5eClassId, Record<string, string[]>>>
  pluginFeatureIds: readonly string[]
  sizeRank: number
  darkvisionRangeFeet?: number
  racialSavingThrowAdvantages?: Dnd5ePluginRacialSavingThrowAdvantages
  racialRules: Dnd5eRacialRulesSnapshot
  damageResistances: readonly Dnd5eDamageType[]
  damageDefenseRules: readonly Dnd5eConditionalDamageDefense[]
  damageImmunities: readonly Dnd5eDamageType[]
  /** Damage types selected through the generic Elemental Adept build tag. */
  elementalAdeptDamageTypes?: readonly Dnd5eDamageType[]
  spellSavingThrowAdvantage?: boolean
  spellSavingThrowAdvantageWithinFeet?: number
  imposeConcentrationCheckDisadvantageOnDamage?: boolean
  meleeWeaponDamageRerollOncePerTurn?: boolean
  shieldDexteritySaveBonusWhenSoleTarget?: boolean
  shieldSuccessfulDexteritySaveNegatesDamage?: boolean
  combatManeuverDieSidesOverride?: 4 | 6 | 8 | 10 | 12
  opportunityAttackSpellReplacement?: boolean
  hitPointMaximumReductionImmunity?: boolean
  cannotBeSurprisedWhileConscious?: boolean
  unseenAttackersDoNotGainAdvantage?: boolean
  ignoreLongRangeRangedWeaponDisadvantage?: boolean
  ignoreNearbyHostileRangedAttackDisadvantage?: boolean
  ignoreLoadingWeaponProperty?: boolean
  mountedMeleeAdvantageAgainstSmallerUnmounted?: boolean
  redirectMountedCreatureAttacksToRider?: boolean
  grantMountedCreatureDexterityEvasion?: boolean
  ignoreRangedWeaponCoverBonus?: boolean
  preventOpportunityAttacksFromMeleeAttackTargets?: boolean
  opportunityAttacksIgnoreDisengage?: boolean
  opportunityAttackHitStopsMovement?: boolean
  opportunityAttacksOnEnterReachWeaponIds?: readonly string[]
  ignoreDifficultTerrainWhileDashing?: boolean
  climbWithoutSpeedCostMultiplier?: number
  runningJumpMinimumApproachFeet?: number
  standFromProneMovementCostFeet?: number
  spellAttackRangeMultiplier?: number
  ignoreSpellAttackCoverBonus?: boolean
  retainHiddenOnRangedWeaponMiss?: boolean
  conditionImmunities: readonly string[]
  wearingArmor: boolean
  wearingUnproficientArmor: boolean
  armorStealthDisadvantage: boolean
  wearingHeavyArmor: boolean
  wearingMetalArmor: boolean
  equippedArmor?: {
    instanceId: string
    equipmentId: string
    magical: boolean
    metal: boolean
    baseProvidedArmorClass: number
    armorClassPenalty: number
    unarmoredArmorClass: number
    destroyed: boolean
  }
  hasShield: boolean
  activityEquipment: Dnd5eActivityEquipmentSnapshotV1
  activitySpellcasting: { capable: boolean; classIds: readonly string[] }
  classState: NonNullable<Character['dnd5eCombatState']>
  savingThrowEquipmentBonus?: number
  savingThrowPluginBonus?: number
}

const DND5E_DAMAGE_TYPE_SET = new Set<string>(DND5E_DAMAGE_TYPES)

function normalizedDamageTypes(values: readonly string[] | undefined): Dnd5eDamageType[] | undefined {
  if (!values) return undefined
  return values.filter((value): value is Dnd5eDamageType => DND5E_DAMAGE_TYPE_SET.has(value))
}

function staticModifierTotal(
  modifiers: readonly Dnd5ePluginStaticCombatModifiers[],
  key: 'armorClassBonus' | 'initiativeBonus' | 'speedBonusFeet' | 'savingThrowBonus' |
    'passivePerceptionBonus' | 'passiveInvestigationBonus',
): number {
  return modifiers.reduce((total, modifier) => total + (modifier[key] ?? 0), 0)
}

function staticModifierMaximum(
  modifiers: readonly Dnd5ePluginStaticCombatModifiers[],
  key: 'mediumArmorDexterityCapBonus' | 'dualWieldMeleeArmorClassBonus' |
    'spellAttackRangeMultiplier' | 'spellSavingThrowAdvantageWithinFeet',
): number {
  return Math.max(0, ...modifiers.map((modifier) => modifier[key] ?? 0))
}

function staticModifierMinimum(
  modifiers: readonly Dnd5ePluginStaticCombatModifiers[],
  key: 'climbWithoutSpeedCostMultiplier' | 'runningJumpMinimumApproachFeet' | 'standFromProneMovementCostFeet',
): number | undefined {
  const values = modifiers.flatMap((modifier) => modifier[key] == null ? [] : [modifier[key]])
  return values.length > 0 ? Math.min(...values) : undefined
}

function combatManeuverDieSidesOverride(
  modifiers: readonly Dnd5ePluginStaticCombatModifiers[],
): 4 | 6 | 8 | 10 | 12 | undefined {
  const values = modifiers.flatMap((modifier) =>
    modifier.combatManeuverDieSidesOverride == null ? [] : [modifier.combatManeuverDieSidesOverride])
  return values.length > 0 ? Math.max(...values) as 4 | 6 | 8 | 10 | 12 : undefined
}

function staticModifierEnabled(
  modifiers: readonly Dnd5ePluginStaticCombatModifiers[],
  key: 'cannotBeSurprisedWhileConscious' | 'unseenAttackersDoNotGainAdvantage' |
    'ignoreLongRangeRangedWeaponDisadvantage' | 'ignoreNearbyHostileRangedAttackDisadvantage' |
    'ignoreLoadingWeaponProperty' | 'ignoreRangedWeaponCoverBonus' | 'ignoreMediumArmorStealthDisadvantage' |
    'preventOpportunityAttacksFromMeleeAttackTargets' | 'ignoreDifficultTerrainWhileDashing' |
    'ignoreSpellAttackCoverBonus' | 'mountedMeleeAdvantageAgainstSmallerUnmounted' |
    'redirectMountedCreatureAttacksToRider' | 'grantMountedCreatureDexterityEvasion' |
    'opportunityAttacksIgnoreDisengage' | 'opportunityAttackHitStopsMovement' |
    'imposeConcentrationCheckDisadvantageOnDamage' | 'meleeWeaponDamageRerollOncePerTurn' |
    'shieldDexteritySaveBonusWhenSoleTarget' | 'shieldSuccessfulDexteritySaveNegatesDamage' |
    'opportunityAttackSpellReplacement' | 'retainHiddenOnRangedWeaponMiss',
): boolean {
  return modifiers.some((modifier) => modifier[key] === true)
}

function activityHeldItemSnapshot(
  character: Character,
  item: EquipmentItem | undefined,
): Dnd5eActivityHeldItemSnapshotV1 | undefined {
  if (!item) return undefined
  const roles: Dnd5eActivityHeldItemSnapshotV1['roles'][number][] = []
  if (item.dnd5e?.kind === 'weapon') roles.push('weapon')
  if (item.dnd5e?.kind === 'shield') roles.push('shield')
  if ((item.spellcastingFocusClassIds?.length ?? 0) > 0) roles.push('spellcasting-focus')
  if (roles.length === 0) roles.push('other')
  return {
    itemId: item.baseEquipmentId ?? item.id,
    roles,
    ...(item.dnd5e?.kind === 'weapon'
      ? {
          weaponMode: item.dnd5e.mode,
          weaponProperties: dnd5eWeaponPropertyIds(item.dnd5e.properties),
          proficient: dnd5eWeaponProficient(character, item),
        }
      : item.dnd5e?.kind === 'shield'
        ? { proficient: dnd5eArmorProficient(character, item) }
        : {}),
  }
}

function activityEquipmentSnapshot(
  character: Character,
  armorCategory: Dnd5eActivityEquipmentSnapshotV1['armorCategory'],
): Dnd5eActivityEquipmentSnapshotV1 {
  const mainHand = activityHeldItemSnapshot(character, character.equipment?.mainWeapon)
  const offHand = activityHeldItemSnapshot(character, character.equipment?.offHand)
  const mainUsesTwoHands = mainHand?.weaponProperties?.includes('two-handed') === true
  const freeHands = Math.max(0, Math.min(2, mainUsesTwoHands
    ? 0
    : Number(mainHand == null) + Number(offHand == null))) as 0 | 1 | 2
  return {
    armorCategory,
    armorProficient: armorCategory === 'none' || dnd5eArmorProficient(character, character.equipment?.armor),
    armorProficiencies: [...dnd5eArmorProficiencies(character)],
    mainHand,
    offHand,
    freeHands,
  }
}

function dnd5eRaceSizeRank(
  race: string | undefined,
  raceId: string | undefined,
  pluginSize: 'small' | 'medium' | undefined,
): number {
  if (pluginSize) return pluginSize === 'small' ? 1 : 2
  const identities = [race, raceId]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
  return identities.some((value) => [
    '半身人', '侏儒', 'halfling', 'gnome',
  ].includes(value)) ? 1 : 2
}

function dnd5eClassResources(character: Character): Record<string, { current: number; max: number }> {
  const resources = Object.fromEntries(Object.entries(character.classResources ?? {}).map(([key, value]) => [key, { ...value }]))
  const definitions = mergeClassResourceDefinitions(character, [
    ...dnd5eRacialResourceDefinitions(character),
    ...declarativeClassResourceDefinitionsV1(character),
    ...dnd5ePluginClassResourceDefinitions(character),
    ...dnd5ePluginFeatResourceDefinitions(character),
  ])
  for (const definition of definitions) {
    if (!definition.isAvailable(character)) continue
    const maximum = Math.max(0, Math.floor(definition.max(character)))
    const existing = resources[definition.key]
    const combinedMaximum = Math.max(existing?.max ?? 0, maximum)
    resources[definition.key] = {
      current: existing ? Math.min(combinedMaximum, Math.max(0, existing.current)) : combinedMaximum,
      max: combinedMaximum,
    }
  }
  const fighterLevel = dnd5eCharacterClassLevel(character, 'fighter')
  if (fighterLevel < 1) return resources
  for (const key of Object.values(FIGHTER_RESOURCE_KEYS)) {
    const resource = fighterResourceState({ ...character, level: fighterLevel }, key)
    if (resource.max > 0) resources[key] = resource
  }
  return resources
}

export function normalizeLegacyAbilityScore(score: number): number {
  if (score <= 20) return Math.min(30, Math.max(1, Math.floor(score)))
  const legacyModifier = Math.floor((score - 25) / 5)
  return Math.min(30, Math.max(1, 10 + legacyModifier * 2))
}

export function normalizeLegacyAbilities(abilities: Record<AbilityKey, number>): Record<AbilityKey, number> {
  return {
    str: normalizeLegacyAbilityScore(abilities.str),
    dex: normalizeLegacyAbilityScore(abilities.dex),
    con: normalizeLegacyAbilityScore(abilities.con),
    int: normalizeLegacyAbilityScore(abilities.int),
    wis: normalizeLegacyAbilityScore(abilities.wis),
    cha: normalizeLegacyAbilityScore(abilities.cha),
  }
}

function parseHitPointDie(value: string): number {
  const match = value.trim().match(/^\d*d(\d+)$/i)
  return match ? Math.max(2, Number(match[1])) : 8
}

/**
 * One-way boundary from legacy persisted characters into the SRD runtime model.
 * AP, cooldowns, custom class resources, and legacy class features are deliberately ignored.
 */
export function migrateCharacterToDnd5e(inputCharacter: Character): Dnd5eCharacter {
  const character = syncDnd5ePrimalChampion(inputCharacter)
  const classLevels = normalizeDnd5eClassLevels(character)
  const level = dnd5eTotalCharacterLevel(character)
  const hitDieSides = parseHitPointDie(character.hitDice)
  const classDefinition = dnd5eClassDefinitionForCharacter(character)
  const subclassId = classDefinition?.id === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : classDefinition
      ? character.dnd5eClassChoices?.classes?.[classDefinition.id]?.subclass
      : undefined
  const armor = character.equipment?.armor?.dnd5e
  const exhaustionLevel = Math.min(6, Math.max(0, Math.floor(character.exhaustionLevel ?? 0)))
  const maximumReductionLedger =
    normalizeDnd5eHitPointMaximumReductionLedger(
      character.dnd5eCombatState?.hitPointMaximumReductionLedger,
    )
  const storedMaxHp = maximumReductionLedger
    ? Math.max(0, Math.floor(character.maxHp))
    : Math.max(1, Math.floor(character.maxHp))
  const effectiveMaxHp = exhaustionLevel >= 4
    ? Math.max(maximumReductionLedger ? 0 : 1, Math.floor(storedMaxHp / 2))
    : storedMaxHp
  const classSelectionsByClass = Object.fromEntries(Object.keys(classLevels).map((classId) => {
    const typedClassId = classId as Dnd5eClassId
    const selections = Object.fromEntries(Object.entries(character.dnd5eClassChoices?.classes?.[typedClassId]?.selections ?? {})
      .map(([key, values]) => [key, [...values]]))
    if (typedClassId === 'fighter') {
      for (const [key, values] of Object.entries(character.dnd5eClassChoices?.fighter?.extensionChoices ?? {})) {
        selections[key] = [...new Set(values)]
      }
      selections['fighting-style'] = [...fighterSelectedFightingStyles({
        ...character,
        level: dnd5eCharacterClassLevel(character, 'fighter'),
      })]
    }
    return [typedClassId, selections]
  })) as Partial<Record<Dnd5eClassId, Record<string, string[]>>>
  const classSelections: Record<string, string[]> = Object.values(classSelectionsByClass).reduce<Record<string, string[]>>(
    (all, selections) => {
      for (const [key, values] of Object.entries(selections ?? {})) all[key] = [...new Set([...(all[key] ?? []), ...values])]
      return all
    },
    {},
  )
  const buildExpertise = dnd5eCharacterBuildTagsV1(character, 'skill-expertise')
  if (buildExpertise.length > 0) {
    classSelections.expertise = [...new Set([...(classSelections.expertise ?? []), ...buildExpertise])]
  }
  const subclassIds = Object.fromEntries(Object.keys(classLevels).flatMap((classId) => {
    const typedClassId = classId as Dnd5eClassId
    const selected = typedClassId === 'fighter'
      ? character.dnd5eClassChoices?.fighter?.subclass
      : character.dnd5eClassChoices?.classes?.[typedClassId]?.subclass
    return selected ? [[typedClassId, selected]] : []
  })) as Partial<Record<Dnd5eClassId, string>>
  const loreBonusSkills = dnd5eCharacterClassLevel(character, 'bard') >= 3 ? classSelections['lore-bonus-skills'] ?? [] : []
  const beguilingInfluenceSkills = dnd5eCharacterClassLevel(character, 'warlock') >= 2 &&
    classSelections['eldritch-invocations']?.includes('beguiling-influence')
    ? ['deception', 'persuasion']
    : []
  const backgroundSkills = dnd5ePluginBackgroundDefinition(character.dnd5eBackgroundId ?? character.background)
    ?.skillProficiencies ?? character.dnd5eBackgroundSkillProficiencies ?? []
  const raceDefinition = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  const coreRace = dnd5eCoreRaceMechanics(
    character.race,
    raceDefinition?.coreRaceMechanicsId ?? character.dnd5eRaceId,
  )
  const racialRules = dnd5eIndependentSpellRulesForCharacter(character)
  const selectedPluginFeatures = registeredDnd5ePluginFeatures()
    .filter((feature) => dnd5eCharacterHasPluginFeature(character, feature.id))
  const passiveDefenseFeatures = selectedPluginFeatures.filter((feature) =>
    feature.automation !== 'manual' &&
    feature.declarativeAbility?.mechanic?.kind === 'passive-defense')
  const pluginDamageDefenseRules: Dnd5eConditionalDamageDefense[] = passiveDefenseFeatures.flatMap((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (mechanic?.kind !== 'passive-defense' || !mechanic.damageResistance) return []
    return [{
      outcome: 'resistant' as const,
      damageTypes: [...mechanic.damageResistance.damageTypes],
      delivery: mechanic.damageResistance.delivery,
      magical: mechanic.damageResistance.magical,
      reason: feature.id,
    }]
  })
  const staticModifiers = [
    ...(coreRace?.staticModifiers ? [coreRace.staticModifiers] : []),
    ...(raceDefinition?.staticModifiers ? [raceDefinition.staticModifiers] : []),
    ...selectedPluginFeatures.flatMap((feature) => feature.staticModifiers ? [feature.staticModifiers] : []),
  ]
  const pluginDamageResistances = normalizedDamageTypes(
    staticModifiers.flatMap((modifier) => modifier.damageResistances ?? []),
  ) ?? []
  if (racialRules.dragonbornAncestry) {
    pluginDamageResistances.push(racialRules.dragonbornAncestry.damageType)
  }
  const pluginDamageImmunities = normalizedDamageTypes(
    staticModifiers.flatMap((modifier) => modifier.damageImmunities ?? []),
  ) ?? []
  const inventory = normalizeDnd5eInventory(character)
  const wearingWardingBondRing = inventory.entries.some((entry) =>
    entry.quantity > 0 &&
    entry.identified !== false &&
    entry.equippedSlot != null &&
    entry.item.spellcastingMaterial?.tags.includes('platinum-ring') === true &&
    (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 50,
  )
  const baseAbilities = character.rulesetId
    ? { ...character.abilities }
    : normalizeLegacyAbilities(character.abilities)
  const abilityScoreReductionLedger = character.dnd5eCombatState?.abilityScoreReductionLedger ?? []
  const effectiveAbilities = Object.fromEntries(
    (Object.keys(baseAbilities) as AbilityKey[]).map((ability) => [
      ability,
      Math.max(0, baseAbilities[ability] - abilityScoreReductionLedger.reduce(
        (sum, entry) => sum + (entry.ability === ability ? Math.max(0, Math.floor(entry.amount)) : 0),
        0,
      )),
    ]),
  ) as Record<AbilityKey, number>
  const armorEntry = inventory.entries.find((entry) =>
    entry.equippedSlot === 'armor' && entry.item.equipment?.dnd5e?.kind === 'armor')
  const equippedArmorDefinition = armorEntry?.item.equipment?.dnd5e
  const armorClassPenalty = Math.max(0, Math.floor(armorEntry?.condition?.armorClassPenalty ?? 0))
  const armorDestroyed = armorEntry?.condition?.destroyed === true
  const wornArmorCategory = armorDestroyed
    ? undefined
    : equippedArmorDefinition?.kind === 'armor'
      ? equippedArmorDefinition.category
      : armor?.kind === 'armor'
        ? armor.category
        : undefined
  const mediumArmorDexterityCapBonus = wornArmorCategory === 'medium'
    ? Math.min(
        staticModifierMaximum(staticModifiers, 'mediumArmorDexterityCapBonus'),
        Math.max(0, rules.abilityModifier(character.abilities.dex) - 2),
      )
    : 0
  const dualWieldMeleeArmorClassBonus =
    character.equipment?.mainWeapon?.dnd5e?.kind === 'weapon' &&
    character.equipment.mainWeapon.dnd5e.mode === 'melee' &&
    character.equipment?.offHand?.dnd5e?.kind === 'weapon' &&
    character.equipment.offHand.dnd5e.mode === 'melee'
      ? staticModifierMaximum(staticModifiers, 'dualWieldMeleeArmorClassBonus')
      : 0
  const unarmoredArmorClass = dnd5eArmorClass({
    ...character,
    equipment: { ...character.equipment, armor: undefined },
  })
  const equippedArmor = armorEntry && equippedArmorDefinition?.kind === 'armor'
    ? {
        instanceId: armorEntry.instanceId,
        equipmentId: armorEntry.item.equipment!.id,
        magical: armorEntry.item.magicItem != null,
        metal: equippedArmorDefinition.material === 'metal' ||
          (equippedArmorDefinition.material == null && equippedArmorDefinition.category === 'heavy'),
        baseProvidedArmorClass: equippedArmorDefinition.baseArmorClass,
        armorClassPenalty,
        unarmoredArmorClass,
        destroyed: armorDestroyed,
      }
    : undefined
  const activitySpellcasting = dnd5eBaseSpellcastingCapabilityV1(character)
  const activeHitPointMaximumBonus = dnd5eActiveHitPointMaximumBonus(
    character.dnd5eCombatState?.activeEffects,
  )
  const currentHitPoints = exhaustionLevel >= 6
    ? 0
    : Math.max(0, Math.min(effectiveMaxHp + activeHitPointMaximumBonus, character.currentHp))
  const deathSaveSuccesses = currentHitPoints === 0
    ? Math.max(0, Math.min(3, Math.floor(character.deathSaveSuccesses ?? 0)))
    : 0
  const deathSaveFailures = currentHitPoints === 0
    ? Math.max(0, Math.min(3, Math.floor(character.deathSaveFailures ?? 0)))
    : 0
  return {
    id: character.id,
    name: character.name,
    player: character.player,
    race: character.race,
    raceId: character.dnd5eRaceId,
    level,
    abilities: effectiveAbilities,
    savingThrowProficiencies: [...dnd5eEffectiveSavingThrowProficiencies(character)],
    skillProficiencies: [...new Set([
      ...character.skills,
      ...backgroundSkills,
      ...(coreRace?.skillProficiencies ?? []),
      ...(raceDefinition?.skillProficiencies ?? []),
      ...loreBonusSkills,
      ...beguilingInfluenceSkills,
    ])],
    passivePerception: Math.max(0, Math.floor(character.passivePerception) +
      staticModifierTotal(staticModifiers, 'passivePerceptionBonus')),
    passiveInvestigation: Math.max(0, 10 + dnd5eSkillCheckModifier(character, 'investigation') +
      staticModifierTotal(staticModifiers, 'passiveInvestigationBonus')),
    saveDc: Number.isInteger(character.saveDC) && character.saveDC >= 1 && character.saveDC <= 100
      ? character.saveDC
      : undefined,
    armorClass: (armorDestroyed
      ? unarmoredArmorClass
      : Math.max(0, dnd5eArmorClass(character) - armorClassPenalty)) +
      staticModifierTotal(staticModifiers, 'armorClassBonus') + mediumArmorDexterityCapBonus +
      dualWieldMeleeArmorClassBonus,
    currentHp: currentHitPoints,
    maxHp: effectiveMaxHp,
    temporaryHp: Math.max(0, Math.floor(character.tempHp)),
    exhaustionLevel,
    speed: Math.max(0, dnd5eWalkingSpeed(character) + staticModifierTotal(staticModifiers, 'speedBonusFeet')),
    movementSpeeds: {
      walk: Math.max(0, dnd5eWalkingSpeed(character) + staticModifierTotal(staticModifiers, 'speedBonusFeet')),
      climb: character.dnd5eMovementSpeeds?.climb,
      swim: character.dnd5eMovementSpeeds?.swim,
      fly: character.dnd5eMovementSpeeds?.fly,
      hover: character.dnd5eMovementSpeeds?.hover,
    },
    initiativeBonus: Math.floor(character.initiativeBonus) + staticModifierTotal(staticModifiers, 'initiativeBonus'),
    hitPointDice: character.hitPointDice?.length
      ? character.hitPointDice.map((pool) => ({ ...pool }))
      : [{ sides: hitDieSides, current: level, max: level }],
    deathSaves: {
      successes: deathSaveSuccesses,
      failures: deathSaveFailures,
      stable: currentHitPoints === 0 && deathSaveFailures < 3 && character.deathSaveStable === true,
      dead: currentHitPoints === 0 && deathSaveFailures >= 3,
    },
    concentrating: character.concentrating ?? false,
    inspiration: character.inspiration > 0,
    conditions: [...character.conditions],
    classResources: dnd5eClassResources(character),
    inventoryHeadlessEffects: dnd5eInventoryHeadlessEffectSnapshots(character),
    inventoryMagicItems: inventory.entries.flatMap((entry) =>
      entry.quantity > 0 && entry.item.magicItem && entry.planarState !== 'ethereal'
        ? [{
            instanceId: entry.instanceId,
            templateId: entry.templateId,
            displayName: entry.identified === false ? '未鉴定魔法物品' : entry.item.name,
            equippedSlot: entry.equippedSlot,
            containerInstanceId: entry.containerInstanceId,
          }]
        : []),
    inventoryReactionSpells: dnd5eInventoryReactionSpellSnapshots(character),
    pluginFeaturePassiveEffects: dnd5ePluginFeaturePassiveEffectSnapshots(selectedPluginFeatures),
    inventoryRevision: inventory.revision ?? 0,
    classId: classDefinition?.id,
    subclassId,
    classLevels,
    subclassIds,
    classSelections,
    classSelectionsByClass,
    pluginFeatureIds: selectedPluginFeatures.map((feature) => feature.id),
    sizeRank: dnd5eRaceSizeRank(
      character.race,
      character.dnd5eRaceId,
      raceDefinition?.size ?? coreRace?.size,
    ),
    darkvisionRangeFeet: Math.max(
      0,
      ...staticModifiers.map((modifier) => modifier.darkvisionRangeFeet ?? 0),
    ) || undefined,
    racialSavingThrowAdvantages: mergeDnd5eRacialSavingThrowAdvantages(
      coreRace?.savingThrowAdvantages,
      raceDefinition?.savingThrowAdvantages,
    ),
    racialRules,
    damageResistances: [...new Set(pluginDamageResistances)],
    damageDefenseRules: pluginDamageDefenseRules,
    damageImmunities: [...new Set(pluginDamageImmunities)],
    elementalAdeptDamageTypes: normalizedDamageTypes(
      dnd5eCharacterBuildTagsV1(character, 'elemental-adept.damage-type'),
    ),
    spellSavingThrowAdvantage: passiveDefenseFeatures.some((feature) =>
      feature.declarativeAbility?.mechanic?.kind === 'passive-defense' &&
      feature.declarativeAbility.mechanic.savingThrowAdvantageAgainstSpells === true),
    spellSavingThrowAdvantageWithinFeet: staticModifierMaximum(
      staticModifiers,
      'spellSavingThrowAdvantageWithinFeet',
    ) || undefined,
    imposeConcentrationCheckDisadvantageOnDamage: staticModifierEnabled(
      staticModifiers,
      'imposeConcentrationCheckDisadvantageOnDamage',
    ),
    meleeWeaponDamageRerollOncePerTurn: staticModifierEnabled(
      staticModifiers,
      'meleeWeaponDamageRerollOncePerTurn',
    ),
    shieldDexteritySaveBonusWhenSoleTarget: staticModifierEnabled(
      staticModifiers,
      'shieldDexteritySaveBonusWhenSoleTarget',
    ),
    shieldSuccessfulDexteritySaveNegatesDamage: staticModifierEnabled(
      staticModifiers,
      'shieldSuccessfulDexteritySaveNegatesDamage',
    ),
    combatManeuverDieSidesOverride: combatManeuverDieSidesOverride(staticModifiers),
    opportunityAttackSpellReplacement: staticModifierEnabled(
      staticModifiers,
      'opportunityAttackSpellReplacement',
    ),
    hitPointMaximumReductionImmunity: passiveDefenseFeatures.some((feature) =>
      feature.declarativeAbility?.mechanic?.kind === 'passive-defense' &&
      feature.declarativeAbility.mechanic.hitPointMaximumReductionImmunity === true),
    cannotBeSurprisedWhileConscious: staticModifierEnabled(staticModifiers, 'cannotBeSurprisedWhileConscious'),
    unseenAttackersDoNotGainAdvantage: staticModifierEnabled(staticModifiers, 'unseenAttackersDoNotGainAdvantage'),
    ignoreLongRangeRangedWeaponDisadvantage: staticModifierEnabled(staticModifiers, 'ignoreLongRangeRangedWeaponDisadvantage'),
    ignoreNearbyHostileRangedAttackDisadvantage: staticModifierEnabled(staticModifiers, 'ignoreNearbyHostileRangedAttackDisadvantage'),
    ignoreLoadingWeaponProperty: staticModifierEnabled(staticModifiers, 'ignoreLoadingWeaponProperty'),
    mountedMeleeAdvantageAgainstSmallerUnmounted: staticModifierEnabled(
      staticModifiers,
      'mountedMeleeAdvantageAgainstSmallerUnmounted',
    ),
    redirectMountedCreatureAttacksToRider: staticModifierEnabled(
      staticModifiers,
      'redirectMountedCreatureAttacksToRider',
    ),
    grantMountedCreatureDexterityEvasion: staticModifierEnabled(
      staticModifiers,
      'grantMountedCreatureDexterityEvasion',
    ),
    ignoreRangedWeaponCoverBonus: staticModifierEnabled(staticModifiers, 'ignoreRangedWeaponCoverBonus'),
    preventOpportunityAttacksFromMeleeAttackTargets: staticModifierEnabled(
      staticModifiers,
      'preventOpportunityAttacksFromMeleeAttackTargets',
    ),
    opportunityAttacksIgnoreDisengage: staticModifierEnabled(
      staticModifiers,
      'opportunityAttacksIgnoreDisengage',
    ),
    opportunityAttackHitStopsMovement: staticModifierEnabled(
      staticModifiers,
      'opportunityAttackHitStopsMovement',
    ),
    opportunityAttacksOnEnterReachWeaponIds: [...new Set(
      staticModifiers.flatMap((modifier) => modifier.opportunityAttacksOnEnterReachWeaponIds ?? []),
    )],
    ignoreDifficultTerrainWhileDashing: staticModifierEnabled(
      staticModifiers,
      'ignoreDifficultTerrainWhileDashing',
    ),
    climbWithoutSpeedCostMultiplier: staticModifierMinimum(
      staticModifiers,
      'climbWithoutSpeedCostMultiplier',
    ),
    runningJumpMinimumApproachFeet: staticModifierMinimum(
      staticModifiers,
      'runningJumpMinimumApproachFeet',
    ),
    standFromProneMovementCostFeet: staticModifierMinimum(
      staticModifiers,
      'standFromProneMovementCostFeet',
    ),
    spellAttackRangeMultiplier: Math.max(1, staticModifierMaximum(staticModifiers, 'spellAttackRangeMultiplier')),
    ignoreSpellAttackCoverBonus: staticModifierEnabled(staticModifiers, 'ignoreSpellAttackCoverBonus'),
    retainHiddenOnRangedWeaponMiss: staticModifierEnabled(staticModifiers, 'retainHiddenOnRangedWeaponMiss'),
    conditionImmunities: [...new Set([
      ...staticModifiers.flatMap((modifier) => modifier.conditionImmunities ?? []),
      ...passiveDefenseFeatures.flatMap((feature) => {
        const mechanic = feature.declarativeAbility?.mechanic
        return mechanic?.kind === 'passive-defense' ? mechanic.conditionImmunities ?? [] : []
      }),
    ])],
    wearingArmor: !armorDestroyed && (armor?.kind === 'armor' || !!character.equipment?.armor),
    wearingUnproficientArmor: dnd5eWearingUnproficientArmor(character),
    armorStealthDisadvantage: dnd5eArmorImposesStealthDisadvantage(character) && !(
      wornArmorCategory === 'medium' && staticModifierEnabled(staticModifiers, 'ignoreMediumArmorStealthDisadvantage')
    ),
    wearingHeavyArmor: !armorDestroyed && armor?.kind === 'armor' && armor.category === 'heavy',
    wearingMetalArmor: !armorDestroyed && armor?.kind === 'armor' && (
      armor.material === 'metal' || (armor.material == null && armor.category === 'heavy')
    ),
    equippedArmor,
    hasShield: character.equipment?.offHand?.dnd5e?.kind === 'shield',
    activityEquipment: activityEquipmentSnapshot(character, wornArmorCategory ?? 'none'),
    activitySpellcasting: {
      capable: activitySpellcasting.capable || racialRules.innateSpells.length > 0,
      classIds: activitySpellcasting.classIds,
    },
    classState: {
      ...character.dnd5eCombatState,
      wardingBondMaterialEquipped: wearingWardingBondRing,
      wardingBondParticipantCharacterId: character.id,
    },
    savingThrowEquipmentBonus: dnd5eEquippedEffectTotal(character, 'savingThrowBonus'),
    savingThrowPluginBonus: staticModifierTotal(staticModifiers, 'savingThrowBonus'),
  }
}

export function dnd5eInitiativeModifier(character: Dnd5eCharacter): number {
  return rules.abilityModifier(character.abilities.dex) + character.initiativeBonus
}

export function createCombatantFromDnd5eCharacter(input: {
  character: Dnd5eCharacter
  controller: 'dm' | 'player'
  initiativeD20: number
  position: { x: number; y: number }
}): Dnd5eCombatant {
  const { character } = input
  const abilityKeys: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const initiative = rules.resolveD20({ rolls: [input.initiativeD20], modifier: dnd5eInitiativeModifier(character) }).total
  const savingThrowBonuses = Object.fromEntries(abilityKeys.map((ability) => [
    ability,
    rules.abilityModifier(character.abilities[ability]) +
      (character.savingThrowProficiencies.includes(ability) ? rules.proficiencyBonus(character.level) : 0) +
      (character.savingThrowEquipmentBonus ?? 0) +
      (character.savingThrowPluginBonus ?? 0),
  ]))
  // `migrateCharacterToDnd5e` projects persisted ability reductions into the
  // effective character abilities used by sheets and simulation previews.
  // Do not feed the same ledger into `createDnd5eCombatant` until after its
  // construction, otherwise the generic persistence boundary would subtract
  // every reduction a second time on map reconnect.
  const persistedAbilityScoreReductions = character.classState.abilityScoreReductionLedger
    ?.map((entry) => ({ ...entry }))
  const combatant = createDnd5eCombatant({
    id: character.id,
    name: character.name,
    level: character.level,
    controller: input.controller,
    initiative,
    abilities: { ...character.abilities },
    baseSavingThrowBonuses: savingThrowBonuses,
    savingThrowBonuses,
    savingThrowProficiencies: [...character.savingThrowProficiencies],
    skillProficiencies: [...character.skillProficiencies],
    passivePerception: character.passivePerception,
    passiveInvestigation: character.passiveInvestigation,
    saveDc: character.saveDc,
    proficiencyBonus: rules.proficiencyBonus(character.level),
    sizeRank: character.sizeRank,
    armorClass: character.armorClass,
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    temporaryHp: character.temporaryHp,
    exhaustionLevel: character.exhaustionLevel,
    speed: character.speed,
    movementSpeeds: character.movementSpeeds ? { ...character.movementSpeeds } : undefined,
    darkvisionRangeFeet: character.darkvisionRangeFeet,
    racialSavingThrowAdvantages: character.racialSavingThrowAdvantages
      ? structuredClone(character.racialSavingThrowAdvantages)
      : undefined,
    racialRules: structuredClone(character.racialRules),
    position: { ...input.position },
    concentrating: character.concentrating,
    creatureType: '类人生物',
    race: character.race,
    raceId: character.raceId,
    classResources: character.classResources,
    inventoryHeadlessEffects: character.inventoryHeadlessEffects,
    inventoryMagicItems: character.inventoryMagicItems,
    inventoryReactionSpells: character.inventoryReactionSpells,
    pluginFeaturePassiveEffects: character.pluginFeaturePassiveEffects,
    inventoryRevision: character.inventoryRevision,
    classId: character.classId,
    subclassId: character.subclassId,
    classLevels: character.classLevels,
    subclassIds: character.subclassIds,
    classSelections: character.classSelections,
    classSelectionsByClass: character.classSelectionsByClass,
    pluginFeatureIds: character.pluginFeatureIds,
    wearingArmor: character.wearingArmor,
    wearingUnproficientArmor: character.wearingUnproficientArmor,
    armorStealthDisadvantage: character.armorStealthDisadvantage,
    wearingHeavyArmor: character.wearingHeavyArmor,
    wearingMetalArmor: character.wearingMetalArmor,
    equippedArmor: character.equippedArmor ? { ...character.equippedArmor } : undefined,
    hasShield: character.hasShield,
    activityEquipment: structuredClone(character.activityEquipment),
    activitySpellcasting: {
      ...character.activitySpellcasting,
      classIds: [...character.activitySpellcasting.classIds],
    },
    damageResistances: character.damageResistances,
    damageDefenseRules: character.damageDefenseRules,
    damageImmunities: character.damageImmunities,
    elementalAdeptDamageTypes: character.elementalAdeptDamageTypes,
    spellSavingThrowAdvantage: character.spellSavingThrowAdvantage,
    spellSavingThrowAdvantageWithinFeet: character.spellSavingThrowAdvantageWithinFeet,
    imposeConcentrationCheckDisadvantageOnDamage: character.imposeConcentrationCheckDisadvantageOnDamage,
    meleeWeaponDamageRerollOncePerTurn: character.meleeWeaponDamageRerollOncePerTurn,
    shieldDexteritySaveBonusWhenSoleTarget: character.shieldDexteritySaveBonusWhenSoleTarget,
    shieldSuccessfulDexteritySaveNegatesDamage: character.shieldSuccessfulDexteritySaveNegatesDamage,
    combatManeuverDieSidesOverride: character.combatManeuverDieSidesOverride,
    opportunityAttackSpellReplacement: character.opportunityAttackSpellReplacement,
    hitPointMaximumReductionImmunity: character.hitPointMaximumReductionImmunity,
    cannotBeSurprisedWhileConscious: character.cannotBeSurprisedWhileConscious,
    unseenAttackersDoNotGainAdvantage: character.unseenAttackersDoNotGainAdvantage,
    ignoreLongRangeRangedWeaponDisadvantage: character.ignoreLongRangeRangedWeaponDisadvantage,
    ignoreNearbyHostileRangedAttackDisadvantage: character.ignoreNearbyHostileRangedAttackDisadvantage,
    ignoreLoadingWeaponProperty: character.ignoreLoadingWeaponProperty,
    mountedMeleeAdvantageAgainstSmallerUnmounted: character.mountedMeleeAdvantageAgainstSmallerUnmounted,
    redirectMountedCreatureAttacksToRider: character.redirectMountedCreatureAttacksToRider,
    grantMountedCreatureDexterityEvasion: character.grantMountedCreatureDexterityEvasion,
    ignoreRangedWeaponCoverBonus: character.ignoreRangedWeaponCoverBonus,
    preventOpportunityAttacksFromMeleeAttackTargets: character.preventOpportunityAttacksFromMeleeAttackTargets,
    opportunityAttacksIgnoreDisengage: character.opportunityAttacksIgnoreDisengage,
    opportunityAttackHitStopsMovement: character.opportunityAttackHitStopsMovement,
    opportunityAttacksOnEnterReachWeaponIds: character.opportunityAttacksOnEnterReachWeaponIds,
    ignoreDifficultTerrainWhileDashing: character.ignoreDifficultTerrainWhileDashing,
    climbWithoutSpeedCostMultiplier: character.climbWithoutSpeedCostMultiplier,
    runningJumpMinimumApproachFeet: character.runningJumpMinimumApproachFeet,
    standFromProneMovementCostFeet: character.standFromProneMovementCostFeet,
    spellAttackRangeMultiplier: character.spellAttackRangeMultiplier,
    ignoreSpellAttackCoverBonus: character.ignoreSpellAttackCoverBonus,
    retainHiddenOnRangedWeaponMiss: character.retainHiddenOnRangedWeaponMiss,
    conditionImmunities: character.conditionImmunities,
    classState: {
      ...character.classState,
      abilityScoreReductionLedger: undefined,
      wildShapeOriginalDamageVulnerabilities: normalizedDamageTypes(character.classState.wildShapeOriginalDamageVulnerabilities),
      wildShapeOriginalDamageResistances: normalizedDamageTypes(character.classState.wildShapeOriginalDamageResistances),
      wildShapeOriginalDamageImmunities: normalizedDamageTypes(character.classState.wildShapeOriginalDamageImmunities),
      wildShapeOriginalDamageDefenseRules: character.classState.wildShapeOriginalDamageDefenseRules
        ?.map((defense) => ({
          ...defense,
          damageTypes: normalizedDamageTypes(defense.damageTypes) ?? [],
        })),
      wildShapeOriginalLimitedMagicImmunity: character.classState.wildShapeOriginalLimitedMagicImmunity
        ? { ...character.classState.wildShapeOriginalLimitedMagicImmunity }
        : undefined,
    },
    conditions: character.conditions,
  })
  combatant.classState.abilityScoreReductionLedger = persistedAbilityScoreReductions?.length
    ? persistedAbilityScoreReductions
    : undefined
  if (
    combatant.concentrating && combatant.classState.huntersMarkTargetId &&
    !combatant.classState.concentrationSpellId
  ) {
    combatant.classState.concentrationSpellId = 'hunters-mark'
    combatant.classState.concentrationTargetIds = [combatant.classState.huntersMarkTargetId]
    combatant.classState.concentrationRoundsRemaining = 600
  }
  hydrateDnd5eWildShapeCombatant(combatant)
  return { ...combatant, deathSaves: { ...character.deathSaves } }
}
