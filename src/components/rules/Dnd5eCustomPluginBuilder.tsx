import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeDollarSign, ChevronDown, Download, FolderOpen, Plus, Save, Trash2, Upload } from 'lucide-react'
import { ABILITIES, SKILLS, type AbilityKey } from '../../lib/dnd'
import {
  buildDnd5eCustomRulesContentPackageV2,
  DND5E_DAMAGE_TYPES,
  DND5E_PERSISTENT_AREA_VISUAL_PRESETS,
  DND5E_SRD_MONSTERS,
  DND5E_STANDARD_CONDITIONS,
  dnd5eCustomClassAutomationReportV1,
  dnd5eCustomPluginAutomationReportV1,
  dnd5eCustomRulesPluginFileName,
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomHeadlessActionDraft,
  type Dnd5eCustomRulesPluginDraft,
  type Dnd5eContentPackageV2,
  type Dnd5eCantripScalingStep,
  type Dnd5eSpellMechanicsDefinition,
  type Dnd5eLocalContentAiTargetKind,
  type Dnd5eDamageType,
  type Dnd5ePluginAbilityGenerationDefinition,
  type Dnd5ePluginBackgroundDefinition,
  type Dnd5ePluginFeatureDefinition,
  type Dnd5ePluginFeatDefinition,
  type Dnd5ePluginContentCategory,
  type Dnd5ePluginDeclaredCapability,
  type Dnd5ePluginDistributionPolicy,
  type Dnd5ePluginItemDefinition,
  type Dnd5ePluginImageAssetDefinition,
  type Dnd5ePluginRaceDefinition,
  type Dnd5ePluginSpellDefinition,
  type Dnd5ePersistentAreaTriggerDeclaration,
  type Dnd5ePersistentAreaTriggerTiming,
  type Dnd5ePersistentAreaVisualPreset,
  type Dnd5ePluginEffectDuration,
  type DeclarativeSubclassDefinitionV1,
  type DeclarativeClassDefinitionV1,
} from '../../rulesets/dnd5e'
import Dnd5eDeclarativeSubclassEditor from './Dnd5eDeclarativeSubclassEditor'
import Dnd5eDeclarativeClassEditor from './Dnd5eDeclarativeClassEditor'
import Dnd5eMonsterWorkshopDialog, {
  type Dnd5eMonsterWorkshopEditRequest,
} from '../map/Dnd5eMonsterWorkshopDialog'
import type { Dnd5eMonsterStatBlock } from '../../rulesets/dnd5e/monsters'
import type { Dnd5eMonsterWorkshopAiReview } from '../map/monsterWorkshopReview'
import { dnd5ePluginCapabilityLabel } from '../../rulesets/dnd5e/pluginCapabilityLabels'
import Dnd5eBuilderResourceInventory from './Dnd5eBuilderResourceInventory'
import {
  type Dnd5eBuilderAutomationCounts,
  type Dnd5eBuilderAutomationStatus,
  type Dnd5eBuilderResourceInventoryEntry,
} from './dnd5eBuilderResourceInventoryModel'
import { showAppConfirm } from '../../lib/appDialog'
import {
  dnd5eCustomSpellHeadlessRangePatch,
  dnd5eCustomSpellRangeSummary,
  inferDnd5eCustomSpellRangeFromText,
  type Dnd5eCustomSpellRangeShape,
} from './dnd5eCustomSpellRangeModel'
import {
  dnd5eSpellIconAssetDataUrl,
  dnd5eSpellIconAssetFromFile,
  dnd5eSpellWorkshopHeadlessReady,
  dnd5eSpellWorkshopHeadlessStatus,
} from './dnd5eSpellWorkshopModel'

interface RaceDraft {
  id: string
  name: string
  description: string
  speedFeet: number
  abilityBonuses: Record<AbilityKey, number>
  flexibleCount: number
  flexibleAmount: number
  flexibleExclude: AbilityKey[]
  sourceDefinition?: Dnd5ePluginRaceDefinition
}

interface MethodDraft {
  id: string
  name: string
  summary: string
  kind: 'standard-array' | 'point-buy' | 'roll'
  scores: string
  budget: number
  minimum: number
  maximum: number
  costs: string
  diceCount: number
  dieSides: number
  dropLowest: number
  sourceDefinition?: Dnd5ePluginAbilityGenerationDefinition
}

interface BackgroundDraft {
  id: string
  name: string
  description: string
  skillProficiencies: string[]
  toolProficiencies: string
  languages: number
  featureName: string
  featureDescription: string
  sourceDefinition?: Dnd5ePluginBackgroundDefinition
}

interface FeatureDraft {
  id: string
  name: string
  summary: string
  description: string
  minimumLevel: number
  canModifyEnemyD20: boolean
  headless: HeadlessEffectEditorDraft
  sourceDefinition?: Dnd5ePluginFeatureDefinition
}

interface FeatDraft extends FeatureDraft {
  prerequisiteAbilities: Record<AbilityKey, number>
  prerequisiteRaceIds: string
  sourceFeatDefinition?: Dnd5ePluginFeatDefinition
}

interface PersistentAreaTriggerEditorDraft {
  id: string
  label: string
  timing: Dnd5ePersistentAreaTriggerTiming
  oncePerRound: boolean
  oncePerTurn: boolean
  savingThrowEnabled: boolean
  savingThrowAbility: AbilityKey
  savingThrowDcMode: 'source-save-dc' | 'fixed'
  savingThrowDc: number
  savingThrowOnSuccess: 'none' | 'half'
  damageEnabled: boolean
  damageCount: number
  damageSides: number
  damageModifier: number
  damageType: Dnd5eDamageType
  conditionEnabled: boolean
  condition: keyof typeof DND5E_STANDARD_CONDITIONS
  conditionExpiresAt: Dnd5ePluginEffectDuration['expiresAt']
  conditionRounds: number
  conditionSaveAbility: AbilityKey
  conditionSaveDc: number
  dmAdjustable: boolean
  /** Preserves newer trigger fields that this compact editor does not expose yet. */
  sourceDeclaration?: Dnd5ePersistentAreaTriggerDeclaration
}

interface HeadlessEffectEditorDraft {
  enabled: boolean
  actionLabel: string
  economy: 'action' | 'bonusAction' | 'reaction' | 'none'
  targetingKind: 'self' | 'single-creature' | 'area'
  relation: 'any' | 'ally' | 'enemy'
  includeSelf: boolean
  rangeFeet: number
  areaShape: 'circle' | 'cone' | 'line' | 'rect'
  areaRadiusFeet: number
  areaWidthFeet: number
  areaHeightFeet: number
  areaLengthFeet: number
  areaRotatable: boolean
  maximumTargets: number
  persistentAreaEnabled: boolean
  persistentAreaLabel: string
  persistentAreaColor: string
  persistentAreaDurationRounds: number
  persistentAreaConcentration: boolean
  persistentAreaVerticalMode: 'legacy' | 'ground' | 'volume'
  persistentAreaHeightFeet: number
  persistentAreaVisualPreset: Dnd5ePersistentAreaVisualPreset
  persistentAreaVisualIntensity: 'subtle' | 'normal' | 'strong'
  persistentAreaTriggers: PersistentAreaTriggerEditorDraft[]
  summonEnabled: boolean
  summonMonsterId: string
  summonLabel: string
  summonDurationRounds: number
  summonConcentration: boolean
  summonSide: 'ally' | 'enemy'
  damageEnabled: boolean
  damageCount: number
  damageSides: number
  damageModifier: number
  damageType: Dnd5eDamageType
  healingEnabled: boolean
  healingCount: number
  healingSides: number
  healingModifier: number
  conditionEnabled: boolean
  condition: keyof typeof DND5E_STANDARD_CONDITIONS
  conditionExpiresAt: Dnd5ePluginEffectDuration['expiresAt']
  conditionRounds: number
  conditionSaveAbility: AbilityKey
  conditionSaveDc: number
  interruptEnabled: boolean
  interruptAudience: 'actor' | 'target' | 'dm'
  interruptPrompt: string
  interruptTimeoutSeconds: number
}

interface SpellDraft {
  id: string
  name: string
  englishName: string
  iconAssetId?: string
  level: number
  school: Dnd5ePluginSpellDefinition['school']
  classes: Dnd5ePluginSpellDefinition['classes']
  ritual: boolean
  castingTimeUnit: Dnd5ePluginSpellDefinition['castingTime']['unit']
  castingTimeValue: number
  reactionTrigger: string
  rangeType: Dnd5ePluginSpellDefinition['range']['type']
  rangeFeet: number
  rangeShape: Dnd5eCustomSpellRangeShape
  rangeSizeFeet: number
  rangeWidthFeet: number
  rangeHeightFeet: number
  rangeRotatable: boolean
  verbal: boolean
  somatic: boolean
  material: boolean
  materialText: string
  durationType: Dnd5ePluginSpellDefinition['duration']['type']
  durationValue: number
  durationUnit: NonNullable<Dnd5ePluginSpellDefinition['duration']['unit']>
  concentration: boolean
  description: string
  higherLevels: string
  resolution: 'spell-attack' | 'saving-throw' | 'automatic'
  saveAbility: AbilityKey
  saveOnSuccess: 'none' | 'half' | 'full'
  cantripScaling: boolean
  cantripScalingSteps: Dnd5eCantripScalingStep[]
  upcastFromSlotLevel: number
  upcastDamageDicePerLevel: number
  upcastFlatDamagePerLevel: number
  upcastAdditionalTargetsPerLevel: number
  upcastAdditionalProjectilesPerLevel: number
  upcastDurationRoundsPerLevel: number
  headless: HeadlessEffectEditorDraft
  sourceDefinition?: Dnd5ePluginSpellDefinition
}

interface ItemDraft {
  id: string
  name: string
  description: string
  rulesText: string
  kind: 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable'
  slot: 'mainWeapon' | 'offHand' | 'armor' | 'helmet' | 'shoes' | 'ring' | 'ring2' | 'belt' | 'necklace'
  weaponMode: 'melee' | 'ranged'
  weaponCategory: 'simple' | 'martial'
  attackAbility: 'str' | 'dex' | 'finesse'
  damageCount: number
  damageSides: number
  damageType: 'slashing' | 'piercing' | 'bludgeoning'
  reachFeet: number
  rangeNormal: number
  rangeLong: number
  armorCategory: 'light' | 'medium' | 'heavy'
  baseArmorClass: number
  dexterityBonus: 'full' | 'max-2' | 'none'
  shieldBonus: number
  weaponAttackBonus: number
  weaponDamageBonus: number
  armorClassBonus: number
  savingThrowBonus: number
  speedBonusFeet: number
  healingCount: number
  healingSides: number
  healingBonus: number
  attackRerollEnabled: boolean
  attackRerollCharges: number
  attackRerollResetOn: 'none' | 'short-rest' | 'long-rest' | 'dawn'
  headlessEffectsUseCharges: boolean
  onHitBonusDamageEnabled: boolean
  onHitBonusDamageCount: number
  onHitBonusDamageSides: number
  onHitBonusDamageBonus: number
  onHitBonusDamageType: 'inherit' | Dnd5eDamageType
  onHitBonusDamageOncePerTurn: boolean
  damageReductionEnabled: boolean
  damageReductionAmount: number
  damageReductionOncePerTurn: boolean
  deathPreventionEnabled: boolean
  deathPreventionHitPoints: number
  deathPreventionMassiveDamage: boolean
  spellSlotRecoveryEnabled: boolean
  spellSlotRecoveryMaximumLevel: number
  spellSlotRecoveryAmount: number
  spellSlotRecoveryEconomy: 'action' | 'bonusAction' | 'none'
  sourceDefinition?: Dnd5ePluginItemDefinition
}

type BuilderSection = 'races' | 'backgrounds' | 'features' | 'feats' | 'classes' | 'subclasses' | 'spells' | 'items' | 'monsters' | 'methods'

const BUILDER_SECTIONS: readonly { id: BuilderSection; label: string }[] = [
  { id: 'monsters', label: '怪物' },
  { id: 'classes', label: '职业' },
  { id: 'subclasses', label: '子职' },
  { id: 'races', label: '种族' },
  { id: 'backgrounds', label: '背景' },
  { id: 'feats', label: '专长' },
  { id: 'features', label: '特性' },
  { id: 'spells', label: '法术' },
  { id: 'items', label: '装备／物品' },
  { id: 'methods', label: '加点规则' },
]

function automationCountsFromStatuses(
  statuses: readonly Dnd5eBuilderAutomationStatus[],
): Dnd5eBuilderAutomationCounts {
  return {
    full: statuses.filter((status) => status === 'full').length,
    partial: statuses.filter((status) => status === 'partial').length,
    manual: statuses.filter((status) => status === 'manual').length,
    referenceOnly: statuses.filter((status) => status === 'reference-only').length,
  }
}

function singleAutomationCount(status: Dnd5eBuilderAutomationStatus): Dnd5eBuilderAutomationCounts {
  return automationCountsFromStatuses([status])
}

function builderSectionLabel(section: BuilderSection): string {
  return BUILDER_SECTIONS.find((entry) => entry.id === section)?.label ?? '资源'
}

function builderSectionForAiTarget(
  target: Exclude<Dnd5eLocalContentAiTargetKind, 'auto'>,
): BuilderSection {
  if (target === 'ability-generation') return 'methods'
  if (target === 'class') return 'classes'
  if (target === 'subclass') return 'subclasses'
  if (target === 'monster') return 'monsters'
  return `${target}s` as BuilderSection
}

interface SavedBuilderDraft {
  metadata: {
    id: string
    name: string
    version: string
    publisher: string
    license: string
    description: string
    minimumGameProtocolVersion: number
    dependencies: string
    conflicts: string
    declaredCapabilities: Dnd5ePluginDeclaredCapability[]
    distributionPolicy: Dnd5ePluginDistributionPolicy
    contentCategory: Dnd5ePluginContentCategory
  }
  races: RaceDraft[]
  backgrounds: BackgroundDraft[]
  features: FeatureDraft[]
  feats: FeatDraft[]
  spells: SpellDraft[]
  items: ItemDraft[]
  methods: MethodDraft[]
  subclasses: DeclarativeSubclassDefinitionV1[]
  classes: DeclarativeClassDefinitionV1[]
  monsters: Dnd5eMonsterStatBlock[]
  assets?: Dnd5ePluginImageAssetDefinition[]
  importedHeadlessActions?: Dnd5eCustomHeadlessActionDraft[]
}

const DRAFT_STORAGE_KEY = 'dndstars5e:custom-rules-workshop:v1'

function scopedBuilderDraftStorageKey(scope: string): string {
  return `${DRAFT_STORAGE_KEY}:${encodeURIComponent(scope || 'local')}`
}

function readSavedBuilderDraft(storageKey: string): Partial<SavedBuilderDraft> | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<SavedBuilderDraft>
    if (!saved || typeof saved !== 'object' || !saved.metadata) return null
    return saved
  } catch {
    return null
  }
}

function defaultBuilderMetadata(defaultPublisher: string): SavedBuilderDraft['metadata'] {
  return {
    id: 'local.dm.custom-rules',
    name: '房间自定义规则',
    version: '1.0.0',
    publisher: defaultPublisher || '房间 DM',
    license: '自定义内容；由房间 DM 负责授权',
    description: '由 Astral Trace 扩展工作室生成。',
    minimumGameProtocolVersion: 5,
    dependencies: '',
    conflicts: '',
    declaredCapabilities: [],
    distributionPolicy: 'room-distributable',
    contentCategory: 'mixed',
  }
}

function builderDraftHasContent(saved: SavedBuilderDraft, defaults: SavedBuilderDraft['metadata']): boolean {
  return saved.races.length > 0 || saved.backgrounds.length > 0 || saved.features.length > 0 ||
    saved.feats.length > 0 || saved.spells.length > 0 || saved.items.length > 0 ||
    saved.methods.length > 0 || saved.subclasses.length > 0 || saved.classes.length > 0 ||
    saved.monsters.length > 0 || (saved.assets?.length ?? 0) > 0 ||
    (saved.importedHeadlessActions?.length ?? 0) > 0 ||
    JSON.stringify(saved.metadata) !== JSON.stringify(defaults)
}
const PLUGIN_DISTRIBUTION_POLICIES = [
  ['room-distributable', '可随房间分发'],
  ['account-entitled', '每个账号需单独授权'],
  ['local-only', '仅本机使用'],
] as const
const PLUGIN_CONTENT_CATEGORIES = [
  ['mixed', '混合内容'], ['rules', '规则'], ['classes', '职业'], ['subclasses', '子职'], ['feats', '专长'], ['spells', '法术'],
  ['items', '物品'], ['monsters', '怪物'], ['adventure', '冒险'],
] as const
const PLUGIN_CAPABILITIES: readonly Dnd5ePluginDeclaredCapability[] = [
  'damage', 'healing', 'temporary-hit-points', 'standard-condition', 'movement',
  'resource', 'summon', 'persistent-area', 'spell-transaction', 'interrupt',
]
const SPELL_SCHOOLS = [['abjuration', '防护'], ['conjuration', '咒法'], ['divination', '预言'], ['enchantment', '惑控'], ['evocation', '塑能'], ['illusion', '幻术'], ['necromancy', '死灵'], ['transmutation', '变化']] as const
const CASTING_UNITS = [['action', '动作'], ['bonus-action', '附赠动作'], ['reaction', '反应'], ['minute', '分钟'], ['hour', '小时']] as const
const RANGE_TYPES = [['self', '自身'], ['touch', '触及'], ['distance', '距离'], ['sight', '视线'], ['unlimited', '无限'], ['special', '特殊']] as const
const RANGE_SHAPES = [['none', '单体／无范围模板'], ['radius', '半径区域'], ['sphere', '球形'], ['cone', '锥形'], ['cube', '立方体'], ['cylinder', '圆柱'], ['line', '线形'], ['rect', '长方形／墙体']] as const
const DURATION_TYPES = [['instantaneous', '立即'], ['timed', '计时'], ['until-dispelled', '直到被解除'], ['special', '特殊']] as const
const DURATION_UNITS = [['round', '轮'], ['minute', '分钟'], ['hour', '小时'], ['day', '日']] as const
const SPELL_CLASSES = [['bard', '吟游诗人'], ['cleric', '牧师'], ['druid', '德鲁伊'], ['paladin', '圣武士'], ['ranger', '游侠'], ['sorcerer', '术士'], ['warlock', '邪术师'], ['wizard', '法师']] as const
const ITEM_KINDS = [['weapon', '武器'], ['armor', '护甲'], ['shield', '盾牌'], ['accessory', '饰品／其他装备'], ['consumable', '治疗消耗品']] as const
const EQUIPMENT_SLOTS = [['mainWeapon', '主手'], ['offHand', '副手'], ['armor', '护甲'], ['helmet', '头部'], ['shoes', '足部'], ['ring', '戒指 1'], ['ring2', '戒指 2'], ['belt', '腰带'], ['necklace', '颈部']] as const
const WEAPON_CATEGORIES = [['simple', '简易武器'], ['martial', '军用武器']] as const
const WEAPON_MODES = [['melee', '近战'], ['ranged', '远程']] as const
const ATTACK_ABILITIES = [['str', '力量'], ['dex', '敏捷'], ['finesse', '灵巧（取高）']] as const
const WEAPON_DAMAGE_TYPES = [['slashing', '挥砍'], ['piercing', '穿刺'], ['bludgeoning', '钝击']] as const
const ARMOR_CATEGORIES = [['light', '轻甲'], ['medium', '中甲'], ['heavy', '重甲']] as const
const DEXTERITY_BONUSES = [['full', '完整敏捷调整'], ['max-2', '敏捷最高 +2'], ['none', '不加敏捷']] as const
const ACTION_ECONOMIES = [['action', '动作'], ['bonusAction', '附赠动作'], ['reaction', '反应'], ['none', '免费行动']] as const
const TARGETING_KINDS = [['self', '自身'], ['single-creature', '单一生物'], ['area', '范围模板']] as const
const TARGET_RELATIONS = [['enemy', '敌方'], ['ally', '友方'], ['any', '任意']] as const
const AREA_SHAPES = [['circle', '圆形'], ['cone', '锥形'], ['line', '线形'], ['rect', '矩形']] as const
const INTERRUPT_AUDIENCES = [['dm', 'DM'], ['actor', '行动者'], ['target', '目标']] as const
const CONDITION_EXPIRATIONS = [
  ['permanent', '永久'],
  ['source-next-turn-start', '来源下回合开始'],
  ['target-next-turn-start', '目标下回合开始'],
  ['target-turn-end', '目标回合结束'],
  ['target-turn-end-save', '目标回合结束重复豁免'],
] as const
const PERSISTENT_AREA_TRIGGER_TIMINGS = [
  ['on-move-distance', '区域内移动距离'],
  ['on-area-move-impact', '区域移动命中'],
  ['on-create', '首次创建区域'],
  ['on-enter', '进入区域'],
  ['turn-start', '目标回合开始'],
  ['turn-end', '目标回合结束'],
] as const
const PERSISTENT_AREA_SAVE_DC_MODES = [
  ['source-save-dc', '来源角色法术 DC'],
  ['fixed', '固定 DC'],
] as const
const PERSISTENT_AREA_SAVE_SUCCESS = [
  ['none', '成功则无效'],
  ['half', '成功则伤害减半'],
] as const
const DAMAGE_TYPE_LABELS: Record<Dnd5eDamageType, string> = {
  acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场',
  lightning: '闪电', necrotic: '黯蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵',
  radiant: '光耀', slashing: '挥砍', thunder: '雷鸣',
}
const HEADLESS_DAMAGE_TYPES = DND5E_DAMAGE_TYPES.map((id) => [id, DAMAGE_TYPE_LABELS[id]] as const)
const SUMMON_MONSTERS = DND5E_SRD_MONSTERS.map((monster) => [monster.id, `${monster.name}（CR ${monster.challenge.rating}）`] as const)
const HEADLESS_CONDITIONS = Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => [condition.id, condition.label] as const)

