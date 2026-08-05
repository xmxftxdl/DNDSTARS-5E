import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type {
  Dnd5eActivityAreaInstanceV1,
  Dnd5eActivityAreaPlacementV1,
  Dnd5eActivityCheckV1,
  Dnd5eActivityConsumptionV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationTargetV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityScalingV1,
} from './dnd5eActivityContracts'
import type { Dnd5eEffectDurationV1, Dnd5ePredicateV1 } from './dnd5eEffectContracts'
import {
  Dnd5eFormulaEvaluationError,
  evaluateDnd5eFormulaV1,
  type Dnd5eFormulaActorSnapshot,
  type Dnd5eFormulaEvaluationContext,
  type Dnd5eFormulaRollResult,
  type Dnd5eFormulaV1,
} from './dnd5eFormula'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

export interface Dnd5eActivityActorSnapshot extends Dnd5eFormulaActorSnapshot {
  id: string
  controller: string
  armorClass: number
  conditions: readonly Dnd5eStandardConditionId[]
  savingThrowModifiers?: Partial<Record<AbilityKey, number>>
  abilityCheckModifiers?: Partial<Record<AbilityKey, number>>
}

export type Dnd5eActivityRollMode = 'normal' | 'advantage' | 'disadvantage'

export interface Dnd5eActivityExecutionInput {
  activity: Dnd5eActivityDefinitionV1
  actor: Dnd5eActivityActorSnapshot
  targets: readonly Dnd5eActivityActorSnapshot[]
  castLevel?: number
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  distanceFeetByTargetId?: Readonly<Record<string, number>>
  areaPlacement?: Dnd5eActivityAreaPlacementV1
  areaPlacementDistanceFeet?: number
  projectileTargetIds?: readonly string[]
  parentDamageType?: Dnd5eDamageType
  choices?: Readonly<Record<string, string>>
  usedTurnKeys?: ReadonlySet<string>
  dmApproved?: boolean
}

export interface Dnd5eActivityCheckResult {
  key: string
  checkId: string
  targetId?: string
  d20: number
  modifier: number
  total: number
  success: boolean
  criticalSuccess: boolean
  criticalFailure: boolean
}

export type Dnd5eResolvedActivityConsumption =
  | Extract<Dnd5eActivityConsumptionV1, { kind: 'action-economy' | 'spell-slot' }>
  | { kind: 'resource' | 'item-charge' | 'ammo' | 'hit-die'; resourceId: string; amount: number; consumeOn: 'confirm' | 'hit' | 'resolve' | 'dm-approval' }
  | { kind: 'hp' | 'movement'; amount: number; consumeOn: 'confirm' | 'resolve' }

export type Dnd5eResolvedEffectDuration =
  | Exclude<Dnd5eEffectDurationV1, { kind: 'save-ends' }>
  | { kind: 'save-ends'; maximumRounds: number; timing: 'target-turn-end'; ability: AbilityKey; dc: number }

