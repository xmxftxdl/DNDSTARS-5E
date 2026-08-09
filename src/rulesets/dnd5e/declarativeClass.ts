import type { AbilityKey } from '../../lib/dnd'
import type { ClassResourceDefinition, ClassResourceReset } from '../../lib/classDefinitionTypes'
import type { Character, Dnd5eClassContentBindingV1 } from '../../types/character'
import type {
  Dnd5eClassChoiceGroup,
  Dnd5eClassDefinition,
  Dnd5eClassFeatureDefinition,
  Dnd5eClassId,
  Dnd5eSpellcastingKind,
} from './classes'
import type {
  Dnd5eStartingEquipmentChoiceGroup,
  Dnd5eStartingEquipmentGrant,
} from './startingEquipment'

export const DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION = 1 as const

export type DeclarativeClassAutomationV1 = 'full' | 'partial' | 'manual'

export interface DeclarativeClassFeatureV1 {
  id: string
  level: number
  name: string
  description: string
  automation: DeclarativeClassAutomationV1
}

export interface DeclarativeClassChoiceGroupV1 {
  id: string
  level: number
  name: string
  description?: string
  maxSelections: number
  options: readonly {
    id: string
    name: string
    summary: string
    minimumClassLevel?: number
  }[]
}

export interface DeclarativeClassSpellcastingV1 {
  kind: Dnd5eSpellcastingKind
  ability: AbilityKey
  ritualCasting: boolean
  focus: string
  /** Index 0 is class level 1. Shorter tables repeat their final value. */
  cantripsKnown?: readonly number[]
  spellsKnown?: readonly number[]
}

export interface DeclarativeClassResourceV1 {
  id: string
  label: string
  shortLabel?: string
  resetOn: ClassResourceReset
  /** Index 0 is class level 1. Shorter tables repeat their final value. */
  maximumByLevel: readonly number[]
  availableAtLevel?: number
}

export interface DeclarativeClassAdvancementV1 {
  level: number
  /** Local feature IDs from the same package. They are namespaced by the Host. */
  grants?: readonly string[]
  subclassChoice?: boolean
  abilityScoreImprovement?: boolean
  /** Total attacks made by one Attack action at and after this class level. */
  attacksPerAction?: number
}

export interface DeclarativeClassAdvancementResolutionV1 {
  previousLevel: number
  nextLevel: number
  grantedFeatureIds: readonly string[]
  removedFeatureIds: readonly string[]
  resourceUpdates: readonly {
    id: string
    key: string
    previousMaximum: number
    maximum: number
  }[]
  pendingChoiceGroupIds: readonly string[]
  subclassSelectionRequired: boolean
  abilityScoreImprovementLevels: readonly number[]
  attacksPerAction: number
  spellcastingUpdate?: { cantripsKnown?: number; spellsKnown?: number }
}

export interface DeclarativeClassStartingEquipmentV1 {
  fixedGrants?: readonly Dnd5eStartingEquipmentGrant[]
  groups?: readonly Dnd5eStartingEquipmentChoiceGroup[]
}

export interface DeclarativeClassDefinitionV1 {
  schemaVersion: typeof DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION
  id: string
  name: string
  summary: string
  hitDie: 6 | 8 | 10 | 12
  primaryAbilities: readonly AbilityKey[]
  savingThrows: readonly [AbilityKey, AbilityKey]
  armorProficiencies: readonly string[]
  weaponProficiencies: readonly string[]
  toolProficiencies?: readonly string[]
  skills: {
    choiceCount: number
    options: readonly string[] | 'any'
  }
  /** Each group is AND; abilities inside one group are OR and use the same minimum. */
  multiclassPrerequisites?: readonly {
    oneOf: readonly AbilityKey[]
    minimum: number
  }[]
  subclass?: {
    level: number
    id: string
    name: string
    summary: string
  }
  features: readonly DeclarativeClassFeatureV1[]
  choiceGroups?: readonly DeclarativeClassChoiceGroupV1[]
  advancements?: readonly DeclarativeClassAdvancementV1[]
  resources?: readonly DeclarativeClassResourceV1[]
  spellcasting?: DeclarativeClassSpellcastingV1
  startingEquipment?: DeclarativeClassStartingEquipmentV1
}

