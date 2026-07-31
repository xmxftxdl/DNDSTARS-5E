import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eClassId } from './classes'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import type { Dnd5eSpellbookSchoolId, Dnd5eSpellcastingClassId } from './spellbook'

export const DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION = 1 as const
export const DND5E_DECLARATIVE_PACKAGE_FORMAT = 'dndstars5e-declarative' as const

export type DeclarativeSubclassTriggerV1 =
  | { kind: 'active-use' }
  | { kind: 'before-attack-roll' }
  | { kind: 'after-attack-roll' }
  | { kind: 'after-attack-hit' }
  | { kind: 'after-attack-miss' }
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

export interface DeclarativeHostRollRecipeV1 {
  timing: 'on-trigger'
  die: {
    kind: 'resource-die'
    resourceId: string
  }
  /** Damage dice may be doubled when the parent weapon attack is critical. */
  critical?: 'normal' | 'double-dice'
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
  /** Requires a persisted option from this subclass's choice group. */
  subclassChoices?: readonly { groupId: string; optionId: string }[]
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
  | { id: string; kind: 'damage'; label: string; dice: DeclarativeDiceFormulaV1; damageType: Dnd5eDamageType | 'parent-weapon'; hostRoll?: DeclarativeHostRollRecipeV1 }
  | { id: string; kind: 'healing'; label: string; dice: DeclarativeDiceFormulaV1; hostRoll?: DeclarativeHostRollRecipeV1 }
  | { id: string; kind: 'attack'; label: string; ability: AbilityKey; proficiency: boolean }
  | { id: string; kind: 'saving-throw'; label: string; ability: AbilityKey; dc: DeclarativeValueFormulaV1 }

export type DeclarativeEffectTargetV1 = 'actor' | 'target' | 'all-targets'

export type DeclarativeSubclassEffectV1 =
  | { kind: 'damage'; target: DeclarativeEffectTargetV1; rollId: string }
  | { kind: 'healing'; target: DeclarativeEffectTargetV1; rollId: string }
  | {
      kind: 'temporary-hit-points'
      target: DeclarativeEffectTargetV1
      /** Exactly one of amount or rollId is required. */
      amount?: DeclarativeValueFormulaV1
      rollId?: string
    }
  | {
      kind: 'standard-condition'
      target: DeclarativeEffectTargetV1
      condition: Dnd5eStandardConditionId
      duration: DeclarativeSubclassDurationV1
    }
  | { kind: 'move'; target: DeclarativeEffectTargetV1; distanceFeet: number; mode?: 'push' | 'pull' | 'teleport' }
  | {
      kind: 'spend-resource' | 'restore-resource'
      resourceId: string
      amount: DeclarativeValueFormulaV1
      /** Restore only when the resource is currently empty. */
      whenEmpty?: boolean
    }

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

export const DND5E_2014_BATTLE_MASTER_MANEUVERS = [
  'commanders-strike',
  'disarming-attack',
  'distracting-strike',
  'evasive-footwork',
  'feinting-attack',
  'goading-attack',
  'lunging-attack',
  'maneuvering-attack',
  'menacing-attack',
  'parry',
  'precision-attack',
  'pushing-attack',
  'rally',
  'riposte',
  'sweeping-attack',
  'trip-attack',
] as const

export type Dnd5e2014BattleMasterManeuverId =
  typeof DND5E_2014_BATTLE_MASTER_MANEUVERS[number]

/**
 * A closed Host semantic. Imported JSON can select one audited 2014 maneuver
 * implementation, but cannot supply code or alter its settlement rules.
 */
export interface DeclarativeBattleMasterMechanicV1 {
  kind: 'battle-master-2014'
  maneuver: Dnd5e2014BattleMasterManeuverId
  resourceId: string
  superiorityRollId: string
}

export const DND5E_2014_ELDRITCH_KNIGHT_FEATURES = [
  'weapon-bond',
  'war-magic',
  'eldritch-strike',
  'arcane-charge',
  'improved-war-magic',
] as const

export type Dnd5e2014EldritchKnightFeatureId =
  typeof DND5E_2014_ELDRITCH_KNIGHT_FEATURES[number]

/**
 * Closed Host semantics for the 2014 Eldritch Knight. Imported JSON only
 * identifies the audited feature; executable behavior remains in Headless.
 */
export interface DeclarativeEldritchKnightMechanicV1 {
  kind: 'eldritch-knight-2014'
  feature: Dnd5e2014EldritchKnightFeatureId
}

export const DND5E_2014_TOTEM_WARRIOR_FEATURES = [
  'spirit-seeker',
  'totem-spirit-bear',
  'totem-spirit-eagle',
  'totem-spirit-wolf',
  'aspect-of-the-beast-bear',
  'aspect-of-the-beast-eagle',
  'aspect-of-the-beast-wolf',
  'spirit-walker',
  'totemic-attunement-bear',
  'totemic-attunement-eagle',
  'totemic-attunement-wolf',
] as const

export type Dnd5e2014TotemWarriorFeatureId =
  typeof DND5E_2014_TOTEM_WARRIOR_FEATURES[number]

/**
 * Closed Host semantics for the 2014 Totem Warrior. Local JSON chooses only
 * an audited feature identifier; all combat behavior remains in Headless.
 */
export interface DeclarativeTotemWarriorMechanicV1 {
  kind: 'totem-warrior-2014'
  feature: Dnd5e2014TotemWarriorFeatureId
}

/**
 * Generic opening-attack semantics. Local data may combine the independent
 * clauses, while the Host remains authoritative for turn order, surprise,
 * saving throws and damage settlement.
 */
export interface DeclarativeOpeningAttackMechanicV1 {
  kind: 'opening-attack'
  advantageBeforeTargetFirstTurn?: boolean
  automaticCriticalAgainstSurprised?: boolean
  surprisedHitSavingThrow?: {
    ability: AbilityKey
    dcAbility: AbilityKey
    failureDamageMultiplier: number
  }
}

/**
 * Generic passive spell pressure applied when a registered feature owner
 * starts a spell cast while hidden. The Host remains authoritative for the
 * hidden snapshot and every saving-throw mode in that cast transaction.
 */
export interface DeclarativeHiddenSpellSaveDisadvantageMechanicV1 {
  kind: 'hidden-spell-save-disadvantage'
}

/**
 * Generic control override for a movable, non-creature spell projection.
 * Imported data identifies the projection and an audited action economy;
 * position and movement remain Host-owned map state.
 */
export interface DeclarativeUtilityProjectionControlMechanicV1 {
  kind: 'utility-projection-control'
  projectionId: string
  economy: 'action' | 'bonusAction'
}

/**
 * Generic current-turn attack pressure against a creature near an owned
 * utility projection. Projection-to-creature distance is captured by the Host.
 */
export interface DeclarativeUtilityProjectionAttackAdvantageMechanicV1 {
  kind: 'utility-projection-attack-advantage'
  projectionId: string
  maximumDistanceFeet: number
}

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
  mechanic?:
    | DeclarativeBattleMasterMechanicV1
    | DeclarativeEldritchKnightMechanicV1
    | DeclarativeTotemWarriorMechanicV1
    | DeclarativeOpeningAttackMechanicV1
    | DeclarativeHiddenSpellSaveDisadvantageMechanicV1
    | DeclarativeUtilityProjectionControlMechanicV1
    | DeclarativeUtilityProjectionAttackAdvantageMechanicV1
  /**
   * Opens the post-result reaction window when an enemy succeeds on a d20.
   * This is only an eligibility declaration; the Host and DM still validate
   * ownership and the submitted replacement before settlement.
   */
  canModifyEnemyD20?: boolean
  automation: 'full' | 'partial' | 'manual'
}

