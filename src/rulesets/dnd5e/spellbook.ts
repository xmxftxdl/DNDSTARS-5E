import type { Dnd5eClassId } from './classes'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import type { Dnd5eSrdSpellDescriptionZh } from './spellDescriptionTypes'
import { DND5E_SRD_COMBAT_SPELLS, type Dnd5eSrdSpellDefinition } from './spells'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import type { Dnd5eSpellVisibilityRequirement } from './spellVisibility'
import { parseDnd5eSpellMechanics, type Dnd5eSpellMechanicsDefinition } from './spellMechanics'

export const DND5E_SPELL_IMPORT_FORMAT = 'dndstars5e-spells'
export const DND5E_SPELL_IMPORT_SCHEMA_VERSION = 2
export const DND5E_SPELL_IMPORT_SUPPORTED_SCHEMA_VERSIONS = [1, 2] as const
export const DND5E_SPELL_IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const DND5E_SPELL_IMPORT_MAX_COUNT = 500

export const DND5E_SPELLCASTING_CLASS_IDS = [
  'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
] as const satisfies readonly Dnd5eClassId[]

export type Dnd5eSpellcastingClassId = typeof DND5E_SPELLCASTING_CLASS_IDS[number]
export type Dnd5eSpellbookSchoolId =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation'

export type Dnd5eSpellbookCastingTimeUnit =
  | 'action'
  | 'bonus-action'
  | 'reaction'
  | 'minute'
  | 'hour'

export type Dnd5eSpellbookRangeType = 'self' | 'touch' | 'distance' | 'sight' | 'unlimited' | 'special'
export type Dnd5eSpellbookDurationUnit = 'round' | 'minute' | 'hour' | 'day'

export interface Dnd5eImportedSpell {
  id: string
  name: string
  englishName?: string
  level: number
  school: Dnd5eSpellbookSchoolId
  ritual: boolean
  castingTime: {
    value: number
    unit: Dnd5eSpellbookCastingTimeUnit
    reactionTrigger?: string
  }
  range: {
    type: Dnd5eSpellbookRangeType
    feet?: number
    shape?: 'cone' | 'cube' | 'cylinder' | 'line' | 'radius' | 'sphere'
    sizeFeet?: number
  }
  components: {
    verbal: boolean
    somatic: boolean
    material: boolean
    materialText?: string
    materialCostGp?: number
    materialConsumed?: boolean
  }
  duration: {
    type: 'instantaneous' | 'timed' | 'until-dispelled' | 'special'
    value?: number
    unit?: Dnd5eSpellbookDurationUnit
    concentration: boolean
  }
  classes: Dnd5eSpellcastingClassId[]
  description: string
  higherLevels?: string
  tags?: string[]
  /** 纯数据机械模板；普通 JSON 仍不因此取得 Headless 执行权。 */
  mechanics?: Dnd5eSpellMechanicsDefinition
  source: {
    title: string
    publisher: string
    license: string
  }
  /** Plain JSON imports are reference data and never receive executable capabilities. */
  automation: { mode: 'reference-only' }
}

export interface Dnd5eSpellImportBundle {
  format: typeof DND5E_SPELL_IMPORT_FORMAT
  schemaVersion: typeof DND5E_SPELL_IMPORT_SUPPORTED_SCHEMA_VERSIONS[number]
  spells: Dnd5eImportedSpell[]
}

export interface Dnd5eSpellbookEntry {
  id: string
  name: string
  englishName?: string
  level: number
  classes: readonly Dnd5eSpellcastingClassId[]
  sourceKind: 'srd-core' | 'room-import'
  headless: boolean
  automationLevel: 'full' | 'partial' | 'manual'
  automationReason?: string
  catalogOnly: boolean
  iconAssetId?: string
  visibilityRequirement?: Dnd5eSpellVisibilityRequirement
  translationStatus?: 'context-reviewed' | 'pending-srd-translation'
  reference?: Dnd5eSrdSpellDescriptionZh
  imported?: Dnd5eImportedSpell
  combat?: Dnd5eSrdSpellDefinition
}

