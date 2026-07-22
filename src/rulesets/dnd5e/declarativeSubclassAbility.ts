import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eClassId } from './classes'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'

export const DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION = 1 as const
export const DND5E_DECLARATIVE_PACKAGE_FORMAT = 'dndstars5e-declarative' as const

export type DeclarativeSubclassTriggerV1 =
  | { kind: 'active-use' }
  | { kind: 'after-attack-hit' }
  | { kind: 'before-damage-taken' }
  | { kind: 'after-damage-taken' }
  | { kind: 'turn-start' }
  | { kind: 'turn-end' }
  | { kind: 'short-rest-complete' }
  | { kind: 'long-rest-complete' }

export type DeclarativeValueFormulaV1 =
  | { kind: 'fixed'; value: number }
  | { kind: 'proficiency-bonus'; multiplier?: number; minimum?: number }
  | { kind: 'ability-modifier'; ability: AbilityKey; multiplier?: number; minimum?: number }
  | { kind: 'class-level'; classId: Dnd5eClassId; divisor?: number; multiplier?: number; minimum?: number }

export interface DeclarativeDiceFormulaV1 {
  count: number
  sides: number
  modifier?: DeclarativeValueFormulaV1
  scaling?: {
    basis: 'character-level' | 'class-level'
    classId?: Dnd5eClassId
    steps: readonly { level: number; addDice: number }[]
  }
}

export interface DeclarativeSubclassPredicatesV1 {
  minimumLevel?: number
  classId?: Dnd5eClassId
  subclassId?: string
  equipmentIds?: readonly string[]
  minimumDistanceFeet?: number
  maximumDistanceFeet?: number
  targetRelation?: 'self' | 'ally' | 'enemy' | 'any'
  actorHasConditions?: readonly Dnd5eStandardConditionId[]
  actorLacksConditions?: readonly Dnd5eStandardConditionId[]
  targetHasConditions?: readonly Dnd5eStandardConditionId[]
  targetLacksConditions?: readonly Dnd5eStandardConditionId[]
  resources?: readonly { resourceId: string; minimum: number }[]
  oncePerTurn?: boolean
}

export interface DeclarativeSubclassCostV1 {
  economy?: 'action' | 'bonusAction' | 'reaction' | 'none'
  movementFeet?: number
  resources?: readonly { resourceId: string; amount: number }[]
  uses?: number
}

export type DeclarativeSubclassTargetingV1 =
  | { kind: 'self' }
  | {
      kind: 'single-creature'
      relation?: 'ally' | 'enemy' | 'any'
      rangeFeet?: number
      includeSelf?: boolean
    }
  | {
      kind: 'multiple-creatures'
      relation?: 'ally' | 'enemy' | 'any'
      rangeFeet?: number
      maximumTargets: number
      includeSelf?: boolean
    }
  | {
      kind: 'area'
      relation?: 'ally' | 'enemy' | 'any'
      includeSelf?: boolean
      maximumTargets?: number
      shape: 'circle' | 'cone' | 'line' | 'rect'
      rangeFeet: number
      radiusFeet?: number
      lengthFeet?: number
      widthFeet?: number
      heightFeet?: number
    }

export type DeclarativeSubclassRollV1 =
  | { id: string; kind: 'damage'; label: string; dice: DeclarativeDiceFormulaV1; damageType: Dnd5eDamageType }
  | { id: string; kind: 'healing'; label: string; dice: DeclarativeDiceFormulaV1 }
  | { id: string; kind: 'attack'; label: string; ability: AbilityKey; proficiency: boolean }
  | { id: string; kind: 'saving-throw'; label: string; ability: AbilityKey; dc: DeclarativeValueFormulaV1 }

export type DeclarativeEffectTargetV1 = 'actor' | 'target' | 'all-targets'

export type DeclarativeSubclassEffectV1 =
  | { kind: 'damage'; target: DeclarativeEffectTargetV1; rollId: string }
  | { kind: 'healing'; target: DeclarativeEffectTargetV1; rollId: string }
  | { kind: 'temporary-hit-points'; target: DeclarativeEffectTargetV1; amount: DeclarativeValueFormulaV1 }
  | {
      kind: 'standard-condition'
      target: DeclarativeEffectTargetV1
      condition: Dnd5eStandardConditionId
      duration: DeclarativeSubclassDurationV1
    }
  | { kind: 'move'; target: DeclarativeEffectTargetV1; distanceFeet: number; mode?: 'push' | 'pull' | 'teleport' }
  | { kind: 'spend-resource' | 'restore-resource'; resourceId: string; amount: DeclarativeValueFormulaV1 }