export interface DeclarativeSubclassResourceV1 {
  id: string
  label: string
  minimumLevel?: number
  maximum: DeclarativeValueFormulaV1
  /** Later exact maxima. The last entry at or below class level wins. */
  maximumByClassLevel?: readonly { level: number; maximum: number }[]
  resetOn: 'combat' | 'short-rest' | 'long-rest'
  /** Optional display/mechanics metadata for resources such as superiority dice. */
  die?: DeclarativeSubclassResourceDieV1
}

export interface DeclarativeSubclassResourceDieV1 {
  sides: number
  sidesByClassLevel?: readonly { level: number; sides: number }[]
}

export interface DeclarativeSubclassChoiceGroupV1 {
  id: string
  level: number
  name: string
  description?: string
  /** Initial cumulative selection limit when this group becomes available. */
  maxSelections: number
  /** Later cumulative limits. The last entry at or below class level wins. */
  maxSelectionsByLevel?: readonly { level: number; maxSelections: number }[]
  options: readonly { id: string; name: string; summary: string }[]
}

/**
 * Pure metadata for subclass spellcasting. It never grants executable code:
 * the Host still validates selected spells against the registered spell catalog.
 */
export interface DeclarativeSubclassSpellcastingV1 {
  progression: 'one-third'
  learning: 'known'
  ability: AbilityKey
  spellListClassId: Dnd5eSpellcastingClassId
  cantripChoiceGroupId: string
  spellChoiceGroupId: string
  cantripsKnownByClassLevel: readonly number[]
  /** Cantrips granted by the subclass and counted against the known total. */
  requiredCantripIds?: readonly string[]
  spellsKnownByClassLevel: readonly number[]
  allowedSchools?: readonly Dnd5eSpellbookSchoolId[]
  unrestrictedSpellsKnownByClassLevel?: readonly number[]
  ritualCasting: boolean
  focus: string
}

export type DeclarativeSubclassCombatHookTimingV1 =
  | 'before-attack-roll'
  | 'after-attack-roll'
  | 'after-attack-hit'
  | 'after-attack-miss'
  | 'before-damage-taken'
  | 'after-damage-taken'
  | 'saving-throw'
  | 'ability-check'
  | 'movement'
  | 'rage-start'
  | 'spell-cast'
  | 'turn-start'
  | 'turn-end'

export type DeclarativeSubclassCombatHookActivationV1 =
  | 'automatic'
  | 'prearm'
  | 'interrupt'

export type DeclarativeSubclassCombatHookRetentionV1 =
  | 'single-attempt'
  | 'until-triggered'
  | 'until-turn-end'

export interface DeclarativeSubclassCombatHookV1 {
  id: string
  timing: DeclarativeSubclassCombatHookTimingV1
  abilityId: string
  decision: 'automatic' | 'actor-choice' | 'target-choice' | 'dm-confirm'
  /**
   * `prearm` is a player-owned intent selected before an attack. Older
   * declarations omit this field and retain the original decision-window
   * behavior.
   */
  activation?: DeclarativeSubclassCombatHookActivationV1
  /** Only meaningful for `prearm`; defaults to `single-attempt`. */
  retention?: DeclarativeSubclassCombatHookRetentionV1
  /** At most one armed intent from the same group may accompany an attack. */
  exclusiveGroup?: string
  oncePerTurn?: boolean
}