export interface DeclarativeClassCompatibilityEntryV1 {
  featureId: string
  requested: DeclarativeClassAutomationV1
  effective: DeclarativeClassAutomationV1
  reasons: readonly string[]
}

export interface DeclarativeClassCompatibilityReportV1 {
  full: number
  partial: number
  manual: number
  features: readonly DeclarativeClassCompatibilityEntryV1[]
}

export interface RegisteredDeclarativeClassV1 {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginVersion: string
  ownerPluginLicense: string
  declaration: DeclarativeClassDefinitionV1
  definition: Dnd5eClassDefinition
  compatibility: DeclarativeClassCompatibilityReportV1
}

const ID = /^[a-z0-9][a-z0-9._-]{0,99}$/
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const AUTOMATION = new Set<DeclarativeClassAutomationV1>(['full', 'partial', 'manual'])
const SPELLCASTING = new Set<Dnd5eSpellcastingKind>([
  'full-known', 'full-prepared', 'half-known', 'half-prepared', 'one-third-known', 'pact',
])
const RESOURCE_RESETS = new Set<ClassResourceReset>(['combat', 'short-rest', 'long-rest'])
const EQUIPMENT_SLOTS = new Set(['mainWeapon', 'offHand', 'armor', 'helmet', 'shoes', 'ring', 'ring2', 'belt', 'necklace'])
const registeredById = new Map<string, RegisteredDeclarativeClassV1>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allow = new Set(allowed)
  const unsupported = Object.keys(value).filter((key) => !allow.has(key))
  if (unsupported.length) throw new Error(`${path}包含不支持的字段：${unsupported.join('、')}`)
}