export interface DeclarativeSubclassLimitsV1 {
  oncePerTurn?: boolean
  reset?: 'combat' | 'short-rest' | 'long-rest' | 'none'
  uses?: DeclarativeValueFormulaV1
}

export type DeclarativeSubclassDurationV1 =
  | { kind: 'instantaneous' }
  | { kind: 'until-source-turn-start' }
  | { kind: 'until-source-turn-end' }
  | { kind: 'until-target-turn-start' }
  | { kind: 'until-target-turn-end'; rounds?: number }
  | { kind: 'fixed-rounds'; rounds: number; repeatSave?: { ability: AbilityKey; dc: number } }
  | { kind: 'concentration'; rounds: number }
  | { kind: 'permanent' }

/**
 * Pure-data subclass ability protocol. Imported packages never supply a resolver;
 * the Host compiles supported declarations into its whitelisted Headless executor.
 */
export interface DeclarativeSubclassAbilityV1 {
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  id: string
  name: string
  description: string
  level: number
  trigger: DeclarativeSubclassTriggerV1
  predicates?: DeclarativeSubclassPredicatesV1
  cost?: DeclarativeSubclassCostV1
  targeting: DeclarativeSubclassTargetingV1
  rolls?: readonly DeclarativeSubclassRollV1[]
  effects: readonly DeclarativeSubclassEffectV1[]
  limits?: DeclarativeSubclassLimitsV1
  duration?: DeclarativeSubclassDurationV1
  automation: 'full' | 'partial' | 'manual'
}

export interface DeclarativeSubclassResourceV1 {
  id: string
  label: string
  minimumLevel?: number
  maximum: DeclarativeValueFormulaV1
  resetOn: 'combat' | 'short-rest' | 'long-rest'
}

export interface DeclarativeSubclassDefinitionV1 {
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  id: string
  classId: Dnd5eClassId
  name: string
  summary: string
  resources?: readonly DeclarativeSubclassResourceV1[]
  abilities: readonly DeclarativeSubclassAbilityV1[]
}

export interface Dnd5eDeclarativeRulesPackageV1 {
  format: typeof DND5E_DECLARATIVE_PACKAGE_FORMAT
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  manifest: {
    id: string
    name: string
    version: string
    publisher: string
    license: string
    description?: string
    apiVersion: 2
    rulesetId: 'dnd5e-2014-srd-5.1'
    stateSchemaVersion?: number
  }
  subclasses: readonly DeclarativeSubclassDefinitionV1[]
  /** Existing data-only builder contributions. They are validated by their v2 validators. */
  legacy?: unknown
}

export interface DeclarativeAbilityCompatibilityEntryV1 {
  abilityId: string
  requested: DeclarativeSubclassAbilityV1['automation']
  effective: DeclarativeSubclassAbilityV1['automation']
  reasons: readonly string[]
}

export interface DeclarativeAbilityCompatibilityReportV1 {
  full: number
  partial: number
  manual: number
  abilities: readonly DeclarativeAbilityCompatibilityEntryV1[]
}

const ID = /^[a-z0-9][a-z0-9._-]{0,99}$/
const CLASS_IDS = new Set<Dnd5eClassId>([
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
])
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const AUTOMATION = new Set(['full', 'partial', 'manual'])
const CONDITION_IDS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)
const DAMAGE_TYPES = new Set<string>(DND5E_DAMAGE_TYPES)

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const permit = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !permit.has(key))
  if (unknown) throw new Error(`${label} 包含不支持的字段：${unknown}`)
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${label} ID 无效`)
}

function assertText(value: unknown, label: string, maximum = 4_000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} 无效`)
}