export type Dnd5eActivityCapabilityProposal =
  | { kind: 'deal-damage'; operationId: string; targetId: string; amount: number; damageType: Dnd5eDamageType; magical: boolean }
  | { kind: 'heal'; operationId: string; targetId: string; amount: number }
  | { kind: 'grant-temporary-hit-points'; operationId: string; targetId: string; amount: number }
  | { kind: 'apply-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId; duration: Dnd5eResolvedEffectDuration }
  | { kind: 'remove-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId }
  | { kind: 'spend-resource' | 'restore-resource'; operationId: string; subjectId: string; resourceId: string; amount: number }
  | { kind: 'move'; operationId: string; targetId: string; mode: 'push' | 'pull' | 'teleport'; distanceFeet: number }
  | {
      kind: 'summon'
      operationId: string
      monsterId: string
      count: number
      timing: 'immediate' | 'source-next-turn-start'
      durationRounds: number
      concentration: boolean
      side: 'ally' | 'enemy'
    }
  | {
      kind: 'create-persistent-area'
      operationId: string
      label: string
      durationRounds: number
      concentration: boolean
      color?: string
      visual?: import('../persistentAreaTypes').Dnd5ePersistentAreaVisual
      areaInstance?: Dnd5eActivityAreaInstanceV1
    }
  | { kind: 'invoke-activity'; operationId: string; activityId: string; actorId: string; targetId?: string; repeat: number }
  | { kind: 'request-dm-adjudication'; operationId: string; prompt: string; reason: string }

export type Dnd5eActivityExecutionResult =
  | {
      ok: true
      status: 'resolved' | 'dm-adjudication-required'
      checks: readonly Dnd5eActivityCheckResult[]
      consumptions: readonly Dnd5eResolvedActivityConsumption[]
      proposals: readonly Dnd5eActivityCapabilityProposal[]
      areaInstance?: Dnd5eActivityAreaInstanceV1
    }
  | {
      ok: false
      reason: 'invalid-definition' | 'invalid-actor' | 'invalid-target' | 'requirement-failed' | 'invalid-rolls' | 'dm-approval-required'
      details: readonly string[]
    }

function relation(actor: Dnd5eActivityActorSnapshot, target: Dnd5eActivityActorSnapshot): 'self' | 'ally' | 'enemy' {
  if (actor.id === target.id) return 'self'
  return actor.controller === target.controller ? 'ally' : 'enemy'
}

function scalingSteps(scaling: Dnd5eActivityScalingV1, input: Dnd5eActivityExecutionInput): number {
  if (scaling.basis === 'custom-table') {
    const level = input.actor.level
    const entry = [...(scaling.table ?? [])]
      .filter((candidate) => candidate.level <= level && typeof candidate.value === 'number')
      .sort((left, right) => right.level - left.level)[0]
    return Math.max(0, Math.floor(typeof entry?.value === 'number' ? entry.value : 0))
  }
  const value = scaling.basis === 'slot-level'
    ? input.castLevel ?? 0
    : scaling.basis === 'character-level'
      ? input.actor.level
      : scaling.basis === 'class-level'
        ? input.actor.classLevels?.[scaling.classId ?? ''] ?? 0
        : input.actor.proficiencyBonus
  return Math.max(0, Math.floor(value - (scaling.baseLevel ?? 0)))
}

function addDiceCount(formula: Dnd5eFormulaV1, amount: number): Dnd5eFormulaV1 {
  if (amount === 0) return formula
  if (formula.kind === 'dice') return { ...formula, count: Math.max(0, formula.count + amount) }
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round') {
    return { ...formula, value: addDiceCount(formula.value, amount) }
  }
  if (formula.kind === 'clamp') return { ...formula, value: addDiceCount(formula.value, amount) }
  if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
    const diceIndex = formula.values.findIndex((value) => value.kind === 'dice' ||
      value.kind === 'floor' || value.kind === 'ceil' || value.kind === 'round' || value.kind === 'clamp' ||
      value.kind === 'add' || value.kind === 'multiply' || value.kind === 'minimum' || value.kind === 'maximum')
    if (diceIndex < 0) return formula
    return { ...formula, values: formula.values.map((value, index) => index === diceIndex ? addDiceCount(value, amount) : value) }
  }
  return formula
}

function addFlatAmount(formula: Dnd5eFormulaV1, amount: number): Dnd5eFormulaV1 {
  if (amount === 0) return formula
  return { kind: 'add', values: [formula, { kind: 'constant', value: amount }] }
}

function scaledOperation(
  operation: Dnd5eActivityOperationV1,
  diceCount: number,
  flatAmount: number,
  durationRounds: number,
): Dnd5eActivityOperationV1 {
  let scaled = operation
  if ('amount' in scaled && (diceCount !== 0 || flatAmount !== 0)) {
    scaled = { ...scaled, amount: addFlatAmount(addDiceCount(scaled.amount, diceCount), flatAmount) }
  }
  if (durationRounds !== 0) {
    if (scaled.kind === 'summon' || scaled.kind === 'create-persistent-area') {
      scaled = { ...scaled, durationRounds: Math.max(1, scaled.durationRounds + durationRounds) }
    } else if (scaled.kind === 'apply-standard-condition' && scaled.duration.kind === 'rounds') {
      scaled = { ...scaled, duration: { ...scaled.duration, rounds: Math.max(1, scaled.duration.rounds + durationRounds) } }
    }
  }
  return scaled
}