interface Props {
  defaultPublisher?: string
  busy?: boolean
  onInstall(file: File): Promise<void>
  installLabel?: string
  onPublish?: (file: File) => Promise<void>
  publishLabel?: string
  alwaysExpanded?: boolean
  categoryControl?: 'tabs' | 'select'
  monsterWorkshopImport?: Dnd5eMonsterWorkshopEditRequest | null
  onMonsterWorkshopImportClose?: () => void
  contentWorkshopImport?: Dnd5eWorkshopContentEditRequest | null
  onContentWorkshopImportClose?: () => void
  /** 本地草稿按房间隔离；不会上传到服务器或随规则包分发。 */
  draftStorageScope?: string
}

export interface Dnd5eWorkshopContentEditRequest {
  requestId: number
  targetKind: Exclude<Dnd5eLocalContentAiTargetKind, 'auto'>
  package: Dnd5eContentPackageV2
  review?: Dnd5eMonsterWorkshopAiReview
}

const emptyBonuses = (): Record<AbilityKey, number> => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })

function newRace(index: number): RaceDraft {
  return {
    id: `custom-race-${index}`,
    name: `自定义种族 ${index}`,
    description: '',
    speedFeet: 30,
    abilityBonuses: emptyBonuses(),
    flexibleCount: 0,
    flexibleAmount: 1,
    flexibleExclude: [],
  }
}

function newMethod(index: number): MethodDraft {
  return {
    id: `custom-method-${index}`,
    name: `自定义加点 ${index}`,
    summary: '由房间 DM 配置的属性生成规则。',
    kind: 'standard-array',
    scores: '15, 14, 13, 12, 10, 8',
    budget: 27,
    minimum: 8,
    maximum: 15,
    costs: '8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9',
    diceCount: 4,
    dieSides: 6,
    dropLowest: 1,
  }
}

function newBackground(index: number): BackgroundDraft {
  return {
    id: `custom-background-${index}`, name: `自定义背景 ${index}`, description: '',
    skillProficiencies: [], toolProficiencies: '', languages: 0,
    featureName: '', featureDescription: '',
  }
}

function newFeature(index: number): FeatureDraft {
  return {
    id: `custom-feature-${index}`, name: `自定义特性 ${index}`,
    summary: '由 DM 提供的自定义特性。', description: '', minimumLevel: 1,
    canModifyEnemyD20: false,
    headless: newHeadlessEffectDraft(),
  }
}

function newFeat(index: number): FeatDraft {
  return {
    ...newFeature(index),
    id: `custom-feat-${index}`,
    name: `自定义专长 ${index}`,
    summary: '由 DM 提供的自定义专长。',
    prerequisiteAbilities: emptyBonuses(),
    prerequisiteRaceIds: '',
  }
}

function newHeadlessEffectDraft(): HeadlessEffectEditorDraft {
  return {
      enabled: false,
      actionLabel: '使用特性', economy: 'action', targetingKind: 'single-creature',
      relation: 'enemy', includeSelf: false, rangeFeet: 60,
      areaShape: 'circle', areaRadiusFeet: 10, areaWidthFeet: 10, areaHeightFeet: 10,
      areaRotatable: true,
      areaLengthFeet: 30, maximumTargets: 16,
      persistentAreaEnabled: false, persistentAreaLabel: '持续区域', persistentAreaColor: '#8b5cf6',
      persistentAreaDurationRounds: 10, persistentAreaConcentration: false,
      persistentAreaVerticalMode: 'ground', persistentAreaHeightFeet: 10,
      persistentAreaVisualPreset: 'arcane', persistentAreaVisualIntensity: 'normal',
      persistentAreaTriggers: [],
      summonEnabled: false, summonMonsterId: 'srd-5.1:wolf', summonLabel: '',
      summonDurationRounds: 10, summonConcentration: true, summonSide: 'ally',
      damageEnabled: true, damageCount: 1, damageSides: 6, damageModifier: 0, damageType: 'force',
      healingEnabled: false, healingCount: 1, healingSides: 8, healingModifier: 0,
      conditionEnabled: false, condition: 'prone', conditionExpiresAt: 'target-turn-end',
      conditionRounds: 1, conditionSaveAbility: 'con', conditionSaveDc: 10,
      interruptEnabled: false, interruptAudience: 'dm',
      interruptPrompt: '是否允许结算这项自定义效果？', interruptTimeoutSeconds: 30,
  }
}

function newPersistentAreaTrigger(index: number): PersistentAreaTriggerEditorDraft {
  return {
    id: `area-trigger-${index}`,
    label: '区域触发效果',
    timing: 'on-enter',
    oncePerRound: true,
    oncePerTurn: false,
    savingThrowEnabled: true,
    savingThrowAbility: 'con',
    savingThrowDcMode: 'source-save-dc',
    savingThrowDc: 12,
    savingThrowOnSuccess: 'half',
    damageEnabled: true,
    damageCount: 2,
    damageSides: 6,
    damageModifier: 0,
    damageType: 'poison',
    conditionEnabled: false,
    condition: 'poisoned',
    conditionExpiresAt: 'target-turn-end',
    conditionRounds: 1,
    conditionSaveAbility: 'con',
    conditionSaveDc: 12,
    dmAdjustable: false,
  }
}

function restoreHeadlessEffectDraft(value: Partial<HeadlessEffectEditorDraft> | undefined): HeadlessEffectEditorDraft {
  const fallback = newHeadlessEffectDraft()
  return {
    ...fallback,
    ...value,
    // Drafts saved before vertical authoring must retain their old infinite-column behavior.
    persistentAreaVerticalMode: value?.persistentAreaVerticalMode ?? 'legacy',
    persistentAreaTriggers: Array.isArray(value?.persistentAreaTriggers)
      ? value.persistentAreaTriggers.map((trigger, index) => ({ ...newPersistentAreaTrigger(index + 1), ...trigger }))
      : [],
  }
}

function restoreFeatureDraft(value: Partial<FeatureDraft>, index: number): FeatureDraft {
  const fallback = newFeature(index + 1)
  return {
    ...fallback,
    ...value,
    headless: restoreHeadlessEffectDraft(value.headless),
  }
}

function restoreFeatDraft(value: Partial<FeatDraft>, index: number): FeatDraft {
  const fallback = newFeat(index + 1)
  return {
    ...fallback,
    ...value,
    prerequisiteAbilities: { ...fallback.prerequisiteAbilities, ...value.prerequisiteAbilities },
    headless: restoreHeadlessEffectDraft(value.headless),
  }
}

const DEFAULT_CANTRIP_SCALING_STEPS: readonly Dnd5eCantripScalingStep[] = [
  { level: 5, diceCount: 1 },
  { level: 11, diceCount: 1 },
  { level: 17, diceCount: 1 },
]

function cantripScalingStepsFromDamage(
  damage: Dnd5eSpellMechanicsDefinition['damage'] | undefined,
): Dnd5eCantripScalingStep[] {
  const scaling = damage?.cantripScaling
  if (scaling && scaling !== true) return scaling.steps.map((step) => ({ ...step }))
  const diceCount = scaling === true ? Math.max(1, damage?.dice.count ?? 1) : 1
  return DEFAULT_CANTRIP_SCALING_STEPS.map((step) => ({ ...step, diceCount }))
}

function newSpell(index: number): SpellDraft {
  return {
    id: `custom-spell-${index}`, name: `自定义法术 ${index}`, englishName: '', level: 1,
    school: 'evocation', classes: ['wizard'], ritual: false,
    castingTimeUnit: 'action', castingTimeValue: 1, reactionTrigger: '', rangeType: 'distance', rangeFeet: 60,
    rangeShape: 'none', rangeSizeFeet: 5, rangeWidthFeet: 60, rangeHeightFeet: 5, rangeRotatable: true,
    verbal: true, somatic: true, material: false, materialText: '',
    durationType: 'instantaneous', durationValue: 1, durationUnit: 'round', concentration: false,
    description: '', higherLevels: '', resolution: 'spell-attack', saveAbility: 'dex', saveOnSuccess: 'half',
    cantripScaling: false,
    cantripScalingSteps: DEFAULT_CANTRIP_SCALING_STEPS.map((step) => ({ ...step })),
    upcastFromSlotLevel: 1,
    upcastDamageDicePerLevel: 1, upcastFlatDamagePerLevel: 0,
    upcastAdditionalTargetsPerLevel: 0, upcastAdditionalProjectilesPerLevel: 0,
    upcastDurationRoundsPerLevel: 0,
    headless: { ...newHeadlessEffectDraft(), actionLabel: '施放法术' },
  }
}

function newItem(index: number): ItemDraft {
  return {
    id: `custom-item-${index}`, name: `自定义武器 ${index}`, description: '', rulesText: '',
    kind: 'weapon', slot: 'mainWeapon', weaponMode: 'melee', weaponCategory: 'martial',
    attackAbility: 'str', damageCount: 1, damageSides: 8, damageType: 'slashing',
    reachFeet: 5, rangeNormal: 20, rangeLong: 60,
    armorCategory: 'light', baseArmorClass: 11, dexterityBonus: 'full', shieldBonus: 2,
    weaponAttackBonus: 0, weaponDamageBonus: 0, armorClassBonus: 0,
    savingThrowBonus: 0, speedBonusFeet: 0,
    healingCount: 1, healingSides: 4, healingBonus: 0,
    attackRerollEnabled: false, attackRerollCharges: 4, attackRerollResetOn: 'long-rest',
    headlessEffectsUseCharges: true,
    onHitBonusDamageEnabled: false, onHitBonusDamageCount: 1, onHitBonusDamageSides: 6,
    onHitBonusDamageBonus: 0, onHitBonusDamageType: 'inherit', onHitBonusDamageOncePerTurn: false,
    damageReductionEnabled: false, damageReductionAmount: 1, damageReductionOncePerTurn: false,
    deathPreventionEnabled: false, deathPreventionHitPoints: 1, deathPreventionMassiveDamage: false,
    spellSlotRecoveryEnabled: false, spellSlotRecoveryMaximumLevel: 3, spellSlotRecoveryAmount: 1,
    spellSlotRecoveryEconomy: 'action',
  }
}

function restoreSpellDraft(value: Partial<SpellDraft>, index: number): SpellDraft {
  const fallback = newSpell(index + 1)
  const inferredLegacyRange = value.rangeShape == null && value.description
    ? inferDnd5eCustomSpellRangeFromText(value.description)
    : undefined
  const sourceDamage = value.sourceDefinition?.mechanics?.damage
  return {
    ...fallback,
    ...value,
    ...inferredLegacyRange,
    cantripScalingSteps: Array.isArray(value.cantripScalingSteps) && value.cantripScalingSteps.length > 0
      ? value.cantripScalingSteps.map((step) => ({ ...step }))
      : cantripScalingStepsFromDamage(sourceDamage),
    upcastFromSlotLevel: value.upcastFromSlotLevel ?? value.sourceDefinition?.mechanics?.upcast?.fromSlotLevel ?? Math.max(1, value.level ?? fallback.level),
    headless: restoreHeadlessEffectDraft(value.headless),
  }
}

function restoreItemDraft(value: Partial<ItemDraft>, index: number): ItemDraft {
  return { ...newItem(index + 1), ...value }
}

function upsertById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]))
  for (const entry of incoming) byId.set(entry.id, entry)
  return [...byId.values()]
}

function importedHeadlessEffectDraft(
  definition: Dnd5ePluginFeatureDefinition,
  linkedAction?: Dnd5eCustomHeadlessActionDraft,
): HeadlessEffectEditorDraft {
  const fallback = newHeadlessEffectDraft()
  const action = definition.action
  const damage = linkedAction?.effects.find((effect) => effect.kind === 'damage')
  const healing = linkedAction?.effects.find((effect) => effect.kind === 'healing')
  const condition = linkedAction?.effects.find((effect) => effect.kind === 'condition')
  const targeting = action?.targeting
  const template = targeting?.kind === 'area' ? targeting.template : undefined
  const templateRangeFeet = template?.shape === 'circle' || template?.shape === 'rect'
    ? template.placeRangeFeet ?? fallback.rangeFeet
    : template?.shape === 'cone' || template?.shape === 'line'
      ? template.aimRangeFeet ?? fallback.rangeFeet
      : fallback.rangeFeet
  const editableConditionExpiration = condition?.duration.expiresAt
  return {
    ...fallback,
    enabled: !!action,
    actionLabel: action?.label ?? definition.name,
    economy: action?.economy ?? fallback.economy,
    targetingKind: targeting?.kind ?? fallback.targetingKind,
    relation: targeting && targeting.kind !== 'self' ? targeting.relation ?? 'any' : fallback.relation,
    includeSelf: targeting && targeting.kind !== 'self' ? targeting.includeSelf ?? false : true,
    rangeFeet: targeting?.kind === 'single-creature'
      ? targeting.rangeFeet ?? fallback.rangeFeet
      : templateRangeFeet,
    areaShape: template?.shape ?? fallback.areaShape,
    areaRadiusFeet: template?.shape === 'circle' ? template.radiusFeet : fallback.areaRadiusFeet,
    areaWidthFeet: template?.shape === 'line' || template?.shape === 'rect' ? template.widthFeet : fallback.areaWidthFeet,
    areaHeightFeet: template?.shape === 'rect' ? template.heightFeet : fallback.areaHeightFeet,
    areaLengthFeet: template?.shape === 'cone' || template?.shape === 'line' ? template.lengthFeet : fallback.areaLengthFeet,
    areaRotatable: template?.shape === 'rect' ? template.rotatable ?? false : fallback.areaRotatable,
    maximumTargets: targeting?.kind === 'area' ? targeting.maximumTargets ?? fallback.maximumTargets : 1,
    persistentAreaEnabled: !!action?.persistentArea,
    persistentAreaLabel: action?.persistentArea?.label ?? fallback.persistentAreaLabel,
    persistentAreaColor: action?.persistentArea?.color ?? fallback.persistentAreaColor,
    persistentAreaDurationRounds: action?.persistentArea?.durationRounds ?? fallback.persistentAreaDurationRounds,
    persistentAreaConcentration: action?.persistentArea?.concentration ?? false,
    persistentAreaVerticalMode: action?.persistentArea?.vertical?.mode ?? 'legacy',
    persistentAreaHeightFeet: action?.persistentArea?.vertical?.mode === 'volume'
      ? action.persistentArea.vertical.heightFeet
      : fallback.persistentAreaHeightFeet,
    persistentAreaVisualPreset: action?.persistentArea?.visual?.preset ?? fallback.persistentAreaVisualPreset,
    persistentAreaVisualIntensity: action?.persistentArea?.visual?.intensity ?? fallback.persistentAreaVisualIntensity,
    persistentAreaTriggers: (action?.persistentArea?.triggers ?? []).map((trigger, index) => ({
      ...newPersistentAreaTrigger(index + 1),
      id: trigger.id,
      label: trigger.label,
      timing: trigger.timing as PersistentAreaTriggerEditorDraft['timing'],
      oncePerRound: trigger.oncePerRound ?? false,
      oncePerTurn: trigger.oncePerTurn ?? false,
      savingThrowEnabled: !!trigger.savingThrow,
      savingThrowAbility: trigger.savingThrow?.ability ?? 'con',
      savingThrowDcMode: trigger.savingThrow?.dc === 'source-save-dc' ? 'source-save-dc' : 'fixed',
      savingThrowDc: typeof trigger.savingThrow?.dc === 'number' ? trigger.savingThrow.dc : 12,
      savingThrowOnSuccess: trigger.savingThrow?.onSuccess ?? 'none',
      damageEnabled: !!trigger.damage,
      damageCount: trigger.damage?.count ?? 1,
      damageSides: trigger.damage?.sides ?? 6,
      damageModifier: trigger.damage?.modifier ?? 0,
      damageType: trigger.damage?.type ?? 'force',
      conditionEnabled: !!trigger.condition,
      condition: trigger.condition?.condition ?? 'prone',
      conditionExpiresAt: trigger.condition?.duration.expiresAt ?? 'target-turn-end',
      conditionRounds: trigger.condition?.duration.remainingRounds ?? 1,
      conditionSaveAbility: trigger.condition?.duration.saveAbility ?? 'con',
      conditionSaveDc: trigger.condition?.duration.saveDc ?? 10,
      dmAdjustable: trigger.dmAdjustable ?? false,
      sourceDeclaration: structuredClone(trigger),
      })),
    summonEnabled: !!action?.summon,
    summonMonsterId: action?.summon?.monsterId ?? fallback.summonMonsterId,
    summonLabel: action?.summon?.label ?? '',
    summonDurationRounds: action?.summon?.durationRounds ?? fallback.summonDurationRounds,
    summonConcentration: action?.summon?.concentration ?? false,
    summonSide: action?.summon?.side ?? 'ally',
    damageEnabled: !!damage,
    damageCount: damage?.dice.count ?? fallback.damageCount,
    damageSides: damage?.dice.sides ?? fallback.damageSides,
    damageModifier: damage?.dice.modifier ?? 0,
    damageType: damage?.damageType ?? fallback.damageType,
    healingEnabled: !!healing,
    healingCount: healing?.dice.count ?? fallback.healingCount,
    healingSides: healing?.dice.sides ?? fallback.healingSides,
    healingModifier: healing?.dice.modifier ?? 0,
    conditionEnabled: !!condition,
    condition: condition?.condition ?? fallback.condition,
    conditionExpiresAt: editableConditionExpiration ?? fallback.conditionExpiresAt,
    conditionRounds: condition?.duration.remainingRounds ?? fallback.conditionRounds,
    conditionSaveAbility: condition?.duration.saveAbility ?? fallback.conditionSaveAbility,
    conditionSaveDc: condition?.duration.saveDc ?? fallback.conditionSaveDc,
    interruptEnabled: !!action?.interrupt,
    interruptAudience: action?.interrupt?.audience ?? fallback.interruptAudience,
    interruptPrompt: action?.interrupt?.prompt ?? fallback.interruptPrompt,
    interruptTimeoutSeconds: Math.max(1, Math.round((action?.interrupt?.timeoutMs ?? 30_000) / 1_000)),
  }
}

function importedRaceDraft(definition: Dnd5ePluginRaceDefinition): RaceDraft {
  const bonuses = emptyBonuses()
  for (const ability of ABILITIES) bonuses[ability.key] = definition.abilityBonuses?.[ability.key] ?? 0
  return {
    ...newRace(1),
    id: definition.id,
    name: definition.name,
    description: definition.description ?? '',
    speedFeet: definition.speedFeet,
    abilityBonuses: bonuses,
    flexibleCount: definition.flexibleAbilityBonus?.count ?? 0,
    flexibleAmount: definition.flexibleAbilityBonus?.amount ?? 1,
    flexibleExclude: [...(definition.flexibleAbilityBonus?.exclude ?? [])],
    sourceDefinition: structuredClone(definition),
  }
}

function importedBackgroundDraft(definition: Dnd5ePluginBackgroundDefinition): BackgroundDraft {
  return {
    ...newBackground(1),
    id: definition.id,
    name: definition.name,
    description: definition.description ?? '',
    skillProficiencies: [...definition.skillProficiencies],
    toolProficiencies: (definition.toolProficiencies ?? []).join(', '),
    languages: definition.languages ?? 0,
    featureName: definition.feature?.name ?? '',
    featureDescription: definition.feature?.description ?? '',
    sourceDefinition: structuredClone(definition),
  }
}

function importedFeatureDraft(
  definition: Dnd5ePluginFeatureDefinition,
  headlessActions: readonly Dnd5eCustomHeadlessActionDraft[],
): FeatureDraft {
  const linkedAction = definition.action
    ? headlessActions.find((action) => action.id === definition.action?.id)
    : undefined
  return {
    ...newFeature(1),
    id: definition.id,
    name: definition.name,
    summary: definition.summary,
    description: definition.description,
    minimumLevel: definition.minimumLevel ?? 1,
    canModifyEnemyD20: definition.canModifyEnemyD20 ?? false,
    headless: importedHeadlessEffectDraft(definition, linkedAction),
    sourceDefinition: structuredClone(definition),
  }
}

function importedFeatDraft(
  definition: Dnd5ePluginFeatDefinition,
  headlessActions: readonly Dnd5eCustomHeadlessActionDraft[],
): FeatDraft {
  const feature = importedFeatureDraft(definition, headlessActions)
  return {
    ...feature,
    prerequisiteAbilities: { ...emptyBonuses(), ...(definition.prerequisite?.abilityScores ?? {}) },
    prerequisiteRaceIds: (definition.prerequisite?.raceIds ?? []).join(', '),
    minimumLevel: definition.prerequisite?.minimumLevel ?? feature.minimumLevel,
    sourceFeatDefinition: structuredClone(definition),
  }
}

function importedMethodDraft(definition: Dnd5ePluginAbilityGenerationDefinition): MethodDraft {
  const draft = newMethod(1)
  if (definition.kind === 'standard-array') draft.scores = definition.scores.join(', ')
  if (definition.kind === 'point-buy') {
    draft.budget = definition.budget
    draft.minimum = definition.minimum
    draft.maximum = definition.maximum
    draft.costs = Object.entries(definition.costs).map(([score, cost]) => `${score}:${cost}`).join(', ')
  }
  if (definition.kind === 'roll') {
    draft.diceCount = definition.diceCount
    draft.dieSides = definition.dieSides
    draft.dropLowest = definition.dropLowest
  }
  return {
    ...draft,
    id: definition.id,
    name: definition.name,
    summary: definition.summary,
    kind: definition.kind,
    sourceDefinition: structuredClone(definition),
  }
}