function validateFormula(value: unknown, label: string): asserts value is DeclarativeValueFormulaV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}公式无效`)
  assertKeys(value, value.kind === 'fixed'
    ? ['kind', 'value']
    : value.kind === 'ability-modifier'
      ? ['kind', 'ability', 'multiplier', 'minimum']
      : value.kind === 'class-level'
        ? ['kind', 'classId', 'divisor', 'multiplier', 'minimum']
        : ['kind', 'multiplier', 'minimum'], label)
  if (value.kind === 'fixed') {
    if (!finiteInteger(value.value, -1_000_000, 1_000_000)) throw new Error(`${label}固定值无效`)
    return
  }
  if (value.kind !== 'proficiency-bonus' && value.kind !== 'ability-modifier' && value.kind !== 'class-level') {
    throw new Error(`${label}公式类型无效`)
  }
  if (value.multiplier != null && !finiteInteger(value.multiplier, -100, 100)) throw new Error(`${label}倍率无效`)
  if (value.minimum != null && !finiteInteger(value.minimum, -1_000_000, 1_000_000)) throw new Error(`${label}最小值无效`)
  if (value.kind === 'ability-modifier' && !ABILITIES.has(value.ability as AbilityKey)) throw new Error(`${label}属性无效`)
  if (value.kind === 'class-level') {
    if (!CLASS_IDS.has(value.classId as Dnd5eClassId)) throw new Error(`${label}职业无效`)
    if (value.divisor != null && !finiteInteger(value.divisor, 1, 20)) throw new Error(`${label}除数无效`)
  }
}

function validateDuration(value: unknown, label: string): asserts value is DeclarativeSubclassDurationV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}持续时间无效`)
  const timed = value.kind === 'fixed-rounds' || value.kind === 'concentration'
  assertKeys(value, value.kind === 'fixed-rounds' ? ['kind', 'rounds', 'repeatSave'] : timed || value.kind === 'until-target-turn-end' ? ['kind', 'rounds'] : ['kind'], label)
  if (!['instantaneous', 'until-source-turn-start', 'until-source-turn-end', 'until-target-turn-start', 'until-target-turn-end', 'fixed-rounds', 'concentration', 'permanent'].includes(value.kind)) {
    throw new Error(`${label}持续时间类型无效`)
  }
  if ((timed || value.rounds != null) && !finiteInteger(value.rounds, 1, 14_400)) throw new Error(`${label}轮数无效`)
  if (value.repeatSave != null) {
    if (!record(value.repeatSave)) throw new Error(`${label}重复豁免无效`)
    assertKeys(value.repeatSave, ['ability', 'dc'], `${label}重复豁免`)
    if (!ABILITIES.has(value.repeatSave.ability as AbilityKey) || !finiteInteger(value.repeatSave.dc, 1, 40)) {
      throw new Error(`${label}重复豁免无效`)
    }
  }
}

function validateDice(value: unknown, label: string): asserts value is DeclarativeDiceFormulaV1 {
  if (!record(value)) throw new Error(`${label}骰子无效`)
  assertKeys(value, ['count', 'sides', 'modifier', 'scaling'], label)
  if (!finiteInteger(value.count, 0, 40) || !finiteInteger(value.sides, 2, 100)) throw new Error(`${label}骰子无效`)
  if (value.modifier != null) validateFormula(value.modifier, `${label}调整值`)
  if (value.scaling != null) {
    if (!record(value.scaling)) throw new Error(`${label}缩放无效`)
    assertKeys(value.scaling, ['basis', 'classId', 'steps'], `${label}缩放`)
    if (value.scaling.basis !== 'character-level' && value.scaling.basis !== 'class-level') throw new Error(`${label}缩放依据无效`)
    if (value.scaling.basis === 'class-level' && !CLASS_IDS.has(value.scaling.classId as Dnd5eClassId)) throw new Error(`${label}缩放职业无效`)
    if (!Array.isArray(value.scaling.steps) || value.scaling.steps.length > 20) throw new Error(`${label}缩放表无效`)
    for (const step of value.scaling.steps) {
      if (!record(step)) throw new Error(`${label}缩放项无效`)
      assertKeys(step, ['level', 'addDice'], `${label}缩放项`)
      if (!finiteInteger(step.level, 1, 20) || !finiteInteger(step.addDice, 0, 40)) throw new Error(`${label}缩放项无效`)
    }
  }
}

