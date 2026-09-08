import type { Dnd5eClassId } from './classes'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import type { Dnd5eSrdSpellDescriptionZh } from './spellDescriptionTypes'
import { DND5E_SRD_COMBAT_SPELLS, type Dnd5eSrdSpellDefinition } from './spells'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import type { Dnd5eSpellVisibilityRequirement } from './spellVisibility'
import { parseDnd5eSpellMechanics, type Dnd5eSpellMechanicsDefinition } from './spellMechanics'
import { dnd5eSrdAuditedSpellDecisionV1 } from './activities/dnd5eSrdAuditedSpellDecisions'
import type { Dnd5eSpellMaterialRequirement } from './spellMaterials'

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
    shape?: 'cone' | 'cube' | 'cylinder' | 'line' | 'radius' | 'rect' | 'sphere'
    sizeFeet?: number
    /** Rectangular templates use independent dimensions and may opt into free rotation. */
    widthFeet?: number
    heightFeet?: number
    rotatable?: boolean
    /** Allows the caster to choose a 5-foot increment up to the declared size. */
    adjustable?: boolean
  }
  /** Pure-data target filters used by plugin Headless spells. */
  targeting?: {
    relation?: 'any' | 'ally' | 'enemy'
    includeSelf?: boolean
    maximumTargets?: number
  }
  components: {
    verbal: boolean
    somatic: boolean
    material: boolean
    materialText?: string
    materialCostGp?: number
    materialConsumed?: boolean
    /** Optional exact inventory recipe for room and plugin spells. */
    materialRequirement?: Dnd5eSpellMaterialRequirement
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
  'mage-hand': '手的持续时间与地图投影已支持；抓取、移动及操作具体物体仍需地图交互或 DM 裁定。',
  darkness: '固定区域、魔法黑暗与视觉压制已自动化；物体载体、遮盖阻断及随物体移动仍需地图层处理。',
  daylight: '固定光照区域及与黑暗区域的压制已自动化；施加到物体并随物体移动仍需地图层处理。',
  'spike-growth': '困难地形与移动伤害已自动化；未目睹施法者的主动察觉识别流程仍需 DM 或地图层处理。',
  'see-invisibility': '识破隐形已自动化；看入以太位面的地图语义仍需 DM 裁定。',
  'faerie-fire': '生物豁免、显形和攻击优势已自动化；区域内物体的描边效果仍需地图层处理。',
  shillelagh: '武器伤害骰、施法属性选择、重施、持续时间及权威物品栏中的武器离手生命周期已自动化；临时地图物件或叙事性放手仍需 DM 处理。',
  'produce-flame': '投掷火焰的攻击与伤害已自动化；手持火焰的照明、熄灭和持续时间仍需地图层处理。',
  // Fire Bolt, Burning Hands, Fireball, Lightning Bolt, and Meteor Swarm have
  // complete creature-facing combat transactions. Scenery damage/ignition is
  // an optional DM-authored map state and does not demote them from full Headless.
  thaumaturgy: '环境与叙事效果仍需要 DM 裁定。',
  'enlarge-reduce': '生物目标已自动化；物件目标仍需要 DM 裁定。',
  'call-lightning': '伤害、持续发动、权威高空空间限制及既有暴风雨额外伤害骰均已自动化。',
  'calm-emotions': '范围、类人生物筛选、魅力豁免、自愿友方失败、状态压制/恢复及有界漠然均已自动化；更细的社会态度仍可由语音叙事补充。',
  slow: '速度、AC、敏捷豁免、反应、攻击次数、行动经济及核心 1 动作法术的施法动作延迟均已自动化；插件、怪物专用及地图实体法术的延迟完成仍保留 DM 裁定边界。',
  banishment: '战斗状态已自动化；异界生物维持满时长后的位面归返仍需要 DM 裁定。',
  'freezing-sphere': '立即发射已自动化；延迟发射与冻结水面仍需要 DM 裁定。',
  'finger-of-death': '伤害已自动化；击杀人形生物后的僵尸生成与控制仍需要 DM 裁定。',
  'prayer-of-healing': '多目标治疗、升环以及亡灵与构装体限制已自动化；10分钟施法过程与战斗外时间推进仍需 DM 确认。',
  'insect-plague': '初始范围伤害、升环、进入与回合结束触发、困难地形和垂直范围已自动化；轻度遮蔽与精确球面边界仍需地图层或 DM 处理。',
  cloudkill: '进入与回合开始伤害、升环和垂直范围已自动化；重度遮蔽、毒雾自动移动、下沉与强风驱散仍需地图层或 DM 处理。',
  'blade-barrier': '可调长度的直墙、环形墙、进入与回合开始伤害、困难地形和垂直范围已自动化；墙后的四分之三掩护仍需地图层或 DM 处理。',
  // Fog Cloud's cast transaction is complete: placement, slot-scaled radius,
  // heavy obscuration, concentration and duration are deterministic. Wind is
  // an external scene event, like scenery ignition for Fire Bolt, and should
  // not prevent the spell itself from entering map targeting.
  web: '轻度遮蔽、困难地形、进入/回合开始豁免、束缚与力量挣脱已自动化；支撑条件、坠落和燃烧蛛网仍由 DM 裁定。',
  silence: '区域内言语成分禁用和雷鸣伤害免疫已自动化；声音传播、耳聋叙事与边界争议仍由 DM 裁定。',
  'sleet-storm': '重度遮蔽、困难地形、倒地豁免及施法专注检定已自动化；裸露火焰熄灭仍由 DM 裁定。',
  'stinking-cloud': '重度遮蔽和回合开始体质豁免失败失去动作已自动化；无需呼吸者及强风驱散等特殊情况仍由 DM 裁定。',
  'wind-wall': '可旋转直墙、初始力量豁免与伤害、驱散重叠雾气、普通飞射物阻挡、小型飞行生物与气化形体穿越限制已自动化；任意曲线路径和松散轻质材料仍由 DM 裁定。',
  'wall-of-force': '可旋转直墙的移动与效应线阻挡已自动化；球体/穹顶、夹住生物时的推向和解离术互动仍由 DM 裁定。',
  'wall-of-stone': '可旋转直墙的移动、视线、效应线阻挡及维持完整持续时间后的永久化已自动化；独立墙板生命、复杂造型与围困反应仍由 DM 裁定。',
  'wall-of-ice': '可旋转直墙、初始豁免伤害、升环及移动/视线/效应线阻挡已自动化；墙段生命、破坏后寒气与复杂造型仍由 DM 裁定。',
  'wall-of-thorns': '可旋转直墙、初始及进入/回合结束伤害、升环、移动成本和视线阻挡已自动化；环形造型与植被细节仍由 DM 裁定。',
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

function dnd5eAuditedCatalogSpellAutomation(
  spellId: string,
): Pick<Dnd5eSpellbookEntry, 'headless' | 'automationLevel' | 'automationReason' | 'catalogOnly'> | undefined {
  const decision = dnd5eSrdAuditedSpellDecisionV1(spellId)
  if (!decision || decision.target === 'manual') return undefined
  if (decision.target === 'full') return {
    headless: true,
    automationLevel: 'full',
    catalogOnly: false,
  }
  return {
    headless: false,
    automationLevel: 'partial',
    automationReason: `Host 管理确定性施法事务；${decision.codes.join('、')}在共享 DM 裁定边界暂停。`,
    catalogOnly: false,
  }
}

/**
 * Runtime automation fails closed: an entry is executable by Headless only
 * when the spell audit says every declared rule branch is covered.
 */
export function dnd5eSpellbookEntryHasFullHeadlessAutomation(
  spell: Pick<Dnd5eSpellbookEntry, 'headless' | 'automationLevel'> | undefined,
): boolean {
  return spell?.headless === true && spell.automationLevel === 'full'
}

const DND5E_STRUCTURED_PARTIAL_CAST_SPELL_IDS = new Set([
  // The fixed 15-foot magical-darkness volume, concentration lifecycle and
  // vision suppression are deterministic map transactions. Object anchoring,
  // covering the source and following a carried object remain explicit map
  // boundaries, but they must not make the ordinary point-cast route (or a
  // concrete Darkness scroll) unreachable from the real UI.
  'darkness',
  // The fixed point-centered bright/dim-light volume and spell-level conflict
  // transaction are deterministic. Attaching the light to an object, moving
  // that object and covering it remain narration/DM boundaries, but those
  // object branches must not hide the ordinary point-cast route.
  'daylight',
  // Creature-category detection, the 30-foot range and the concentration
  // lifecycle are deterministic. Consecrated/desecrated places and objects,
  // plus the spell's material-specific barrier thicknesses, remain explicit
  // map/DM boundaries. Keep the implemented creature-sense transaction
  // reachable without claiming those environmental branches are automated.
  'detect-evil-and-good',
  // Spell effects, concentration and carried/worn magic items are projected
  // into a closed Host detection transaction. Independent magical map
  // objects and the material-specific barrier thresholds remain explicit
  // scene boundaries, so keep the live Activity without claiming `full`.
  'detect-magic',
  // Poisoned conditions, disease effects and poisonous SRD creature payloads
  // are closed Host inputs. Independent poison objects, exact poison-kind
  // metadata and material-specific barrier thresholds remain scene/DM facts,
  // so preserve the implemented 30-foot detection cast without claiming full.
  'detect-poison-and-disease',
  // Creating and moving the projection are deterministic map transactions.
  // The later choice of which scenery object to manipulate remains an
  // explicit DM boundary and therefore must not promote the whole spell to
  // `full` automation.
  'mage-hand',
  // The ten-minute casting process still needs an explicit DM confirmation,
  // but target validation, one shared healing roll, upcasting, slot spending,
  // and the undead/construct exclusion are deterministic Host transactions.
  'prayer-of-healing',
  // Creating the fixed storm cloud, resolving the initial five-foot strike,
  // preserving concentration and authorizing later action strikes with the
  // original slot-scaled damage are deterministic combat/map transactions.
  // Indoor clearance and the extra die from a pre-existing outdoor storm stay
  // in the authoritative map geometry and must remain reachable from the real
  // casting UI together with every strike and upcast branch.
  'call-lightning',
  // The affected humanoids, Charisma saves, voluntary allied failures,
  // concentration, condition suspension and bounded indifference groups are
  // deterministic. Voice remains available for conversational consequences,
  // but prose-only routing would skip every combat-facing rule.
  'calm-emotions',
  // Holding the flame and the later ranged spell attack are deterministic
  // combat transactions. Only the emitted light and scenery interaction stay
  // at the map/DM boundary, so routing the whole spell to prose adjudication
  // would make its audited sustained attack unreachable from the real UI.
  'produce-flame',
  // The cast transaction binds the currently held club or quarterstaff and
  // records the caster's authoritative attack-ability choice. Weapon attacks
  // then consume that structured effect, including its d8 damage die. Routing
  // this spell to prose adjudication would spend the bonus action without ever
  // creating the implemented weapon modifier.
  'shillelagh',
  // The fixed 20-foot ground hazard, concentration lifecycle, difficult
  // terrain, and 2d4 piercing damage per five feet are deterministic map
  // transactions. Only the pre-entry Perception check for creatures that did
  // not witness the cast remains manual. Prose adjudication cannot create the
  // implemented persistent area, so it must not hide the structured route.
  'spike-growth',
  // The fixed 20-foot cube, concentration lifecycle, difficult terrain,
  // light obscuration, entry/turn-start Dexterity saves, restrained condition,
  // and Strength action escape are deterministic map transactions. Support,
  // collapse and burning remain explicit scene boundaries, but prose-only
  // adjudication cannot create the implemented web area or reach its triggers.
  'web',
  // The fixed 20-foot silence volume, concentration lifecycle, verbal-component
  // suppression, and thunder immunity are deterministic map transactions. Only
  // sound propagation, deafness narration, and disputed boundary cases remain
  // manual. Prose adjudication cannot create the implemented persistent area,
  // which would make every audited mechanical branch unreachable from the UI.
  'silence',
  // The fixed 40-foot-radius, 20-foot-high storm, difficult terrain,
  // obscuration, prone saves and concentration disruption are deterministic
  // map transactions. Only extinguishing exposed scenery flames remains a DM
  // boundary, so prose adjudication must not hide the implemented area route.
  'sleet-storm',
  // The fixed 20-foot-radius, 40-foot-high cloud, concentration lifecycle,
  // heavy obscuration and turn-start Constitution save/action loss are
  // deterministic map transactions. Breathless creatures and wind dispersal
  // remain explicit DM boundaries, but prose adjudication cannot create the
  // implemented persistent area or reach its turn-start trigger.
  'stinking-cloud',
  // The fixed 20-foot-radius, 40-foot-high poison cloud, concentration
  // lifecycle, enter/turn-start Constitution saves, half damage, poison
  // immunity and one-extra-d8-per-higher-slot scaling are deterministic map
  // transactions. Automatic drifting/sinking and strong-wind dispersal remain
  // explicit map/DM boundaries, but prose adjudication cannot create the
  // implemented area or reach any of its audited damage triggers.
  'cloudkill',
  // The straight 50-foot wall, 120-foot placement range, initial Strength
  // saves/3d8 bludgeoning damage, concentration lifecycle and vertical volume
  // are deterministic map transactions. Curved paths and the later projectile,
  // gas and flying-creature interactions remain explicit map/DM boundaries,
  // but prose adjudication cannot create or resolve the implemented wall.
  'wind-wall',
  // The point-cast straight wall, 120-foot placement range, ten-minute
  // concentration lifecycle, movement blocking and line-of-effect blocking
  // are deterministic map transactions. Dome/sphere geometry, choosing the
  // side for an intersected creature, and Disintegrate remain explicit DM
  // boundaries, but prose adjudication cannot create the implemented wall.
  'wall-of-force',
  // The straight stone wall, 120-foot placement range, concentration
  // lifecycle and movement/vision/line-of-effect blocking are deterministic
  // map transactions. Individual panel HP, free-form construction, enclosure
  // reactions remain explicit DM boundaries, while a completed ten-minute
  // concentration automatically makes the wall permanent. Those boundaries
  // must not
  // make the implemented wall placement route unreachable from the real UI.
  'wall-of-stone',
  // The straight ten-panel ice wall, on-create Dexterity save and cold
  // damage (including slot scaling), concentration lifecycle and map
  // blocking are deterministic transactions. Section HP/fire vulnerability,
  // destroyed-section chill and dome/sphere geometry remain explicit DM
  // boundaries, but they must not hide the implemented wall route.
  'wall-of-ice',
  // The straight thorn wall, initial Dexterity save/piercing damage, later
  // entry and turn-end slashing damage, slot scaling, fourfold movement cost,
  // vision blocking and concentration lifecycle are deterministic map
  // transactions. Circular geometry and scenery/vegetation details remain DM
  // boundaries, but prose adjudication cannot create the implemented hazard.
  'wall-of-thorns',
  // Slow's initial target selection, Wisdom saves, concentration duration,
  // speed/AC/Dex-save/reaction/attack/action-economy penalties and repeat save
  // are deterministic combat transactions. The later one-action spell delay
  // is a separate boundary and must not hide all of those implemented fields
  // behind the prose-only adjudication route.
  'slow',
  // Seeing ordinary invisible creatures and objects is a deterministic
  // 600-round self effect. Only the additional ethereal-plane presentation is
  // manual; prose adjudication cannot encode the seeInvisible modifier and
  // would otherwise make the implemented sight mechanics unreachable.
  'see-invisibility',
])

/**
 * A deliberately narrow bridge for partial spells whose cast transaction is
 * safe to run before their later, explicitly manual rule branches occur.
 * This is separate from the full-automation audit so UI routing never has to
 * lie about the remaining DM boundary.
 */
export function dnd5eSpellbookEntryCanUseStructuredCastRoute(
  spell: Pick<Dnd5eSpellbookEntry, 'id' | 'sourceKind' | 'automationLevel' | 'combat'> | undefined,
): boolean {
  return spell?.sourceKind === 'srd-core' && spell.automationLevel === 'partial' &&
    DND5E_STRUCTURED_PARTIAL_CAST_SPELL_IDS.has(spell.id)
}

/**
 * Partial legacy-core spells execute through their native combat definition;
 * audited catalog-only partial spells instead keep their installed plugin
 * Activity. Both are structured, but choosing the wrong executor makes the
 * latter fall through to “spell definition unavailable” in the real map UI.
 */
export function dnd5eSpellbookEntryUsesLegacyCoreStructuredCastRoute(
  spell: Pick<Dnd5eSpellbookEntry, 'id' | 'sourceKind' | 'automationLevel' | 'combat'> | undefined,
): boolean {
  return dnd5eSpellbookEntryCanUseStructuredCastRoute(spell) && spell?.combat != null
}

export function dnd5eSrdSpellHasFullHeadlessAutomation(spellId: string): boolean {
  if (DND5E_SRD_COMBAT_SPELLS.some((spell) => spell.id === spellId)) {
    return DND5E_PARTIAL_CORE_SPELL_REASONS[spellId] == null
  }
  return dnd5eSrdAuditedSpellDecisionV1(spellId)?.target === 'full'
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
const RANGE_SHAPES = new Set(['cone', 'cube', 'cylinder', 'line', 'radius', 'rect', 'sphere'])
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

function parseMaterialRequirement(
  value: unknown,
  prefix: string,
  problems: string[],
): Dnd5eSpellMaterialRequirement | undefined {
  if (value == null) return undefined
  if (!objectValue(value)) {
    problems.push(`${prefix}必须是对象`)
    return undefined
  }
  const label = boundedString(value.label, `${prefix}.label`, problems, 500) ?? ''
  if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > 8) {
    problems.push(`${prefix}.options 必须包含 1 到 8 个选项`)
    return undefined
  }
  const options = value.options.flatMap((candidate, optionIndex) => {
    const optionPrefix = `${prefix}.options[${optionIndex}]`
    if (!objectValue(candidate)) {
      problems.push(`${optionPrefix}必须是对象`)
      return []
    }
    const optionLabel = boundedString(candidate.label, `${optionPrefix}.label`, problems, 300) ?? ''
    if (!Array.isArray(candidate.components) || candidate.components.length < 1 || candidate.components.length > 8) {
      problems.push(`${optionPrefix}.components 必须包含 1 到 8 种材料`)
      return []
    }
    const components = candidate.components.flatMap((rawComponent, componentIndex) => {
      const componentPrefix = `${optionPrefix}.components[${componentIndex}]`
      if (!objectValue(rawComponent)) {
        problems.push(`${componentPrefix}必须是对象`)
        return []
      }
      const tag = boundedString(rawComponent.tag, `${componentPrefix}.tag`, problems, 160) ?? ''
      if (tag && !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(tag)) {
        problems.push(`${componentPrefix}.tag 必须是稳定的小写规则 ID`)
      }
      const componentLabel = boundedString(rawComponent.label, `${componentPrefix}.label`, problems, 300) ?? ''
      const consumed = booleanValue(rawComponent.consumed, `${componentPrefix}.consumed`, problems)
      const quantity = rawComponent.quantity == null
        ? undefined
        : nonNegativeNumber(rawComponent.quantity, `${componentPrefix}.quantity`, problems, true)
      if (quantity != null && (quantity < 1 || quantity > 1_000_000)) {
        problems.push(`${componentPrefix}.quantity 必须在 1 到 1000000 之间`)
      }
      const minimumUnitValueGp = rawComponent.minimumUnitValueGp == null
        ? undefined
        : nonNegativeNumber(rawComponent.minimumUnitValueGp, `${componentPrefix}.minimumUnitValueGp`, problems)
      const minimumTotalValueGp = rawComponent.minimumTotalValueGp == null
        ? undefined
        : nonNegativeNumber(rawComponent.minimumTotalValueGp, `${componentPrefix}.minimumTotalValueGp`, problems)
      if ((minimumUnitValueGp ?? 0) > 1_000_000_000 || (minimumTotalValueGp ?? 0) > 1_000_000_000) {
        problems.push(`${componentPrefix}的材料价值不能超过 1000000000 gp`)
      }
      return [{
        tag,
        label: componentLabel,
        consumed,
        ...(quantity != null ? { quantity } : {}),
        ...(minimumUnitValueGp != null ? { minimumUnitValueGp } : {}),
        ...(minimumTotalValueGp != null ? { minimumTotalValueGp } : {}),
      }]
    })
    return [{ label: optionLabel, components }]
  })
  return { label, options }
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
  const widthFeet = rangeInput.widthFeet == null ? undefined : nonNegativeNumber(rangeInput.widthFeet, `${prefix}.range.widthFeet`, problems)
  const heightFeet = rangeInput.heightFeet == null ? undefined : nonNegativeNumber(rangeInput.heightFeet, `${prefix}.range.heightFeet`, problems)
  const rotatable = rangeInput.rotatable == null
    ? undefined
    : booleanValue(rangeInput.rotatable, `${prefix}.range.rotatable`, problems)
  if (shape && shape !== 'rect' && (!sizeFeet || sizeFeet < 1)) problems.push(`${prefix}填写范围形状后必须填写大于 0 的 sizeFeet`)
  if (shape === 'rect' && ((!widthFeet || widthFeet < 1) || (!heightFeet || heightFeet < 1))) {
    problems.push(`${prefix}的长方形范围必须填写大于 0 的 widthFeet 和 heightFeet`)
  }
  if (shape !== 'rect' && (widthFeet != null || heightFeet != null || rotatable != null)) {
    problems.push(`${prefix}.range 的 widthFeet、heightFeet 与 rotatable 只适用于 rect`)
  }

  const targetingInput = value.targeting == null ? undefined : objectValue(value.targeting) ? value.targeting : undefined
  if (value.targeting != null && !targetingInput) problems.push(`${prefix}.targeting 必须是对象`)
  const targetRelation = targetingInput?.relation == null
    ? undefined
    : typeof targetingInput.relation === 'string' && ['any', 'ally', 'enemy'].includes(targetingInput.relation)
      ? targetingInput.relation as 'any' | 'ally' | 'enemy'
      : undefined
  if (targetingInput?.relation != null && !targetRelation) problems.push(`${prefix}.targeting.relation 无效`)
  const includeSelf = targetingInput?.includeSelf == null
    ? undefined
    : booleanValue(targetingInput.includeSelf, `${prefix}.targeting.includeSelf`, problems)
  const maximumTargets = targetingInput?.maximumTargets == null
    ? undefined
    : nonNegativeNumber(targetingInput.maximumTargets, `${prefix}.targeting.maximumTargets`, problems, true)
  if (maximumTargets != null && (maximumTargets < 1 || maximumTargets > 256)) {
    problems.push(`${prefix}.targeting.maximumTargets 必须是 1 到 256 之间的整数`)
  }

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
  const materialRequirement = parseMaterialRequirement(
    componentsInput.materialRequirement,
    `${prefix}.components.materialRequirement`,
    problems,
  )
  if (materialRequirement && !material) {
    problems.push(`${prefix}.components.materialRequirement 只能用于包含材料成分的法术`)
  }

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
        ...(widthFeet != null ? { widthFeet } : {}),
        ...(heightFeet != null ? { heightFeet } : {}),
        ...(rotatable != null ? { rotatable } : {}),
      },
      ...(targetingInput ? {
        targeting: {
          ...(targetRelation ? { relation: targetRelation } : {}),
          ...(includeSelf != null ? { includeSelf } : {}),
          ...(maximumTargets != null ? { maximumTargets } : {}),
        },
      } : {}),
      components: {
        verbal,
        somatic,
        material,
        ...(materialText ? { materialText } : {}),
        ...(materialCostGp != null ? { materialCostGp } : {}),
        ...(materialConsumed != null ? { materialConsumed } : {}),
        ...(materialRequirement ? { materialRequirement } : {}),
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
    const audited = !combat ? dnd5eAuditedCatalogSpellAutomation(catalog.id) : undefined
    const automation = audited ?? dnd5eCoreSpellAutomation(catalog.id, !!combat)
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
      headless: automation.automationLevel === 'full',
      ...automation,
      catalogOnly: audited?.catalogOnly ?? !combat,
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
  // Built-in audited SRD spells enrich the existing catalog entry; they must
  // not be appended again as room imports. A duplicate room entry sorts next
  // to the SRD entry and can win a later id map, silently promoting partial
  // spells to full automation in the player hotbar.
  const references: Dnd5eImportedSpell[] = pluginSpells
    .filter((spell) => !coreSpellIds.has(spell.id))
    .map((spell) => ({
      ...spell,
      automation: { mode: 'reference-only' },
    }))
  return dnd5eSpellbookEntries([...imported.filter((spell) => !pluginIds.has(spell.id)), ...references]).map((entry) => {
    const iconAssetId = iconAssets.get(entry.id)
    const withAutomation = automation.get(entry.id)?.mode === 'headless-action'
      ? entry.sourceKind === 'srd-core'
        // Preserve the SRD audit's full/partial/manual classification. The
        // active package only proves that the declared deterministic route is
        // installed; it does not erase environmental or semantic gaps.
        ? { ...entry, catalogOnly: false }
        : { ...entry, headless: true, automationLevel: 'full' as const, catalogOnly: false }
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