export interface DeclarativeSubclassDefinitionV1 {
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  id: string
  classId: Dnd5eClassId
  name: string
  summary: string
  resources?: readonly DeclarativeSubclassResourceV1[]
  choiceGroups?: readonly DeclarativeSubclassChoiceGroupV1[]
  spellcasting?: DeclarativeSubclassSpellcastingV1
  combatHooks?: readonly DeclarativeSubclassCombatHookV1[]
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
    manifestSchemaVersion?: 1
    minimumGameProtocolVersion?: number
    dependencies?: readonly import('./pluginApi').Dnd5ePluginDependency[]
    conflicts?: readonly string[]
    declaredCapabilities?: readonly import('./pluginApi').Dnd5ePluginDeclaredCapability[]
    distributionPolicy?: import('./pluginApi').Dnd5ePluginDistributionPolicy
    contentCategory?: import('./pluginApi').Dnd5ePluginContentCategory
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

export function declarativeSubclassChoiceLimitV1(
  group: DeclarativeSubclassChoiceGroupV1,
  classLevel: number,
): number {
  let maximum = group.maxSelections
  for (const step of group.maxSelectionsByLevel ?? []) {
    if (classLevel < step.level) break
    maximum = step.maxSelections
  }
  return Math.max(0, Math.min(group.options.length, Math.floor(maximum)))
}

export function declarativeSubclassResourceDieSidesV1(
  die: DeclarativeSubclassResourceDieV1,
  classLevel: number,
): number {
  let sides = die.sides
  for (const step of die.sidesByClassLevel ?? []) {
    if (classLevel < step.level) break
    sides = step.sides
  }
  return sides
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
const SPELLCASTING_CLASS_IDS = new Set<Dnd5eSpellcastingClassId>([
  'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
])
const SPELL_SCHOOLS = new Set<Dnd5eSpellbookSchoolId>([
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
])
const COMBAT_HOOK_TIMINGS = new Set<DeclarativeSubclassCombatHookTimingV1>([
  'before-attack-roll', 'after-attack-roll', 'after-attack-hit', 'after-attack-miss',
  'before-damage-taken', 'after-damage-taken', 'saving-throw', 'ability-check',
  'movement', 'rage-start', 'spell-cast', 'turn-start', 'turn-end',
])

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

function validateHostRollRecipe(
  value: unknown,
  label: string,
  allowCritical: boolean,
): asserts value is DeclarativeHostRollRecipeV1 {
  if (!record(value)) throw new Error(`${label} Host 掷骰配方无效`)
  assertKeys(value, ['timing', 'die', 'critical'], `${label} Host 掷骰配方`)
  if (value.timing !== 'on-trigger') throw new Error(`${label} Host 掷骰时机无效`)
  if (!record(value.die)) throw new Error(`${label} Host 掷骰来源无效`)
  assertKeys(value.die, ['kind', 'resourceId'], `${label} Host 掷骰来源`)
  if (value.die.kind !== 'resource-die') throw new Error(`${label} Host 掷骰来源无效`)
  assertId(value.die.resourceId, `${label} Host 掷骰资源`)
  if (value.critical != null && !['normal', 'double-dice'].includes(String(value.critical))) {
    throw new Error(`${label} Host 暴击骰策略无效`)
  }
  if (!allowCritical && value.critical === 'double-dice') {
    throw new Error(`${label} 非伤害骰不能声明暴击加骰`)
  }
}

export function validateDeclarativeSubclassAbilityV1(value: unknown, path = '能力'): asserts value is DeclarativeSubclassAbilityV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, ['schemaVersion', 'id', 'name', 'description', 'level', 'trigger', 'predicates', 'cost', 'targeting', 'rolls', 'effects', 'limits', 'duration', 'mechanic', 'canModifyEnemyD20', 'automation'], path)
  if (value.schemaVersion !== 1) throw new Error(`${path} schemaVersion 不受支持`)
  assertId(value.id, path)
  assertText(value.name, `${path}名称`, 160)
  assertText(value.description, `${path}说明`)
  if (!finiteInteger(value.level, 1, 20)) throw new Error(`${path}等级无效`)
  if (!record(value.trigger) || !['active-use', 'before-attack-roll', 'after-attack-roll', 'after-attack-hit', 'after-attack-miss', 'before-damage-taken', 'after-damage-taken', 'turn-start', 'turn-end', 'short-rest-complete', 'long-rest-complete'].includes(String(value.trigger.kind))) throw new Error(`${path}触发器无效`)
  assertKeys(value.trigger, ['kind'], `${path}触发器`)
  if (!AUTOMATION.has(String(value.automation))) throw new Error(`${path}自动化等级无效`)
  if (value.canModifyEnemyD20 != null && typeof value.canModifyEnemyD20 !== 'boolean') {
    throw new Error(`${path}敌方 d20 修改声明无效`)
  }
  if (value.mechanic != null) {
    if (!record(value.mechanic)) throw new Error(`${path}机械协议无效`)
    if (value.mechanic.kind === 'battle-master-2014') {
      assertKeys(value.mechanic, ['kind', 'maneuver', 'resourceId', 'superiorityRollId'], `${path}机械协议`)
      if (!DND5E_2014_BATTLE_MASTER_MANEUVERS.includes(
        value.mechanic.maneuver as Dnd5e2014BattleMasterManeuverId,
      )) throw new Error(`${path}战斗大师战技协议无效`)
      assertId(value.mechanic.resourceId, `${path}战技资源`)
      assertId(value.mechanic.superiorityRollId, `${path}卓越骰`)
    } else if (value.mechanic.kind === 'eldritch-knight-2014') {
      assertKeys(value.mechanic, ['kind', 'feature'], `${path}机械协议`)
      if (!DND5E_2014_ELDRITCH_KNIGHT_FEATURES.includes(
        value.mechanic.feature as Dnd5e2014EldritchKnightFeatureId,
      )) throw new Error(`${path}奥法骑士特性协议无效`)
    } else if (value.mechanic.kind === 'totem-warrior-2014') {
      assertKeys(value.mechanic, ['kind', 'feature'], `${path}机械协议`)
      if (!DND5E_2014_TOTEM_WARRIOR_FEATURES.includes(
        value.mechanic.feature as Dnd5e2014TotemWarriorFeatureId,
      )) throw new Error(`${path}图腾武者特性协议无效`)
    } else if (value.mechanic.kind === 'opening-attack') {
      assertKeys(
        value.mechanic,
        [
          'kind',
          'advantageBeforeTargetFirstTurn',
          'automaticCriticalAgainstSurprised',
          'surprisedHitSavingThrow',
        ],
        `${path} opening-attack mechanic`,
      )
      if (
        value.mechanic.advantageBeforeTargetFirstTurn != null &&
        typeof value.mechanic.advantageBeforeTargetFirstTurn !== 'boolean'
      ) throw new Error(`${path} opening-attack advantage declaration is invalid`)
      if (
        value.mechanic.automaticCriticalAgainstSurprised != null &&
        typeof value.mechanic.automaticCriticalAgainstSurprised !== 'boolean'
      ) throw new Error(`${path} opening-attack critical declaration is invalid`)
      if (value.mechanic.surprisedHitSavingThrow != null) {
        if (!record(value.mechanic.surprisedHitSavingThrow)) {
          throw new Error(`${path} opening-attack saving throw is invalid`)
        }
        assertKeys(
          value.mechanic.surprisedHitSavingThrow,
          ['ability', 'dcAbility', 'failureDamageMultiplier'],
          `${path} opening-attack saving throw`,
        )
        if (
          !ABILITIES.has(value.mechanic.surprisedHitSavingThrow.ability as AbilityKey) ||
          !ABILITIES.has(value.mechanic.surprisedHitSavingThrow.dcAbility as AbilityKey) ||
          !finiteInteger(
            value.mechanic.surprisedHitSavingThrow.failureDamageMultiplier,
            2,
            4,
          )
        ) throw new Error(`${path} opening-attack saving throw is invalid`)
      }
      if (
        value.mechanic.advantageBeforeTargetFirstTurn !== true &&
        value.mechanic.automaticCriticalAgainstSurprised !== true &&
        value.mechanic.surprisedHitSavingThrow == null
      ) throw new Error(`${path} opening-attack mechanic has no effect`)
    } else if (value.mechanic.kind === 'hidden-spell-save-disadvantage') {
      assertKeys(
        value.mechanic,
        ['kind'],
        `${path} hidden-spell-save-disadvantage mechanic`,
      )
    } else if (value.mechanic.kind === 'utility-projection-control') {
      assertKeys(
        value.mechanic,
        ['kind', 'projectionId', 'economy'],
        `${path} utility-projection-control mechanic`,
      )
      assertId(value.mechanic.projectionId, `${path} utility projection`)
      if (!['action', 'bonusAction'].includes(String(value.mechanic.economy))) {
        throw new Error(`${path} utility projection economy is invalid`)
      }
    } else if (value.mechanic.kind === 'utility-projection-attack-advantage') {
      assertKeys(
        value.mechanic,
        ['kind', 'projectionId', 'maximumDistanceFeet'],
        `${path} utility-projection-attack-advantage mechanic`,
      )
      assertId(value.mechanic.projectionId, `${path} utility projection`)
      if (!finiteInteger(value.mechanic.maximumDistanceFeet, 0, 10_000)) {
        throw new Error(`${path} utility projection distance is invalid`)
      }
    } else {
      throw new Error(`${path}机械协议无效`)
    }
  }

