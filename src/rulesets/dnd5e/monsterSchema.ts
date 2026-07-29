import {
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { DND5E_DAMAGE_TYPES } from './damageTypes'
import { DND5E_STANDARD_CONDITION_IDS } from './conditions'
import { isDnd5eConditionalDamageDefense } from './damageDefenses'

export interface Dnd5eMonsterSchemaIssue {
  monsterId: string
  actionId?: string
  code:
    | 'invalid-stat-block'
    | 'duplicate-monster-id'
    | 'duplicate-monster-slug'
    | 'duplicate-action-id'
    | 'invalid-weapon-attack'
    | 'unstructured-on-hit-rule'
    | 'invalid-multiattack-sequence'
    | 'unsupported-action-kind'
  message: string
}

export type Dnd5eMonsterActionAutomation = 'headless' | 'dm-adjudication' | 'invalid'

const SIZE_VALUES = new Set(['微型', '小型', '中型', '大型', '超大型', '巨型'])
const DAMAGE_TYPE_VALUES = new Set<string>(DND5E_DAMAGE_TYPES)
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ACTION_KINDS = new Set(['weapon-attack', 'multiattack', 'other'])
const ATTACK_MODES = new Set(['melee', 'ranged', 'melee-or-ranged'])
const TARGET_PRIORITIES = new Set(['nearest', 'lowest-current-hp', 'lowest-hp-percentage', 'lowest-armor-class', 'highest-threat'])
const MECHANIC_LIMITS = new Set(['once-per-turn', 'once-per-combat', 'unlimited'])
const MECHANIC_EVENTS = new Set([
  'turn-start', 'turn-end', 'after-hit', 'after-miss', 'when-hit', 'after-dealt-damage', 'after-damaged',
  'saving-throw-magic', 'saving-throw-physical', 'movement', 'phase-transition',
])
const MECHANIC_AUTOMATION = new Set(['full', 'partial', 'manual'])
const MECHANIC_TARGETS = new Set(['self', 'trigger-target', 'damage-source', 'selected-subject'])
const MECHANIC_SUBJECTS = new Set(['self', 'ally-within', 'hostile-within'])
const STANDARD_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)
const ID_PATTERN = /^(?:srd-5\.1|room-monster):[a-z0-9][a-z0-9-]{0,95}$/
const DICE_PATTERN = /^\d+d\d+(?:\s*[+\-−]\s*\d+)?$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function finiteInteger(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
}

function requiredText(value: unknown, max = 20_000): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function issue(monsterId: string, message: string, actionId?: string): Dnd5eMonsterSchemaIssue {
  return { monsterId, actionId, code: 'invalid-stat-block', message }
}

function validateDamage(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  return finiteInteger(raw.average, 0, 1_000_000) &&
    finiteInteger(raw.count, 0, 1_000) &&
    finiteInteger(raw.sides, 2, 1_000_000) &&
    finiteInteger(raw.bonus, -1_000_000, 1_000_000) &&
    typeof raw.type === 'string' && DAMAGE_TYPE_VALUES.has(raw.type)
}

function validateDamageList(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length >= 1 && raw.length <= 16 && raw.every(validateDamage)
}

function failedSaveConditionIsValid(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  const allowedKeys = new Set([
    'condition',
    'durationRounds',
    'repeatSaveAtEndOfTargetTurn',
    'breakOnDamage',
  ])
  return Object.keys(raw).every((key) => allowedKeys.has(key)) &&
    STANDARD_CONDITIONS.has(String(raw.condition)) &&
    finiteInteger(raw.durationRounds, 1, 10_000) &&
    typeof raw.repeatSaveAtEndOfTargetTurn === 'boolean' &&
    (raw.breakOnDamage == null || typeof raw.breakOnDamage === 'boolean')
}

function zeroHitPointOutcomeIsValid(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  if (
    !Object.keys(raw).every((key) => key === 'stabilize' || key === 'conditions') ||
    raw.stabilize !== true ||
    !Array.isArray(raw.conditions) ||
    raw.conditions.length < 1 ||
    raw.conditions.length > 8
  ) return false
  const conditions = raw.conditions
  const conditionIds = new Set<string>()
  for (const entry of conditions) {
    if (
      !isRecord(entry) ||
      !Object.keys(entry).every((key) =>
        key === 'condition' || key === 'durationRounds' || key === 'dependsOnCondition') ||
      !STANDARD_CONDITIONS.has(String(entry.condition)) ||
      !finiteInteger(entry.durationRounds, 1, 10_000) ||
      (entry.dependsOnCondition != null &&
        !STANDARD_CONDITIONS.has(String(entry.dependsOnCondition))) ||
      conditionIds.has(String(entry.condition))
    ) return false
    conditionIds.add(String(entry.condition))
  }
  const dependenciesAreValid = conditions.every((entry) =>
    !isRecord(entry) ||
    entry.dependsOnCondition == null ||
    (
      entry.dependsOnCondition !== entry.condition &&
      conditionIds.has(String(entry.dependsOnCondition))
    ))
  if (!dependenciesAreValid) return false

  const dependencyByCondition = new Map<string, string>()
  for (const entry of conditions) {
    if (isRecord(entry) && entry.dependsOnCondition != null) {
      dependencyByCondition.set(
        String(entry.condition),
        String(entry.dependsOnCondition),
      )
    }
  }
  for (const condition of conditionIds) {
    const dependencyPath = new Set<string>()
    let current: string | undefined = condition
    while (current != null) {
      if (dependencyPath.has(current)) return false
      dependencyPath.add(current)
      current = dependencyByCondition.get(current)
    }
  }
  return true
}

function sourceLinkedConditionEffectIsValid(raw: Record<string, unknown>): boolean {
  const allowedKeys = new Set(['id', 'kind', 'relation', 'escapeDc', 'conditions'])
  if (
    !Object.keys(raw).every((key) => allowedKeys.has(key)) ||
    raw.kind !== 'source-linked-condition' ||
    !isRecord(raw.relation) ||
    !finiteInteger(raw.escapeDc, 1, 100) ||
    !Array.isArray(raw.conditions) ||
    raw.conditions.length < 1 ||
    raw.conditions.length > 2
  ) return false

  const relation = raw.relation
  const allowedRelationKeys = new Set([
    'kind',
    'slotGroup',
    'capacity',
    'maxDistanceFeet',
    'targetMaxSizeRank',
    'whenCapacityFull',
    'attackAdvantageAgainstLinkedTarget',
  ])
  if (
    !Object.keys(relation).every((key) => allowedRelationKeys.has(key)) ||
    relation.kind !== 'grapple' ||
    !requiredText(relation.slotGroup, 96) ||
    !/^[a-z][a-z0-9-]*$/.test(String(relation.slotGroup)) ||
    !finiteInteger(relation.capacity, 1, 20) ||
    !finiteInteger(relation.maxDistanceFeet, 1, 1_000) ||
    !finiteInteger(relation.targetMaxSizeRank, 0, 5) ||
    (
      relation.whenCapacityFull !== 'skip-application' &&
      relation.whenCapacityFull !== 'linked-target-only'
    ) ||
    (
      relation.attackAdvantageAgainstLinkedTarget != null &&
      typeof relation.attackAdvantageAgainstLinkedTarget !== 'boolean'
    )
  ) return false

  const conditionIds = new Set<string>()
  const dependencyByCondition = new Map<string, string>()
  for (const condition of raw.conditions) {
    if (!isRecord(condition)) return false
    const allowedConditionKeys = new Set(['condition', 'dependsOnCondition'])
    if (
      !Object.keys(condition).every((key) => allowedConditionKeys.has(key)) ||
      (condition.condition !== 'grappled' && condition.condition !== 'restrained') ||
      (
        condition.dependsOnCondition != null &&
        condition.dependsOnCondition !== 'grappled' &&
        condition.dependsOnCondition !== 'restrained'
      ) ||
      conditionIds.has(String(condition.condition))
    ) return false
    conditionIds.add(String(condition.condition))
    if (condition.dependsOnCondition != null) {
      dependencyByCondition.set(
        String(condition.condition),
        String(condition.dependsOnCondition),
      )
    }
  }

  // A source-linked grapple always has one independent grappled root. Any
  // additional condition must form an acyclic chain rooted in that grapple.
  if (!conditionIds.has('grappled') || dependencyByCondition.has('grappled')) return false
  for (const [condition, dependency] of dependencyByCondition) {
    if (condition === dependency || !conditionIds.has(dependency)) return false
  }
  for (const condition of conditionIds) {
    const dependencyPath = new Set<string>()
    let current: string | undefined = condition
    while (current != null) {
      if (dependencyPath.has(current)) return false
      dependencyPath.add(current)
      current = dependencyByCondition.get(current)
    }
    if (!dependencyPath.has('grappled')) return false
  }
  return conditionIds.size === 1 ||
    dependencyByCondition.get('restrained') === 'grappled'
}

