import type { AbilityKey } from '../../../lib/dnd'

export const DND5E_FORMULA_SCHEMA_VERSION = 1 as const

export interface Dnd5eFormulaActorSnapshot {
  level: number
  proficiencyBonus: number
  abilities: Readonly<Record<AbilityKey, number>>
  classLevels?: Readonly<Record<string, number>>
  currentHp?: number
  maxHp?: number
  resources?: Readonly<Record<string, { current: number; maximum: number }>>
  spellAttackBonus?: number
  spellSaveDc?: number
  spellcastingAbilityModifier?: number
}

export type Dnd5eFormulaReferenceV1 =
  | { kind: 'actor-level' }
  | { kind: 'actor-proficiency-bonus' }
  | { kind: 'actor-ability-modifier'; ability: AbilityKey }
  | { kind: 'actor-class-level'; classId: string }
  | { kind: 'actor-spell-attack-bonus' }
  | { kind: 'actor-spell-save-dc' }
  | { kind: 'actor-spellcasting-ability-modifier' }
  | { kind: 'actor-current-hp' }
  | { kind: 'actor-max-hp' }
  | { kind: 'target-level' }
  | { kind: 'target-proficiency-bonus' }
  | { kind: 'target-ability-modifier'; ability: AbilityKey }
  | { kind: 'target-current-hp' }
  | { kind: 'target-max-hp' }
  | { kind: 'cast-level' }
  | { kind: 'slot-delta'; baseLevel: number }
  | { kind: 'resource'; subject: 'actor' | 'target'; resourceId: string; field: 'current' | 'maximum' }

export type Dnd5eFormulaV1 =
  | { kind: 'constant'; value: number }
  | { kind: 'reference'; reference: Dnd5eFormulaReferenceV1 }
  | { kind: 'dice'; rollId: string; count: number; sides: number }
  | { kind: 'add' | 'multiply' | 'minimum' | 'maximum'; values: readonly Dnd5eFormulaV1[] }
  | { kind: 'floor' | 'ceil' | 'round'; value: Dnd5eFormulaV1 }
  | { kind: 'clamp'; value: Dnd5eFormulaV1; minimum?: number; maximum?: number }

export interface Dnd5eFormulaRollResult {
  values: readonly number[]
}

export interface Dnd5eFormulaEvaluationContext {
  actor: Dnd5eFormulaActorSnapshot
  target?: Dnd5eFormulaActorSnapshot
  castLevel?: number
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  /** Critical-hit or other Host-owned dice multiplication by stable roll id. */
  diceMultiplierByRollId?: Readonly<Record<string, number>>
}

export interface Dnd5eFormulaRollDeclaration {
  id: string
  count: number
  sides: number
}

export class Dnd5eFormulaEvaluationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Dnd5eFormulaEvaluationError'
  }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const MAX_FORMULA_DEPTH = 16
const MAX_FORMULA_NODES = 256

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validateReference(reference: unknown, label: string, errors: string[]): void {
  if (!objectValue(reference) || typeof reference.kind !== 'string') {
    errors.push(`${label} must be a formula reference`)
    return
  }
  if (reference.kind === 'actor-ability-modifier' || reference.kind === 'target-ability-modifier') {
    if (!ABILITIES.has(reference.ability as AbilityKey)) errors.push(`${label}.ability is invalid`)
    return
  }
  if (reference.kind === 'actor-class-level') {
    if (typeof reference.classId !== 'string' || !ID_PATTERN.test(reference.classId)) {
      errors.push(`${label}.classId is invalid`)
    }
    return
  }
  if (reference.kind === 'slot-delta') {
    if (!finiteInteger(reference.baseLevel, 0, 9)) errors.push(`${label}.baseLevel is invalid`)
    return
  }
  if (reference.kind === 'resource') {
    if (reference.subject !== 'actor' && reference.subject !== 'target') errors.push(`${label}.subject is invalid`)
    if (typeof reference.resourceId !== 'string' || !ID_PATTERN.test(reference.resourceId)) {
      errors.push(`${label}.resourceId is invalid`)
    }
    if (reference.field !== 'current' && reference.field !== 'maximum') errors.push(`${label}.field is invalid`)
    return
  }
  if (![
    'actor-level', 'actor-proficiency-bonus', 'actor-current-hp', 'actor-max-hp',
    'actor-spell-attack-bonus', 'actor-spell-save-dc', 'actor-spellcasting-ability-modifier',
    'target-level', 'target-proficiency-bonus', 'target-current-hp', 'target-max-hp', 'cast-level',
  ].includes(reference.kind)) errors.push(`${label}.kind is invalid`)
}