const DND5E_PARTIAL_CORE_SPELL_REASONS: Readonly<Record<string, string>> = {
  'produce-flame': '投掷火焰的攻击与伤害已自动化；手持火焰的照明、熄灭和持续时间仍需地图层处理。',
  'fire-bolt': '生物目标的攻击与伤害已自动化；点燃未被穿戴或携带的易燃物仍需 DM 裁定。',
  'burning-hands': '范围豁免、伤害与升环已自动化；点燃区域内未被穿戴或携带的易燃物仍需 DM 裁定。',
  shatter: '生物目标的范围豁免、伤害与升环已自动化；非魔法物体伤害及无机生物的豁免劣势仍需 DM 裁定。',
  fireball: '范围豁免、伤害与升环已自动化；点燃区域内未被穿戴或携带的易燃物仍需 DM 裁定。',
  'lightning-bolt': '范围豁免、伤害与升环已自动化；点燃线内未被穿戴或携带的易燃物仍需 DM 裁定。',
  'cone-of-cold': '范围豁免、伤害与升环已自动化；被法术杀死的生物形成冰冻塑像仍需 DM 或地图层处理。',
  'dancing-lights': '光源位置、组合与移动仍需要地图层或 DM 处理。',
  'minor-illusion': '幻象内容、交互方式与识破结果仍需要 DM 裁定。',
  thaumaturgy: '环境与叙事效果仍需要 DM 裁定。',
  'enlarge-reduce': '生物目标已自动化；物件目标仍需要 DM 裁定。',
  'call-lightning': '伤害与持续发动已自动化；室内空间和暴风天气加骰仍需要 DM 裁定。',
  slow: '速度、AC、敏捷豁免、反应、攻击次数与行动经济已自动化；施法动作延迟的 d20 判定仍需要 DM 裁定。',
  banishment: '战斗状态已自动化；异界生物维持满时长后的位面归返仍需要 DM 裁定。',
  'freezing-sphere': '立即发射已自动化；延迟发射与冻结水面仍需要 DM 裁定。',
  'finger-of-death': '伤害已自动化；击杀人形生物后的僵尸生成与控制仍需要 DM 裁定。',
  'prayer-of-healing': '多目标治疗、升环以及亡灵与构装体限制已自动化；10分钟施法过程与战斗外时间推进仍需 DM 确认。',
}

function dnd5eCoreSpellAutomation(
  spellId: string,
  headless: boolean,
): Pick<Dnd5eSpellbookEntry, 'automationLevel' | 'automationReason'> {
  if (!headless) return { automationLevel: 'manual' }
  const automationReason = DND5E_PARTIAL_CORE_SPELL_REASONS[spellId]
  return automationReason
    ? { automationLevel: 'partial', automationReason }
    : { automationLevel: 'full' }
}

export interface Dnd5ePluginSpellbookReference extends Omit<Dnd5eImportedSpell, 'automation'> {
  iconAssetId?: string
  automation:
    | { mode: 'reference-only' }
    | { mode: 'headless-action'; actionId: string }
}

export class Dnd5eSpellImportError extends Error {
  readonly problems: string[]

  constructor(problems: string[]) {
    super(problems.join('；'))
    this.name = 'Dnd5eSpellImportError'
    this.problems = problems
  }
}

const SCHOOL_IDS = new Set<Dnd5eSpellbookSchoolId>([
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
])
const CASTING_TIME_UNITS = new Set<Dnd5eSpellbookCastingTimeUnit>([
  'action', 'bonus-action', 'reaction', 'minute', 'hour',
])
const RANGE_TYPES = new Set<Dnd5eSpellbookRangeType>(['self', 'touch', 'distance', 'sight', 'unlimited', 'special'])
const RANGE_SHAPES = new Set(['cone', 'cube', 'cylinder', 'line', 'radius', 'sphere'])
const DURATION_TYPES = new Set(['instantaneous', 'timed', 'until-dispelled', 'special'])
const DURATION_UNITS = new Set<Dnd5eSpellbookDurationUnit>(['round', 'minute', 'hour', 'day'])
const SPELL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,79}$/
const coreSpellIds = new Set(DND5E_SRD_SPELL_CATALOG.map((spell) => spell.id))

function objectValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, label: string, problems: string[], maximum: number, required = true): string | undefined {
  if (typeof value !== 'string' || (required && !value.trim())) {
    if (required) problems.push(`${label}不能为空`)
    return undefined
  }
  const normalized = value.trim()
  if (!normalized) return undefined
  if (normalized.length > maximum) problems.push(`${label}不能超过 ${maximum} 个字符`)
  return normalized.slice(0, maximum)
}

function nonNegativeNumber(value: unknown, label: string, problems: string[], integer = false): number | undefined {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) {
    problems.push(`${label}必须是${integer ? '非负整数' : '非负数'}`)
    return undefined
  }
  return number
}

function booleanValue(value: unknown, label: string, problems: string[]): boolean {
  if (typeof value !== 'boolean') problems.push(`${label}必须是布尔值`)
  return value === true
}

function parseSpell(value: unknown, index: number): { spell?: Dnd5eImportedSpell; problems: string[] } {
  const problems: string[] = []
  const prefix = `第 ${index + 1} 个法术`
  if (!objectValue(value)) return { problems: [`${prefix}必须是对象`] }
  const id = boundedString(value.id, `${prefix}.id`, problems, 144) ?? ''
  if (id && !SPELL_ID_PATTERN.test(id)) problems.push(`${prefix}.id 必须使用“命名空间:法术-id”格式`)
  if (id.startsWith('srd-5.1:') || coreSpellIds.has(id)) problems.push(`${prefix}.id 不能冒充或覆盖 SRD 核心法术`)
  const name = boundedString(value.name, `${prefix}.name`, problems, 120) ?? ''
  const englishName = boundedString(value.englishName, `${prefix}.englishName`, problems, 120, false)
  const level = nonNegativeNumber(value.level, `${prefix}.level`, problems, true) ?? 0
  if (level > 9) problems.push(`${prefix}.level 必须在 0 到 9 之间`)
  const school = typeof value.school === 'string' && SCHOOL_IDS.has(value.school as Dnd5eSpellbookSchoolId)
    ? value.school as Dnd5eSpellbookSchoolId
    : undefined
  if (!school) problems.push(`${prefix}.school 不是有效的八大学派 ID`)
  const ritual = booleanValue(value.ritual, `${prefix}.ritual`, problems)

  const castingTimeInput = objectValue(value.castingTime) ? value.castingTime : {}
  if (!objectValue(value.castingTime)) problems.push(`${prefix}.castingTime 必须是对象`)
  const castingTimeValue = nonNegativeNumber(castingTimeInput.value, `${prefix}.castingTime.value`, problems, true) ?? 1
  if (castingTimeValue < 1) problems.push(`${prefix}.castingTime.value 至少为 1`)
  const castingTimeUnit = typeof castingTimeInput.unit === 'string' && CASTING_TIME_UNITS.has(castingTimeInput.unit as Dnd5eSpellbookCastingTimeUnit)
    ? castingTimeInput.unit as Dnd5eSpellbookCastingTimeUnit
    : undefined
  if (!castingTimeUnit) problems.push(`${prefix}.castingTime.unit 无效`)
  const reactionTrigger = boundedString(castingTimeInput.reactionTrigger, `${prefix}.castingTime.reactionTrigger`, problems, 500, false)
  if (castingTimeUnit === 'reaction' && !reactionTrigger) problems.push(`${prefix}是反应法术，必须填写 reactionTrigger`)

  const rangeInput = objectValue(value.range) ? value.range : {}
  if (!objectValue(value.range)) problems.push(`${prefix}.range 必须是对象`)
  const rangeType = typeof rangeInput.type === 'string' && RANGE_TYPES.has(rangeInput.type as Dnd5eSpellbookRangeType)
    ? rangeInput.type as Dnd5eSpellbookRangeType
    : undefined
  if (!rangeType) problems.push(`${prefix}.range.type 无效`)
  const rangeFeet = rangeInput.feet == null ? undefined : nonNegativeNumber(rangeInput.feet, `${prefix}.range.feet`, problems)
  if (rangeType === 'distance' && (!rangeFeet || rangeFeet < 1)) problems.push(`${prefix}的距离射程必须填写大于 0 的 feet`)
  const shape = typeof rangeInput.shape === 'string' && RANGE_SHAPES.has(rangeInput.shape) ? rangeInput.shape as Dnd5eImportedSpell['range']['shape'] : undefined
  if (rangeInput.shape != null && !shape) problems.push(`${prefix}.range.shape 无效`)
  const sizeFeet = rangeInput.sizeFeet == null ? undefined : nonNegativeNumber(rangeInput.sizeFeet, `${prefix}.range.sizeFeet`, problems)
  if (shape && (!sizeFeet || sizeFeet < 1)) problems.push(`${prefix}填写范围形状后必须填写大于 0 的 sizeFeet`)

  const componentsInput = objectValue(value.components) ? value.components : {}
  if (!objectValue(value.components)) problems.push(`${prefix}.components 必须是对象`)
  const verbal = booleanValue(componentsInput.verbal, `${prefix}.components.verbal`, problems)
  const somatic = booleanValue(componentsInput.somatic, `${prefix}.components.somatic`, problems)
  const material = booleanValue(componentsInput.material, `${prefix}.components.material`, problems)
  const materialText = boundedString(componentsInput.materialText, `${prefix}.components.materialText`, problems, 2_000, false)
  if (material && !materialText) problems.push(`${prefix}包含材料成分，必须填写 materialText`)
  const materialCostGp = componentsInput.materialCostGp == null ? undefined : nonNegativeNumber(componentsInput.materialCostGp, `${prefix}.components.materialCostGp`, problems)
  const materialConsumed = componentsInput.materialConsumed == null
    ? undefined
    : booleanValue(componentsInput.materialConsumed, `${prefix}.components.materialConsumed`, problems)

  const durationInput = objectValue(value.duration) ? value.duration : {}
  if (!objectValue(value.duration)) problems.push(`${prefix}.duration 必须是对象`)
  const durationType = typeof durationInput.type === 'string' && DURATION_TYPES.has(durationInput.type)
    ? durationInput.type as Dnd5eImportedSpell['duration']['type']
    : undefined
  if (!durationType) problems.push(`${prefix}.duration.type 无效`)
  const durationValue = durationInput.value == null ? undefined : nonNegativeNumber(durationInput.value, `${prefix}.duration.value`, problems, true)
  const durationUnit = typeof durationInput.unit === 'string' && DURATION_UNITS.has(durationInput.unit as Dnd5eSpellbookDurationUnit)
    ? durationInput.unit as Dnd5eSpellbookDurationUnit
    : undefined
  if (durationType === 'timed' && (!durationValue || !durationUnit)) problems.push(`${prefix}的 timed 持续时间必须填写 value 和 unit`)
  const concentration = booleanValue(durationInput.concentration, `${prefix}.duration.concentration`, problems)

  const classes = Array.isArray(value.classes)
    ? [...new Set(value.classes.filter((classId): classId is Dnd5eSpellcastingClassId =>
        typeof classId === 'string' && (DND5E_SPELLCASTING_CLASS_IDS as readonly string[]).includes(classId),
      ))]
    : []
  if (!Array.isArray(value.classes) || classes.length !== value.classes.length || classes.length === 0) {
    problems.push(`${prefix}.classes 必须是非空的 2014 施法职业 ID 数组`)
  }
  const description = boundedString(value.description, `${prefix}.description`, problems, 20_000) ?? ''
  const higherLevels = boundedString(value.higherLevels, `${prefix}.higherLevels`, problems, 8_000, false)
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.flatMap((tag) => typeof tag === 'string' && tag.trim() ? [tag.trim().slice(0, 48)] : []))].slice(0, 24)
    : undefined
  if (value.tags != null && !Array.isArray(value.tags)) problems.push(`${prefix}.tags 必须是字符串数组`)
  const mechanics = parseDnd5eSpellMechanics(value.mechanics, `${prefix}.mechanics`, problems)

  const sourceInput = objectValue(value.source) ? value.source : {}
  if (!objectValue(value.source)) problems.push(`${prefix}.source 必须是对象`)
  const sourceTitle = boundedString(sourceInput.title, `${prefix}.source.title`, problems, 160) ?? ''
  const publisher = boundedString(sourceInput.publisher, `${prefix}.source.publisher`, problems, 120) ?? ''
  const license = boundedString(sourceInput.license, `${prefix}.source.license`, problems, 120) ?? ''
  const automationInput = objectValue(value.automation) ? value.automation : undefined
  if (automationInput && automationInput.mode !== 'reference-only') {
    problems.push(`${prefix}.automation 只能是 reference-only；JSON 不能获得 Headless 执行权限`)
  }

  if (problems.length > 0 || !school || !castingTimeUnit || !rangeType || !durationType) return { problems }
  return {
    problems,
    spell: {
      id,
      name,
      ...(englishName ? { englishName } : {}),
      level,
      school,
      ritual,
      castingTime: {
        value: castingTimeValue,
        unit: castingTimeUnit,
        ...(reactionTrigger ? { reactionTrigger } : {}),
      },
      range: {
        type: rangeType,
        ...(rangeFeet != null ? { feet: rangeFeet } : {}),
        ...(shape ? { shape } : {}),
        ...(sizeFeet != null ? { sizeFeet } : {}),
      },
      components: {
        verbal,
        somatic,
        material,
        ...(materialText ? { materialText } : {}),
        ...(materialCostGp != null ? { materialCostGp } : {}),
        ...(materialConsumed != null ? { materialConsumed } : {}),
      },
      duration: {
        type: durationType,
        ...(durationValue != null ? { value: durationValue } : {}),
        ...(durationUnit ? { unit: durationUnit } : {}),
        concentration,
      },
      classes,
      description,
      ...(higherLevels ? { higherLevels } : {}),
      ...(tags?.length ? { tags } : {}),
      ...(mechanics ? { mechanics } : {}),
      source: { title: sourceTitle, publisher, license },
      automation: { mode: 'reference-only' },
    },
  }
}