function onHitEffectIsValid(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  if (
    !requiredText(raw.id, 96) ||
    !/^[a-z][a-z0-9-]*$/.test(String(raw.id))
  ) return false
  if (raw.kind === 'source-linked-condition') {
    return sourceLinkedConditionEffectIsValid(raw)
  }
  if (raw.kind === 'saving-throw-condition') {
    const allowedKeys = new Set([
      'id',
      'kind',
      'ability',
      'dc',
      'conditionOnFailedSave',
    ])
    return Object.keys(raw).every((key) => allowedKeys.has(key)) &&
      ABILITY_KEYS.includes(raw.ability as typeof ABILITY_KEYS[number]) &&
      finiteInteger(raw.dc, 1, 100) &&
      failedSaveConditionIsValid(raw.conditionOnFailedSave)
  }
  const allowedKeys = new Set([
    'id',
    'kind',
    'ability',
    'dc',
    'damage',
    'damageOnSuccessfulSave',
    'conditionOnFailedSave',
    'onEffectDamageReducesTargetToZero',
  ])
  return Object.keys(raw).every((key) => allowedKeys.has(key)) &&
    raw.kind === 'saving-throw-damage' &&
    ABILITY_KEYS.includes(raw.ability as typeof ABILITY_KEYS[number]) &&
    finiteInteger(raw.dc, 1, 100) &&
    validateDamageList(raw.damage) &&
    (raw.damageOnSuccessfulSave === 'none' || raw.damageOnSuccessfulSave === 'half') &&
    (raw.conditionOnFailedSave == null || failedSaveConditionIsValid(raw.conditionOnFailedSave)) &&
    (raw.onEffectDamageReducesTargetToZero == null ||
      zeroHitPointOutcomeIsValid(raw.onEffectDamageReducesTargetToZero))
}

function areaTargetingIsValid(raw: unknown): boolean {
  if (!isRecord(raw) || typeof raw.shape !== 'string') return false
  if (raw.shape === 'circle') {
    return (raw.origin === 'self' || raw.origin === 'point') &&
      finiteInteger(raw.radiusFeet, 0, 100_000) &&
      (raw.placeRangeFeet == null || finiteInteger(raw.placeRangeFeet, 0, 100_000))
  }
  if (raw.shape === 'line') {
    return raw.origin === 'self' && finiteInteger(raw.widthFeet, 1, 100_000) &&
      finiteInteger(raw.lengthFeet, 1, 100_000) &&
      (raw.aimRangeFeet == null || finiteInteger(raw.aimRangeFeet, 0, 100_000))
  }
  if (raw.shape === 'cone') {
    return raw.origin === 'self' && finiteInteger(raw.lengthFeet, 1, 100_000) &&
      (raw.aimRangeFeet == null || finiteInteger(raw.aimRangeFeet, 0, 100_000))
  }
  if (raw.shape === 'rect') {
    return raw.origin === 'point' && finiteInteger(raw.widthFeet, 1, 100_000) &&
      finiteInteger(raw.heightFeet, 1, 100_000) &&
      (raw.placeRangeFeet == null || finiteInteger(raw.placeRangeFeet, 0, 100_000)) &&
      (raw.rotatable == null || typeof raw.rotatable === 'boolean')
  }
  return false
}

function areaSavingThrowEffectIsValid(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  const forcedMovement = raw.forcedMovementOnFailedSave
  const forcedMovementIsValid = forcedMovement == null || (
    isRecord(forcedMovement) &&
    Object.keys(forcedMovement).every((key) =>
      key === 'direction' || key === 'maximumDistanceFeet') &&
    forcedMovement.direction === 'away-from-source' &&
    finiteInteger(forcedMovement.maximumDistanceFeet, 1, 1_000)
  )
  const activeEffect = raw.activeEffectOnFailedSave
  const activeEffectIsValid = activeEffect == null || (
    isRecord(activeEffect) &&
    Object.keys(activeEffect).every((key) =>
      key === 'id' ||
      key === 'label' ||
      key === 'durationRounds' ||
      key === 'repeatSaveAtEndOfTargetTurn' ||
      key === 'modifiers') &&
    requiredText(activeEffect.id, 96) &&
    /^[a-z][a-z0-9-]*$/.test(String(activeEffect.id)) &&
    requiredText(activeEffect.label, 240) &&
    finiteInteger(activeEffect.durationRounds, 1, 14_400) &&
    typeof activeEffect.repeatSaveAtEndOfTargetTurn === 'boolean' &&
    isRecord(activeEffect.modifiers) &&
    Object.keys(activeEffect.modifiers).length > 0 &&
    Object.keys(activeEffect.modifiers).every((key) =>
      key === 'speedMultiplier' ||
      key === 'preventReactions' ||
      key === 'maximumAttacksPerTurn' ||
      key === 'actionOrBonusActionOnly' ||
      key === 'strengthRollMode') &&
    (
      activeEffect.modifiers.speedMultiplier == null ||
      (
        typeof activeEffect.modifiers.speedMultiplier === 'number' &&
        Number.isFinite(activeEffect.modifiers.speedMultiplier) &&
        activeEffect.modifiers.speedMultiplier > 0 &&
        activeEffect.modifiers.speedMultiplier <= 10
      )
    ) &&
    (
      activeEffect.modifiers.preventReactions == null ||
      typeof activeEffect.modifiers.preventReactions === 'boolean'
    ) &&
    (
      activeEffect.modifiers.maximumAttacksPerTurn == null ||
      finiteInteger(activeEffect.modifiers.maximumAttacksPerTurn, 1, 100)
    ) &&
    (
      activeEffect.modifiers.actionOrBonusActionOnly == null ||
      typeof activeEffect.modifiers.actionOrBonusActionOnly === 'boolean'
    ) &&
    (
      activeEffect.modifiers.strengthRollMode == null ||
      activeEffect.modifiers.strengthRollMode === 'advantage' ||
      activeEffect.modifiers.strengthRollMode === 'disadvantage'
    )
  )
  return areaTargetingIsValid(raw.area) &&
    (raw.target === 'hostile' || raw.target === 'all-creatures-except-self') &&
    ABILITY_KEYS.includes(raw.ability as typeof ABILITY_KEYS[number]) &&
    finiteInteger(raw.dc, 1, 100) &&
    (raw.damage == null || validateDamage(raw.damage)) &&
    !(raw.damage == null && raw.damageOnSuccessfulSave != null) &&
    !(raw.damage != null && !['none', 'half'].includes(String(raw.damageOnSuccessfulSave ?? 'none'))) &&
    (raw.conditionOnFailedSave == null || failedSaveConditionIsValid(raw.conditionOnFailedSave)) &&
    forcedMovementIsValid &&
    activeEffectIsValid &&
    !(
      raw.damage == null &&
      raw.conditionOnFailedSave == null &&
      raw.forcedMovementOnFailedSave == null &&
      raw.activeEffectOnFailedSave == null
    ) &&
    (raw.frightfulPresenceImmunityRounds == null ||
      finiteInteger(raw.frightfulPresenceImmunityRounds, 1, 14_400))
}