function scaleActivity(input: Dnd5eActivityExecutionInput): {
  activity: Dnd5eActivityDefinitionV1
  additionalProjectilesByOperationId: ReadonlyMap<string, number>
} {
  const totals = new Map<string, { dice: number; flat: number; targets: number; projectiles: number; duration: number }>()
  for (const scaling of input.activity.scaling ?? []) {
    const steps = scalingSteps(scaling, input)
    for (const adjustment of scaling.adjustments ?? []) {
      const current = totals.get(adjustment.operationId) ?? { dice: 0, flat: 0, targets: 0, projectiles: 0, duration: 0 }
      current.dice += (adjustment.diceCountPerStep ?? 0) * steps
      current.flat += (adjustment.flatAmountPerStep ?? 0) * steps
      current.targets += (adjustment.additionalTargetsPerStep ?? 0) * steps
      current.projectiles += (adjustment.additionalProjectilesPerStep ?? 0) * steps
      current.duration += (adjustment.durationRoundsPerStep ?? 0) * steps
      totals.set(adjustment.operationId, current)
    }
  }
  const extraTargets = [...totals.values()].reduce((maximum, value) => Math.max(maximum, value.targets), 0)
  const target = input.activity.target.kind === 'creature'
    ? { ...input.activity.target, count: input.activity.target.count + extraTargets }
    : input.activity.target.kind === 'area'
      ? { ...input.activity.target, maximumTargets: input.activity.target.maximumTargets + extraTargets }
      : input.activity.target
  return {
    activity: {
      ...input.activity,
      target,
      outcomes: input.activity.outcomes.map((outcome) => ({
        ...outcome,
        operations: outcome.operations.map((operation) => {
          const total = totals.get(operation.id)
          return total ? scaledOperation(operation, total.dice, total.flat, total.duration) : operation
        }),
      })),
    },
    additionalProjectilesByOperationId: new Map([...totals].map(([id, value]) => [id, value.projectiles])),
  }
}

function formulaContext(
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
  diceMultiplierByRollId?: Readonly<Record<string, number>>,
): Dnd5eFormulaEvaluationContext {
  const rolls: Record<string, Dnd5eFormulaRollResult> = { ...input.rolls }
  if (target) {
    const suffix = `:${target.id}`
    for (const [key, value] of Object.entries(input.rolls)) {
      if (key.endsWith(suffix)) rolls[key.slice(0, -suffix.length)] = value
    }
  }
  return {
    actor: input.actor,
    target,
    castLevel: input.castLevel,
    rolls,
    diceMultiplierByRollId,
  }
}

function predicateSatisfied(
  predicate: Dnd5ePredicateV1,
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
): boolean {
  const subject = 'subject' in predicate && predicate.subject === 'target' ? target : input.actor
  if (predicate.kind === 'minimum-level') return input.actor.level >= predicate.level
  if (predicate.kind === 'class-level') return (input.actor.classLevels?.[predicate.classId] ?? 0) >= predicate.minimum
  if (predicate.kind === 'hp-percentage') {
    if (subject?.currentHp == null || subject.maxHp == null || subject.maxHp <= 0) return false
    const percentage = (subject.currentHp / subject.maxHp) * 100
    return predicate.comparison === 'at-most' ? percentage <= predicate.value : percentage >= predicate.value
  }
  if (predicate.kind === 'hp-value') {
    if (subject?.currentHp == null) return false
    if (predicate.comparison === 'below') return subject.currentHp < predicate.value
    if (predicate.comparison === 'at-most') return subject.currentHp <= predicate.value
    if (predicate.comparison === 'at-least') return subject.currentHp >= predicate.value
    return subject.currentHp > predicate.value
  }
  if (predicate.kind === 'condition') {
    if (!subject) return false
    return subject.conditions.includes(predicate.condition) === predicate.present
  }
  if (predicate.kind === 'target-relation') {
    if (!target) return predicate.relation === 'any'
    const actual = relation(input.actor, target)
    return predicate.relation === 'any' || predicate.relation === actual || (predicate.relation === 'ally' && actual === 'self')
  }
  if (predicate.kind === 'distance') {
    if (!target) return false
    const distance = input.distanceFeetByTargetId?.[target.id]
    return distance != null && distance >= (predicate.minimumFeet ?? 0) && distance <= (predicate.maximumFeet ?? Number.POSITIVE_INFINITY)
  }
  if (predicate.kind === 'resource') {
    const resource = input.actor.resources?.[predicate.resourceId]
    if (!resource) return false
    return resource.current >= evaluateDnd5eFormulaV1(predicate.minimum, formulaContext(input, target))
  }
  if (predicate.kind === 'once-per-turn') return !input.usedTurnKeys?.has(predicate.key)
  return input.choices?.[predicate.choiceId] === predicate.optionId
}

