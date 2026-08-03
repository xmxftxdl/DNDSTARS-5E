import type { ClassResourceDefinition, ClassResourceReset } from '../../lib/classDefinitionTypes'
import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { RulesetAdapter } from '../contracts'
import {
  registerFighterSubclassDefinition,
  type FighterFeatureDefinition,
  type FighterSubclassChoiceGroup,
  type FighterSubclassDefinition,
} from './fighter'
import type {
  Dnd5eCombatant,
  Dnd5eActionFailure,
  Dnd5eActionResult,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  DND5E_2014_BACKGROUND_OPTIONS,
  DND5E_2014_CLASS_OPTIONS,
  DND5E_2014_RACE_OPTIONS,
} from './characterOptions'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { EquipmentItem } from '../../types/equipment'
import type { Dnd5eInventoryItemTemplate } from '../../types/inventory'
import type {
  Dnd5ePersistentAreaVisual,
  Dnd5ePersistentAreaTriggerDeclaration,
  Dnd5ePluginEffectDuration,
} from './persistentAreaTypes'
import {
  DND5E_DECLARATIVE_DURATION_MAX_ROUNDS,
  DND5E_DECLARATIVE_LABEL_MAX_LENGTH,
  normalizeDnd5ePersistentAreaVisual,
} from './persistentAreaTypes'
import type { Dnd5eClassId } from './classes'
import type { Dnd5eMonsterStatBlock } from './monsters'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'
import { registerDnd5ePluginMonsterCatalogEntry } from './roomMonsterCatalog'
import { dnd5eCharacterClassLevel, normalizeDnd5eClassLevels } from './classLevels'
import { dnd5ePluginSubclassRegistry as pluginSubclasses } from './pluginSubclassRegistry'
import { dnd5eUtilityProjectionDistanceKey } from './utilityProjectionState'
import {
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  parseDnd5eSpellImport,
  type Dnd5eImportedSpell,
} from './spellbook'
import {
  declarativeAbilityCompatibilityV1,
  declarativeSubclassCompatibilityReportV1,
  declarativeSubclassResourceDieSidesV1,
  validateDeclarativeSubclassAbilityV1,
  validateDeclarativeSubclassDefinitionV1,
  type DeclarativeSubclassCombatHookV1,
  type DeclarativeCombatManeuverMechanicV1,
  type DeclarativeDiceFormulaV1,
  type DeclarativeEffectTargetV1,
  type DeclarativeSubclassAbilityV1,
  type DeclarativeSubclassDefinitionV1,
  type DeclarativeSubclassDurationV1,
  type DeclarativeSubclassResourceDieV1,
  type DeclarativeSubclassResourceCostV1,
  type DeclarativeSubclassResourceRequirementV1,
  type DeclarativeSubclassSpellcastingV1,
  type DeclarativeValueFormulaV1,
} from './declarativeSubclassAbility'
import { dnd5ePluginImageAsset } from './pluginAssets'
import {
  registerDeclarativeClassV1,
  validateDeclarativeClassDefinitionV1,
  type DeclarativeClassDefinitionV1,
} from './declarativeClass'

export const DND5E_RULES_PLUGIN_API_VERSION = 2 as const
export const DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS = [1, 2] as const
export const DND5E_RULES_PLUGIN_RULESET_ID = 'dnd5e-2014-srd-5.1' as const
export const DND5E_POST_D20_ADJUSTMENT_ROLL_ID = 'post-d20-adjustment' as const

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type Dnd5eRulesPluginApiVersion = typeof DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS[number]
export type Dnd5ePluginDistributionPolicy =
  | 'room-distributable'
  | 'room-ephemeral'
  | 'account-entitled'
  | 'local-only'
export type Dnd5ePluginContentCategory =
  | 'rules'
  | 'classes'
  | 'subclasses'
  | 'feats'
  | 'spells'
  | 'items'
  | 'monsters'
  | 'adventure'
  | 'mixed'
export type Dnd5ePluginDeclaredCapability =
  | 'damage'
  | 'healing'
  | 'temporary-hit-points'
  | 'standard-condition'
  | 'movement'
  | 'resource'
  | 'summon'
  | 'persistent-area'
  | 'spell-transaction'
  | 'interrupt'

export interface Dnd5ePluginDependency {
  id: string
  versionRange: string
  optional?: boolean
}

export interface Dnd5eRulesPluginManifest {
  /** Reverse-domain IDs are recommended, for example com.example.fighter-options. */
  id: string
  name: string
  version: string
  apiVersion: Dnd5eRulesPluginApiVersion
  rulesetId: typeof DND5E_RULES_PLUGIN_RULESET_ID
  publisher: string
  description?: string
  homepage?: string
  /** The plugin publisher, not DNDSTARS, declares the license for plugin-supplied content. */
  license: string
  /**
   * Version of the plugin-owned room state. Version 1 is assumed for legacy
   * API V2 packages. Increasing this value requires a contiguous Worker
   * migration for every intermediate version.
   */
  stateSchemaVersion?: number
  /** Versioned management metadata; omitted by legacy packages and treated as v1. */
  manifestSchemaVersion?: 1
  /** Shared game protocol required before this package can be enabled. */
  minimumGameProtocolVersion?: number
  dependencies?: readonly Dnd5ePluginDependency[]
  conflicts?: readonly string[]
  declaredCapabilities?: readonly Dnd5ePluginDeclaredCapability[]
  distributionPolicy?: Dnd5ePluginDistributionPolicy
  contentCategory?: Dnd5ePluginContentCategory
}

export interface Dnd5eRulesPluginStateMigration {
  fromVersion: number
  toVersion: number
  migrate(state: JsonValue): JsonValue | Promise<JsonValue>
}

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

export interface Dnd5ePluginAction {
  type: 'plugin'
  pluginId: string
  actionId: string
  /** DM 权威玩家动作事务 ID，用于持续实体和专注来源去重。 */
  transactionId?: string
  /** API v2 通用特性必须提供；省略时仅用于兼容 API v1 的直接 Headless Action。 */
  featureId?: string
  actorId: string
  targetId?: string
  /** 由 DM 地图权威层根据范围模板重建；玩家提交值不能直接采用。 */
  targetIds?: string[]
  /** 地图模板锚点，仅由 DM preflight 写入 Worker 快照。 */
  targetCell?: { col: number; row: number }
  /** 可旋转模板的四向朝向，由 DM preflight 校验后写入。 */
  targetOrientation?: 0 | 1 | 2 | 3
  /** 由 DM 地图权威层按 Token 占格重新计算，插件不得采用玩家提交的距离。 */
  distanceFeet?: number
  /** Host 按 action 的声明式骰子配方生成并校验，插件只能读取结果。 */
  rolls?: Record<string, Dnd5ePluginDiceRollResult>
  /** 主动 Interrupt 的受控选项；Host 会校验其属于 action 声明。 */
  interruptChoiceId?: string
  payload?: JsonValue
}

export interface Dnd5ePluginDiceRollDeclaration {
  id: string
  label: string
  count: number
  sides: number
  modifier?: number
  visibility?: 'public' | 'dm'
}

export interface Dnd5ePluginDiceRollResult {
  values: number[]
  modifier: number
  total: number
}

export interface Dnd5ePluginInterruptOption {
  id: string
  label: string
  description?: string
}

export interface Dnd5ePluginInterruptDeclaration {
  prompt: string
  audience: 'actor' | 'target' | 'dm'
  options: readonly Dnd5ePluginInterruptOption[]
  defaultOptionId: string
  /** Host 在掷骰前终止事务的选项；不消费行动经济，也不调用 Worker resolver。 */
  cancelOptionId?: string
  timeoutMs?: number
}

/** 插件声明持续时间的 capability 输入；Host 会转换为 ActiveEffectInstance。 */
export type { Dnd5ePluginEffectDuration } from './persistentAreaTypes'

export interface Dnd5ePluginHeadlessActionContext {
  /** A private clone of the authoritative state; the resolver may mutate and return it. */
  state: Dnd5eHeadlessCombatState
  action: Dnd5ePluginAction
  events: Dnd5eCombatEvent[]
  rules: RulesetAdapter
  actor: Dnd5eCombatant
  target?: Dnd5eCombatant
  /** 范围模板覆盖的全部目标；单目标行动也会包含该目标。 */
  targets: readonly Dnd5eCombatant[]
  /** 由 Host 骰子盒公开生成且已按声明校验的结果。 */
  rolls: Readonly<Record<string, Dnd5ePluginDiceRollResult>>
  /** Only supplied by the private authoritative after-hit trigger path. */
  parentAttackDamageType?: Dnd5eDamageType
  /** 赋予临时生命值；同一效果不叠加，保留较高值。返回本次实际增加量。 */
  grantTemporaryHitPoints(targetId: string, amount: number): number
  /** 恢复生命值但不超过生命上限。返回本次实际恢复量。 */
  heal(targetId: string, amount: number): number
  /** 结算已由 DM 骰子事务验证的伤害值；Host 统一处理抗性、易伤与免疫。 */
  dealDamage(targetId: string, amount: number, damageType: Dnd5eDamageType): number
  /** 通过标准状态引擎施加一个有来源、可过期的状态。 */
  applyStandardCondition(
    targetId: string,
    condition: Dnd5eStandardConditionId,
    duration: Dnd5ePluginEffectDuration,
  ): boolean
  /** 只允许消费当前插件声明且角色可用的资源。 */
  spendResource(resourceId: string, amount?: number): boolean
  /** 恢复当前插件声明资源，不超过 Host 计算的上限。 */
  restoreResource(resourceId: string, amount?: number): boolean
  fail(reason: Dnd5eActionFailure): Dnd5eActionResult
  succeed(): Dnd5eActionResult
}