function actionShapeIsValid(action: unknown): action is Dnd5eMonsterAction {
  if (!isRecord(action) || !requiredText(action.id, 120) || !requiredText(action.name, 240) ||
    !requiredText(action.description) || typeof action.kind !== 'string' || !ACTION_KINDS.has(action.kind)) return false
  if (action.automation != null && action.automation !== 'headless' && action.automation !== 'dm-adjudication') return false
  if (action.sequence != null && (!Array.isArray(action.sequence) || action.sequence.some((entry) => !requiredText(entry, 120)))) return false
  if (
    action.sequenceAttackMode != null &&
    (
      action.kind !== 'multiattack' ||
      (action.sequenceAttackMode !== 'melee' && action.sequenceAttackMode !== 'ranged')
    )
  ) return false
  if (action.usage != null) {
    if (!isRecord(action.usage)) return false
    if (action.usage.kind === 'recharge') {
      if (!finiteInteger(action.usage.dieSides, 2, 100) ||
        !finiteInteger(action.usage.minimum, 1, Number(action.usage.dieSides))) return false
    } else if (action.usage.kind === 'per-day') {
      if (!finiteInteger(action.usage.max, 1, 99)) return false
    } else return false
  }
  if (action.legendaryCost != null && !finiteInteger(action.legendaryCost, 1, 10)) return false
  if (action.referencedActionId != null && !requiredText(action.referencedActionId, 120)) return false
  if (action.relationRequirement != null) {
    if (
      !isRecord(action.relationRequirement) ||
      !Object.keys(action.relationRequirement).every((key) =>
        key === 'kind' || key === 'slotGroup') ||
      action.relationRequirement.kind !== 'none-from-source' ||
      !requiredText(action.relationRequirement.slotGroup, 96) ||
      !/^[a-z][a-z0-9-]*$/.test(String(action.relationRequirement.slotGroup))
    ) return false
  }
  if (action.rule != null) {
    if (!isRecord(action.rule) || typeof action.rule.kind !== 'string') return false
    if (action.rule.kind === 'ability-check') {
      if (
        !ABILITY_KEYS.includes(action.rule.ability as typeof ABILITY_KEYS[number]) ||
        (action.rule.skillKey != null && !requiredText(action.rule.skillKey, 120))
      ) return false
    } else if (action.rule.kind === 'saving-throw-condition') {
      if (
        !finiteInteger(action.rule.rangeFeet, 0, 100_000) ||
        !ABILITY_KEYS.includes(action.rule.ability as typeof ABILITY_KEYS[number]) ||
        !finiteInteger(action.rule.dc, 1, 100) ||
        !STANDARD_CONDITIONS.has(String(action.rule.condition)) ||
        (action.rule.preventReactions != null && typeof action.rule.preventReactions !== 'boolean') ||
        (action.rule.repeatSaveOnDamage != null && typeof action.rule.repeatSaveOnDamage !== 'boolean')
      ) return false
    } else if (action.rule.kind === 'conditioned-damage-and-healing') {
      if (
        !STANDARD_CONDITIONS.has(String(action.rule.requiredCondition)) ||
        typeof action.rule.requireSameSource !== 'boolean' ||
        !validateDamage(action.rule.damage)
      ) return false
    } else if (action.rule.kind === 'parry') {
      if (
        !Object.keys(action.rule).every((key) =>
          key === 'kind' ||
          key === 'armorClassBonus' ||
          key === 'requiresSight' ||
          key === 'requiresWieldedMeleeWeapon') ||
        !finiteInteger(action.rule.armorClassBonus, 1, 100) ||
        action.rule.requiresSight !== true ||
        action.rule.requiresWieldedMeleeWeapon !== true
      ) return false
    } else if (action.rule.kind === 'turn-start-saving-throw-reaction') {
      if (
        !Object.keys(action.rule).every((key) =>
          key === 'kind' ||
          key === 'rangeFeet' ||
          key === 'ability' ||
          key === 'dc' ||
          key === 'condition' ||
          key === 'duration' ||
          key === 'magical' ||
          key === 'requiresMutualVisualSight') ||
        !finiteInteger(action.rule.rangeFeet, 1, 100_000) ||
        !ABILITY_KEYS.includes(action.rule.ability as typeof ABILITY_KEYS[number]) ||
        !finiteInteger(action.rule.dc, 1, 100) ||
        !STANDARD_CONDITIONS.has(String(action.rule.condition)) ||
        action.rule.duration !== 'until-target-turn-end' ||
        action.rule.magical !== true ||
        action.rule.requiresMutualVisualSight !== true
      ) return false
    } else if (action.rule.kind === 'area-saving-throw') {
      if (action.rule.variants != null) {
        if (
          !Array.isArray(action.rule.variants) ||
          action.rule.variants.length < 2 ||
          action.rule.variants.length > 16 ||
          new Set(action.rule.variants.map((variant) =>
            isRecord(variant) ? String(variant.id) : '')).size !== action.rule.variants.length ||
          action.rule.variants.some((variant) =>
            !isRecord(variant) ||
            !requiredText(variant.id, 96) ||
            !/^[a-z][a-z0-9-]*$/.test(String(variant.id)) ||
            !requiredText(variant.name, 240) ||
            !areaSavingThrowEffectIsValid(variant))
        ) return false
      } else if (!areaSavingThrowEffectIsValid(action.rule)) return false
    } else return false
  }
  if (action.movement != null) {
    if (!isRecord(action.movement) ||
      action.movement.kind !== 'straight-toward-visible-hostile' ||
      typeof action.movement.maximumSpeedFraction !== 'number' ||
      !Number.isFinite(action.movement.maximumSpeedFraction) ||
      action.movement.maximumSpeedFraction <= 0 ||
      action.movement.maximumSpeedFraction > 1) return false
  }
  if (action.reactionTrigger != null) {
    if (!isRecord(action.reactionTrigger) ||
      action.reactionTrigger.kind !== 'after-action' ||
      !requiredText(action.reactionTrigger.actionId, 120)) return false
  }
  if (action.attack == null) return true
  const attack = action.attack
  if (!isRecord(attack) || typeof attack.mode !== 'string' || !ATTACK_MODES.has(attack.mode) ||
    !finiteInteger(attack.toHit, -100, 100) || !requiredText(attack.target, 500) ||
    !validateDamageList(attack.damage)) return false
  if (
    attack.attackAbility != null &&
    attack.attackAbility !== 'str' &&
    attack.attackAbility !== 'dex'
  ) return false
  if (
    attack.rangedDamage != null &&
    (
      attack.mode !== 'melee-or-ranged' ||
      attack.rangeFeet == null ||
      !validateDamageList(attack.rangedDamage)
    )
  ) return false
  if (attack.damageAtHalfHp != null && !validateDamageList(attack.damageAtHalfHp)) return false
  if (attack.criticalThreshold != null && !finiteInteger(attack.criticalThreshold, 2, 20)) return false
  if (attack.criticalExtraDamage != null && !validateDamageList(attack.criticalExtraDamage)) return false
  if (attack.targetMaxSizeRank != null && !finiteInteger(attack.targetMaxSizeRank, 0, 5)) return false
  if (attack.reachFeet != null && !finiteInteger(attack.reachFeet, 0, 10_000)) return false
  if (attack.rangeFeet != null && (!isRecord(attack.rangeFeet) ||
    !finiteInteger(attack.rangeFeet.normal, 0, 100_000) || !finiteInteger(attack.rangeFeet.long, 0, 100_000) ||
    Number(attack.rangeFeet.long) < Number(attack.rangeFeet.normal))) return false
  if (attack.onHit != null && !requiredText(attack.onHit)) return false
  if (attack.onHitEffects != null) {
    if (
      !Array.isArray(attack.onHitEffects) ||
      attack.onHitEffects.length < 1 ||
      attack.onHitEffects.length > 16 ||
      attack.onHitEffects.some((effect) => !onHitEffectIsValid(effect))
    ) return false
    const effectIds = attack.onHitEffects.map((effect) =>
      String((effect as Record<string, unknown>).id))
    if (new Set(effectIds).size !== effectIds.length) return false
    if (attack.onHitEffects.filter((effect) =>
      isRecord(effect) && effect.kind === 'source-linked-condition').length > 1) return false
  }
  if (attack.onHitRule != null) {
    if (!isRecord(attack.onHitRule) || attack.onHitRule.kind !== 'saving-throw-condition' ||
      !ABILITY_KEYS.includes(attack.onHitRule.ability as typeof ABILITY_KEYS[number]) ||
      !finiteInteger(attack.onHitRule.dc, 1, 100) ||
      !STANDARD_CONDITIONS.has(String(attack.onHitRule.condition)) &&
      attack.onHitRule.condition !== 'disease') return false
  }
  return true
}