export function validateDeclarativeSubclassAbilityV1(value: unknown, path = '能力'): asserts value is DeclarativeSubclassAbilityV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, ['schemaVersion', 'id', 'name', 'description', 'level', 'trigger', 'predicates', 'cost', 'targeting', 'rolls', 'effects', 'limits', 'duration', 'automation'], path)
  if (value.schemaVersion !== 1) throw new Error(`${path} schemaVersion 不受支持`)
  assertId(value.id, path)
  assertText(value.name, `${path}名称`, 160)
  assertText(value.description, `${path}说明`)
  if (!finiteInteger(value.level, 1, 20)) throw new Error(`${path}等级无效`)
  if (!record(value.trigger) || !['active-use', 'after-attack-hit', 'before-damage-taken', 'after-damage-taken', 'turn-start', 'turn-end', 'short-rest-complete', 'long-rest-complete'].includes(String(value.trigger.kind))) throw new Error(`${path}触发器无效`)
  assertKeys(value.trigger, ['kind'], `${path}触发器`)
  if (!AUTOMATION.has(String(value.automation))) throw new Error(`${path}自动化等级无效`)

  if (value.predicates != null) {
    if (!record(value.predicates)) throw new Error(`${path}条件无效`)
    assertKeys(value.predicates, ['minimumLevel', 'classId', 'subclassId', 'equipmentIds', 'minimumDistanceFeet', 'maximumDistanceFeet', 'targetRelation', 'actorHasConditions', 'actorLacksConditions', 'targetHasConditions', 'targetLacksConditions', 'resources', 'oncePerTurn'], `${path}条件`)
    const predicates = value.predicates
    if (predicates.minimumLevel != null && !finiteInteger(predicates.minimumLevel, 1, 20)) throw new Error(`${path}最低等级无效`)
    if (predicates.classId != null && !CLASS_IDS.has(predicates.classId as Dnd5eClassId)) throw new Error(`${path}职业条件无效`)
    if (predicates.subclassId != null) assertId(predicates.subclassId, `${path}子职条件`)
    if (predicates.minimumDistanceFeet != null && !finiteInteger(predicates.minimumDistanceFeet, 0, 10_000)) throw new Error(`${path}最小距离无效`)
    if (predicates.maximumDistanceFeet != null && !finiteInteger(predicates.maximumDistanceFeet, 0, 10_000)) throw new Error(`${path}最大距离无效`)
    if (predicates.targetRelation != null && !['self', 'ally', 'enemy', 'any'].includes(String(predicates.targetRelation))) throw new Error(`${path}目标关系无效`)
    if (predicates.equipmentIds != null && (!Array.isArray(predicates.equipmentIds) || predicates.equipmentIds.some((id) => typeof id !== 'string' || !ID.test(id)))) throw new Error(`${path}装备条件无效`)
    for (const key of ['actorHasConditions', 'actorLacksConditions', 'targetHasConditions', 'targetLacksConditions'] as const) {
      const conditions = predicates[key]
      if (conditions != null && (!Array.isArray(conditions) || conditions.some((condition) => !CONDITION_IDS.has(String(condition))))) throw new Error(`${path}状态条件无效`)
    }
    if (predicates.resources != null) validateResourceAmounts(predicates.resources, `${path}资源条件`, 'minimum')
  }

  if (value.cost != null) {
    if (!record(value.cost)) throw new Error(`${path}消耗无效`)
    assertKeys(value.cost, ['economy', 'movementFeet', 'resources', 'uses'], `${path}消耗`)
    if (value.cost.economy != null && !['action', 'bonusAction', 'reaction', 'none'].includes(String(value.cost.economy))) throw new Error(`${path}行动消耗无效`)
    if (value.cost.movementFeet != null && !finiteInteger(value.cost.movementFeet, 0, 1_000)) throw new Error(`${path}移动消耗无效`)
    if (value.cost.uses != null && !finiteInteger(value.cost.uses, 1, 1_000_000)) throw new Error(`${path}次数消耗无效`)
    if (value.cost.resources != null) validateResourceAmounts(value.cost.resources, `${path}资源消耗`, 'amount')
    if (value.cost.uses != null && (!record(value.limits) || value.limits.uses == null || value.limits.reset == null || value.limits.reset === 'none')) {
      throw new Error(`${path}声明次数消耗时必须提供可恢复的次数公式`)
    }
  }

  validateTargeting(value.targeting, `${path}目标`)
  const rollIds = new Set<string>()
  if (value.rolls != null) {
    if (!Array.isArray(value.rolls) || value.rolls.length > 32) throw new Error(`${path}骰子声明无效`)
    for (const roll of value.rolls) {
      if (!record(roll)) throw new Error(`${path}骰子声明无效`)
      assertId(roll.id, `${path}骰子`)
      if (rollIds.has(roll.id)) throw new Error(`${path}骰子 ID 重复`)
      rollIds.add(roll.id)
      assertText(roll.label, `${path}骰子名称`, 160)
      if (roll.kind === 'damage') {
        assertKeys(roll, ['id', 'kind', 'label', 'dice', 'damageType'], `${path}伤害骰`)
        validateDice(roll.dice, `${path}伤害骰`)
        if (!DAMAGE_TYPES.has(String(roll.damageType))) throw new Error(`${path}伤害类型无效`)
      } else if (roll.kind === 'healing') {
        assertKeys(roll, ['id', 'kind', 'label', 'dice'], `${path}治疗骰`)
        validateDice(roll.dice, `${path}治疗骰`)
      } else if (roll.kind === 'attack') {
        assertKeys(roll, ['id', 'kind', 'label', 'ability', 'proficiency'], `${path}攻击骰`)
        if (!ABILITIES.has(roll.ability as AbilityKey) || typeof roll.proficiency !== 'boolean') throw new Error(`${path}攻击骰无效`)
      } else if (roll.kind === 'saving-throw') {
        assertKeys(roll, ['id', 'kind', 'label', 'ability', 'dc'], `${path}豁免`)
        if (!ABILITIES.has(roll.ability as AbilityKey)) throw new Error(`${path}豁免属性无效`)
        validateFormula(roll.dc, `${path}豁免 DC`)
      } else throw new Error(`${path}骰子类型无效`)
    }
  }

  if (!Array.isArray(value.effects) || value.effects.length < 1 || value.effects.length > 64) throw new Error(`${path}效果无效`)
  for (const effect of value.effects) validateEffect(effect, rollIds, `${path}效果`)
  if (value.limits != null) {
    if (!record(value.limits)) throw new Error(`${path}次数限制无效`)
    assertKeys(value.limits, ['oncePerTurn', 'reset', 'uses'], `${path}次数限制`)
    if (value.limits.oncePerTurn != null && typeof value.limits.oncePerTurn !== 'boolean') throw new Error(`${path}每回合限制无效`)
    if (value.limits.reset != null && !['combat', 'short-rest', 'long-rest', 'none'].includes(String(value.limits.reset))) throw new Error(`${path}恢复时点无效`)
    if (value.limits.uses != null) validateFormula(value.limits.uses, `${path}次数公式`)
  }
  if (value.duration != null) validateDuration(value.duration, `${path}持续时间`)
}