function parseSpellCollection(input: unknown, allowEmpty: boolean): Dnd5eImportedSpell[] {
  if (!Array.isArray(input)) throw new Dnd5eSpellImportError(['spells 必须是数组'])
  if (!allowEmpty && input.length < 1) throw new Dnd5eSpellImportError(['文件中没有法术'])
  if (input.length > DND5E_SPELL_IMPORT_MAX_COUNT) throw new Dnd5eSpellImportError([`单次最多导入 ${DND5E_SPELL_IMPORT_MAX_COUNT} 个法术`])
  const parsed = input.map(parseSpell)
  const problems = parsed.flatMap((entry) => entry.problems)
  const spells = parsed.flatMap((entry) => entry.spell ? [entry.spell] : [])
  const ids = new Set<string>()
  for (const spell of spells) {
    if (ids.has(spell.id)) problems.push(`文件内存在重复法术 ID：${spell.id}`)
    ids.add(spell.id)
  }
  if (problems.length > 0) throw new Dnd5eSpellImportError(problems.slice(0, 40))
  return spells
}

/** Shared room state may legitimately contain no custom spells. */
export function parseDnd5eSharedSpellCollection(input: unknown): Dnd5eImportedSpell[] {
  return parseSpellCollection(input, true)
}

export function parseDnd5eSpellImport(input: unknown): Dnd5eSpellImportBundle {
  if (!objectValue(input)) throw new Dnd5eSpellImportError(['文件根节点必须是对象'])
  if (input.format !== DND5E_SPELL_IMPORT_FORMAT) throw new Dnd5eSpellImportError([`format 必须是 ${DND5E_SPELL_IMPORT_FORMAT}`])
  if (!(DND5E_SPELL_IMPORT_SUPPORTED_SCHEMA_VERSIONS as readonly unknown[]).includes(input.schemaVersion)) {
    throw new Dnd5eSpellImportError(['不支持这个法术模板版本'])
  }
  const spells = parseSpellCollection(input.spells, false)
  return {
    format: DND5E_SPELL_IMPORT_FORMAT,
    schemaVersion: input.schemaVersion as Dnd5eSpellImportBundle['schemaVersion'],
    spells,
  }
}