function traitShapeIsValid(raw: unknown): boolean {
  if (!isRecord(raw) || !requiredText(raw.name, 240) || !requiredText(raw.description)) return false
  if (raw.automation != null && raw.automation !== 'headless' && raw.automation !== 'dm-adjudication') return false
  if (raw.rule == null) return true
  if (!isRecord(raw.rule) || typeof raw.rule.kind !== 'string') return false
  if (raw.rule.kind === 'legendary-resistance') {
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' || key === 'maximumUses') &&
      finiteInteger(raw.rule.maximumUses, 1, 99)
  }
  if (raw.rule.kind === 'undead-fortitude') {
    return finiteInteger(raw.rule.dcBase, 1, 100) &&
      Array.isArray(raw.rule.excludedDamageTypes) && raw.rule.excludedDamageTypes.every((type) => DAMAGE_TYPE_VALUES.has(String(type))) &&
      typeof raw.rule.excludedOnCritical === 'boolean'
  }
  if (raw.rule.kind === 'regeneration') {
    return finiteInteger(raw.rule.amount, 1, 1_000_000) && typeof raw.rule.requiresPositiveHp === 'boolean' &&
      Array.isArray(raw.rule.suppressedByDamageTypes) && raw.rule.suppressedByDamageTypes.every((type) => DAMAGE_TYPE_VALUES.has(String(type))) &&
      typeof raw.rule.diesAtZeroWhenSuppressed === 'boolean'
  }
  if (raw.rule.kind === 'swarm') {
    return raw.rule.cannotRegainHitPoints === true && raw.rule.cannotGainTemporaryHitPoints === true
  }
  if (raw.rule.kind === 'nimble-escape') {
    return Array.isArray(raw.rule.bonusActionOptions) &&
      raw.rule.bonusActionOptions.length === 2 &&
      raw.rule.bonusActionOptions[0] === 'disengage' &&
      raw.rule.bonusActionOptions[1] === 'hide'
  }
  if (raw.rule.kind === 'keen-sense') {
    return ['smell', 'hearing', 'sight'].includes(String(raw.rule.sense)) &&
      requiredText(raw.rule.skillKey, 120) &&
      finiteInteger(raw.rule.checkBonus, -100, 100) &&
      (raw.rule.blindsightFeet == null || finiteInteger(raw.rule.blindsightFeet, 0, 10_000))
  }
  if (raw.rule.kind === 'ambusher') {
    return raw.rule.initiativeAdvantageWhenSurprising === true
  }
  if (raw.rule.kind === 'ambusher-attack-advantage') {
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' || key === 'requiredRound' || key === 'targetState') &&
      raw.rule.requiredRound === 1 &&
      raw.rule.targetState === 'currently-surprised'
  }
  if (raw.rule.kind === 'blood-frenzy') {
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' || key === 'attackMode' || key === 'targetHitPoints') &&
      raw.rule.attackMode === 'melee' &&
      raw.rule.targetHitPoints === 'below-maximum'
  }
  if (raw.rule.kind === 'surprise-attack') {
    const damage = raw.rule.extraDamage
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' ||
      key === 'requiredRound' ||
      key === 'targetState' ||
      key === 'applyOn' ||
      key === 'extraDamage') &&
      raw.rule.requiredRound === 1 &&
      raw.rule.targetState === 'currently-surprised' &&
      raw.rule.applyOn === 'each-qualifying-hit' &&
      isRecord(damage) &&
      Object.keys(damage).every((key) =>
        key === 'average' || key === 'count' || key === 'sides' ||
        key === 'bonus' || key === 'type') &&
      finiteInteger(damage.average, 0, 1_000_000) &&
      finiteInteger(damage.count, 1, 1_000) &&
      finiteInteger(damage.sides, 2, 1_000_000) &&
      finiteInteger(damage.bonus, -1_000_000, 1_000_000) &&
      damage.type === 'inherit-primary'
  }
  if (raw.rule.kind === 'assassinate') {
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' ||
      key === 'requiredRound' ||
      key === 'advantageAgainst' ||
      key === 'automaticCriticalAgainst') &&
      raw.rule.requiredRound === 1 &&
      raw.rule.advantageAgainst === 'target-not-yet-acted' &&
      raw.rule.automaticCriticalAgainst === 'currently-surprised'
  }
  if (raw.rule.kind === 'sneak-attack' || raw.rule.kind === 'martial-advantage') {
    const damage = raw.rule.extraDamage
    const commonValid =
      raw.rule.oncePerTurn === true &&
      finiteInteger(raw.rule.allyDistanceFeet, 1, 100_000) &&
      isRecord(damage) &&
      finiteInteger(damage.average, 0, 1_000_000) &&
      finiteInteger(damage.count, 1, 1_000) &&
      finiteInteger(damage.sides, 2, 1_000_000) &&
      finiteInteger(damage.bonus, -1_000_000, 1_000_000) &&
      damage.type === 'inherit-primary'
    if (!commonValid) return false
    if (raw.rule.kind === 'sneak-attack') {
      return Object.keys(raw.rule).every((key) =>
        key === 'kind' ||
        key === 'oncePerTurn' ||
        key === 'allyDistanceFeet' ||
        key === 'requireNoDisadvantage' ||
        key === 'advantageOrAdjacentAlly' ||
        key === 'extraDamage') &&
        raw.rule.requireNoDisadvantage === true &&
        raw.rule.advantageOrAdjacentAlly === true
    }
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' ||
      key === 'oncePerTurn' ||
      key === 'allyDistanceFeet' ||
      key === 'requiresAdjacentAlly' ||
      key === 'extraDamage') &&
      raw.rule.requiresAdjacentAlly === true
  }
  if (raw.rule.kind === 'reckless') {
    const outgoing = raw.rule.outgoing
    const incoming = raw.rule.incoming
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' || key === 'activation' || key === 'outgoing' || key === 'incoming') &&
      raw.rule.activation === 'turn-start-tactical-default' &&
      isRecord(outgoing) &&
      Object.keys(outgoing).every((key) =>
        key === 'delivery' || key === 'mode' || key === 'rollMode' || key === 'duration') &&
      outgoing.delivery === 'weapon-attack' &&
      outgoing.mode === 'melee' &&
      outgoing.rollMode === 'advantage' &&
      outgoing.duration === 'current-turn' &&
      isRecord(incoming) &&
      Object.keys(incoming).every((key) =>
        key === 'rollMode' || key === 'duration') &&
      incoming.rollMode === 'advantage' &&
      incoming.duration === 'until-source-turn-start'
  }
  if (raw.rule.kind === 'reactive') {
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' || key === 'reactionRefresh') &&
      raw.rule.reactionRefresh === 'every-turn-start'
  }
  if (raw.rule.kind === 'charge-damage') {
    return finiteInteger(raw.rule.minimumStraightMovementFeet, 5, 10_000) &&
      requiredText(raw.rule.actionId, 120) &&
      validateDamage(raw.rule.extraDamage)
  }
  if (raw.rule.kind === 'magic-resistance') {
    return raw.rule.savingThrowAdvantageAgainstMagic === true
  }
  if (raw.rule.kind === 'limited-magic-immunity') {
    return raw.rule.maximumSpellLevel === 6 &&
      raw.rule.advantageAboveMaximum === true &&
      raw.rule.allowsWilling === true
  }
  if (raw.rule.kind === 'magic-weapons') {
    return raw.rule.weaponAttacksMagical === true
  }
  if (raw.rule.kind === 'pack-tactics') {
    return finiteInteger(raw.rule.allyDistanceFeet, 1, 100_000) &&
      raw.rule.requiresAllyNotIncapacitated === true
  }
  if (raw.rule.kind === 'conditional-target-bonus') {
    return Array.isArray(raw.rule.targetConditions) &&
      raw.rule.targetConditions.length >= 1 &&
      raw.rule.targetConditions.length <= STANDARD_CONDITIONS.size &&
      raw.rule.targetConditions.every((condition) => STANDARD_CONDITIONS.has(String(condition))) &&
      finiteInteger(raw.rule.attackBonus, -100, 100) &&
      finiteInteger(raw.rule.damageBonus, -1_000_000, 1_000_000)
  }
  if (raw.rule.kind === 'mucous-cloud') {
    return finiteInteger(raw.rule.saveDc, 1, 100) && raw.rule.condition === 'disease' &&
      finiteInteger(raw.rule.maximumTriggerDistanceFeet, 5, 10_000)
  }
  if (raw.rule.kind === 'relentless') {
    return Object.keys(raw.rule).every((key) => key === 'kind' || key === 'maximumDamage') &&
      finiteInteger(raw.rule.maximumDamage, 1, 1_000_000)
  }
  if (raw.rule.kind === 'death-area-saving-throw') {
    const area = raw.rule.area
    const condition = raw.rule.conditionOnFailedSave
    return Object.keys(raw.rule).every((key) =>
      key === 'kind' ||
      key === 'ruleId' ||
      key === 'area' ||
      key === 'target' ||
      key === 'ability' ||
      key === 'dc' ||
      key === 'damage' ||
      key === 'damageOnSuccessfulSave' ||
      key === 'conditionOnFailedSave') &&
      requiredText(raw.rule.ruleId, 120) &&
      /^[a-z][a-z0-9-]*$/.test(String(raw.rule.ruleId)) &&
      isRecord(area) &&
      Object.keys(area).every((key) =>
        key === 'shape' || key === 'origin' || key === 'radiusFeet') &&
      area.shape === 'circle' &&
      area.origin === 'self' &&
      finiteInteger(area.radiusFeet, 1, 100_000) &&
      raw.rule.target === 'all-creatures-except-self' &&
      ABILITY_KEYS.includes(raw.rule.ability as typeof ABILITY_KEYS[number]) &&
      finiteInteger(raw.rule.dc, 1, 100) &&
      (raw.rule.damage == null || validateDamage(raw.rule.damage)) &&
      (raw.rule.damage == null
        ? raw.rule.damageOnSuccessfulSave == null
        : raw.rule.damageOnSuccessfulSave === 'none' ||
          raw.rule.damageOnSuccessfulSave === 'half') &&
      (condition == null || (
        isRecord(condition) &&
        STANDARD_CONDITIONS.has(String(condition.condition)) &&
        finiteInteger(condition.durationRounds, 1, 10_000) &&
        typeof condition.repeatSaveAtEndOfTargetTurn === 'boolean' &&
        (condition.breakOnDamage == null ||
          typeof condition.breakOnDamage === 'boolean')
      ))
  }
  if (raw.rule.kind === 'turn-start-gaze') {
    return requiredText(raw.rule.ruleId, 120) &&
      /^[a-z][a-z0-9-]*$/.test(String(raw.rule.ruleId)) &&
      finiteInteger(raw.rule.rangeFeet, 1, 10_000) &&
      ABILITY_KEYS.includes(raw.rule.ability as typeof ABILITY_KEYS[number]) &&
      finiteInteger(raw.rule.dc, 1, 100) &&
      raw.rule.magical === true &&
      raw.rule.allowAvertEyes === true &&
      raw.rule.requiresMutualVisualSight === true &&
      raw.rule.initialCondition === 'restrained' &&
      raw.rule.failureCondition === 'petrified' &&
      (
        raw.rule.immediateFailureMargin == null ||
        finiteInteger(raw.rule.immediateFailureMargin, 1, 100)
      )
  }
  return false
}