function importedSpellDraft(
  definition: Dnd5ePluginSpellDefinition,
  headlessActions: readonly Dnd5eCustomHeadlessActionDraft[],
): SpellDraft {
  const fallback = newSpell(1)
  const mechanics = definition.mechanics
  const automation = definition.automation
  const linkedActionId = automation?.mode === 'headless-action'
    ? automation.actionId
    : undefined
  const linkedAction = linkedActionId
    ? headlessActions.find((action) => action.id === linkedActionId)
    : undefined
  const linkedDamage = linkedAction?.effects.find((effect) => effect.kind === 'damage')
  const linkedCondition = linkedAction?.effects.find((effect) => effect.kind === 'condition')
  const condition = mechanics?.conditions?.[0]
  const damage = mechanics?.damage
  const upcast = mechanics?.upcast?.effects ?? []
  const rangeShape = definition.range.shape ?? 'none'
  const conditionExpiration = condition?.duration.kind === 'source-next-turn-start'
    ? 'source-next-turn-start' as const
    : condition?.duration.kind === 'target-next-turn-start'
      ? 'target-next-turn-start' as const
      : condition?.duration.kind === 'save-ends'
        ? 'target-turn-end-save' as const
        : 'target-turn-end' as const
  const conditionRounds = condition?.duration.kind === 'fixed-rounds'
    ? condition.duration.rounds
    : condition?.duration.kind === 'save-ends'
      ? condition.duration.maximumRounds
      : 1
  const linkedConditionExpiration = linkedCondition?.duration.expiresAt
  const headless: HeadlessEffectEditorDraft = {
    ...fallback.headless,
    enabled: definition.automation?.mode === 'headless-action',
    actionLabel: definition.name,
    targetingKind: rangeShape === 'none'
      ? definition.range.type === 'self' ? 'self' : 'single-creature'
      : 'area',
    relation: definition.targeting?.relation ?? 'enemy',
    includeSelf: definition.targeting?.includeSelf ?? definition.range.type === 'self',
    maximumTargets: definition.targeting?.maximumTargets ?? (rangeShape === 'none' ? 1 : 16),
    damageEnabled: !!(damage || linkedDamage),
    damageCount: damage?.dice.count ?? linkedDamage?.dice.count ?? 1,
    damageSides: damage?.dice.sides ?? linkedDamage?.dice.sides ?? 6,
    damageModifier: damage?.dice.bonus ?? linkedDamage?.dice.modifier ?? 0,
    damageType: damage?.type ?? linkedDamage?.damageType ?? 'force',
    conditionEnabled: !!(condition || linkedCondition),
    condition: condition?.condition ?? linkedCondition?.condition ?? 'prone',
    conditionExpiresAt: linkedConditionExpiration ?? conditionExpiration,
    conditionRounds: linkedCondition?.duration.remainingRounds ?? conditionRounds,
    conditionSaveAbility: linkedCondition?.duration.saveAbility ?? (
      condition?.duration.kind === 'save-ends' ? condition.duration.saveAbility : 'con'
    ),
    conditionSaveDc: linkedCondition?.duration.saveDc ?? 10,
  }
  return {
    ...fallback,
    id: definition.id,
    name: definition.name,
    englishName: definition.englishName ?? '',
    iconAssetId: definition.iconAssetId,
    level: definition.level,
    school: definition.school,
    classes: [...definition.classes],
    ritual: definition.ritual,
    castingTimeUnit: definition.castingTime.unit,
    castingTimeValue: definition.castingTime.value,
    reactionTrigger: definition.castingTime.reactionTrigger ?? '',
    rangeType: definition.range.type,
    rangeFeet: definition.range.feet ?? fallback.rangeFeet,
    rangeShape,
    rangeSizeFeet: definition.range.sizeFeet ?? fallback.rangeSizeFeet,
    rangeWidthFeet: definition.range.widthFeet ?? fallback.rangeWidthFeet,
    rangeHeightFeet: definition.range.heightFeet ?? fallback.rangeHeightFeet,
    rangeRotatable: definition.range.rotatable ?? fallback.rangeRotatable,
    verbal: definition.components.verbal,
    somatic: definition.components.somatic,
    material: definition.components.material,
    materialText: definition.components.materialText ?? '',
    durationType: definition.duration.type,
    durationValue: definition.duration.value ?? fallback.durationValue,
    durationUnit: definition.duration.unit ?? fallback.durationUnit,
    concentration: definition.duration.concentration,
    description: definition.description,
    higherLevels: definition.higherLevels ?? '',
    resolution: mechanics?.resolution === 'dm-adjudication'
      ? 'automatic'
      : mechanics?.resolution ?? fallback.resolution,
    saveAbility: mechanics?.savingThrow?.ability ?? fallback.saveAbility,
    saveOnSuccess: mechanics?.savingThrow?.onSuccess ?? fallback.saveOnSuccess,
    cantripScaling: !!damage?.cantripScaling,
    cantripScalingSteps: cantripScalingStepsFromDamage(damage),
    upcastFromSlotLevel: mechanics?.upcast?.fromSlotLevel ?? Math.max(1, definition.level),
    upcastDamageDicePerLevel: upcast.find((effect) => effect.kind === 'damage-dice')?.diceCountPerSlot ?? 0,
    upcastFlatDamagePerLevel: upcast.find((effect) => effect.kind === 'flat-damage')?.amountPerSlot ?? 0,
    upcastAdditionalTargetsPerLevel: upcast.find((effect) => effect.kind === 'additional-targets')?.countPerSlot ?? 0,
    upcastAdditionalProjectilesPerLevel: upcast.find((effect) => effect.kind === 'additional-projectiles')?.countPerSlot ?? 0,
    upcastDurationRoundsPerLevel: upcast.find((effect) => effect.kind === 'duration-rounds')?.roundsPerSlot ?? 0,
    headless,
    sourceDefinition: structuredClone(definition),
  }
}

function importedItemDraft(definition: Dnd5ePluginItemDefinition): ItemDraft {
  const draft = newItem(1)
  const equipment = definition.equipment
  const dnd5e = equipment?.dnd5e
  const healing = definition.use?.effect.kind === 'healing' ? definition.use.effect : undefined
  const reroll = definition.headlessEffects?.find((effect) => effect.kind === 'attack-roll-reroll')
  const bonusDamage = definition.headlessEffects?.find((effect) => effect.kind === 'on-hit-bonus-damage')
  const damageReduction = definition.headlessEffects?.find((effect) => effect.kind === 'damage-reduction')
  const deathPrevention = definition.headlessEffects?.find((effect) => effect.kind === 'death-prevention')
  const slotRecovery = definition.use?.effect.kind === 'spell-slot-recovery' ? definition.use.effect : undefined
  const effectResourceId = reroll?.resourceId ?? bonusDamage?.resourceId ?? damageReduction?.resourceId ??
    deathPrevention?.resourceId ?? definition.use?.resourceCost?.resourceId
  const charges = effectResourceId
    ? definition.resources?.find((resource) => resource.id === effectResourceId)
    : undefined
  let kind: ItemDraft['kind'] = 'accessory'
  if (definition.category === 'consumable') kind = 'consumable'
  else if (dnd5e?.kind === 'weapon') kind = 'weapon'
  else if (dnd5e?.kind === 'armor') kind = 'armor'
  else if (dnd5e?.kind === 'shield') kind = 'shield'
  return {
    ...draft,
    id: definition.id,
    name: definition.name,
    description: definition.description,
    rulesText: definition.rulesText,
    kind,
    slot: equipment?.slot ?? draft.slot,
    weaponMode: dnd5e?.kind === 'weapon' ? dnd5e.mode : draft.weaponMode,
    weaponCategory: dnd5e?.kind === 'weapon' ? dnd5e.category : draft.weaponCategory,
    attackAbility: dnd5e?.kind === 'weapon' ? dnd5e.attackAbility : draft.attackAbility,
    damageCount: dnd5e?.kind === 'weapon' ? dnd5e.damage.count : draft.damageCount,
    damageSides: dnd5e?.kind === 'weapon' ? dnd5e.damage.sides : draft.damageSides,
    damageType: dnd5e?.kind === 'weapon' ? dnd5e.damage.type : draft.damageType,
    reachFeet: dnd5e?.kind === 'weapon' ? dnd5e.reachFeet ?? draft.reachFeet : draft.reachFeet,
    rangeNormal: dnd5e?.kind === 'weapon' ? dnd5e.rangeFeet?.normal ?? draft.rangeNormal : draft.rangeNormal,
    rangeLong: dnd5e?.kind === 'weapon' ? dnd5e.rangeFeet?.long ?? draft.rangeLong : draft.rangeLong,
    armorCategory: dnd5e?.kind === 'armor' ? dnd5e.category : draft.armorCategory,
    baseArmorClass: dnd5e?.kind === 'armor' ? dnd5e.baseArmorClass : draft.baseArmorClass,
    dexterityBonus: dnd5e?.kind === 'armor' ? dnd5e.dexterityBonus : draft.dexterityBonus,
    shieldBonus: dnd5e?.kind === 'shield' ? dnd5e.armorClassBonus : draft.shieldBonus,
    weaponAttackBonus: equipment?.effects?.weaponAttackBonus ?? 0,
    weaponDamageBonus: equipment?.effects?.weaponDamageBonus ?? 0,
    armorClassBonus: equipment?.effects?.armorClassBonus ?? 0,
    savingThrowBonus: equipment?.effects?.savingThrowBonus ?? 0,
    speedBonusFeet: equipment?.effects?.speedBonusFeet ?? 0,
    healingCount: healing?.dice.count ?? draft.healingCount,
    healingSides: healing?.dice.sides ?? draft.healingSides,
    healingBonus: healing?.dice.bonus ?? draft.healingBonus,
    attackRerollEnabled: !!reroll,
    attackRerollCharges: typeof charges?.maximum === 'number' ? charges.maximum : draft.attackRerollCharges,
    attackRerollResetOn: charges?.resetOn ?? draft.attackRerollResetOn,
    headlessEffectsUseCharges: !!effectResourceId,
    onHitBonusDamageEnabled: !!bonusDamage,
    onHitBonusDamageCount: bonusDamage?.damage.count ?? draft.onHitBonusDamageCount,
    onHitBonusDamageSides: bonusDamage?.damage.sides ?? draft.onHitBonusDamageSides,
    onHitBonusDamageBonus: bonusDamage?.damage.bonus ?? draft.onHitBonusDamageBonus,
    onHitBonusDamageType: bonusDamage?.damageType ?? draft.onHitBonusDamageType,
    onHitBonusDamageOncePerTurn: bonusDamage?.oncePerTurn === true,
    damageReductionEnabled: !!damageReduction,
    damageReductionAmount: damageReduction?.amount ?? draft.damageReductionAmount,
    damageReductionOncePerTurn: damageReduction?.oncePerTurn === true,
    deathPreventionEnabled: !!deathPrevention,
    deathPreventionHitPoints: deathPrevention?.hitPointsAfter ?? draft.deathPreventionHitPoints,
    deathPreventionMassiveDamage: deathPrevention?.preventsMassiveDamage === true,
    spellSlotRecoveryEnabled: !!slotRecovery,
    spellSlotRecoveryMaximumLevel: slotRecovery?.maximumSlotLevel ?? draft.spellSlotRecoveryMaximumLevel,
    spellSlotRecoveryAmount: slotRecovery?.amount ?? draft.spellSlotRecoveryAmount,
    spellSlotRecoveryEconomy: definition.use?.economy ?? draft.spellSlotRecoveryEconomy,
    sourceDefinition: structuredClone(definition),
  }
}

function numericList(value: string): number[] {
  return value.split(/[，,\s]+/).filter(Boolean).map(Number)
}

function costTable(value: string): Record<number, number> {
  const result: Record<number, number> = {}
  for (const entry of value.split(/[，,]+/)) {
    const [score, cost] = entry.trim().split(/[:：]/).map(Number)
    if (Number.isFinite(score) && Number.isFinite(cost)) result[score] = cost
  }
  return result
}

function toRaceDefinition(race: RaceDraft): Dnd5ePluginRaceDefinition {
  const abilityBonuses = Object.fromEntries(
    ABILITIES.flatMap(({ key }) => race.abilityBonuses[key] === 0 ? [] : [[key, race.abilityBonuses[key]]]),
  ) as Partial<Record<AbilityKey, number>>
  return {
    ...race.sourceDefinition,
    id: race.id.trim(),
    name: race.name.trim(),
    description: race.description.trim(),
    speedFeet: race.speedFeet,
    abilityBonuses,
    ...(race.flexibleCount > 0 ? {
      flexibleAbilityBonus: {
        count: race.flexibleCount,
        amount: race.flexibleAmount,
        ...(race.flexibleExclude.length > 0 ? { exclude: race.flexibleExclude } : {}),
      },
    } : {}),
  }
}

function toMethodDefinition(method: MethodDraft): Dnd5ePluginAbilityGenerationDefinition {
  const base = { id: method.id.trim(), name: method.name.trim(), summary: method.summary.trim() }
  if (method.kind === 'standard-array') return { ...method.sourceDefinition, ...base, kind: 'standard-array', scores: numericList(method.scores) }
  if (method.kind === 'point-buy') return {
    ...method.sourceDefinition,
    ...base,
    kind: 'point-buy',
    budget: method.budget,
    minimum: method.minimum,
    maximum: method.maximum,
    costs: costTable(method.costs),
  }
  return {
    ...method.sourceDefinition,
    ...base,
    kind: 'roll',
    diceCount: method.diceCount,
    dieSides: method.dieSides,
    dropLowest: method.dropLowest,
  }
}

function toBackgroundDefinition(background: BackgroundDraft): Dnd5ePluginBackgroundDefinition {
  const tools = background.toolProficiencies.split(/[，,]+/).map((value) => value.trim()).filter(Boolean)
  return {
    ...background.sourceDefinition,
    id: background.id.trim(), name: background.name.trim(), description: background.description.trim(),
    skillProficiencies: [...background.skillProficiencies],
    ...(tools.length > 0 ? { toolProficiencies: tools } : {}),
    ...(background.languages > 0 ? { languages: background.languages } : {}),
    ...(background.featureName.trim() && background.featureDescription.trim() ? {
      feature: { name: background.featureName.trim(), description: background.featureDescription.trim() },
    } : {}),
  }
}

function toFeatureDefinition(feature: FeatureDraft): Dnd5ePluginFeatureDefinition {
  if (!feature.headless.enabled) {
    return {
      ...feature.sourceDefinition,
      id: feature.id.trim(), name: feature.name.trim(), summary: feature.summary.trim(),
      description: feature.description.trim(), minimumLevel: feature.minimumLevel,
      canModifyEnemyD20: feature.canModifyEnemyD20,
      automation: 'manual',
      action: undefined,
    }
  }
  const targeting = feature.headless.targetingKind === 'self'
    ? { kind: 'self' as const }
    : feature.headless.targetingKind === 'single-creature'
      ? {
          kind: 'single-creature' as const,
          relation: feature.headless.relation,
          rangeFeet: feature.headless.rangeFeet,
          includeSelf: feature.headless.includeSelf,
        }
      : {
          kind: 'area' as const,
          relation: feature.headless.relation,
          includeSelf: feature.headless.includeSelf,
          maximumTargets: feature.headless.maximumTargets,
          template: feature.headless.areaShape === 'circle'
            ? {
                shape: 'circle' as const, origin: 'point' as const,
                radiusFeet: feature.headless.areaRadiusFeet, placeRangeFeet: feature.headless.rangeFeet,
              }
            : feature.headless.areaShape === 'cone'
              ? {
                  shape: 'cone' as const, origin: 'self' as const,
                  lengthFeet: feature.headless.areaLengthFeet, aimRangeFeet: feature.headless.rangeFeet,
                }
              : feature.headless.areaShape === 'line'
                ? {
                    shape: 'line' as const, origin: 'self' as const,
                    widthFeet: feature.headless.areaWidthFeet, lengthFeet: feature.headless.areaLengthFeet,
                    aimRangeFeet: feature.headless.rangeFeet,
                  }
                : {
                    shape: 'rect' as const, origin: 'point' as const,
                    widthFeet: feature.headless.areaWidthFeet, heightFeet: feature.headless.areaHeightFeet,
                    placeRangeFeet: feature.headless.rangeFeet, rotatable: feature.headless.areaRotatable,
                  },
        }
  return {
    ...feature.sourceDefinition,
    id: feature.id.trim(), name: feature.name.trim(), summary: feature.summary.trim(),
    description: feature.description.trim(), minimumLevel: feature.minimumLevel,
    canModifyEnemyD20: feature.canModifyEnemyD20,
    automation: 'full',
    action: {
      ...feature.sourceDefinition?.action,
      id: feature.id.trim(),
      label: feature.headless.actionLabel.trim() || `使用${feature.name.trim()}`,
      description: feature.summary.trim(),
      economy: feature.headless.economy,
      targeting,
      ...(feature.headless.interruptEnabled ? {
        interrupt: {
          prompt: feature.headless.interruptPrompt.trim(),
          audience: feature.headless.interruptAudience,
          options: [
            { id: 'apply', label: '确认结算' },
            { id: 'cancel', label: '取消' },
          ],
          defaultOptionId: 'cancel',
          cancelOptionId: 'cancel',
          timeoutMs: feature.headless.interruptTimeoutSeconds * 1_000,
        },
      } : {}),
      ...(feature.headless.persistentAreaEnabled && feature.headless.targetingKind === 'area' ? {
        persistentArea: {
          label: feature.headless.persistentAreaLabel.trim() || feature.name.trim(),
          color: feature.headless.persistentAreaColor,
          durationRounds: feature.headless.persistentAreaDurationRounds,
          concentration: feature.headless.persistentAreaConcentration,
          ...(feature.headless.persistentAreaVerticalMode === 'legacy' ? {} : {
            vertical: feature.headless.persistentAreaVerticalMode === 'ground'
              ? { mode: 'ground' as const }
              : {
                  mode: 'volume' as const,
                  heightFeet: feature.headless.persistentAreaHeightFeet,
                },
          }),
          visual: {
            preset: feature.headless.persistentAreaVisualPreset,
            intensity: feature.headless.persistentAreaVisualIntensity,
          },
          ...(feature.headless.persistentAreaTriggers.length > 0 ? {
            triggers: feature.headless.persistentAreaTriggers.map((trigger) => ({
              ...trigger.sourceDeclaration,
              id: trigger.id.trim(),
              label: trigger.label.trim(),
              timing: trigger.timing,
              oncePerRound: trigger.oncePerTurn ? false : trigger.oncePerRound,
              oncePerTurn: trigger.oncePerTurn,
              ...(trigger.savingThrowEnabled ? {
                savingThrow: {
                  ability: trigger.savingThrowAbility,
                  dc: trigger.savingThrowDcMode === 'source-save-dc'
                    ? 'source-save-dc' as const
                    : trigger.savingThrowDc,
                  onSuccess: trigger.savingThrowOnSuccess,
                },
              } : {}),
              ...(trigger.damageEnabled ? {
                damage: {
                  count: trigger.damageCount,
                  sides: trigger.damageSides,
                  modifier: trigger.damageModifier,
                  type: trigger.damageType,
                },
              } : {}),
              ...(trigger.conditionEnabled ? {
                condition: {
                  condition: trigger.condition,
                  duration: {
                    expiresAt: trigger.conditionExpiresAt,
                    remainingRounds: trigger.conditionRounds,
                    ...(trigger.conditionExpiresAt === 'target-turn-end-save' ? {
                      saveAbility: trigger.conditionSaveAbility,
                      saveDc: trigger.conditionSaveDc,
                    } : {}),
                  },
                },
              } : {}),
              dmAdjustable: trigger.dmAdjustable,
            })),
          } : {}),
        },
      } : {}),
      ...(feature.headless.summonEnabled && feature.headless.targetingKind === 'area' ? {
        summon: {
          monsterId: feature.headless.summonMonsterId as `srd-5.1:${string}`,
          ...(feature.headless.summonLabel.trim() ? { label: feature.headless.summonLabel.trim() } : {}),
          durationRounds: feature.headless.summonDurationRounds,
          concentration: feature.headless.summonConcentration,
          side: feature.headless.summonSide,
        },
      } : {}),
    },
  }
}

function toFeatDefinition(feat: FeatDraft): Dnd5ePluginFeatDefinition {
  const { minimumLevel: _minimumLevel, ...feature } = toFeatureDefinition(feat)
  void _minimumLevel
  const abilityScores = Object.fromEntries(
    ABILITIES.flatMap(({ key }) => feat.prerequisiteAbilities[key] > 0
      ? [[key, feat.prerequisiteAbilities[key]]]
      : []),
  ) as Partial<Record<AbilityKey, number>>
  const raceIds = feat.prerequisiteRaceIds.split(/[，,]+/).map((entry) => entry.trim()).filter(Boolean)
  return {
    ...feat.sourceFeatDefinition,
    ...feature,
    prerequisite: {
      ...(feat.minimumLevel > 1 ? { minimumLevel: feat.minimumLevel } : {}),
      ...(Object.keys(abilityScores).length ? { abilityScores } : {}),
      ...(raceIds.length ? { raceIds } : {}),
    },
  }
}

function toHeadlessActionDraftFromEditor(id: string, name: string, headless: HeadlessEffectEditorDraft): Dnd5eCustomHeadlessActionDraft | undefined {
  if (!headless.enabled) return undefined
  const effects: Dnd5eCustomHeadlessActionDraft['effects'] = []
  if (headless.damageEnabled) effects.push({
    kind: 'damage',
    dice: {
      count: headless.damageCount,
      sides: headless.damageSides,
      modifier: headless.damageModifier,
    },
    damageType: headless.damageType,
  })
  if (headless.healingEnabled) effects.push({
    kind: 'healing',
    dice: {
      count: headless.healingCount,
      sides: headless.healingSides,
      modifier: headless.healingModifier,
    },
  })
  if (headless.conditionEnabled) effects.push({
    kind: 'condition',
    condition: headless.condition,
    duration: {
      expiresAt: headless.conditionExpiresAt,
      remainingRounds: headless.conditionRounds,
      ...(headless.conditionExpiresAt === 'target-turn-end-save' ? {
        saveAbility: headless.conditionSaveAbility,
        saveDc: headless.conditionSaveDc,
      } : {}),
    },
  })
  return {
    id: id.trim(),
    label: headless.actionLabel.trim() || name.trim(),
    effects,
    ...(headless.interruptEnabled ? { requiredInterruptOptionId: 'apply' } : {}),
  }
}