  if (value.predicates != null) {
    if (!record(value.predicates)) throw new Error(`${path}条件无效`)
    assertKeys(value.predicates, ['minimumLevel', 'classId', 'subclassId', 'equipmentIds', 'minimumDistanceFeet', 'maximumDistanceFeet', 'targetRelation', 'actorHasConditions', 'actorLacksConditions', 'targetHasConditions', 'targetLacksConditions', 'resources', 'subclassChoices', 'oncePerTurn'], `${path}条件`)
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
    if (predicates.subclassChoices != null) {
      if (!Array.isArray(predicates.subclassChoices) || predicates.subclassChoices.length > 16) {
        throw new Error(`${path}子职选择条件无效`)
      }
      const choices = new Set<string>()
      for (const choice of predicates.subclassChoices) {
        if (!record(choice)) throw new Error(`${path}子职选择条件无效`)
        assertKeys(choice, ['groupId', 'optionId'], `${path}子职选择条件`)
        assertId(choice.groupId, `${path}子职选择组`)
        assertId(choice.optionId, `${path}子职选择项`)
        const key = `${choice.groupId}/${choice.optionId}`
        if (choices.has(key)) throw new Error(`${path}子职选择条件重复`)
        choices.add(key)
      }
    }
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
        assertKeys(roll, ['id', 'kind', 'label', 'dice', 'damageType', 'hostRoll'], `${path}伤害骰`)
        validateDice(roll.dice, `${path}伤害骰`)
        if (roll.hostRoll != null) validateHostRollRecipe(roll.hostRoll, `${path}伤害骰`, true)
        if (roll.damageType !== 'parent-weapon' && !DAMAGE_TYPES.has(String(roll.damageType))) throw new Error(`${path}伤害类型无效`)
      } else if (roll.kind === 'healing') {
        assertKeys(roll, ['id', 'kind', 'label', 'dice', 'hostRoll'], `${path}治疗骰`)
        validateDice(roll.dice, `${path}治疗骰`)
        if (roll.hostRoll != null) validateHostRollRecipe(roll.hostRoll, `${path}治疗骰`, false)
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

  if (
    !Array.isArray(value.effects) ||
    (
      value.effects.length < 1 &&
      value.mechanic == null &&
      value.automation !== 'manual'
    ) ||
    value.effects.length > 64
  ) throw new Error(`${path}效果无效`)
  for (const effect of value.effects) validateEffect(effect, rollIds, `${path}效果`)
  if (
    value.mechanic?.kind === 'battle-master-2014' &&
    !rollIds.has(String(value.mechanic.superiorityRollId))
  ) {
    throw new Error(`${path}战技协议引用了未声明卓越骰`)
  }
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
    assertKeys(value, ['kind', 'target', 'amount', 'rollId'], label)
    if ((value.amount == null) === (value.rollId == null)) throw new Error(`${label}必须且只能声明 amount 或 rollId`)
    if (value.amount != null) validateFormula(value.amount, `${label}数值`)
    if (value.rollId != null && !rollIds.has(String(value.rollId))) throw new Error(`${label}引用了不存在的骰子`)
  } else if (value.kind === 'standard-condition') {
    assertKeys(value, ['kind', 'target', 'condition', 'duration'], label)
    if (!CONDITION_IDS.has(String(value.condition))) throw new Error(`${label}标准状态无效`)
    validateDuration(value.duration, `${label}持续时间`)
  } else if (value.kind === 'move') {
    assertKeys(value, ['kind', 'target', 'distanceFeet', 'mode'], label)
    if (!finiteInteger(value.distanceFeet, 0, 10_000) || (value.mode != null && !['push', 'pull', 'teleport'].includes(String(value.mode)))) throw new Error(`${label}移动无效`)
  } else if (value.kind === 'spend-resource' || value.kind === 'restore-resource') {
    assertKeys(value, ['kind', 'resourceId', 'amount', 'whenEmpty'], label)
    assertId(value.resourceId, label)
    validateFormula(value.amount, `${label}数值`)
    if (value.whenEmpty != null && (value.kind !== 'restore-resource' || typeof value.whenEmpty !== 'boolean')) {
      throw new Error(`${label}空资源恢复条件无效`)
    }
    return
  } else throw new Error(`${label}类型无效`)
  if (!['actor', 'target', 'all-targets'].includes(String(value.target))) throw new Error(`${label}目标无效`)
}

function validateLevelTable(
  value: unknown,
  label: string,
  entryValueKey: 'sides' | 'maxSelections' | 'maximum',
  valueMinimum: number,
  valueMaximum: number,
  minimumLevel = 1,
): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error(`${label}无效`)
  let previousLevel = 0
  for (const entry of value) {
    if (!record(entry)) throw new Error(`${label}条目无效`)
    assertKeys(entry, ['level', entryValueKey], `${label}条目`)
    if (
      !finiteInteger(entry.level, minimumLevel, 20) ||
      Number(entry.level) <= previousLevel ||
      !finiteInteger(entry[entryValueKey], valueMinimum, valueMaximum)
    ) throw new Error(`${label}条目无效`)
    previousLevel = Number(entry.level)
  }
}

function validateKnownCountTable(value: unknown, label: string): asserts value is readonly number[] {
  if (
    !Array.isArray(value) ||
    value.length !== 20 ||
    value.some((entry) => !finiteInteger(entry, 0, 100))
  ) throw new Error(`${label}必须包含 1–20 级的 20 个非负整数`)
  for (let index = 1; index < value.length; index += 1) {
    if (Number(value[index]) < Number(value[index - 1])) throw new Error(`${label}不能随等级降低`)
  }
}