function mechanicDiceIsValid(raw: unknown): boolean {
  return isRecord(raw) && finiteInteger(raw.count, 1, 100) && finiteInteger(raw.sides, 2, 1_000) &&
    finiteInteger(raw.bonus, -1_000_000, 1_000_000)
}

function mechanicEffectV2IsValid(raw: unknown): boolean {
  if (!isRecord(raw) || !requiredText(raw.id, 96) || !/^[a-z][a-z0-9-]*$/.test(String(raw.id)) || typeof raw.kind !== 'string') return false
  if (raw.kind === 'healing' || raw.kind === 'temporary-hit-points') {
    return raw.target === 'self' && mechanicDiceIsValid(raw.dice)
  }
  if (raw.kind === 'damage') {
    return MECHANIC_TARGETS.has(String(raw.target)) && mechanicDiceIsValid(raw.dice) &&
      (DAMAGE_TYPE_VALUES.has(String(raw.damageType)) || raw.damageType === 'inherit-trigger')
  }
  if (raw.kind === 'standard-condition') {
    const duration = isRecord(raw.duration) ? raw.duration : null
    return MECHANIC_TARGETS.has(String(raw.target)) && STANDARD_CONDITIONS.has(String(raw.condition)) && !!duration &&
      ['permanent', 'until-target-turn-start', 'until-source-turn-start', 'rounds'].includes(String(duration.kind)) &&
      (duration.kind !== 'rounds' || finiteInteger(duration.rounds, 1, 10_000))
  }
  if (raw.kind === 'remove-standard-condition') {
    return MECHANIC_TARGETS.has(String(raw.target)) && STANDARD_CONDITIONS.has(String(raw.condition))
  }
  if (raw.kind === 'summon') {
    return requiredText(raw.monsterId, 120) && ID_PATTERN.test(String(raw.monsterId)) &&
      finiteInteger(raw.count, 1, 20) && finiteInteger(raw.durationRounds, 1, 10_000)
  }
  if (raw.kind === 'area-attack') {
    return ['circle', 'cone', 'line'].includes(String(raw.shape)) &&
      finiteInteger(raw.rangeFeet, 0, 100_000) && finiteInteger(raw.sizeFeet, 5, 100_000) &&
      mechanicDiceIsValid(raw.dice) && DAMAGE_TYPE_VALUES.has(String(raw.damageType))
  }
  if (raw.kind === 'roll-modifier') {
    return MECHANIC_TARGETS.has(String(raw.target)) &&
      ['attack', 'damage', 'saving-throw'].includes(String(raw.roll)) &&
      ['bonus', 'advantage', 'disadvantage'].includes(String(raw.mode)) &&
      (raw.mode !== 'bonus' || finiteInteger(raw.bonus, -1_000_000, 1_000_000))
  }
  if (raw.kind === 'attack') {
    return MECHANIC_TARGETS.has(String(raw.target)) &&
      (raw.attackMode == null || ['melee', 'ranged'].includes(String(raw.attackMode))) &&
      finiteInteger(raw.toHit, -100, 100) &&
      (raw.economy == null || ['none', 'reaction'].includes(String(raw.economy))) &&
      validateDamage(raw.damage)
  }
  return false
}