export function validateDnd5eFormulaV1(formula: unknown, label = 'formula'): readonly string[] {
  const errors: string[] = []
  let nodes = 0
  const visit = (value: unknown, path: string, depth: number): void => {
    nodes += 1
    if (nodes > MAX_FORMULA_NODES) {
      if (!errors.includes(`${label} exceeds the formula node limit`)) {
        errors.push(`${label} exceeds the formula node limit`)
      }
      return
    }
    if (depth > MAX_FORMULA_DEPTH) {
      errors.push(`${path} exceeds the formula depth limit`)
      return
    }
    if (!objectValue(value) || typeof value.kind !== 'string') {
      errors.push(`${path} must be a formula node`)
      return
    }
    if (value.kind === 'constant') {
      if (typeof value.value !== 'number' || !Number.isFinite(value.value) || Math.abs(value.value) > 1_000_000_000) {
        errors.push(`${path}.value is invalid`)
      }
      return
    }
    if (value.kind === 'reference') {
      validateReference(value.reference, `${path}.reference`, errors)
      return
    }
    if (value.kind === 'dice') {
      if (typeof value.rollId !== 'string' || !ID_PATTERN.test(value.rollId)) errors.push(`${path}.rollId is invalid`)
      if (!finiteInteger(value.count, 0, 1_000)) errors.push(`${path}.count is invalid`)
      if (!finiteInteger(value.sides, 2, 10_000)) errors.push(`${path}.sides is invalid`)
      return
    }
    if (['add', 'multiply', 'minimum', 'maximum'].includes(value.kind)) {
      if (!Array.isArray(value.values) || value.values.length < 1 || value.values.length > 64) {
        errors.push(`${path}.values is invalid`)
        return
      }
      value.values.forEach((entry, index) => visit(entry, `${path}.values[${index}]`, depth + 1))
      return
    }
    if (value.kind === 'floor' || value.kind === 'ceil' || value.kind === 'round') {
      visit(value.value, `${path}.value`, depth + 1)
      return
    }
    if (value.kind === 'clamp') {
      visit(value.value, `${path}.value`, depth + 1)
      if (value.minimum != null && (typeof value.minimum !== 'number' || !Number.isFinite(value.minimum))) {
        errors.push(`${path}.minimum is invalid`)
      }
      if (value.maximum != null && (typeof value.maximum !== 'number' || !Number.isFinite(value.maximum))) {
        errors.push(`${path}.maximum is invalid`)
      }
      if (
        typeof value.minimum === 'number' && typeof value.maximum === 'number' &&
        value.minimum > value.maximum
      ) errors.push(`${path} has an inverted clamp range`)
      return
    }
    errors.push(`${path}.kind is invalid`)
  }
  visit(formula, label, 0)
  return errors
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function actorReferenceValue(
  actor: Dnd5eFormulaActorSnapshot | undefined,
  field: 'level' | 'proficiencyBonus' | 'currentHp' | 'maxHp',
  label: string,
): number {
  const value = actor?.[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Dnd5eFormulaEvaluationError(`${label} is unavailable`)
  }
  return value
}

function referenceValue(
  reference: Dnd5eFormulaReferenceV1,
  context: Dnd5eFormulaEvaluationContext,
): number {
  if (reference.kind === 'actor-level') return context.actor.level
  if (reference.kind === 'actor-proficiency-bonus') return context.actor.proficiencyBonus
  if (reference.kind === 'actor-ability-modifier') return abilityModifier(context.actor.abilities[reference.ability])
  if (reference.kind === 'actor-class-level') return context.actor.classLevels?.[reference.classId] ?? 0
  if (reference.kind === 'actor-spell-attack-bonus') {
    if (context.actor.spellAttackBonus == null) throw new Dnd5eFormulaEvaluationError('spell attack bonus is unavailable')
    return context.actor.spellAttackBonus
  }
  if (reference.kind === 'actor-spell-save-dc') {
    if (context.actor.spellSaveDc == null) throw new Dnd5eFormulaEvaluationError('spell save DC is unavailable')
    return context.actor.spellSaveDc
  }
  if (reference.kind === 'actor-spellcasting-ability-modifier') {
    if (context.actor.spellcastingAbilityModifier == null) {
      throw new Dnd5eFormulaEvaluationError('spellcasting ability modifier is unavailable')
    }
    return context.actor.spellcastingAbilityModifier
  }
  if (reference.kind === 'actor-current-hp') return actorReferenceValue(context.actor, 'currentHp', reference.kind)
  if (reference.kind === 'actor-max-hp') return actorReferenceValue(context.actor, 'maxHp', reference.kind)
  if (reference.kind === 'target-level') return actorReferenceValue(context.target, 'level', reference.kind)
  if (reference.kind === 'target-proficiency-bonus') {
    return actorReferenceValue(context.target, 'proficiencyBonus', reference.kind)
  }
  if (reference.kind === 'target-ability-modifier') {
    if (!context.target) throw new Dnd5eFormulaEvaluationError('target ability modifier is unavailable')
    return abilityModifier(context.target.abilities[reference.ability])
  }
  if (reference.kind === 'target-current-hp') return actorReferenceValue(context.target, 'currentHp', reference.kind)
  if (reference.kind === 'target-max-hp') return actorReferenceValue(context.target, 'maxHp', reference.kind)
  if (reference.kind === 'cast-level') {
    if (!finiteInteger(context.castLevel, 0, 9)) throw new Dnd5eFormulaEvaluationError('cast level is unavailable')
    return context.castLevel
  }
  if (reference.kind === 'slot-delta') {
    if (!finiteInteger(context.castLevel, 0, 9)) throw new Dnd5eFormulaEvaluationError('cast level is unavailable')
    return Math.max(0, context.castLevel - reference.baseLevel)
  }
  const subject = reference.subject === 'actor' ? context.actor : context.target
  const resource = subject?.resources?.[reference.resourceId]
  if (!resource) throw new Dnd5eFormulaEvaluationError(`resource is unavailable: ${reference.resourceId}`)
  return resource[reference.field]
}

export function evaluateDnd5eFormulaV1(
  formula: Dnd5eFormulaV1,
  context: Dnd5eFormulaEvaluationContext,
): number {
  if (formula.kind === 'constant') return formula.value
  if (formula.kind === 'reference') return referenceValue(formula.reference, context)
  if (formula.kind === 'dice') {
    const multiplier = context.diceMultiplierByRollId?.[formula.rollId] ?? 1
    if (!finiteInteger(multiplier, 1, 10)) throw new Dnd5eFormulaEvaluationError(`invalid dice multiplier: ${formula.rollId}`)
    const requiredCount = formula.count * multiplier
    const roll = context.rolls[formula.rollId]
    if (
      !roll || roll.values.length !== requiredCount ||
      roll.values.some((value) => !finiteInteger(value, 1, formula.sides))
    ) throw new Dnd5eFormulaEvaluationError(`invalid dice result: ${formula.rollId}`)
    return roll.values.reduce((total, value) => total + value, 0)
  }
  if (formula.kind === 'add') {
    return formula.values.reduce((total, value) => total + evaluateDnd5eFormulaV1(value, context), 0)
  }
  if (formula.kind === 'multiply') {
    return formula.values.reduce((total, value) => total * evaluateDnd5eFormulaV1(value, context), 1)
  }
  if (formula.kind === 'minimum') {
    return Math.min(...formula.values.map((value) => evaluateDnd5eFormulaV1(value, context)))
  }
  if (formula.kind === 'maximum') {
    return Math.max(...formula.values.map((value) => evaluateDnd5eFormulaV1(value, context)))
  }
  if (formula.kind === 'floor') return Math.floor(evaluateDnd5eFormulaV1(formula.value, context))
  if (formula.kind === 'ceil') return Math.ceil(evaluateDnd5eFormulaV1(formula.value, context))
  if (formula.kind === 'round') return Math.round(evaluateDnd5eFormulaV1(formula.value, context))
  if (formula.kind === 'clamp') {
    const value = evaluateDnd5eFormulaV1(formula.value, context)
    return Math.max(formula.minimum ?? Number.NEGATIVE_INFINITY, Math.min(formula.maximum ?? Number.POSITIVE_INFINITY, value))
  }
  throw new Dnd5eFormulaEvaluationError('unsupported formula node')
}

export function collectDnd5eFormulaRollDeclarations(
  formulas: readonly Dnd5eFormulaV1[],
  maximumDiceMultiplier = 1,
): readonly Dnd5eFormulaRollDeclaration[] {
  const declarations = new Map<string, Dnd5eFormulaRollDeclaration>()
  const visit = (formula: Dnd5eFormulaV1): void => {
    if (formula.kind === 'dice') {
      const declaration = { id: formula.rollId, count: formula.count * maximumDiceMultiplier, sides: formula.sides }
      const current = declarations.get(formula.rollId)
      if (current && (current.count !== declaration.count || current.sides !== declaration.sides)) {
        throw new Dnd5eFormulaEvaluationError(`conflicting dice declaration: ${formula.rollId}`)
      }
      declarations.set(formula.rollId, declaration)
      return
    }
    if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
      formula.values.forEach(visit)
    } else if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round' || formula.kind === 'clamp') {
      visit(formula.value)
    }
  }
  formulas.forEach(visit)
  return [...declarations.values()]
}