function toHeadlessActionDraft(feature: FeatureDraft): Dnd5eCustomHeadlessActionDraft | undefined {
  return toHeadlessActionDraftFromEditor(feature.id, feature.name, feature.headless)
}

function spellHeadlessEffectDraft(spell: SpellDraft): HeadlessEffectEditorDraft {
  return {
    ...spell.headless,
    ...dnd5eCustomSpellHeadlessRangePatch({
      rangeType: spell.rangeType,
      rangeFeet: spell.rangeFeet,
      rangeShape: spell.rangeShape,
      rangeSizeFeet: spell.rangeSizeFeet,
      rangeWidthFeet: spell.rangeWidthFeet,
      rangeHeightFeet: spell.rangeHeightFeet,
      rangeRotatable: spell.rangeRotatable,
      currentRangeFeet: spell.headless.rangeFeet,
      currentAreaWidthFeet: spell.headless.areaWidthFeet,
    }),
  }
}

function toSpellDefinition(spell: SpellDraft): Dnd5ePluginSpellDefinition {
  const headlessReady = dnd5eSpellWorkshopHeadlessReady(spell.headless)
  return {
    ...spell.sourceDefinition,
    id: spell.id.trim(), name: spell.name.trim(),
    ...(spell.englishName.trim() ? { englishName: spell.englishName.trim() } : {}),
    ...(spell.iconAssetId ? { iconAssetId: spell.iconAssetId } : { iconAssetId: undefined }),
    level: spell.level, school: spell.school, ritual: spell.ritual,
    castingTime: {
      value: spell.castingTimeValue, unit: spell.castingTimeUnit,
      ...(spell.castingTimeUnit === 'reaction' && spell.reactionTrigger.trim()
        ? { reactionTrigger: spell.reactionTrigger.trim() }
        : {}),
    },
    range: {
      type: spell.rangeType,
      ...(spell.rangeType === 'distance' ? { feet: spell.rangeFeet } : {}),
      ...(spell.rangeShape === 'rect' ? {
        shape: spell.rangeShape,
        widthFeet: spell.rangeWidthFeet,
        heightFeet: spell.rangeHeightFeet,
        rotatable: spell.rangeType !== 'self' && spell.rangeRotatable,
      } : spell.rangeShape !== 'none' ? { shape: spell.rangeShape, sizeFeet: spell.rangeSizeFeet } : {}),
    },
    ...(headlessReady ? {
      targeting: {
        relation: spell.headless.relation,
        includeSelf: spell.headless.includeSelf,
        maximumTargets: spell.rangeShape === 'none' ? 1 : spell.headless.maximumTargets,
      },
    } : {}),
    components: {
      verbal: spell.verbal, somatic: spell.somatic, material: spell.material,
      ...(spell.material && spell.materialText.trim() ? { materialText: spell.materialText.trim() } : {}),
    },
    duration: {
      type: spell.durationType, concentration: spell.durationType !== 'instantaneous' && spell.concentration,
      ...(spell.durationType === 'timed' ? { value: spell.durationValue, unit: spell.durationUnit } : {}),
    },
    classes: [...spell.classes], description: spell.description.trim(),
    ...(spell.higherLevels.trim() ? { higherLevels: spell.higherLevels.trim() } : {}),
    ...(headlessReady ? {
      mechanics: {
        kind: spell.headless.damageEnabled ? 'damage' as const : spell.headless.conditionEnabled ? 'control' as const : 'utility' as const,
        resolution: spell.resolution,
        ...(spell.resolution === 'saving-throw' ? { savingThrow: { ability: spell.saveAbility, onSuccess: spell.saveOnSuccess } } : {}),
        ...(spell.headless.damageEnabled ? {
          damage: {
            dice: { count: spell.headless.damageCount, sides: spell.headless.damageSides, bonus: spell.headless.damageModifier },
            type: spell.headless.damageType,
            ...(spell.level === 0 && spell.cantripScaling ? {
              cantripScaling: {
                basis: 'character-level' as const,
                steps: spell.cantripScalingSteps.map((step) => ({
                  level: step.level,
                  diceCount: step.diceCount,
                  ...((step.flatDamage ?? 0) > 0 ? { flatDamage: step.flatDamage } : {}),
                })),
              },
            } : {}),
            ...(spell.sourceDefinition?.mechanics?.damage?.addSpellcastingModifier ? { addSpellcastingModifier: true } : {}),
          },
        } : {}),
        ...(spell.headless.conditionEnabled ? {
          conditions: [{
            condition: spell.headless.condition,
            trigger: spell.resolution === 'spell-attack' ? 'on-hit' as const : spell.resolution === 'saving-throw' ? 'on-failed-save' as const : 'always' as const,
            duration: spell.concentration
              ? { kind: 'concentration' as const }
              : spell.headless.conditionExpiresAt === 'target-turn-end-save'
                ? { kind: 'save-ends' as const, timing: 'target-turn-end' as const, maximumRounds: spell.headless.conditionRounds, saveAbility: spell.headless.conditionSaveAbility }
                : { kind: 'fixed-rounds' as const, rounds: spell.headless.conditionRounds },
          }],
        } : {}),
        ...(spell.level > 0 ? (() => {
          const effects = [
            ...(spell.headless.damageEnabled && spell.upcastDamageDicePerLevel > 0
              ? [{ kind: 'damage-dice' as const, diceCountPerSlot: spell.upcastDamageDicePerLevel }]
              : []),
            ...(spell.headless.damageEnabled && spell.upcastFlatDamagePerLevel > 0
              ? [{ kind: 'flat-damage' as const, amountPerSlot: spell.upcastFlatDamagePerLevel }]
              : []),
            ...(spell.upcastAdditionalTargetsPerLevel > 0
              ? [{ kind: 'additional-targets' as const, countPerSlot: spell.upcastAdditionalTargetsPerLevel }]
              : []),
            ...(spell.upcastAdditionalProjectilesPerLevel > 0
              ? [{ kind: 'additional-projectiles' as const, countPerSlot: spell.upcastAdditionalProjectilesPerLevel }]
              : []),
            ...(spell.upcastDurationRoundsPerLevel > 0
              ? [{ kind: 'duration-rounds' as const, roundsPerSlot: spell.upcastDurationRoundsPerLevel }]
              : []),
          ]
          return effects.length > 0 ? { upcast: { fromSlotLevel: spell.upcastFromSlotLevel, effects } } : {}
        })() : {}),
      },
      automation: { mode: 'headless-action' as const, actionId: spell.id.trim() },
    } : { automation: { mode: 'reference-only' as const } }),
  }
}

function staticEffects(item: ItemDraft) {
  const effects = {
    ...(item.weaponAttackBonus ? { weaponAttackBonus: item.weaponAttackBonus } : {}),
    ...(item.weaponDamageBonus ? { weaponDamageBonus: item.weaponDamageBonus } : {}),
    ...(item.armorClassBonus ? { armorClassBonus: item.armorClassBonus } : {}),
    ...(item.savingThrowBonus ? { savingThrowBonus: item.savingThrowBonus } : {}),
    ...(item.speedBonusFeet ? { speedBonusFeet: item.speedBonusFeet } : {}),
  }
  return Object.keys(effects).length > 0 ? effects : undefined
}

function toItemDefinition(item: ItemDraft): Dnd5ePluginItemDefinition {
  const sourceDefinition = item.sourceDefinition ? structuredClone(item.sourceDefinition) : undefined
  if (sourceDefinition) {
    delete sourceDefinition.resources
    delete sourceDefinition.headlessEffects
    delete sourceDefinition.use
  }
  const chargeBound = item.attackRerollEnabled || item.headlessEffectsUseCharges
  const chargeReference = chargeBound ? { resourceId: 'charges', resourceCost: 1 } : {}
  const headlessEffects: NonNullable<Dnd5ePluginItemDefinition['headlessEffects']> = [
    ...(item.attackRerollEnabled ? [{
      schemaVersion: 1 as const,
      id: 'attack-reroll',
      kind: 'attack-roll-reroll' as const,
      resourceId: 'charges',
      resourceCost: 1,
      maximumDice: 1 as const,
      trigger: 'after-attack-roll' as const,
      appliesTo: item.kind === 'weapon' ? 'attacks-with-this-weapon' as const : 'weapon-attacks' as const,
    }] : []),
    ...(item.onHitBonusDamageEnabled ? [{
      schemaVersion: 1 as const,
      id: 'on-hit-bonus-damage',
      kind: 'on-hit-bonus-damage' as const,
      trigger: 'after-attack-hit' as const,
      appliesTo: item.kind === 'weapon' ? 'attacks-with-this-weapon' as const : 'weapon-attacks' as const,
      damage: {
        count: item.onHitBonusDamageCount,
        sides: item.onHitBonusDamageSides,
        bonus: item.onHitBonusDamageBonus,
      },
      damageType: item.onHitBonusDamageType,
      doubleDiceOnCritical: true,
      oncePerTurn: item.onHitBonusDamageOncePerTurn,
      ...chargeReference,
    }] : []),
    ...(item.damageReductionEnabled ? [{
      schemaVersion: 1 as const,
      id: 'damage-reduction',
      kind: 'damage-reduction' as const,
      trigger: 'before-damage' as const,
      amount: item.damageReductionAmount,
      oncePerTurn: item.damageReductionOncePerTurn,
      ...chargeReference,
    }] : []),
    ...(item.deathPreventionEnabled ? [{
      schemaVersion: 1 as const,
      id: 'death-prevention',
      kind: 'death-prevention' as const,
      trigger: 'before-drop-to-zero' as const,
      hitPointsAfter: item.deathPreventionHitPoints,
      preventsMassiveDamage: item.deathPreventionMassiveDamage,
      ...chargeReference,
    }] : []),
  ]
  const needsChargeResource = item.attackRerollEnabled || (
    item.headlessEffectsUseCharges && (headlessEffects.length > 0 || item.spellSlotRecoveryEnabled)
  )
  const use: Dnd5ePluginItemDefinition['use'] = item.spellSlotRecoveryEnabled
    ? {
        economy: item.spellSlotRecoveryEconomy,
        consumeQuantity: item.kind === 'consumable' ? 1 : 0,
        ...(item.headlessEffectsUseCharges ? { resourceCost: { resourceId: 'charges', amount: 1 } } : {}),
        effect: {
          kind: 'spell-slot-recovery',
          maximumSlotLevel: item.spellSlotRecoveryMaximumLevel,
          amount: item.spellSlotRecoveryAmount,
          selection: 'selected-expended-slot',
        },
      }
    : item.kind === 'consumable'
      ? {
          economy: 'action', consumeQuantity: 1,
          effect: { kind: 'healing', dice: { count: item.healingCount, sides: item.healingSides, bonus: item.healingBonus } },
        }
      : item.sourceDefinition?.use?.effect.kind === 'spell-slot-recovery'
        ? undefined
        : item.sourceDefinition?.use
  const common = {
    ...sourceDefinition,
    id: item.id.trim(), name: item.name.trim(), description: item.description.trim(),
    rulesText: item.rulesText.trim(), weightLb: 0, stackable: false,
    ...(needsChargeResource ? {
      resources: [{
        id: 'charges', label: '充能', maximum: item.attackRerollCharges,
        initial: item.attackRerollCharges, resetOn: item.attackRerollResetOn,
      }],
    } : {}),
    ...(headlessEffects.length > 0 ? { headlessEffects } : {}),
    ...(use ? { use } : {}),
  }
  if (item.kind === 'consumable') return {
    ...common, category: 'consumable', icon: 'healing-potion', stackable: true,
  }
  const effects = staticEffects(item)
  if (item.kind === 'weapon') return {
    ...common, category: 'equipment', icon: 'weapon',
    equipment: {
      slot: item.slot, ...(effects ? { effects } : {}),
      dnd5e: {
        kind: 'weapon', category: item.weaponCategory, mode: item.weaponMode,
        damage: { count: item.damageCount, sides: item.damageSides, type: item.damageType },
        attackAbility: item.attackAbility,
        ...(item.weaponMode === 'melee' ? { reachFeet: item.reachFeet } : {
          rangeFeet: { normal: item.rangeNormal, long: item.rangeLong },
        }),
      },
    },
  }
  if (item.kind === 'armor') return {
    ...common, category: 'equipment', icon: 'armor',
    equipment: {
      slot: 'armor', ...(effects ? { effects } : {}),
      dnd5e: {
        kind: 'armor', category: item.armorCategory,
        baseArmorClass: item.baseArmorClass, dexterityBonus: item.dexterityBonus,
      },
    },
  }
  if (item.kind === 'shield') return {
    ...common, category: 'equipment', icon: 'shield',
    equipment: {
      slot: 'offHand', ...(effects ? { effects } : {}),
      dnd5e: { kind: 'shield', armorClassBonus: item.shieldBonus },
    },
  }
  return {
    ...common, category: 'equipment', icon: 'generic',
    equipment: { slot: item.slot, ...(effects ? { effects } : {}) },
  }
}