function selectedD20(values: readonly number[], mode: Dnd5eActivityRollMode): number {
  const required = mode === 'normal' ? 1 : 2
  if (values.length !== required || values.some((value) => !Number.isInteger(value) || value < 1 || value > 20)) {
    throw new Dnd5eFormulaEvaluationError('invalid d20 result')
  }
  if (mode === 'advantage') return Math.max(values[0]!, values[1]!)
  if (mode === 'disadvantage') return Math.min(values[0]!, values[1]!)
  return values[0]!
}

function checkKey(check: Dnd5eActivityCheckV1, target?: Dnd5eActivityActorSnapshot): string {
  return check.scope === 'per-target' && target ? `${check.id}:${target.id}` : check.id
}

function checkRollKey(check: Dnd5eActivityCheckV1, target?: Dnd5eActivityActorSnapshot): string {
  return check.scope === 'per-target' && target ? `${check.rollId}:${target.id}` : check.rollId
}

function resolveCheck(
  check: Dnd5eActivityCheckV1,
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
): Dnd5eActivityCheckResult {
  const key = checkKey(check, target)
  const declaredMode = check.rollMode ?? 'normal'
  const mode = declaredMode === 'host-derived' ? input.checkRollModes?.[key] : declaredMode
  if (!mode) throw new Dnd5eFormulaEvaluationError(`missing Host roll mode: ${key}`)
  const roll = input.rolls[checkRollKey(check, target)]
  if (!roll) throw new Dnd5eFormulaEvaluationError(`missing d20 result: ${key}`)
  const d20 = selectedD20(roll.values, mode)
  let modifier: number
  let dc: number
  let success: boolean
  if (check.kind === 'attack-roll') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`attack target is unavailable: ${key}`)
    modifier = evaluateDnd5eFormulaV1(check.attackBonus, formulaContext(input, target))
    dc = target.armorClass
    success = d20 >= (check.criticalThreshold ?? 20) || (d20 !== 1 && d20 + modifier >= dc)
  } else if (check.kind === 'saving-throw') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`saving throw target is unavailable: ${key}`)
    modifier = target.savingThrowModifiers?.[check.ability] ?? Math.floor((target.abilities[check.ability] - 10) / 2)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    success = d20 + modifier >= dc
  } else {
    modifier = input.actor.abilityCheckModifiers?.[check.ability] ?? Math.floor((input.actor.abilities[check.ability] - 10) / 2)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    success = d20 + modifier >= dc
  }
  return {
    key,
    checkId: check.id,
    targetId: target?.id,
    d20,
    modifier,
    total: d20 + modifier,
    success,
    criticalSuccess: d20 >= (check.kind === 'attack-roll' ? check.criticalThreshold ?? 20 : 20),
    criticalFailure: d20 === 1,
  }
}

function operationTargets(
  targetKind: Dnd5eActivityOperationTargetV1,
  input: Dnd5eActivityExecutionInput,
  currentTarget?: Dnd5eActivityActorSnapshot,
): readonly Dnd5eActivityActorSnapshot[] {
  if (targetKind === 'actor') return [input.actor]
  if (targetKind === 'all-targets') return input.targets
  return currentTarget ? [currentTarget] : input.targets
}

function formulaDiceRollIds(formula: Dnd5eFormulaV1): readonly string[] {
  if (formula.kind === 'dice') return [formula.rollId]
  if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
    return formula.values.flatMap(formulaDiceRollIds)
  }
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round' || formula.kind === 'clamp') {
    return formulaDiceRollIds(formula.value)
  }
  return []
}

