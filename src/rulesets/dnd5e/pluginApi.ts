import type { ClassResourceReset } from '../../lib/classDefinitionTypes'
import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import {
  registerFighterSubclassDefinition,
  type FighterFeatureDefinition,
  type FighterSubclassChoiceGroup,
  type FighterSubclassDefinition,
} from './fighter'
import type {
  Dnd5eCombatant,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  DND5E_2014_BACKGROUND_OPTIONS,
  DND5E_2014_CLASS_OPTIONS,
  DND5E_2014_RACE_OPTIONS,
} from './characterOptions'
import { DND5E_STANDARD_CONDITION_IDS } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import {
  cloneDnd5ePluginFeaturePassiveEffects,
  type Dnd5ePluginFeaturePassiveEffect,
} from './pluginFeaturePassiveEffectProtocol'
export type { Dnd5ePluginFeaturePassiveEffect } from './pluginFeaturePassiveEffectProtocol'
import type { EquipmentItem, EquipmentSlot } from '../../types/equipment'
import type { Dnd5eInventoryItemTemplate } from '../../types/inventory'
import type {
  Dnd5ePersistentAreaTriggerDeclaration,
} from './persistentAreaTypes'
import {
  DND5E_DECLARATIVE_DURATION_MAX_ROUNDS,
  DND5E_DECLARATIVE_LABEL_MAX_LENGTH,
  normalizeDnd5ePersistentAreaVisual,
} from './persistentAreaTypes'
import { validateDnd5eWorkshopDamageFormulaV1 } from './workshopDamageFormula'
import { dnd5eAttacksPerAttackAction, dnd5eDruidWildShapeLimits, type Dnd5eClassId } from './classes'
import type { Dnd5eMonsterStatBlock } from './monsters'
import { dnd5eChallengeRatingValue } from './wildShape'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'
import { registerDnd5ePluginMonsterCatalogEntry } from './roomMonsterCatalog'
import { dnd5eCharacterClassLevel } from './classLevels'
import { dnd5ePluginSubclassRegistry as pluginSubclasses } from './pluginSubclassRegistry'
import {
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  parseDnd5eSpellImport,
  type Dnd5eImportedSpell,
  type Dnd5eSpellbookSchoolId,
} from './spellbook'
import {
  declarativeAbilityCompatibilityV1,
  declarativeSubclassCompatibilityReportV1,
  declarativeSubclassResourceDieSidesV1,
  validateDeclarativeSubclassAbilityV1,
  validateDeclarativeSubclassDefinitionV1,
  validateDeclarativeSubclassSpellListsV1,
  type DeclarativeSubclassCombatHookV1,
  type DeclarativeCombatManeuverMechanicV1,
  type DeclarativeAttackTradeoffMechanicV1,
  type DeclarativeDiceFormulaV1,
  type DeclarativeSubclassAbilityV1,
  type DeclarativeSubclassDefinitionV1,
  type DeclarativeSubclassSpellListV1,
  type DeclarativeValueFormulaV1,
} from './declarativeSubclassAbility'
import { dnd5ePluginImageAsset } from './pluginAssets'
import {
  registerDeclarativeClassV1,
  validateDeclarativeClassDefinitionV1,
  type DeclarativeClassDefinitionV1,
} from './declarativeClass'
import {
  DND5E_POST_D20_ADJUSTMENT_ROLL_ID,
  DND5E_RULES_PLUGIN_API_VERSION,
  DND5E_RULES_PLUGIN_RULESET_ID,
  type Dnd5eRulesPluginManifest,
  type Dnd5eRulesPluginStateMigration,
} from './plugins/pluginManifestContracts'
import {
  validateDnd5eAdvancementCollectionV1,
  validateDnd5eAdvancementDefinitionV1,
  type Dnd5eAdvancementDefinitionV1,
} from './activities/dnd5eAdvancementContracts'
import { validateDnd5eRulesPluginManifest } from './plugins/pluginManifestValidation'
import { registerDnd5eMechanicHandlerV1 } from './plugins/pluginMechanicsRegistry'
import {
  normalizeDnd5ePluginPersistentAreaVerticalDeclaration,
  type Dnd5ePluginAutomationLevel,
  type Dnd5ePluginFeatureAction,
  type Dnd5ePluginFeatPrerequisite,
  type Dnd5ePluginPersistentAreaVerticalDeclaration,
  type Dnd5ePluginStaticCombatModifiers,
  type Dnd5ePluginTargeting,
} from './plugins/pluginMechanicsContracts'
export * from './plugins/pluginMechanicsContracts'
import type {
  Dnd5ePluginAction,
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginHeadlessActionDefinition,
  Dnd5ePluginInterruptDeclaration,
} from './plugins/pluginHeadlessContracts'
export type {
  Dnd5ePluginAction,
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginDiceRollResult,
  Dnd5ePluginHeadlessActionContext,
  Dnd5ePluginHeadlessActionDefinition,
  Dnd5ePluginInterruptDeclaration,
  Dnd5ePluginInterruptOption,
  Dnd5ePluginPerTargetDiceRollDeclaration,
} from './plugins/pluginHeadlessContracts'
export {
  DND5E_POST_D20_ADJUSTMENT_ROLL_ID,
  DND5E_RULES_PLUGIN_API_VERSION,
  DND5E_RULES_PLUGIN_RULESET_ID,
  DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS,
} from './plugins/pluginManifestContracts'
export type {
  Dnd5ePluginContentCategory,
  Dnd5ePluginDeclaredCapability,
  Dnd5ePluginDependency,
  Dnd5ePluginDistributionPolicy,
  Dnd5ePluginKind,
  Dnd5eRulesPluginApiVersion,
  Dnd5eRulesPluginManifest,
  Dnd5eRulesPluginRequirement,
  Dnd5eRulesPluginStateMigration,
  JsonValue,
} from './plugins/pluginManifestContracts'
import {
  dnd5ePluginRegistryStore,
  type Dnd5eRulesPluginRuntimeAdapterKind,
  type RegisteredDnd5ePluginRuntime,
} from './plugins/pluginRegistryStore'
import type {
  RegisteredDnd5ePluginAbilityGeneration,
  RegisteredDnd5ePluginBackground,
  RegisteredDnd5ePluginFeat,
  RegisteredDnd5ePluginFeature,
  RegisteredDnd5ePluginMonster,
  RegisteredDnd5ePluginRace,
  RegisteredDnd5ePluginResource,
  RegisteredDnd5ePluginSpell,
  RegisteredDnd5ePluginSubclass,
} from './plugins/pluginRegistryContracts'
import { clonePluginItemDefinition } from './plugins/pluginItemDefinition'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeatureAvailableForCharacter, dnd5ePluginSubclassChoiceLimit, registeredDnd5ePluginFeatures } from './plugins/pluginContentCatalog'
export * from './plugins/pluginContentCatalog'
export type {
  RegisteredDnd5ePluginAbilityGeneration,
  RegisteredDnd5ePluginBackground,
  RegisteredDnd5ePluginFeat,
  RegisteredDnd5ePluginFeature,
  RegisteredDnd5ePluginItem,
  RegisteredDnd5ePluginMonster,
  RegisteredDnd5ePluginRace,
  RegisteredDnd5ePluginResource,
  RegisteredDnd5ePluginSpell,
  RegisteredDnd5ePluginSubclass,
} from './plugins/pluginRegistryContracts'
import {
  createDeclarativeFeatureResolver as declarativeFeatureResolver,
  declarativeDiceCount,
  declarativeResourceMaximumByLevel,
  declarativeTargeting,
  dnd5eDeclarativeResourceKey,
} from './plugins/pluginDeclarativeCompiler'
import { dnd5eActivityFromDeclarativeSubclassAbility } from './activities/legacyContentActivityAdapters'
export { dnd5eDeclarativeResourceKey } from './plugins/pluginDeclarativeCompiler'
export {
  activeDnd5eRulesPluginRequirements,
  missingDnd5eRulesPluginRequirements,
  roomActiveDnd5eRulesPluginRequirements,
  roomDistributableDnd5eRulesPluginRequirements,
} from './plugins/pluginRequirementProjection'
export { dnd5ePluginHeadlessActionDefinition } from './plugins/pluginHeadlessRuntimeRegistry'
export { validateDnd5eRulesPluginManifest } from './plugins/pluginManifestValidation'
export {
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5eRulesPluginRuntimeIndex,
  registeredDnd5eRulesPlugins,
  subscribeDnd5eRulesPluginRegistry,
  unregisterDnd5eRulesPlugin,
} from './plugins/pluginRuntimeIndex'

export interface Dnd5ePluginFighterResource {
  id: string
  label: string
  shortLabel?: string
  minLevel?: number
  isAvailable?: (character: Character) => boolean
  max(character: Character): number
  resetOn: ClassResourceReset
}

export interface Dnd5ePluginFighterSubclass {
  id: string
  name: string
  summary: string
  sourceLabel?: string
  features: readonly Omit<FighterFeatureDefinition, 'source'>[]
  choiceGroups?: readonly FighterSubclassChoiceGroup[]
  resources?: readonly Dnd5ePluginFighterResource[]
  fightingStyleSelectionLimit?: (character: Character) => number
}

/** 插件声明持续时间的 capability 输入；Host 会转换为 ActiveEffectInstance。 */
export type { Dnd5ePluginEffectDuration } from './persistentAreaTypes'

export interface Dnd5ePluginFeatureDefinition {
  id: string
  name: string
  summary: string
  description: string
  sourceLabel?: string
  iconAssetId?: string
  minimumLevel?: number
  automation: Dnd5ePluginAutomationLevel
  /** Host-owned passive projection applied when the character owns this feature. */
  staticModifiers?: Dnd5ePluginStaticCombatModifiers
  /** Host-owned event effects applied from the immutable combat snapshot. */
  passiveEffects?: readonly Dnd5ePluginFeaturePassiveEffect[]
  /** Whether this feature may submit a replacement for a successful enemy d20 result. */
  canModifyEnemyD20?: boolean
  /** 返回 false 时人物卡不能选择，Headless 也会拒绝该特性。 */
  isAvailable?: (character: Character) => boolean
  action?: Dnd5ePluginFeatureAction
  /** 仅由 registerSubclass 生成；Host 会复核角色所选子职。 */
  sourceClassId?: Dnd5eClassId
  sourceSubclassId?: string
  grantedBySubclass?: boolean
  /** Host-only markers populated by registerFeat. */
  sourceFeatId?: string
  grantedByFeat?: boolean
  /** Set only by the Host compiler for pure declarative packages. */
  declarativeAbility?: DeclarativeSubclassAbilityV1
  automationReasons?: readonly string[]
}

export interface Dnd5ePluginResourceDefinition {
  id: string
  label: string
  shortLabel?: string
  classId: Dnd5eClassId
  subclassId?: string
  minimumLevel?: number
  /** 每级最大值表；数组不足 20 项时沿用最后一个值。 */
  maximum: number | readonly number[]
  resetOn: ClassResourceReset
}

export interface Dnd5ePluginSubclassChoiceGroup {
  id: string
  level: number
  name: string
  description?: string
  maxSelections: number
  maxSelectionsByLevel?: readonly { level: number; maxSelections: number }[]
  options: readonly { id: string; name: string; summary: string }[]
}

export interface Dnd5ePluginSubclassFeature {
  id: string
  level: number
  name: string
  description: string
  automation?: Dnd5ePluginAutomationLevel
  canModifyEnemyD20?: boolean
  action?: Dnd5ePluginFeatureAction
  declarativeAbility?: DeclarativeSubclassAbilityV1
  automationReasons?: readonly string[]
}

export interface Dnd5ePluginSubclassDefinition {
  id: string
  classId: Dnd5eClassId
  name: string
  summary: string
  features: readonly Dnd5ePluginSubclassFeature[]
  choiceGroups?: readonly Dnd5ePluginSubclassChoiceGroup[]
  spellLists?: readonly DeclarativeSubclassSpellListV1[]
  /** Generic character-building grants and choices applied at subclass levels. */
  advancements?: readonly Dnd5eAdvancementDefinitionV1[]
}

export interface Dnd5ePluginFlexibleAbilityBonus {
  count: number
  amount: number
  exclude?: readonly AbilityKey[]
}

export interface Dnd5ePluginRacialSavingThrowAdvantages {
  /** Advantage when the saving throw is explicitly associated with one of these conditions. */
  conditions?: readonly string[]
  /** Advantage when the saving throw is explicitly associated with one of these damage types. */
  damageTypes?: readonly Dnd5eDamageType[]
  /** Ability saves that gain advantage against spells or other magical effects. */
  magicAbilities?: readonly AbilityKey[]
}

export type Dnd5ePluginCoreRaceMechanicsId =
  | 'dwarf'
  | 'elf'
  | 'halfling'
  | 'human'
  | 'dragonborn'
  | 'gnome'
  | 'half-elf'
  | 'half-orc'
  | 'tiefling'

export interface Dnd5ePluginRacialInnateSpellGrant {
  spellId: string
  minimumLevel: number
  ability: AbilityKey
  castAtLevel: number
  resetOn: 'at-will' | 'long-rest'
}

export interface Dnd5ePluginRaceDefinition {
  id: string
  name: string
  description?: string
  iconAssetId?: string
  /** Display-only ancestry link. A subrace remains a complete standalone rules entry. */
  parentRace?: { id: string; name: string }
  /** Reuse only the public SRD base ancestry mechanics; all variant data remains in this package. */
  coreRaceMechanicsId?: Dnd5ePluginCoreRaceMechanicsId
  size?: 'small' | 'medium'
  speedFeet: number
  abilityBonuses?: Partial<Record<AbilityKey, number>>
  flexibleAbilityBonus?: Dnd5ePluginFlexibleAbilityBonus
  skillProficiencies?: readonly string[]
  skillProficiencyChoiceCount?: number
  armorProficiencies?: readonly ('light' | 'medium' | 'heavy' | 'shield')[]
  weaponProficiencies?: readonly string[]
  toolProficiencies?: readonly string[]
  languages?: readonly string[]
  /** Local feature IDs are namespaced by the Host and automatically granted by this race. */
  grantedFeatureIds?: readonly string[]
  /** Number of installed plugin feats selected during character creation. */
  featChoiceCount?: number
  /** Added once per total character level to every maximum-HP calculation path. */
  hitPointsPerLevelBonus?: number
  /** Generic authoritative replacement of a natural 1 on supported d20 rolls. */
  naturalOneReroll?: boolean
  /** Generic innate spell grants; the Host validates level, ability, slot level and reset cadence. */
  innateSpells?: readonly Dnd5ePluginRacialInnateSpellGrant[]
  savingThrowAdvantages?: Dnd5ePluginRacialSavingThrowAdvantages
  traits?: readonly { id: string; name: string; description: string }[]
  staticModifiers?: Dnd5ePluginStaticCombatModifiers
  automation?: Dnd5ePluginAutomationLevel
  automationReasons?: readonly string[]
}

export interface Dnd5ePluginFeatResourceDefinition {
  id: string
  label: string
  shortLabel?: string
  maximum: number
  resetOn: ClassResourceReset
  /** Add this maximum to an existing same-id resource instead of taking the larger value. */
  stacking?: 'maximum' | 'additive'
}

export interface Dnd5ePluginFeatDefinition
  extends Omit<Dnd5ePluginFeatureDefinition, 'minimumLevel' | 'sourceClassId' | 'sourceSubclassId' | 'grantedBySubclass' | 'sourceFeatId' | 'grantedByFeat'> {
  prerequisite?: Dnd5ePluginFeatPrerequisite
  /** Feat-owned uses such as Lucky points. IDs remain local in declarations. */
  resources?: readonly Dnd5ePluginFeatResourceDefinition[]
  /** Generic, data-only build grants and option groups resolved when the feat is acquired. */
  advancements?: readonly Dnd5eAdvancementDefinitionV1[]
}

export interface Dnd5ePluginBackgroundDefinition {
  id: string
  name: string
  description?: string
  skillProficiencies: readonly string[]
  toolProficiencies?: readonly string[]
  toolProficiencyChoices?: readonly Dnd5ePluginBackgroundToolChoiceDefinition[]
  languages?: number
  feature?: { name: string; description: string }
  variants?: readonly Dnd5ePluginBackgroundVariantDefinition[]
  startingEquipment?: Dnd5ePluginBackgroundStartingEquipmentDefinition
}
export interface Dnd5ePluginBackgroundToolChoiceDefinition {
  id: string
  label: string
  count: number
  options: readonly string[]
}

export interface Dnd5ePluginBackgroundVariantDefinition {
  id: string
  name: string
  feature?: { name: string; description: string }
}

export interface Dnd5ePluginBackgroundStartingEquipmentGrant {
  templateId: string
  quantity: number
  equipSlot?: EquipmentSlot
}

export type Dnd5ePluginBackgroundStartingEquipmentPicker = {
  id: string
  label: string
  equipSlot?: EquipmentSlot
} & (
  | { equipmentIds: readonly string[]; defaultEquipmentId: string }
  | { templateIds: readonly string[]; defaultTemplateId: string }
)

export interface Dnd5ePluginBackgroundStartingEquipmentOption {
  id: string
  label: string
  description?: string
  grants: readonly Dnd5ePluginBackgroundStartingEquipmentGrant[]
  pickers?: readonly Dnd5ePluginBackgroundStartingEquipmentPicker[]
}

export interface Dnd5ePluginBackgroundStartingEquipmentChoiceGroup {
  id: string
  label: string
  options: readonly Dnd5ePluginBackgroundStartingEquipmentOption[]
}

export interface Dnd5ePluginBackgroundStartingEquipmentDefinition {
  fixedGrants?: readonly Dnd5ePluginBackgroundStartingEquipmentGrant[]
  groups?: readonly Dnd5ePluginBackgroundStartingEquipmentChoiceGroup[]
}

export type Dnd5ePluginAbilityGenerationDefinition = {
  id: string
  name: string
  summary: string
} & (
  | { kind: 'standard-array'; scores: readonly number[] }
  | { kind: 'point-buy'; budget: number; minimum: number; maximum: number; costs: Readonly<Record<number, number>> }
  | { kind: 'roll'; diceCount: number; dieSides: number; dropLowest: number }
)

