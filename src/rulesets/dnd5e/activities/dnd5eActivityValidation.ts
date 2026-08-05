import {
  validateAutomationCapability,
  type AutomationPhase,
} from '../../../domain/automation/automationCapability'
import { DND5E_STANDARD_CONDITION_IDS } from '../conditions'
import { DND5E_DAMAGE_TYPES } from '../damageTypes'
import type {
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityTargetV1,
} from './dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1, Dnd5eEffectDurationV1, Dnd5eTriggerDefinitionV1 } from './dnd5eEffectContracts'
import { validateDnd5eFormulaV1 } from './dnd5eFormula'

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const ABILITIES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const DAMAGE_TYPES = new Set<string>(DND5E_DAMAGE_TYPES)
const CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function finiteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function appendFormulaErrors(errors: string[], value: unknown, label: string): void {
  errors.push(...validateDnd5eFormulaV1(value, label))
}

function validateDuration(duration: Dnd5eEffectDurationV1, label: string, errors: string[]): void {
  if (duration.kind === 'instantaneous' || duration.kind === 'permanent') return
  if (duration.kind === 'rounds') {
    if (!finiteInteger(duration.rounds, 1, 10_000)) errors.push(`${label}.rounds is invalid`)
    if (!['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end'].includes(duration.expiresAt)) {
      errors.push(`${label}.expiresAt is invalid`)
    }
    return
  }
  if (duration.kind === 'concentration') {
    if (!finiteInteger(duration.maximumRounds, 1, 14_400)) errors.push(`${label}.maximumRounds is invalid`)
    return
  }
  if (duration.kind === 'save-ends') {
    if (!finiteInteger(duration.maximumRounds, 1, 10_000)) errors.push(`${label}.maximumRounds is invalid`)
    if (!ABILITIES.has(duration.ability)) errors.push(`${label}.ability is invalid`)
    if (duration.timing !== 'target-turn-end') errors.push(`${label}.timing is invalid`)
    appendFormulaErrors(errors, duration.dc, `${label}.dc`)
    return
  }
  errors.push(`${label}.kind is invalid`)
}

function validateTrigger(trigger: Dnd5eTriggerDefinitionV1, label: string, errors: string[]): void {
  if (!validId(trigger.id)) errors.push(`${label}.id is invalid`)
  if (!trigger.activityId && !trigger.effectId) errors.push(`${label} must reference an activity or effect`)
  if (trigger.activityId && !validId(trigger.activityId)) errors.push(`${label}.activityId is invalid`)
  if (trigger.effectId && !validId(trigger.effectId)) errors.push(`${label}.effectId is invalid`)
  if (trigger.activityId && trigger.effectId) errors.push(`${label} cannot reference both an activity and effect`)
  if (trigger.limit && (
    !finiteInteger(trigger.limit.uses, 1, 1_000) ||
    !['turn', 'round', 'combat', 'short-rest', 'long-rest', 'never'].includes(trigger.limit.reset)
  )) errors.push(`${label}.limit is invalid`)
}