function mechanicShapeIsValid(raw: unknown): boolean {
  if (!isRecord(raw) || !requiredText(raw.id, 96) || !/^[a-z][a-z0-9-]*$/.test(String(raw.id)) ||
    !requiredText(raw.name, 240) || typeof raw.limit !== 'string' || !MECHANIC_LIMITS.has(raw.limit)) return false
  if (raw.schemaVersion === 2) {
    const trigger = isRecord(raw.trigger) ? raw.trigger : null
    const predicates = isRecord(raw.predicates) ? raw.predicates : null
    if (!trigger || !MECHANIC_EVENTS.has(String(trigger.event)) || !predicates ||
      typeof predicates.requiresPositiveHp !== 'boolean' || !MECHANIC_AUTOMATION.has(String(raw.automation))) return false
    if (trigger.subject != null && !MECHANIC_SUBJECTS.has(String(trigger.subject))) return false
    if ((trigger.subject ?? 'self') === 'self') {
      if (trigger.radiusFeet != null) return false
    } else if (!finiteInteger(trigger.radiusFeet, 5, 100_000)) return false
    if (trigger.event === 'movement') {
      if (!isRecord(trigger.movement) ||
        !['at-least', 'at-most'].includes(String(trigger.movement.comparison)) ||
        !finiteInteger(trigger.movement.feet, 0, 100_000)) return false
    } else if (trigger.movement != null) return false
    for (const threshold of ['hpPercentageAtOrBelow', 'hpPercentageAtOrAbove'] as const) {
      if (predicates[threshold] != null && (!Number.isFinite(predicates[threshold]) || Number(predicates[threshold]) < 0 || Number(predicates[threshold]) > 100)) return false
    }
    for (const threshold of ['hpBelow', 'hpAtOrBelow', 'hpAbove', 'hpAtOrAbove'] as const) {
      if (predicates[threshold] != null && !finiteInteger(predicates[threshold], 0, 1_000_000)) return false
    }
    if (!Array.isArray(raw.effects) || raw.effects.length < 1 || raw.effects.length > 16 ||
      raw.effects.some((effect) => !mechanicEffectV2IsValid(effect))) return false
    if (
      (trigger.subject ?? 'self') === 'self' &&
      raw.effects.some((effect) => isRecord(effect) && effect.target === 'selected-subject')
    ) return false
    const effectIds = raw.effects.map((effect) => String((effect as Record<string, unknown>).id))
    return new Set(effectIds).size === effectIds.length
  }
  if (raw.schemaVersion !== 1 || raw.event !== 'turn-start' || raw.automation !== 'headless') return false
  const predicates = isRecord(raw.predicates) ? raw.predicates : null
  if (!predicates || !Number.isFinite(predicates.hpPercentageAtOrBelow) ||
    Number(predicates.hpPercentageAtOrBelow) < 0 || Number(predicates.hpPercentageAtOrBelow) > 100 ||
    typeof predicates.requiresPositiveHp !== 'boolean') return false
  const effect = isRecord(raw.effect) ? raw.effect : null
  const dice = isRecord(effect?.dice) ? effect.dice : null
  return !!effect && effect.kind === 'healing' && !!dice && mechanicDiceIsValid(dice)
}

export function dnd5eMonsterActionAutomation(action: Dnd5eMonsterAction): Dnd5eMonsterActionAutomation {
  if (action.automation === 'dm-adjudication') return 'dm-adjudication'
  if (action.kind === 'other') return action.automation === 'headless' && action.rule ? 'headless' : action.automation === 'headless' ? 'invalid' : 'dm-adjudication'
  if (action.kind === 'multiattack') return action.sequence?.length ? 'headless' : 'invalid'
  if (!action.attack || action.attack.damage.length < 1) return 'invalid'
  if (
    action.attack.onHit &&
    !action.attack.onHitRule &&
    !action.attack.onHitEffects?.length
  ) return 'invalid'
  return 'headless'
}

function validateActionList(
  monster: Dnd5eMonsterStatBlock,
  actions: readonly Dnd5eMonsterAction[],
  section: string,
  actionSectionById: Map<string, string>,
): Dnd5eMonsterSchemaIssue[] {
  const issues: Dnd5eMonsterSchemaIssue[] = []
  for (const action of actions) {
    const rawAction: unknown = action
    if (!actionShapeIsValid(rawAction)) {
      issues.push({
        monsterId: monster.id,
        actionId: isRecord(rawAction) && typeof rawAction.id === 'string' ? rawAction.id : undefined,
        code: 'invalid-stat-block',
        message: `${section}包含无效动作结构`,
      })
      continue
    }
    const previousSection = actionSectionById.get(action.id)
    if (previousSection != null) {
      issues.push({
        monsterId: monster.id,
        actionId: action.id,
        code: 'duplicate-action-id',
        message: `怪物动作 ID 必须在所有动作分区中唯一：${action.id}（首次出现在${previousSection}，又出现在${section}）`,
      })
    } else {
      actionSectionById.set(action.id, section)
    }
    const automation = dnd5eMonsterActionAutomation(action)
    if (automation === 'invalid') {
      const code = action.kind === 'multiattack' ? 'invalid-multiattack-sequence'
        : action.kind === 'weapon-attack' && action.attack?.onHit &&
            !action.attack.onHitRule && !action.attack.onHitEffects?.length
          ? 'unstructured-on-hit-rule'
          : action.kind === 'weapon-attack' ? 'invalid-weapon-attack' : 'unsupported-action-kind'
      issues.push({ monsterId: monster.id, actionId: action.id, code, message: `${section}动作 ${action.name} 缺少可验证的 Headless 结构` })
    }
  }
  for (const action of actions) {
    if (!actionShapeIsValid(action) || action.kind !== 'multiattack' || dnd5eMonsterActionAutomation(action) !== 'headless') continue
    for (const childId of action.sequence ?? []) {
      const child = actions.find((candidate) => candidate.id === childId)
      const optionalStructuredSpecial = child?.kind === 'other' &&
        dnd5eMonsterActionAutomation(child) === 'headless' && !!child.rule
      if (!optionalStructuredSpecial && (
        !child || child.kind !== 'weapon-attack' || dnd5eMonsterActionAutomation(child) !== 'headless'
      )) {
        issues.push({
          monsterId: monster.id,
          actionId: action.id,
          code: 'invalid-multiattack-sequence',
          message: `${section}多重攻击引用了不存在或不能由 Headless 结算的动作：${childId}`,
        })
      } else if (
        action.sequenceAttackMode &&
        child?.attack &&
        child.attack.mode !== 'melee-or-ranged' &&
        child.attack.mode !== action.sequenceAttackMode
      ) {
        issues.push({
          monsterId: monster.id,
          actionId: action.id,
          code: 'invalid-multiattack-sequence',
          message: `${section}多重攻击 ${action.name} 要求 ${action.sequenceAttackMode}，但子动作 ${childId} 不支持该攻击模式`,
        })
      }
    }
  }
  return issues
}