export default function Dnd5eCustomPluginBuilder({
  defaultPublisher = '房间 DM',
  busy = false,
  onInstall,
  installLabel = '保存、启用并发布',
  onPublish,
  publishLabel = '上传插件中心并定价',
  alwaysExpanded = false,
  categoryControl = 'tabs',
  monsterWorkshopImport,
  onMonsterWorkshopImportClose,
  contentWorkshopImport,
  onContentWorkshopImportClose,
  draftStorageScope = 'local',
}: Props) {
  const [defaultMetadata] = useState(() => defaultBuilderMetadata(defaultPublisher))
  const [draftStorageKey] = useState(() => scopedBuilderDraftStorageKey(draftStorageScope))
  const [restoredDraft] = useState(() => readSavedBuilderDraft(draftStorageKey))
  const [open, setOpen] = useState(alwaysExpanded)
  const [activeSection, setActiveSection] = useState<BuilderSection>('monsters')
  const [metadata, setMetadata] = useState(() => ({ ...defaultMetadata, ...(restoredDraft?.metadata ?? {}) }))
  const [races, setRaces] = useState<RaceDraft[]>(() => Array.isArray(restoredDraft?.races) ? restoredDraft.races : [])
  const [backgrounds, setBackgrounds] = useState<BackgroundDraft[]>(() => Array.isArray(restoredDraft?.backgrounds) ? restoredDraft.backgrounds : [])
  const [features, setFeatures] = useState<FeatureDraft[]>(() => Array.isArray(restoredDraft?.features)
    ? restoredDraft.features.map((feature, index) => restoreFeatureDraft(feature, index))
    : [])
  const [feats, setFeats] = useState<FeatDraft[]>(() => Array.isArray(restoredDraft?.feats)
    ? restoredDraft.feats.map((feat, index) => restoreFeatDraft(feat, index))
    : [])
  const [spells, setSpells] = useState<SpellDraft[]>(() => Array.isArray(restoredDraft?.spells)
    ? restoredDraft.spells.map((spell, index) => restoreSpellDraft(spell, index))
    : [])
  const [expandedSpellIndex, setExpandedSpellIndex] = useState<number | null>(null)
  const [items, setItems] = useState<ItemDraft[]>(() => Array.isArray(restoredDraft?.items)
    ? restoredDraft.items.map((item, index) => restoreItemDraft(item, index))
    : [])
  const [methods, setMethods] = useState<MethodDraft[]>(() => Array.isArray(restoredDraft?.methods) ? restoredDraft.methods : [])
  const [subclasses, setSubclasses] = useState<DeclarativeSubclassDefinitionV1[]>(() => Array.isArray(restoredDraft?.subclasses) ? restoredDraft.subclasses : [])
  const [classes, setClasses] = useState<DeclarativeClassDefinitionV1[]>(() => Array.isArray(restoredDraft?.classes) ? restoredDraft.classes : [])
  const [monsters, setMonsters] = useState<Dnd5eMonsterStatBlock[]>(() => Array.isArray(restoredDraft?.monsters) ? restoredDraft.monsters : [])
  const [assets, setAssets] = useState<Dnd5ePluginImageAssetDefinition[]>(() =>
    Array.isArray(restoredDraft?.assets) ? restoredDraft.assets : [])
  const [importedHeadlessActions, setImportedHeadlessActions] = useState<Dnd5eCustomHeadlessActionDraft[]>(() =>
    Array.isArray(restoredDraft?.importedHeadlessActions) ? restoredDraft.importedHeadlessActions : [])
  const [monsterWorkshopOpen, setMonsterWorkshopOpen] = useState(false)
  const [selectedMonsterWorkshopEdit, setSelectedMonsterWorkshopEdit] = useState<Dnd5eMonsterWorkshopEditRequest | null>(null)
  const monsterWorkshopEditRequestId = useRef(0)
  const [openSpellsAfterMonsterWorkshop, setOpenSpellsAfterMonsterWorkshop] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(() => restoredDraft ? '已自动恢复当前房间的本地草稿。' : null)
  const lastContentImportRequestId = useRef<number | null>(null)
  const contentMonster = contentWorkshopImport?.targetKind === 'monster'
    ? contentWorkshopImport.package.content.monsters[0]
    : undefined
  const importedMonsterWorkshopEdit = monsterWorkshopImport ?? (contentMonster && contentWorkshopImport
    ? {
        requestId: contentWorkshopImport.requestId,
        monster: contentMonster,
        review: contentWorkshopImport.review,
      }
    : null)
  const effectiveMonsterWorkshopImport = importedMonsterWorkshopEdit ?? selectedMonsterWorkshopEdit
  const displayedSection: BuilderSection = effectiveMonsterWorkshopImport ? 'monsters' : activeSection

  useEffect(() => {
    if (!contentWorkshopImport || lastContentImportRequestId.current === contentWorkshopImport.requestId) return
    lastContentImportRequestId.current = contentWorkshopImport.requestId
    const content = contentWorkshopImport.package.content
    const timer = window.setTimeout(() => {
      setOpen(true)
      setAssets((current) => upsertById(current, contentWorkshopImport.package.assets))
      setImportedHeadlessActions((current) => upsertById(current, content.headlessActions))
      switch (contentWorkshopImport.targetKind) {
      case 'monster':
        setActiveSection('monsters')
        if (content.monsters.length > 1) {
          setMonsters((current) => upsertById(current, content.monsters.slice(1)))
        }
        break
      case 'spell': {
        const incoming = content.spells.map((spell) => importedSpellDraft(spell, content.headlessActions))
        const firstId = incoming[0]?.id
        const existingIndex = firstId ? spells.findIndex((spell) => spell.id === firstId) : -1
        const nextIndex = existingIndex >= 0 ? existingIndex : spells.length
        setSpells((current) => upsertById(current, incoming))
        setExpandedSpellIndex(incoming.length > 0 ? nextIndex : null)
        setActiveSection('spells')
        break
      }
      case 'class':
        setClasses((current) => upsertById(current, content.classes ?? []))
        setActiveSection('classes')
        break
      case 'subclass':
        setSubclasses((current) => upsertById(current, content.subclasses))
        setActiveSection('subclasses')
        break
      case 'race':
        setRaces((current) => upsertById(current, content.races.map(importedRaceDraft)))
        setActiveSection('races')
        break
      case 'background':
        setBackgrounds((current) => upsertById(current, content.backgrounds.map(importedBackgroundDraft)))
        setActiveSection('backgrounds')
        break
      case 'feat':
        setFeats((current) => upsertById(current, content.feats.map((feat) => importedFeatDraft(feat, content.headlessActions))))
        setActiveSection('feats')
        break
      case 'feature':
        setFeatures((current) => upsertById(current, content.features.map((feature) => importedFeatureDraft(feature, content.headlessActions))))
        setActiveSection('features')
        break
      case 'item':
        setItems((current) => upsertById(current, content.items.map(importedItemDraft)))
        setActiveSection('items')
        break
      case 'ability-generation':
        setMethods((current) => upsertById(current, content.abilityGenerationMethods.map(importedMethodDraft)))
        setActiveSection('methods')
        break
      }
      setLocalError(null)
      setLocalNotice(`AI 结构化内容已载入“${builderSectionLabel(
        builderSectionForAiTarget(contentWorkshopImport.targetKind),
      )}”编辑器；同 ID 条目已更新，其他草稿保持不变。`)
      document.querySelector('[data-testid="custom-rules-plugin-builder"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [contentWorkshopImport, spells])

  const draft = useMemo<Dnd5eCustomRulesPluginDraft>(() => ({
    manifest: {
      ...metadata,
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      stateSchemaVersion: 1,
      manifestSchemaVersion: 1,
      minimumGameProtocolVersion: metadata.minimumGameProtocolVersion,
      dependencies: metadata.dependencies.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
        const [id = '', versionRange = '*', marker = ''] = entry.split(/\s+/)
        return { id, versionRange, ...(marker === 'optional' ? { optional: true } : {}) }
      }),
      conflicts: metadata.conflicts.split(',').map((entry) => entry.trim()).filter(Boolean),
      declaredCapabilities: metadata.declaredCapabilities,
      distributionPolicy: metadata.distributionPolicy,
      contentCategory: metadata.contentCategory,
    },
    races: races.map(toRaceDefinition),
    backgrounds: backgrounds.map(toBackgroundDefinition),
    features: features.map(toFeatureDefinition),
    feats: feats.map(toFeatDefinition),
    spells: spells.map(toSpellDefinition),
    items: items.map(toItemDefinition),
    abilityGenerationMethods: methods.map(toMethodDefinition),
    headlessActions: upsertById(importedHeadlessActions, [
      ...features.flatMap((feature) => {
        const action = toHeadlessActionDraft(feature)
        return action ? [action] : []
      }),
      ...feats.flatMap((feat) => {
        const action = toHeadlessActionDraft(feat)
        return action ? [action] : []
      }),
      ...spells.flatMap((spell) => {
        if (!dnd5eSpellWorkshopHeadlessReady(spell.headless)) return []
        const action = toHeadlessActionDraftFromEditor(spell.id, spell.name, {
          ...spellHeadlessEffectDraft(spell),
          healingEnabled: false,
          interruptEnabled: false,
        })
        return action ? [action] : []
      }),
    ]),
    subclasses,
    classes,
    monsters,
  }), [backgrounds, classes, feats, features, importedHeadlessActions, items, metadata, methods, monsters, races, spells, subclasses])

  const sectionCounts = useMemo<Record<BuilderSection, number>>(() => ({
    monsters: monsters.length,
    classes: classes.length,
    subclasses: subclasses.length,
    races: races.length,
    backgrounds: backgrounds.length,
    feats: feats.length,
    features: features.length,
    spells: spells.length,
    items: items.length,
    methods: methods.length,
  }), [backgrounds.length, classes.length, feats.length, features.length, items.length, methods.length, monsters.length, races.length, spells.length, subclasses.length])

  const resourceInventoryEntries = useMemo<readonly Dnd5eBuilderResourceInventoryEntry[]>(() => {
    if (displayedSection === 'classes') return classes.map((definition) => {
      const report = dnd5eCustomClassAutomationReportV1({ classes: [definition] })
      const reasons = [...new Set(report.features.flatMap((feature) => feature.reasons))]
      return {
        id: definition.id,
        name: definition.name,
        summary: definition.summary,
        automation: report.features.length > 0
          ? { full: report.full, partial: report.partial, manual: report.manual, referenceOnly: 0 }
          : singleAutomationCount('reference-only'),
        ...(reasons.length > 0 ? { reasons } : {}),
      }
    })
    if (displayedSection === 'subclasses') return subclasses.map((subclass) => {
      const report = dnd5eCustomPluginAutomationReportV1({ subclasses: [subclass] })
      const reasons = [...new Set(report.abilities.flatMap((ability) => ability.reasons))]
      return {
        id: subclass.id,
        name: subclass.name,
        summary: subclass.summary,
        automation: report.abilities.length > 0
          ? { full: report.full, partial: report.partial, manual: report.manual, referenceOnly: 0 }
          : singleAutomationCount('reference-only'),
        ...(reasons.length > 0 ? { reasons } : {}),
      }
    })
    if (displayedSection === 'monsters') return monsters.map((monster) => {
      const actions = [
        ...monster.actions,
        ...(monster.bonusActions ?? []),
        ...(monster.reactions ?? []),
        ...(monster.legendaryActions ?? []),
        ...(monster.lairActions ?? []),
      ]
      const statuses: Dnd5eBuilderAutomationStatus[] = [
        ...monster.traits.map((trait) => trait.automation === 'headless' ? 'full' as const : 'manual' as const),
        ...actions.map((action) => action.automation === 'headless' ? 'full' as const : 'manual' as const),
        ...(monster.spellcasting
          ? [monster.spellcasting.automation === 'headless' ? 'full' as const : 'manual' as const]
          : []),
        ...(monster.headlessMechanics ?? []).map((mechanic) => mechanic.schemaVersion === 1
          ? 'full' as const
          : mechanic.automation),
      ]
      const automation = statuses.length > 0
        ? automationCountsFromStatuses(statuses)
        : singleAutomationCount('reference-only')
      const manualCount = automation.manual + automation.referenceOnly
      return {
        id: monster.id,
        name: monster.name,
        summary: `CR ${monster.challenge.rating} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
        automation,
        ...(manualCount > 0 ? { reasons: [`仍有 ${manualCount} 项能力或机制需要 DM 裁定或仅作资料展示`] } : {}),
      }
    })
    if (displayedSection === 'races') return races.map((race) => ({
      id: race.id,
      name: race.name,
      summary: race.description,
      automation: singleAutomationCount('full'),
    }))
    if (displayedSection === 'backgrounds') return backgrounds.map((background) => ({
      id: background.id,
      name: background.name,
      summary: background.description,
      automation: singleAutomationCount('full'),
    }))
    if (displayedSection === 'features') return features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      summary: feature.summary,
      automation: singleAutomationCount(feature.headless.enabled ? 'full' : 'manual'),
      ...(!feature.headless.enabled ? { reasons: ['尚未启用声明式 Headless 效果，由 DM 依据规则正文裁定'] } : {}),
    }))
    if (displayedSection === 'feats') return feats.map((feat) => ({
      id: feat.id,
      name: feat.name,
      summary: feat.summary,
      automation: singleAutomationCount(feat.headless.enabled ? 'full' : 'manual'),
      ...(!feat.headless.enabled ? { reasons: ['尚未启用声明式 Headless 效果，由 DM 依据规则正文裁定'] } : {}),
    }))
    if (displayedSection === 'spells') return spells.map((spell) => {
      const status = dnd5eSpellWorkshopHeadlessStatus(spell.headless)
      return {
        id: spell.id,
        name: spell.name,
        summary: `${spell.level === 0 ? '戏法' : `${spell.level} 环`} · ${spell.school}`,
        automation: singleAutomationCount(status),
        ...(status === 'reference-only'
          ? { reasons: ['只接入法术资料，尚未启用 Host 自动结算'] }
          : status === 'partial'
            ? { reasons: ['已开启自动结算，但尚未配置伤害或标准状态；保存时会安全回落为仅资料'] }
            : {}),
      }
    })
    if (displayedSection === 'items') return items.map((item) => ({
      id: item.id,
      name: item.name,
      summary: item.description,
      automation: singleAutomationCount('full'),
    }))
    if (displayedSection === 'methods') return methods.map((method) => ({
      id: method.id,
      name: method.name,
      summary: method.summary,
      automation: singleAutomationCount('full'),
    }))
    return []
  }, [displayedSection, backgrounds, classes, feats, features, items, methods, monsters, races, spells, subclasses])

  const openMonsterInWorkshop = (entry: Dnd5eBuilderResourceInventoryEntry) => {
    const monster = monsters.find((candidate) => candidate.id === entry.id)
    if (!monster) return
    monsterWorkshopEditRequestId.current += 1
    setSelectedMonsterWorkshopEdit({
      requestId: monsterWorkshopEditRequestId.current,
      monster,
    })
    setMonsterWorkshopOpen(true)
  }

  const savedBuilderDraft = useMemo<SavedBuilderDraft>(() => ({
    metadata,
    races,
    backgrounds,
    features,
    feats,
    spells,
    items,
    methods,
    subclasses,
    classes,
    monsters,
    assets,
    importedHeadlessActions,
  }), [assets, backgrounds, classes, feats, features, importedHeadlessActions, items, metadata, methods, monsters, races, spells, subclasses])

  useEffect(() => {
    try {
      if (builderDraftHasContent(savedBuilderDraft, defaultMetadata)) {
        localStorage.setItem(draftStorageKey, JSON.stringify(savedBuilderDraft))
      } else {
        localStorage.removeItem(draftStorageKey)
      }
    } catch {
      // 自动保存是尽力而为；“保存本地草稿”按钮仍会给出明确错误。
    }
  }, [defaultMetadata, draftStorageKey, savedBuilderDraft])

  const saveDraft = () => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(savedBuilderDraft))
      setLocalError(null)
      setLocalNotice('草稿已保存在当前浏览器，并会在刷新后自动恢复。')
    } catch {
      setLocalError('浏览器无法保存规则包草稿。')
    }
  }

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(draftStorageKey)
      if (!raw) return setLocalError('尚未保存本地草稿。')
      const saved = JSON.parse(raw) as Partial<SavedBuilderDraft>
      if (!saved.metadata || !Array.isArray(saved.races) || !Array.isArray(saved.methods)) {
        return setLocalError('本地草稿格式无效。')
      }
      setMetadata((current) => ({ ...current, ...saved.metadata }))
      setRaces(saved.races)
      setBackgrounds(Array.isArray(saved.backgrounds) ? saved.backgrounds : [])
      setFeatures(Array.isArray(saved.features)
        ? saved.features.map((feature, index) => restoreFeatureDraft(feature, index))
        : [])
      setFeats(Array.isArray(saved.feats) ? saved.feats.map((feat, index) => restoreFeatDraft(feat, index)) : [])
      setSpells(Array.isArray(saved.spells) ? saved.spells.map((spell, index) => restoreSpellDraft(spell, index)) : [])
      setExpandedSpellIndex(null)
      setItems(Array.isArray(saved.items) ? saved.items.map((item, index) => restoreItemDraft(item, index)) : [])
      setMethods(saved.methods)
      setSubclasses(Array.isArray(saved.subclasses) ? saved.subclasses : [])
      setClasses(Array.isArray(saved.classes) ? saved.classes : [])
      setMonsters(Array.isArray(saved.monsters) ? saved.monsters : [])
      setAssets(Array.isArray(saved.assets) ? saved.assets : [])
      setImportedHeadlessActions(Array.isArray(saved.importedHeadlessActions) ? saved.importedHeadlessActions : [])
      setLocalError(null)
      setLocalNotice('已载入当前浏览器保存的草稿。')
    } catch {
      setLocalError('读取本地草稿失败。')
    }
  }

  const deleteDraft = async () => {
    if (!await showAppConfirm({
      title: '删除当前房间草稿',
      message: '这会删除当前浏览器中本房间的工坊草稿和当前表单内容；已经启用的规则与扩展不会被移除。',
      confirmLabel: '确认删除草稿',
      tone: 'danger',
    })) return
    localStorage.removeItem(draftStorageKey)
    setMetadata({ ...defaultMetadata })
    setRaces([])
    setBackgrounds([])
    setFeatures([])
    setFeats([])
    setSpells([])
    setExpandedSpellIndex(null)
    setItems([])
    setMethods([])
    setSubclasses([])
    setClasses([])
    setMonsters([])
    setAssets([])
    setImportedHeadlessActions([])
    setLocalError(null)
    setLocalNotice('已删除当前房间的本地工坊草稿；已启用内容不受影响。')
  }

  const buildFile = () => {
    const errors = validateDnd5eCustomRulesPluginDraft(draft)
    if (errors.length > 0) {
      setLocalError(errors.join('；'))
      setLocalNotice(null)
      return null
    }
    setLocalError(null)
    const source = buildDnd5eCustomRulesContentPackageV2(draft, assets)
    return new File([source], dnd5eCustomRulesPluginFileName(draft.manifest.id), { type: 'application/json' })
  }

  const download = () => {
    const file = buildFile()
    if (!file) return
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const install = async () => {
    const file = buildFile()
    if (file) await onInstall(file)
  }

  const publish = async () => {
    const file = buildFile()
    if (file && onPublish) await onPublish(file)
  }

  const patchRace = (index: number, patch: Partial<RaceDraft>) => {
    setRaces((current) => current.map((race, itemIndex) => itemIndex === index ? { ...race, ...patch } : race))
  }
  const patchMethod = (index: number, patch: Partial<MethodDraft>) => {
    setMethods((current) => current.map((method, itemIndex) => itemIndex === index ? { ...method, ...patch } : method))
  }
  const patchBackground = (index: number, patch: Partial<BackgroundDraft>) => setBackgrounds((current) =>
    current.map((background, itemIndex) => itemIndex === index ? { ...background, ...patch } : background))
  const patchFeature = (index: number, patch: Partial<FeatureDraft>) => setFeatures((current) =>
    current.map((feature, itemIndex) => itemIndex === index ? { ...feature, ...patch } : feature))
  const patchFeat = (index: number, patch: Partial<FeatDraft>) => setFeats((current) =>
    current.map((feat, itemIndex) => itemIndex === index ? { ...feat, ...patch } : feat))
  const patchSpell = (index: number, patch: Partial<SpellDraft>) => setSpells((current) =>
    current.map((spell, itemIndex) => itemIndex === index ? { ...spell, ...patch } : spell))
  const patchCantripScalingStep = (spellIndex: number, stepIndex: number, patch: Partial<Dnd5eCantripScalingStep>) => {
    const spell = spells[spellIndex]
    if (!spell) return
    patchSpell(spellIndex, {
      cantripScalingSteps: spell.cantripScalingSteps.map((step, index) => index === stepIndex ? { ...step, ...patch } : step),
    })
  }
  const addCantripScalingStep = (spellIndex: number) => {
    const spell = spells[spellIndex]
    if (!spell) return
    const level = Array.from({ length: 19 }, (_, index) => index + 2)
      .find((candidate) => !spell.cantripScalingSteps.some((step) => step.level === candidate))
    if (!level) return
    patchSpell(spellIndex, {
      cantripScalingSteps: [...spell.cantripScalingSteps, { level, diceCount: 1 }]
        .sort((left, right) => left.level - right.level),
    })
  }
  const removeCantripScalingStep = (spellIndex: number, stepIndex: number) => {
    const spell = spells[spellIndex]
    if (!spell || spell.cantripScalingSteps.length <= 1) return
    patchSpell(spellIndex, {
      cantripScalingSteps: spell.cantripScalingSteps.filter((_, index) => index !== stepIndex),
    })
  }
  const uploadSpellIcon = async (index: number, file: File) => {
    try {
      const spell = spells[index]
      if (!spell) return
      const asset = await dnd5eSpellIconAssetFromFile(spell.id, file)
      setAssets((current) => upsertById(current, [asset]))
      patchSpell(index, { iconAssetId: asset.id })
      setLocalError(null)
      setLocalNotice(`已为“${spell.name || spell.id}”加入本地法术图标；图标会写入 V2 内容包。`)
    } catch (cause) {
      setLocalNotice(null)
      setLocalError(cause instanceof Error ? cause.message : String(cause))
    }
  }
  const removeSpellIcon = (index: number) => {
    const assetId = spells[index]?.iconAssetId
    patchSpell(index, { iconAssetId: undefined })
    if (assetId && !spells.some((spell, spellIndex) => spellIndex !== index && spell.iconAssetId === assetId)) {
      setAssets((current) => current.filter((asset) => asset.id !== assetId))
    }
  }
  const addSpell = () => {
    const index = spells.length
    setSpells((current) => [...current, newSpell(current.length + 1)])
    setExpandedSpellIndex(index)
  }
  const removeSpell = (index: number) => {
    const assetId = spells[index]?.iconAssetId
    setSpells((current) => current.filter((_, itemIndex) => itemIndex !== index))
    if (assetId && !spells.some((spell, spellIndex) => spellIndex !== index && spell.iconAssetId === assetId)) {
      setAssets((current) => current.filter((asset) => asset.id !== assetId))
    }
    setExpandedSpellIndex((current) => current == null
      ? null
      : current === index
        ? null
        : current > index
          ? current - 1
          : current)
  }
  const patchItem = (index: number, patch: Partial<ItemDraft>) => setItems((current) =>
    current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))

  return (
    <section data-testid="custom-rules-plugin-builder" className="glass mb-5 rounded-2xl border border-arcane-400/15 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">扩展工作室</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            用统一编辑器创建子职、装备、特性、法术、种族、背景、怪物与加点规则。新文件是纯 JSON，
            由 Host 编译为白名单 Headless 事务；不会执行导入包中的 JavaScript。
          </p>
        </div>
        {!alwaysExpanded && (
          <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
            {open ? '收起工作室' : '打开扩展工作室'}
          </button>
        )}
      </div>

      {(alwaysExpanded || open) && (
        <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
          <div className="grid gap-3 rounded-2xl border border-white/8 bg-black/10 p-4 md:grid-cols-[minmax(220px,1fr)_150px_minmax(180px,0.6fr)]">
            <BuilderInput label="插件名称" value={metadata.name} onChange={(name) => setMetadata((current) => ({ ...current, name }))} />
            <BuilderInput label="版本" value={metadata.version} onChange={(version) => setMetadata((current) => ({ ...current, version }))} />
            <BuilderSelect
              label="内容分类"
              value={metadata.contentCategory}
              options={PLUGIN_CONTENT_CATEGORIES}
              onChange={(contentCategory) => setMetadata((current) => ({
                ...current,
                contentCategory: contentCategory as Dnd5ePluginContentCategory,
              }))}
            />
          </div>

          <details className="group rounded-2xl border border-white/8 bg-black/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">
              <span>
                高级扩展信息
                <span className="ml-2 text-[11px] font-normal text-slate-600">ID、授权、分发、依赖与能力声明</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-3 border-t border-white/8 p-4 md:grid-cols-2 lg:grid-cols-3">
              <BuilderInput label="插件 ID" value={metadata.id} onChange={(id) => setMetadata((current) => ({ ...current, id }))} />
              <BuilderInput label="发布者" value={metadata.publisher} onChange={(publisher) => setMetadata((current) => ({ ...current, publisher }))} />
              <BuilderInput label="许可证" value={metadata.license} onChange={(license) => setMetadata((current) => ({ ...current, license }))} />
              <BuilderInput label="说明" value={metadata.description} onChange={(description) => setMetadata((current) => ({ ...current, description }))} />
              <BuilderNumber
                label="最低游戏协议版本"
                value={metadata.minimumGameProtocolVersion}
                min={1}
                max={10_000}
                onChange={(minimumGameProtocolVersion) => setMetadata((current) => ({
                  ...current,
                  minimumGameProtocolVersion,
                }))}
              />
              <BuilderSelect
                label="分发策略"
                value={metadata.distributionPolicy}
                options={PLUGIN_DISTRIBUTION_POLICIES}
                onChange={(distributionPolicy) => setMetadata((current) => ({
                  ...current,
                  distributionPolicy: distributionPolicy as Dnd5ePluginDistributionPolicy,
                }))}
              />
              <BuilderInput
                label="依赖（逗号分隔：插件ID 版本范围 [optional]）"
                value={metadata.dependencies}
                onChange={(dependencies) => setMetadata((current) => ({ ...current, dependencies }))}
              />
              <BuilderInput
                label="冲突插件 ID（逗号分隔）"
                value={metadata.conflicts}
                onChange={(conflicts) => setMetadata((current) => ({ ...current, conflicts }))}
              />
              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-slate-500">声明的 Headless 能力</legend>
                <div className="flex flex-wrap gap-1.5">
                  {PLUGIN_CAPABILITIES.map((capability) => {
                    const selected = metadata.declaredCapabilities.includes(capability)
                    return (
                      <button
                        key={capability}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setMetadata((current) => ({
                          ...current,
                          declaredCapabilities: selected
                            ? current.declaredCapabilities.filter((entry) => entry !== capability)
                            : [...current.declaredCapabilities, capability],
                        }))}
                        className={`rounded-lg border px-2 py-1 text-[10px] ${
                          selected
                            ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                            : 'border-white/8 text-slate-500'
                        }`}
                      >
                        {dnd5ePluginCapabilityLabel(capability)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>
          </details>

          {categoryControl === 'select' ? (
            <label className="block max-w-sm">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">内容类型</span>
              <select
                aria-label="规则内容分类"
                value={displayedSection}
                onChange={(event) => setActiveSection(event.target.value as BuilderSection)}
                className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
              >
                {BUILDER_SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>{section.label} · {sectionCounts[section.id]}</option>
                ))}
              </select>
            </label>
          ) : (
            <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-black/10 p-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="规则内容分类" role="tablist">
              {BUILDER_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={displayedSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${displayedSection === section.id ? 'border-arcane-400/45 bg-arcane-500/12 text-arcane-100 shadow-[0_0_24px_rgba(139,92,246,0.08)]' : 'border-white/8 bg-white/[0.025] text-slate-500 hover:border-white/15 hover:text-slate-200'}`}
                >
                  {section.label} · {sectionCounts[section.id]}
                </button>
              ))}
            </nav>
          )}

          {displayedSection === 'subclasses' && <Dnd5eDeclarativeSubclassEditor value={subclasses} onChange={setSubclasses} />}
          {displayedSection === 'classes' && <Dnd5eDeclarativeClassEditor value={classes} onChange={setClasses} />}

          {displayedSection === 'monsters' && (
            <>
              <Dnd5eMonsterWorkshopDialog
                key={effectiveMonsterWorkshopImport?.requestId ?? 'monster-workshop'}
                open={monsterWorkshopOpen || !!effectiveMonsterWorkshopImport}
                onClose={() => {
                  setMonsterWorkshopOpen(false)
                  setSelectedMonsterWorkshopEdit(null)
                  if (openSpellsAfterMonsterWorkshop) {
                    setOpenSpellsAfterMonsterWorkshop(false)
                    setActiveSection('spells')
                  }
                  if (importedMonsterWorkshopEdit) {
                    if (!openSpellsAfterMonsterWorkshop) setActiveSection('monsters')
                    onMonsterWorkshopImportClose?.()
                    onContentWorkshopImportClose?.()
                  }
                }}
                monsters={monsters}
                onMonstersChange={setMonsters}
                knownCustomSpells={spells.map((spell) => ({ id: spell.id, name: spell.name, level: spell.level }))}
                onCreateCustomSpellDraft={(request) => {
                  const inferredRange = inferDnd5eCustomSpellRangeFromText(request.sourceText)
                  const existingIndex = spells.findIndex((spell) => spell.id === request.id || spell.name === request.name)
                  if (existingIndex >= 0) {
                    setSpells((current) => current.map((spell, index) => index === existingIndex
                      ? { ...spell, ...inferredRange, id: request.id, name: request.name, level: request.level, description: request.sourceText }
                      : spell))
                    setExpandedSpellIndex(existingIndex)
                  } else {
                    const nextIndex = spells.length
                    setSpells((current) => [...current, {
                      ...newSpell(current.length + 1),
                      ...inferredRange,
                      id: request.id,
                      name: request.name,
                      level: request.level,
                      description: request.sourceText,
                    }])
                    setExpandedSpellIndex(nextIndex)
                  }
                  setOpenSpellsAfterMonsterWorkshop(true)
                }}
                context="plugin"
                editRequest={effectiveMonsterWorkshopImport}
                draftStorageScope={draftStorageScope}
              />
            </>
          )}

          {displayedSection === 'races' && <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-200">自定义种族</h3><p className="mt-1 text-xs text-slate-600">固定调整与“任选若干属性”可以同时使用。</p></div>
              <button type="button" onClick={() => setRaces((current) => [...current, newRace(current.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> 添加种族</button>
            </div>
            <div className="space-y-3">
              {races.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">尚未添加种族。</p>}
              {races.map((race, index) => (
                <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <BuilderInput label="种族 ID" value={race.id} onChange={(value) => patchRace(index, { id: value })} />
                    <BuilderInput label="显示名称" value={race.name} onChange={(value) => patchRace(index, { name: value })} />
                    <BuilderNumber label="速度（尺）" value={race.speedFeet} min={0} max={500} onChange={(value) => patchRace(index, { speedFeet: value })} />
                    <BuilderInput label="说明" value={race.description} onChange={(value) => patchRace(index, { description: value })} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {ABILITIES.map((ability) => (
                      <BuilderNumber key={ability.key} label={`${ability.label}固定调整`} value={race.abilityBonuses[ability.key]} min={-10} max={10} onChange={(value) => patchRace(index, { abilityBonuses: { ...race.abilityBonuses, [ability.key]: value } })} />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[140px_140px_1fr_auto] md:items-end">
                    <BuilderNumber label="可选属性数量" value={race.flexibleCount} min={0} max={6} onChange={(value) => patchRace(index, { flexibleCount: value })} />
                    <BuilderNumber label="每项调整" value={race.flexibleAmount} min={-10} max={10} onChange={(value) => patchRace(index, { flexibleAmount: value })} />
                    <fieldset><legend className="mb-1.5 text-xs font-semibold text-slate-500">不可选择的属性</legend><div className="flex flex-wrap gap-1.5">{ABILITIES.map((ability) => <button key={ability.key} type="button" aria-pressed={race.flexibleExclude.includes(ability.key)} onClick={() => patchRace(index, { flexibleExclude: race.flexibleExclude.includes(ability.key) ? race.flexibleExclude.filter((key) => key !== ability.key) : [...race.flexibleExclude, ability.key] })} className={`rounded-lg border px-2 py-1 text-xs ${race.flexibleExclude.includes(ability.key) ? 'border-amber-400/35 bg-amber-500/10 text-amber-100' : 'border-white/8 text-slate-500'}`}>{ability.label}</button>)}</div></fieldset>
                    <button type="button" aria-label={`删除种族 ${race.name}`} onClick={() => setRaces((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>}

          {displayedSection === 'backgrounds' && <div>
            <SectionHeader
              title="自定义背景"
              description="背景技能会自动进入角色与 Headless 熟练项；工具、语言和背景特性作为结构化资料保存。"
              actionLabel="添加背景"
              onAdd={() => setBackgrounds((current) => [...current, newBackground(current.length + 1)])}
            />
            <div className="space-y-3">
              {backgrounds.length === 0 && <EmptyState>尚未添加背景。</EmptyState>}
              {backgrounds.map((background, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <BuilderInput label="背景 ID" value={background.id} onChange={(value) => patchBackground(index, { id: value })} />
                  <BuilderInput label="显示名称" value={background.name} onChange={(value) => patchBackground(index, { name: value })} />
                  <BuilderNumber label="额外语言数量" value={background.languages} min={0} max={8} onChange={(value) => patchBackground(index, { languages: value })} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <BuilderTextarea label="背景说明" value={background.description} onChange={(value) => patchBackground(index, { description: value })} />
                  <BuilderInput label="工具熟练（逗号分隔）" value={background.toolProficiencies} onChange={(value) => patchBackground(index, { toolProficiencies: value })} />
                </div>
                <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold text-slate-500">技能熟练（最多 2 项）</legend><div className="flex flex-wrap gap-1.5">
                  {SKILLS.map((skill) => {
                    const selected = background.skillProficiencies.includes(skill.key)
                    return <button key={skill.key} type="button" aria-pressed={selected} onClick={() => patchBackground(index, {
                      skillProficiencies: selected
                        ? background.skillProficiencies.filter((key) => key !== skill.key)
                        : background.skillProficiencies.length < 2 ? [...background.skillProficiencies, skill.key] : background.skillProficiencies,
                    })} className={`rounded-lg border px-2 py-1 text-xs ${selected ? 'border-amber-400/35 bg-amber-500/10 text-amber-100' : 'border-white/8 text-slate-500'}`}>{skill.label}</button>
                  })}
                </div></fieldset>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(180px,0.5fr)_1fr_auto] md:items-end">
                  <BuilderInput label="背景特性名称" value={background.featureName} onChange={(value) => patchBackground(index, { featureName: value })} />
                  <BuilderTextarea label="背景特性说明" value={background.featureDescription} onChange={(value) => patchBackground(index, { featureDescription: value })} />
                  <DeleteButton label={`删除背景 ${background.name}`} onClick={() => setBackgrounds((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              </article>)}
            </div>
          </div>}

          {displayedSection === 'feats' && <div>
            <SectionHeader
              title="独立专长编辑器"
              description="专长拥有独立的等级、属性与种族前提；角色选择和 Headless 执行都会由 Host 重新验证。"
              actionLabel="添加专长"
              onAdd={() => setFeats((current) => [...current, newFeat(current.length + 1)])}
            />
            <div className="space-y-3">
              {feats.length === 0 && <EmptyState>尚未添加专长。</EmptyState>}
              {feats.map((feat, index) => <article key={index} className="rounded-2xl border border-amber-400/12 bg-amber-500/[0.025] p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <BuilderInput label="专长 ID" value={feat.id} onChange={(value) => patchFeat(index, { id: value })} />
                  <BuilderInput label="显示名称" value={feat.name} onChange={(value) => patchFeat(index, { name: value })} />
                  <BuilderNumber label="最低角色等级" value={feat.minimumLevel} min={1} max={20} onChange={(minimumLevel) => patchFeat(index, { minimumLevel })} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <BuilderInput label="摘要" value={feat.summary} onChange={(summary) => patchFeat(index, { summary })} />
                  <BuilderInput label="限定种族 ID／名称（逗号分隔，可选）" value={feat.prerequisiteRaceIds} onChange={(prerequisiteRaceIds) => patchFeat(index, { prerequisiteRaceIds })} />
                </div>
                <div className="mt-3"><BuilderTextarea label="规则正文" value={feat.description} onChange={(description) => patchFeat(index, { description })} /></div>
                <fieldset className="mt-3 rounded-xl border border-white/8 p-3">
                  <legend className="px-1 text-xs font-semibold text-slate-500">属性前提（0 表示无前提）</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {ABILITIES.map((ability) => (
                      <BuilderNumber
                        key={ability.key}
                        label={ability.label}
                        value={feat.prerequisiteAbilities[ability.key]}
                        min={0}
                        max={30}
                        onChange={(value) => patchFeat(index, {
                          prerequisiteAbilities: { ...feat.prerequisiteAbilities, [ability.key]: value },
                        })}
                      />
                    ))}
                  </div>
                </fieldset>
                <div className="mt-3">
                  <Toggle label="可改变敌方 d20 结果" value={feat.canModifyEnemyD20} onChange={(canModifyEnemyD20) => patchFeat(index, { canModifyEnemyD20 })} />
                </div>
                <HeadlessEffectEditor title="专长 Headless 效果" value={feat.headless} onChange={(headless) => patchFeat(index, { headless })} />
                <div className="mt-3 flex justify-end"><DeleteButton label={`删除专长 ${feat.name}`} onClick={() => setFeats((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>
              </article>)}
            </div>
          </div>}

          {displayedSection === 'features' && <div>
            <SectionHeader
              title="自定义特性"
              description="可保持 DM 裁定，也可用声明式效果编辑器生成受控 Headless Action；所有目标、骰子和结果仍由 DM 权威 Host 复核。"
              actionLabel="添加特性"
              onAdd={() => setFeatures((current) => [...current, newFeature(current.length + 1)])}
            />
            <div className="space-y-3">
              {features.length === 0 && <EmptyState>尚未添加特性。</EmptyState>}
              {features.map((feature, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <BuilderInput label="特性 ID" value={feature.id} onChange={(value) => patchFeature(index, { id: value })} />
                  <BuilderInput label="显示名称" value={feature.name} onChange={(value) => patchFeature(index, { name: value })} />
                  <BuilderNumber label="最低等级" value={feature.minimumLevel} min={1} max={20} onChange={(value) => patchFeature(index, { minimumLevel: value })} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[0.65fr_1.35fr_auto] md:items-end">
                  <BuilderInput label="摘要" value={feature.summary} onChange={(value) => patchFeature(index, { summary: value })} />
                  <BuilderTextarea label="规则正文" value={feature.description} onChange={(value) => patchFeature(index, { description: value })} />
                  <DeleteButton label={`删除特性 ${feature.name}`} onClick={() => setFeatures((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
                <div className="mt-3">
                  <Toggle
                    label="可改变敌方 d20 结果"
                    value={feature.canModifyEnemyD20}
                    onChange={(canModifyEnemyD20) => patchFeature(index, { canModifyEnemyD20 })}
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    仅在敌方 d20 已成功时开放玩家声明窗口；最终替换值仍须由 DM 确认。
                  </p>
                </div>
                <HeadlessEffectEditor
                  value={feature.headless}
                  onChange={(headless) => patchFeature(index, { headless })}
                />
              </article>)}
            </div>
          </div>}

          {displayedSection === 'spells' && <div>
            <SectionHeader
              title="法术工坊"
              description="在同一列表中创建、查看和编辑当前扩展的全部法术；每个条目会直接显示资料完整度与 Headless 接入状态。"
              actionLabel="添加法术"
              onAdd={addSpell}
            />
            <div className="space-y-3">
              {spells.length === 0 && <EmptyState>尚未添加法术。</EmptyState>}
              {spells.map((spell, index) => {
                const expanded = expandedSpellIndex === index
                const levelLabel = spell.level === 0 ? '戏法' : `${spell.level} 环`
                const schoolLabel = SPELL_SCHOOLS.find(([id]) => id === spell.school)?.[1] ?? spell.school
                const rangeSummary = dnd5eCustomSpellRangeSummary(spell)
                const headlessStatus = dnd5eSpellWorkshopHeadlessStatus(spell.headless)
                const headlessLabel = headlessStatus === 'full'
                  ? '完整 Headless'
                  : headlessStatus === 'partial'
                    ? '待补充 Headless'
                    : '仅资料'
                const iconAsset = assets.find((asset) => asset.id === spell.iconAssetId)
                const iconUrl = dnd5eSpellIconAssetDataUrl(iconAsset)
                return <article key={index} className={`overflow-hidden rounded-2xl border bg-black/15 ${expanded ? 'border-violet-400/20' : 'border-white/8'}`}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`custom-spell-editor-${index}`}
                  onClick={() => setExpandedSpellIndex(expanded ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/[0.025]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-100">{spell.name || '未命名法术'}</span>
                    <span className="mt-1 block truncate text-[11px] text-slate-500">{levelLabel} · {schoolLabel} · {rangeSummary} · {headlessLabel}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                    {expanded ? '收起' : '编辑'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {expanded && <div id={`custom-spell-editor-${index}`} className="border-t border-white/8 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <BuilderInput label="法术 ID" value={spell.id} onChange={(value) => patchSpell(index, { id: value })} />
                  <BuilderInput label="中文名称" value={spell.name} onChange={(value) => patchSpell(index, { name: value })} />
                  <BuilderInput label="英文名称（可选）" value={spell.englishName} onChange={(value) => patchSpell(index, { englishName: value })} />
                  <BuilderNumber label="环级" value={spell.level} min={0} max={9} onChange={(value) => patchSpell(index, { level: value, upcastFromSlotLevel: Math.max(1, value) })} />
                </div>
                <section className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-black/10 p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-void-950 text-[10px] text-slate-600">
                    {iconUrl ? <img src={iconUrl} alt={`${spell.name || '法术'}图标预览`} className="h-full w-full object-cover" /> : '无图标'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200">法术图标</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">PNG、JPG 或 WebP，最大 384 KiB；保存后会随 V2 内容包进入法术书和战斗快捷栏。</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25">
                      <Upload className="h-3.5 w-3.5" />{iconUrl ? '更换图标' : '上传图标'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        aria-label={`上传法术图标 ${spell.name || spell.id}`}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          event.currentTarget.value = ''
                          if (file) void uploadSpellIcon(index, file)
                        }}
                      />
                    </label>
                    {iconUrl && <button type="button" onClick={() => removeSpellIcon(index)} className="rounded-xl border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-200">移除图标</button>}
                  </div>
                </section>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <BuilderSelect label="学派" value={spell.school} options={SPELL_SCHOOLS} onChange={(value) => patchSpell(index, { school: value as SpellDraft['school'] })} />
                  <BuilderSelect label="施法时间" value={spell.castingTimeUnit} options={CASTING_UNITS} onChange={(value) => patchSpell(index, { castingTimeUnit: value as SpellDraft['castingTimeUnit'] })} />
                  <BuilderNumber label="施法时间数值" value={spell.castingTimeValue} min={1} max={1000} onChange={(value) => patchSpell(index, { castingTimeValue: value })} />
                </div>
                {spell.castingTimeUnit === 'reaction' && <div className="mt-3"><BuilderInput label="反应触发条件" value={spell.reactionTrigger} onChange={(value) => patchSpell(index, { reactionTrigger: value })} /></div>}
                <section className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.025] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h4 className="text-xs font-semibold text-cyan-100">射程、范围与目标</h4><p className="mt-1 text-[11px] leading-5 text-slate-500">这里是法术范围的唯一来源；启用自动结算后会同步生成对应 Headless 目标模板。</p></div>
                    <span className="rounded-lg border border-cyan-300/15 px-2 py-1 text-[10px] text-cyan-100/70">{rangeSummary}</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <BuilderSelect label="射程类型" value={spell.rangeType} options={RANGE_TYPES} onChange={(value) => patchSpell(index, { rangeType: value as SpellDraft['rangeType'] })} />
                    {spell.rangeType === 'distance' && <BuilderNumber label="施法距离（尺）" value={spell.rangeFeet} min={1} max={10000} onChange={(value) => patchSpell(index, { rangeFeet: value })} />}
                    <BuilderSelect label="范围形状" value={spell.rangeShape} options={RANGE_SHAPES} onChange={(rangeShape) => patchSpell(index, { rangeShape: rangeShape as Dnd5eCustomSpellRangeShape })} />
                    {spell.rangeShape !== 'none' && spell.rangeShape !== 'rect' && <BuilderNumber label="范围尺寸（尺）" value={spell.rangeSizeFeet} min={1} max={10000} onChange={(rangeSizeFeet) => patchSpell(index, { rangeSizeFeet })} />}
                    {spell.rangeShape === 'rect' && <><BuilderNumber label="长方形长度（尺）" value={spell.rangeWidthFeet} min={1} max={10000} onChange={(rangeWidthFeet) => patchSpell(index, { rangeWidthFeet })} /><BuilderNumber label="长方形宽度（尺）" value={spell.rangeHeightFeet} min={1} max={10000} onChange={(rangeHeightFeet) => patchSpell(index, { rangeHeightFeet })} /></>}
                  </div>
                  {spell.rangeShape === 'rect' && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-cyan-300/10 bg-black/10 px-3 py-2">
                    <Toggle label="远程放置后可自由旋转" value={spell.rangeType !== 'self' && spell.rangeRotatable} onChange={(rangeRotatable) => patchSpell(index, { rangeRotatable })} />
                    <span className="text-[11px] leading-5 text-slate-500">类似火墙术：先在射程内选择中心，再用角度控制条或 Q/E 调整朝向。自身起源的长方形固定朝向。</span>
                  </div>}
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-44"><BuilderSelect label="影响目标" value={spell.headless.relation} options={TARGET_RELATIONS} onChange={(relation) => patchSpell(index, { headless: { ...spell.headless, relation: relation as HeadlessEffectEditorDraft['relation'] } })} /></div>
                    {spell.rangeShape !== 'none' && <div className="w-36"><BuilderNumber label="最多目标" value={spell.headless.maximumTargets} min={1} max={256} onChange={(maximumTargets) => patchSpell(index, { headless: { ...spell.headless, maximumTargets } })} /></div>}
                    <div className="pb-0.5"><Toggle label="可以影响施法者" value={spell.headless.includeSelf} onChange={(includeSelf) => patchSpell(index, { headless: { ...spell.headless, includeSelf } })} /></div>
                  </div>
                </section>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <BuilderSelect label="持续时间" value={spell.durationType} options={DURATION_TYPES} onChange={(value) => patchSpell(index, { durationType: value as SpellDraft['durationType'] })} />
                  {spell.durationType === 'timed' && <><BuilderNumber label="持续数值" value={spell.durationValue} min={1} max={10000} onChange={(value) => patchSpell(index, { durationValue: value })} /><BuilderSelect label="持续单位" value={spell.durationUnit} options={DURATION_UNITS} onChange={(value) => patchSpell(index, { durationUnit: value as SpellDraft['durationUnit'] })} /></>}
                </div>
                <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold text-slate-500">成分与标记</legend><div className="flex flex-wrap gap-2">
                  <Toggle label="言语 V" value={spell.verbal} onChange={(value) => patchSpell(index, { verbal: value })} />
                  <Toggle label="姿势 S" value={spell.somatic} onChange={(value) => patchSpell(index, { somatic: value })} />
                  <Toggle label="材料 M" value={spell.material} onChange={(value) => patchSpell(index, { material: value })} />
                  <Toggle label="仪式" value={spell.ritual} onChange={(value) => patchSpell(index, { ritual: value })} />
                  <Toggle label="专注" value={spell.concentration} onChange={(value) => patchSpell(index, { concentration: value })} />
                </div></fieldset>
                {spell.material && <div className="mt-3"><BuilderInput label="材料说明" value={spell.materialText} onChange={(value) => patchSpell(index, { materialText: value })} /></div>}
                <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold text-slate-500">职业（至少 1 项）</legend><div className="flex flex-wrap gap-1.5">
                  {SPELL_CLASSES.map(([id, label]) => <Toggle key={id} label={label} value={spell.classes.includes(id)} onChange={(selected) => patchSpell(index, { classes: selected ? [...spell.classes, id] : spell.classes.filter((value) => value !== id) })} />)}
                </div></fieldset>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <BuilderTextarea label="规则正文" value={spell.description} onChange={(value) => patchSpell(index, { description: value })} />
                  <BuilderTextarea label="升环说明（可选）" value={spell.higherLevels} onChange={(value) => patchSpell(index, { higherLevels: value })} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <BuilderSelect label="结算方式" value={spell.resolution} options={[["spell-attack", "法术攻击"], ["saving-throw", "目标豁免"], ["automatic", "自动生效"]]} onChange={(resolution) => patchSpell(index, { resolution: resolution as SpellDraft['resolution'] })} />
                  {spell.resolution === 'saving-throw' && <><BuilderSelect label="豁免属性" value={spell.saveAbility} options={ABILITIES.map((ability) => [ability.key, ability.label] as const)} onChange={(saveAbility) => patchSpell(index, { saveAbility: saveAbility as AbilityKey })} /><BuilderSelect label="豁免成功" value={spell.saveOnSuccess} options={[["none", "无伤害"], ["half", "伤害减半"], ["full", "仍受全额"]]} onChange={(saveOnSuccess) => patchSpell(index, { saveOnSuccess: saveOnSuccess as SpellDraft['saveOnSuccess'] })} /></>}
                </div>
                <details className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.025] px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-violet-100">
                    等级缩放通用模板 · {spell.level === 0 ? '戏法角色等级成长' : '升环效果'}
                  </summary>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                    缩放直接作用于下方“法术效果编辑器”的主要伤害组件；增加伤害骰会沿用基础骰面。Host 使用同一配方生成预览、Activity 与最终结算。
                  </p>
                  {!spell.headless.damageEnabled && <p className="mt-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] px-3 py-2 text-[11px] text-amber-100">
                    当前尚未启用主要伤害组件；伤害骰和固定伤害缩放会保留，但只有启用伤害后才能执行。
                  </p>}
                  {spell.level === 0 ? <div className="mt-3 space-y-3">
                    <Toggle
                      label="启用角色等级缩放"
                      value={spell.cantripScaling}
                      onChange={(cantripScaling) => patchSpell(index, {
                        cantripScaling,
                        ...((cantripScaling && spell.cantripScalingSteps.length === 0)
                          ? { cantripScalingSteps: DEFAULT_CANTRIP_SCALING_STEPS.map((step) => ({ ...step })) }
                          : {}),
                      })}
                    />
                    {spell.cantripScaling && <>
                      <div className="overflow-x-auto rounded-xl border border-white/8">
                        <div className="min-w-[620px] divide-y divide-white/8">
                          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 bg-black/15 px-3 py-2 text-[10px] font-semibold text-slate-500">
                            <span>角色等级阈值</span><span>额外伤害骰数量</span><span>额外固定伤害</span><span className="w-8" />
                          </div>
                          {spell.cantripScalingSteps.map((step, stepIndex) => <div key={`${step.level}:${stepIndex}`} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 px-3 py-2">
                            <BuilderNumber label="等级" value={step.level} min={2} max={20} onChange={(level) => patchCantripScalingStep(index, stepIndex, { level })} />
                            <BuilderNumber label={`额外 d${spell.headless.damageSides || 6}`} value={step.diceCount} min={0} max={100} onChange={(diceCount) => patchCantripScalingStep(index, stepIndex, { diceCount })} />
                            <BuilderNumber label="固定伤害" value={step.flatDamage ?? 0} min={0} max={1000000} onChange={(flatDamage) => patchCantripScalingStep(index, stepIndex, { flatDamage })} />
                            <button type="button" disabled={spell.cantripScalingSteps.length <= 1} onClick={() => removeCantripScalingStep(index, stepIndex)} aria-label={`删除 ${step.level} 级缩放`} className="mb-0.5 rounded-lg p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">默认 5／11／17 级各增加 1 颗基础伤害骰；也可以设置不同阈值或固定伤害。</p>
                        <button type="button" disabled={spell.cantripScalingSteps.length >= 19} onClick={() => addCantripScalingStep(index)} className="inline-flex items-center gap-1 rounded-lg border border-violet-300/15 px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 disabled:opacity-40"><Plus className="h-3.5 w-3.5" />添加等级阈值</button>
                      </div>
                    </>}
                  </div> : <div className="mt-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <BuilderNumber label="缩放起算环位" value={spell.upcastFromSlotLevel} min={spell.level} max={9} onChange={(upcastFromSlotLevel) => patchSpell(index, { upcastFromSlotLevel })} />
                      <BuilderNumber label={`每高一环增加 d${spell.headless.damageSides || 6}`} value={spell.upcastDamageDicePerLevel} min={0} max={100} onChange={(upcastDamageDicePerLevel) => patchSpell(index, { upcastDamageDicePerLevel })} />
                      <BuilderNumber label="每高一环增加固定伤害" value={spell.upcastFlatDamagePerLevel} min={0} max={1000000} onChange={(upcastFlatDamagePerLevel) => patchSpell(index, { upcastFlatDamagePerLevel })} />
                      <BuilderNumber label="每高一环增加目标" value={spell.upcastAdditionalTargetsPerLevel} min={0} max={100} onChange={(upcastAdditionalTargetsPerLevel) => patchSpell(index, { upcastAdditionalTargetsPerLevel })} />
                      <BuilderNumber label="每高一环增加投射物" value={spell.upcastAdditionalProjectilesPerLevel} min={0} max={100} onChange={(upcastAdditionalProjectilesPerLevel) => patchSpell(index, { upcastAdditionalProjectilesPerLevel })} />
                      <BuilderNumber label="每高一环增加持续轮数" value={spell.upcastDurationRoundsPerLevel} min={0} max={10000} onChange={(upcastDurationRoundsPerLevel) => patchSpell(index, { upcastDurationRoundsPerLevel })} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">额外目标不可重复；额外投射物允许多个投射物指向同一目标。所有为 0 时不生成升环配方。</p>
                  </div>}
                </details>
                <div className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${headlessStatus === 'full' ? 'border-emerald-400/20 bg-emerald-500/[0.055] text-emerald-100' : headlessStatus === 'partial' ? 'border-amber-400/20 bg-amber-500/[0.055] text-amber-100' : 'border-white/8 bg-black/10 text-slate-400'}`}>
                  {headlessStatus === 'full'
                    ? <>Headless 已接入：Host 将执行{spell.resolution === 'saving-throw' ? `${spell.saveAbility.toUpperCase()} 豁免、` : spell.resolution === 'spell-attack' ? '法术攻击、' : ''}{spell.headless.damageEnabled ? `${spell.headless.damageCount}d${spell.headless.damageSides} ${spell.headless.damageType}伤害` : '标准状态'}{spell.level === 0 && spell.headless.damageEnabled ? (spell.cantripScaling ? `，并应用 ${spell.cantripScalingSteps.length} 个角色等级缩放阈值` : '；当前没有角色等级缩放') : ''}。</>
                    : headlessStatus === 'partial'
                      ? 'Headless 尚未完成：自动结算开关已开启，但没有伤害或标准状态配方。保存时会安全回落为“仅资料”，不会错误执行。'
                      : '当前仅接入法术资料；启用法术效果编辑器并配置至少一种效果后，才会生成 Host 可执行事务。'}
                </div>
                <HeadlessEffectEditor title="法术效果编辑器" mode="spell" value={spellHeadlessEffectDraft(spell)} onChange={(headless) => patchSpell(index, { headless })} />
                <div className="mt-3 flex justify-end"><DeleteButton label={`删除法术 ${spell.name}`} onClick={() => removeSpell(index)} /></div>
                </div>}
              </article>
              })}
            </div>
          </div>}

          {displayedSection === 'items' && <div>
            <SectionHeader
              title="自定义装备与物品"
              description="支持武器、护甲、盾牌、饰品和治疗消耗品；固定效果由 Host 写入 Headless。"
              actionLabel="添加物品"
              onAdd={() => setItems((current) => [...current, newItem(current.length + 1)])}
            />
            <div className="space-y-3">
              {items.length === 0 && <EmptyState>尚未添加装备或物品。</EmptyState>}
              {items.map((item, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <BuilderInput label="物品 ID" value={item.id} onChange={(value) => patchItem(index, { id: value })} />
                  <BuilderInput label="显示名称" value={item.name} onChange={(value) => patchItem(index, { name: value })} />
                  <BuilderSelect label="物品类型" value={item.kind} options={ITEM_KINDS} onChange={(value) => patchItem(index, { kind: value as ItemDraft['kind'] })} />
                  {item.kind !== 'armor' && item.kind !== 'shield' && item.kind !== 'consumable' && <BuilderSelect label="装备槽位" value={item.slot} options={EQUIPMENT_SLOTS} onChange={(value) => patchItem(index, { slot: value as ItemDraft['slot'] })} />}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2"><BuilderTextarea label="物品说明" value={item.description} onChange={(value) => patchItem(index, { description: value })} /><BuilderTextarea label="规则正文" value={item.rulesText} onChange={(value) => patchItem(index, { rulesText: value })} /></div>
                {item.kind === 'weapon' && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <BuilderSelect label="武器类别" value={item.weaponCategory} options={WEAPON_CATEGORIES} onChange={(value) => patchItem(index, { weaponCategory: value as ItemDraft['weaponCategory'] })} />
                  <BuilderSelect label="攻击模式" value={item.weaponMode} options={WEAPON_MODES} onChange={(value) => patchItem(index, { weaponMode: value as ItemDraft['weaponMode'] })} />
                  <BuilderSelect label="攻击属性" value={item.attackAbility} options={ATTACK_ABILITIES} onChange={(value) => patchItem(index, { attackAbility: value as ItemDraft['attackAbility'] })} />
                  <BuilderSelect label="伤害类型" value={item.damageType} options={WEAPON_DAMAGE_TYPES} onChange={(value) => patchItem(index, { damageType: value as ItemDraft['damageType'] })} />
                  <BuilderNumber label="伤害骰数量" value={item.damageCount} min={0} max={20} onChange={(value) => patchItem(index, { damageCount: value })} />
                  <BuilderNumber label="伤害骰面数" value={item.damageSides} min={2} max={1000} onChange={(value) => patchItem(index, { damageSides: value })} />
                  {item.weaponMode === 'melee' ? <BuilderNumber label="触及（尺）" value={item.reachFeet} min={0} max={500} onChange={(value) => patchItem(index, { reachFeet: value })} /> : <><BuilderNumber label="普通射程" value={item.rangeNormal} min={0} max={10000} onChange={(value) => patchItem(index, { rangeNormal: value })} /><BuilderNumber label="最大射程" value={item.rangeLong} min={0} max={10000} onChange={(value) => patchItem(index, { rangeLong: value })} /></>}
                </div>}
                {item.kind === 'armor' && <div className="mt-3 grid gap-3 sm:grid-cols-3"><BuilderSelect label="护甲类别" value={item.armorCategory} options={ARMOR_CATEGORIES} onChange={(value) => patchItem(index, { armorCategory: value as ItemDraft['armorCategory'] })} /><BuilderNumber label="基础 AC" value={item.baseArmorClass} min={0} max={50} onChange={(value) => patchItem(index, { baseArmorClass: value })} /><BuilderSelect label="敏捷调整" value={item.dexterityBonus} options={DEXTERITY_BONUSES} onChange={(value) => patchItem(index, { dexterityBonus: value as ItemDraft['dexterityBonus'] })} /></div>}
                {item.kind === 'shield' && <div className="mt-3 max-w-48"><BuilderNumber label="盾牌 AC 加值" value={item.shieldBonus} min={-20} max={20} onChange={(value) => patchItem(index, { shieldBonus: value })} /></div>}
                {item.kind === 'consumable' && !item.spellSlotRecoveryEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-3"><BuilderNumber label="治疗骰数量" value={item.healingCount} min={1} max={40} onChange={(value) => patchItem(index, { healingCount: value })} /><BuilderNumber label="治疗骰面数" value={item.healingSides} min={2} max={100} onChange={(value) => patchItem(index, { healingSides: value })} /><BuilderNumber label="固定治疗" value={item.healingBonus} min={-1000} max={1000} onChange={(value) => patchItem(index, { healingBonus: value })} /></div>}
                {item.kind !== 'consumable' && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5"><BuilderNumber label="武器命中" value={item.weaponAttackBonus} min={-20} max={20} onChange={(value) => patchItem(index, { weaponAttackBonus: value })} /><BuilderNumber label="武器伤害" value={item.weaponDamageBonus} min={-20} max={20} onChange={(value) => patchItem(index, { weaponDamageBonus: value })} /><BuilderNumber label="AC" value={item.armorClassBonus} min={-20} max={20} onChange={(value) => patchItem(index, { armorClassBonus: value })} /><BuilderNumber label="全部豁免" value={item.savingThrowBonus} min={-20} max={20} onChange={(value) => patchItem(index, { savingThrowBonus: value })} /><BuilderNumber label="速度（尺）" value={item.speedBonusFeet} min={-500} max={500} onChange={(value) => patchItem(index, { speedBonusFeet: value })} /></div>}
                <section className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-100">装备 Headless 效果编辑器</h4>
                    <p className="mt-1 text-xs text-slate-500">工坊与 Host 使用同一份 V1 声明：目标、骰子、伤害、资源和法术位都会在权威事务中重新校验。</p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {item.kind === 'weapon' && <Toggle label="攻击骰后重掷 1 枚 d20" value={item.attackRerollEnabled} onChange={(attackRerollEnabled) => patchItem(index, { attackRerollEnabled })} />}
                    {item.kind !== 'consumable' && <Toggle label="命中后造成额外伤害" value={item.onHitBonusDamageEnabled} onChange={(onHitBonusDamageEnabled) => patchItem(index, { onHitBonusDamageEnabled })} />}
                    {item.kind !== 'consumable' && <Toggle label="受到伤害时减伤" value={item.damageReductionEnabled} onChange={(damageReductionEnabled) => patchItem(index, { damageReductionEnabled })} />}
                    {item.kind !== 'consumable' && <Toggle label="降至 0 HP 时保命" value={item.deathPreventionEnabled} onChange={(deathPreventionEnabled) => patchItem(index, { deathPreventionEnabled })} />}
                    <Toggle label="恢复已消耗法术位" value={item.spellSlotRecoveryEnabled} onChange={(spellSlotRecoveryEnabled) => patchItem(index, { spellSlotRecoveryEnabled })} />
                    <Toggle label="上述效果消耗共享充能" value={item.headlessEffectsUseCharges || item.attackRerollEnabled} onChange={(headlessEffectsUseCharges) => patchItem(index, { headlessEffectsUseCharges })} />
                  </div>
                  {(item.attackRerollEnabled || item.headlessEffectsUseCharges) && <div className="mt-3 grid gap-3 sm:grid-cols-2"><BuilderNumber label="最大充能" value={item.attackRerollCharges} min={1} max={1000000} onChange={(attackRerollCharges) => patchItem(index, { attackRerollCharges })} /><BuilderSelect label="充能恢复时点" value={item.attackRerollResetOn} options={[["none", "不自动恢复"], ["short-rest", "短休"], ["long-rest", "长休"], ["dawn", "黎明（由战役日历推进）"]]} onChange={(attackRerollResetOn) => patchItem(index, { attackRerollResetOn: attackRerollResetOn as ItemDraft['attackRerollResetOn'] })} /></div>}
                  {item.onHitBonusDamageEnabled && <div className="mt-3 grid gap-3 rounded-xl border border-white/8 bg-black/15 p-3 sm:grid-cols-3 xl:grid-cols-6"><BuilderNumber label="额外伤害骰数量" value={item.onHitBonusDamageCount} min={1} max={40} onChange={(onHitBonusDamageCount) => patchItem(index, { onHitBonusDamageCount })} /><BuilderNumber label="骰子面数" value={item.onHitBonusDamageSides} min={2} max={100} onChange={(onHitBonusDamageSides) => patchItem(index, { onHitBonusDamageSides })} /><BuilderNumber label="固定加值" value={item.onHitBonusDamageBonus} min={-1000} max={1000} onChange={(onHitBonusDamageBonus) => patchItem(index, { onHitBonusDamageBonus })} /><BuilderSelect label="伤害类型" value={item.onHitBonusDamageType} options={[["inherit", "继承原伤害类型"], ...HEADLESS_DAMAGE_TYPES]} onChange={(onHitBonusDamageType) => patchItem(index, { onHitBonusDamageType: onHitBonusDamageType as ItemDraft['onHitBonusDamageType'] })} /><Toggle label="每回合一次" value={item.onHitBonusDamageOncePerTurn} onChange={(onHitBonusDamageOncePerTurn) => patchItem(index, { onHitBonusDamageOncePerTurn })} /></div>}
                  {item.damageReductionEnabled && <div className="mt-3 grid gap-3 rounded-xl border border-white/8 bg-black/15 p-3 sm:grid-cols-2"><BuilderNumber label="每次减伤" value={item.damageReductionAmount} min={1} max={1000000} onChange={(damageReductionAmount) => patchItem(index, { damageReductionAmount })} /><Toggle label="每回合一次" value={item.damageReductionOncePerTurn} onChange={(damageReductionOncePerTurn) => patchItem(index, { damageReductionOncePerTurn })} /></div>}
                  {item.deathPreventionEnabled && <div className="mt-3 grid gap-3 rounded-xl border border-white/8 bg-black/15 p-3 sm:grid-cols-2"><BuilderNumber label="保命后 HP" value={item.deathPreventionHitPoints} min={1} max={1000000} onChange={(deathPreventionHitPoints) => patchItem(index, { deathPreventionHitPoints })} /><Toggle label="允许阻止巨量伤害即死" value={item.deathPreventionMassiveDamage} onChange={(deathPreventionMassiveDamage) => patchItem(index, { deathPreventionMassiveDamage })} /></div>}
                  {item.spellSlotRecoveryEnabled && <div className="mt-3 grid gap-3 rounded-xl border border-white/8 bg-black/15 p-3 sm:grid-cols-3"><BuilderNumber label="最高可恢复环级" value={item.spellSlotRecoveryMaximumLevel} min={1} max={9} onChange={(spellSlotRecoveryMaximumLevel) => patchItem(index, { spellSlotRecoveryMaximumLevel })} /><BuilderNumber label="恢复法术位数量" value={item.spellSlotRecoveryAmount} min={1} max={9} onChange={(spellSlotRecoveryAmount) => patchItem(index, { spellSlotRecoveryAmount })} /><BuilderSelect label="使用行动经济" value={item.spellSlotRecoveryEconomy} options={[["action", "动作"], ["bonusAction", "附赠动作"], ["none", "不消耗行动"]]} onChange={(spellSlotRecoveryEconomy) => patchItem(index, { spellSlotRecoveryEconomy: spellSlotRecoveryEconomy as ItemDraft['spellSlotRecoveryEconomy'] })} /></div>}
                  {(item.attackRerollEnabled || item.onHitBonusDamageEnabled || item.damageReductionEnabled || item.deathPreventionEnabled || item.spellSlotRecoveryEnabled) && <p className="mt-3 text-xs text-emerald-300">兼容报告：所选效果可由 Host 完整 Headless 结算；插件不能执行 JavaScript，也不能直接修改角色或战斗 Store。</p>}
                </section>
                <div className="mt-3 flex justify-end"><DeleteButton label={`删除物品 ${item.name}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>
              </article>)}
            </div>
          </div>}

          {displayedSection === 'methods' && <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-200">属性生成／加点规则</h3><p className="mt-1 text-xs text-slate-600">支持标准数组、购点成本表和自定义投骰。</p></div>
              <button type="button" onClick={() => setMethods((current) => [...current, newMethod(current.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> 添加加点规则</button>
            </div>
            <div className="space-y-3">
              {methods.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">尚未添加属性生成规则。</p>}
              {methods.map((method, index) => (
                <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <BuilderInput label="规则 ID" value={method.id} onChange={(value) => patchMethod(index, { id: value })} />
                    <BuilderInput label="显示名称" value={method.name} onChange={(value) => patchMethod(index, { name: value })} />
                    <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">规则类型</span><select aria-label="规则类型" value={method.kind} onChange={(event) => patchMethod(index, { kind: event.target.value as MethodDraft['kind'] })} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100"><option value="standard-array">标准数组</option><option value="point-buy">购点</option><option value="roll">投骰</option></select></label>
                    <BuilderInput label="简要说明" value={method.summary} onChange={(value) => patchMethod(index, { summary: value })} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    {method.kind === 'standard-array' && <BuilderInput label="六个数值（逗号分隔）" value={method.scores} onChange={(value) => patchMethod(index, { scores: value })} className="min-w-72 flex-1" />}
                    {method.kind === 'point-buy' && <><BuilderNumber label="预算" value={method.budget} min={0} max={1000} onChange={(value) => patchMethod(index, { budget: value })} /><BuilderNumber label="最低值" value={method.minimum} min={1} max={30} onChange={(value) => patchMethod(index, { minimum: value })} /><BuilderNumber label="最高值" value={method.maximum} min={1} max={30} onChange={(value) => patchMethod(index, { maximum: value })} /><BuilderInput label="成本表（分数:成本）" value={method.costs} onChange={(value) => patchMethod(index, { costs: value })} className="min-w-80 flex-1" /></>}
                    {method.kind === 'roll' && <><BuilderNumber label="骰子数量" value={method.diceCount} min={1} max={20} onChange={(value) => patchMethod(index, { diceCount: value })} /><BuilderNumber label="骰子面数" value={method.dieSides} min={2} max={1000} onChange={(value) => patchMethod(index, { dieSides: value })} /><BuilderNumber label="舍弃最低骰数量" value={method.dropLowest} min={0} max={19} onChange={(value) => patchMethod(index, { dropLowest: value })} /></>}
                    <button type="button" aria-label={`删除加点规则 ${method.name}`} onClick={() => setMethods((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-auto rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>}

          {displayedSection !== 'spells' && <Dnd5eBuilderResourceInventory
            key={displayedSection}
            sectionLabel={builderSectionLabel(displayedSection)}
            entries={resourceInventoryEntries}
            headerAction={displayedSection === 'monsters' ? (
              <button
                type="button"
                onClick={() => setMonsterWorkshopOpen(true)}
                className="rounded-xl bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-400"
              >
                打开怪物工坊
              </button>
            ) : undefined}
            entryActionLabel={displayedSection === 'monsters' ? '在怪物工坊中打开' : undefined}
            onEntryAction={displayedSection === 'monsters' ? openMonsterInWorkshop : undefined}
          />}

          {localError && <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{localError}</p>}
          {localNotice && <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">{localNotice}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => void deleteDraft()} className="mr-auto inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/5 px-4 py-2.5 text-sm font-semibold text-rose-200 disabled:opacity-50"><Trash2 className="h-4 w-4" /> 删除当前房间草稿</button>
            <button type="button" disabled={busy} onClick={loadDraft} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><FolderOpen className="h-4 w-4" /> 载入本地草稿</button>
            <button type="button" disabled={busy} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><Save className="h-4 w-4" /> 保存本地草稿</button>
            <button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><Download className="h-4 w-4" /> 下载插件文件</button>
            {onPublish && <button type="button" disabled={busy} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-50"><BadgeDollarSign className="h-4 w-4" /> {busy ? '正在处理…' : publishLabel}</button>}
            <button type="button" disabled={busy} onClick={() => void install()} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? '正在保存…' : installLabel}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function HeadlessEffectEditor({
  value,
  onChange,
  title = 'Headless 效果编辑器',
  mode = 'feature',
}: {
  value: HeadlessEffectEditorDraft
  onChange(value: HeadlessEffectEditorDraft): void
  title?: string
  mode?: 'feature' | 'spell'
}) {
  const patch = (next: Partial<HeadlessEffectEditorDraft>) => onChange({ ...value, ...next })
  const patchPersistentAreaTrigger = (index: number, next: Partial<PersistentAreaTriggerEditorDraft>) => {
    patch({
      persistentAreaTriggers: value.persistentAreaTriggers.map((trigger, triggerIndex) =>
        triggerIndex === index ? { ...trigger, ...next } : trigger,
      ),
    })
  }
  const addPersistentAreaTrigger = () => {
    if (value.persistentAreaTriggers.length >= 16) return
    patch({ persistentAreaTriggers: [...value.persistentAreaTriggers, newPersistentAreaTrigger(value.persistentAreaTriggers.length + 1)] })
  }
  const removePersistentAreaTrigger = (index: number) => {
    patch({ persistentAreaTriggers: value.persistentAreaTriggers.filter((_, triggerIndex) => triggerIndex !== index) })
  }
  return (
    <section className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.045] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-violet-100">{title}</h4>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            只生成伤害、治疗和标准状态 capability。地图目标、范围、行动经济、骰子与最终写入都由 Host 校验。
          </p>
        </div>
        <Toggle label={value.enabled ? '已启用自动结算' : '启用自动结算'} value={value.enabled} onChange={(enabled) => patch({ enabled })} />
      </div>

      {value.enabled && <div className="mt-4 space-y-4 border-t border-violet-400/10 pt-4">
        {mode === 'feature' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BuilderInput label="战斗按钮文字" value={value.actionLabel} onChange={(actionLabel) => patch({ actionLabel })} />
          <BuilderSelect label="行动类型" value={value.economy} options={ACTION_ECONOMIES} onChange={(economy) => patch({ economy: economy as HeadlessEffectEditorDraft['economy'] })} />
          <BuilderSelect label="目标模式" value={value.targetingKind} options={TARGETING_KINDS} onChange={(targetingKind) => patch({ targetingKind: targetingKind as HeadlessEffectEditorDraft['targetingKind'] })} />
          {value.targetingKind !== 'self' && <BuilderSelect label="目标关系" value={value.relation} options={TARGET_RELATIONS} onChange={(relation) => patch({ relation: relation as HeadlessEffectEditorDraft['relation'] })} />}
        </div> : <p className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] px-3 py-2 text-xs leading-5 text-cyan-100/70">行动类型、射程与目标取自上方的法术资料；法术位、V／S／M、命中／豁免、升环和专注由 Host 统一校验。</p>}

        {mode === 'feature' && value.targetingKind === 'single-creature' && <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
          <BuilderNumber label="射程（尺）" value={value.rangeFeet} min={0} max={10000} onChange={(rangeFeet) => patch({ rangeFeet })} />
          <div className="pb-0.5"><Toggle label="允许选择自己" value={value.includeSelf} onChange={(includeSelf) => patch({ includeSelf })} /></div>
        </div>}

        {mode === 'feature' && value.targetingKind === 'area' && <div className="rounded-xl border border-white/8 bg-black/10 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BuilderSelect label="范围形状" value={value.areaShape} options={AREA_SHAPES} onChange={(areaShape) => patch({ areaShape: areaShape as HeadlessEffectEditorDraft['areaShape'] })} />
            <BuilderNumber label={value.areaShape === 'circle' || value.areaShape === 'rect' ? '放置射程（尺）' : '瞄准距离（尺）'} value={value.rangeFeet} min={0} max={10000} onChange={(rangeFeet) => patch({ rangeFeet })} />
            <BuilderNumber label="最多目标" value={value.maximumTargets} min={1} max={256} onChange={(maximumTargets) => patch({ maximumTargets })} />
            <div className="self-end pb-0.5"><Toggle label="范围可包含自己" value={value.includeSelf} onChange={(includeSelf) => patch({ includeSelf })} /></div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {value.areaShape === 'circle' && <BuilderNumber label="半径（尺）" value={value.areaRadiusFeet} min={0} max={10000} onChange={(areaRadiusFeet) => patch({ areaRadiusFeet })} />}
            {(value.areaShape === 'line' || value.areaShape === 'rect') && <BuilderNumber label="宽度（尺）" value={value.areaWidthFeet} min={0} max={10000} onChange={(areaWidthFeet) => patch({ areaWidthFeet })} />}
            {value.areaShape === 'rect' && <><BuilderNumber label="高度（尺）" value={value.areaHeightFeet} min={0} max={10000} onChange={(areaHeightFeet) => patch({ areaHeightFeet })} /><div className="self-end pb-0.5"><Toggle label="允许自由旋转" value={value.areaRotatable} onChange={(areaRotatable) => patch({ areaRotatable })} /></div></>}
            {(value.areaShape === 'line' || value.areaShape === 'cone') && <BuilderNumber label="长度（尺）" value={value.areaLengthFeet} min={0} max={10000} onChange={(areaLengthFeet) => patch({ areaLengthFeet })} />}
          </div>
          <div className="mt-3 rounded-xl border border-lime-400/20 bg-lime-500/[0.045] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h5 className="text-xs font-semibold text-lime-100">持续区域与动画</h5>
                <p className="mt-1 text-[11px] leading-5 text-lime-100/60">同步真实格子和持续时间；云雾动画由各端本地绘制，不参与 Headless 判定。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => patch({
                    targetingKind: 'area', relation: 'any', includeSelf: true,
                    areaShape: 'circle', rangeFeet: 90, areaRadiusFeet: 20, maximumTargets: 64,
                    persistentAreaEnabled: true, persistentAreaLabel: '毒云伤害区域示例',
                    persistentAreaColor: '#65a30d', persistentAreaDurationRounds: 10,
                    persistentAreaConcentration: true, persistentAreaVisualPreset: 'toxic-cloud',
                    persistentAreaVisualIntensity: 'normal', persistentAreaVerticalMode: 'volume',
                    persistentAreaHeightFeet: 20, summonEnabled: false,
                    damageEnabled: false, healingEnabled: false, conditionEnabled: false,
                    persistentAreaTriggers: [{
                      ...newPersistentAreaTrigger(1),
                      id: 'toxic-entry',
                      label: '进入毒云',
                      timing: 'on-enter',
                      damageCount: 3,
                      damageSides: 6,
                      damageType: 'poison',
                      savingThrowAbility: 'con',
                      savingThrowOnSuccess: 'half',
                    }],
                  })}
                  className="rounded-lg border border-lime-300/25 bg-lime-400/10 px-2.5 py-1.5 text-xs text-lime-100"
                >载入毒云区域示例</button>
                <Toggle
                  label={value.persistentAreaEnabled ? '已创建持续区域' : '创建持续区域'}
                  value={value.persistentAreaEnabled}
                  onChange={(persistentAreaEnabled) => patch({ persistentAreaEnabled, ...(persistentAreaEnabled ? { summonEnabled: false } : {}) })}
                />
              </div>
            </div>
            {value.persistentAreaEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BuilderInput label="区域名称" value={value.persistentAreaLabel} onChange={(persistentAreaLabel) => patch({ persistentAreaLabel })} />
              <BuilderInput label="区域颜色（#RRGGBB）" value={value.persistentAreaColor} onChange={(persistentAreaColor) => patch({ persistentAreaColor })} />
              <BuilderNumber label="持续轮数" value={value.persistentAreaDurationRounds} min={1} max={14400} onChange={(persistentAreaDurationRounds) => patch({ persistentAreaDurationRounds })} />
              <BuilderSelect
                label="垂直范围"
                value={value.persistentAreaVerticalMode}
                options={[["legacy", "旧版无限柱"], ["ground", "贴地"], ["volume", "立体体积"]]}
                onChange={(persistentAreaVerticalMode) => patch({
                  persistentAreaVerticalMode: persistentAreaVerticalMode as HeadlessEffectEditorDraft['persistentAreaVerticalMode'],
                })}
              />
              {value.persistentAreaVerticalMode === 'volume' && <BuilderNumber
                label="区域高度（尺）"
                value={value.persistentAreaHeightFeet}
                min={1}
                max={10000}
                onChange={(persistentAreaHeightFeet) => patch({ persistentAreaHeightFeet })}
              />}
              <BuilderSelect label="动画预设" value={value.persistentAreaVisualPreset} options={DND5E_PERSISTENT_AREA_VISUAL_PRESETS.map((preset) => [preset, preset] as const)} onChange={(persistentAreaVisualPreset) => patch({ persistentAreaVisualPreset: persistentAreaVisualPreset as HeadlessEffectEditorDraft['persistentAreaVisualPreset'] })} />
              <BuilderSelect label="动画强度" value={value.persistentAreaVisualIntensity} options={[["subtle", "轻微"], ["normal", "标准"], ["strong", "强烈"]]} onChange={(persistentAreaVisualIntensity) => patch({ persistentAreaVisualIntensity: persistentAreaVisualIntensity as HeadlessEffectEditorDraft['persistentAreaVisualIntensity'] })} />
              <div className="self-end pb-0.5"><Toggle label="需要专注" value={value.persistentAreaConcentration} onChange={(persistentAreaConcentration) => patch({ persistentAreaConcentration })} /></div>
            </div>}
            {value.persistentAreaEnabled && <div className="mt-4 border-t border-lime-300/10 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h6 className="text-xs font-semibold text-lime-50">持续区域触发效果</h6>
                  <p className="mt-1 text-[11px] leading-5 text-lime-100/55">每项触发都由 DM Host 检查目标占格、每轮／每回合凭据、豁免、抗性、状态免疫与 ActiveEffect 生命周期。</p>
                </div>
                <button
                  type="button"
                  onClick={addPersistentAreaTrigger}
                  disabled={value.persistentAreaTriggers.length >= 16}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-lime-300/25 bg-lime-400/10 px-2.5 py-1.5 text-xs text-lime-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加触发效果
                </button>
              </div>
              {value.persistentAreaTriggers.length === 0 ? (
                <p className="mt-3 rounded-lg border border-white/8 bg-black/10 px-3 py-2 text-[11px] leading-5 text-slate-500">当前区域只有格子、持续时间和动画，不会自动造成伤害或施加状态。</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {value.persistentAreaTriggers.map((trigger, index) => (
                    <article key={`${trigger.id}:${index}`} className="rounded-xl border border-lime-300/15 bg-black/15 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs text-lime-50">触发效果 {index + 1}</strong>
                        <button type="button" aria-label={`删除区域触发效果 ${index + 1}`} onClick={() => removePersistentAreaTrigger(index)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <BuilderInput label="触发 ID" value={trigger.id} onChange={(id) => patchPersistentAreaTrigger(index, { id })} />
                        <BuilderInput label="触发名称" value={trigger.label} onChange={(label) => patchPersistentAreaTrigger(index, { label })} />
                        <BuilderSelect label="触发时点" value={trigger.timing} options={PERSISTENT_AREA_TRIGGER_TIMINGS} onChange={(timing) => patchPersistentAreaTrigger(index, { timing: timing as PersistentAreaTriggerEditorDraft['timing'] })} />
                        <div className="flex flex-wrap items-end gap-2 pb-0.5">
                          <Toggle label="同一目标每轮一次" value={trigger.oncePerRound} onChange={(oncePerRound) => patchPersistentAreaTrigger(index, { oncePerRound, oncePerTurn: oncePerRound ? false : trigger.oncePerTurn })} />
                          <Toggle label="同一目标每回合一次" value={trigger.oncePerTurn} onChange={(oncePerTurn) => patchPersistentAreaTrigger(index, { oncePerTurn, oncePerRound: oncePerTurn ? false : trigger.oncePerRound })} />
                          <Toggle label="提交前由 DM 调整" value={trigger.dmAdjustable} onChange={(dmAdjustable) => patchPersistentAreaTrigger(index, { dmAdjustable })} />
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-sky-300/10 bg-sky-500/[0.025] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-sky-100">触发豁免</span>
                          <Toggle label={trigger.savingThrowEnabled ? '已启用豁免' : '不进行豁免'} value={trigger.savingThrowEnabled} onChange={(savingThrowEnabled) => patchPersistentAreaTrigger(index, { savingThrowEnabled })} />
                        </div>
                        {trigger.savingThrowEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <BuilderSelect label="豁免属性" value={trigger.savingThrowAbility} options={ABILITIES.map((ability) => [ability.key, ability.label] as const)} onChange={(savingThrowAbility) => patchPersistentAreaTrigger(index, { savingThrowAbility: savingThrowAbility as AbilityKey })} />
                          <BuilderSelect label="豁免 DC" value={trigger.savingThrowDcMode} options={PERSISTENT_AREA_SAVE_DC_MODES} onChange={(savingThrowDcMode) => patchPersistentAreaTrigger(index, { savingThrowDcMode: savingThrowDcMode as PersistentAreaTriggerEditorDraft['savingThrowDcMode'] })} />
                          {trigger.savingThrowDcMode === 'fixed' && <BuilderNumber label="固定 DC" value={trigger.savingThrowDc} min={1} max={40} onChange={(savingThrowDc) => patchPersistentAreaTrigger(index, { savingThrowDc })} />}
                          <BuilderSelect label="豁免成功" value={trigger.savingThrowOnSuccess} options={PERSISTENT_AREA_SAVE_SUCCESS} onChange={(savingThrowOnSuccess) => patchPersistentAreaTrigger(index, { savingThrowOnSuccess: savingThrowOnSuccess as PersistentAreaTriggerEditorDraft['savingThrowOnSuccess'] })} />
                        </div>}
                      </div>

                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        <fieldset className={`rounded-lg border p-3 ${trigger.damageEnabled ? 'border-rose-300/15 bg-rose-500/[0.025]' : 'border-white/8 bg-black/10'}`}>
                          <legend className="px-1"><Toggle label="触发伤害" value={trigger.damageEnabled} onChange={(damageEnabled) => patchPersistentAreaTrigger(index, { damageEnabled })} /></legend>
                          {trigger.damageEnabled && <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <BuilderNumber label="骰子数量" value={trigger.damageCount} min={1} max={40} onChange={(damageCount) => patchPersistentAreaTrigger(index, { damageCount })} />
                            <BuilderNumber label="骰面" value={trigger.damageSides} min={2} max={100} onChange={(damageSides) => patchPersistentAreaTrigger(index, { damageSides })} />
                            <BuilderNumber label="调整值" value={trigger.damageModifier} min={-1000} max={1000} onChange={(damageModifier) => patchPersistentAreaTrigger(index, { damageModifier })} />
                            <BuilderSelect label="伤害类型" value={trigger.damageType} options={HEADLESS_DAMAGE_TYPES} onChange={(damageType) => patchPersistentAreaTrigger(index, { damageType: damageType as Dnd5eDamageType })} />
                          </div>}
                        </fieldset>
                        <fieldset className={`rounded-lg border p-3 ${trigger.conditionEnabled ? 'border-amber-300/15 bg-amber-500/[0.025]' : 'border-white/8 bg-black/10'}`}>
                          <legend className="px-1"><Toggle label="触发状态" value={trigger.conditionEnabled} onChange={(conditionEnabled) => patchPersistentAreaTrigger(index, { conditionEnabled })} /></legend>
                          {trigger.conditionEnabled && <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <BuilderSelect label="状态" value={trigger.condition} options={HEADLESS_CONDITIONS} onChange={(condition) => patchPersistentAreaTrigger(index, { condition: condition as PersistentAreaTriggerEditorDraft['condition'] })} />
                            <BuilderSelect label="解除时点" value={trigger.conditionExpiresAt} options={CONDITION_EXPIRATIONS} onChange={(conditionExpiresAt) => patchPersistentAreaTrigger(index, { conditionExpiresAt: conditionExpiresAt as PersistentAreaTriggerEditorDraft['conditionExpiresAt'] })} />
                            <BuilderNumber label="持续轮数" value={trigger.conditionRounds} min={1} max={14400} onChange={(conditionRounds) => patchPersistentAreaTrigger(index, { conditionRounds })} />
                            {trigger.conditionExpiresAt === 'target-turn-end-save' && <>
                              <BuilderSelect label="重复豁免属性" value={trigger.conditionSaveAbility} options={ABILITIES.map((ability) => [ability.key, ability.label] as const)} onChange={(conditionSaveAbility) => patchPersistentAreaTrigger(index, { conditionSaveAbility: conditionSaveAbility as AbilityKey })} />
                              <BuilderNumber label="重复豁免 DC" value={trigger.conditionSaveDc} min={1} max={40} onChange={(conditionSaveDc) => patchPersistentAreaTrigger(index, { conditionSaveDc })} />
                            </>}
                          </div>}
                        </fieldset>
                      </div>
                      {!trigger.damageEnabled && !trigger.conditionEnabled && <p className="mt-3 rounded-lg border border-rose-300/15 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-100">触发效果至少需要伤害或标准状态。</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>}
          </div>
          <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h5 className="text-xs font-semibold text-cyan-100">召唤生物</h5><p className="mt-1 text-[11px] text-cyan-100/60">在范围锚点创建一个由 DM 操作的 SRD 5.1 生物，并加入权威先攻。</p></div>
              <Toggle label={value.summonEnabled ? '已启用召唤' : '启用召唤'} value={value.summonEnabled} onChange={(summonEnabled) => patch({ summonEnabled, ...(summonEnabled ? { persistentAreaEnabled: false } : {}) })} />
            </div>
            {value.summonEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BuilderSelect label="生物模板" value={value.summonMonsterId} options={SUMMON_MONSTERS} onChange={(summonMonsterId) => patch({ summonMonsterId })} />
              <BuilderInput label="显示名称（可选）" value={value.summonLabel} onChange={(summonLabel) => patch({ summonLabel })} />
              <BuilderNumber label="持续轮数" value={value.summonDurationRounds} min={1} max={14400} onChange={(summonDurationRounds) => patch({ summonDurationRounds })} />
              <BuilderSelect label="阵营关系" value={value.summonSide} options={[["ally", "施法者友方"], ["enemy", "施法者敌方"]]} onChange={(summonSide) => patch({ summonSide: summonSide as HeadlessEffectEditorDraft['summonSide'] })} />
              <div className="self-end pb-0.5"><Toggle label="需要专注" value={value.summonConcentration} onChange={(summonConcentration) => patch({ summonConcentration })} /></div>
            </div>}
          </div>
        </div>}

        <div className="grid gap-3 xl:grid-cols-3">
          <fieldset className={`rounded-xl border p-3 ${value.damageEnabled ? 'border-rose-400/25 bg-rose-500/[0.035]' : 'border-white/8 bg-black/10'}`}>
            <legend className="px-1"><Toggle label="伤害" value={value.damageEnabled} onChange={(damageEnabled) => patch({ damageEnabled })} /></legend>
            {value.damageEnabled && <div className="mt-2 grid grid-cols-2 gap-3">
              <BuilderNumber label="骰子数量" value={value.damageCount} min={1} max={12} onChange={(damageCount) => patch({ damageCount })} />
              <BuilderNumber label="骰面" value={value.damageSides} min={2} max={100} onChange={(damageSides) => patch({ damageSides })} />
              <BuilderNumber label="固定调整值" value={value.damageModifier} min={-1000000} max={1000000} onChange={(damageModifier) => patch({ damageModifier })} />
              <BuilderSelect label="伤害类型" value={value.damageType} options={HEADLESS_DAMAGE_TYPES} onChange={(damageType) => patch({ damageType: damageType as Dnd5eDamageType })} />
            </div>}
          </fieldset>

          {mode === 'feature' && <fieldset className={`rounded-xl border p-3 ${value.healingEnabled ? 'border-emerald-400/25 bg-emerald-500/[0.035]' : 'border-white/8 bg-black/10'}`}>
            <legend className="px-1"><Toggle label="治疗" value={value.healingEnabled} onChange={(healingEnabled) => patch({ healingEnabled })} /></legend>
            {value.healingEnabled && <div className="mt-2 grid grid-cols-2 gap-3">
              <BuilderNumber label="治疗骰数量" value={value.healingCount} min={1} max={12} onChange={(healingCount) => patch({ healingCount })} />
              <BuilderNumber label="治疗骰面" value={value.healingSides} min={2} max={100} onChange={(healingSides) => patch({ healingSides })} />
              <BuilderNumber label="固定治疗值" value={value.healingModifier} min={-1000000} max={1000000} onChange={(healingModifier) => patch({ healingModifier })} />
            </div>}
          </fieldset>}

          <fieldset className={`rounded-xl border p-3 ${value.conditionEnabled ? 'border-amber-400/25 bg-amber-500/[0.035]' : 'border-white/8 bg-black/10'}`}>
            <legend className="px-1"><Toggle label="标准状态" value={value.conditionEnabled} onChange={(conditionEnabled) => patch({ conditionEnabled })} /></legend>
            {value.conditionEnabled && <div className="mt-2 grid grid-cols-2 gap-3">
              <BuilderSelect label="状态" value={value.condition} options={HEADLESS_CONDITIONS} onChange={(condition) => patch({ condition: condition as HeadlessEffectEditorDraft['condition'] })} />
              <BuilderSelect label="解除时点" value={value.conditionExpiresAt} options={CONDITION_EXPIRATIONS} onChange={(conditionExpiresAt) => patch({ conditionExpiresAt: conditionExpiresAt as HeadlessEffectEditorDraft['conditionExpiresAt'] })} />
              <BuilderNumber label="持续轮数" value={value.conditionRounds} min={1} max={14400} onChange={(conditionRounds) => patch({ conditionRounds })} />
              {value.conditionExpiresAt === 'target-turn-end-save' && <>
                <BuilderSelect label="重复豁免属性" value={value.conditionSaveAbility} options={ABILITIES.map((ability) => [ability.key, ability.label] as const)} onChange={(conditionSaveAbility) => patch({ conditionSaveAbility: conditionSaveAbility as AbilityKey })} />
                <BuilderNumber label="重复豁免 DC" value={value.conditionSaveDc} min={1} max={40} onChange={(conditionSaveDc) => patch({ conditionSaveDc })} />
              </>}
            </div>}
          </fieldset>
        </div>

        {!value.damageEnabled && !(mode === 'feature' && value.healingEnabled) && !value.conditionEnabled && !(mode === 'feature' && value.summonEnabled && value.targetingKind === 'area') && !(mode === 'feature' && value.persistentAreaEnabled && value.targetingKind === 'area') && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-100">至少启用一种伤害、治疗、标准状态、持续区域或召唤效果。</p>
        )}

        {mode === 'feature' && <div className="rounded-xl border border-white/8 bg-black/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h5 className="text-xs font-semibold text-slate-300">Interrupt 确认</h5><p className="mt-1 text-[11px] text-slate-600">在掷骰和写入前暂停事务；取消或超时不会消耗行动经济。</p></div>
            <Toggle label="启用 Interrupt" value={value.interruptEnabled} onChange={(interruptEnabled) => patch({ interruptEnabled })} />
          </div>
          {value.interruptEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2"><BuilderInput label="确认提示" value={value.interruptPrompt} onChange={(interruptPrompt) => patch({ interruptPrompt })} /></div>
            <BuilderSelect label="回答者" value={value.interruptAudience} options={INTERRUPT_AUDIENCES} onChange={(interruptAudience) => patch({ interruptAudience: interruptAudience as HeadlessEffectEditorDraft['interruptAudience'] })} />
            <BuilderNumber label="超时（秒）" value={value.interruptTimeoutSeconds} min={5} max={300} onChange={(interruptTimeoutSeconds) => patch({ interruptTimeoutSeconds })} />
          </div>}
        </div>}
      </div>}
    </section>
  )
}

function BuilderInput({ label, value, onChange, className = '' }: { label: string; value: string; onChange(value: string): void; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(value: number): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderTextarea({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><textarea aria-label={label} value={value} rows={3} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm leading-5 text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <button type="button" aria-pressed={value} onClick={() => onChange(!value)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${value ? 'border-arcane-400/40 bg-arcane-500/12 text-arcane-100' : 'border-white/8 text-slate-500'}`}>{label}</button>
}

function SectionHeader({ title, description, actionLabel, onAdd }: { title: string; description: string; actionLabel: string; onAdd(): void }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-200">{title}</h3><p className="mt-1 text-xs text-slate-600">{description}</p></div><button type="button" onClick={onAdd} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> {actionLabel}</button></div>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">{children}</p>
}

function DeleteButton({ label, onClick }: { label: string; onClick(): void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
}