function validateResourceAmounts(value: unknown, label: string, amountKey: 'minimum' | 'amount'): void {
  if (!Array.isArray(value) || value.length > 32) throw new Error(`${label}无效`)
  for (const entry of value) {
    if (!record(entry)) throw new Error(`${label}无效`)
    assertKeys(entry, ['resourceId', amountKey], label)
    assertId(entry.resourceId, label)
    if (!finiteInteger(entry[amountKey], 1, 1_000_000)) throw new Error(`${label}数量无效`)
  }
}

function validateTargeting(value: unknown, label: string): asserts value is DeclarativeSubclassTargetingV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}无效`)
  if (value.kind === 'self') {
    assertKeys(value, ['kind'], label)
    return
  }
  if (value.kind === 'single-creature') assertKeys(value, ['kind', 'relation', 'rangeFeet', 'includeSelf'], label)
  else if (value.kind === 'multiple-creatures') assertKeys(value, ['kind', 'relation', 'rangeFeet', 'maximumTargets', 'includeSelf'], label)
  else if (value.kind === 'area') assertKeys(value, ['kind', 'relation', 'includeSelf', 'maximumTargets', 'shape', 'rangeFeet', 'radiusFeet', 'lengthFeet', 'widthFeet', 'heightFeet'], label)
  else throw new Error(`${label}类型无效`)
  if (value.relation != null && !['ally', 'enemy', 'any'].includes(String(value.relation))) throw new Error(`${label}关系无效`)
  if (value.includeSelf != null && typeof value.includeSelf !== 'boolean') throw new Error(`${label}自身选项无效`)
  if (value.rangeFeet != null && !finiteInteger(value.rangeFeet, 0, 10_000)) throw new Error(`${label}距离无效`)
  if (value.maximumTargets != null && !finiteInteger(value.maximumTargets, 1, 256)) throw new Error(`${label}数量无效`)
  if (value.kind === 'area') {
    if (!['circle', 'cone', 'line', 'rect'].includes(String(value.shape))) throw new Error(`${label}范围形状无效`)
    for (const key of ['radiusFeet', 'lengthFeet', 'widthFeet', 'heightFeet'] as const) {
      if (value[key] != null && !finiteInteger(value[key], 1, 10_000)) throw new Error(`${label}范围尺寸无效`)
    }
  }
}

function validateEffect(value: unknown, rollIds: ReadonlySet<string>, label: string): asserts value is DeclarativeSubclassEffectV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}无效`)
  if (value.kind === 'damage' || value.kind === 'healing') {
    assertKeys(value, ['kind', 'target', 'rollId'], label)
    if (!rollIds.has(String(value.rollId))) throw new Error(`${label}引用了不存在的骰子`)
  } else if (value.kind === 'temporary-hit-points') {
    assertKeys(value, ['kind', 'target', 'amount'], label)
    validateFormula(value.amount, `${label}数值`)
  } else if (value.kind === 'standard-condition') {
    assertKeys(value, ['kind', 'target', 'condition', 'duration'], label)
    if (!CONDITION_IDS.has(String(value.condition))) throw new Error(`${label}标准状态无效`)
    validateDuration(value.duration, `${label}持续时间`)
  } else if (value.kind === 'move') {
    assertKeys(value, ['kind', 'target', 'distanceFeet', 'mode'], label)
    if (!finiteInteger(value.distanceFeet, 0, 10_000) || (value.mode != null && !['push', 'pull', 'teleport'].includes(String(value.mode)))) throw new Error(`${label}移动无效`)
  } else if (value.kind === 'spend-resource' || value.kind === 'restore-resource') {
    assertKeys(value, ['kind', 'resourceId', 'amount'], label)
    assertId(value.resourceId, label)
    validateFormula(value.amount, `${label}数值`)
    return
  } else throw new Error(`${label}类型无效`)
  if (!['actor', 'target', 'all-targets'].includes(String(value.target))) throw new Error(`${label}目标无效`)
}