function assertId(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${path} ID 无效`)
}

function assertText(value: unknown, path: string, maximum = 10_000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${path}无效`)
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function assertStringList(value: unknown, path: string, maximum = 128): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maximum || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${path}无效`)
  }
}

function validateGrant(value: unknown, path: string): void {
  if (!isRecord(value)) throw new Error(`${path}无效`)
  assertKeys(value, ['templateId', 'quantity', 'equipSlot'], path)
  assertText(value.templateId, `${path}模板`, 200)
  if (!integer(value.quantity, 1, 1_000_000)) throw new Error(`${path}数量无效`)
  if (value.equipSlot != null && !EQUIPMENT_SLOTS.has(String(value.equipSlot))) throw new Error(`${path}装备栏位无效`)
}

export function validateDeclarativeClassDefinitionV1(value: unknown, path = '声明式职业'): asserts value is DeclarativeClassDefinitionV1 {
  if (!isRecord(value)) throw new Error(`${path}无效`)
  assertKeys(value, [
    'schemaVersion', 'id', 'name', 'summary', 'hitDie', 'primaryAbilities', 'savingThrows',
    'armorProficiencies', 'weaponProficiencies', 'toolProficiencies', 'skills',
    'multiclassPrerequisites', 'subclass', 'features', 'choiceGroups', 'advancements', 'resources',
    'spellcasting', 'startingEquipment',
  ], path)
  if (value.schemaVersion !== DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION) throw new Error(`${path} schemaVersion 不受支持`)
  assertId(value.id, path)
  assertText(value.name, `${path}名称`, 160)
  assertText(value.summary, `${path}摘要`)
  if (![6, 8, 10, 12].includes(Number(value.hitDie))) throw new Error(`${path}生命骰无效`)
  if (!Array.isArray(value.primaryAbilities) || value.primaryAbilities.length < 1 || value.primaryAbilities.length > 3 ||
    value.primaryAbilities.some((ability) => !ABILITIES.has(ability as AbilityKey))) throw new Error(`${path}主属性无效`)
  if (!Array.isArray(value.savingThrows) || value.savingThrows.length !== 2 ||
    value.savingThrows.some((ability) => !ABILITIES.has(ability as AbilityKey)) || new Set(value.savingThrows).size !== 2) {
    throw new Error(`${path}豁免熟练无效`)
  }
  assertStringList(value.armorProficiencies, `${path}护甲熟练`, 64)
  assertStringList(value.weaponProficiencies, `${path}武器熟练`, 128)
  if (value.toolProficiencies != null) assertStringList(value.toolProficiencies, `${path}工具熟练`, 64)
  if (!isRecord(value.skills)) throw new Error(`${path}技能选择无效`)
  assertKeys(value.skills, ['choiceCount', 'options'], `${path}技能选择`)
  if (!integer(value.skills.choiceCount, 0, 18)) throw new Error(`${path}技能选择数量无效`)
  if (value.skills.options !== 'any') assertStringList(value.skills.options, `${path}技能选项`, 64)
  if (value.multiclassPrerequisites != null) {
    if (!Array.isArray(value.multiclassPrerequisites) || value.multiclassPrerequisites.length > 6) throw new Error(`${path}兼职前提无效`)
    for (const [index, prerequisite] of value.multiclassPrerequisites.entries()) {
      if (!isRecord(prerequisite)) throw new Error(`${path}兼职前提 ${index + 1} 无效`)
      assertKeys(prerequisite, ['oneOf', 'minimum'], `${path}兼职前提 ${index + 1}`)
      if (!Array.isArray(prerequisite.oneOf) || prerequisite.oneOf.length < 1 || prerequisite.oneOf.length > 6 ||
        prerequisite.oneOf.some((ability) => !ABILITIES.has(ability as AbilityKey)) || !integer(prerequisite.minimum, 1, 30)) {
        throw new Error(`${path}兼职前提 ${index + 1} 无效`)
      }
    }
  }
  if (value.subclass != null) {
    if (!isRecord(value.subclass)) throw new Error(`${path}子职入口无效`)
    assertKeys(value.subclass, ['level', 'id', 'name', 'summary'], `${path}子职入口`)
    if (!integer(value.subclass.level, 1, 20)) throw new Error(`${path}子职等级无效`)
    assertId(value.subclass.id, `${path}子职`)
    assertText(value.subclass.name, `${path}子职名称`, 160)
    assertText(value.subclass.summary, `${path}子职摘要`)
  }
  if (!Array.isArray(value.features) || value.features.length > 128) throw new Error(`${path}等级特性列表无效`)
  const featureIds = new Set<string>()
  for (const feature of value.features) {
    if (!isRecord(feature)) throw new Error(`${path}等级特性无效`)
    assertKeys(feature, ['id', 'level', 'name', 'description', 'automation'], `${path}等级特性`)
    assertId(feature.id, `${path}等级特性`)
    if (featureIds.has(feature.id)) throw new Error(`${path}等级特性 ID 重复`)
    featureIds.add(feature.id)
    if (!integer(feature.level, 1, 20)) throw new Error(`${path}等级特性等级无效`)
    assertText(feature.name, `${path}等级特性名称`, 160)
    assertText(feature.description, `${path}等级特性说明`)
    if (!AUTOMATION.has(feature.automation as DeclarativeClassAutomationV1)) throw new Error(`${path}等级特性自动化声明无效`)
  }
  if (value.choiceGroups != null) {
    if (!Array.isArray(value.choiceGroups) || value.choiceGroups.length > 64) throw new Error(`${path}升级选择列表无效`)
    const groupIds = new Set<string>()
    for (const group of value.choiceGroups) {
      if (!isRecord(group)) throw new Error(`${path}升级选择无效`)
      assertKeys(group, ['id', 'level', 'name', 'description', 'maxSelections', 'options'], `${path}升级选择`)
      assertId(group.id, `${path}升级选择`)
      if (groupIds.has(group.id)) throw new Error(`${path}升级选择 ID 重复`)
      groupIds.add(group.id)
      if (!integer(group.level, 1, 20) || !integer(group.maxSelections, 1, 64)) throw new Error(`${path}升级选择数量无效`)
      assertText(group.name, `${path}升级选择名称`, 160)
      if (group.description != null && typeof group.description !== 'string') throw new Error(`${path}升级选择说明无效`)
      if (!Array.isArray(group.options) || group.options.length < Number(group.maxSelections) || group.options.length > 128) throw new Error(`${path}升级选项无效`)
      const optionIds = new Set<string>()
      for (const option of group.options) {
        if (!isRecord(option)) throw new Error(`${path}升级选项无效`)
        assertKeys(option, ['id', 'name', 'summary', 'minimumClassLevel'], `${path}升级选项`)
        assertId(option.id, `${path}升级选项`)
        if (optionIds.has(option.id)) throw new Error(`${path}升级选项 ID 重复`)
        optionIds.add(option.id)
        assertText(option.name, `${path}升级选项名称`, 160)
        assertText(option.summary, `${path}升级选项摘要`)
        if (option.minimumClassLevel != null && !integer(option.minimumClassLevel, 1, 20)) throw new Error(`${path}升级选项等级无效`)
      }
    }
  }
  if (value.advancements != null) {
    if (!Array.isArray(value.advancements) || value.advancements.length > 20) throw new Error(`${path}职业进度表无效`)
    let previousLevel = 0
    for (const advancement of value.advancements) {
      if (!isRecord(advancement)) throw new Error(`${path}职业进度无效`)
      assertKeys(advancement, ['level', 'grants', 'subclassChoice', 'abilityScoreImprovement', 'attacksPerAction'], `${path}职业进度`)
      if (!integer(advancement.level, 1, 20) || Number(advancement.level) <= previousLevel) {
        throw new Error(`${path}职业进度等级必须在 1～20 且严格递增`)
      }
      previousLevel = Number(advancement.level)
      if (advancement.grants != null) {
        if (!Array.isArray(advancement.grants) || advancement.grants.length > 64) throw new Error(`${path}职业进度特性授予无效`)
        const grants = new Set<string>()
        for (const grant of advancement.grants) {
          assertId(grant, `${path}职业进度特性`)
          if (grants.has(grant)) throw new Error(`${path}职业进度特性 ID 重复：${grant}`)
          grants.add(grant)
        }
      }
      if (advancement.subclassChoice != null && typeof advancement.subclassChoice !== 'boolean') throw new Error(`${path}子职选择标记无效`)
      if (advancement.abilityScoreImprovement != null && typeof advancement.abilityScoreImprovement !== 'boolean') throw new Error(`${path}属性提升标记无效`)
      if (advancement.attacksPerAction != null && !integer(advancement.attacksPerAction, 1, 10)) throw new Error(`${path}攻击次数无效`)
    }
    const subclassAdvancement = value.advancements.find((entry) => isRecord(entry) && entry.subclassChoice === true)
    if (subclassAdvancement && (!isRecord(value.subclass) || subclassAdvancement.level !== value.subclass.level)) {
      throw new Error(`${path}子职选择等级必须与 subclass.level 一致`)
    }
  }
  if (value.resources != null) {
    if (!Array.isArray(value.resources) || value.resources.length > 32) throw new Error(`${path}职业资源列表无效`)
    const resourceIds = new Set<string>()
    for (const resource of value.resources) {
      if (!isRecord(resource)) throw new Error(`${path}职业资源无效`)
      assertKeys(resource, ['id', 'label', 'shortLabel', 'resetOn', 'maximumByLevel', 'availableAtLevel'], `${path}职业资源`)
      assertId(resource.id, `${path}职业资源`)
      if (resourceIds.has(resource.id)) throw new Error(`${path}职业资源 ID 重复：${resource.id}`)
      resourceIds.add(resource.id)
      assertText(resource.label, `${path}职业资源名称`, 160)
      if (resource.shortLabel != null) assertText(resource.shortLabel, `${path}职业资源短名称`, 80)
      if (!RESOURCE_RESETS.has(resource.resetOn as ClassResourceReset)) throw new Error(`${path}职业资源恢复周期无效`)
      if (!Array.isArray(resource.maximumByLevel) || resource.maximumByLevel.length < 1 || resource.maximumByLevel.length > 20 ||
        resource.maximumByLevel.some((maximum) => !integer(maximum, 0, 1_000))) throw new Error(`${path}职业资源等级表无效`)
      if (resource.availableAtLevel != null && !integer(resource.availableAtLevel, 1, 20)) throw new Error(`${path}职业资源解锁等级无效`)
    }
  }
  if (value.spellcasting != null) {
    if (!isRecord(value.spellcasting)) throw new Error(`${path}施法协议无效`)
    assertKeys(value.spellcasting, ['kind', 'ability', 'ritualCasting', 'focus', 'cantripsKnown', 'spellsKnown'], `${path}施法协议`)
    if (!SPELLCASTING.has(value.spellcasting.kind as Dnd5eSpellcastingKind) || !ABILITIES.has(value.spellcasting.ability as AbilityKey) ||
      typeof value.spellcasting.ritualCasting !== 'boolean') throw new Error(`${path}施法协议无效`)
    assertText(value.spellcasting.focus, `${path}施法法器`, 200)
    for (const [label, table] of [['戏法表', value.spellcasting.cantripsKnown], ['已知法术表', value.spellcasting.spellsKnown]] as const) {
      if (table != null && (!Array.isArray(table) || table.length < 1 || table.length > 20 || table.some((entry) => !integer(entry, 0, 1_000)))) {
        throw new Error(`${path}${label}无效`)
      }
    }
  }
  if (value.startingEquipment != null) {
    if (!isRecord(value.startingEquipment)) throw new Error(`${path}起始装备无效`)
    assertKeys(value.startingEquipment, ['fixedGrants', 'groups'], `${path}起始装备`)
    if (value.startingEquipment.fixedGrants != null) {
      if (!Array.isArray(value.startingEquipment.fixedGrants) || value.startingEquipment.fixedGrants.length > 128) throw new Error(`${path}固定起始装备无效`)
      value.startingEquipment.fixedGrants.forEach((grant, index) => validateGrant(grant, `${path}固定装备 ${index + 1}`))
    }
    if (value.startingEquipment.groups != null) {
      if (!Array.isArray(value.startingEquipment.groups) || value.startingEquipment.groups.length > 64) throw new Error(`${path}起始装备选择无效`)
      for (const group of value.startingEquipment.groups) {
        if (!isRecord(group)) throw new Error(`${path}起始装备组无效`)
        assertKeys(group, ['id', 'label', 'source', 'options'], `${path}起始装备组`)
        assertId(group.id, `${path}起始装备组`)
        assertText(group.label, `${path}起始装备组名称`, 200)
        if (group.source !== 'class') throw new Error(`${path}起始装备组来源必须是 class`)
        if (!Array.isArray(group.options) || group.options.length < 1 || group.options.length > 64) throw new Error(`${path}起始装备选项无效`)
        for (const option of group.options) {
          if (!isRecord(option)) throw new Error(`${path}起始装备选项无效`)
          assertKeys(option, ['id', 'label', 'description', 'grants', 'pickers'], `${path}起始装备选项`)
          assertId(option.id, `${path}起始装备选项`)
          assertText(option.label, `${path}起始装备选项名称`, 200)
          if (option.description != null && typeof option.description !== 'string') throw new Error(`${path}起始装备选项说明无效`)
          if (!Array.isArray(option.grants) || option.grants.length > 128) throw new Error(`${path}起始装备发放列表无效`)
          option.grants.forEach((grant, index) => validateGrant(grant, `${path}起始装备发放 ${index + 1}`))
          if (option.pickers != null) throw new Error(`${path}V1 暂不支持动态装备挑选器；请改为多个固定选项`)
        }
      }
    }
  }
}

export function declarativeClassCompatibilityReportV1(
  classes: readonly DeclarativeClassDefinitionV1[],
): DeclarativeClassCompatibilityReportV1 {
  const features = classes.flatMap((definition) => definition.features.map((feature) => {
    const reasons = feature.automation === 'manual'
      ? ['该职业特性只提供规则正文，需要 DM 裁定']
      : ['DeclarativeClassV1 仅自动注册职业进度；战斗效果必须使用独立声明式能力协议']
    const effective: DeclarativeClassAutomationV1 = feature.automation === 'manual' ? 'manual' : 'partial'
    return { featureId: `${definition.id}:${feature.id}`, requested: feature.automation, effective, reasons }
  }))
  return {
    full: 0,
    partial: features.filter((feature) => feature.effective === 'partial').length,
    manual: features.filter((feature) => feature.effective === 'manual').length,
    features,
  }
}

function tableValue(table: readonly number[] | undefined, level: number): number | undefined {
  if (!table?.length || level < 1) return undefined
  return table[Math.min(level, table.length) - 1]
}

function resourceMaximum(resource: DeclarativeClassResourceV1, level: number): number {
  if (level < (resource.availableAtLevel ?? 1)) return 0
  return tableValue(resource.maximumByLevel, level) ?? 0
}

/** Pure domain resolver shared by creation, level-up previews and Host projection. */
export function resolveDeclarativeClassAdvancementV1(input: {
  classDefinition: DeclarativeClassDefinitionV1
  previousLevel: number
  nextLevel: number
  ownerPluginId?: string
}): DeclarativeClassAdvancementResolutionV1 {
  const previousLevel = Math.floor(input.previousLevel)
  const nextLevel = Math.floor(input.nextLevel)
  if (previousLevel < 0 || nextLevel < previousLevel || nextLevel > 20) {
    throw new Error('声明式职业升级范围无效')
  }
  const crossed = (input.classDefinition.advancements ?? []).filter((advancement) =>
    advancement.level > previousLevel && advancement.level <= nextLevel)
  const namespace = (id: string) => input.ownerPluginId ? `${input.ownerPluginId}:${id}` : id
  const grantedFeatureIds = [...new Set(crossed.flatMap((advancement) => advancement.grants ?? []).map(namespace))]
  const resourceUpdates = (input.classDefinition.resources ?? []).flatMap((resource) => {
    const previousMaximum = resourceMaximum(resource, previousLevel)
    const maximum = resourceMaximum(resource, nextLevel)
    return previousMaximum === maximum ? [] : [{
      id: resource.id,
      key: namespace(resource.id),
      previousMaximum,
      maximum,
    }]
  })
  const explicitAsiLevels = crossed
    .filter((advancement) => advancement.abilityScoreImprovement === true)
    .map((advancement) => advancement.level)
  const legacyAsiLevels = input.classDefinition.features
    .filter((feature) => feature.level > previousLevel && feature.level <= nextLevel && feature.id.startsWith('asi-'))
    .map((feature) => feature.level)
  const attackSteps = (input.classDefinition.advancements ?? [])
    .filter((advancement) => advancement.level <= nextLevel && advancement.attacksPerAction != null)
  return {
    previousLevel,
    nextLevel,
    grantedFeatureIds,
    removedFeatureIds: [],
    resourceUpdates,
    pendingChoiceGroupIds: (input.classDefinition.choiceGroups ?? [])
      .filter((group) => group.level > previousLevel && group.level <= nextLevel)
      .map((group) => group.id),
    subclassSelectionRequired: crossed.some((advancement) => advancement.subclassChoice === true) ||
      (!!input.classDefinition.subclass && previousLevel < input.classDefinition.subclass.level && nextLevel >= input.classDefinition.subclass.level),
    abilityScoreImprovementLevels: [...new Set([...explicitAsiLevels, ...legacyAsiLevels])].sort((left, right) => left - right),
    attacksPerAction: Math.max(1, ...attackSteps.map((advancement) => advancement.attacksPerAction ?? 1)),
    ...(input.classDefinition.spellcasting ? {
      spellcastingUpdate: {
        cantripsKnown: tableValue(input.classDefinition.spellcasting.cantripsKnown, nextLevel),
        spellsKnown: tableValue(input.classDefinition.spellcasting.spellsKnown, nextLevel),
      },
    } : {}),
  }
}

function compileClassDefinition(
  declaration: DeclarativeClassDefinitionV1,
  id: string,
): Dnd5eClassDefinition {
  const features: Dnd5eClassFeatureDefinition[] = declaration.features.map((feature) => ({
    id: `${id}.${feature.id}`,
    level: feature.level,
    name: feature.name.trim(),
    description: feature.description.trim(),
    source: 'class',
  }))
  const choiceGroups: Dnd5eClassChoiceGroup[] | undefined = declaration.choiceGroups?.map((group) => ({
    id: `${id}.${group.id}`,
    level: group.level,
    name: group.name.trim(),
    description: group.description?.trim(),
    maxSelections: group.maxSelections,
    options: group.options.map((option) => ({ ...option, id: `${id}.${group.id}.${option.id}` })),
  }))
  return {
    id: id as Dnd5eClassId,
    name: declaration.name.trim(),
    hitDie: declaration.hitDie,
    primaryAbilities: [...declaration.primaryAbilities],
    savingThrows: [...declaration.savingThrows],
    armorProficiencies: declaration.armorProficiencies.join('、') || '无',
    weaponProficiencies: declaration.weaponProficiencies.join('、') || '无',
    skillChoiceCount: declaration.skills.choiceCount,
    skillProficiencies: declaration.skills.options === 'any' ? 'any' : [...declaration.skills.options],
    subclassLevel: declaration.subclass?.level ?? 20,
    subclass: declaration.subclass
      ? { id: `${id}.${declaration.subclass.id}`, name: declaration.subclass.name, summary: declaration.subclass.summary, features: [] }
      : { id: `${id}.base`, name: '基础职业', summary: '该职业包未声明子职入口。', features: [] },
    features,
    choiceGroups,
    spellcasting: declaration.spellcasting ? { ...declaration.spellcasting } : undefined,
  }
}

export function registerDeclarativeClassV1(input: {
  definition: DeclarativeClassDefinitionV1
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginVersion: string
  ownerPluginLicense: string
}): { registered: RegisteredDeclarativeClassV1; dispose(): void } {
  validateDeclarativeClassDefinitionV1(input.definition)
  const id = `${input.ownerPluginId}:${input.definition.id}`
  if (registeredById.has(id)) throw new Error(`声明式职业已注册：${id}`)
  if ([...registeredById.values()].some((entry) => entry.definition.name === input.definition.name.trim())) {
    throw new Error(`声明式职业名称重复：${input.definition.name}`)
  }
  const registered: RegisteredDeclarativeClassV1 = {
    id,
    ownerPluginId: input.ownerPluginId,
    ownerPluginName: input.ownerPluginName,
    ownerPluginVersion: input.ownerPluginVersion,
    ownerPluginLicense: input.ownerPluginLicense,
    declaration: structuredClone(input.definition),
    definition: compileClassDefinition(input.definition, id),
    compatibility: declarativeClassCompatibilityReportV1([input.definition]),
  }
  registeredById.set(id, registered)
  return {
    registered,
    dispose() {
      if (registeredById.get(id) === registered) registeredById.delete(id)
    },
  }
}

export function registeredDeclarativeClassesV1(): readonly RegisteredDeclarativeClassV1[] {
  return [...registeredById.values()].sort((left, right) => left.definition.name.localeCompare(right.definition.name, 'zh-CN'))
}

export function registeredDeclarativeClassDefinitionV1(idOrName: string): Dnd5eClassDefinition | undefined {
  return registeredById.get(idOrName)?.definition ??
    registeredDeclarativeClassesV1().find((entry) => entry.definition.name === idOrName)?.definition
}

function registeredDeclarativeClassV1(idOrName: string): RegisteredDeclarativeClassV1 | undefined {
  return registeredById.get(idOrName) ??
    registeredDeclarativeClassesV1().find((entry) => entry.definition.name === idOrName)
}

function registeredClassLevel(character: Character, registered: RegisteredDeclarativeClassV1): number {
  const stored = character.dnd5eClassLevels?.[registered.id]
  if (typeof stored === 'number' && Number.isFinite(stored)) return Math.max(0, Math.min(20, Math.floor(stored)))
  return character.charClass === registered.definition.name
    ? Math.max(0, Math.min(20, Math.floor(character.level)))
    : 0
}

export function declarativeClassAdvancementResolutionV1(
  idOrName: string,
  previousLevel: number,
  nextLevel: number,
): DeclarativeClassAdvancementResolutionV1 | undefined {
  const registered = registeredDeclarativeClassV1(idOrName)
  return registered ? resolveDeclarativeClassAdvancementV1({
    classDefinition: registered.declaration,
    previousLevel,
    nextLevel,
    ownerPluginId: registered.ownerPluginId,
  }) : undefined
}

export function declarativeClassGrantedFeatureIdsV1(character: Character): readonly string[] {
  return registeredDeclarativeClassesV1().flatMap((registered) => {
    const level = registeredClassLevel(character, registered)
    return level > 0
      ? resolveDeclarativeClassAdvancementV1({
          classDefinition: registered.declaration,
          previousLevel: 0,
          nextLevel: level,
          ownerPluginId: registered.ownerPluginId,
        }).grantedFeatureIds
      : []
  })
}

export function declarativeClassResourceDefinitionsV1(character: Character): readonly ClassResourceDefinition[] {
  return registeredDeclarativeClassesV1().flatMap((registered) => {
    const classLevel = registeredClassLevel(character, registered)
    if (classLevel < 1) return []
    return (registered.declaration.resources ?? []).map((resource): ClassResourceDefinition => ({
      key: `${registered.ownerPluginId}:${resource.id}`,
      label: resource.label,
      shortLabel: resource.shortLabel,
      resetOn: resource.resetOn,
      isAvailable: () => classLevel >= (resource.availableAtLevel ?? 1),
      max: () => resourceMaximum(resource, classLevel),
    }))
  })
}

export function declarativeClassAttacksPerActionV1(idOrName: string, level: number): number {
  const registered = registeredDeclarativeClassV1(idOrName)
  return registered
    ? resolveDeclarativeClassAdvancementV1({
        classDefinition: registered.declaration,
        previousLevel: 0,
        nextLevel: Math.max(0, Math.min(20, Math.floor(level))),
      }).attacksPerAction
    : 1
}

export function declarativeClassContentBindingV1(idOrName: string): Dnd5eClassContentBindingV1 | undefined {
  const registered = registeredDeclarativeClassV1(idOrName)
  return registered ? {
    classId: registered.id,
    packageId: registered.ownerPluginId,
    packageVersion: registered.ownerPluginVersion,
    contentVersion: 1,
  } : undefined
}

export function declarativeClassStartingEquipmentV1(idOrName: string): DeclarativeClassStartingEquipmentV1 | undefined {
  const registered = registeredDeclarativeClassV1(idOrName)
  return registered?.declaration.startingEquipment
}

export function declarativeClassMulticlassPrerequisitesV1(idOrName: string): DeclarativeClassDefinitionV1['multiclassPrerequisites'] {
  const registered = registeredDeclarativeClassV1(idOrName)
  return registered?.declaration.multiclassPrerequisites
}