export async function parseDnd5eSpellImportFile(file: File): Promise<Dnd5eSpellImportBundle> {
  if (file.size > DND5E_SPELL_IMPORT_MAX_BYTES) throw new Dnd5eSpellImportError(['文件超过 2 MiB 上限'])
  let value: unknown
  try {
    value = JSON.parse(await file.text())
  } catch {
    throw new Dnd5eSpellImportError(['文件不是有效 JSON'])
  }
  return parseDnd5eSpellImport(value)
}

export function dnd5eSpellbookEntries(imported: readonly Dnd5eImportedSpell[]): Dnd5eSpellbookEntry[] {
  const combatById = new Map(DND5E_SRD_COMBAT_SPELLS.map((spell) => [spell.id, spell]))
  const core = DND5E_SRD_SPELL_CATALOG.map((catalog): Dnd5eSpellbookEntry => {
    const combat = combatById.get(catalog.id)
    const reviewedReference = DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED[catalog.id]
    const reference = reviewedReference
      ? {
          ...reviewedReference,
          sourceName: catalog.name,
          sourceEnglishName: catalog.englishName,
        }
      : undefined
    return {
      id: catalog.id,
      name: catalog.name,
      englishName: catalog.englishName,
      level: catalog.level,
      classes: catalog.classes as readonly Dnd5eSpellcastingClassId[],
      sourceKind: 'srd-core',
      headless: !!combat,
      ...dnd5eCoreSpellAutomation(catalog.id, !!combat),
      catalogOnly: !combat,
      visibilityRequirement: catalog.visibilityRequirement,
      translationStatus: reviewedReference ? 'context-reviewed' : 'pending-srd-translation',
      ...(reference ? { reference } : {}),
      ...(combat ? { combat } : {}),
    }
  })
  const room = imported.map((spell): Dnd5eSpellbookEntry => ({
    id: spell.id,
    name: spell.name,
    ...(spell.englishName ? { englishName: spell.englishName } : {}),
    level: spell.level,
    classes: spell.classes,
    sourceKind: 'room-import',
    headless: false,
    automationLevel: 'manual',
    catalogOnly: false,
    imported: spell,
  }))
  return [...core, ...room].sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'zh-CN'))
}