export function validateDeclarativeSubclassDefinitionV1(value: unknown, path = '子职'): asserts value is DeclarativeSubclassDefinitionV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, ['schemaVersion', 'id', 'classId', 'name', 'summary', 'resources', 'abilities'], path)
  if (value.schemaVersion !== 1) throw new Error(`${path} schemaVersion 不受支持`)
  assertId(value.id, path)
  if (!CLASS_IDS.has(value.classId as Dnd5eClassId)) throw new Error(`${path}所属职业无效`)
  assertText(value.name, `${path}名称`, 160)
  assertText(value.summary, `${path}摘要`)
  if (!Array.isArray(value.abilities) || value.abilities.length < 1 || value.abilities.length > 128) throw new Error(`${path}能力列表无效`)
  const abilityIds = new Set<string>()
  for (const ability of value.abilities as DeclarativeSubclassAbilityV1[]) {
    validateDeclarativeSubclassAbilityV1(ability, `${path}能力`)
    if (abilityIds.has(ability.id)) throw new Error(`${path}能力 ID 重复`)
    abilityIds.add(ability.id)
  }
  const resourceIds = new Set<string>()
  if (value.resources != null) {
    if (!Array.isArray(value.resources) || value.resources.length > 64) throw new Error(`${path}资源列表无效`)
    for (const resource of value.resources) {
      if (!record(resource)) throw new Error(`${path}资源无效`)
      assertKeys(resource, ['id', 'label', 'minimumLevel', 'maximum', 'resetOn'], `${path}资源`)
      assertId(resource.id, `${path}资源`)
      if (resourceIds.has(resource.id)) throw new Error(`${path}资源 ID 重复`)
      resourceIds.add(resource.id)
      assertText(resource.label, `${path}资源名称`, 160)
      if (resource.minimumLevel != null && !finiteInteger(resource.minimumLevel, 1, 20)) throw new Error(`${path}资源等级无效`)
      validateFormula(resource.maximum, `${path}资源上限`)
      if (!['combat', 'short-rest', 'long-rest'].includes(String(resource.resetOn))) throw new Error(`${path}资源恢复时点无效`)
    }
  }
  for (const ability of value.abilities as DeclarativeSubclassAbilityV1[]) {
    const referenced = [
      ...(ability.predicates?.resources ?? []).map((entry) => entry.resourceId),
      ...(ability.cost?.resources ?? []).map((entry) => entry.resourceId),
      ...ability.effects.flatMap((effect) => effect.kind === 'spend-resource' || effect.kind === 'restore-resource' ? [effect.resourceId] : []),
    ]
    const missing = referenced.find((resourceId) => !resourceIds.has(resourceId))
    if (missing) throw new Error(`${path}能力 ${ability.id} 引用了未声明资源：${missing}`)
  }
}