export type Dnd5ePluginSpellDefinition = Omit<Dnd5eImportedSpell, 'id' | 'source' | 'automation'> & {
  id: string
  iconAssetId?: string
  automation?:
    | { mode: 'reference-only' }
    | { mode: 'headless-action'; actionId: string }
}

/**
 * 规则包物品只声明数据。装备 ID、名称和来源由 Host 从物品清单生成，避免插件
 * 伪造核心模板身份；所有可执行效果必须属于 EquipmentItem.effects 白名单。
 */
export interface Dnd5ePluginItemDefinition
  extends Omit<Dnd5eInventoryItemTemplate, 'id' | 'source' | 'equipment'> {
  id: string
  equipment?: Omit<EquipmentItem, 'id' | 'name'>
}

export interface Dnd5eRulesPluginApi {
  readonly apiVersion: typeof DND5E_RULES_PLUGIN_API_VERSION
  readonly rulesetId: typeof DND5E_RULES_PLUGIN_RULESET_ID
  registerFighterSubclass(definition: Dnd5ePluginFighterSubclass): string
  registerFeature(definition: Dnd5ePluginFeatureDefinition): string
  registerFeat(definition: Dnd5ePluginFeatDefinition): string
  registerResource(definition: Dnd5ePluginResourceDefinition): string
  registerSubclass(definition: Dnd5ePluginSubclassDefinition): string
  /** Host-only pure-data class compiler. Imported JSON never supplies executable code. */
  registerDeclarativeClass(definition: DeclarativeClassDefinitionV1): string
  /** Host-only pure-data compiler. Imported JSON never supplies executable code. */
  registerDeclarativeSubclass(definition: DeclarativeSubclassDefinitionV1): string
  registerHeadlessAction(definition: Dnd5ePluginHeadlessActionDefinition): string
  registerRace(definition: Dnd5ePluginRaceDefinition): string
  registerBackground(definition: Dnd5ePluginBackgroundDefinition): string
  registerAbilityGenerationMethod(definition: Dnd5ePluginAbilityGenerationDefinition): string
  /** 注册可发现的法术数据；自动结算必须显式绑定同一插件的 Worker Headless action。 */
  registerSpell(definition: Dnd5ePluginSpellDefinition): string
  /** 注册可由 DM 分发的声明式物品；装备效果由 Host 白名单结算。 */
  registerItem(definition: Dnd5ePluginItemDefinition): string
  /** 注册由怪物工坊生成的纯数据 stat block；Host 会执行 monsterSchema fail-closed 校验。 */
  registerMonster(definition: Dnd5eMonsterStatBlock): string
}

export interface Dnd5eRulesPlugin {
  manifest: Dnd5eRulesPluginManifest
  /** Pure data migrations; executed only inside the locked Worker realm. */
  migrations?: readonly Dnd5eRulesPluginStateMigration[]
  setup(api: Dnd5eRulesPluginApi): void | (() => void)
}

const {
  plugins,
  headlessActions,
  features: pluginFeatures,
  feats: pluginFeats,
  resources: pluginResources,
  races: pluginRaces,
  backgrounds: pluginBackgrounds,
  abilityGenerationMethods: pluginAbilityGenerationMethods,
  spells: pluginSpells,
  items: pluginItems,
  monsters: pluginMonsters,
  listeners: pluginListeners,
} = dnd5ePluginRegistryStore
function validId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const DND5E_CLASS_IDS: readonly Dnd5eClassId[] = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
]

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

const DND5E_EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'mainWeapon', 'offHand', 'armor', 'helmet', 'shoes', 'ring', 'ring2', 'belt', 'necklace',
]

function normalizeBackgroundTemplateId(pluginId: string, value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 320) {
    throw new Error(`Invalid plugin background equipment template: ${label}`)
  }
  const normalized = value.trim()
  if (!normalized.includes(':')) return namespacedId(pluginId, normalized)
  if (!/^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$/.test(normalized)) {
    throw new Error(`Invalid plugin background equipment template: ${label}`)
  }
  return normalized
}

function normalizeBackgroundEquipmentGrant(
  pluginId: string,
  value: Dnd5ePluginBackgroundStartingEquipmentGrant,
  label: string,
): Dnd5ePluginBackgroundStartingEquipmentGrant {
  if (!value || !finiteInteger(value.quantity, 1, 100)) {
    throw new Error(`Invalid plugin background equipment grant: ${label}`)
  }
  if (value.equipSlot != null && !DND5E_EQUIPMENT_SLOTS.includes(value.equipSlot)) {
    throw new Error(`Invalid plugin background equipment slot: ${label}`)
  }
  return {
    templateId: normalizeBackgroundTemplateId(pluginId, value.templateId, label),
    quantity: value.quantity,
    ...(value.equipSlot ? { equipSlot: value.equipSlot } : {}),
  }
}

function normalizeBackgroundStartingEquipment(
  pluginId: string,
  backgroundId: string,
  value: Dnd5ePluginBackgroundStartingEquipmentDefinition | undefined,
): Dnd5ePluginBackgroundStartingEquipmentDefinition | undefined {
  if (value == null) return undefined
  const fixedGrants = [...(value.fixedGrants ?? [])]
  const groups = [...(value.groups ?? [])]
  if (fixedGrants.length > 64 || groups.length > 16) {
    throw new Error(`Invalid plugin background starting equipment: ${backgroundId}`)
  }
  const groupIds = new Set<string>()
  return {
    ...(fixedGrants.length ? {
      fixedGrants: fixedGrants.map((entry, index) =>
        normalizeBackgroundEquipmentGrant(pluginId, entry, `${backgroundId}:fixed:${index}`)),
    } : {}),
    ...(groups.length ? {
      groups: groups.map((group, groupIndex) => {
        if (!group || !validId(group.id) || groupIds.has(group.id) ||
          typeof group.label !== 'string' || !group.label.trim() || group.label.length > 160 ||
          !Array.isArray(group.options) || group.options.length < 1 || group.options.length > 32) {
          throw new Error(`Invalid plugin background equipment group: ${backgroundId}:${groupIndex}`)
        }
        groupIds.add(group.id)
        const optionIds = new Set<string>()
        return {
          id: group.id,
          label: group.label.trim(),
          options: group.options.map((option, optionIndex) => {
            if (!option || !validId(option.id) || optionIds.has(option.id) ||
              typeof option.label !== 'string' || !option.label.trim() || option.label.length > 160 ||
              (option.description != null && (typeof option.description !== 'string' || option.description.length > 2_000)) ||
              !Array.isArray(option.grants) || option.grants.length > 32 ||
              (option.pickers != null && (!Array.isArray(option.pickers) || option.pickers.length > 8))) {
              throw new Error(`Invalid plugin background equipment option: ${backgroundId}:${group.id}:${optionIndex}`)
            }
            optionIds.add(option.id)
            const pickerIds = new Set<string>()
            const pickers = option.pickers?.map((
              choice: Dnd5ePluginBackgroundStartingEquipmentPicker,
              pickerIndex: number,
            ) => {
              if (!choice || !validId(choice.id) || pickerIds.has(choice.id) ||
                typeof choice.label !== 'string' || !choice.label.trim() || choice.label.length > 160 ||
                (choice.equipSlot != null && !DND5E_EQUIPMENT_SLOTS.includes(choice.equipSlot))) {
                throw new Error(`Invalid plugin background equipment picker: ${backgroundId}:${group.id}:${pickerIndex}`)
              }
              pickerIds.add(choice.id)
              if ('equipmentIds' in choice) {
                const equipmentIds = [...new Set(choice.equipmentIds ?? [])]
                if (equipmentIds.length < 1 || equipmentIds.length > 64 ||
                  equipmentIds.some((entry) => typeof entry !== 'string' || !validId(entry)) ||
                  !equipmentIds.includes(choice.defaultEquipmentId)) {
                  throw new Error(`Invalid plugin background equipment picker options: ${backgroundId}:${group.id}:${choice.id}`)
                }
                return {
                  id: choice.id,
                  label: choice.label.trim(),
                  equipmentIds,
                  defaultEquipmentId: choice.defaultEquipmentId,
                  ...(choice.equipSlot ? { equipSlot: choice.equipSlot } : {}),
                }
              }
              const templateIds = [...new Set((choice.templateIds ?? []).map((entry: string, index: number) =>
                normalizeBackgroundTemplateId(pluginId, entry, `${backgroundId}:${group.id}:${choice.id}:${index}`)))]
              const defaultTemplateId = normalizeBackgroundTemplateId(
                pluginId,
                choice.defaultTemplateId,
                `${backgroundId}:${group.id}:${choice.id}:default`,
              )
              if (templateIds.length < 1 || templateIds.length > 64 || !templateIds.includes(defaultTemplateId)) {
                throw new Error(`Invalid plugin background template picker options: ${backgroundId}:${group.id}:${choice.id}`)
              }
              return {
                id: choice.id,
                label: choice.label.trim(),
                templateIds,
                defaultTemplateId,
                ...(choice.equipSlot ? { equipSlot: choice.equipSlot } : {}),
              }
            })
            return {
              id: option.id,
              label: option.label.trim(),
              ...(option.description?.trim() ? { description: option.description.trim() } : {}),
              grants: option.grants.map((entry: Dnd5ePluginBackgroundStartingEquipmentGrant, grantIndex: number) => normalizeBackgroundEquipmentGrant(
                pluginId,
                entry,
                `${backgroundId}:${group.id}:${option.id}:${grantIndex}`,
              )),
              ...(pickers?.length ? { pickers } : {}),
            }
          }),
        }
      }),
    } : {}),
  }
}

function clonePluginRolls(
  rolls: readonly Dnd5ePluginDiceRollDeclaration[] | undefined,
  actionId: string,
): Dnd5ePluginDiceRollDeclaration[] | undefined {
  if (rolls == null) return undefined
  if (!Array.isArray(rolls) || rolls.length > 16) throw new Error(`Invalid plugin dice declarations: ${actionId}`)
  const seen = new Set<string>()
  return rolls.map((roll) => {
    if (
      !validId(roll.id) || seen.has(roll.id) || typeof roll.label !== 'string' || !roll.label.trim() ||
      !finiteInteger(roll.count, 1, 12) || !finiteInteger(roll.sides, 2, 100) ||
      !finiteInteger(roll.modifier ?? 0, -1_000_000, 1_000_000) ||
      (roll.visibility != null && roll.visibility !== 'public' && roll.visibility !== 'dm')
    ) throw new Error(`Invalid plugin dice declaration: ${actionId}:${roll.id}`)
    seen.add(roll.id)
    return {
      id: roll.id,
      label: roll.label.trim(),
      count: roll.count,
      sides: roll.sides,
      modifier: roll.modifier ?? 0,
      visibility: roll.visibility ?? 'public',
    }
  })
}

function clonePluginTargeting(targeting: Dnd5ePluginTargeting, featureId: string): Dnd5ePluginTargeting {
  if (!targeting || !['self', 'single-creature', 'multiple-creatures', 'area'].includes(targeting.kind)) {
    throw new Error(`Invalid plugin feature targeting: ${featureId}`)
  }
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.relation != null && !['any', 'ally', 'enemy'].includes(targeting.relation)) {
    throw new Error(`Invalid plugin feature target relation: ${featureId}`)
  }
  if (targeting.kind === 'single-creature' || targeting.kind === 'multiple-creatures') {
    if (targeting.rangeFeet != null && (!Number.isFinite(targeting.rangeFeet) || targeting.rangeFeet < 0 || targeting.rangeFeet > 10_000)) {
      throw new Error(`Invalid plugin feature range: ${featureId}`)
    }
    if (targeting.kind === 'multiple-creatures' && !finiteInteger(targeting.maximumTargets, 1, 256)) {
      throw new Error(`Invalid plugin feature target limit: ${featureId}`)
    }
    return { ...targeting }
  }
  const template = targeting.template
  if (!template || !['circle', 'rect', 'line', 'cone'].includes(template.shape)) {
    throw new Error(`Invalid plugin area template: ${featureId}`)
  }
  const dimensions = template.shape === 'circle'
    ? [template.radiusFeet, template.placeRangeFeet]
    : template.shape === 'rect'
      ? [template.widthFeet, template.heightFeet, template.placeRangeFeet]
      : template.shape === 'line'
        ? [template.widthFeet, template.lengthFeet, template.aimRangeFeet]
        : [template.lengthFeet, template.aimRangeFeet]
  if (dimensions.some((value) => value != null && (!Number.isFinite(value) || value < 0 || value > 10_000))) {
    throw new Error(`Invalid plugin area dimensions: ${featureId}`)
  }
  if (!finiteInteger(targeting.maximumTargets ?? 64, 1, 256)) {
    throw new Error(`Invalid plugin area target limit: ${featureId}`)
  }
  return { ...targeting, maximumTargets: targeting.maximumTargets ?? 64, template: { ...template } }
}

function clonePluginInterrupt(
  interrupt: Dnd5ePluginInterruptDeclaration | undefined,
  featureId: string,
): Dnd5ePluginInterruptDeclaration | undefined {
  if (interrupt == null) return undefined
  if (
    typeof interrupt.prompt !== 'string' || !interrupt.prompt.trim() || interrupt.prompt.length > 2_000 ||
    !['actor', 'target', 'dm'].includes(interrupt.audience) || !Array.isArray(interrupt.options) ||
    interrupt.options.length < 2 || interrupt.options.length > 12 ||
    !finiteInteger(interrupt.timeoutMs ?? 30_000, 5_000, 300_000)
  ) throw new Error(`Invalid plugin interrupt declaration: ${featureId}`)
  const seen = new Set<string>()
  const options = interrupt.options.map((option) => {
    if (
      !validId(option.id) || seen.has(option.id) || typeof option.label !== 'string' || !option.label.trim() ||
      (option.description != null && (typeof option.description !== 'string' || option.description.length > 500))
    ) throw new Error(`Invalid plugin interrupt option: ${featureId}`)
    seen.add(option.id)
    return { ...option, label: option.label.trim() }
  })
  if (!seen.has(interrupt.defaultOptionId)) throw new Error(`Invalid plugin interrupt default: ${featureId}`)
  if (interrupt.cancelOptionId != null && !seen.has(interrupt.cancelOptionId)) {
    throw new Error(`Invalid plugin interrupt cancel option: ${featureId}`)
  }
  return { ...interrupt, prompt: interrupt.prompt.trim(), timeoutMs: interrupt.timeoutMs ?? 30_000, options }
}