function evaluateAmount(
  formula: Dnd5eFormulaV1,
  input: Dnd5eActivityExecutionInput,
  target: Dnd5eActivityActorSnapshot | undefined,
  critical: boolean,
  doubleDice: boolean,
): number {
  const multipliers = critical && doubleDice
    ? Object.fromEntries(formulaDiceRollIds(formula).map((rollId) => [rollId, 2]))
    : undefined
  return Math.max(0, Math.floor(evaluateDnd5eFormulaV1(formula, formulaContext(input, target, multipliers))))
}

function resolveEffectDuration(
  duration: Dnd5eEffectDurationV1,
  input: Dnd5eActivityExecutionInput,
  target: Dnd5eActivityActorSnapshot,
): Dnd5eResolvedEffectDuration {
  if (duration.kind !== 'save-ends') return duration
  return {
    ...duration,
    dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(duration.dc, formulaContext(input, target)))),
  }
}

function resolveConsumption(
  consumption: Dnd5eActivityConsumptionV1,
  input: Dnd5eActivityExecutionInput,
): Dnd5eResolvedActivityConsumption {
  if (consumption.kind === 'action-economy' || consumption.kind === 'spell-slot') return consumption
  return {
    ...consumption,
    amount: evaluateAmount(consumption.amount, input, input.actor, false, false),
  }
}

function operationProposals(
  operation: Dnd5eActivityOperationV1,
  input: Dnd5eActivityExecutionInput,
  currentTarget: Dnd5eActivityActorSnapshot | undefined,
  critical: boolean,
): readonly Dnd5eActivityCapabilityProposal[] {
  if (operation.kind === 'manual-adjudication') {
    return [{ kind: 'request-dm-adjudication', operationId: operation.id, prompt: operation.prompt, reason: operation.reason }]
  }
  if (operation.kind === 'summon') {
    return [{
      kind: 'summon', operationId: operation.id, monsterId: operation.monsterId,
      count: evaluateAmount(operation.count, input, currentTarget, false, false),
      timing: operation.timing, durationRounds: operation.durationRounds,
      concentration: operation.concentration, side: operation.side,
    }]
  }
  if (operation.kind === 'create-persistent-area') {
    return [{
      kind: 'create-persistent-area', operationId: operation.id, label: operation.label,
      durationRounds: operation.durationRounds, concentration: operation.concentration,
      color: operation.color, visual: operation.visual,
      areaInstance: input.activity.target.kind === 'area' && input.areaPlacement
        ? {
            ...input.areaPlacement,
            origin: input.activity.target.origin,
            shape: input.activity.target.shape,
            radiusFeet: input.activity.target.radiusFeet,
            lengthFeet: input.activity.target.lengthFeet,
            widthFeet: input.activity.target.widthFeet,
            heightFeet: input.activity.target.heightFeet,
          }
        : undefined,
    }]
  }
  if (operation.kind === 'invoke-activity') {
    return [{
      kind: 'invoke-activity', operationId: operation.id, activityId: operation.activityId,
      actorId: input.actor.id,
      targetId: operation.target === 'target' ? currentTarget?.id : input.actor.id,
      repeat: evaluateAmount(operation.repeat, input, currentTarget, false, false),
    }]
  }
  if (operation.kind === 'resource') {
    const subject = operation.subject === 'actor' ? input.actor : currentTarget
    if (!subject) return []
    return [{
      kind: operation.mode === 'spend' ? 'spend-resource' : 'restore-resource',
      operationId: operation.id,
      subjectId: subject.id,
      resourceId: operation.resourceId,
      amount: evaluateAmount(operation.amount, input, currentTarget, false, false),
    }]
  }
  return operationTargets(operation.target, input, currentTarget).map((target): Dnd5eActivityCapabilityProposal => {
    if (operation.kind === 'damage') {
      const damageType = operation.damageType === 'inherit-primary' ? input.parentDamageType : operation.damageType
      if (!damageType) throw new Dnd5eFormulaEvaluationError('parent damage type is unavailable')
      return {
        kind: 'deal-damage', operationId: operation.id, targetId: target.id,
        amount: evaluateAmount(operation.amount, input, target, critical, operation.critical === 'double-dice'),
        damageType, magical: operation.magical === true,
      }
    }
    if (operation.kind === 'healing') return {
      kind: 'heal', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false),
    }
    if (operation.kind === 'temporary-hit-points') return {
      kind: 'grant-temporary-hit-points', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false),
    }
    if (operation.kind === 'apply-standard-condition') return {
      kind: 'apply-standard-condition', operationId: operation.id, targetId: target.id,
      condition: operation.condition, duration: resolveEffectDuration(operation.duration, input, target),
    }
    if (operation.kind === 'remove-standard-condition') return {
      kind: 'remove-standard-condition', operationId: operation.id, targetId: target.id,
      condition: operation.condition,
    }
    if (operation.kind === 'move') return {
      kind: 'move', operationId: operation.id, targetId: target.id, mode: operation.mode,
      distanceFeet: evaluateAmount(operation.distanceFeet, input, target, false, false),
    }
    throw new Dnd5eFormulaEvaluationError(`unsupported Activity operation: ${operation.kind}`)
  })
}