function validateEffect(effect: Dnd5eEffectDefinitionV1, label: string, errors: string[]): void {
  if (effect.schemaVersion !== 1) errors.push(`${label}.schemaVersion is invalid`)
  if (!validId(effect.id)) errors.push(`${label}.id is invalid`)
  if (!effect.name.trim() || effect.name.length > 160) errors.push(`${label}.name is invalid`)
  validateDuration(effect.duration, `${label}.duration`, errors)
  if (effect.conditions?.some((condition) => !CONDITIONS.has(condition))) errors.push(`${label}.conditions is invalid`)
  for (const [index, modifier] of (effect.modifiers ?? []).entries()) {
    const modifierLabel = `${label}.modifiers[${index}]`
    if (
      modifier.kind === 'armor-class' || modifier.kind === 'speed' ||
      ((modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value)
    ) appendFormulaErrors(errors, modifier.value, `${modifierLabel}.value`)
    if (modifier.kind === 'saving-throw' && modifier.ability && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (
      (modifier.kind === 'damage-resistance' || modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability') &&
      !DAMAGE_TYPES.has(modifier.damageType)
    ) errors.push(`${modifierLabel}.damageType is invalid`)
    if (modifier.kind === 'condition-immunity' && !CONDITIONS.has(modifier.condition)) {
      errors.push(`${modifierLabel}.condition is invalid`)
    }
    if (modifier.kind === 'maximum-attacks-per-turn' && !finiteInteger(modifier.value, 0, 1_000)) {
      errors.push(`${modifierLabel}.value is invalid`)
    }
  }
  effect.triggers?.forEach((trigger, index) => validateTrigger(trigger, `${label}.triggers[${index}]`, errors))
}

/** Validates a standalone Effect contributed through the unified content API. */
export function validateDnd5eEffectDefinitionV1(effect: Dnd5eEffectDefinitionV1): readonly string[] {
  const errors: string[] = []
  validateEffect(effect, 'effect', errors)
  return errors
}

function validateTarget(target: Dnd5eActivityTargetV1, errors: string[]): void {
  if (target.kind === 'self') return
  if (target.kind === 'creature') {
    if (!finiteInteger(target.count, 1, 256)) errors.push('activity.target.count is invalid')
    if (target.rangeFeet != null && !finiteNumber(target.rangeFeet, 0, 100_000)) errors.push('activity.target.rangeFeet is invalid')
    if (target.minimumRangeFeet != null && !finiteNumber(target.minimumRangeFeet, 0, 100_000)) {
      errors.push('activity.target.minimumRangeFeet is invalid')
    }
    if (
      target.rangeFeet != null && target.minimumRangeFeet != null &&
      target.minimumRangeFeet > target.rangeFeet
    ) errors.push('activity.target range is inverted')
    return
  }
  if (!finiteInteger(target.maximumTargets, 1, 256)) errors.push('activity.target.maximumTargets is invalid')
  for (const [field, value] of Object.entries({
    placeRangeFeet: target.placeRangeFeet,
    radiusFeet: target.radiusFeet,
    lengthFeet: target.lengthFeet,
    widthFeet: target.widthFeet,
    heightFeet: target.heightFeet,
  })) {
    if (value != null && !finiteNumber(value, 1, 100_000)) errors.push(`activity.target.${field} is invalid`)
  }
  if ((target.shape === 'circle' || target.shape === 'sphere' || target.shape === 'cylinder') && target.radiusFeet == null) {
    errors.push('activity.target.radiusFeet is required')
  }
  if ((target.shape === 'cone' || target.shape === 'line') && target.lengthFeet == null) {
    errors.push('activity.target.lengthFeet is required')
  }
  if ((target.shape === 'line' || target.shape === 'rect') && target.widthFeet == null) {
    errors.push('activity.target.widthFeet is required')
  }
  if ((target.shape === 'cube' || target.shape === 'rect') && target.heightFeet == null) {
    errors.push('activity.target.heightFeet is required')
  }
  if (target.rotatable && (target.shape !== 'rect' || target.origin !== 'point')) {
    errors.push('only point-origin rectangles may rotate freely')
  }
}

function operationPhases(operation: Dnd5eActivityOperationV1): readonly AutomationPhase[] {
  if (operation.kind === 'damage') return ['damage']
  if (operation.kind === 'healing' || operation.kind === 'temporary-hit-points') return ['healing']
  if (operation.kind === 'resource') return ['cost']
  if (operation.kind === 'manual-adjudication') return []
  return ['effects']
}

export function dnd5eActivityRequiredPhases(activity: Dnd5eActivityDefinitionV1): readonly AutomationPhase[] {
  const phases = new Set<AutomationPhase>(['eligibility', 'targeting'])
  if (activity.consumption?.length) phases.add('cost')
  for (const check of activity.checks ?? []) {
    if (check.kind === 'attack-roll') phases.add('attack-roll')
    else if (check.kind === 'saving-throw') phases.add('saving-throw')
    else phases.add('eligibility')
  }
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) operationPhases(operation).forEach((phase) => phases.add(phase))
  }
  if (activity.effects?.some((effect) => effect.duration.kind !== 'instantaneous')) phases.add('duration')
  if (activity.triggers?.length || activity.effects?.some((effect) => effect.triggers?.length)) phases.add('interrupt')
  phases.add('persistence')
  return [...phases]
}

function validateOperation(operation: Dnd5eActivityOperationV1, label: string, errors: string[]): void {
  if (!validId(operation.id)) errors.push(`${label}.id is invalid`)
  if (operation.kind === 'damage') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    if (operation.damageType !== 'inherit-primary' && !DAMAGE_TYPES.has(operation.damageType)) {
      errors.push(`${label}.damageType is invalid`)
    }
    return
  }
  if (operation.kind === 'healing' || operation.kind === 'temporary-hit-points') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    return
  }
  if (operation.kind === 'apply-standard-condition') {
    if (!CONDITIONS.has(operation.condition)) errors.push(`${label}.condition is invalid`)
    validateDuration(operation.duration, `${label}.duration`, errors)
    return
  }
  if (operation.kind === 'remove-standard-condition') {
    if (!CONDITIONS.has(operation.condition)) errors.push(`${label}.condition is invalid`)
    return
  }
  if (operation.kind === 'resource') {
    if (!validId(operation.resourceId)) errors.push(`${label}.resourceId is invalid`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    return
  }
  if (operation.kind === 'move') {
    appendFormulaErrors(errors, operation.distanceFeet, `${label}.distanceFeet`)
    return
  }
  if (operation.kind === 'summon') {
    if (!validId(operation.monsterId)) errors.push(`${label}.monsterId is invalid`)
    appendFormulaErrors(errors, operation.count, `${label}.count`)
    if (!finiteInteger(operation.durationRounds, 1, 10_000)) errors.push(`${label}.durationRounds is invalid`)
    return
  }
  if (operation.kind === 'create-persistent-area') {
    if (!operation.label.trim() || operation.label.length > 120) errors.push(`${label}.label is invalid`)
    if (!finiteInteger(operation.durationRounds, 1, 14_400)) errors.push(`${label}.durationRounds is invalid`)
    if (operation.color != null && !/^#[0-9a-f]{6}$/i.test(operation.color)) errors.push(`${label}.color is invalid`)
    return
  }
  if (operation.kind === 'invoke-activity') {
    if (!validId(operation.activityId)) errors.push(`${label}.activityId is invalid`)
    appendFormulaErrors(errors, operation.repeat, `${label}.repeat`)
    return
  }
  if (operation.kind === 'manual-adjudication' && (
    !operation.prompt.trim() || !operation.reason.trim() || operation.requiresDmApproval !== true
  )) {
    errors.push(`${label} is an invalid manual adjudication`)
  }
}

export function validateDnd5eActivityDefinitionV1(activity: Dnd5eActivityDefinitionV1): readonly string[] {
  const errors: string[] = []
  if (activity.schemaVersion !== 1) errors.push('activity.schemaVersion is invalid')
  if (!validId(activity.id)) errors.push('activity.id is invalid')
  if (!activity.name.trim() || activity.name.length > 160) errors.push('activity.name is invalid')
  validateTarget(activity.target, errors)
  errors.push(...validateAutomationCapability(activity.automation).map((error) => `activity.automation: ${error}`))

  const checkIds = new Set<string>()
  for (const [index, check] of (activity.checks ?? []).entries()) {
    const label = `activity.checks[${index}]`
    if (!validId(check.id) || checkIds.has(check.id)) errors.push(`${label}.id is invalid or duplicated`)
    checkIds.add(check.id)
    if (!validId(check.rollId)) errors.push(`${label}.rollId is invalid`)
    if ('ability' in check && !ABILITIES.has(check.ability)) errors.push(`${label}.ability is invalid`)
    if (check.kind === 'attack-roll') {
      appendFormulaErrors(errors, check.attackBonus, `${label}.attackBonus`)
      if (!finiteInteger(check.criticalThreshold ?? 20, 1, 20)) errors.push(`${label}.criticalThreshold is invalid`)
    } else appendFormulaErrors(errors, check.dc, `${label}.dc`)
  }

  const outcomeIds = new Set<string>()
  const operationIds = new Set<string>()
  for (const [outcomeIndex, outcome] of activity.outcomes.entries()) {
    const label = `activity.outcomes[${outcomeIndex}]`
    if (!validId(outcome.id) || outcomeIds.has(outcome.id)) errors.push(`${label}.id is invalid or duplicated`)
    outcomeIds.add(outcome.id)
    if (outcome.when.kind === 'check' && !checkIds.has(outcome.when.checkId)) {
      errors.push(`${label}.when references an unknown check`)
    }
    if (!outcome.operations.length) errors.push(`${label}.operations is empty`)
    outcome.operations.forEach((operation, operationIndex) => {
      const operationLabel = `${label}.operations[${operationIndex}]`
      validateOperation(operation, operationLabel, errors)
      if (operationIds.has(operation.id)) errors.push(`${operationLabel}.id is duplicated`)
      operationIds.add(operation.id)
    })
  }
  if (!activity.outcomes.length) errors.push('activity.outcomes is empty')

  for (const [index, consumption] of (activity.consumption ?? []).entries()) {
    const label = `activity.consumption[${index}]`
    if ('amount' in consumption && typeof consumption.amount === 'object') {
      appendFormulaErrors(errors, consumption.amount, `${label}.amount`)
    }
    if ('resourceId' in consumption && !validId(consumption.resourceId)) errors.push(`${label}.resourceId is invalid`)
  }
  activity.effects?.forEach((effect, index) => validateEffect(effect, `activity.effects[${index}]`, errors))
  activity.triggers?.forEach((trigger, index) => validateTrigger(trigger, `activity.triggers[${index}]`, errors))

  const covered = new Set<AutomationPhase>([
    ...activity.automation.supportedPhases,
    ...activity.automation.manualPhases,
  ])
  for (const phase of dnd5eActivityRequiredPhases(activity)) {
    if (!covered.has(phase)) errors.push(`activity.automation does not classify required phase: ${phase}`)
  }
  const hasManualOperation = activity.outcomes.some((outcome) =>
    outcome.operations.some((operation) => operation.kind === 'manual-adjudication'))
  if (hasManualOperation && activity.automation.level === 'full') {
    errors.push('full automation cannot contain manual adjudication operations')
  }
  return errors
}