function validateCoreShape(raw: unknown): Dnd5eMonsterSchemaIssue[] {
  const monsterId = isRecord(raw) && typeof raw.id === 'string' ? raw.id : 'unknown-monster'
  if (!isRecord(raw)) return [issue(monsterId, '怪物数据必须是对象')]
  const issues: Dnd5eMonsterSchemaIssue[] = []
  if (!requiredText(raw.id, 120) || !ID_PATTERN.test(String(raw.id))) issues.push(issue(monsterId, '怪物 ID 必须使用 srd-5.1: 或 room-monster: 命名空间'))
  if (!requiredText(raw.slug, 96) || !/^[a-z0-9][a-z0-9-]*$/.test(String(raw.slug))) issues.push(issue(monsterId, '怪物 slug 无效'))
  if (!requiredText(raw.name, 240) || !requiredText(raw.englishName, 240)) issues.push(issue(monsterId, '怪物名称无效'))
  if (raw.source !== 'SRD 5.1' && raw.source !== 'DM 自定义') issues.push(issue(monsterId, '怪物来源无效'))
  if (raw.source === 'SRD 5.1' && !String(raw.id).startsWith('srd-5.1:')) issues.push(issue(monsterId, 'SRD 怪物 ID 命名空间错误'))
  if (raw.source === 'DM 自定义' && !String(raw.id).startsWith('room-monster:')) issues.push(issue(monsterId, '自定义怪物 ID 命名空间错误'))
  if (raw.sourcePage != null && !finiteInteger(raw.sourcePage, 1, 10_000)) issues.push(issue(monsterId, '来源页码无效'))
  if (!SIZE_VALUES.has(String(raw.size)) || !requiredText(raw.creatureType, 120) || !requiredText(raw.alignment, 240)) issues.push(issue(monsterId, '体型、类型或阵营无效'))
  if (raw.subtypes != null && (!Array.isArray(raw.subtypes) || raw.subtypes.length > 32 || raw.subtypes.some((entry) => !requiredText(entry, 240)))) issues.push(issue(monsterId, '生物亚型无效'))
  if (!isRecord(raw.armorClass) || !finiteInteger(raw.armorClass.value, 1, 100)) issues.push(issue(monsterId, '护甲等级无效'))
  if (!isRecord(raw.hitPoints) || !finiteInteger(raw.hitPoints.average, 1, 1_000_000) ||
    typeof raw.hitPoints.dice !== 'string' || !DICE_PATTERN.test(raw.hitPoints.dice)) issues.push(issue(monsterId, '生命值或生命骰无效'))
  const speed = isRecord(raw.speed) ? raw.speed : null
  if (!speed || !finiteInteger(speed.walk, 0, 10_000) ||
    ['fly', 'swim', 'climb', 'burrow'].some((key) => speed[key] != null && !finiteInteger(speed[key], 0, 10_000)) ||
    (speed.hover != null && typeof speed.hover !== 'boolean')) issues.push(issue(monsterId, '移动速度无效'))
  const abilities = isRecord(raw.abilities) ? raw.abilities : null
  if (!abilities || ABILITY_KEYS.some((key) => !finiteInteger(abilities[key], 1, 30))) issues.push(issue(monsterId, '六项属性值必须是 1–30 的整数'))
  if (raw.savingThrows != null && (!isRecord(raw.savingThrows) || Object.entries(raw.savingThrows).some(([key, value]) => !ABILITY_KEYS.includes(key as typeof ABILITY_KEYS[number]) || !finiteInteger(value, -100, 100)))) issues.push(issue(monsterId, '豁免加值无效'))
  if (raw.skills != null && (!Array.isArray(raw.skills) || raw.skills.length > 64 || raw.skills.some((skill) => !isRecord(skill) || !requiredText(skill.key, 120) || !requiredText(skill.name, 240) || !finiteInteger(skill.bonus, -100, 100)))) issues.push(issue(monsterId, '技能数据无效'))
  if (!Array.isArray(raw.senses) || raw.senses.length > 32 || raw.senses.some((sense) => !isRecord(sense) || !requiredText(sense.name, 120) ||
    (sense.distanceFeet != null && !finiteInteger(sense.distanceFeet, 0, 100_000)))) issues.push(issue(monsterId, '感官数据无效'))
  if (!finiteInteger(raw.passivePerception, 0, 100)) issues.push(issue(monsterId, '被动察觉无效'))
  if (!Array.isArray(raw.languages) || raw.languages.length > 64 || raw.languages.some((language) => !requiredText(language, 500))) issues.push(issue(monsterId, '语言数据无效'))
  if (!isRecord(raw.challenge) || !requiredText(raw.challenge.rating, 16) || !finiteInteger(raw.challenge.xp, 0, 100_000_000)) issues.push(issue(monsterId, '挑战等级或经验值无效'))
  if (raw.legendaryResistanceUses != null && !finiteInteger(raw.legendaryResistanceUses, 0, 99)) {
    issues.push(issue(monsterId, '传奇抗性次数无效'))
  }
  if (raw.legendaryActionPoints != null && !finiteInteger(raw.legendaryActionPoints, 0, 99)) {
    issues.push(issue(monsterId, '传奇动作点数无效'))
  }
  if (raw.lairInitiative != null && !finiteInteger(raw.lairInitiative, 0, 99)) {
    issues.push(issue(monsterId, '巢穴动作先攻值无效'))
  }
  for (const key of ['tokenPortrait', 'initiativePortrait'] as const) {
    if (raw[key] != null && (
      typeof raw[key] !== 'string' || raw[key].length > 600_000 ||
      !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(raw[key])
    )) issues.push(issue(monsterId, `${key} 图片数据无效`))
  }
  if (raw.equipment != null && (
    !Array.isArray(raw.equipment) || raw.equipment.length > 128 ||
    raw.equipment.some((entry) => !isRecord(entry) ||
      !requiredText(entry.id, 120) || !requiredText(entry.name, 240) ||
      !['weapon', 'armor', 'shield', 'gear', 'consumable', 'other'].includes(String(entry.category)) ||
      !finiteInteger(entry.quantity, 1, 999) ||
      (entry.description != null && typeof entry.description !== 'string') ||
      (entry.armorClass != null && !finiteInteger(entry.armorClass, 0, 100)) ||
      (entry.linkedActionId != null && !requiredText(entry.linkedActionId, 120)))
  )) issues.push(issue(monsterId, '装备数据无效'))
  if (!Array.isArray(raw.traits) || raw.traits.length > 128 || raw.traits.some((trait) => !traitShapeIsValid(trait))) issues.push(issue(monsterId, '特性数据无效'))
  if (!Array.isArray(raw.actions) || raw.actions.length > 128) issues.push(issue(monsterId, '动作列表无效'))
  for (const [key, label] of [['bonusActions', '附赠动作'], ['reactions', '反应'], ['legendaryActions', '传奇动作'], ['lairActions', '巢穴动作']] as const) {
    if (raw[key] != null && (!Array.isArray(raw[key]) || raw[key].length > 128)) issues.push(issue(monsterId, `${label}列表无效`))
  }
  if (raw.spellcasting != null) {
    const spellcasting = isRecord(raw.spellcasting) ? raw.spellcasting : null
    const slots = isRecord(spellcasting?.slots) ? spellcasting.slots : null
    const spells = Array.isArray(spellcasting?.spells) ? spellcasting.spells : null
    if (
      !spellcasting || !requiredText(spellcasting.description) ||
      (spellcasting.automation !== 'headless' && spellcasting.automation !== 'dm-adjudication') ||
      (spellcasting.casterLevel != null && !finiteInteger(spellcasting.casterLevel, 1, 30)) ||
      (spellcasting.ability != null && !ABILITY_KEYS.includes(spellcasting.ability as typeof ABILITY_KEYS[number])) ||
      (spellcasting.saveDc != null && !finiteInteger(spellcasting.saveDc, 1, 100)) ||
      (spellcasting.attackBonus != null && !finiteInteger(spellcasting.attackBonus, -100, 100)) ||
      (spellcasting.componentsRequired != null && (
        !Array.isArray(spellcasting.componentsRequired) ||
        spellcasting.componentsRequired.some((entry) => !['V', 'S', 'M'].includes(String(entry)))
      )) ||
      (spellcasting.slots != null && (!slots || Object.entries(slots).some(([level, count]) =>
        !/^[1-9]$/.test(level) || !finiteInteger(count, 0, 99)
      ))) ||
      (spellcasting.spells != null && (!spells || spells.some((spell) =>
        !isRecord(spell) || !requiredText(spell.id, 120) || !requiredText(spell.name, 240) ||
        !finiteInteger(spell.level, 0, 9) || (spell.usage != null && (
          !isRecord(spell.usage) ||
          (spell.usage.kind !== 'at-will' && !(spell.usage.kind === 'per-day' && finiteInteger(spell.usage.max, 1, 99)))
        ))
      )))
    ) issues.push(issue(monsterId, '施法数据无效'))
  }
  if (!requiredText(raw.description)) issues.push(issue(monsterId, '怪物简介无效'))
  for (const key of ['damageVulnerabilities', 'damageResistances', 'damageImmunities'] as const) {
    if (raw[key] != null && (!Array.isArray(raw[key]) || raw[key].some((entry) => typeof entry !== 'string' || !DAMAGE_TYPE_VALUES.has(entry)))) {
      issues.push(issue(monsterId, `${key} 包含未知伤害类型`))
    }
  }
  if (
    raw.damageDefenseRules != null &&
    (
      !Array.isArray(raw.damageDefenseRules) ||
      raw.damageDefenseRules.length > 128 ||
      raw.damageDefenseRules.some((entry) => !isDnd5eConditionalDamageDefense(entry))
    )
  ) {
    issues.push(issue(monsterId, '条件伤害防御数据无效'))
  }
  if (
    raw.unparsedDamageDefenses != null &&
    (
      !Array.isArray(raw.unparsedDamageDefenses) ||
      raw.unparsedDamageDefenses.length > 128 ||
      raw.unparsedDamageDefenses.some((entry) =>
        !isRecord(entry) ||
        Object.keys(entry).some((key) => key !== 'outcome' && key !== 'text') ||
        !['immune', 'resistant', 'vulnerable'].includes(String(entry.outcome)) ||
        !requiredText(entry.text, 1_000)
      )
    )
  ) {
    issues.push(issue(monsterId, '未解析条件伤害防御数据无效'))
  }
  if (raw.conditionImmunities != null && (!Array.isArray(raw.conditionImmunities) || raw.conditionImmunities.some((entry) => !requiredText(entry, 120)))) {
    issues.push(issue(monsterId, '状态免疫数据无效'))
  }
  if (raw.capabilities != null) {
    const capabilities = isRecord(raw.capabilities) ? raw.capabilities : null
    if (!capabilities || [
      'swarm', 'shapechanger', 'regeneration', 'spellcaster', 'legendary', 'hasFlySpeed', 'hasSwimSpeed',
    ].some((key) => typeof capabilities[key] !== 'boolean')) {
      issues.push(issue(monsterId, '能力标签数据无效'))
    }
  }
  if (raw.targetingPreference != null) {
    const preference = isRecord(raw.targetingPreference) ? raw.targetingPreference : null
    if (!preference || preference.schemaVersion !== 1 ||
      typeof preference.priority !== 'string' || !TARGET_PRIORITIES.has(preference.priority)) {
      issues.push(issue(monsterId, '自动攻击目标偏好无效'))
    }
  }
  if (raw.headlessMechanics != null) {
    if (!Array.isArray(raw.headlessMechanics) || raw.headlessMechanics.length > 32 ||
      raw.headlessMechanics.some((mechanic) => !mechanicShapeIsValid(mechanic))) {
      issues.push(issue(monsterId, '声明式怪物机制无效'))
    } else {
      const ids = raw.headlessMechanics.map((mechanic) => String((mechanic as Record<string, unknown>).id))
      if (new Set(ids).size !== ids.length) issues.push(issue(monsterId, '声明式怪物机制 ID 重复'))
    }
  }
  return issues
}