function clonePersistentAreaTriggers(
  triggers: readonly Dnd5ePersistentAreaTriggerDeclaration[] | undefined,
  featureId: string,
): Dnd5ePersistentAreaTriggerDeclaration[] | undefined {
  if (triggers == null) return undefined
  if (!Array.isArray(triggers) || triggers.length < 1 || triggers.length > 16) {
    throw new Error(`Invalid plugin persistent area triggers: ${featureId}`)
  }
  const seen = new Set<string>()
  return triggers.map((trigger) => {
    if (
      !validId(trigger.id) || seen.has(trigger.id) ||
      typeof trigger.label !== 'string' || !trigger.label.trim() ||
      trigger.label.length > DND5E_DECLARATIVE_LABEL_MAX_LENGTH ||
      !['on-create', 'on-enter', 'on-move-distance', 'on-area-move-impact', 'turn-start', 'turn-end'].includes(trigger.timing) ||
      (trigger.timing === 'on-move-distance' && !finiteInteger(trigger.movementIntervalFeet, 1, 1_000)) ||
      (trigger.timing !== 'on-move-distance' && trigger.movementIntervalFeet != null) ||
      (!trigger.damage && !trigger.condition)
    ) throw new Error(`Invalid plugin persistent area trigger: ${featureId}`)
    seen.add(trigger.id)
    const damage = trigger.damage
    if (damage && (
      !finiteInteger(damage.count, 1, 40) || !finiteInteger(damage.sides, 2, 100) ||
      !finiteInteger(damage.modifier ?? 0, -1_000, 1_000) ||
      (damage.modifierFormula != null && validateDnd5eWorkshopDamageFormulaV1(damage.modifierFormula).length > 0) ||
      !(DND5E_DAMAGE_TYPES as readonly string[]).includes(damage.type)
    )) throw new Error(`Invalid plugin persistent area damage: ${featureId}:${trigger.id}`)
    const savingThrow = trigger.savingThrow
    if (savingThrow && (
      !ABILITY_KEYS.includes(savingThrow.ability) ||
      !(savingThrow.dc === 'source-save-dc' || finiteInteger(savingThrow.dc, 1, 40)) ||
      !['none', 'half'].includes(savingThrow.onSuccess)
    )) throw new Error(`Invalid plugin persistent area save: ${featureId}:${trigger.id}`)
    const condition = trigger.condition
    if (condition) {
      const duration = condition.duration
      if (
        !(DND5E_STANDARD_CONDITION_IDS as readonly string[]).includes(condition.condition) ||
        !['source-next-turn-start', 'source-turn-end', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save', 'permanent'].includes(duration.expiresAt) ||
        (duration.remainingRounds != null && !finiteInteger(duration.remainingRounds, 1, DND5E_DECLARATIVE_DURATION_MAX_ROUNDS)) ||
        (duration.saveAbility != null && !ABILITY_KEYS.includes(duration.saveAbility)) ||
        (duration.saveDc != null && !finiteInteger(duration.saveDc, 1, 40)) ||
        (duration.expiresAt === 'target-turn-end-save' && (!duration.saveAbility || !duration.saveDc))
      ) throw new Error(`Invalid plugin persistent area condition: ${featureId}:${trigger.id}`)
    }
    return {
      ...trigger,
      label: trigger.label.trim(),
      oncePerRound: trigger.oncePerTurn === true ? false : trigger.oncePerRound !== false,
      oncePerTurn: trigger.oncePerTurn === true,
      damage: damage ? { ...damage, modifier: damage.modifier ?? 0 } : undefined,
      savingThrow: savingThrow ? { ...savingThrow } : undefined,
      condition: condition ? { ...condition, duration: { ...condition.duration } } : undefined,
      dmAdjustable: trigger.dmAdjustable === true,
    }
  })
}

function clonePluginPersistentAreaVertical(
  vertical: Dnd5ePluginPersistentAreaVerticalDeclaration | undefined,
  featureId: string,
): Dnd5ePluginPersistentAreaVerticalDeclaration | undefined {
  if (vertical == null) return undefined
  const normalized = normalizeDnd5ePluginPersistentAreaVerticalDeclaration(vertical)
  if (!normalized) throw new Error(`Invalid plugin persistent area vertical: ${featureId}`)
  return normalized
}

function clonePluginFeatureAction(action: Dnd5ePluginFeatureAction | undefined): Dnd5ePluginFeatureAction | undefined {
  if (!action) return undefined
  return {
    ...action,
    targeting: action.targeting.kind === 'area'
      ? { ...action.targeting, template: { ...action.targeting.template } }
      : { ...action.targeting },
    interrupt: action.interrupt ? {
      ...action.interrupt,
      options: action.interrupt.options.map((option) => ({ ...option })),
    } : undefined,
    persistentArea: action.persistentArea ? {
      ...action.persistentArea,
      vertical: action.persistentArea.vertical ? { ...action.persistentArea.vertical } : undefined,
      visual: action.persistentArea.visual ? { ...action.persistentArea.visual } : undefined,
      triggers: action.persistentArea.triggers?.map((trigger) => ({
        ...trigger,
        damage: trigger.damage ? { ...trigger.damage } : undefined,
        savingThrow: trigger.savingThrow ? { ...trigger.savingThrow } : undefined,
        condition: trigger.condition
          ? { ...trigger.condition, duration: { ...trigger.condition.duration } }
          : undefined,
      })),
    } : undefined,
    summon: action.summon ? { ...action.summon } : undefined,
  }
}

function cloneAbilityBonuses(value: Dnd5ePluginRaceDefinition['abilityBonuses']): Partial<Record<AbilityKey, number>> {
  if (value == null) return {}
  const result: Partial<Record<AbilityKey, number>> = {}
  for (const [key, bonus] of Object.entries(value)) {
    if (!ABILITY_KEYS.includes(key as AbilityKey) || !finiteInteger(bonus, -10, 10)) {
      throw new Error(`Invalid plugin racial ability bonus: ${key}`)
    }
    if (bonus !== 0) result[key as AbilityKey] = bonus
  }
  return result
}

function ownedPluginAssetId(pluginId: string, value: unknown, label: string): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid plugin image asset reference: ${label}`)
  const assetId = value.startsWith(`${pluginId}:`) ? value : namespacedId(pluginId, value)
  const asset = dnd5ePluginImageAsset(assetId)
  if (!asset || asset.ownerPluginId !== pluginId) throw new Error(`Plugin image asset is unavailable: ${label}`)
  return assetId
}

function cloneStaticCombatModifiers(
  value: Dnd5ePluginStaticCombatModifiers | undefined,
  label: string,
): Dnd5ePluginStaticCombatModifiers | undefined {
  if (value == null) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid plugin static combat modifiers: ${label}`)
  }
  const numeric: Array<[keyof Dnd5ePluginStaticCombatModifiers, number, number]> = [
    ['armorClassBonus', -20, 20],
    ['initiativeBonus', -20, 20],
    ['speedBonusFeet', -500, 500],
    ['savingThrowBonus', -20, 20],
    ['darkvisionRangeFeet', 0, 10_000],
    ['hitPointsPerLevelBonus', 0, 100],
    ['passivePerceptionBonus', -100, 100],
    ['passiveInvestigationBonus', -100, 100],
    ['minimumHitDieHealingConstitutionMultiplier', 0, 20],
    ['spellAttackRangeMultiplier', 1, 10],
    ['mediumArmorDexterityCapBonus', 0, 20],
    ['dualWieldMeleeArmorClassBonus', 0, 20],
    ['climbWithoutSpeedCostMultiplier', 1, 20],
    ['runningJumpMinimumApproachFeet', 0, 100],
    ['standFromProneMovementCostFeet', 0, 500],
    ['spellSavingThrowAdvantageWithinFeet', 0, 10_000],
    ['combatManeuverDieSidesOverride', 4, 12],
  ]
  for (const [key, minimum, maximum] of numeric) {
    const candidate = value[key]
    if (candidate != null && !finiteInteger(candidate, minimum, maximum)) {
      throw new Error(`Invalid plugin static combat modifier ${key}: ${label}`)
    }
  }
  for (const key of [
    'cannotBeSurprisedWhileConscious',
    'unseenAttackersDoNotGainAdvantage',
    'ignoreLongRangeRangedWeaponDisadvantage',
    'ignoreNearbyHostileRangedAttackDisadvantage',
    'ignoreLoadingWeaponProperty',
    'allowNonLightTwoWeaponFighting',
    'mountedMeleeAdvantageAgainstSmallerUnmounted',
    'redirectMountedCreatureAttacksToRider',
    'grantMountedCreatureDexterityEvasion',
    'ignoreRangedWeaponCoverBonus',
    'ignoreMediumArmorStealthDisadvantage',
    'preventOpportunityAttacksFromMeleeAttackTargets',
    'opportunityAttacksIgnoreDisengage',
    'opportunityAttackHitStopsMovement',
    'ignoreDifficultTerrainWhileDashing',
    'ignoreSpellAttackCoverBonus',
    'imposeConcentrationCheckDisadvantageOnDamage',
    'meleeWeaponDamageRerollOncePerTurn',
    'shieldDexteritySaveBonusWhenSoleTarget',
    'shieldSuccessfulDexteritySaveNegatesDamage',
    'opportunityAttackSpellReplacement',
    'ignoreOccupiedHandsForSomaticComponents',
    'retainHiddenOnRangedWeaponMiss',
  ] as const) {
    if (value[key] != null && typeof value[key] !== 'boolean') {
      throw new Error(`Invalid plugin static combat modifier ${key}: ${label}`)
    }
  }
  let opportunityAttacksOnEnterReachWeaponIds: string[] | undefined
  if (value.opportunityAttacksOnEnterReachWeaponIds != null) {
    if (
      !Array.isArray(value.opportunityAttacksOnEnterReachWeaponIds) ||
      value.opportunityAttacksOnEnterReachWeaponIds.length < 1 ||
      value.opportunityAttacksOnEnterReachWeaponIds.length > 32 ||
      value.opportunityAttacksOnEnterReachWeaponIds.some((entry) =>
        typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(entry))
    ) throw new Error(`Invalid opportunity-attack weapon ids: ${label}`)
    opportunityAttacksOnEnterReachWeaponIds = [
      ...new Set(value.opportunityAttacksOnEnterReachWeaponIds),
    ]
  }
  const damageList = (values: readonly Dnd5eDamageType[] | undefined, key: string) => {
    if (values == null) return undefined
    if (!Array.isArray(values) || values.length > DND5E_DAMAGE_TYPES.length ||
      values.some((entry) => !(DND5E_DAMAGE_TYPES as readonly string[]).includes(entry))) {
      throw new Error(`Invalid plugin static combat modifier ${key}: ${label}`)
    }
    return [...new Set(values)]
  }
  const damageResistances = damageList(value.damageResistances, 'damageResistances')
  const damageImmunities = damageList(value.damageImmunities, 'damageImmunities')
  let conditionImmunities: string[] | undefined
  if (value.conditionImmunities != null) {
    if (!Array.isArray(value.conditionImmunities) || value.conditionImmunities.length > 32 ||
      value.conditionImmunities.some((entry) => typeof entry !== 'string' || !entry.trim() || entry.length > 120)) {
      throw new Error(`Invalid plugin condition immunities: ${label}`)
    }
    conditionImmunities = [...new Set(value.conditionImmunities.map((entry) => entry.trim()))]
  }
  return {
    ...(value.armorClassBonus != null ? { armorClassBonus: value.armorClassBonus } : {}),
    ...(value.initiativeBonus != null ? { initiativeBonus: value.initiativeBonus } : {}),
    ...(value.speedBonusFeet != null ? { speedBonusFeet: value.speedBonusFeet } : {}),
    ...(value.savingThrowBonus != null ? { savingThrowBonus: value.savingThrowBonus } : {}),
    ...(value.darkvisionRangeFeet != null ? { darkvisionRangeFeet: value.darkvisionRangeFeet } : {}),
    ...(value.hitPointsPerLevelBonus != null ? { hitPointsPerLevelBonus: value.hitPointsPerLevelBonus } : {}),
    ...(value.passivePerceptionBonus != null ? { passivePerceptionBonus: value.passivePerceptionBonus } : {}),
    ...(value.passiveInvestigationBonus != null ? { passiveInvestigationBonus: value.passiveInvestigationBonus } : {}),
    ...(value.minimumHitDieHealingConstitutionMultiplier != null
      ? { minimumHitDieHealingConstitutionMultiplier: value.minimumHitDieHealingConstitutionMultiplier }
      : {}),
    ...(value.cannotBeSurprisedWhileConscious === true ? { cannotBeSurprisedWhileConscious: true } : {}),
    ...(value.unseenAttackersDoNotGainAdvantage === true ? { unseenAttackersDoNotGainAdvantage: true } : {}),
    ...(value.ignoreLongRangeRangedWeaponDisadvantage === true ? { ignoreLongRangeRangedWeaponDisadvantage: true } : {}),
    ...(value.ignoreNearbyHostileRangedAttackDisadvantage === true ? { ignoreNearbyHostileRangedAttackDisadvantage: true } : {}),
    ...(value.ignoreLoadingWeaponProperty === true ? { ignoreLoadingWeaponProperty: true } : {}),
    ...(value.allowNonLightTwoWeaponFighting === true ? { allowNonLightTwoWeaponFighting: true } : {}),
    ...(value.ignoreRangedWeaponCoverBonus === true ? { ignoreRangedWeaponCoverBonus: true } : {}),
    ...(value.mediumArmorDexterityCapBonus != null ? { mediumArmorDexterityCapBonus: value.mediumArmorDexterityCapBonus } : {}),
    ...(value.ignoreMediumArmorStealthDisadvantage === true ? { ignoreMediumArmorStealthDisadvantage: true } : {}),
    ...(value.dualWieldMeleeArmorClassBonus != null ? { dualWieldMeleeArmorClassBonus: value.dualWieldMeleeArmorClassBonus } : {}),
    ...(value.mountedMeleeAdvantageAgainstSmallerUnmounted === true
      ? { mountedMeleeAdvantageAgainstSmallerUnmounted: true }
      : {}),
    ...(value.redirectMountedCreatureAttacksToRider === true
      ? { redirectMountedCreatureAttacksToRider: true }
      : {}),
    ...(value.grantMountedCreatureDexterityEvasion === true
      ? { grantMountedCreatureDexterityEvasion: true }
      : {}),
    ...(value.preventOpportunityAttacksFromMeleeAttackTargets === true
      ? { preventOpportunityAttacksFromMeleeAttackTargets: true }
      : {}),
    ...(value.opportunityAttacksIgnoreDisengage === true
      ? { opportunityAttacksIgnoreDisengage: true }
      : {}),
    ...(value.opportunityAttackHitStopsMovement === true
      ? { opportunityAttackHitStopsMovement: true }
      : {}),
    ...(opportunityAttacksOnEnterReachWeaponIds
      ? { opportunityAttacksOnEnterReachWeaponIds }
      : {}),
    ...(value.ignoreDifficultTerrainWhileDashing === true
      ? { ignoreDifficultTerrainWhileDashing: true }
      : {}),
    ...(value.climbWithoutSpeedCostMultiplier != null ? { climbWithoutSpeedCostMultiplier: value.climbWithoutSpeedCostMultiplier } : {}),
    ...(value.runningJumpMinimumApproachFeet != null
      ? { runningJumpMinimumApproachFeet: value.runningJumpMinimumApproachFeet }
      : {}),
    ...(value.standFromProneMovementCostFeet != null ? { standFromProneMovementCostFeet: value.standFromProneMovementCostFeet } : {}),
    ...(value.spellAttackRangeMultiplier != null
      ? { spellAttackRangeMultiplier: value.spellAttackRangeMultiplier }
      : {}),
    ...(value.ignoreSpellAttackCoverBonus === true ? { ignoreSpellAttackCoverBonus: true } : {}),
    ...(value.spellSavingThrowAdvantageWithinFeet != null
      ? { spellSavingThrowAdvantageWithinFeet: value.spellSavingThrowAdvantageWithinFeet }
      : {}),
    ...(value.imposeConcentrationCheckDisadvantageOnDamage === true
      ? { imposeConcentrationCheckDisadvantageOnDamage: true }
      : {}),
    ...(value.meleeWeaponDamageRerollOncePerTurn === true
      ? { meleeWeaponDamageRerollOncePerTurn: true }
      : {}),
    ...(value.shieldDexteritySaveBonusWhenSoleTarget === true
      ? { shieldDexteritySaveBonusWhenSoleTarget: true }
      : {}),
    ...(value.shieldSuccessfulDexteritySaveNegatesDamage === true
      ? { shieldSuccessfulDexteritySaveNegatesDamage: true }
      : {}),
    ...(value.opportunityAttackSpellReplacement === true
      ? { opportunityAttackSpellReplacement: true }
      : {}),
    ...(value.combatManeuverDieSidesOverride != null
      ? { combatManeuverDieSidesOverride: value.combatManeuverDieSidesOverride }
      : {}),
    ...(value.ignoreOccupiedHandsForSomaticComponents === true
      ? { ignoreOccupiedHandsForSomaticComponents: true }
      : {}),
    ...(value.retainHiddenOnRangedWeaponMiss === true
      ? { retainHiddenOnRangedWeaponMiss: true }
      : {}),
    ...(damageResistances?.length ? { damageResistances } : {}),
    ...(damageImmunities?.length ? { damageImmunities } : {}),
    ...(conditionImmunities?.length ? { conditionImmunities } : {}),
  }
}