export interface Dnd5ePluginHeadlessActionDefinition {
  id: string
  /** Reactions and interrupts must opt in; normal plugin actions are current-turn only. */
  allowOffTurn?: boolean
  /**
   * Installed rules packages execute in an isolated Worker. `trusted` is reserved for
   * built-in/test registrations created by the host itself.
   */
  execution?: 'trusted' | 'worker'
  /** Worker 不得自行生成随机数；所有骰子必须在这里预先声明。 */
  rolls?: readonly Dnd5ePluginDiceRollDeclaration[]
  resolve?(context: Dnd5ePluginHeadlessActionContext): Dnd5eActionResult
}

export type Dnd5ePluginActionEconomy = 'action' | 'bonusAction' | 'reaction' | 'none'
export type Dnd5ePluginAutomationLevel = 'full' | 'partial' | 'manual'
export type Dnd5ePluginTargetRelation = 'any' | 'ally' | 'enemy'

/**
 * Authoring-time vertical semantics for a Host-created persistent area.
 *
 * The declaration deliberately omits `baseElevationFeet`: the Host captures the
 * selected map anchor's terrain elevation when the action is committed. Leaving
 * the declaration absent preserves the pre-V17 unbounded-column behavior.
 */
export type Dnd5ePluginPersistentAreaVerticalDeclaration =
  | { mode: 'ground' }
  | { mode: 'volume'; heightFeet: number }

/** Strict declaration boundary used by registration and custom-package export. */
export function normalizeDnd5ePluginPersistentAreaVerticalDeclaration(
  value: unknown,
): Dnd5ePluginPersistentAreaVerticalDeclaration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const vertical = value as Record<string, unknown>
  const keys = Object.keys(vertical)
  if (vertical.mode === 'ground' && keys.length === 1 && keys[0] === 'mode') {
    return { mode: 'ground' }
  }
  if (
    vertical.mode === 'volume' &&
    keys.length === 2 &&
    keys.every((key) => key === 'mode' || key === 'heightFeet') &&
    finiteInteger(vertical.heightFeet, 1, 10_000)
  ) {
    return { mode: 'volume', heightFeet: vertical.heightFeet as number }
  }
  return undefined
}

export type Dnd5ePluginTargeting =
  | { kind: 'self' }
  | {
      kind: 'single-creature'
      relation?: Dnd5ePluginTargetRelation
      rangeFeet?: number
      includeSelf?: boolean
    }
  | {
      kind: 'area'
      relation?: Dnd5ePluginTargetRelation
      includeSelf?: boolean
      maximumTargets?: number
      template: SkillAoeTargeting
    }

export interface Dnd5ePluginFeatureAction {
  /** 与 registerHeadlessAction 的本地 ID 对应，由 Host 自动绑定到当前插件命名空间。 */
  id: string
  label: string
  description?: string
  economy: Dnd5ePluginActionEconomy
  targeting: Dnd5ePluginTargeting
  /** Non-active declarations are consumed by the generic Host trigger scheduler, not rendered as buttons. */
  trigger?: DeclarativeSubclassAbilityV1['trigger']
  /** 在 action 真正进入 Worker resolver 前，由共享 Interrupt Queue 主动询问。 */
  interrupt?: Dnd5ePluginInterruptDeclaration
  /** 成功结算后由 Host 在地图上创建的持续区域；仅适用于 area targeting。 */
  persistentArea?: {
    label: string
    color?: string
    durationRounds: number
    concentration?: boolean
    vertical?: Dnd5ePluginPersistentAreaVerticalDeclaration
    /** Whitelisted local renderer; it cannot execute plugin code or affect rules. */
    visual?: Dnd5ePersistentAreaVisual
    triggers?: readonly Dnd5ePersistentAreaTriggerDeclaration[]
  }
  /** Host 在选定格创建的 SRD 5.1 生物 Token；召唤物由 DM 操作，但阵营可属于施法者一方。 */
  summon?: {
    monsterId: `srd-5.1:${string}`
    label?: string
    durationRounds: number
    concentration?: boolean
    side?: 'ally' | 'enemy'
  }
}

export interface Dnd5ePluginStaticCombatModifiers {
  armorClassBonus?: number
  initiativeBonus?: number
  speedBonusFeet?: number
  savingThrowBonus?: number
  darkvisionRangeFeet?: number
  damageResistances?: readonly Dnd5eDamageType[]
  damageImmunities?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly string[]
}

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