export function validateDnd5eMonsterSchema(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterSchemaIssue[] {
  const issues = validateCoreShape(monster)
  if (issues.length > 0) return issues
  const actionSectionById = new Map<string, string>()
  issues.push(...validateActionList(monster, monster.actions, '动作', actionSectionById))
  const optionalActionSections = [
    ['附赠动作', monster.bonusActions],
    ['反应', monster.reactions],
    ['传奇动作', monster.legendaryActions],
    ['巢穴动作', monster.lairActions],
  ] as const
  for (const [label, actions] of optionalActionSections) {
    if (Array.isArray(actions)) {
      issues.push(...validateActionList(monster, actions, label, actionSectionById))
    }
  }
  for (const action of [
    ...monster.actions,
    ...(monster.bonusActions ?? []),
    ...(monster.legendaryActions ?? []),
    ...(monster.lairActions ?? []),
  ]) {
    if (action.rule?.kind !== 'parry') continue
    issues.push({
      monsterId: monster.id,
      actionId: action.id,
      code: 'invalid-stat-block',
      message: 'Parry 只能声明在反应动作分区中',
    })
  }
  const allActions = [
    ...monster.actions,
    ...optionalActionSections.flatMap(([, actions]) => actions ?? []),
  ]
  const sourceLinkedRelationSignatures = new Map<string, string>()
  for (const action of allActions) {
    for (const effect of action.attack?.onHitEffects ?? []) {
      if (effect.kind !== 'source-linked-condition') continue
      const relation = effect.relation
      const signature = JSON.stringify({
        kind: relation.kind,
        capacity: relation.capacity,
        maxDistanceFeet: relation.maxDistanceFeet,
        targetMaxSizeRank: relation.targetMaxSizeRank,
        whenCapacityFull: relation.whenCapacityFull,
        attackAdvantageAgainstLinkedTarget:
          relation.attackAdvantageAgainstLinkedTarget === true,
      })
      const existing = sourceLinkedRelationSignatures.get(relation.slotGroup)
      if (existing != null && existing !== signature) {
        issues.push({
          monsterId: monster.id,
          actionId: action.id,
          code: 'invalid-stat-block',
          message: `同一关系槽位 ${relation.slotGroup} 的容量或关系语义不一致`,
        })
      } else {
        sourceLinkedRelationSignatures.set(relation.slotGroup, signature)
      }
    }
  }
  for (const action of allActions) {
    const requirement = action.relationRequirement
    if (
      requirement != null &&
      !sourceLinkedRelationSignatures.has(requirement.slotGroup)
    ) {
      issues.push({
        monsterId: monster.id,
        actionId: action.id,
        code: 'invalid-stat-block',
        message: `动作引用了未声明的关系槽位：${requirement.slotGroup}`,
      })
    }
  }
  for (const action of monster.legendaryActions ?? []) {
    if (action.referencedActionId && !monster.actions.some((candidate) => candidate.id === action.referencedActionId)) {
      issues.push({
        monsterId: monster.id,
        actionId: action.id,
        code: 'invalid-stat-block',
        message: `传奇动作引用了不存在的普通动作：${action.referencedActionId}`,
      })
    }
  }
  for (const equipment of monster.equipment ?? []) {
    if (equipment.linkedActionId && !monster.actions.some((candidate) => candidate.id === equipment.linkedActionId)) {
      issues.push({
        monsterId: monster.id,
        actionId: equipment.linkedActionId,
        code: 'invalid-stat-block',
        message: `装备引用了不存在的动作：${equipment.linkedActionId}`,
      })
    }
  }
  return issues
}

export function parseDnd5eMonsterStatBlock(raw: unknown):
  | { ok: true; value: Dnd5eMonsterStatBlock }
  | { ok: false; issues: Dnd5eMonsterSchemaIssue[] } {
  const coreIssues = validateCoreShape(raw)
  if (coreIssues.length > 0) return { ok: false, issues: coreIssues }
  const monster = structuredClone(raw) as Dnd5eMonsterStatBlock
  const issues = validateDnd5eMonsterSchema(monster)
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: monster }
}

export function validateDnd5eMonsterCatalog(monsters: readonly Dnd5eMonsterStatBlock[]): Dnd5eMonsterSchemaIssue[] {
  const issues = monsters.flatMap(validateDnd5eMonsterSchema)
  const ids = new Set<string>()
  const slugs = new Set<string>()
  for (const monster of monsters) {
    if (ids.has(monster.id)) issues.push({ monsterId: monster.id, code: 'duplicate-monster-id', message: `怪物 ID 重复：${monster.id}` })
    else ids.add(monster.id)
    if (slugs.has(monster.slug)) issues.push({ monsterId: monster.id, code: 'duplicate-monster-slug', message: `怪物 slug 重复：${monster.slug}` })
    else slugs.add(monster.slug)
  }
  return issues
}