function validateChoiceGroups(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${path}选择组列表无效`)
  const groupIds = new Set<string>()
  for (const group of value) {
    if (!record(group)) throw new Error(`${path}选择组无效`)
    assertKeys(group, ['id', 'level', 'name', 'description', 'maxSelections', 'maxSelectionsByLevel', 'options'], `${path}选择组`)
    assertId(group.id, `${path}选择组`)
    if (groupIds.has(group.id)) throw new Error(`${path}选择组 ID 重复`)
    groupIds.add(group.id)
    if (!finiteInteger(group.level, 1, 20) || !finiteInteger(group.maxSelections, 1, 64)) {
      throw new Error(`${path}选择组等级或上限无效`)
    }
    assertText(group.name, `${path}选择组名称`, 160)
    if (group.description != null && (typeof group.description !== 'string' || group.description.length > 4_000)) {
      throw new Error(`${path}选择组说明无效`)
    }
    if (!Array.isArray(group.options) || group.options.length < Number(group.maxSelections) || group.options.length > 128) {
      throw new Error(`${path}选择组选项无效`)
    }
    const optionIds = new Set<string>()
    for (const option of group.options) {
      if (!record(option)) throw new Error(`${path}选择组选项无效`)
      assertKeys(option, ['id', 'name', 'summary'], `${path}选择组选项`)
      assertId(option.id, `${path}选择组选项`)
      if (optionIds.has(option.id)) throw new Error(`${path}选择组选项 ID 重复`)
      optionIds.add(option.id)
      assertText(option.name, `${path}选择组选项名称`, 160)
      assertText(option.summary, `${path}选择组选项摘要`)
    }
    if (group.maxSelectionsByLevel != null) {
      validateLevelTable(group.maxSelectionsByLevel, `${path}选择组分级上限`, 'maxSelections', 1, 64, Number(group.level))
      let previousMaximum = Number(group.maxSelections)
      for (const step of group.maxSelectionsByLevel as Array<Record<string, unknown>>) {
        if (Number(step.maxSelections) < previousMaximum || Number(step.maxSelections) > group.options.length) {
          throw new Error(`${path}选择组分级上限必须累计递增且不超过选项数`)
        }
        previousMaximum = Number(step.maxSelections)
      }
    }
  }
}

export function validateDeclarativeSubclassSpellcastingV1(
  value: unknown,
  path = '子职施法',
): asserts value is DeclarativeSubclassSpellcastingV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, [
    'progression', 'learning', 'ability', 'spellListClassId',
    'cantripChoiceGroupId', 'spellChoiceGroupId',
    'cantripsKnownByClassLevel', 'spellsKnownByClassLevel',
    'requiredCantripIds',
    'allowedSchools', 'unrestrictedSpellsKnownByClassLevel',
    'ritualCasting', 'focus',
  ], path)
  if (value.progression !== 'one-third' || value.learning !== 'known') {
    throw new Error(`${path}目前仅支持 one-third + known`)
  }
  if (!ABILITIES.has(value.ability as AbilityKey)) throw new Error(`${path}施法属性无效`)
  if (!SPELLCASTING_CLASS_IDS.has(value.spellListClassId as Dnd5eSpellcastingClassId)) {
    throw new Error(`${path}法术表职业无效`)
  }
  assertId(value.cantripChoiceGroupId, `${path}戏法选择组`)
  assertId(value.spellChoiceGroupId, `${path}法术选择组`)
  if (value.cantripChoiceGroupId === value.spellChoiceGroupId) throw new Error(`${path}选择组 ID 不能相同`)
  validateKnownCountTable(value.cantripsKnownByClassLevel, `${path}戏法已知表`)
  validateKnownCountTable(value.spellsKnownByClassLevel, `${path}法术已知表`)
  if (value.requiredCantripIds != null) {
    if (
      !Array.isArray(value.requiredCantripIds) ||
      value.requiredCantripIds.length < 1 ||
      value.requiredCantripIds.length > 32 ||
      value.requiredCantripIds.some((id) => typeof id !== 'string' || !ID.test(id)) ||
      new Set(value.requiredCantripIds).size !== value.requiredCantripIds.length
    ) throw new Error(`${path}固定戏法无效`)
    const positiveKnownCounts = value.cantripsKnownByClassLevel
      .map(Number)
      .filter((count) => count > 0)
    if (
      positiveKnownCounts.length < 1 ||
      value.requiredCantripIds.length > Math.min(...positiveKnownCounts)
    ) throw new Error(`${path}固定戏法数不能超过已知戏法上限`)
  }
  if (value.allowedSchools != null) {
    if (
      !Array.isArray(value.allowedSchools) ||
      value.allowedSchools.length < 1 ||
      value.allowedSchools.length > SPELL_SCHOOLS.size ||
      value.allowedSchools.some((school) => !SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId)) ||
      new Set(value.allowedSchools).size !== value.allowedSchools.length
    ) throw new Error(`${path}学派限制无效`)
  }
  if (value.unrestrictedSpellsKnownByClassLevel != null) {
    validateKnownCountTable(value.unrestrictedSpellsKnownByClassLevel, `${path}不限学派已知表`)
    for (let index = 0; index < 20; index += 1) {
      if (Number(value.unrestrictedSpellsKnownByClassLevel[index]) > Number(value.spellsKnownByClassLevel[index])) {
        throw new Error(`${path}不限学派法术数不能超过总已知法术数`)
      }
    }
  }
  if (typeof value.ritualCasting !== 'boolean') throw new Error(`${path}仪式施法标记无效`)
  assertText(value.focus, `${path}法器`, 160)
}

export function validateDeclarativeSubclassDefinitionV1(value: unknown, path = '子职'): asserts value is DeclarativeSubclassDefinitionV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, [
    'schemaVersion', 'id', 'classId', 'name', 'summary',
    'resources', 'choiceGroups', 'spellcasting', 'combatHooks', 'abilities',
  ], path)
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
  const resourcesById = new Map<string, DeclarativeSubclassResourceV1>()
  if (value.resources != null) {
    if (!Array.isArray(value.resources) || value.resources.length > 64) throw new Error(`${path}资源列表无效`)
    for (const resource of value.resources) {
      if (!record(resource)) throw new Error(`${path}资源无效`)
      assertKeys(resource, ['id', 'label', 'minimumLevel', 'maximum', 'maximumByClassLevel', 'resetOn', 'die'], `${path}资源`)
      assertId(resource.id, `${path}资源`)
      if (resourceIds.has(resource.id)) throw new Error(`${path}资源 ID 重复`)
      resourceIds.add(resource.id)
      resourcesById.set(resource.id, resource as unknown as DeclarativeSubclassResourceV1)
      assertText(resource.label, `${path}资源名称`, 160)
      if (resource.minimumLevel != null && !finiteInteger(resource.minimumLevel, 1, 20)) throw new Error(`${path}资源等级无效`)
      validateFormula(resource.maximum, `${path}资源上限`)
      if (resource.maximumByClassLevel != null) {
        validateLevelTable(resource.maximumByClassLevel, `${path}资源上限成长表`, 'maximum', 0, 1_000_000)
        let previousMaximum = -1
        for (const step of resource.maximumByClassLevel as Array<Record<string, unknown>>) {
          if (Number(step.maximum) < previousMaximum) throw new Error(`${path}资源上限不能随等级降低`)
          previousMaximum = Number(step.maximum)
        }
      }
      if (!['combat', 'short-rest', 'long-rest'].includes(String(resource.resetOn))) throw new Error(`${path}资源恢复时点无效`)
      if (resource.die != null) {
        if (!record(resource.die)) throw new Error(`${path}资源骰无效`)
        assertKeys(resource.die, ['sides', 'sidesByClassLevel'], `${path}资源骰`)
        if (!finiteInteger(resource.die.sides, 2, 100)) throw new Error(`${path}资源骰面数无效`)
        if (resource.die.sidesByClassLevel != null) {
          validateLevelTable(resource.die.sidesByClassLevel, `${path}资源骰成长表`, 'sides', 2, 100)
          let previousSides = Number(resource.die.sides)
          for (const step of resource.die.sidesByClassLevel as Array<Record<string, unknown>>) {
            if (Number(step.sides) < previousSides) throw new Error(`${path}资源骰面数不能随等级降低`)
            previousSides = Number(step.sides)
          }
        }
      }
    }
  }
  if (value.choiceGroups != null) validateChoiceGroups(value.choiceGroups, path)
  const choiceOptionsByGroupId = new Map<string, ReadonlySet<string>>(
    (value.choiceGroups as DeclarativeSubclassChoiceGroupV1[] | undefined)?.map((group) => [
      group.id,
      new Set(group.options.map((option) => option.id)),
    ]) ?? [],
  )
  if (value.spellcasting != null) validateDeclarativeSubclassSpellcastingV1(value.spellcasting, `${path}施法`)
  if (value.combatHooks != null) {
    if (!Array.isArray(value.combatHooks) || value.combatHooks.length > 128) throw new Error(`${path}战斗钩子列表无效`)
    const hookIds = new Set<string>()
    for (const hook of value.combatHooks) {
      if (!record(hook)) throw new Error(`${path}战斗钩子无效`)
      assertKeys(
        hook,
        ['id', 'timing', 'abilityId', 'decision', 'activation', 'retention', 'exclusiveGroup', 'oncePerTurn'],
        `${path}战斗钩子`,
      )
      assertId(hook.id, `${path}战斗钩子`)
      if (hookIds.has(hook.id)) throw new Error(`${path}战斗钩子 ID 重复`)
      hookIds.add(hook.id)
      if (!COMBAT_HOOK_TIMINGS.has(hook.timing as DeclarativeSubclassCombatHookTimingV1)) {
        throw new Error(`${path}战斗钩子时点无效`)
      }
      assertId(hook.abilityId, `${path}战斗钩子能力`)
      if (!abilityIds.has(hook.abilityId)) throw new Error(`${path}战斗钩子引用了未声明能力：${hook.abilityId}`)
      if (!['automatic', 'actor-choice', 'target-choice', 'dm-confirm'].includes(String(hook.decision))) {
        throw new Error(`${path}战斗钩子决策模式无效`)
      }
      if (
        hook.activation != null &&
        !['automatic', 'prearm', 'interrupt'].includes(String(hook.activation))
      ) {
        throw new Error(`${path}战斗钩子激活模式无效`)
      }
      if (
        hook.retention != null &&
        !['single-attempt', 'until-triggered', 'until-turn-end'].includes(String(hook.retention))
      ) {
        throw new Error(`${path}战斗钩子保留策略无效`)
      }
      const activation = hook.activation ??
        (hook.decision === 'automatic' ? 'automatic' : 'interrupt')
      if (activation === 'prearm') {
        if (hook.decision !== 'actor-choice') {
          throw new Error(`${path}预激活战斗钩子必须由行动者决定`)
        }
        if (!['before-attack-roll', 'after-attack-roll', 'after-attack-hit'].includes(String(hook.timing))) {
          throw new Error(`${path}预激活战斗钩子必须绑定攻击检定时点`)
        }
      } else if (hook.retention != null) {
        throw new Error(`${path}只有预激活战斗钩子可以声明保留策略`)
      }
      if (hook.exclusiveGroup != null) {
        assertId(hook.exclusiveGroup, `${path}战斗钩子互斥组`)
        if (activation !== 'prearm') throw new Error(`${path}只有预激活战斗钩子可以声明互斥组`)
      }
      if (activation === 'automatic' && hook.decision !== 'automatic') {
        throw new Error(`${path}自动战斗钩子必须使用 automatic 决策模式`)
      }
      if (hook.oncePerTurn != null && typeof hook.oncePerTurn !== 'boolean') throw new Error(`${path}战斗钩子回合限制无效`)
    }
  }
  for (const ability of value.abilities as DeclarativeSubclassAbilityV1[]) {
    for (const choice of ability.predicates?.subclassChoices ?? []) {
      const options = choiceOptionsByGroupId.get(choice.groupId)
      if (!options?.has(choice.optionId)) {
        throw new Error(`${path}能力 ${ability.id} 引用了未声明子职选择：${choice.groupId}/${choice.optionId}`)
      }
    }
    const referenced = [
      ...(ability.predicates?.resources ?? []).map((entry) => entry.resourceId),
      ...(ability.cost?.resources ?? []).map((entry) => entry.resourceId),
      ...(ability.rolls ?? []).flatMap((roll) =>
        (roll.kind === 'damage' || roll.kind === 'healing') && roll.hostRoll
          ? [roll.hostRoll.die.resourceId]
          : []
      ),
      ...(ability.mechanic?.kind === 'battle-master-2014' ? [ability.mechanic.resourceId] : []),
      ...ability.effects.flatMap((effect) => effect.kind === 'spend-resource' || effect.kind === 'restore-resource' ? [effect.resourceId] : []),
    ]
    const missing = referenced.find((resourceId) => !resourceIds.has(resourceId))
    if (missing) throw new Error(`${path}能力 ${ability.id} 引用了未声明资源：${missing}`)
    for (const roll of ability.rolls ?? []) {
      if (
        roll.kind === 'damage' &&
        roll.damageType === 'parent-weapon' &&
        (
          !roll.hostRoll ||
          (
            ability.trigger.kind !== 'after-attack-hit' &&
            ability.mechanic?.kind !== 'battle-master-2014'
          )
        )
      ) {
        throw new Error(`${path}能力 ${ability.id} 只有命中后 Host 掷骰可以继承武器伤害类型`)
      }
      if ((roll.kind !== 'damage' && roll.kind !== 'healing') || !roll.hostRoll) continue
      const resourceId = roll.hostRoll.die.resourceId
      const resource = resourcesById.get(resourceId)
      if (!resource?.die) throw new Error(`${path}能力 ${ability.id} 的 Host 掷骰资源没有声明资源骰：${resourceId}`)
      if (roll.dice.count < 1) throw new Error(`${path}能力 ${ability.id} 的 Host 掷骰数量必须大于零`)
      const maximumDiceCount = roll.dice.count +
        (roll.dice.scaling?.steps.reduce((total, step) => total + step.addDice, 0) ?? 0)
      if (maximumDiceCount > 12) {
        throw new Error(`${path}能力 ${ability.id} 的 Host 单项掷骰数量不能超过 12`)
      }
      if (roll.dice.sides !== resource.die.sides) {
        throw new Error(`${path}能力 ${ability.id} 的 Host 掷骰基础骰面必须匹配资源骰：${resourceId}`)
      }
      if (!ability.cost?.resources?.some((cost) => cost.resourceId === resourceId && cost.amount > 0)) {
        throw new Error(`${path}能力 ${ability.id} 必须声明消耗 Host 掷骰资源：${resourceId}`)
      }
    }
  }
}

export function declarativeAbilityCompatibilityV1(ability: DeclarativeSubclassAbilityV1): DeclarativeAbilityCompatibilityEntryV1 {
  const reasons: string[] = []
  const auditedBattleMaster = ability.mechanic?.kind === 'battle-master-2014'
  const auditedEldritchKnight = ability.mechanic?.kind === 'eldritch-knight-2014'
  const auditedTotemWarrior = ability.mechanic?.kind === 'totem-warrior-2014'
  const auditedOpeningAttack = ability.mechanic?.kind === 'opening-attack'
  const auditedHiddenSpellSave =
    ability.mechanic?.kind === 'hidden-spell-save-disadvantage'
  const auditedUtilityProjection =
    ability.mechanic?.kind === 'utility-projection-control' ||
    ability.mechanic?.kind === 'utility-projection-attack-advantage'
  const auditedMechanic = auditedBattleMaster || auditedEldritchKnight ||
    auditedTotemWarrior || auditedOpeningAttack || auditedHiddenSpellSave ||
    auditedUtilityProjection
  if (ability.canModifyEnemyD20) {
    reasons.push('改变敌方 d20 需要玩家声明并由 DM 在投掷后 Interrupt 窗口确认')
  }
  if (!auditedMechanic && ability.effects.some((effect) =>
    effect.kind === 'temporary-hit-points' &&
    effect.amount?.kind === 'fixed' &&
    effect.amount.value === 0
  )) reasons.push('旧 feature/action 未提供结构化效果，需由 DM 补全后才能自动结算')
  if (ability.predicates?.equipmentIds?.length) reasons.push('战斗快照尚未暴露可验证的装备实例 ID')
  if (!auditedMechanic && (ability.cost?.movementFeet ?? 0) > 0) reasons.push('移动消耗尚未接入通用特性事务')
  if (ability.limits?.uses && (!ability.limits.reset || ability.limits.reset === 'none')) reasons.push('有限次数必须声明战斗、短休或长休恢复时点')
  if (ability.targeting.kind === 'multiple-creatures') reasons.push('任意多目标选择尚无通用地图选择器')
  if (!auditedMechanic && ability.rolls?.some((roll) => roll.kind === 'attack')) reasons.push('声明式能力攻击检定尚需通用攻击事务')
  if (!auditedMechanic && ability.rolls?.some((roll) => roll.kind === 'saving-throw')) reasons.push('声明式能力目标豁免尚需批量豁免事务')
  if (ability.rolls?.some((roll) =>
    (roll.kind === 'damage' || roll.kind === 'healing') &&
    roll.dice.scaling &&
    !roll.hostRoll
  )) reasons.push('动态增加骰数尚需按角色快照生成 Host 掷骰配方')
  if (!auditedMechanic && ability.effects.some((effect) => effect.kind === 'move')) reasons.push('强制移动需要地图三维路径与碰撞事务')
  if (ability.duration?.kind === 'concentration' || ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'concentration')) reasons.push('声明式专注来源尚未开放安全绑定')
  if (ability.duration?.kind === 'permanent' || ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'permanent')) reasons.push('永久效果必须由 DM 审核并写入长期角色数据')
  if (ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'until-source-turn-end')) reasons.push('来源回合结束边界尚未开放为插件状态 capability')
  if (
    ability.duration &&
    ability.duration.kind !== 'instantaneous' &&
    ability.mechanic?.kind !== 'utility-projection-attack-advantage'
  ) reasons.push('能力级持续时间尚未绑定具体状态或区域实例')

  const safeTurnStartResourceRestore = ability.trigger.kind === 'turn-start' &&
    (ability.cost?.economy ?? 'none') === 'none' &&
    !(ability.rolls?.length) &&
    ability.effects.length > 0 &&
    ability.effects.every((effect) => effect.kind === 'restore-resource')
  if (
    !auditedMechanic &&
    !safeTurnStartResourceRestore &&
    ability.trigger.kind !== 'active-use' &&
    ability.trigger.kind !== 'after-attack-hit'
  ) {
    reasons.push('该触发时点已保留协议，但尚未接入权威事件调度器')
  }
  if (ability.trigger.kind === 'after-attack-hit') {
    if ((ability.cost?.economy ?? 'none') !== 'none') reasons.push('命中后需要选择是否消耗行动经济，必须经过 Interrupt')
    if (ability.rolls?.some((roll) =>
      (roll.kind === 'damage' || roll.kind === 'healing') &&
      roll.dice.count > 0 &&
      !roll.hostRoll
    )) reasons.push('命中后追加骰需要预先声明的 Interrupt 掷骰事务')
  }
  const executableEffects = auditedMechanic || ability.effects.some((effect) => effect.kind !== 'move')
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
  const abilities = subclasses.flatMap((subclass) => {
    const hooksByAbility = new Map<string, DeclarativeSubclassCombatHookV1[]>()
    for (const hook of subclass.combatHooks ?? []) {
      hooksByAbility.set(hook.abilityId, [...(hooksByAbility.get(hook.abilityId) ?? []), hook])
    }
    return subclass.abilities.map((ability) => {
      const entry = declarativeAbilityCompatibilityV1(ability)
      const reasons = [...entry.reasons]
      const abilityHooks = hooksByAbility.get(ability.id) ?? []
      const hasHostRollRecipe = ability.rolls?.some((roll) =>
        (roll.kind === 'damage' || roll.kind === 'healing') && roll.hostRoll != null
      ) === true
      const hasSupportedPrearmHook = abilityHooks.some((hook) =>
        ['before-attack-roll', 'after-attack-roll', 'after-attack-hit'].includes(hook.timing) &&
        (hook.activation ?? (hook.decision === 'automatic' ? 'automatic' : 'interrupt')) === 'prearm' &&
        hook.decision === 'actor-choice' &&
        (
          ability.trigger.kind === 'after-attack-hit' ||
          ability.mechanic?.kind === 'battle-master-2014'
        )
      )
      if (
        hasHostRollRecipe &&
        ability.mechanic?.kind !== 'battle-master-2014' &&
        ability.trigger.kind !== 'active-use' &&
        !hasSupportedPrearmHook
      ) {
        reasons.push('Host 掷骰配方当前只支持主动能力或绑定到 actor-choice 的命中后预激活钩子')
      }
      for (const hook of abilityHooks) {
        const auditedEldritchKnightHook =
          ability.mechanic?.kind === 'eldritch-knight-2014' &&
          hook.activation === 'automatic' &&
          hook.decision === 'automatic' &&
          (
            (ability.mechanic.feature === 'eldritch-strike' && hook.timing === 'after-attack-hit') ||
            (
              (ability.mechanic.feature === 'war-magic' ||
                ability.mechanic.feature === 'improved-war-magic') &&
              hook.timing === 'spell-cast'
            )
          )
        const auditedTotemWarriorHook =
          ability.mechanic?.kind === 'totem-warrior-2014' &&
          hook.activation === 'automatic' &&
          hook.decision === 'automatic'
        const directlyExecutable = auditedEldritchKnightHook || auditedTotemWarriorHook ||
          (
            hook.timing === 'after-attack-hit' ||
            (
              ability.mechanic?.kind === 'battle-master-2014' &&
              ['before-attack-roll', 'after-attack-roll'].includes(hook.timing)
            )
          ) &&
          (
            (hook.activation == null && hook.decision === 'automatic') ||
            hook.activation === 'automatic' ||
            (hook.activation === 'prearm' && hook.decision === 'actor-choice')
          ) &&
          (
            ability.trigger.kind === 'after-attack-hit' ||
            ability.mechanic?.kind === 'battle-master-2014'
          )
        if (!directlyExecutable) {
          reasons.push(`战斗钩子 ${hook.id}（${hook.timing}/${hook.decision}）已注册，但尚未接入权威事件决策窗口`)
        }
      }
      return {
        ...entry,
        effective: entry.effective === 'full' && reasons.length > 0 ? 'partial' as const : entry.effective,
        reasons,
      }
    })
  })
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
  assertKeys(parsed.manifest, [
    'id', 'name', 'version', 'publisher', 'license', 'description', 'apiVersion', 'rulesetId',
    'stateSchemaVersion', 'manifestSchemaVersion', 'minimumGameProtocolVersion', 'dependencies',
    'conflicts', 'declaredCapabilities', 'distributionPolicy', 'contentCategory',
  ], '规则包清单')
  assertId(parsed.manifest.id, '规则包清单')
  for (const key of ['name', 'version', 'publisher', 'license'] as const) assertText(parsed.manifest[key], `规则包${key}`, 200)
  if (parsed.manifest.description != null && typeof parsed.manifest.description !== 'string') throw new Error('规则包说明无效')
  if (parsed.manifest.apiVersion !== 2 || parsed.manifest.rulesetId !== 'dnd5e-2014-srd-5.1') throw new Error('规则包 API 或 Ruleset 不兼容')
  if (parsed.manifest.stateSchemaVersion != null && !finiteInteger(parsed.manifest.stateSchemaVersion, 1, 1_000)) throw new Error('规则包状态版本无效')
  if (parsed.manifest.manifestSchemaVersion != null && parsed.manifest.manifestSchemaVersion !== 1) throw new Error('规则包清单版本无效')
  if (parsed.manifest.minimumGameProtocolVersion != null && !finiteInteger(parsed.manifest.minimumGameProtocolVersion, 1, 10_000)) throw new Error('规则包最低游戏协议无效')
  const manifestId = parsed.manifest.id
  if (parsed.manifest.dependencies != null && (
    !Array.isArray(parsed.manifest.dependencies) || parsed.manifest.dependencies.length > 32 ||
    parsed.manifest.dependencies.some((dependency) =>
      !record(dependency) || !ID.test(String(dependency.id ?? '')) ||
      dependency.id === manifestId ||
      typeof dependency.versionRange !== 'string' || dependency.versionRange.length < 1 ||
      dependency.versionRange.length > 120 ||
      (dependency.optional != null && typeof dependency.optional !== 'boolean'))
  )) throw new Error('规则包依赖声明无效')
  if (parsed.manifest.conflicts != null && (
    !Array.isArray(parsed.manifest.conflicts) || parsed.manifest.conflicts.length > 32 ||
    parsed.manifest.conflicts.some((pluginId) =>
      typeof pluginId !== 'string' || !ID.test(pluginId) || pluginId === manifestId)
  )) throw new Error('规则包冲突声明无效')
  const declaredCapabilities = new Set([
    'damage', 'healing', 'temporary-hit-points', 'standard-condition', 'movement',
    'resource', 'summon', 'persistent-area', 'spell-transaction', 'interrupt',
  ])
  if (parsed.manifest.declaredCapabilities != null && (
    !Array.isArray(parsed.manifest.declaredCapabilities) ||
    parsed.manifest.declaredCapabilities.length > declaredCapabilities.size ||
    parsed.manifest.declaredCapabilities.some((capability) =>
      typeof capability !== 'string' || !declaredCapabilities.has(capability))
  )) throw new Error('规则包 capability 声明无效')
  if (parsed.manifest.distributionPolicy != null && ![
    'room-distributable', 'room-ephemeral', 'account-entitled', 'local-only',
  ].includes(String(parsed.manifest.distributionPolicy))) throw new Error('规则包分发策略无效')
  if (parsed.manifest.contentCategory != null && ![
    'rules', 'subclasses', 'spells', 'items', 'monsters', 'adventure', 'mixed',
  ].includes(String(parsed.manifest.contentCategory))) throw new Error('规则包内容分类无效')
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
