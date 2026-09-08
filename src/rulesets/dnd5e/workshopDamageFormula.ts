import type { AbilityKey } from '../../lib/dnd'
import {
  evaluateDnd5eFormulaV1,
  type Dnd5eFormulaActorSnapshot,
  type Dnd5eFormulaV1,
} from './activities/dnd5eFormula'

export const DND5E_WORKSHOP_DAMAGE_FORMULA_SCHEMA_VERSION = 1 as const

export type Dnd5eWorkshopDamageFormulaTermV1 =
  | { kind: 'proficiency-bonus'; multiplier?: number }
  | { kind: 'ability-modifier'; ability: AbilityKey; multiplier?: number }
  | { kind: 'spellcasting-ability-modifier'; multiplier?: number }
  | { kind: 'character-level'; divisor?: number; multiplier?: number }
  | { kind: 'class-level'; classId: string; divisor?: number; multiplier?: number }

/**
 * Portable dynamic modifier shared by the workshop's spells, items, traits and
 * monster actions. Dice and the fixed modifier remain in their legacy fields,
 * so older packages continue to load byte-for-byte.
 */
export interface Dnd5eWorkshopDamageFormulaV1 {
  schemaVersion: typeof DND5E_WORKSHOP_DAMAGE_FORMULA_SCHEMA_VERSION
  terms: readonly Dnd5eWorkshopDamageFormulaTermV1[]
}

const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/

function boundedNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

export function validateDnd5eWorkshopDamageFormulaV1(
  value: unknown,
  label = 'damage modifier formula',
): readonly string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${label} must be an object`]
  const formula = value as Partial<Dnd5eWorkshopDamageFormulaV1>
  if (formula.schemaVersion !== 1) return [`${label}.schemaVersion must be 1`]
  if (!Array.isArray(formula.terms) || formula.terms.length > 8) return [`${label}.terms is invalid`]
  const errors: string[] = []
  formula.terms.forEach((raw, index) => {
    const path = `${label}.terms[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.kind !== 'string') {
      errors.push(`${path} is invalid`)
      return
    }
    if (raw.multiplier != null && !boundedNumber(raw.multiplier, -100, 100)) errors.push(`${path}.multiplier is invalid`)
    if (raw.kind === 'ability-modifier') {
      if (!ABILITIES.has(raw.ability as AbilityKey)) errors.push(`${path}.ability is invalid`)
      return
    }
    if (raw.kind === 'class-level') {
      if (typeof raw.classId !== 'string' || !ID_PATTERN.test(raw.classId)) errors.push(`${path}.classId is invalid`)
      if (raw.divisor != null && !boundedNumber(raw.divisor, 1, 100)) errors.push(`${path}.divisor is invalid`)
      return
    }
    if (raw.kind === 'character-level') {
      if (raw.divisor != null && !boundedNumber(raw.divisor, 1, 100)) errors.push(`${path}.divisor is invalid`)
      return
    }
    if (raw.kind !== 'proficiency-bonus' && raw.kind !== 'spellcasting-ability-modifier') {
      errors.push(`${path}.kind is invalid`)
    }
  })
  return errors
}

function termReference(term: Dnd5eWorkshopDamageFormulaTermV1): Dnd5eFormulaV1 {
  if (term.kind === 'proficiency-bonus') {
    return { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } }
  }
  if (term.kind === 'ability-modifier') {
    return { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: term.ability } }
  }
  if (term.kind === 'spellcasting-ability-modifier') {
    return { kind: 'reference', reference: { kind: 'actor-spellcasting-ability-modifier' } }
  }
  if (term.kind === 'class-level') {
    return { kind: 'reference', reference: { kind: 'actor-class-level', classId: term.classId } }
  }
  return { kind: 'reference', reference: { kind: 'actor-level' } }
}

export function dnd5eWorkshopDamageFormulaAsFormulaV1(
  formula: Dnd5eWorkshopDamageFormulaV1 | undefined,
): Dnd5eFormulaV1 | undefined {
  const terms = formula?.terms.flatMap((term): Dnd5eFormulaV1[] => {
    let result = termReference(term)
    if ((term.kind === 'character-level' || term.kind === 'class-level') && (term.divisor ?? 1) !== 1) {
      result = { kind: 'floor', value: { kind: 'multiply', values: [result, { kind: 'constant', value: 1 / (term.divisor ?? 1) }] } }
    }
    if ((term.multiplier ?? 1) !== 1) {
      result = { kind: 'multiply', values: [result, { kind: 'constant', value: term.multiplier ?? 1 }] }
    }
    return [result]
  }) ?? []
  if (terms.length === 0) return undefined
  return terms.length === 1 ? terms[0] : { kind: 'add', values: terms }
}

export function evaluateDnd5eWorkshopDamageFormula(
  formula: Dnd5eWorkshopDamageFormulaV1 | undefined,
  actor: Dnd5eFormulaActorSnapshot,
): number {
  const compiled = dnd5eWorkshopDamageFormulaAsFormulaV1(formula)
  return compiled ? evaluateDnd5eFormulaV1(compiled, { actor, rolls: {} }) : 0
}

export function normalizeDnd5eWorkshopFormulaClassLevels(
  value: object | undefined,
): Readonly<Record<string, number>> | undefined {
  if (!value) return undefined
  const entries = Object.entries(value).filter((entry): entry is [string, number] =>
    typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: '力量调整值', dex: '敏捷调整值', con: '体质调整值',
  int: '智力调整值', wis: '感知调整值', cha: '魅力调整值',
}

export function summarizeDnd5eWorkshopDamageFormula(
  formula: Dnd5eWorkshopDamageFormulaV1 | undefined,
): string {
  return formula?.terms.map((term) => {
    const base = term.kind === 'proficiency-bonus' ? '熟练加值'
      : term.kind === 'ability-modifier' ? ABILITY_LABELS[term.ability]
        : term.kind === 'spellcasting-ability-modifier' ? '施法调整值'
          : term.kind === 'character-level' ? '角色等级'
            : `${term.classId || '指定职业'}等级`
    const divided = (term.kind === 'character-level' || term.kind === 'class-level') && (term.divisor ?? 1) !== 1
      ? `⌊${base}/${term.divisor}⌋`
      : base
    return (term.multiplier ?? 1) === 1 ? divided : `${term.multiplier}×${divided}`
  }).join(' + ') ?? ''
}