export function resolveDnd5eActivity(input: Dnd5eActivityExecutionInput): Dnd5eActivityExecutionResult {
  const definitionErrors = validateDnd5eActivityDefinitionV1(input.activity)
  if (definitionErrors.length) return { ok: false, reason: 'invalid-definition', details: definitionErrors }
  const scaled = scaleActivity(input)
  const activity = scaled.activity
  const executionInput: Dnd5eActivityExecutionInput = { ...input, activity }
  if (!input.actor.id || input.actor.level < 1 || input.actor.armorClass < 0) {
    return { ok: false, reason: 'invalid-actor', details: ['invalid actor snapshot'] }
  }
  if (activity.target.kind === 'self' && (input.targets.length !== 1 || input.targets[0]?.id !== input.actor.id)) {
    return { ok: false, reason: 'invalid-target', details: ['self Activity requires the actor as its only target'] }
  }
  if (activity.target.kind === 'creature') {
    if (input.targets.length < 1 || input.targets.length > activity.target.count) {
      return { ok: false, reason: 'invalid-target', details: ['target count is invalid'] }
    }
    for (const target of input.targets) {
      const actual = relation(input.actor, target)
      if (!activity.target.includeSelf && actual === 'self') {
        return { ok: false, reason: 'invalid-target', details: ['self targeting is unavailable'] }
      }
      if (activity.target.relation !== 'any' && activity.target.relation !== actual && !(activity.target.relation === 'ally' && actual === 'self')) {
        return { ok: false, reason: 'invalid-target', details: ['target relation is invalid'] }
      }
      const distance = input.distanceFeetByTargetId?.[target.id]
      if (
        activity.target.rangeFeet != null &&
        (distance == null || distance > activity.target.rangeFeet || distance < (activity.target.minimumRangeFeet ?? 0))
      ) return { ok: false, reason: 'invalid-target', details: ['target distance is invalid'] }
    }
  }
  let areaInstance: Dnd5eActivityAreaInstanceV1 | undefined
  if (activity.target.kind === 'area') {
    if (input.targets.length > activity.target.maximumTargets) {
      return { ok: false, reason: 'invalid-target', details: ['area target count is invalid'] }
    }
    if (!input.areaPlacement) return { ok: false, reason: 'invalid-target', details: ['area placement is required'] }
    for (const target of input.targets) {
      const actual = relation(input.actor, target)
      if (!activity.target.includeSelf && actual === 'self') {
        return { ok: false, reason: 'invalid-target', details: ['self targeting is unavailable'] }
      }
      if (activity.target.relation !== 'any' && activity.target.relation !== actual && !(activity.target.relation === 'ally' && actual === 'self')) {
        return { ok: false, reason: 'invalid-target', details: ['target relation is invalid'] }
      }
    }
    if (
      activity.target.origin === 'point' && activity.target.placeRangeFeet != null &&
      (input.areaPlacementDistanceFeet == null || input.areaPlacementDistanceFeet < 0 ||
        input.areaPlacementDistanceFeet > activity.target.placeRangeFeet)
    ) return { ok: false, reason: 'invalid-target', details: ['area placement distance is invalid'] }
    if (!activity.target.rotatable && input.areaPlacement.angleDegrees != null && input.areaPlacement.angleDegrees !== 0) {
      return { ok: false, reason: 'invalid-target', details: ['area rotation is unavailable'] }
    }
    areaInstance = {
      ...input.areaPlacement,
      angleDegrees: input.areaPlacement.angleDegrees == null
        ? undefined
        : ((input.areaPlacement.angleDegrees % 360) + 360) % 360,
      origin: activity.target.origin,
      shape: activity.target.shape,
      radiusFeet: activity.target.radiusFeet,
      lengthFeet: activity.target.lengthFeet,
      widthFeet: activity.target.widthFeet,
      heightFeet: activity.target.heightFeet,
    }
    executionInput.areaPlacement = {
      x: areaInstance.x,
      y: areaInstance.y,
      elevationFeet: areaInstance.elevationFeet,
      angleDegrees: areaInstance.angleDegrees,
    }
  }
  const projectileTargets = input.projectileTargetIds?.map((id) => input.targets.find((target) => target.id === id))
  if (projectileTargets?.some((target) => !target)) {
    return { ok: false, reason: 'invalid-target', details: ['projectile target is unavailable'] }
  }
  try {
    for (const predicate of activity.requirements ?? []) {
      const targets = input.targets.length ? input.targets : [undefined]
      if (!targets.every((target) => predicateSatisfied(predicate, executionInput, target))) {
        return { ok: false, reason: 'requirement-failed', details: [`requirement failed: ${predicate.kind}`] }
      }
    }
  } catch (error) {
    return { ok: false, reason: 'requirement-failed', details: [error instanceof Error ? error.message : String(error)] }
  }
  if (activity.automation.level === 'dm-adjudication' && !input.dmApproved) {
    return { ok: false, reason: 'dm-approval-required', details: [...activity.automation.limitations] }
  }
  try {
    const checks: Dnd5eActivityCheckResult[] = []
    for (const check of activity.checks ?? []) {
      if (check.scope === 'per-target') input.targets.forEach((target) => checks.push(resolveCheck(check, executionInput, target)))
      else checks.push(resolveCheck(check, executionInput, input.targets[0]))
    }
    const proposals: Dnd5eActivityCapabilityProposal[] = []
    const appliedOnce = new Set<string>()
    for (const outcome of activity.outcomes) {
      const resolvedProjectileTargets = projectileTargets?.filter((target): target is Dnd5eActivityActorSnapshot => target != null)
      const candidateTargets = resolvedProjectileTargets?.length ? resolvedProjectileTargets : input.targets.length ? input.targets : [undefined]
      for (const target of candidateTargets) {
        const when = outcome.when
        const check = when.kind === 'check'
          ? checks.find((candidate) => candidate.checkId === when.checkId &&
              (candidate.targetId == null || candidate.targetId === target?.id))
          : undefined
        const applies = when.kind === 'always' || !!check && (
          (when.result === 'success' && check.success) ||
          (when.result === 'failure' && !check.success) ||
          (when.result === 'critical-success' && check.criticalSuccess) ||
          (when.result === 'critical-failure' && check.criticalFailure)
        )
        if (!applies) continue
        for (const operation of outcome.operations) {
          const once = operation.kind === 'summon' || operation.kind === 'create-persistent-area' ||
            operation.kind === 'invoke-activity' || operation.kind === 'manual-adjudication' ||
            ('target' in operation && (operation.target === 'actor' || operation.target === 'all-targets'))
          const onceKey = `${outcome.id}:${operation.id}`
          if (once && appliedOnce.has(onceKey)) continue
          const repeats = input.projectileTargetIds?.length
            ? 1
            : 1 + Math.max(0, scaled.additionalProjectilesByOperationId.get(operation.id) ?? 0)
          for (let repeat = 0; repeat < repeats; repeat += 1) {
            operationProposals(operation, executionInput, target, check?.criticalSuccess === true)
              .forEach((proposal) => proposals.push(proposal))
          }
          if (once) appliedOnce.add(onceKey)
        }
      }
    }
    return {
      ok: true,
      status: proposals.some((proposal) => proposal.kind === 'request-dm-adjudication')
        ? 'dm-adjudication-required'
        : 'resolved',
      checks,
      consumptions: (activity.consumption ?? []).map((consumption) => resolveConsumption(consumption, executionInput)),
      proposals,
      areaInstance,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid-rolls',
      details: [error instanceof Error ? error.message : String(error)],
    }
  }
}