export interface RegisteredDnd5ePluginFeature extends Omit<Dnd5ePluginFeatureDefinition, 'id' | 'action'> {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  action?: Dnd5ePluginFeatureAction
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

export interface RegisteredDnd5ePluginResource extends Omit<Dnd5ePluginResourceDefinition, 'id' | 'subclassId'> {
  id: string
  subclassId?: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  /** Host-only formula compiled from DeclarativeSubclassAbilityV1. */
  declarativeMaximum?: DeclarativeValueFormulaV1
  /** Host-only resource-die metadata compiled from a declarative subclass. */
  declarativeDie?: DeclarativeSubclassResourceDieV1
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
}

export interface RegisteredDnd5ePluginSubclass extends Omit<Dnd5ePluginSubclassDefinition, 'id' | 'features'> {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  features: readonly (Dnd5ePluginSubclassFeature & { id: string; featureId: string })[]
  /** Host-only metadata compiled from the pure-data subclass protocol. */
  declarativeSpellcasting?: DeclarativeSubclassSpellcastingV1
  declarativeCombatHooks?: readonly DeclarativeSubclassCombatHookV1[]
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

export interface RegisteredDnd5ePluginRace extends Omit<Dnd5ePluginRaceDefinition, 'id'> {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
}

export interface Dnd5ePluginFeatPrerequisite {
  minimumLevel?: number
  abilityScores?: Partial<Record<AbilityKey, number>>
  /** Core race names/IDs or namespaced plugin race IDs. */
  raceIds?: readonly string[]
}

export interface Dnd5ePluginFeatDefinition
  extends Omit<Dnd5ePluginFeatureDefinition, 'minimumLevel' | 'sourceClassId' | 'sourceSubclassId' | 'grantedBySubclass' | 'sourceFeatId' | 'grantedByFeat'> {
  prerequisite?: Dnd5ePluginFeatPrerequisite
}

export interface RegisteredDnd5ePluginFeat extends Omit<Dnd5ePluginFeatDefinition, 'id' | 'action'> {
  id: string
  featureId: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  action?: Dnd5ePluginFeatureAction
}

export interface Dnd5ePluginBackgroundDefinition {
  id: string
  name: string
  description?: string
  skillProficiencies: readonly string[]
  toolProficiencies?: readonly string[]
  languages?: number
  feature?: { name: string; description: string }
}

export interface RegisteredDnd5ePluginBackground extends Omit<Dnd5ePluginBackgroundDefinition, 'id'> {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
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

type WithPluginOwnership<T> = T extends unknown ? Omit<T, 'id'> & {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
} : never

export type RegisteredDnd5ePluginAbilityGeneration = WithPluginOwnership<Dnd5ePluginAbilityGenerationDefinition>

export type Dnd5ePluginSpellDefinition = Omit<Dnd5eImportedSpell, 'id' | 'source' | 'automation'> & {
  id: string
  iconAssetId?: string
  automation?:
    | { mode: 'reference-only' }
    | { mode: 'headless-action'; actionId: string }
}

export interface RegisteredDnd5ePluginSpell extends Omit<Dnd5eImportedSpell, 'automation'> {
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  iconAssetId?: string
  automation:
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

export interface RegisteredDnd5ePluginItem extends Dnd5eInventoryItemTemplate {
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
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

interface RegisteredPlugin {
  plugin: Dnd5eRulesPlugin
  integrity?: string
  dispose(): void
}

interface OwnedHeadlessAction {
  pluginId: string
  definition: Dnd5ePluginHeadlessActionDefinition
}

const plugins = new Map<string, RegisteredPlugin>()
const headlessActions = new Map<string, OwnedHeadlessAction>()
const pluginFeatures = new Map<string, RegisteredDnd5ePluginFeature>()
const pluginFeats = new Map<string, RegisteredDnd5ePluginFeat>()
const pluginResources = new Map<string, RegisteredDnd5ePluginResource>()
const pluginRaces = new Map<string, RegisteredDnd5ePluginRace>()
const pluginBackgrounds = new Map<string, RegisteredDnd5ePluginBackground>()
const pluginAbilityGenerationMethods = new Map<string, RegisteredDnd5ePluginAbilityGeneration>()
const pluginSpells = new Map<string, RegisteredDnd5ePluginSpell>()
const pluginItems = new Map<string, RegisteredDnd5ePluginItem>()
export type RegisteredDnd5ePluginMonster = Dnd5eMonsterStatBlock & {
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
}
const pluginMonsters = new Map<string, RegisteredDnd5ePluginMonster>()
const pluginListeners = new Set<() => void>()
let pluginRevision = 0

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

const INVENTORY_CATEGORIES = ['equipment', 'magic-item', 'adventuring-gear', 'consumable', 'tool', 'container'] as const
const INVENTORY_ICONS = [
  'weapon', 'armor', 'shield', 'backpack', 'bedroll', 'rope', 'torch', 'tinderbox',
  'waterskin', 'rations', 'healers-kit', 'ball-bearings', 'caltrops', 'hunting-trap',
  'acid', 'alchemists-fire', 'holy-water', 'antitoxin', 'poison', 'healing-potion',
  'magic-ring', 'magic-wand', 'magic-staff', 'magic-scroll', 'magic-wondrous', 'generic',
] as const
const EQUIPMENT_SLOTS = ['mainWeapon', 'offHand', 'armor', 'helmet', 'shoes', 'ring', 'necklace'] as const

function boundedText(value: unknown, label: string, maximum: number, optional = false): string | undefined {
  if (value == null && optional) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`Invalid plugin item ${label}`)
  }
  return value.trim()
}

function clonePluginItemDefinition(
  manifest: Dnd5eRulesPluginManifest,
  definition: Dnd5ePluginItemDefinition,
  itemId: string,
): RegisteredDnd5ePluginItem {
  const name = boundedText(definition.name, `${itemId} name`, 160)!
  const englishName = boundedText(definition.englishName, `${itemId} English name`, 160, true)
  const description = boundedText(definition.description, `${itemId} description`, 20_000)!
  const rulesText = boundedText(definition.rulesText, `${itemId} rules text`, 20_000)!
  const iconAssetId = ownedPluginAssetId(manifest.id, definition.iconAssetId, itemId)
  if (!(INVENTORY_CATEGORIES as readonly unknown[]).includes(definition.category)) {
    throw new Error(`Invalid plugin item category: ${itemId}`)
  }
  if (!(INVENTORY_ICONS as readonly unknown[]).includes(definition.icon) || typeof definition.stackable !== 'boolean') {
    throw new Error(`Invalid plugin item presentation: ${itemId}`)
  }
  if (definition.weightLb != null && (
    typeof definition.weightLb !== 'number' || !Number.isFinite(definition.weightLb) ||
    definition.weightLb < 0 || definition.weightLb > 1_000_000
  )) throw new Error(`Invalid plugin item weight: ${itemId}`)
  if (definition.cost && (
    typeof definition.cost.amount !== 'number' || !Number.isFinite(definition.cost.amount) ||
    definition.cost.amount < 0 || definition.cost.amount > 1_000_000_000 ||
    !['cp', 'sp', 'gp'].includes(definition.cost.currency)
  )) throw new Error(`Invalid plugin item cost: ${itemId}`)

  const magicItem = definition.magicItem
  if (magicItem && (
    !['armor', 'weapon', 'ammunition', 'wondrous-item', 'potion', 'ring', 'rod', 'scroll', 'staff', 'wand'].includes(magicItem.kind) ||
    !['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'varies'].includes(magicItem.rarity) ||
    !['none', 'required'].includes(magicItem.attunement) ||
    !['headless', 'dm-adjudication'].includes(magicItem.automation) ||
    (magicItem.attunementRequirement != null && (
      magicItem.attunement !== 'required' ||
      typeof magicItem.attunementRequirement !== 'string' ||
      !magicItem.attunementRequirement.trim() ||
      magicItem.attunementRequirement.length > 240
    ))
  )) throw new Error(`Invalid plugin magic item metadata: ${itemId}`)

  let equipment: EquipmentItem | undefined
  if (definition.equipment) {
    if (definition.category !== 'equipment' || definition.stackable) {
      throw new Error(`Plugin equipment must use the equipment category and cannot stack: ${itemId}`)
    }
    if (!(EQUIPMENT_SLOTS as readonly unknown[]).includes(definition.equipment.slot)) {
      throw new Error(`Invalid plugin equipment slot: ${itemId}`)
    }
    if (
      definition.equipment.baseEquipmentId != null &&
      (
        typeof definition.equipment.baseEquipmentId !== 'string' ||
        !definition.equipment.baseEquipmentId.trim() ||
        definition.equipment.baseEquipmentId.length > 160
      )
    ) {
      throw new Error(`Invalid plugin base equipment id: ${itemId}`)
    }
    const effects = definition.equipment.effects
    if (effects) {
      for (const [key, value] of Object.entries(effects)) {
        const limit = key === 'speedBonusFeet' ? 500 : 20
        if (!['weaponAttackBonus', 'weaponDamageBonus', 'armorClassBonus', 'savingThrowBonus', 'speedBonusFeet'].includes(key) ||
          !finiteInteger(value, -limit, limit)) {
          throw new Error(`Invalid plugin equipment effect ${key}: ${itemId}`)
        }
      }
    }
    const rules = definition.equipment.dnd5e
    if (rules?.kind === 'weapon') {
      if (
        !['simple', 'martial'].includes(rules.category) || !['melee', 'ranged'].includes(rules.mode) ||
        !['str', 'dex', 'finesse'].includes(rules.attackAbility) ||
        !finiteInteger(rules.damage.count, 0, 20) || !finiteInteger(rules.damage.sides, 2, 1_000) ||
        !['slashing', 'piercing', 'bludgeoning'].includes(rules.damage.type) ||
        (rules.reachFeet != null && !finiteInteger(rules.reachFeet, 0, 500)) ||
        (rules.rangeFeet != null && (
          !finiteInteger(rules.rangeFeet.normal, 0, 10_000) ||
          !finiteInteger(rules.rangeFeet.long, rules.rangeFeet.normal, 10_000)
        )) ||
        (rules.properties != null && (
          !Array.isArray(rules.properties) || rules.properties.length > 32 ||
          rules.properties.some((property) => typeof property !== 'string' || !property.trim() || property.length > 120)
        ))
      ) throw new Error(`Invalid plugin weapon rules: ${itemId}`)
    } else if (rules?.kind === 'armor') {
      if (
        !['light', 'medium', 'heavy'].includes(rules.category) ||
        !finiteInteger(rules.baseArmorClass, 0, 50) ||
        !['full', 'max-2', 'none'].includes(rules.dexterityBonus) ||
        (rules.material != null && !['metal', 'nonmetal'].includes(rules.material)) ||
        (rules.strengthRequirement != null && !finiteInteger(rules.strengthRequirement, 1, 30)) ||
        (rules.stealthDisadvantage != null && typeof rules.stealthDisadvantage !== 'boolean')
      ) throw new Error(`Invalid plugin armor rules: ${itemId}`)
    } else if (rules?.kind === 'shield') {
      if (!finiteInteger(rules.armorClassBonus, -20, 20)) throw new Error(`Invalid plugin shield rules: ${itemId}`)
    } else if (rules != null) {
      throw new Error(`Invalid plugin equipment rules: ${itemId}`)
    }
    equipment = structuredClone({ ...definition.equipment, id: itemId, name })
  } else if (definition.category === 'equipment') {
    throw new Error(`Plugin equipment template is missing equipment data: ${itemId}`)
  }

  const use = definition.use
  if (use) {
    if (!['action', 'bonusAction', 'none'].includes(use.economy) || !finiteInteger(use.consumeQuantity, 0, 999)) {
      throw new Error(`Invalid plugin item use economy: ${itemId}`)
    }
    if (use.chargesPerItem != null && !finiteInteger(use.chargesPerItem, 1, 1_000_000)) {
      throw new Error(`Invalid plugin item charges: ${itemId}`)
    }
    if (use.targeting?.kind === 'map-area') {
      if (
        !['ball-bearings', 'caltrops', 'hunting-trap'].includes(use.targeting.areaKind) ||
        !finiteInteger(use.targeting.rangeFeet, 0, 10_000) ||
        !finiteInteger(use.targeting.widthFeet, 0, 10_000) ||
        !finiteInteger(use.targeting.heightFeet, 0, 10_000)
      ) throw new Error(`Invalid plugin item map targeting: ${itemId}`)
    } else if (use.targeting?.kind === 'creature') {
      if (!finiteInteger(use.targeting.rangeFeet, 0, 10_000) ||
        (use.targeting.includeSelf != null && typeof use.targeting.includeSelf !== 'boolean')) {
        throw new Error(`Invalid plugin item creature targeting: ${itemId}`)
      }
    } else if (use.targeting != null) {
      throw new Error(`Invalid plugin item targeting: ${itemId}`)
    }
    if (use.effect.kind === 'healing') {
      if (
        !finiteInteger(use.effect.dice.count, 1, 40) || !finiteInteger(use.effect.dice.sides, 2, 100) ||
        !finiteInteger(use.effect.dice.bonus, -1_000, 1_000)
      ) throw new Error(`Invalid plugin healing item: ${itemId}`)
    } else if (use.effect.kind === 'dm-adjudication') {
      boundedText(use.effect.adjudication, `${itemId} adjudication`, 4_000)
    } else {
      throw new Error(`Invalid plugin item effect: ${itemId}`)
    }
  }

  const resources = definition.resources?.map((resource) => {
    if (
      !validId(resource.id) || typeof resource.label !== 'string' || !resource.label.trim() || resource.label.length > 120 ||
      !finiteInteger(resource.maximum, 1, 1_000_000) ||
      (resource.initial != null && !finiteInteger(resource.initial, 0, resource.maximum)) ||
      !['none', 'short-rest', 'long-rest', 'dawn'].includes(resource.resetOn)
    ) throw new Error(`Invalid plugin item resource: ${itemId}:${resource.id}`)
    return { ...resource, label: resource.label.trim() }
  })
  if (resources && new Set(resources.map((resource) => resource.id)).size !== resources.length) {
    throw new Error(`Duplicate plugin item resource: ${itemId}`)
  }
  const resourceIds = new Set(resources?.map((resource) => resource.id) ?? [])
  const headlessEffects = definition.headlessEffects?.map((effect) => {
    if (
      effect.kind !== 'attack-roll-reroll' || !resourceIds.has(effect.resourceId) || effect.maximumDice !== 1 ||
      effect.trigger !== 'after-attack-roll' || !['attacks-with-this-weapon', 'weapon-attacks'].includes(effect.appliesTo)
    ) throw new Error(`Invalid plugin item Headless effect: ${itemId}`)
    if (!equipment) throw new Error(`Plugin item Headless effect requires equipment: ${itemId}`)
    return { ...effect }
  })

  return {
    id: itemId,
    name,
    ...(englishName ? { englishName } : {}),
    category: definition.category,
    icon: definition.icon,
    ...(iconAssetId ? { iconAssetId } : {}),
    description,
    rulesText,
    ...(definition.weightLb != null ? { weightLb: definition.weightLb } : {}),
    ...(definition.cost ? { cost: { ...definition.cost } } : {}),
    stackable: definition.stackable,
    ...(equipment ? { equipment } : {}),
    ...(magicItem ? { magicItem: { ...magicItem } } : {}),
    ...(resources?.length ? { resources } : {}),
    ...(headlessEffects?.length ? { headlessEffects } : {}),
    ...(use ? { use: structuredClone(use) } : {}),
    source: { book: manifest.name, license: manifest.license },
    ownerPluginId: manifest.id,
    ownerPluginName: manifest.name,
    ownerPluginLicense: manifest.license,
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
  if (!targeting || !['self', 'single-creature', 'area'].includes(targeting.kind)) {
    throw new Error(`Invalid plugin feature targeting: ${featureId}`)
  }
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.relation != null && !['any', 'ally', 'enemy'].includes(targeting.relation)) {
    throw new Error(`Invalid plugin feature target relation: ${featureId}`)
  }
  if (targeting.kind === 'single-creature') {
    if (targeting.rangeFeet != null && (!Number.isFinite(targeting.rangeFeet) || targeting.rangeFeet < 0 || targeting.rangeFeet > 10_000)) {
      throw new Error(`Invalid plugin feature range: ${featureId}`)
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
        !['source-next-turn-start', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save', 'permanent'].includes(duration.expiresAt) ||
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
  ]
  for (const [key, minimum, maximum] of numeric) {
    const candidate = value[key]
    if (candidate != null && !finiteInteger(candidate, minimum, maximum)) {
      throw new Error(`Invalid plugin static combat modifier ${key}: ${label}`)
    }
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

function assertManifest(manifest: Dnd5eRulesPluginManifest): void {
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid D&D 5e rules plugin manifest')
  if (!validId(manifest.id)) throw new Error(`Invalid D&D 5e rules plugin id: ${manifest.id}`)
  if (
    typeof manifest.name !== 'string' || typeof manifest.publisher !== 'string' ||
    typeof manifest.version !== 'string' || typeof manifest.license !== 'string' ||
    !manifest.name.trim() || !manifest.publisher.trim() || !manifest.version.trim() || !manifest.license.trim()
  ) {
    throw new Error(`Incomplete D&D 5e rules plugin manifest: ${manifest.id}`)
  }
  if (
    (manifest.description != null && typeof manifest.description !== 'string') ||
    (manifest.homepage != null && typeof manifest.homepage !== 'string')
  ) throw new Error(`Invalid D&D 5e rules plugin manifest metadata: ${manifest.id}`)
  if (
    manifest.stateSchemaVersion != null &&
    (!Number.isInteger(manifest.stateSchemaVersion) || manifest.stateSchemaVersion < 1 || manifest.stateSchemaVersion > 1_000)
  ) throw new Error(`Invalid plugin state schema version: ${manifest.id}`)
  if (manifest.manifestSchemaVersion != null && manifest.manifestSchemaVersion !== 1) {
    throw new Error(`Unsupported plugin manifest schema: ${manifest.id}`)
  }
  if (
    manifest.minimumGameProtocolVersion != null &&
    (!Number.isInteger(manifest.minimumGameProtocolVersion) || manifest.minimumGameProtocolVersion < 1)
  ) throw new Error(`Invalid minimum game protocol: ${manifest.id}`)
  if (
    manifest.dependencies != null && (
      !Array.isArray(manifest.dependencies) || manifest.dependencies.length > 32 ||
      manifest.dependencies.some((dependency) =>
        !dependency || !validId(dependency.id) || dependency.id === manifest.id ||
        typeof dependency.versionRange !== 'string' || dependency.versionRange.length < 1 ||
        dependency.versionRange.length > 120 ||
        (dependency.optional != null && typeof dependency.optional !== 'boolean'))
    )
  ) throw new Error(`Invalid plugin dependencies: ${manifest.id}`)
  if (
    manifest.conflicts != null && (
      !Array.isArray(manifest.conflicts) || manifest.conflicts.length > 32 ||
      manifest.conflicts.some((pluginId) => !validId(pluginId) || pluginId === manifest.id)
    )
  ) throw new Error(`Invalid plugin conflicts: ${manifest.id}`)
  const capabilities = new Set<Dnd5ePluginDeclaredCapability>([
    'damage', 'healing', 'temporary-hit-points', 'standard-condition', 'movement',
    'resource', 'summon', 'persistent-area', 'spell-transaction', 'interrupt',
  ])
  if (
    manifest.declaredCapabilities != null && (
      !Array.isArray(manifest.declaredCapabilities) || manifest.declaredCapabilities.length > capabilities.size ||
      manifest.declaredCapabilities.some((capability) => !capabilities.has(capability))
    )
  ) throw new Error(`Invalid plugin capabilities: ${manifest.id}`)
  if (
    manifest.distributionPolicy != null &&
    !['room-distributable', 'room-ephemeral', 'account-entitled', 'local-only'].includes(manifest.distributionPolicy)
  ) throw new Error(`Invalid plugin distribution policy: ${manifest.id}`)
  if (
    manifest.contentCategory != null &&
    !['rules', 'classes', 'subclasses', 'feats', 'spells', 'items', 'monsters', 'adventure', 'mixed'].includes(manifest.contentCategory)
  ) throw new Error(`Invalid plugin content category: ${manifest.id}`)
  if (!(DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS as readonly number[]).includes(manifest.apiVersion)) {
    throw new Error(`Unsupported rules plugin API version: ${manifest.apiVersion}`)
  }
  if (manifest.rulesetId !== DND5E_RULES_PLUGIN_RULESET_ID) {
    throw new Error(`Unsupported ruleset for plugin ${manifest.id}: ${manifest.rulesetId}`)
  }
}

export function validateDnd5eRulesPluginManifest(manifest: Dnd5eRulesPluginManifest): void {
  assertManifest(manifest)
}

function publishPluginRegistryChange(): void {
  pluginRevision += 1
  for (const listener of pluginListeners) listener()
}

function namespacedId(pluginId: string, localId: string): string {
  if (!validId(localId)) throw new Error(`Invalid plugin contribution id: ${localId}`)
  return `${pluginId}:${localId}`
}

export function dnd5eDeclarativeResourceKey(
  pluginId: string,
  reference: Pick<DeclarativeSubclassResourceCostV1, 'resourceId' | 'scope'> |
    Pick<DeclarativeSubclassResourceRequirementV1, 'resourceId' | 'scope'>,
): string {
  return reference.scope === 'core'
    ? reference.resourceId
    : namespacedId(pluginId, reference.resourceId)
}

function declarativeFormulaValue(
  formula: DeclarativeValueFormulaV1,
  creature: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'abilities' | 'proficiencyBonus'>,
  adapter: RulesetAdapter,
): number {
  let value: number
  if (formula.kind === 'fixed') return formula.value
  else if (formula.kind === 'proficiency-bonus') value = creature.proficiencyBonus
  else if (formula.kind === 'ability-modifier') value = adapter.abilityModifier(creature.abilities[formula.ability])
  else {
    const classLevel = creature.classLevels?.[formula.classId] ?? (creature.classId === formula.classId ? creature.level : 0)
    value = Math.floor(classLevel / (formula.divisor ?? 1))
  }
  return Math.max(formula.minimum ?? Number.NEGATIVE_INFINITY, Math.floor(value * (formula.multiplier ?? 1)))
}

function declarativeResourceMaximumByLevel(
  formula: DeclarativeValueFormulaV1,
  classId: Dnd5eClassId,
  exactSteps?: readonly { level: number; maximum: number }[],
): number[] {
  const values = Array.from({ length: 20 }, (_, index) => {
    const level = index + 1
    if (formula.kind === 'fixed') return Math.max(0, formula.value)
    if (formula.kind === 'proficiency-bonus') {
      const base = 2 + Math.floor((level - 1) / 4)
      return Math.max(0, formula.minimum ?? 0, Math.floor(base * (formula.multiplier ?? 1)))
    }
    if (formula.kind === 'class-level') {
      if (formula.classId !== classId) return Math.max(0, formula.minimum ?? 0)
      return Math.max(formula.minimum ?? 0, Math.floor((level / (formula.divisor ?? 1)) * (formula.multiplier ?? 1)))
    }
    // Ability-based maxima cannot be represented by the legacy static resource table.
    return Math.max(0, formula.minimum ?? 0)
  })
  for (const step of exactSteps ?? []) {
    for (let index = step.level - 1; index < values.length; index += 1) {
      values[index] = step.maximum
    }
  }
  return values
}

function declarativeResourceMaximumForCharacter(
  formula: DeclarativeValueFormulaV1,
  character: Character,
): number {
  let value: number
  if (formula.kind === 'fixed') return Math.max(0, formula.value)
  if (formula.kind === 'proficiency-bonus') value = 2 + Math.floor((Math.max(1, character.level) - 1) / 4)
  else if (formula.kind === 'ability-modifier') value = Math.floor((character.abilities[formula.ability] - 10) / 2)
  else value = Math.floor(dnd5eCharacterClassLevel(character, formula.classId) / (formula.divisor ?? 1))
  return Math.max(0, formula.minimum ?? Number.NEGATIVE_INFINITY, Math.floor(value * (formula.multiplier ?? 1)))
}

function declarativeDurationToCapability(duration: DeclarativeSubclassDurationV1): Dnd5ePluginEffectDuration | undefined {
  if (duration.kind === 'until-source-turn-start') return { expiresAt: 'source-next-turn-start' }
  if (duration.kind === 'until-target-turn-start') return { expiresAt: 'target-next-turn-start' }
  if (duration.kind === 'until-target-turn-end') return { expiresAt: 'target-turn-end', remainingRounds: duration.rounds ?? 1 }
  if (duration.kind === 'fixed-rounds') return duration.repeatSave
    ? {
        expiresAt: 'target-turn-end-save',
        remainingRounds: duration.rounds,
        saveAbility: duration.repeatSave.ability,
        saveDc: duration.repeatSave.dc,
      }
    : { expiresAt: 'target-turn-end', remainingRounds: duration.rounds }
  return undefined
}

function declarativeTargeting(targeting: DeclarativeSubclassAbilityV1['targeting']): Dnd5ePluginTargeting {
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.kind === 'single-creature' || targeting.kind === 'multiple-creatures') return {
    kind: 'single-creature',
    relation: targeting.relation,
    rangeFeet: targeting.rangeFeet,
    includeSelf: targeting.includeSelf,
  }
  const common = {
    kind: 'area' as const,
    relation: targeting.relation,
    includeSelf: targeting.includeSelf,
    maximumTargets: targeting.maximumTargets ?? 64,
  }
  if (targeting.shape === 'circle') return {
    ...common,
    template: { shape: 'circle', origin: 'point', radiusFeet: targeting.radiusFeet ?? 5, placeRangeFeet: targeting.rangeFeet },
  }
  if (targeting.shape === 'cone') return {
    ...common,
    template: { shape: 'cone', origin: 'self', lengthFeet: targeting.lengthFeet ?? 15, aimRangeFeet: targeting.rangeFeet },
  }
  if (targeting.shape === 'line') return {
    ...common,
    template: { shape: 'line', origin: 'self', widthFeet: targeting.widthFeet ?? 5, lengthFeet: targeting.lengthFeet ?? 30, aimRangeFeet: targeting.rangeFeet },
  }
  return {
    ...common,
    template: { shape: 'rect', origin: 'point', widthFeet: targeting.widthFeet ?? 10, heightFeet: targeting.heightFeet ?? 10, placeRangeFeet: targeting.rangeFeet, rotatable: true },
  }
}

function declarativeEffectTargets(
  target: DeclarativeEffectTargetV1,
  context: Dnd5ePluginHeadlessActionContext,
): readonly Dnd5eCombatant[] {
  if (target === 'actor') return [context.actor]
  if (target === 'target') return context.target ? [context.target] : []
  return context.targets
}

function declarativeDiceCount(dice: DeclarativeDiceFormulaV1): number {
  // Static actions retain the invariant base declaration. Prearmed after-hit
  // resource-die actions receive a private, combatant-specific override.
  return dice.count
}

function declarativeFeatureResolver(input: {
  pluginId: string
  subclassId: string
  classId: Dnd5eClassId
  ability: DeclarativeSubclassAbilityV1
  featureId: string
  usesResourceId?: string
  automation: Dnd5ePluginAutomationLevel
}): Dnd5ePluginHeadlessActionDefinition['resolve'] {
  return (context) => {
    const { actor, action, state } = context
    const { ability } = input
    if (input.automation === 'partial' && action.interruptChoiceId !== 'dm-apply') {
      return context.fail('invalid-plugin-action')
    }
    if (!action.transactionId || actor.classState.declarativeTransactionIds?.includes(action.transactionId)) {
      return context.fail('invalid-plugin-action')
    }
    const classLevel = actor.classLevels?.[input.classId] ?? (actor.classId === input.classId ? actor.level : 0)
    const selectedSubclass = actor.subclassIds?.[input.classId] ?? (actor.classId === input.classId ? actor.subclassId : undefined)
    if (classLevel < ability.level || selectedSubclass !== input.subclassId || !actor.pluginFeatureIds.includes(input.featureId)) {
      return context.fail('invalid-class-feature')
    }
    const predicates = ability.predicates
    if (predicates?.minimumLevel != null && actor.level < predicates.minimumLevel) return context.fail('invalid-class-feature')
    if (predicates?.classId && (actor.classLevels?.[predicates.classId] ?? (actor.classId === predicates.classId ? actor.level : 0)) < 1) return context.fail('invalid-class-feature')
    if (predicates?.subclassId && selectedSubclass !== `${input.pluginId}:${predicates.subclassId}` && selectedSubclass !== predicates.subclassId) return context.fail('invalid-class-feature')
    const primaryTarget = context.target
    const pairKey = primaryTarget
      ? (actor.id < primaryTarget.id ? `${actor.id}\u0000${primaryTarget.id}` : `${primaryTarget.id}\u0000${actor.id}`)
      : undefined
    const authoritativeDistance = primaryTarget?.id === actor.id
      ? 0
      : pairKey == null
        ? Number.POSITIVE_INFINITY
        : state.distanceFeetByCombatantPair?.[pairKey] ?? Number.POSITIVE_INFINITY
    if (!Number.isFinite(authoritativeDistance) || authoritativeDistance < 0) return context.fail('invalid-target')
    if (
      (ability.targeting.kind === 'single-creature' || ability.targeting.kind === 'multiple-creatures') &&
      ability.targeting.rangeFeet != null && authoritativeDistance > ability.targeting.rangeFeet
    ) return context.fail('invalid-target')
    if (predicates?.minimumDistanceFeet != null && authoritativeDistance < predicates.minimumDistanceFeet) return context.fail('invalid-target')
    if (predicates?.maximumDistanceFeet != null && authoritativeDistance > predicates.maximumDistanceFeet) return context.fail('invalid-target')
    if (predicates?.actorHasConditions?.some((condition) => !actor.conditions.includes(condition))) return context.fail('invalid-class-feature')
    if (predicates?.actorLacksConditions?.some((condition) => actor.conditions.includes(condition))) return context.fail('invalid-class-feature')
    if (context.targets.some((target) => predicates?.targetHasConditions?.some((condition) => !target.conditions.includes(condition)))) return context.fail('invalid-target')
    if (context.targets.some((target) => predicates?.targetLacksConditions?.some((condition) => target.conditions.includes(condition)))) return context.fail('invalid-target')
    if (predicates?.targetRelation) {
      for (const target of context.targets) {
        const allied = target.controller === actor.controller
        if (predicates.targetRelation === 'self' && target.id !== actor.id) return context.fail('invalid-target')
        if (predicates.targetRelation === 'ally' && !allied) return context.fail('invalid-target')
        if (predicates.targetRelation === 'enemy' && allied) return context.fail('invalid-target')
      }
    }
    for (const requirement of predicates?.resources ?? []) {
      const resourceId = dnd5eDeclarativeResourceKey(input.pluginId, requirement)
      if ((actor.classResources[resourceId]?.current ?? -1) < requirement.minimum) return context.fail('class-resource-unavailable')
    }
    for (const requirement of predicates?.subclassChoices ?? []) {
      const selectionKey = `${input.subclassId}/${requirement.groupId}`
      if (!actor.classSelections[selectionKey]?.includes(requirement.optionId)) {
        return context.fail('invalid-class-feature')
      }
    }
    const turnKey = `${state.combatId}:${state.round}:${state.turnSlotId ?? actor.id}`
    const oncePerTurn = predicates?.oncePerTurn === true || ability.limits?.oncePerTurn === true
    if (oncePerTurn && actor.classState.declarativeUsedTurnKeys?.[input.featureId] === turnKey) return context.fail('feature-already-used')
    if (ability.mechanic?.kind === 'utility-projection-attack-advantage') {
      if (!primaryTarget) return context.fail('invalid-target')
      const projectionDistance = state.utilityProjectionDistanceFeetByPair?.[
        dnd5eUtilityProjectionDistanceKey(actor.id, ability.mechanic.projectionId, primaryTarget.id)
      ]
      if (
        projectionDistance == null ||
        !Number.isFinite(projectionDistance) ||
        projectionDistance > ability.mechanic.maximumDistanceFeet
      ) return context.fail('invalid-target')
    }
    if (
      ability.mechanic?.kind === 'next-d20-advantage' &&
      actor.classState.nextD20Advantage != null
    ) return context.fail('invalid-plugin-action')
    const costs = [
      ...(ability.cost?.resources ?? []).map((cost) => ({
        resourceId: dnd5eDeclarativeResourceKey(input.pluginId, cost),
        amount: cost.amount,
      })),
      ...(input.usesResourceId && (ability.cost?.uses ?? 1) > 0 ? [{ resourceId: input.usesResourceId, amount: ability.cost?.uses ?? 1 }] : []),
    ]
    if (costs.some((cost) => !actor.classResources[cost.resourceId] || actor.classResources[cost.resourceId].current < cost.amount)) {
      return context.fail('class-resource-unavailable')
    }
    const operationCount = costs.length + ability.effects.reduce((total, effect) => {
      if (effect.kind === 'move') return total
      if (effect.kind === 'spend-resource' || effect.kind === 'restore-resource') return total + 1
      return total + ('target' in effect ? declarativeEffectTargets(effect.target, context).length : 0)
    }, 0)
    if (operationCount > 64) return context.fail('invalid-plugin-action')
    for (const effect of ability.effects) {
      if (effect.kind === 'move') continue
      if (
        (effect.kind === 'damage' || effect.kind === 'healing' || effect.kind === 'temporary-hit-points') &&
        effect.rollId &&
        !context.rolls[effect.rollId]
      ) {
        const roll = ability.rolls?.find((candidate) => candidate.id === effect.rollId)
        if (!roll || (roll.kind !== 'damage' && roll.kind !== 'healing') || roll.dice.count > 0) return context.fail('invalid-dice')
      }
      if (
        effect.kind === 'damage' &&
        (() => {
          const declaration = ability.rolls?.find((candidate) => candidate.id === effect.rollId)
          return declaration?.kind === 'damage' &&
            declaration.damageType === 'parent-weapon' &&
            !context.parentAttackDamageType
        })()
      ) return context.fail('invalid-plugin-action')
      if ((effect.kind === 'standard-condition') && !declarativeDurationToCapability(effect.duration)) continue
      if ((effect.kind === 'spend-resource' || effect.kind === 'restore-resource') && declarativeFormulaValue(effect.amount, actor, context.rules) <= 0) return context.fail('invalid-plugin-action')
    }
    for (const cost of costs) if (!context.spendResource(cost.resourceId, cost.amount)) return context.fail('class-resource-unavailable')

    for (const effect of ability.effects) {
      if (effect.kind === 'move') continue
      if (effect.kind === 'spend-resource' || effect.kind === 'restore-resource') {
        const amount = declarativeFormulaValue(effect.amount, actor, context.rules)
        const resourceId = namespacedId(input.pluginId, effect.resourceId)
        if (
          effect.kind === 'restore-resource' &&
          effect.whenEmpty === true &&
          actor.classResources[resourceId]?.current !== 0
        ) continue
        const ok = effect.kind === 'spend-resource'
          ? context.spendResource(resourceId, amount)
          : context.restoreResource(resourceId, amount)
        if (!ok) return context.fail('class-resource-unavailable')
        continue
      }
      if (!('target' in effect)) return context.fail('invalid-plugin-action')
      for (const target of declarativeEffectTargets(effect.target, context)) {
        if (effect.kind === 'damage' || effect.kind === 'healing') {
          const declaration = ability.rolls?.find((candidate) => candidate.id === effect.rollId)
          if (!declaration || (declaration.kind !== 'damage' && declaration.kind !== 'healing')) return context.fail('invalid-dice')
          const supplied = context.rolls[effect.rollId]
          const rolled = (supplied?.values.reduce((total, value) => total + value, 0) ?? 0) +
            declarativeFormulaValue(declaration.dice.modifier ?? { kind: 'fixed', value: 0 }, actor, context.rules)
          if (effect.kind === 'damage') {
            const multiplier = state.effectiveRules?.houseRules.declarativeAbilityDamageMultiplier ?? 1
            let damageType: Dnd5eDamageType | undefined
            if (declaration.kind === 'damage') {
              damageType = declaration.damageType === 'parent-weapon'
                ? context.parentAttackDamageType
                : declaration.damageType
            } else damageType = 'force'
            if (!damageType) return context.fail('invalid-plugin-action')
            context.dealDamage(target.id, Math.max(0, Math.floor(rolled * multiplier)), damageType)
          } else context.heal(target.id, Math.max(0, rolled))
        } else if (effect.kind === 'temporary-hit-points') {
          const roll = effect.rollId
            ? ability.rolls?.find((candidate) => candidate.id === effect.rollId)
            : undefined
          const amount = effect.rollId
            ? (
                context.rolls[effect.rollId]?.values.reduce((total, value) => total + value, 0) ?? 0
              ) + (
                roll && (roll.kind === 'damage' || roll.kind === 'healing')
                  ? declarativeFormulaValue(roll.dice.modifier ?? { kind: 'fixed', value: 0 }, actor, context.rules)
                  : 0
              )
            : declarativeFormulaValue(effect.amount!, actor, context.rules)
          context.grantTemporaryHitPoints(target.id, Math.max(0, amount))
        } else if (effect.kind === 'standard-condition') {
          const duration = declarativeDurationToCapability(effect.duration)
          if (duration) context.applyStandardCondition(target.id, effect.condition, duration)
        }
      }
    }
    if (ability.mechanic?.kind === 'utility-projection-attack-advantage' && primaryTarget) {
      actor.classState.utilityProjectionAttackAdvantage = {
        featureId: input.featureId,
        targetId: primaryTarget.id,
        turnKey,
      }
      context.events.push({
        type: 'class-state-changed',
        actorId: actor.id,
        targetId: primaryTarget.id,
        stateKey: 'utility-projection-attack-advantage',
        active: true,
      })
    }
    if (ability.mechanic?.kind === 'next-d20-advantage') {
      actor.classState.nextD20Advantage = {
        featureId: input.featureId,
        rollKinds: [...ability.mechanic.rollKinds],
      }
      context.events.push({
        type: 'class-state-changed',
        actorId: actor.id,
        stateKey: 'next-d20-advantage',
        active: true,
      })
    }
    if (oncePerTurn) {
      actor.classState.declarativeUsedTurnKeys = { ...actor.classState.declarativeUsedTurnKeys, [input.featureId]: turnKey }
    }
    actor.classState.declarativeTransactionIds = [...(actor.classState.declarativeTransactionIds ?? []), action.transactionId].slice(-128)
    context.events.push({
      type: 'declarative-subclass-ability-resolved',
      actorId: actor.id,
      abilityId: input.featureId,
      trigger: ability.trigger.kind,
      targetIds: context.targets.map((target) => target.id),
    })
    return context.succeed()
  }
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
}

export interface Dnd5eRulesPluginRequirement {
  id: string
  version: string
  stateSchemaVersion?: number
  integrity?: string
}

export function registerDnd5eRulesPlugin(
  plugin: Dnd5eRulesPlugin,
  options: Dnd5eRulesPluginRegistrationOptions = {},
): () => void {
  assertManifest(plugin.manifest)
  const { id } = plugin.manifest
  if (plugins.has(id)) throw new Error(`D&D 5e rules plugin already registered: ${id}`)

  const disposers: Array<() => void> = []
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
      const raceIds = prerequisite?.raceIds == null ? undefined : [...new Set(prerequisite.raceIds)]
      if (raceIds && (
        raceIds.length < 1 || raceIds.length > 32 ||
        raceIds.some((raceId) => typeof raceId !== 'string' || !raceId.trim() || raceId.length > 160)
      )) throw new Error(`Invalid plugin feat race prerequisite: ${featId}`)
      const localFeatureId = `feat-${definition.id}`
      const { prerequisite: _prerequisite, ...featureDefinition } = definition
      void _prerequisite
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
          ...(raceIds?.length ? { raceIds } : {}),
        } : undefined,
        iconAssetId: feature.iconAssetId,
        staticModifiers: feature.staticModifiers,
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
      const result = registerDeclarativeClassV1({
        definition,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
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
          ability.mechanic?.kind === 'spell-damage-max-die-bonus'
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
          if (ability.mechanic?.kind === 'post-d20-adjustment') {
            rollDeclarations.push({
              id: DND5E_POST_D20_ADJUSTMENT_ROLL_ID,
              label: ability.name,
              count: 1,
              sides: ability.mechanic.dieSides,
              modifier: 0,
              visibility: 'public',
            })
          }
          api.registerHeadlessAction({
            id: actionLocalId,
            execution: 'trusted',
            allowOffTurn: ability.trigger.kind !== 'active-use',
            rolls: rollDeclarations,
            resolve: declarativeFeatureResolver({
              pluginId: id,
              subclassId,
              classId: definition.classId,
              ability,
              featureId,
              usesResourceId,
              automation: compatibility.effective,
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
        definition: { ...definition, rolls: clonePluginRolls(definition.rolls, actionId) },
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
      const registered: RegisteredDnd5ePluginBackground = {
        id: backgroundId,
        name,
        ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
        skillProficiencies,
        ...(toolProficiencies.length > 0 ? { toolProficiencies: toolProficiencies.map((tool) => tool.trim()) } : {}),
        ...(definition.languages ? { languages: definition.languages } : {}),
        ...(definition.feature ? { feature: {
          name: definition.feature.name.trim(),
          description: definition.feature.description.trim(),
        } } : {}),
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
      const registered = clonePluginItemDefinition(plugin.manifest, definition, itemId)
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
  const registered: RegisteredPlugin = {
    plugin,
    integrity: options.integrity,
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

export function unregisterDnd5eRulesPlugin(pluginId: string): boolean {
  const registered = plugins.get(pluginId)
  if (!registered) return false
  registered.dispose()
  return true
}

export function registeredDnd5eRulesPlugins(): readonly Dnd5eRulesPluginManifest[] {
  return [...plugins.values()].map(({ plugin }) => ({ ...plugin.manifest }))
}

export function activeDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  return [...plugins.values()]
    .map(({ plugin, integrity }) => ({
      id: plugin.manifest.id,
      version: plugin.manifest.version,
      stateSchemaVersion: plugin.manifest.stateSchemaVersion ?? 1,
      ...(integrity ? { integrity } : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Network-safe room handshake projection. Device-local packages are intentionally
 * absent, so even their ID, version, and integrity are not sent to a room server.
 */
export function roomDistributableDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  const roomPluginIds = new Set(
    [...plugins.values()]
      .filter(({ plugin }) => plugin.manifest.distributionPolicy === 'room-distributable')
      .map(({ plugin }) => plugin.manifest.id),
  )
  return activeDnd5eRulesPluginRequirements().filter((requirement) => roomPluginIds.has(requirement.id))
}

/**
 * Exact requirements that may participate in a live room. Ephemeral packages
 * are included while active in memory, but are never account-backed.
 */
export function roomActiveDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  const roomPluginIds = new Set(
    [...plugins.values()]
      .filter(({ plugin }) =>
        plugin.manifest.distributionPolicy === 'room-distributable' ||
        plugin.manifest.distributionPolicy === 'room-ephemeral')
      .map(({ plugin }) => plugin.manifest.id),
  )
  return activeDnd5eRulesPluginRequirements().filter((requirement) => roomPluginIds.has(requirement.id))
}

export function missingDnd5eRulesPluginRequirements(
  required: readonly Dnd5eRulesPluginRequirement[],
  active: readonly Dnd5eRulesPluginRequirement[] = activeDnd5eRulesPluginRequirements(),
): Dnd5eRulesPluginRequirement[] {
  const activeById = new Map(active.map((plugin) => [plugin.id, plugin]))
  return required.filter((requirement) => {
    const installed = activeById.get(requirement.id)
    if (
      !installed || installed.version !== requirement.version ||
      (installed.stateSchemaVersion ?? 1) !== (requirement.stateSchemaVersion ?? 1)
    ) return true
    return !!requirement.integrity && installed.integrity !== requirement.integrity
  })
}

export function dnd5ePluginHeadlessActionDefinition(
  pluginId: string,
  actionId: string,
): Dnd5ePluginHeadlessActionDefinition | undefined {
  const definition = headlessActions.get(`${pluginId}:${actionId}`)?.definition
  return definition ? {
    ...definition,
    rolls: definition.rolls?.map((roll) => ({ ...roll })),
  } : undefined
}

function cloneRegisteredStaticModifiers(
  value: Dnd5ePluginStaticCombatModifiers | undefined,
): Dnd5ePluginStaticCombatModifiers | undefined {
  return value ? {
    ...value,
    damageResistances: value.damageResistances ? [...value.damageResistances] : undefined,
    damageImmunities: value.damageImmunities ? [...value.damageImmunities] : undefined,
    conditionImmunities: value.conditionImmunities ? [...value.conditionImmunities] : undefined,
  } : undefined
}

export function registeredDnd5ePluginFeatures(): readonly RegisteredDnd5ePluginFeature[] {
  return [...pluginFeatures.values()]
    .map((feature) => ({
      ...feature,
      action: clonePluginFeatureAction(feature.action),
      declarativeAbility: feature.declarativeAbility ? structuredClone(feature.declarativeAbility) : undefined,
      automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function registeredDnd5ePluginResources(): readonly RegisteredDnd5ePluginResource[] {
  return [...pluginResources.values()]
    .map((resource) => ({
      ...resource,
      maximum: Array.isArray(resource.maximum) ? [...resource.maximum] : resource.maximum,
      declarativeMaximum: resource.declarativeMaximum ? structuredClone(resource.declarativeMaximum) : undefined,
      declarativeDie: resource.declarativeDie ? structuredClone(resource.declarativeDie) : undefined,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

export function registeredDnd5ePluginSubclasses(classId?: Dnd5eClassId): readonly RegisteredDnd5ePluginSubclass[] {
  return [...pluginSubclasses.values()]
    .filter((subclass) => !classId || subclass.classId === classId)
    .map((subclass) => ({
      ...subclass,
      features: subclass.features.map((feature) => ({
        ...feature,
        action: clonePluginFeatureAction(feature.action),
        declarativeAbility: feature.declarativeAbility ? structuredClone(feature.declarativeAbility) : undefined,
        automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      })),
      choiceGroups: subclass.choiceGroups?.map((group) => ({
        ...group,
        maxSelectionsByLevel: group.maxSelectionsByLevel?.map((step) => ({ ...step })),
        options: group.options.map((option) => ({ ...option })),
      })),
      declarativeSpellcasting: subclass.declarativeSpellcasting
        ? structuredClone(subclass.declarativeSpellcasting)
        : undefined,
      declarativeCombatHooks: subclass.declarativeCombatHooks
        ? structuredClone(subclass.declarativeCombatHooks)
        : undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginSubclassDefinition(subclassId: string): RegisteredDnd5ePluginSubclass | undefined {
  return registeredDnd5ePluginSubclasses().find((subclass) => subclass.id === subclassId)
}

export function dnd5ePluginResourceDefinition(resourceId: string): RegisteredDnd5ePluginResource | undefined {
  return registeredDnd5ePluginResources().find((resource) => resource.id === resourceId)
}

export function dnd5ePluginSubclassChoiceLimit(
  group: Dnd5ePluginSubclassChoiceGroup,
  classLevel: number,
): number {
  let maximum = group.maxSelections
  for (const step of group.maxSelectionsByLevel ?? []) {
    if (classLevel < step.level) break
    maximum = step.maxSelections
  }
  return Math.max(0, Math.min(group.options.length, Math.floor(maximum)))
}

export function dnd5ePluginResourceDieSides(
  resource: Pick<RegisteredDnd5ePluginResource, 'classId' | 'declarativeDie'>,
  character: Character,
): number | undefined {
  return resource.declarativeDie
    ? declarativeSubclassResourceDieSidesV1(
        resource.declarativeDie,
        dnd5eCharacterClassLevel(character, resource.classId),
      )
    : undefined
}

function selectedDnd5eSubclassId(character: Character, classId: Dnd5eClassId): string | undefined {
  return classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
}

export function dnd5ePluginClassResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  const classLevels = normalizeDnd5eClassLevels(character)
  return registeredDnd5ePluginResources()
    .filter((resource) => (classLevels[resource.classId] ?? 0) > 0)
    .map((resource) => ({
      key: resource.id,
      label: resource.label,
      shortLabel: resource.shortLabel,
      resetOn: resource.resetOn,
      isAvailable: (candidate: Character) =>
        dnd5eCharacterClassLevel(candidate, resource.classId) >= (resource.minimumLevel ?? 1) &&
        (!resource.subclassId || selectedDnd5eSubclassId(candidate, resource.classId) === resource.subclassId),
      max: (candidate: Character) => {
        if (resource.declarativeMaximum) return declarativeResourceMaximumForCharacter(resource.declarativeMaximum, candidate)
        if (!Array.isArray(resource.maximum)) return resource.maximum
        const classLevel = dnd5eCharacterClassLevel(candidate, resource.classId)
        return resource.maximum[Math.min(resource.maximum.length, Math.max(1, classLevel)) - 1] ?? 0
      },
    }))
}

export function registeredDnd5ePluginRaces(): readonly RegisteredDnd5ePluginRace[] {
  return [...pluginRaces.values()]
    .map((race) => ({
      ...race,
      abilityBonuses: { ...race.abilityBonuses },
      flexibleAbilityBonus: race.flexibleAbilityBonus ? {
        ...race.flexibleAbilityBonus,
        ...(race.flexibleAbilityBonus.exclude ? { exclude: [...race.flexibleAbilityBonus.exclude] } : {}),
      } : undefined,
      skillProficiencies: race.skillProficiencies ? [...race.skillProficiencies] : undefined,
      languages: race.languages ? [...race.languages] : undefined,
      traits: race.traits?.map((trait) => ({ ...trait })),
      staticModifiers: cloneRegisteredStaticModifiers(race.staticModifiers),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginRaceDefinition(idOrName: string): RegisteredDnd5ePluginRace | undefined {
  const race = pluginRaces.get(idOrName) ?? [...pluginRaces.values()].find((candidate) => candidate.name === idOrName)
  return race ? {
    ...race,
    abilityBonuses: { ...race.abilityBonuses },
    flexibleAbilityBonus: race.flexibleAbilityBonus ? {
      ...race.flexibleAbilityBonus,
      ...(race.flexibleAbilityBonus.exclude ? { exclude: [...race.flexibleAbilityBonus.exclude] } : {}),
    } : undefined,
    skillProficiencies: race.skillProficiencies ? [...race.skillProficiencies] : undefined,
    languages: race.languages ? [...race.languages] : undefined,
    traits: race.traits?.map((trait) => ({ ...trait })),
    staticModifiers: cloneRegisteredStaticModifiers(race.staticModifiers),
  } : undefined
}

function cloneRegisteredFeat(feat: RegisteredDnd5ePluginFeat): RegisteredDnd5ePluginFeat {
  return {
    ...feat,
    prerequisite: feat.prerequisite ? {
      ...feat.prerequisite,
      abilityScores: feat.prerequisite.abilityScores ? { ...feat.prerequisite.abilityScores } : undefined,
      raceIds: feat.prerequisite.raceIds ? [...feat.prerequisite.raceIds] : undefined,
    } : undefined,
    action: clonePluginFeatureAction(feat.action),
    staticModifiers: cloneRegisteredStaticModifiers(feat.staticModifiers),
  }
}

export function registeredDnd5ePluginFeats(): readonly RegisteredDnd5ePluginFeat[] {
  return [...pluginFeats.values()]
    .map(cloneRegisteredFeat)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginFeatDefinition(featId: string): RegisteredDnd5ePluginFeat | undefined {
  const feat = pluginFeats.get(featId)
  return feat ? cloneRegisteredFeat(feat) : undefined
}

export function dnd5ePluginFeatAvailableForCharacter(
  feat: RegisteredDnd5ePluginFeat,
  character: Character,
): boolean {
  const feature = pluginFeatures.get(feat.featureId)
  return !!feature && dnd5ePluginFeatureAvailableForCharacter(feature, character)
}

function cloneRegisteredBackground(background: RegisteredDnd5ePluginBackground): RegisteredDnd5ePluginBackground {
  return {
    ...background,
    skillProficiencies: [...background.skillProficiencies],
    toolProficiencies: background.toolProficiencies ? [...background.toolProficiencies] : undefined,
    feature: background.feature ? { ...background.feature } : undefined,
  }
}

export function registeredDnd5ePluginBackgrounds(): readonly RegisteredDnd5ePluginBackground[] {
  return [...pluginBackgrounds.values()]
    .map(cloneRegisteredBackground)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginBackgroundDefinition(idOrName: string): RegisteredDnd5ePluginBackground | undefined {
  const background = pluginBackgrounds.get(idOrName) ??
    [...pluginBackgrounds.values()].find((candidate) => candidate.name === idOrName)
  return background ? cloneRegisteredBackground(background) : undefined
}

export function registeredDnd5ePluginAbilityGenerationMethods(): readonly RegisteredDnd5ePluginAbilityGeneration[] {
  return [...pluginAbilityGenerationMethods.values()]
    .map((method) => method.kind === 'standard-array'
      ? { ...method, scores: [...method.scores] }
      : method.kind === 'point-buy'
        ? { ...method, costs: { ...method.costs } }
        : { ...method })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function registeredDnd5ePluginSpells(): readonly RegisteredDnd5ePluginSpell[] {
  return [...pluginSpells.values()]
    .map((spell) => ({
      ...spell,
      classes: [...spell.classes],
      components: { ...spell.components },
      castingTime: { ...spell.castingTime },
      range: { ...spell.range },
      duration: { ...spell.duration },
      tags: spell.tags ? [...spell.tags] : undefined,
      mechanics: spell.mechanics ? structuredClone(spell.mechanics) : undefined,
      source: { ...spell.source },
      automation: { ...spell.automation },
    }))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginSpellDefinition(id: string): RegisteredDnd5ePluginSpell | undefined {
  return registeredDnd5ePluginSpells().find((spell) => spell.id === id)
}

function cloneRegisteredPluginItem(item: RegisteredDnd5ePluginItem): RegisteredDnd5ePluginItem {
  return {
    ...item,
    cost: item.cost ? { ...item.cost } : undefined,
    equipment: item.equipment ? structuredClone(item.equipment) : undefined,
    magicItem: item.magicItem ? { ...item.magicItem } : undefined,
    use: item.use ? structuredClone(item.use) : undefined,
    source: { ...item.source },
  }
}

export function registeredDnd5ePluginItems(): readonly RegisteredDnd5ePluginItem[] {
  return [...pluginItems.values()]
    .map(cloneRegisteredPluginItem)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginItemDefinition(id: string): RegisteredDnd5ePluginItem | undefined {
  const item = pluginItems.get(id)
  return item ? cloneRegisteredPluginItem(item) : undefined
}

export function registeredDnd5ePluginMonsters(): readonly RegisteredDnd5ePluginMonster[] {
  return [...pluginMonsters.values()]
    .map((monster) => structuredClone(monster))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginAbilityGenerationMethod(id: string): RegisteredDnd5ePluginAbilityGeneration | undefined {
  const method = pluginAbilityGenerationMethods.get(id)
  if (!method) return undefined
  if (method.kind === 'standard-array') return { ...method, scores: [...method.scores] }
  if (method.kind === 'point-buy') return { ...method, costs: { ...method.costs } }
  return { ...method }
}

export function dnd5ePluginFeatureDefinition(featureId: string): RegisteredDnd5ePluginFeature | undefined {
  const feature = pluginFeatures.get(featureId)
  return feature ? {
    ...feature,
    action: clonePluginFeatureAction(feature.action),
    declarativeAbility: feature.declarativeAbility ? structuredClone(feature.declarativeAbility) : undefined,
    automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
    staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
  } : undefined
}

export function dnd5ePluginFeatureAvailableForCharacter(
  feature: RegisteredDnd5ePluginFeature,
  character: Character,
): boolean {
  if (feature.sourceFeatId) {
    const feat = pluginFeats.get(feature.sourceFeatId)
    if (!feat) return false
    const prerequisite = feat.prerequisite
    if ((prerequisite?.minimumLevel ?? 1) > character.level) return false
    if (prerequisite?.abilityScores && Object.entries(prerequisite.abilityScores).some(
      ([ability, score]) => character.abilities[ability as AbilityKey] < (score ?? 0),
    )) return false
    if (prerequisite?.raceIds?.length) {
      const identities = new Set([character.dnd5eRaceId, character.race].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ))
      if (!prerequisite.raceIds.some((raceId) => identities.has(raceId))) return false
    }
  }
  if (feature.sourceClassId) {
    const classLevel = dnd5eCharacterClassLevel(character, feature.sourceClassId)
    if (classLevel < (feature.minimumLevel ?? 1)) return false
    if (
      feature.sourceSubclassId &&
      selectedDnd5eSubclassId(character, feature.sourceClassId) !== feature.sourceSubclassId
    ) return false
    for (const requirement of feature.declarativeAbility?.predicates?.subclassChoices ?? []) {
      if (!feature.sourceSubclassId) return false
      const selectionKey = `${feature.sourceSubclassId}/${requirement.groupId}`
      const selected = feature.sourceClassId === 'fighter'
        ? character.dnd5eClassChoices?.fighter?.extensionChoices?.[selectionKey]
        : character.dnd5eClassChoices?.classes?.[feature.sourceClassId]?.selections?.[selectionKey]
      if (!selected?.includes(requirement.optionId)) return false
    }
  }
  return (!feature.sourceClassId && character.level < (feature.minimumLevel ?? 1))
    ? false
    : (feature.isAvailable?.(character) ?? true)
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
    dnd5eCharacterHasPluginFeature(character, feature.id),
  )
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

export function dnd5eCharacterHasPluginFeature(character: Character, featureId: string): boolean {
  const feature = dnd5ePluginFeatureDefinition(featureId)
  if (!feature || !dnd5ePluginFeatureAvailableForCharacter(feature, character)) return false
  if (feature.grantedBySubclass === true) return true
  if (feature.grantedByFeat === true) {
    return !!feature.sourceFeatId && character.dnd5eFeatIds?.includes(feature.sourceFeatId) === true
  }
  const race = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  if (race?.grantedFeatureIds?.includes(featureId)) return true
  return character.dnd5ePluginFeatureIds?.includes(featureId) === true
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
  if (!feature || !ability || feature.automation !== 'full' || !feature.action) return undefined
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
  actor: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'classResources'>,
  feature: RegisteredDnd5ePluginFeature,
  critical: boolean,
): Dnd5eDeclarativeAttackIntentRollPlan {
  const ability = feature.declarativeAbility
  if (!ability || !feature.action) return { ok: false, reason: 'invalid-plugin-action' }
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
  if (ability.mechanic?.kind === 'post-d20-adjustment') {
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

export function subscribeDnd5eRulesPluginRegistry(listener: () => void): () => void {
  pluginListeners.add(listener)
  return () => pluginListeners.delete(listener)
}

export function dnd5eRulesPluginRegistrySnapshot(): number {
  return pluginRevision
}