function cloneRacialSavingThrowAdvantages(
  value: Dnd5ePluginRacialSavingThrowAdvantages | undefined,
  label: string,
): Dnd5ePluginRacialSavingThrowAdvantages | undefined {
  if (value == null) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid plugin racial saving-throw advantages: ${label}`)
  }
  let conditions: string[] | undefined
  if (value.conditions != null) {
    if (!Array.isArray(value.conditions) || value.conditions.length > 32 ||
      value.conditions.some((entry) => typeof entry !== 'string' || !entry.trim() || entry.length > 120)) {
      throw new Error(`Invalid plugin racial saving-throw conditions: ${label}`)
    }
    conditions = [...new Set(value.conditions.map((entry) => entry.trim()))]
  }
  let damageTypes: Dnd5eDamageType[] | undefined
  if (value.damageTypes != null) {
    if (!Array.isArray(value.damageTypes) || value.damageTypes.length > DND5E_DAMAGE_TYPES.length ||
      value.damageTypes.some((entry) => !(DND5E_DAMAGE_TYPES as readonly string[]).includes(entry))) {
      throw new Error(`Invalid plugin racial saving-throw damage types: ${label}`)
    }
    damageTypes = [...new Set(value.damageTypes)]
  }
  let magicAbilities: AbilityKey[] | undefined
  if (value.magicAbilities != null) {
    if (!Array.isArray(value.magicAbilities) || value.magicAbilities.length > ABILITY_KEYS.length ||
      value.magicAbilities.some((entry) => !ABILITY_KEYS.includes(entry))) {
      throw new Error(`Invalid plugin racial magic saving-throw abilities: ${label}`)
    }
    magicAbilities = [...new Set(value.magicAbilities)]
  }
  return {
    ...(conditions?.length ? { conditions } : {}),
    ...(damageTypes?.length ? { damageTypes } : {}),
    ...(magicAbilities?.length ? { magicAbilities } : {}),
  }
}

function publishPluginRegistryChange(): void {
  dnd5ePluginRegistryStore.revision += 1
  for (const listener of pluginListeners) listener()
}

function namespacedId(pluginId: string, localId: string): string {
  if (!validId(localId)) throw new Error(`Invalid plugin contribution id: ${localId}`)
  return `${pluginId}:${localId}`
}

function toFighterSubclassDefinition(
  manifest: Dnd5eRulesPluginManifest,
  input: Dnd5ePluginFighterSubclass,
): FighterSubclassDefinition {
  const id = namespacedId(manifest.id, input.id)
  const resources = input.resources?.map((resource) => {
    const key = namespacedId(manifest.id, resource.id)
    return {
      key,
      label: resource.label,
      shortLabel: resource.shortLabel,
      isAvailable: (character: Character) =>
        character.dnd5eClassChoices?.fighter?.subclass === id &&
        character.level >= (resource.minLevel ?? 1) &&
        (resource.isAvailable?.(character) ?? true),
      max: resource.max,
      resetOn: resource.resetOn,
    }
  })
  return {
    id,
    name: input.name,
    summary: input.summary,
    rulesTextSource: 'third-party-plugin',
    sourceLabel: `${input.sourceLabel ?? manifest.name} · 第三方插件 · ${manifest.license}`,
    ownerPluginId: manifest.id,
    features: input.features.map((feature) => ({
      ...feature,
      id: `${id}:${feature.id}`,
      source: id,
    })),
    choiceGroups: input.choiceGroups,
    resources,
    fightingStyleSelectionLimit: input.fightingStyleSelectionLimit,
  }
}

export interface Dnd5eRulesPluginRegistrationOptions {
  integrity?: string
  /** Frozen format boundary. New execution modes must be expressed as registered Activity operation handlers. */
  adapterKind?: Dnd5eRulesPluginRuntimeAdapterKind
}
export function registerDnd5eRulesPlugin(
  plugin: Dnd5eRulesPlugin,
  options: Dnd5eRulesPluginRegistrationOptions = {},
): () => void {
  validateDnd5eRulesPluginManifest(plugin.manifest)
  const { id } = plugin.manifest
  if (plugins.has(id)) throw new Error(`D&D 5e rules plugin already registered: ${id}`)

  const disposers: Array<() => void> = []
  if (options.adapterKind === 'worker-module-adapter') disposers.push(registerDnd5eMechanicHandlerV1({
    id: `legacy.worker.${id}`, component: 'authority:plugin-headless-action',
    phases: ['effects', 'persistence'], legacyAdapter: true,
  }).dispose)
  let acceptingContributions = true
  const assertAcceptingContributions = () => {
    if (!acceptingContributions) throw new Error(`Plugin contributions must be registered synchronously during setup: ${id}`)
  }
  const api: Dnd5eRulesPluginApi = {
    apiVersion: DND5E_RULES_PLUGIN_API_VERSION,
    rulesetId: DND5E_RULES_PLUGIN_RULESET_ID,
    registerFighterSubclass(definition) {
      assertAcceptingContributions()
      const registered = toFighterSubclassDefinition(plugin.manifest, definition)
      disposers.push(registerFighterSubclassDefinition(registered))
      return registered.id
    },
    registerFeature(definition) {
      assertAcceptingContributions()
      const featureId = namespacedId(id, definition.id)
      if (pluginFeatures.has(featureId)) throw new Error(`Plugin feature already registered: ${featureId}`)
      if (
        definition.minimumLevel != null &&
        (typeof definition.minimumLevel !== 'number' || !Number.isFinite(definition.minimumLevel))
      ) throw new Error(`Invalid plugin feature minimum level: ${featureId}`)
      const minimumLevel = Math.min(20, Math.max(1, Math.floor(definition.minimumLevel ?? 1)))
      if (
        typeof definition.name !== 'string' || typeof definition.summary !== 'string' ||
        typeof definition.description !== 'string' || !definition.name.trim() ||
        !definition.summary.trim() || !definition.description.trim()
      ) {
        throw new Error(`Incomplete plugin feature definition: ${featureId}`)
      }
      if (!['full', 'partial', 'manual'].includes(definition.automation)) {
        throw new Error(`Invalid plugin feature automation level: ${featureId}`)
      }
      if (definition.canModifyEnemyD20 != null && typeof definition.canModifyEnemyD20 !== 'boolean') {
        throw new Error(`Invalid enemy d20 modifier declaration: ${featureId}`)
      }
      if (definition.sourceLabel != null && typeof definition.sourceLabel !== 'string') {
        throw new Error(`Invalid plugin feature source label: ${featureId}`)
      }
      if (definition.sourceFeatId != null || definition.grantedByFeat != null) {
        throw new Error(`Feat ownership markers are Host-only: ${featureId}`)
      }
      const iconAssetId = ownedPluginAssetId(id, definition.iconAssetId, featureId)
      const staticModifiers = cloneStaticCombatModifiers(definition.staticModifiers, featureId)
      const passiveEffects = cloneDnd5ePluginFeaturePassiveEffects(definition.passiveEffects, featureId)
      if (definition.declarativeAbility) {
        validateDeclarativeSubclassAbilityV1(definition.declarativeAbility, `Plugin feature ${featureId}`)
      }
      if (definition.action) {
        if (!validId(definition.action.id)) throw new Error(`Invalid plugin feature action id: ${definition.action.id}`)
        if (typeof definition.action.label !== 'string' || !definition.action.label.trim()) {
          throw new Error(`Incomplete plugin feature action: ${featureId}`)
        }
        if (definition.action.description != null && typeof definition.action.description !== 'string') {
          throw new Error(`Invalid plugin feature action description: ${featureId}`)
        }
        if (!['action', 'bonusAction', 'reaction', 'none'].includes(definition.action.economy)) {
          throw new Error(`Invalid plugin feature action economy: ${featureId}`)
        }
        if (definition.action.trigger && definition.declarativeAbility?.trigger.kind !== definition.action.trigger.kind) {
          throw new Error(`Plugin feature trigger mismatch: ${featureId}`)
        }
        const area = definition.action.persistentArea
        if (area && (
          definition.action.targeting.kind !== 'area' || typeof area.label !== 'string' || !area.label.trim() ||
          area.label.length > DND5E_DECLARATIVE_LABEL_MAX_LENGTH ||
          !finiteInteger(area.durationRounds, 1, DND5E_DECLARATIVE_DURATION_MAX_ROUNDS) ||
          (area.color != null && !/^#[0-9a-f]{6}$/i.test(area.color)) ||
          (area.visual != null && !normalizeDnd5ePersistentAreaVisual(area.visual))
        )) throw new Error(`Invalid plugin persistent area: ${featureId}`)
        const summon = definition.action.summon
        if (summon && (
          definition.action.economy === 'none' ||
          definition.action.targeting.kind !== 'area' ||
          !/^srd-5\.1:[a-z0-9][a-z0-9-]*$/.test(summon.monsterId) ||
          !finiteInteger(summon.durationRounds, 1, DND5E_DECLARATIVE_DURATION_MAX_ROUNDS) ||
          (summon.label != null && (
            typeof summon.label !== 'string' || !summon.label.trim() ||
            summon.label.length > DND5E_DECLARATIVE_LABEL_MAX_LENGTH
          )) ||
          (summon.side != null && summon.side !== 'ally' && summon.side !== 'enemy') ||
          !!area
        )) throw new Error(`Invalid plugin summon: ${featureId}`)
      }
      if (definition.grantedBySubclass) {
        const subclass = definition.sourceSubclassId ? pluginSubclasses.get(definition.sourceSubclassId) : undefined
        if (!subclass || subclass.ownerPluginId !== id || subclass.classId !== definition.sourceClassId) {
          throw new Error(`Invalid plugin subclass feature source: ${featureId}`)
        }
      } else if (definition.sourceClassId || definition.sourceSubclassId) {
        throw new Error(`Standalone plugin feature cannot claim a subclass source: ${featureId}`)
      }
      const action = definition.action ? {
        ...definition.action,
        targeting: clonePluginTargeting(definition.action.targeting, featureId),
        interrupt: clonePluginInterrupt(definition.action.interrupt, featureId),
        persistentArea: definition.action.persistentArea
          ? {
              ...definition.action.persistentArea,
              label: definition.action.persistentArea.label.trim(),
              vertical: clonePluginPersistentAreaVertical(
                definition.action.persistentArea.vertical,
                featureId,
              ),
              visual: definition.action.persistentArea.visual
                ? normalizeDnd5ePersistentAreaVisual(definition.action.persistentArea.visual)
                : undefined,
              triggers: clonePersistentAreaTriggers(definition.action.persistentArea.triggers, featureId),
            }
          : undefined,
        summon: definition.action.summon
          ? {
              ...definition.action.summon,
              label: definition.action.summon.label?.trim(),
              side: definition.action.summon.side ?? 'ally',
            }
          : undefined,
      } : undefined
      const registered: RegisteredDnd5ePluginFeature = {
        ...definition,
        id: featureId,
        ...(iconAssetId ? { iconAssetId } : {}),
        ...(staticModifiers ? { staticModifiers } : {}),
        ...(passiveEffects ? { passiveEffects } : {}),
        minimumLevel,
        action,
        declarativeAbility: definition.declarativeAbility ? structuredClone(definition.declarativeAbility) : undefined,
        automationReasons: definition.automationReasons ? [...definition.automationReasons] : undefined,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginFeatures.set(featureId, registered)
      disposers.push(() => {
        if (pluginFeatures.get(featureId) === registered) pluginFeatures.delete(featureId)
      })
      return featureId
    },
    registerFeat(definition) {
      assertAcceptingContributions()
      const featId = namespacedId(id, definition.id)
      if (pluginFeats.has(featId)) throw new Error(`Plugin feat already registered: ${featId}`)
      const prerequisite = definition.prerequisite
      if (prerequisite?.minimumLevel != null && !finiteInteger(prerequisite.minimumLevel, 1, 20)) {
        throw new Error(`Invalid plugin feat minimum level: ${featId}`)
      }
      const abilityScores: Partial<Record<AbilityKey, number>> = {}
      for (const [ability, score] of Object.entries(prerequisite?.abilityScores ?? {})) {
        if (!ABILITY_KEYS.includes(ability as AbilityKey) || !finiteInteger(score, 1, 30)) {
          throw new Error(`Invalid plugin feat ability prerequisite: ${featId}`)
        }
        abilityScores[ability as AbilityKey] = score
      }
      const anyAbilityScores: Partial<Record<AbilityKey, number>> = {}
      for (const [ability, score] of Object.entries(prerequisite?.anyAbilityScores ?? {})) {
        if (!ABILITY_KEYS.includes(ability as AbilityKey) || !finiteInteger(score, 1, 30)) {
          throw new Error(`Invalid plugin feat any-ability prerequisite: ${featId}`)
        }
        anyAbilityScores[ability as AbilityKey] = score
      }
      if (prerequisite?.anyAbilityScores != null && Object.keys(anyAbilityScores).length < 1) {
        throw new Error(`Invalid plugin feat any-ability prerequisite: ${featId}`)
      }
      const raceIds = prerequisite?.raceIds == null ? undefined : [...new Set(prerequisite.raceIds)]
      if (raceIds && (
        raceIds.length < 1 || raceIds.length > 32 ||
        raceIds.some((raceId) => typeof raceId !== 'string' || !raceId.trim() || raceId.length > 160)
      )) throw new Error(`Invalid plugin feat race prerequisite: ${featId}`)
      const armorProficiencies = prerequisite?.armorProficiencies == null
        ? undefined
        : [...new Set(prerequisite.armorProficiencies)]
      if (armorProficiencies && (
        armorProficiencies.length < 1 || armorProficiencies.length > 4 ||
        armorProficiencies.some((category) => !['light', 'medium', 'heavy', 'shield'].includes(category))
      )) throw new Error(`Invalid plugin feat armor proficiency prerequisite: ${featId}`)
      if (prerequisite?.spellcasting != null && typeof prerequisite.spellcasting !== 'boolean') {
        throw new Error(`Invalid plugin feat spellcasting prerequisite: ${featId}`)
      }
      const featResources = definition.resources?.map((resource) => {
        if (
          !validId(resource.id) || typeof resource.label !== 'string' || !resource.label.trim() ||
          (resource.shortLabel != null && (typeof resource.shortLabel !== 'string' || !resource.shortLabel.trim())) ||
          !finiteInteger(resource.maximum, 1, 1_000_000) ||
          !['combat', 'short-rest', 'long-rest'].includes(resource.resetOn) ||
          (resource.stacking != null && !['maximum', 'additive'].includes(resource.stacking))
        ) throw new Error(`Invalid plugin feat resource: ${featId}:${resource.id}`)
        return {
          id: namespacedId(id, resource.id),
          label: resource.label.trim(),
          shortLabel: resource.shortLabel?.trim() || undefined,
          maximum: resource.maximum,
          resetOn: resource.resetOn,
          ...(resource.stacking ? { stacking: resource.stacking } : {}),
        }
      })
      if (featResources && (
        featResources.length < 1 || featResources.length > 16 ||
        new Set(featResources.map((resource) => resource.id)).size !== featResources.length
      )) throw new Error(`Invalid plugin feat resources: ${featId}`)
      const advancements = definition.advancements?.map((advancement, advancementIndex) => {
        const errors = validateDnd5eAdvancementDefinitionV1(advancement)
        if (errors.length) {
          throw new Error(`Invalid plugin feat advancement ${featId}[${advancementIndex}]: ${errors.join('; ')}`)
        }
        return structuredClone(advancement)
      })
      if (advancements && (
        advancements.length < 1 || advancements.length > 64 ||
        new Set(advancements.map((advancement) => advancement.id)).size !== advancements.length
      )) throw new Error(`Invalid plugin feat advancements: ${featId}`)
      const advancementCollectionErrors = advancements
        ? validateDnd5eAdvancementCollectionV1(advancements)
        : []
      if (advancementCollectionErrors.length) {
        throw new Error(`Invalid plugin feat advancement dependencies ${featId}: ${advancementCollectionErrors.join('; ')}`)
      }
      if (definition.declarativeAbility?.mechanic?.kind === 'd20-choice-reroll') {
        const ownedResourceIds = new Set(definition.resources?.map((resource) => resource.id) ?? [])
        const costs = definition.declarativeAbility.cost?.resources ?? []
        if (costs.length < 1 || costs.some((cost) =>
          cost.scope === 'core' || !ownedResourceIds.has(cost.resourceId))) {
          throw new Error(`Choice reroll feat must spend its own declared resource: ${featId}`)
        }
      }
      const localFeatureId = `feat-${definition.id}`
      const {
        prerequisite: _prerequisite,
        resources: _resources,
        advancements: _advancements,
        ...featureDefinition
      } = definition
      void _prerequisite
      void _resources
      void _advancements
      const featureId = api.registerFeature({
        ...featureDefinition,
        id: localFeatureId,
        minimumLevel: prerequisite?.minimumLevel,
      })
      const feature = pluginFeatures.get(featureId)
      if (!feature) throw new Error(`Plugin feat feature registration failed: ${featId}`)
      feature.grantedByFeat = true
      feature.sourceFeatId = featId
      const registered: RegisteredDnd5ePluginFeat = {
        ...definition,
        id: featId,
        featureId,
        prerequisite: prerequisite ? {
          ...(prerequisite.minimumLevel != null ? { minimumLevel: prerequisite.minimumLevel } : {}),
          ...(Object.keys(abilityScores).length ? { abilityScores } : {}),
          ...(Object.keys(anyAbilityScores).length ? { anyAbilityScores } : {}),
          ...(raceIds?.length ? { raceIds } : {}),
          ...(armorProficiencies?.length ? { armorProficiencies } : {}),
          ...(prerequisite.spellcasting != null ? { spellcasting: prerequisite.spellcasting } : {}),
        } : undefined,
        resources: featResources,
        advancements,
        iconAssetId: feature.iconAssetId,
        staticModifiers: feature.staticModifiers,
        passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
        action: clonePluginFeatureAction(feature.action),
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginFeats.set(featId, registered)
      disposers.push(() => {
        if (pluginFeats.get(featId) === registered) pluginFeats.delete(featId)
      })
      return featId
    },
    registerResource(definition) {
      assertAcceptingContributions()
      const resourceId = namespacedId(id, definition.id)
      if (pluginResources.has(resourceId)) throw new Error(`Plugin resource already registered: ${resourceId}`)
      if (
        !DND5E_CLASS_IDS.includes(definition.classId) ||
        typeof definition.label !== 'string' || !definition.label.trim() ||
        (definition.shortLabel != null && (typeof definition.shortLabel !== 'string' || !definition.shortLabel.trim())) ||
        !finiteInteger(definition.minimumLevel ?? 1, 1, 20) ||
        !['combat', 'short-rest', 'long-rest'].includes(definition.resetOn)
      ) throw new Error(`Invalid plugin resource definition: ${resourceId}`)
      const maximum = Array.isArray(definition.maximum)
        ? definition.maximum.map((value) => {
            if (!finiteInteger(value, 0, 1_000_000)) throw new Error(`Invalid plugin resource maximum: ${resourceId}`)
            return value
          })
        : definition.maximum
      if (
        (Array.isArray(maximum) && (maximum.length < 1 || maximum.length > 20)) ||
        (!Array.isArray(maximum) && !finiteInteger(maximum, 0, 1_000_000))
      ) throw new Error(`Invalid plugin resource maximum: ${resourceId}`)
      const subclassId = definition.subclassId ? namespacedId(id, definition.subclassId) : undefined
      if (subclassId) {
        const subclass = pluginSubclasses.get(subclassId)
        if (!subclass || subclass.classId !== definition.classId) {
          throw new Error(`Plugin resource subclass is unavailable: ${resourceId}`)
        }
      }
      const registered: RegisteredDnd5ePluginResource = {
        ...definition,
        id: resourceId,
        label: definition.label.trim(),
        shortLabel: definition.shortLabel?.trim(),
        minimumLevel: definition.minimumLevel ?? 1,
        maximum: Array.isArray(maximum) ? [...maximum] : maximum,
        subclassId,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginResources.set(resourceId, registered)
      disposers.push(() => {
        if (pluginResources.get(resourceId) === registered) pluginResources.delete(resourceId)
      })
      return resourceId
    },
    registerSubclass(definition) {
      assertAcceptingContributions()
      const subclassId = namespacedId(id, definition.id)
      if (pluginSubclasses.has(subclassId)) throw new Error(`Plugin subclass already registered: ${subclassId}`)
      if (definition.spellLists != null) {
        validateDeclarativeSubclassSpellListsV1(
          definition.spellLists,
          `Plugin subclass ${subclassId}.spellLists`,
        )
      }
      const advancements = definition.advancements?.map((advancement) => structuredClone(advancement))
      if (advancements) {
        const errors = validateDnd5eAdvancementCollectionV1(advancements)
        if (errors.length > 0) {
          throw new Error(`Invalid plugin subclass advancements: ${subclassId}: ${errors.join('; ')}`)
        }
      }
      if (
        !DND5E_CLASS_IDS.includes(definition.classId) ||
        typeof definition.name !== 'string' || !definition.name.trim() ||
        typeof definition.summary !== 'string' || !definition.summary.trim() ||
        !Array.isArray(definition.features) || definition.features.length < 1 || definition.features.length > 64
      ) throw new Error(`Invalid plugin subclass definition: ${subclassId}`)
      const choiceGroupIds = new Set<string>()
      const choiceGroups = definition.choiceGroups?.map((group) => {
        const maximumByLevel = group.maxSelectionsByLevel?.map((step) => ({ ...step }))
        const highestMaximum = maximumByLevel?.at(-1)?.maxSelections ?? group.maxSelections
        if (
          !validId(group.id) || choiceGroupIds.has(group.id) ||
          !finiteInteger(group.level, 1, 20) || !finiteInteger(group.maxSelections, 1, 64) ||
          typeof group.name !== 'string' || !group.name.trim() || !Array.isArray(group.options) ||
          (group.description != null && typeof group.description !== 'string') ||
          group.options.length < highestMaximum || group.options.length > 128
        ) throw new Error(`Invalid plugin subclass choice group: ${subclassId}:${group.id}`)
        let previousLevel = group.level - 1
        let previousMaximum = group.maxSelections
        for (const step of maximumByLevel ?? []) {
          if (
            !finiteInteger(step.level, group.level, 20) || step.level <= previousLevel ||
            !finiteInteger(step.maxSelections, previousMaximum, 64) ||
            step.maxSelections > group.options.length
          ) throw new Error(`Invalid plugin subclass choice scaling: ${subclassId}:${group.id}`)
          previousLevel = step.level
          previousMaximum = step.maxSelections
        }
        choiceGroupIds.add(group.id)
        const optionIds = new Set<string>()
        const options = group.options.map((option) => {
          if (
            !validId(option.id) || optionIds.has(option.id) || typeof option.name !== 'string' || !option.name.trim() ||
            typeof option.summary !== 'string' || !option.summary.trim()
          ) throw new Error(`Invalid plugin subclass choice option: ${subclassId}:${group.id}`)
          optionIds.add(option.id)
          return { ...option, name: option.name.trim(), summary: option.summary.trim() }
        })
        return { ...group, name: group.name.trim(), maxSelectionsByLevel: maximumByLevel, options }
      })
      let registered: RegisteredDnd5ePluginSubclass = {
        ...definition,
        id: subclassId,
        name: definition.name.trim(),
        summary: definition.summary.trim(),
        features: [],
        choiceGroups,
        spellLists: definition.spellLists?.map((list) => ({
          ...list,
          entries: list.entries.map((entry) => ({ ...entry, spellIds: [...entry.spellIds] })),
        })),
        advancements,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginSubclasses.set(subclassId, registered)
      disposers.push(() => {
        if (pluginSubclasses.get(subclassId) === registered) pluginSubclasses.delete(subclassId)
      })
      const featureIds = new Set<string>()
      const features = definition.features.map((feature) => {
        if (
          !validId(feature.id) || featureIds.has(feature.id) || !finiteInteger(feature.level, 1, 20) ||
          typeof feature.name !== 'string' || !feature.name.trim() ||
          typeof feature.description !== 'string' || !feature.description.trim()
        ) throw new Error(`Invalid plugin subclass feature: ${subclassId}:${feature.id}`)
        featureIds.add(feature.id)
        const featureId = api.registerFeature({
          id: `${definition.id}.${feature.id}`,
          name: feature.name,
          summary: feature.description,
          description: feature.description,
          minimumLevel: feature.level,
          automation: feature.automation ?? (feature.action ? 'full' : 'manual'),
          canModifyEnemyD20: feature.canModifyEnemyD20,
          action: feature.action,
          sourceClassId: definition.classId,
          sourceSubclassId: subclassId,
          grantedBySubclass: true,
          declarativeAbility: feature.declarativeAbility,
          automationReasons: feature.automationReasons,
        })
        return { ...feature, id: `${subclassId}:${feature.id}`, featureId }
      })
      registered = { ...registered, features }
      pluginSubclasses.set(subclassId, registered)
      if (definition.classId === 'fighter') {
        disposers.push(registerFighterSubclassDefinition({
          id: subclassId,
          name: registered.name,
          summary: registered.summary,
          rulesTextSource: 'third-party-plugin',
          sourceLabel: `${plugin.manifest.name} · 第三方插件 · ${plugin.manifest.license}`,
          ownerPluginId: id,
          features: features.map((feature) => ({
            id: feature.id,
            level: feature.level,
            name: feature.name,
            description: feature.description,
            source: subclassId,
          })),
          choiceGroups: choiceGroups?.map((group) => ({
            id: group.id,
            name: group.name,
            description: group.description,
            minLevel: group.level,
            maxSelections: group.maxSelectionsByLevel?.length
              ? (character) => dnd5ePluginSubclassChoiceLimit(
                  group,
                  dnd5eCharacterClassLevel(character, definition.classId),
                )
              : group.maxSelections,
            options: group.options,
          })),
        }))
      }
      return subclassId
    },
    registerDeclarativeClass(definition) {
      assertAcceptingContributions()
      validateDeclarativeClassDefinitionV1(definition, `声明式职业 ${definition?.id ?? ''}`)
      if ((DND5E_2014_CLASS_OPTIONS as readonly string[]).includes(definition.name.trim())) {
        throw new Error(`声明式职业不能覆盖 SRD 职业名称：${definition.name}`)
      }
      for (const featureId of definition.advancements?.flatMap((advancement) => advancement.grants ?? []) ?? []) {
        if (!pluginFeatures.has(namespacedId(id, featureId))) {
          throw new Error(`声明式职业 ${definition.name} 授予的特性不存在：${featureId}`)
        }
      }
      const result = registerDeclarativeClassV1({
        definition,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginVersion: plugin.manifest.version,
        ownerPluginLicense: plugin.manifest.license,
      })
      disposers.push(result.dispose)
      return result.registered.id
    },
    registerDeclarativeSubclass(definition) {
      assertAcceptingContributions()
      validateDeclarativeSubclassDefinitionV1(definition, `Declarative subclass ${definition?.id ?? ''}`)
      const subclassId = namespacedId(id, definition.id)
      const features: Dnd5ePluginSubclassFeature[] = []
      const useResources: Array<{ definition: Dnd5ePluginResourceDefinition; formula: DeclarativeValueFormulaV1 }> = []
      const compatibilityByAbilityId = new Map(
        declarativeSubclassCompatibilityReportV1([definition]).abilities.map((entry) => [entry.abilityId, entry]),
      )
      for (const declaredAbility of definition.abilities) {
        const hookRequiresOncePerTurn = definition.combatHooks?.some((hook) =>
          hook.abilityId === declaredAbility.id && hook.oncePerTurn === true
        ) === true
        const ability: DeclarativeSubclassAbilityV1 = hookRequiresOncePerTurn &&
          declaredAbility.predicates?.oncePerTurn !== true &&
          declaredAbility.limits?.oncePerTurn !== true
          ? {
              ...declaredAbility,
              limits: { ...declaredAbility.limits, oncePerTurn: true },
            }
          : declaredAbility
        const compatibility = compatibilityByAbilityId.get(ability.id) ?? declarativeAbilityCompatibilityV1(ability)
        const actionLocalId = `decl.${definition.id}.${ability.id}`
        const featureId = namespacedId(id, `${definition.id}.${ability.id}`)
        let usesResourceId: string | undefined
        if (ability.limits?.uses && ability.limits.reset && ability.limits.reset !== 'none') {
          const localResourceId = `decl-${definition.id}-${ability.id}-uses`
          usesResourceId = namespacedId(id, localResourceId)
          useResources.push({
            definition: {
              id: localResourceId,
              label: `${ability.name}次数`,
              classId: definition.classId,
              subclassId: definition.id,
              minimumLevel: ability.level,
              maximum: declarativeResourceMaximumByLevel(ability.limits.uses, definition.classId),
              resetOn: ability.limits.reset,
            },
            formula: ability.limits.uses,
          })
        }
        const hostManagedClosedSubclass =
          ability.mechanic?.kind === 'martial-spell-synergy' ||
          ability.mechanic?.kind === 'rage-feature' ||
          ability.mechanic?.kind === 'opening-attack' ||
          ability.mechanic?.kind === 'hidden-spell-save-disadvantage' ||
          ability.mechanic?.kind === 'utility-projection-control' ||
          ability.mechanic?.kind === 'post-spell-random-table' ||
          ability.mechanic?.kind === 'post-spell-random-table-choice' ||
          ability.mechanic?.kind === 'spell-damage-max-die-bonus' ||
          ability.mechanic?.kind === 'stored-d20-replacement' ||
          ability.mechanic?.kind === 'attacks-per-action' ||
          ability.mechanic?.kind === 'weapon-damage-rider' ||
          ability.mechanic?.kind === 'spell-damage-ability-modifier' ||
          ability.mechanic?.kind === 'spell-ability-check-bonus' ||
          ability.mechanic?.kind === 'spell-interception' ||
          ability.mechanic?.kind === 'spell-target-expansion' ||
          ability.mechanic?.kind === 'damage-roll-maximization' ||
          ability.mechanic?.kind === 'passive-defense' ||
          ability.mechanic?.kind === 'reaction-weapon-attack'
          || ability.mechanic?.kind === 'death-prevention'
          || ability.mechanic?.kind === 'spell-defeat-healing'
          || ability.mechanic?.kind === 'summoned-creature-bonus'
          || ability.mechanic?.kind === 'companion-profile-upgrade'
          || ability.mechanic?.kind === 'creature-space-traversal'
          || ability.mechanic?.kind === 'environmental-movement'
          || ability.mechanic?.kind === 'persistent-projection'
          || ability.mechanic?.kind === 'persistent-projection-upgrade'
          || ability.mechanic?.kind === 'alternate-resource-spellcasting'
          || ability.mechanic?.kind === 'creature-form-eligibility'
          || ability.mechanic?.kind === 'creature-form-control'
          || ability.mechanic?.kind === 'bonus-weapon-attack'
        const action = compatibility.effective === 'manual' || hostManagedClosedSubclass ? undefined : {
          id: actionLocalId,
          label: ability.name,
          description: ability.description,
          economy: ability.cost?.economy ?? 'none',
          targeting: declarativeTargeting(ability.targeting),
          trigger: { ...ability.trigger },
          ...(compatibility.effective === 'partial' ? {
            interrupt: {
              prompt: `“${ability.name}”包含尚未完全机械化的声明，是否按当前安全子集结算？`,
              audience: 'dm' as const,
              options: [
                { id: 'dm-apply', label: '按安全子集结算' },
                { id: 'dm-cancel', label: '取消并手动裁定' },
              ],
              defaultOptionId: 'dm-cancel',
              cancelOptionId: 'dm-cancel',
            },
          } : {}),
        } satisfies Dnd5ePluginFeatureAction
        if (action) {
          const rollDeclarations = (ability.rolls ?? []).flatMap((roll) => {
            if ((roll.kind !== 'damage' && roll.kind !== 'healing') || declarativeDiceCount(roll.dice) < 1) return []
            return [{
              id: roll.id,
              label: roll.label,
              count: declarativeDiceCount(roll.dice),
              sides: roll.dice.sides,
              modifier: 0,
              visibility: 'public' as const,
            }]
          })
          if (ability.mechanic?.kind === 'post-d20-adjustment' && ability.mechanic.dieSides != null) {
            rollDeclarations.push({
              id: DND5E_POST_D20_ADJUSTMENT_ROLL_ID,
              label: ability.name,
              count: 1,
              sides: ability.mechanic.dieSides,
              modifier: 0,
              visibility: 'public',
            })
          }
          const perTargetRollDeclarations = (ability.rolls ?? []).flatMap((roll) =>
            roll.kind === 'saving-throw' ? [{
              id: `${roll.id}-d20`,
              label: roll.label,
              count: roll.rollMode === 'advantage' || roll.rollMode === 'disadvantage' || roll.rollMode === 'host-derived' || roll.rollModeByCreatureType
                ? 2
                : 1,
              sides: 20,
              modifier: 0,
              visibility: 'public' as const,
            }] : [],
          )
          api.registerHeadlessAction({
            id: actionLocalId,
            execution: 'trusted',
            allowOffTurn: ability.trigger.kind !== 'active-use',
            rolls: rollDeclarations,
            perTargetRolls: perTargetRollDeclarations,
            resolve: declarativeFeatureResolver({
              pluginId: id,
              subclassId,
              classId: definition.classId,
              ability,
              featureId,
              usesResourceId,
              automation: compatibility.effective,
              activity: dnd5eActivityFromDeclarativeSubclassAbility(ability, {
                subclassId: definition.id,
                compatibility,
              }),
            }),
          })
        }
        features.push({
          id: ability.id,
          level: ability.level,
          name: ability.name,
          description: ability.description,
          automation: compatibility.effective,
          canModifyEnemyD20: ability.canModifyEnemyD20 === true,
          action,
          declarativeAbility: structuredClone(ability),
          automationReasons: [...compatibility.reasons],
        })
      }
      const registeredSubclassId = api.registerSubclass({
        id: definition.id,
        classId: definition.classId,
        name: definition.name,
        summary: definition.summary,
        features,
        choiceGroups: definition.choiceGroups?.map((group) => ({
          ...structuredClone(group),
          maxSelectionsByLevel: group.maxSelectionsByLevel?.map((step) => ({ ...step })),
          options: group.options.map((option) => ({ ...option })),
        })),
        spellLists: definition.spellLists?.map((list) => ({
          ...list,
          entries: list.entries.map((entry) => ({ ...entry, spellIds: [...entry.spellIds] })),
        })),
        advancements: definition.advancements?.map((advancement) => structuredClone(advancement)),
      })
      const registeredSubclass = pluginSubclasses.get(registeredSubclassId)
      if (registeredSubclass) {
        registeredSubclass.declarativeSpellcasting = definition.spellcasting
          ? structuredClone(definition.spellcasting)
          : undefined
        registeredSubclass.declarativeCombatHooks = definition.combatHooks
          ? structuredClone(definition.combatHooks)
          : undefined
      }
      for (const resource of definition.resources ?? []) {
        const resourceId = api.registerResource({
          id: resource.id,
          label: resource.label,
          classId: definition.classId,
          subclassId: definition.id,
          minimumLevel: resource.minimumLevel ?? 1,
          maximum: declarativeResourceMaximumByLevel(
            resource.maximum,
            definition.classId,
            resource.maximumByClassLevel,
          ),
          resetOn: resource.resetOn,
        })
        const registered = pluginResources.get(resourceId)
        if (registered) {
          registered.declarativeMaximum = resource.maximumByClassLevel?.length
            ? undefined
            : structuredClone(resource.maximum)
          registered.declarativeDie = resource.die ? structuredClone(resource.die) : undefined
        }
      }
      for (const resource of useResources) {
        const resourceId = api.registerResource(resource.definition)
        const registered = pluginResources.get(resourceId)
        if (registered) registered.declarativeMaximum = structuredClone(resource.formula)
      }
      return registeredSubclassId
    },
    registerHeadlessAction(definition) {
      assertAcceptingContributions()
      const actionId = namespacedId(id, definition.id)
      if (headlessActions.has(actionId)) throw new Error(`Plugin headless action already registered: ${actionId}`)
      if (definition.execution != null && definition.execution !== 'trusted' && definition.execution !== 'worker') {
        throw new Error(`Invalid plugin Headless execution mode: ${actionId}`)
      }
      if (definition.allowOffTurn != null && typeof definition.allowOffTurn !== 'boolean') {
        throw new Error(`Invalid plugin Headless allowOffTurn value: ${actionId}`)
      }
      if (definition.execution !== 'worker' && typeof definition.resolve !== 'function') {
        throw new Error(`Trusted plugin Headless action is missing its resolver: ${actionId}`)
      }
      const owned = {
        pluginId: id,
        definition: {
          ...definition,
          rolls: clonePluginRolls(definition.rolls, actionId),
          perTargetRolls: clonePluginRolls(definition.perTargetRolls, `${actionId}:per-target`),
        },
      }
      headlessActions.set(actionId, owned)
      disposers.push(() => {
        if (headlessActions.get(actionId) === owned) headlessActions.delete(actionId)
      })
      return actionId
    },
    registerRace(definition) {
      assertAcceptingContributions()
      const raceId = namespacedId(id, definition.id)
      if (pluginRaces.has(raceId)) throw new Error(`Plugin race already registered: ${raceId}`)
      if (typeof definition.name !== 'string' || !definition.name.trim()) {
        throw new Error(`Incomplete plugin race definition: ${raceId}`)
      }
      const name = definition.name.trim()
      if (
        (DND5E_2014_RACE_OPTIONS as readonly string[]).includes(name) ||
        [...pluginRaces.values()].some((race) => race.name === name)
      ) throw new Error(`Plugin race name must be unique: ${name}`)
      if (!finiteInteger(definition.speedFeet, 0, 500)) {
        throw new Error(`Invalid plugin race speed: ${raceId}`)
      }
      if (definition.description != null && typeof definition.description !== 'string') {
        throw new Error(`Invalid plugin race description: ${raceId}`)
      }
      if (definition.size != null && definition.size !== 'small' && definition.size !== 'medium') {
        throw new Error(`Invalid plugin race size: ${raceId}`)
      }
      let parentRace: Dnd5ePluginRaceDefinition['parentRace']
      if (definition.parentRace != null) {
        if (
          !definition.parentRace || typeof definition.parentRace !== 'object' ||
          !validId(definition.parentRace.id) ||
          typeof definition.parentRace.name !== 'string' ||
          !definition.parentRace.name.trim() ||
          definition.parentRace.name.length > 160
        ) throw new Error(`Invalid plugin parent race: ${raceId}`)
        parentRace = { id: definition.parentRace.id, name: definition.parentRace.name.trim() }
      }
      const coreRaceMechanicsId = definition.coreRaceMechanicsId
      if (coreRaceMechanicsId != null && ![
        'dwarf', 'elf', 'halfling', 'human', 'dragonborn', 'gnome', 'half-elf', 'half-orc', 'tiefling',
      ].includes(coreRaceMechanicsId)) throw new Error(`Invalid plugin core race mechanics: ${raceId}`)
      const iconAssetId = ownedPluginAssetId(id, definition.iconAssetId, raceId)
      const validSkills = new Set(SKILLS.map((skill) => skill.key))
      const skillProficiencies = [...new Set(definition.skillProficiencies ?? [])]
      if (skillProficiencies.length > 6 || skillProficiencies.some((skill) => !validSkills.has(skill))) {
        throw new Error(`Invalid plugin race skills: ${raceId}`)
      }
      if (!finiteInteger(definition.skillProficiencyChoiceCount ?? 0, 0, 6)) {
        throw new Error(`Invalid plugin race skill choice count: ${raceId}`)
      }
      const armorProficiencies = [...new Set(definition.armorProficiencies ?? [])]
      if (armorProficiencies.length > 4 || armorProficiencies.some((entry) =>
        !['light', 'medium', 'heavy', 'shield'].includes(entry)
      )) throw new Error(`Invalid plugin race armor proficiencies: ${raceId}`)
      const weaponProficiencies = [...new Set(definition.weaponProficiencies ?? [])]
      if (weaponProficiencies.length > 32 || weaponProficiencies.some((entry) =>
        typeof entry !== 'string' || !validId(entry) || entry.length > 120
      )) throw new Error(`Invalid plugin race weapon proficiencies: ${raceId}`)
      const toolProficiencies = [...new Set(definition.toolProficiencies ?? [])]
      if (toolProficiencies.length > 32 || toolProficiencies.some((entry) =>
        typeof entry !== 'string' || !entry.trim() || entry.length > 120
      )) throw new Error(`Invalid plugin race tool proficiencies: ${raceId}`)
      const languages = [...new Set(definition.languages ?? [])]
      if (languages.length > 16 || languages.some((language) =>
        typeof language !== 'string' || !language.trim() || language.length > 120
      )) throw new Error(`Invalid plugin race languages: ${raceId}`)
      const grantedFeatureIds = [...new Set(definition.grantedFeatureIds ?? [])]
      if (grantedFeatureIds.length > 32 || grantedFeatureIds.some((featureId) => !validId(featureId))) {
        throw new Error(`Invalid plugin race granted features: ${raceId}`)
      }
      if (!finiteInteger(definition.featChoiceCount ?? 0, 0, 2)) {
        throw new Error(`Invalid plugin race feat choice count: ${raceId}`)
      }
      if (!finiteInteger(definition.hitPointsPerLevelBonus ?? 0, 0, 20)) {
        throw new Error(`Invalid plugin race hit-point bonus: ${raceId}`)
      }
      if (definition.naturalOneReroll != null && typeof definition.naturalOneReroll !== 'boolean') {
        throw new Error(`Invalid plugin race natural-one reroll: ${raceId}`)
      }
      const innateSpells = definition.innateSpells?.map((grant) => ({ ...grant })) ?? []
      if (
        innateSpells.length > 32 ||
        innateSpells.some((grant) =>
          !validId(grant.spellId) ||
          !finiteInteger(grant.minimumLevel, 1, 20) ||
          !ABILITY_KEYS.includes(grant.ability) ||
          !finiteInteger(grant.castAtLevel, 0, 9) ||
          (grant.resetOn !== 'at-will' && grant.resetOn !== 'long-rest')
        )
      ) throw new Error(`Invalid plugin race innate spells: ${raceId}`)
      const automation = definition.automation ?? 'full'
      if (!['full', 'partial', 'manual'].includes(automation)) {
        throw new Error(`Invalid plugin race automation level: ${raceId}`)
      }
      const automationReasons = [...new Set(definition.automationReasons ?? [])]
      if (automationReasons.length > 32 || automationReasons.some((reason) =>
        typeof reason !== 'string' || !reason.trim() || reason.length > 240
      )) throw new Error(`Invalid plugin race automation reasons: ${raceId}`)
      const traitIds = new Set<string>()
      const traits = definition.traits?.map((trait) => {
        if (
          !validId(trait.id) || traitIds.has(trait.id) ||
          typeof trait.name !== 'string' || !trait.name.trim() || trait.name.length > 160 ||
          typeof trait.description !== 'string' || !trait.description.trim() || trait.description.length > 20_000
        ) throw new Error(`Invalid plugin race trait: ${raceId}`)
        traitIds.add(trait.id)
        return { id: trait.id, name: trait.name.trim(), description: trait.description.trim() }
      })
      if (traits && traits.length > 32) throw new Error(`Too many plugin race traits: ${raceId}`)
      const staticModifiers = cloneStaticCombatModifiers(definition.staticModifiers, raceId)
      const savingThrowAdvantages = cloneRacialSavingThrowAdvantages(definition.savingThrowAdvantages, raceId)
      const flexible = definition.flexibleAbilityBonus
      if (flexible) {
        if (!finiteInteger(flexible.count, 1, 6) || !finiteInteger(flexible.amount, -10, 10) || flexible.amount === 0) {
          throw new Error(`Invalid plugin race flexible ability bonus: ${raceId}`)
        }
        const exclude = [...new Set(flexible.exclude ?? [])]
        if (exclude.some((key) => !ABILITY_KEYS.includes(key)) || flexible.count > ABILITY_KEYS.length - exclude.length) {
          throw new Error(`Invalid plugin race flexible ability choices: ${raceId}`)
        }
      }
      const registered: RegisteredDnd5ePluginRace = {
        id: raceId,
        name,
        ...(iconAssetId ? { iconAssetId } : {}),
        ...(parentRace ? { parentRace } : {}),
        ...(coreRaceMechanicsId ? { coreRaceMechanicsId } : {}),
        size: definition.size ?? 'medium',
        speedFeet: definition.speedFeet,
        abilityBonuses: cloneAbilityBonuses(definition.abilityBonuses),
        ...(skillProficiencies.length ? { skillProficiencies } : {}),
        ...(definition.skillProficiencyChoiceCount ? {
          skillProficiencyChoiceCount: definition.skillProficiencyChoiceCount,
        } : {}),
        ...(armorProficiencies.length ? { armorProficiencies } : {}),
        ...(weaponProficiencies.length ? { weaponProficiencies } : {}),
        ...(toolProficiencies.length ? {
          toolProficiencies: toolProficiencies.map((entry) => entry.trim()),
        } : {}),
        ...(languages.length ? { languages: languages.map((language) => language.trim()) } : {}),
        ...(grantedFeatureIds.length ? {
          grantedFeatureIds: grantedFeatureIds.map((featureId) => namespacedId(id, featureId)),
        } : {}),
        ...(definition.featChoiceCount ? { featChoiceCount: definition.featChoiceCount } : {}),
        ...(definition.hitPointsPerLevelBonus ? {
          hitPointsPerLevelBonus: definition.hitPointsPerLevelBonus,
        } : {}),
        ...(definition.naturalOneReroll ? { naturalOneReroll: true } : {}),
        ...(innateSpells.length ? { innateSpells } : {}),
        ...(savingThrowAdvantages ? { savingThrowAdvantages } : {}),
        ...(traits?.length ? { traits } : {}),
        ...(staticModifiers ? { staticModifiers } : {}),
        automation,
        ...(automationReasons.length ? {
          automationReasons: automationReasons.map((reason) => reason.trim()),
        } : {}),
        ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
        ...(flexible ? { flexibleAbilityBonus: {
          count: flexible.count,
          amount: flexible.amount,
          ...(flexible.exclude?.length ? { exclude: [...new Set(flexible.exclude)] } : {}),
        } } : {}),
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginRaces.set(raceId, registered)
      disposers.push(() => {
        if (pluginRaces.get(raceId) === registered) pluginRaces.delete(raceId)
      })
      return raceId
    },
    registerBackground(definition) {
      assertAcceptingContributions()
      const backgroundId = namespacedId(id, definition.id)
      if (pluginBackgrounds.has(backgroundId)) throw new Error(`Plugin background already registered: ${backgroundId}`)
      if (typeof definition.name !== 'string' || !definition.name.trim() || definition.name.length > 160) {
        throw new Error(`Incomplete plugin background definition: ${backgroundId}`)
      }
      const name = definition.name.trim()
      if ((DND5E_2014_BACKGROUND_OPTIONS as readonly string[]).includes(name) ||
        [...pluginBackgrounds.values()].some((background) => background.name === name)) {
        throw new Error(`Plugin background name must be unique: ${name}`)
      }
      const validSkills = new Set(SKILLS.map((skill) => skill.key))
      const skillProficiencies = [...new Set(definition.skillProficiencies ?? [])]
      if (skillProficiencies.length > 2 || skillProficiencies.some((skill) => !validSkills.has(skill))) {
        throw new Error(`Invalid plugin background skills: ${backgroundId}`)
      }
      const toolProficiencies = [...new Set(definition.toolProficiencies ?? [])]
      if (toolProficiencies.length > 8 || toolProficiencies.some((tool) => typeof tool !== 'string' || !tool.trim() || tool.length > 160)) {
        throw new Error(`Invalid plugin background tools: ${backgroundId}`)
      }
      const toolChoiceIds = new Set<string>()
      const toolProficiencyChoices = (definition.toolProficiencyChoices ?? []).map((choice, index) => {
        const options = [...new Set(choice?.options ?? [])]
        if (!choice || !validId(choice.id) || toolChoiceIds.has(choice.id) ||
          typeof choice.label !== 'string' || !choice.label.trim() || choice.label.length > 160 ||
          !finiteInteger(choice.count, 1, 8) || options.length < choice.count || options.length > 64 ||
          options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 160)) {
          throw new Error(`Invalid plugin background tool choice: ${backgroundId}:${index}`)
        }
        toolChoiceIds.add(choice.id)
        return {
          id: choice.id,
          label: choice.label.trim(),
          count: choice.count,
          options: options.map((option) => option.trim()),
        }
      })
      if (toolProficiencyChoices.length > 8) throw new Error(`Too many plugin background tool choices: ${backgroundId}`)
      if (!finiteInteger(definition.languages ?? 0, 0, 8)) {
        throw new Error(`Invalid plugin background languages: ${backgroundId}`)
      }
      if (definition.description != null && (typeof definition.description !== 'string' || definition.description.length > 20_000)) {
        throw new Error(`Invalid plugin background description: ${backgroundId}`)
      }
      if (definition.feature && (
        typeof definition.feature.name !== 'string' || !definition.feature.name.trim() || definition.feature.name.length > 160 ||
        typeof definition.feature.description !== 'string' || !definition.feature.description.trim() || definition.feature.description.length > 20_000
      )) throw new Error(`Invalid plugin background feature: ${backgroundId}`)
      const variantIds = new Set<string>()
      const variants = (definition.variants ?? []).map((variant, index) => {
        if (!variant || !validId(variant.id) || variantIds.has(variant.id) ||
          typeof variant.name !== 'string' || !variant.name.trim() || variant.name.length > 160 ||
          (variant.feature != null && (
            typeof variant.feature.name !== 'string' || !variant.feature.name.trim() || variant.feature.name.length > 160 ||
            typeof variant.feature.description !== 'string' || !variant.feature.description.trim() || variant.feature.description.length > 20_000
          ))) throw new Error(`Invalid plugin background variant: ${backgroundId}:${index}`)
        variantIds.add(variant.id)
        return {
          id: variant.id,
          name: variant.name.trim(),
          ...(variant.feature ? { feature: {
            name: variant.feature.name.trim(),
            description: variant.feature.description.trim(),
          } } : {}),
        }
      })
      if (variants.length > 16) throw new Error(`Too many plugin background variants: ${backgroundId}`)
      const startingEquipment = normalizeBackgroundStartingEquipment(id, backgroundId, definition.startingEquipment)
      const registered: RegisteredDnd5ePluginBackground = {
        id: backgroundId,
        name,
        ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
        skillProficiencies,
        ...(toolProficiencies.length > 0 ? { toolProficiencies: toolProficiencies.map((tool) => tool.trim()) } : {}),
        ...(toolProficiencyChoices.length > 0 ? { toolProficiencyChoices } : {}),
        ...(definition.languages ? { languages: definition.languages } : {}),
        ...(definition.feature ? { feature: {
          name: definition.feature.name.trim(),
          description: definition.feature.description.trim(),
        } } : {}),
        ...(variants.length > 0 ? { variants } : {}),
        ...(startingEquipment ? { startingEquipment } : {}),
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginBackgrounds.set(backgroundId, registered)
      disposers.push(() => {
        if (pluginBackgrounds.get(backgroundId) === registered) pluginBackgrounds.delete(backgroundId)
      })
      return backgroundId
    },
    registerAbilityGenerationMethod(definition) {
      assertAcceptingContributions()
      const methodId = namespacedId(id, definition.id)
      if (pluginAbilityGenerationMethods.has(methodId)) {
        throw new Error(`Plugin ability generation method already registered: ${methodId}`)
      }
      if (
        typeof definition.name !== 'string' || !definition.name.trim() ||
        typeof definition.summary !== 'string' || !definition.summary.trim()
      ) throw new Error(`Incomplete plugin ability generation method: ${methodId}`)
      let registered: RegisteredDnd5ePluginAbilityGeneration
      const ownership = {
        id: methodId,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      if (definition.kind === 'standard-array') {
        if (definition.scores.length !== 6 || definition.scores.some((score) => !finiteInteger(score, 1, 30))) {
          throw new Error(`Invalid plugin standard array: ${methodId}`)
        }
        registered = { ...ownership, kind: 'standard-array', name: definition.name.trim(), summary: definition.summary.trim(), scores: [...definition.scores] }
      } else if (definition.kind === 'point-buy') {
        if (
          !finiteInteger(definition.minimum, 1, 30) || !finiteInteger(definition.maximum, definition.minimum, 30) ||
          !finiteInteger(definition.budget, 0, 1_000)
        ) throw new Error(`Invalid plugin point-buy bounds: ${methodId}`)
        const costs: Record<number, number> = {}
        let previous = -1
        for (let score = definition.minimum; score <= definition.maximum; score += 1) {
          const cost = definition.costs[score]
          if (!finiteInteger(cost, 0, 1_000) || cost < previous) {
            throw new Error(`Invalid plugin point-buy cost for score ${score}: ${methodId}`)
          }
          costs[score] = cost
          previous = cost
        }
        registered = {
          ...ownership,
          kind: 'point-buy',
          name: definition.name.trim(),
          summary: definition.summary.trim(),
          budget: definition.budget,
          minimum: definition.minimum,
          maximum: definition.maximum,
          costs,
        }
      } else if (definition.kind === 'roll') {
        if (
          !finiteInteger(definition.diceCount, 1, 20) || !finiteInteger(definition.dieSides, 2, 1_000) ||
          !finiteInteger(definition.dropLowest, 0, definition.diceCount - 1)
        ) throw new Error(`Invalid plugin dice ability generation method: ${methodId}`)
        registered = {
          ...ownership,
          kind: 'roll',
          name: definition.name.trim(),
          summary: definition.summary.trim(),
          diceCount: definition.diceCount,
          dieSides: definition.dieSides,
          dropLowest: definition.dropLowest,
        }
      } else {
        throw new Error(`Invalid plugin ability generation kind: ${methodId}`)
      }
      pluginAbilityGenerationMethods.set(methodId, registered)
      disposers.push(() => {
        if (pluginAbilityGenerationMethods.get(methodId) === registered) pluginAbilityGenerationMethods.delete(methodId)
      })
      return methodId
    },
    registerSpell(definition) {
      assertAcceptingContributions()
      const spellId = namespacedId(id, definition.id)
      if (pluginSpells.has(spellId)) throw new Error(`Plugin spell already registered: ${spellId}`)
      const iconAssetId = ownedPluginAssetId(id, definition.iconAssetId, spellId)
      const automation = definition.automation ?? { mode: 'reference-only' as const }
      if (automation.mode === 'headless-action' && !validId(automation.actionId)) {
        throw new Error(`Invalid plugin spell Headless action: ${spellId}`)
      }
      if (automation.mode !== 'reference-only' && automation.mode !== 'headless-action') {
        throw new Error(`Invalid plugin spell automation mode: ${spellId}`)
      }
      const parsed = parseDnd5eSpellImport({
        format: DND5E_SPELL_IMPORT_FORMAT,
        schemaVersion: DND5E_SPELL_IMPORT_SCHEMA_VERSION,
        spells: [{
          ...definition,
          id: spellId,
          source: {
            title: plugin.manifest.name,
            publisher: plugin.manifest.publisher,
            license: plugin.manifest.license,
          },
          automation: { mode: 'reference-only' },
        }],
      }).spells[0]
      const registered: RegisteredDnd5ePluginSpell = {
        ...parsed,
        ...(iconAssetId ? { iconAssetId } : {}),
        automation: automation.mode === 'headless-action'
          ? { mode: 'headless-action', actionId: automation.actionId }
          : { mode: 'reference-only' },
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginSpells.set(spellId, registered)
      disposers.push(() => {
        if (pluginSpells.get(spellId) === registered) pluginSpells.delete(spellId)
      })
      return spellId
    },
    registerItem(definition) {
      assertAcceptingContributions()
      const itemId = namespacedId(id, definition.id)
      if (pluginItems.has(itemId)) throw new Error(`Plugin item already registered: ${itemId}`)
      const registered = clonePluginItemDefinition(plugin.manifest, definition, itemId, ownedPluginAssetId)
      pluginItems.set(itemId, registered)
      disposers.push(() => {
        if (pluginItems.get(itemId) === registered) pluginItems.delete(itemId)
      })
      return itemId
    },
    registerMonster(definition) {
      assertAcceptingContributions()
      const parsed = parseDnd5eMonsterStatBlock(structuredClone(definition))
      if (!parsed.ok) {
        throw new Error(`Invalid plugin monster ${definition?.id ?? 'unknown'}: ${parsed.issues[0]?.message ?? 'invalid stat block'}`)
      }
      if (parsed.value.source !== 'DM 自定义') {
        throw new Error(`Plugin monster must be marked as DM custom: ${parsed.value.id}`)
      }
      if (pluginMonsters.has(parsed.value.id)) throw new Error(`Plugin monster already registered: ${parsed.value.id}`)
      const registered: RegisteredDnd5ePluginMonster = {
        ...parsed.value,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginMonsters.set(registered.id, registered)
      const unregisterCatalog = registerDnd5ePluginMonsterCatalogEntry(registered)
      disposers.push(() => {
        if (pluginMonsters.get(registered.id) === registered) pluginMonsters.delete(registered.id)
        unregisterCatalog()
      })
      return registered.id
    },
  }

  try {
    const pluginDispose = plugin.setup(api)
    if (pluginDispose) disposers.push(pluginDispose)
    for (const feature of pluginFeatures.values()) {
      if (
        feature.ownerPluginId === id &&
        feature.automation === 'full' &&
        feature.action &&
        !headlessActions.has(`${id}:${feature.action.id}`)
      ) {
        throw new Error(`Fully automated plugin feature is missing its Headless action: ${feature.id}`)
      }
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  } finally {
    acceptingContributions = false
  }

  let active = true
  const registered: RegisteredDnd5ePluginRuntime = {
    plugin,
    integrity: options.integrity,
    adapterKind: options.adapterKind ?? 'legacy-api-adapter',
    dispose() {
      if (!active) return
      active = false
      for (const dispose of disposers.reverse()) dispose()
      plugins.delete(id)
      publishPluginRegistryChange()
    },
  }
  plugins.set(id, registered)
  publishPluginRegistryChange()
  return registered.dispose
}

function cloneRegisteredStaticModifiers(
  value: Dnd5ePluginStaticCombatModifiers | undefined,
): Dnd5ePluginStaticCombatModifiers | undefined {
  return value ? {
    ...value,
    opportunityAttacksOnEnterReachWeaponIds: value.opportunityAttacksOnEnterReachWeaponIds
      ? [...value.opportunityAttacksOnEnterReachWeaponIds]
      : undefined,
    damageResistances: value.damageResistances ? [...value.damageResistances] : undefined,
    damageImmunities: value.damageImmunities ? [...value.damageImmunities] : undefined,
    conditionImmunities: value.conditionImmunities ? [...value.conditionImmunities] : undefined,
  } : undefined
}

export function dnd5ePluginFeaturesAvailableForCharacter(
  character: Character,
): readonly RegisteredDnd5ePluginFeature[] {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    dnd5ePluginFeatureAvailableForCharacter(feature, character),
  )
}

export function dnd5eEnemyD20ModifierFeaturesForCharacter(
  character: Character,
): readonly RegisteredDnd5ePluginFeature[] {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    feature.canModifyEnemyD20 === true &&
    dnd5eCharacterHasPluginFeature(character, feature.id) &&
    (
      feature.declarativeAbility?.mechanic?.kind !== 'stored-d20-replacement' ||
      (character.dnd5eCombatState?.declarativeStoredD20ByFeatureId?.[feature.id]?.length ?? 0) > 0
    ),
  )
}

/** Host-side spell-attack range multiplier shared by feats and custom Workshop content. */
export function dnd5eSpellAttackRangeMultiplierForCharacter(character: Character): number {
  return registeredDnd5ePluginFeatures().reduce((maximum, feature) => {
    if (
      feature.automation === 'manual' ||
      !dnd5eCharacterHasPluginFeature(character, feature.id) ||
      !dnd5ePluginFeatureAvailableForCharacter(feature, character)
    ) return maximum
    return Math.max(maximum, feature.staticModifiers?.spellAttackRangeMultiplier ?? 1)
  }, 1)
}

type Dnd5eAlternateResourceSpellcastingMechanic = Extract<
  NonNullable<DeclarativeSubclassAbilityV1['mechanic']>,
  { kind: 'alternate-resource-spellcasting' }
>

export interface Dnd5eAlternateResourceSpellGrantForCharacter {
  featureId: string
  featureName: string
  grantId: string
  spellId: string
  ability: AbilityKey
  classId: Dnd5eClassId
  resourceId: string
  resourceCost: number
  castAtLevel: number
  castLevelOptions: readonly { slotLevel: number; resourceCost: number }[]
  ignoreMaterialComponents: boolean
}

function alternateSpellSelectionMatches(
  character: Character,
  feature: RegisteredDnd5ePluginFeature,
  selection: Dnd5eAlternateResourceSpellcastingMechanic['grants'][number]['selection'],
): boolean {
  if (!selection) return true
  if (!feature.sourceClassId || !feature.sourceSubclassId) return false
  const key = `${feature.sourceSubclassId}/${selection.groupId}`
  const selected = feature.sourceClassId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.extensionChoices?.[key]
    : character.dnd5eClassChoices?.classes?.[feature.sourceClassId]?.selections?.[key]
  return selected?.includes(selection.optionId) === true
}

export function dnd5eAlternateResourceSpellCost(
  grant: Dnd5eAlternateResourceSpellcastingMechanic['grants'][number],
  slotLevel: number,
): number | undefined {
  if (!Number.isInteger(slotLevel) || slotLevel < grant.castAtLevel || slotLevel > 9) return undefined
  if (slotLevel === grant.castAtLevel) return grant.resourceCost
  if (!grant.upcast) return undefined
  return grant.resourceCost +
    (slotLevel - grant.castAtLevel) * grant.upcast.resourcePerSlotLevel
}

function alternateSpellMaximumResourceCost(
  grant: Dnd5eAlternateResourceSpellcastingMechanic['grants'][number],
  classLevel: number,
): number {
  return grant.upcast?.maximumResourceCostByClassLevel.reduce(
    (maximum, step) => classLevel >= step.level ? step.maximumResourceCost : maximum,
    grant.resourceCost,
  ) ?? grant.resourceCost
}

/**
 * Lists only resource-spell grants that the character actually owns and has
 * selected. Spell rules are deliberately not copied into this projection.
 */
export function dnd5eAlternateResourceSpellsForCharacter(
  character: Character,
): readonly Dnd5eAlternateResourceSpellGrantForCharacter[] {
  return dnd5ePluginFeaturesAvailableForCharacter(character).flatMap((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      feature.automation !== 'full' || mechanic?.kind !== 'alternate-resource-spellcasting' ||
      !dnd5eCharacterHasPluginFeature(character, feature.id)
    ) return []
    const classLevel = dnd5eCharacterClassLevel(character, mechanic.classId)
    const resourceId = mechanic.resourceScope === 'plugin'
        ? dnd5eDeclarativeResourceKey(feature.ownerPluginId, {
          resourceId: mechanic.resourceId,
          scope: 'plugin',
        })
      : mechanic.resourceId
    return mechanic.grants.flatMap((grant) => {
      if (
        classLevel < (grant.minimumLevel ?? feature.minimumLevel ?? 1) ||
        !alternateSpellSelectionMatches(character, feature, grant.selection)
      ) return []
      const maximumCost = alternateSpellMaximumResourceCost(grant, classLevel)
      const castLevelOptions = Array.from({ length: 10 }, (_, slotLevel) => {
        const resourceCost = dnd5eAlternateResourceSpellCost(grant, slotLevel)
        return resourceCost != null && resourceCost <= maximumCost
          ? { slotLevel, resourceCost }
          : undefined
      }).filter((option): option is { slotLevel: number; resourceCost: number } => !!option)
      return [{
        featureId: feature.id,
        featureName: feature.name,
        grantId: grant.id,
        spellId: grant.spellId,
        ability: mechanic.ability,
        classId: mechanic.classId,
        resourceId,
        resourceCost: grant.resourceCost,
        castAtLevel: grant.castAtLevel,
        castLevelOptions,
        ignoreMaterialComponents: mechanic.ignoreMaterialComponents === true,
      }]
    })
  }).sort((left, right) =>
    left.featureName.localeCompare(right.featureName, 'zh-CN') ||
    left.spellId.localeCompare(right.spellId),
  )
}

export function dnd5eAlternateResourceSpellForCharacter(input: {
  character: Character
  featureId: string
  grantId: string
  spellId: string
  slotLevel: number
}): Dnd5eAlternateResourceSpellGrantForCharacter | undefined {
  return dnd5eAlternateResourceSpellsForCharacter(input.character).find((grant) =>
    grant.featureId === input.featureId && grant.grantId === input.grantId &&
    grant.spellId === input.spellId &&
    grant.castLevelOptions.some((option) => option.slotLevel === input.slotLevel),
  )
}

/** Host/UI shared projection for data-only bonuses to selected spell ability checks. */
export function dnd5ePluginSpellAbilityCheckBonus(input: {
  pluginFeatureIds?: readonly string[]
  spellId: string
  proficiencyBonus: number
}): number {
  if (!Number.isInteger(input.proficiencyBonus) || input.proficiencyBonus < 0) return 0
  const owned = new Set(input.pluginFeatureIds ?? [])
  const applies = registeredDnd5ePluginFeatures().some((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    return owned.has(feature.id) && feature.automation === 'full' &&
      mechanic?.kind === 'spell-ability-check-bonus' && mechanic.bonus === 'proficiency' &&
      mechanic.spellIds.includes(input.spellId)
  })
  return applies ? input.proficiencyBonus : 0
}

/** Returns the bounded extra-target allowance for a matching single-target class spell. */
export function dnd5ePluginSpellTargetExpansionForCharacter(input: {
  character: Character
  spellcastingClassId?: Dnd5eClassId
  spellSchool?: Dnd5eSpellbookSchoolId
  baseMaximumTargets: number
}): number {
  const spellcastingClassId = input.spellcastingClassId
  const spellSchool = input.spellSchool
  if (!spellcastingClassId || !spellSchool || input.baseMaximumTargets !== 1) return 0
  return dnd5ePluginFeaturesAvailableForCharacter(input.character).reduce((maximum, feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      feature.automation !== 'full' || mechanic?.kind !== 'spell-target-expansion' ||
      !dnd5eCharacterHasPluginFeature(input.character, feature.id) ||
      mechanic.spellcastingClassId !== spellcastingClassId ||
      !mechanic.spellSchools.includes(spellSchool) ||
      mechanic.baseMaximumTargets !== input.baseMaximumTargets
    ) return maximum
    return Math.max(maximum, mechanic.additionalTargets)
  }, 0)
}

/** Resolves one explicitly selected generic damage-maximization feature. */
export function dnd5ePluginDamageRollMaximizationForCharacter(input: {
  character: Character
  featureId?: string
  delivery: 'weapon-attack' | 'spell' | 'feature'
  damageType?: Dnd5eDamageType
}): RegisteredDnd5ePluginFeature | undefined {
  if (!input.featureId || !input.damageType) return undefined
  return dnd5ePluginFeaturesAvailableForCharacter(input.character).find((feature) => {
    const ability = feature.declarativeAbility
    const mechanic = ability?.mechanic
    if (
      feature.id !== input.featureId || feature.automation === 'manual' ||
      mechanic?.kind !== 'damage-roll-maximization' ||
      !mechanic.deliveries.includes(input.delivery) || !mechanic.damageTypes.includes(input.damageType!) ||
      !dnd5eCharacterHasPluginFeature(input.character, feature.id)
    ) return false
    return (ability?.cost?.resources ?? []).every((cost) => {
      const resourceId = cost.scope === 'core'
        ? cost.resourceId
        : dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost)
      return (input.character.classResources?.[resourceId]?.current ?? 0) >= cost.amount
    })
  })
}

function declarativeFormulaForCharacter(formula: DeclarativeValueFormulaV1, character: Character): number {
  if (formula.kind === 'fixed') return formula.value
  let value: number
  if (formula.kind === 'proficiency-bonus') value = Math.ceil(character.level / 4) + 1
  else if (formula.kind === 'ability-modifier') value = Math.floor((character.abilities[formula.ability] - 10) / 2)
  else value = Math.floor(dnd5eCharacterClassLevel(character, formula.classId) / (formula.divisor ?? 1))
  return Math.max(formula.minimum ?? Number.NEGATIVE_INFINITY, value * (formula.multiplier ?? 1))
}

/** Shared Character/UI companion to the Headless creature-form eligibility check. */
export function dnd5ePluginCreatureFormRuleForCharacter(
  character: Character,
  form: Dnd5eMonsterStatBlock,
): Extract<NonNullable<DeclarativeSubclassAbilityV1['mechanic']>, { kind: 'creature-form-eligibility' }> | undefined {
  const actualType = form.creatureType.trim().toLocaleLowerCase()
  return [...dnd5ePluginFeaturesAvailableForCharacter(character)]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (feature.automation !== 'full' || mechanic?.kind !== 'creature-form-eligibility' || mechanic.system !== 'wild-shape') {
      return []
    }
    if (!mechanic.creatureTypes.some((type) => {
      const expected = type.trim().toLocaleLowerCase()
      return actualType === expected ||
        ((expected === 'beast' || expected.includes('野兽')) && (actualType === 'beast' || actualType.includes('野兽')))
    })) return []
    if (mechanic.specificFormIds && !mechanic.specificFormIds.includes(form.id)) return []
    if (dnd5eChallengeRatingValue(form.challenge.rating) > declarativeFormulaForCharacter(mechanic.maximumChallengeRating, character)) {
      return []
    }
    if (mechanic.useCoreMovementLimits) {
      const limits = dnd5eDruidWildShapeLimits(dnd5eCharacterClassLevel(character, 'druid'))
      if ((!limits.swim && form.speed.swim != null) || (!limits.fly && form.speed.fly != null)) return []
    }
    return [mechanic]
  })[0]
}

export function dnd5ePluginCreatureFormEligibleForCharacter(
  character: Character,
  form: Dnd5eMonsterStatBlock,
): boolean {
  return dnd5ePluginCreatureFormRuleForCharacter(character, form) != null
}

export function dnd5ePluginCreatureFormBypassesKnownForCharacter(
  character: Character,
  form: Dnd5eMonsterStatBlock,
): boolean {
  return dnd5ePluginCreatureFormRuleForCharacter(character, form)?.requiresKnownForm === false
}

export function dnd5ePluginCreatureFormControlForCharacter(
  character: Character,
): Extract<NonNullable<DeclarativeSubclassAbilityV1['mechanic']>, { kind: 'creature-form-control' }> | undefined {
  return [...dnd5ePluginFeaturesAvailableForCharacter(character)]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((feature) => {
      const mechanic = feature.declarativeAbility?.mechanic
      return feature.automation === 'full' && mechanic?.kind === 'creature-form-control' &&
        mechanic.system === 'wild-shape' && dnd5eCharacterHasPluginFeature(character, feature.id)
        ? [mechanic]
        : []
    })[0]
}

function dnd5ePluginAbilityUsesResourceId(feature: RegisteredDnd5ePluginFeature): string | undefined {
  if (!feature.sourceSubclassId || !feature.declarativeAbility?.id) return undefined
  const prefix = `${feature.ownerPluginId}:`
  if (!feature.sourceSubclassId.startsWith(prefix)) return undefined
  return `${feature.ownerPluginId}:decl-${feature.sourceSubclassId.slice(prefix.length)}-${feature.declarativeAbility.id}-uses`
}

/** Returns the generic post-Attack bonus-weapon-attack entitlement currently available to a character. */
export function dnd5ePluginBonusWeaponAttackForCharacter(
  character: Character,
  turnKey: string,
): RegisteredDnd5ePluginFeature | undefined {
  return [...dnd5ePluginFeaturesAvailableForCharacter(character)]
    .sort((left, right) => left.id.localeCompare(right.id))
    .find((feature) => {
      const ability = feature.declarativeAbility
      if (
        feature.automation !== 'full' || ability?.mechanic?.kind !== 'bonus-weapon-attack' ||
        !dnd5eCharacterHasPluginFeature(character, feature.id) ||
        character.dnd5eCombatState?.weaponAttackActionTurnKey !== turnKey
      ) return false
      const usesResourceId = dnd5ePluginAbilityUsesResourceId(feature)
      if (!usesResourceId || (character.classResources?.[usesResourceId]?.current ?? 0) < (ability.cost?.uses ?? 1)) {
        return false
      }
      return (ability.cost?.resources ?? []).every((cost) => {
        const resourceId = cost.scope === 'core'
          ? cost.resourceId
          : dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost)
        return (character.classResources?.[resourceId]?.current ?? 0) >= cost.amount
      })
    })
}

export interface Dnd5eStoredD20ReplacementFeature {
  feature: RegisteredDnd5ePluginFeature
  count: number
  values: readonly number[]
}

export function dnd5eStoredD20ReplacementFeaturesForCharacter(
  character: Character,
): readonly Dnd5eStoredD20ReplacementFeature[] {
  return registeredDnd5ePluginFeatures().flatMap((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      feature.automation !== 'full' || mechanic?.kind !== 'stored-d20-replacement' ||
      !dnd5eCharacterHasPluginFeature(character, feature.id)
    ) return []
    const classLevel = feature.sourceClassId
      ? dnd5eCharacterClassLevel(character, feature.sourceClassId)
      : character.level
    const count = (mechanic.countByClassLevel ?? []).reduce(
      (current, step) => classLevel >= step.level ? step.count : current,
      mechanic.count,
    )
    return [{
      feature,
      count,
      values: [...(character.dnd5eCombatState?.declarativeStoredD20ByFeatureId?.[feature.id] ?? [])],
    }]
  })
}

export function consumeDnd5eStoredD20Replacement(
  character: Character,
  featureId: string,
  value: number,
): Character | undefined {
  const storedByFeature = character.dnd5eCombatState?.declarativeStoredD20ByFeatureId
  const stored = storedByFeature?.[featureId] ?? []
  const consumedIndex = stored.indexOf(value)
  if (consumedIndex < 0) return undefined
  return {
    ...character,
    dnd5eCombatState: {
      ...character.dnd5eCombatState,
      declarativeStoredD20ByFeatureId: {
        ...storedByFeature,
        [featureId]: stored.filter((_, index) => index !== consumedIndex),
      },
    },
  }
}

export function dnd5ePostD20AdjustmentFeaturesForCharacter(
  character: Character,
) {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    feature.automation === 'full' &&
    feature.declarativeAbility?.mechanic?.kind === 'post-d20-adjustment' &&
    dnd5eCharacterHasPluginFeature(character, feature.id),
  )
}

export function dnd5eAttackDisadvantageInterruptFeaturesForCharacter(
  character: Character,
) {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    feature.automation === 'full' &&
    feature.declarativeAbility?.mechanic?.kind === 'attack-disadvantage-interrupt' &&
    dnd5eCharacterHasPluginFeature(character, feature.id),
  )
}

export function dnd5eAttackRetargetInterruptFeaturesForCharacter(
  character: Character,
) {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    feature.automation === 'full' &&
    feature.declarativeAbility?.mechanic?.kind === 'attack-retarget-interrupt' &&
    dnd5eCharacterHasPluginFeature(character, feature.id),
  )
}

export function dnd5eDamageMitigationInterruptFeaturesForCharacter(
  character: Character,
) {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    feature.automation === 'full' &&
    feature.declarativeAbility?.mechanic?.kind === 'damage-mitigation-interrupt' &&
    dnd5eCharacterHasPluginFeature(character, feature.id),
  )
}

export type Dnd5eD20ChoiceRerollRollKind = 'attack' | 'ability-check' | 'saving-throw'
export type Dnd5eD20ChoiceRerollScope = 'self-roll' | 'attack-against-self'

export interface Dnd5eD20ChoiceRerollFeature {
  feature: RegisteredDnd5ePluginFeature
  resourceCosts: readonly { resourceKey: string; amount: number }[]
  additionalDice: 1 | 2
  selectionPolicy: 'owner-chooses' | 'highest' | 'lowest' | 'must-use-latest'
}

export function dnd5eD20ChoiceRerollFeaturesForCharacter(
  character: Character,
  rollKind: Dnd5eD20ChoiceRerollRollKind,
  scope: Dnd5eD20ChoiceRerollScope,
): readonly Dnd5eD20ChoiceRerollFeature[] {
  if (scope === 'attack-against-self' && rollKind !== 'attack') return []
  return registeredDnd5ePluginFeatures().flatMap((feature) => {
    const ability = feature.declarativeAbility
    const mechanic = ability?.mechanic
    if (
      feature.automation !== 'full' ||
      mechanic?.kind !== 'd20-choice-reroll' ||
      !mechanic.rollKinds.includes(rollKind) ||
      !mechanic.scopes.includes(scope) ||
      !dnd5eCharacterHasPluginFeature(character, feature.id)
    ) return []
    const resourceCosts = (ability?.cost?.resources ?? []).map((cost) => ({
      resourceKey: cost.scope === 'core'
        ? cost.resourceId
        : dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost),
      amount: cost.amount,
    }))
    if (
      resourceCosts.length < 1 ||
      resourceCosts.some((cost) =>
        (character.classResources?.[cost.resourceKey]?.current ?? 0) < cost.amount)
    ) return []
    return [{ feature, resourceCosts, additionalDice: mechanic.additionalDice, selectionPolicy: mechanic.selection }]
  })
}

/**
 * Returns the strongest core or imported Extra Attack declaration. Imported
 * features are passive data; the client cannot supply an attack count.
 */
export function dnd5eEffectiveAttacksPerAttackAction(character: Character): number {
  let attacks = dnd5eAttacksPerAttackAction(character)
  for (const feature of registeredDnd5ePluginFeatures()) {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      feature.automation !== 'full' || mechanic?.kind !== 'attacks-per-action' ||
      !dnd5eCharacterHasPluginFeature(character, feature.id)
    ) continue
    attacks = Math.max(attacks, mechanic.attacks)
  }
  return attacks
}

export interface Dnd5eDeclarativeAttackIntentDefinition {
  feature: RegisteredDnd5ePluginFeature
  hook: DeclarativeSubclassCombatHookV1 & {
    activation: 'prearm'
    retention: 'single-attempt' | 'until-triggered' | 'until-turn-end'
  }
}

export interface Dnd5eDeclarativeCombatManeuverDefinition {
  feature: RegisteredDnd5ePluginFeature
  mechanic: DeclarativeCombatManeuverMechanicV1
  resourceId: string
}

export interface Dnd5eDeclarativeAttackTradeoffDefinition {
  feature: RegisteredDnd5ePluginFeature
  mechanic: DeclarativeAttackTradeoffMechanicV1
}

export function dnd5eDeclarativeAttackTradeoffDefinition(
  featureId: string,
): Dnd5eDeclarativeAttackTradeoffDefinition | undefined {
  const feature = pluginFeatures.get(featureId)
  const mechanic = feature?.declarativeAbility?.mechanic
  if (
    !feature || feature.automation === 'manual' || feature.declarativeAbility?.automation !== 'full' ||
    mechanic?.kind !== 'attack-tradeoff'
  ) return undefined
  return {
    feature: {
      ...feature,
      action: clonePluginFeatureAction(feature.action),
      declarativeAbility: structuredClone(feature.declarativeAbility),
      automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
      passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
    },
    mechanic: structuredClone(mechanic),
  }
}

export function dnd5eDeclarativeCombatManeuverDefinition(
  featureId: string,
): Dnd5eDeclarativeCombatManeuverDefinition | undefined {
  const feature = pluginFeatures.get(featureId)
  const mechanic = feature?.declarativeAbility?.mechanic
  if (
    !feature ||
    feature.automation !== 'full' ||
    mechanic?.kind !== 'combat-maneuver'
  ) return undefined
  return {
    feature: {
      ...feature,
      action: feature.action ? clonePluginFeatureAction(feature.action) : undefined,
      declarativeAbility: feature.declarativeAbility
        ? structuredClone(feature.declarativeAbility)
        : undefined,
      automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
      passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
    },
    mechanic: structuredClone(mechanic),
    resourceId: namespacedId(feature.ownerPluginId, mechanic.resourceId),
  }
}

export type Dnd5eDeclarativeAttackIntentRollPlan =
  | {
      ok: true
      featureId: string
      featureName: string
      declarations: readonly Dnd5ePluginDiceRollDeclaration[]
    }
  | {
      ok: false
      reason: 'invalid-plugin-action' | 'class-resource-unavailable'
    }

function declarativeCombatHookActivation(
  hook: DeclarativeSubclassCombatHookV1,
): 'automatic' | 'prearm' | 'interrupt' {
  return hook.activation ?? (hook.decision === 'automatic' ? 'automatic' : 'interrupt')
}

/**
 * Resolves a client-supplied feature ID back to Host-owned hook metadata.
 * The caller never gets to declare timing, activation, or retention itself.
 */
export function dnd5eDeclarativeAttackIntentDefinition(
  featureId: string,
): Dnd5eDeclarativeAttackIntentDefinition | undefined {
  const feature = pluginFeatures.get(featureId)
  const ability = feature?.declarativeAbility
  const hostManagedAttackModifier = ability?.mechanic?.kind === 'damage-roll-maximization' ||
    ability?.mechanic?.kind === 'attack-tradeoff'
  const componentIsFullyAutomated = feature?.automation === 'full' ||
    (feature?.automation === 'partial' && ability?.automation === 'full' &&
      ability.mechanic?.kind === 'attack-tradeoff')
  if (
    !feature || !ability || !componentIsFullyAutomated ||
    (!feature.action && !hostManagedAttackModifier)
  ) return undefined
  if (feature.sourceFeatId && ability.mechanic?.kind === 'attack-tradeoff') {
    return {
      feature: {
        ...feature,
        action: clonePluginFeatureAction(feature.action),
        declarativeAbility: structuredClone(ability),
        automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
        staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
        passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
      },
      hook: {
        id: `${ability.id}-prearm`,
        timing: 'before-attack-roll',
        abilityId: ability.id,
        decision: 'actor-choice',
        activation: 'prearm',
        retention: 'single-attempt',
        exclusiveGroup: 'attack-roll-tradeoff',
      },
    }
  }
  for (const subclass of pluginSubclasses.values()) {
    const subclassFeature = subclass.features.find((entry) => entry.featureId === featureId)
    if (!subclassFeature) continue
    const hook = subclass.declarativeCombatHooks?.find((entry) =>
      entry.abilityId === ability.id &&
      ['before-attack-roll', 'after-attack-roll', 'after-attack-hit'].includes(entry.timing) &&
      declarativeCombatHookActivation(entry) === 'prearm',
    )
    if (!hook) return undefined
    return {
      feature: {
        ...feature,
        action: clonePluginFeatureAction(feature.action),
        declarativeAbility: structuredClone(ability),
        automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
        staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
        passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
      },
      hook: {
        ...structuredClone(hook),
        activation: 'prearm',
        retention: hook.retention ?? 'single-attempt',
      },
    }
  }
  return undefined
}

function declarativeDiceCountForCombatant(
  dice: DeclarativeDiceFormulaV1,
  actor: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels'>,
): number {
  if (!dice.scaling) return dice.count
  const scalingLevel = dice.scaling.basis === 'character-level'
    ? actor.level
    : actor.classLevels?.[dice.scaling.classId!] ??
      (actor.classId === dice.scaling.classId ? actor.level : 0)
  return dice.count + dice.scaling.steps.reduce(
    (total, step) => total + (scalingLevel >= step.level ? step.addDice : 0),
    0,
  )
}

function declarativeFeatureRollPlan(
  actor: Pick<Dnd5eCombatant,
    'level' | 'classId' | 'classLevels' | 'classResources' |
    'subclassIds' | 'combatManeuverDieSidesOverride'>,
  feature: RegisteredDnd5ePluginFeature,
  critical: boolean,
): Dnd5eDeclarativeAttackIntentRollPlan {
  const ability = feature.declarativeAbility
  const hostManagedAttackModifier = ability?.mechanic?.kind === 'damage-roll-maximization' ||
    ability?.mechanic?.kind === 'attack-tradeoff'
  if (!ability || (!feature.action && !hostManagedAttackModifier)) {
    return { ok: false, reason: 'invalid-plugin-action' }
  }
  const pluginId = feature.ownerPluginId
  const requiredResources = [
    ...(ability.predicates?.resources ?? []).map((requirement) => ({
      resourceId: dnd5eDeclarativeResourceKey(pluginId, requirement),
      amount: requirement.minimum,
    })),
    ...(ability.cost?.resources ?? []).map((cost) => ({
      resourceId: dnd5eDeclarativeResourceKey(pluginId, cost),
      amount: cost.amount,
    })),
  ]
  if (requiredResources.some(({ resourceId, amount }) =>
    !actor.classResources[resourceId] ||
    actor.classResources[resourceId].current < amount
  )) return { ok: false, reason: 'class-resource-unavailable' }

  const declarations: Dnd5ePluginDiceRollDeclaration[] = []
  if (ability.mechanic?.kind === 'post-d20-adjustment' && ability.mechanic.dieSides != null) {
    declarations.push({
      id: DND5E_POST_D20_ADJUSTMENT_ROLL_ID,
      label: ability.name,
      count: 1,
      sides: ability.mechanic.dieSides,
      modifier: 0,
      visibility: 'public',
    })
  }
  for (const roll of ability.rolls ?? []) {
    if (roll.kind !== 'damage' && roll.kind !== 'healing') continue
    const baseCount = declarativeDiceCountForCombatant(roll.dice, actor)
    if (baseCount < 1) continue
    let sides = roll.dice.sides
    if (roll.hostRoll) {
      const resourceId = namespacedId(pluginId, roll.hostRoll.die.resourceId)
      const resource = pluginResources.get(resourceId)
      if (
        !resource ||
        resource.ownerPluginId !== pluginId ||
        !resource.declarativeDie
      ) return { ok: false, reason: 'invalid-plugin-action' }
      const classLevel = actor.classLevels?.[resource.classId] ??
        (actor.classId === resource.classId ? actor.level : 0)
      sides = declarativeSubclassResourceDieSidesV1(resource.declarativeDie, classLevel)
      const ownsResourceSubclass = actor.subclassIds?.[resource.classId] === resource.subclassId
      if (!ownsResourceSubclass && actor.combatManeuverDieSidesOverride != null) {
        sides = actor.combatManeuverDieSidesOverride
      }
    }
    const count = roll.kind === 'damage' &&
      roll.hostRoll?.critical === 'double-dice' &&
      critical
      ? baseCount * 2
      : baseCount
    if (!Number.isInteger(count) || count < 1 || count > 24) {
      return { ok: false, reason: 'invalid-plugin-action' }
    }
    declarations.push({
      id: roll.id,
      label: roll.label,
      count,
      sides,
      modifier: 0,
      visibility: 'public',
    })
  }
  return {
    ok: true,
    featureId: feature.id,
    featureName: feature.name,
    declarations,
  }
}

/** Builds authoritative dynamic declarations for an active declarative feature. */
export function dnd5eDeclarativePluginFeatureRollPlan(
  actor: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'classResources'>,
  featureId: string,
): Dnd5eDeclarativeAttackIntentRollPlan {
  const feature = pluginFeatures.get(featureId)
  if (
    !feature ||
    !feature.declarativeAbility ||
    feature.declarativeAbility.trigger.kind !== 'active-use'
  ) return { ok: false, reason: 'invalid-plugin-action' }
  return declarativeFeatureRollPlan(actor, feature, false)
}

/** Builds authoritative dice declarations for a whitelisted combat-maneuver operation. */
export function dnd5eDeclarativeCombatManeuverRollPlan(
  actor: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'classResources'>,
  featureId: string,
  critical = false,
): Dnd5eDeclarativeAttackIntentRollPlan {
  const definition = dnd5eDeclarativeCombatManeuverDefinition(featureId)
  if (!definition) return { ok: false, reason: 'invalid-plugin-action' }
  return declarativeFeatureRollPlan(actor, definition.feature, critical)
}

/**
 * Builds the only accepted dice declarations for a prearmed after-hit intent.
 * Die size and scaling come from Host-registered resource metadata, never from
 * the attack request. Resource availability is checked before the Host rolls.
 */
export function dnd5eDeclarativeAttackIntentRollPlan(
  actor: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'classResources'>,
  featureId: string,
  critical: boolean,
): Dnd5eDeclarativeAttackIntentRollPlan {
  const intent = dnd5eDeclarativeAttackIntentDefinition(featureId)
  if (!intent) return { ok: false, reason: 'invalid-plugin-action' }
  return declarativeFeatureRollPlan(actor, intent.feature, critical)
}

export function dnd5eDeclarativeAttackIntentsForCharacter(
  character: Character,
): readonly Dnd5eDeclarativeAttackIntentDefinition[] {
  return registeredDnd5ePluginFeatures().flatMap((feature) => {
    if (!dnd5eCharacterHasPluginFeature(character, feature.id)) return []
    const definition = dnd5eDeclarativeAttackIntentDefinition(feature.id)
    return definition ? [definition] : []
  })
}

export function dnd5eDeclarativeAttackIntentResolution(
  requestedFeatureIds: readonly string[] | undefined,
  events: readonly Dnd5eCombatEvent[],
): { triggeredFeatureIds: string[]; consumedFeatureIds: string[] } | undefined {
  if (!requestedFeatureIds?.length) return undefined
  const requested = [...new Set(requestedFeatureIds)]
  const requestedSet = new Set(requested)
  const triggeredFeatureIds = [...new Set(events.flatMap((event) =>
    (
      event.type === 'declarative-subclass-ability-resolved' ||
      event.type === 'declarative-subclass-trigger-rejected'
    ) &&
    requestedSet.has(event.abilityId)
      ? [event.abilityId]
      : [],
  ))]
  const triggered = new Set(triggeredFeatureIds)
  const consumedFeatureIds = requested.filter((featureId) => {
    const definition = dnd5eDeclarativeAttackIntentDefinition(featureId)
    if (!definition || definition.hook.retention === 'until-turn-end') return false
    return definition.hook.retention === 'single-attempt' || triggered.has(featureId)
  })
  return { triggeredFeatureIds, consumedFeatureIds }
}

/** Builds deterministic Host-owned trigger actions from authoritative events and prearmed intent IDs. */
export function dnd5eDeclarativeTriggeredActions(
  state: Dnd5eHeadlessCombatState,
  event: Dnd5eCombatEvent,
  eventIndex: number,
): Dnd5ePluginAction[] {
  if (event.type === 'turn-started') {
    const actor = state.combatants[event.actorId]
    if (!actor) return []
    return [...pluginFeatures.values()].flatMap((feature) => {
      const ability = feature.declarativeAbility
      if (
        !ability ||
        feature.automation !== 'full' ||
        ability.trigger.kind !== 'turn-start' ||
        !feature.action ||
        !actor.pluginFeatureIds.includes(feature.id)
      ) return []
      const transactionPrefix =
        `decl-trigger:${state.combatId}:${state.round}:${feature.id}:${actor.id}:turn-start`
      const transactionSequence = (actor.classState.declarativeTransactionIds ?? [])
        .filter((transactionId) => transactionId.startsWith(`${transactionPrefix}:`))
        .length
      return [{
        type: 'plugin' as const,
        pluginId: feature.ownerPluginId,
        actionId: feature.action.id,
        featureId: feature.id,
        transactionId: `${transactionPrefix}:${transactionSequence}:${eventIndex}`,
        actorId: actor.id,
        targetId: actor.id,
        targetIds: [actor.id],
        distanceFeet: 0,
        rolls: {},
      }]
    })
  }
  if (event.type !== 'attack-resolved' || !event.hit) return []
  const actor = state.combatants[event.actorId]
  const target = state.combatants[event.targetId]
  if (!actor || !target) return []
  const pairKey = actor.id < target.id ? `${actor.id}\u0000${target.id}` : `${target.id}\u0000${actor.id}`
  return [...pluginFeatures.values()].flatMap((feature) => {
    const ability = feature.declarativeAbility
    if (
      !ability || feature.automation !== 'full' || ability.trigger.kind !== 'after-attack-hit' ||
      ability.mechanic?.kind === 'combat-maneuver' ||
      ability.mechanic?.kind === 'damage-roll-maximization' ||
      !feature.action || !actor.pluginFeatureIds.includes(feature.id)
    ) return []
    const subclass = [...pluginSubclasses.values()].find((entry) =>
      entry.features.some((subclassFeature) => subclassFeature.featureId === feature.id),
    )
    const hooks = subclass?.declarativeCombatHooks?.filter((hook) => hook.abilityId === ability.id) ?? []
    if (hooks.length > 0) {
      const hook = hooks.find((entry) => entry.timing === 'after-attack-hit')
      if (!hook) return []
      const activation = declarativeCombatHookActivation(hook)
      if (activation === 'interrupt') return []
      if (
        activation === 'prearm' &&
        !event.declarativeIntentFeatureIds?.includes(feature.id)
      ) return []
    }
    const triggerTarget = feature.action.targeting.kind === 'self' ? actor : target
    const transactionPrefix =
      `decl-trigger:${state.combatId}:${state.round}:${feature.id}:${actor.id}:${target.id}`
    const transactionSequence = (actor.classState.declarativeTransactionIds ?? [])
      .filter((transactionId) => transactionId.startsWith(`${transactionPrefix}:`))
      .length
    return [{
      type: 'plugin' as const,
      pluginId: feature.ownerPluginId,
      actionId: feature.action.id,
      featureId: feature.id,
      transactionId: `${transactionPrefix}:${transactionSequence}:${eventIndex}`,
      actorId: actor.id,
      targetId: triggerTarget.id,
      targetIds: [triggerTarget.id],
      distanceFeet: triggerTarget.id === actor.id ? 0 : state.distanceFeetByCombatantPair?.[pairKey] ?? 0,
      rolls: event.declarativeIntentRolls?.[feature.id] ?? {},
    }]
  })
}