export function declarativeAbilityCompatibilityV1(ability: DeclarativeSubclassAbilityV1): DeclarativeAbilityCompatibilityEntryV1 {
  const reasons: string[] = []
  if (ability.effects.some((effect) =>
    effect.kind === 'temporary-hit-points' && effect.amount.kind === 'fixed' && effect.amount.value === 0
  )) reasons.push('旧 feature/action 未提供结构化效果，需由 DM 补全后才能自动结算')
  if (ability.predicates?.equipmentIds?.length) reasons.push('战斗快照尚未暴露可验证的装备实例 ID')
  if ((ability.cost?.movementFeet ?? 0) > 0) reasons.push('移动消耗尚未接入通用特性事务')
  if (ability.limits?.uses && (!ability.limits.reset || ability.limits.reset === 'none')) reasons.push('有限次数必须声明战斗、短休或长休恢复时点')
  if (ability.targeting.kind === 'multiple-creatures') reasons.push('任意多目标选择尚无通用地图选择器')
  if (ability.rolls?.some((roll) => roll.kind === 'attack')) reasons.push('声明式能力攻击检定尚需通用攻击事务')
  if (ability.rolls?.some((roll) => roll.kind === 'saving-throw')) reasons.push('声明式能力目标豁免尚需批量豁免事务')
  if (ability.rolls?.some((roll) => (roll.kind === 'damage' || roll.kind === 'healing') && roll.dice.scaling)) reasons.push('动态增加骰数尚需按角色快照生成 Host 掷骰配方')
  if (ability.effects.some((effect) => effect.kind === 'move')) reasons.push('强制移动需要地图三维路径与碰撞事务')
  if (ability.duration?.kind === 'concentration' || ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'concentration')) reasons.push('声明式专注来源尚未开放安全绑定')
  if (ability.duration?.kind === 'permanent' || ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'permanent')) reasons.push('永久效果必须由 DM 审核并写入长期角色数据')
  if (ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'until-source-turn-end')) reasons.push('来源回合结束边界尚未开放为插件状态 capability')
  if (ability.duration && ability.duration.kind !== 'instantaneous') reasons.push('能力级持续时间尚未绑定具体状态或区域实例')

  if (ability.trigger.kind !== 'active-use' && ability.trigger.kind !== 'after-attack-hit') {
    reasons.push('该触发时点已保留协议，但尚未接入权威事件调度器')
  }
  if (ability.trigger.kind === 'after-attack-hit') {
    if ((ability.cost?.economy ?? 'none') !== 'none') reasons.push('命中后需要选择是否消耗行动经济，必须经过 Interrupt')
    if (ability.rolls?.some((roll) => (roll.kind === 'damage' || roll.kind === 'healing') && roll.dice.count > 0)) reasons.push('命中后追加骰需要预先声明的 Interrupt 掷骰事务')
  }
  const executableEffects = ability.effects.some((effect) => effect.kind !== 'move')
  if (ability.automation === 'partial' && reasons.length === 0) reasons.push('作者要求在执行安全子集前由 DM 确认')
  if (ability.automation === 'manual' && reasons.length === 0) reasons.push('作者将该能力标记为仅供 DM 手动裁定')
  let effective: DeclarativeSubclassAbilityV1['automation']
  if (ability.automation === 'manual') effective = 'manual'
  else if (!executableEffects) effective = 'manual'
  else if (reasons.length > 0 || ability.automation === 'partial') effective = 'partial'
  else effective = 'full'
  return { abilityId: ability.id, requested: ability.automation, effective, reasons }
}

