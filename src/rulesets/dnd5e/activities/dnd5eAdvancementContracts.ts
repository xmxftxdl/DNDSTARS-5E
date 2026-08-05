import type { AbilityKey } from '../../../lib/dnd'
import { validateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './dnd5eFormula'

export const DND5E_ADVANCEMENT_SCHEMA_VERSION = 1 as const

export interface Dnd5eContentReferenceV1 {
  namespace: string
  id: string
  versionRange?: string
}

export type Dnd5eAdvancementDefinitionV1 =
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'grant'
      grants: readonly Dnd5eContentReferenceV1[]
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'choice'
      count: number
      choices: readonly Dnd5eContentReferenceV1[]
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'ability-score'
      points: number
      maximumScore: number
      featAlternative?: boolean
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'resource-scale'
      resourceId: string
      maximum: Dnd5eFormulaV1
      reset: 'combat' | 'short-rest' | 'long-rest' | 'never'
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'spell-progression'
      progression: 'full' | 'half' | 'one-third' | 'pact'
      ability: AbilityKey
      spellListId: string
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'proficiency'
      category: 'skill' | 'tool' | 'weapon' | 'armor' | 'saving-throw'
      choices: readonly string[]
      count: number
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'subclass'
      classId: string
      count: 1
    }

const ADVANCEMENT_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])

function validReference(reference: Dnd5eContentReferenceV1): boolean {
  return !!reference &&
    ADVANCEMENT_ID.test(reference.namespace) &&
    ADVANCEMENT_ID.test(reference.id) &&
    (reference.versionRange == null || (
      typeof reference.versionRange === 'string' &&
      reference.versionRange.length > 0 &&
      reference.versionRange.length <= 120
    ))
}

/** Validates a class/race/subclass progression contribution before Host registration. */
export function validateDnd5eAdvancementDefinitionV1(
  advancement: Dnd5eAdvancementDefinitionV1,
): readonly string[] {
  const errors: string[] = []
  if (advancement.schemaVersion !== DND5E_ADVANCEMENT_SCHEMA_VERSION) {
    errors.push('advancement.schemaVersion is invalid')
  }
  if (!ADVANCEMENT_ID.test(advancement.id)) errors.push('advancement.id is invalid')
  if (!Number.isInteger(advancement.level) || advancement.level < 1 || advancement.level > 20) {
    errors.push('advancement.level is invalid')
  }
  if (advancement.kind === 'grant') {
    if (!advancement.grants.length || advancement.grants.length > 256 || advancement.grants.some((entry) => !validReference(entry))) {
      errors.push('advancement.grants is invalid')
    }
  } else if (advancement.kind === 'choice') {
    if (
      !advancement.choices.length || advancement.choices.length > 256 ||
      advancement.choices.some((entry) => !validReference(entry)) ||
      !Number.isInteger(advancement.count) || advancement.count < 1 || advancement.count > advancement.choices.length
    ) errors.push('advancement choice is invalid')
  } else if (advancement.kind === 'ability-score') {
    if (!Number.isInteger(advancement.points) || advancement.points < 1 || advancement.points > 12) {
      errors.push('advancement.points is invalid')
    }
    if (!Number.isInteger(advancement.maximumScore) || advancement.maximumScore < 1 || advancement.maximumScore > 30) {
      errors.push('advancement.maximumScore is invalid')
    }
  } else if (advancement.kind === 'resource-scale') {
    if (!ADVANCEMENT_ID.test(advancement.resourceId)) errors.push('advancement.resourceId is invalid')
    errors.push(...validateDnd5eFormulaV1(advancement.maximum, 'advancement.maximum'))
  } else if (advancement.kind === 'spell-progression') {
    if (!ABILITIES.has(advancement.ability)) errors.push('advancement.ability is invalid')
    if (!ADVANCEMENT_ID.test(advancement.spellListId)) errors.push('advancement.spellListId is invalid')
  } else if (advancement.kind === 'proficiency') {
    if (
      !advancement.choices.length || advancement.choices.length > 256 ||
      advancement.choices.some((choice) => !choice.trim() || choice.length > 120) ||
      !Number.isInteger(advancement.count) || advancement.count < 1 || advancement.count > advancement.choices.length
    ) errors.push('advancement proficiency choice is invalid')
  } else if (advancement.kind === 'subclass') {
    if (!ADVANCEMENT_ID.test(advancement.classId) || advancement.count !== 1) {
      errors.push('advancement subclass choice is invalid')
    }
  }
  return errors
}