/** 把当前激活规则包的法术并入法术书，同时保留其真实 Headless 标记。 */
export function dnd5eSpellbookEntriesWithPlugins(
  imported: readonly Dnd5eImportedSpell[],
  pluginSpells: readonly Dnd5ePluginSpellbookReference[],
): Dnd5eSpellbookEntry[] {
  const automation = new Map(pluginSpells.map((spell) => [spell.id, spell.automation]))
  const iconAssets = new Map(pluginSpells.flatMap((spell) =>
    spell.iconAssetId ? [[spell.id, spell.iconAssetId] as const] : []))
  const pluginIds = new Set(pluginSpells.map((spell) => spell.id))
  const references: Dnd5eImportedSpell[] = pluginSpells.map((spell) => ({
    ...spell,
    automation: { mode: 'reference-only' },
  }))
  return dnd5eSpellbookEntries([...imported.filter((spell) => !pluginIds.has(spell.id)), ...references]).map((entry) => {
    const iconAssetId = iconAssets.get(entry.id)
    const withAutomation = automation.get(entry.id)?.mode === 'headless-action'
      ? { ...entry, headless: true, automationLevel: 'full' as const, catalogOnly: false }
      : entry
    return iconAssetId ? { ...withAutomation, iconAssetId } : withAutomation
  })
}

export const DND5E_SPELL_SCHOOL_LABELS: Readonly<Record<Dnd5eSpellbookSchoolId, string>> = {
  abjuration: '防护',
  conjuration: '咒法',
  divination: '预言',
  enchantment: '附魔',
  evocation: '塑能',
  illusion: '幻术',
  necromancy: '死灵',
  transmutation: '变化',
}

export const DND5E_SPELL_CLASS_LABELS: Readonly<Record<Dnd5eSpellcastingClassId, string>> = {
  bard: '吟游诗人',
  cleric: '牧师',
  druid: '德鲁伊',
  paladin: '圣武士',
  ranger: '游侠',
  sorcerer: '术士',
  warlock: '邪术师',
  wizard: '法师',
}