export function declarativeSubclassCompatibilityReportV1(
  subclasses: readonly DeclarativeSubclassDefinitionV1[],
): DeclarativeAbilityCompatibilityReportV1 {
  const abilities = subclasses.flatMap((subclass) => subclass.abilities.map(declarativeAbilityCompatibilityV1))
  return {
    full: abilities.filter((entry) => entry.effective === 'full').length,
    partial: abilities.filter((entry) => entry.effective === 'partial').length,
    manual: abilities.filter((entry) => entry.effective === 'manual').length,
    abilities,
  }
}

export function parseDnd5eDeclarativeRulesPackageV1(bytes: ArrayBuffer): Dnd5eDeclarativeRulesPackageV1 | null {
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('规则包不是有效的 UTF-8 文件')
  }
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('{')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(source) as unknown
  } catch {
    throw new Error('声明式规则包必须是纯 JSON；禁止 JavaScript、eval 和 Function')
  }
  if (!record(parsed) || parsed.format !== DND5E_DECLARATIVE_PACKAGE_FORMAT) {
    throw new Error('JSON 规则包缺少受支持的声明式格式标识')
  }
  assertKeys(parsed, ['format', 'schemaVersion', 'manifest', 'subclasses', 'legacy'], '规则包')
  if (parsed.schemaVersion !== 1) throw new Error('声明式规则包 schemaVersion 不受支持')
  if (!record(parsed.manifest)) throw new Error('声明式规则包清单无效')
  assertKeys(parsed.manifest, ['id', 'name', 'version', 'publisher', 'license', 'description', 'apiVersion', 'rulesetId', 'stateSchemaVersion'], '规则包清单')
  assertId(parsed.manifest.id, '规则包清单')
  for (const key of ['name', 'version', 'publisher', 'license'] as const) assertText(parsed.manifest[key], `规则包${key}`, 200)
  if (parsed.manifest.description != null && typeof parsed.manifest.description !== 'string') throw new Error('规则包说明无效')
  if (parsed.manifest.apiVersion !== 2 || parsed.manifest.rulesetId !== 'dnd5e-2014-srd-5.1') throw new Error('规则包 API 或 Ruleset 不兼容')
  if (parsed.manifest.stateSchemaVersion != null && !finiteInteger(parsed.manifest.stateSchemaVersion, 1, 1_000)) throw new Error('规则包状态版本无效')
  if (!Array.isArray(parsed.subclasses) || parsed.subclasses.length > 64) throw new Error('声明式子职列表无效')
  const subclassIds = new Set<string>()
  for (const subclass of parsed.subclasses) {
    validateDeclarativeSubclassDefinitionV1(subclass)
    if (subclassIds.has(subclass.id)) throw new Error('声明式子职 ID 重复')
    subclassIds.add(subclass.id)
  }
  return parsed as unknown as Dnd5eDeclarativeRulesPackageV1
}

/** Converts the existing feature/action data model into V1 without inventing unsupported semantics. */
export function migrateLegacyFeatureActionToDeclarativeV1(input: {
  id: string
  name: string
  description: string
  level?: number
  automation?: 'full' | 'partial' | 'manual'
  action?: {
    economy?: 'action' | 'bonusAction' | 'reaction' | 'none'
    targeting?: DeclarativeSubclassTargetingV1
  }
}): DeclarativeSubclassAbilityV1 {
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    description: input.description,
    level: Math.max(1, Math.min(20, Math.floor(input.level ?? 1))),
    trigger: { kind: 'active-use' },
    cost: { economy: input.action?.economy ?? 'none' },
    targeting: input.action?.targeting ?? { kind: 'self' },
    effects: [{ kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'fixed', value: 0 } }],
    automation: input.action ? 'partial' : 'manual',
  }
}
