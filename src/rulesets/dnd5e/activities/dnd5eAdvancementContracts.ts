import type { AbilityKey } from '../../../lib/dnd'
import { validateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './dnd5eFormula'

export const DND5E_ADVANCEMENT_SCHEMA_VERSION = 1 as const

export interface Dnd5eContentReferenceV1 {
  namespace: string
  id: string
  versionRange?: string
}

/**
 * A closed, serializable character-building grant.  Content may combine these
 * inside one option (for example Resilient grants both +1 to an ability and
 * proficiency in the matching save) without asking the Host to special-case
 * the feat, race, class, background, item, or feature that supplied it.
 */
export type Dnd5eBuildGrantV1 =
  | { kind: 'ability-score'; ability: AbilityKey; amount: number; maximumScore?: number }
  | {
      kind: 'proficiency'
      category: 'skill' | 'tool' | 'weapon' | 'armor' | 'saving-throw'
      id: string
    }
  | {
      kind: 'spell'
      spellId: string
      mode: 'cantrip' | 'known' | 'once-per-long-rest' | 'ritual-book'
      ability?: AbilityKey
      castAtLevel?: number
    }
  | { kind: 'feature'; featureId: string }
  | { kind: 'tag'; key: string; value: string }

export interface Dnd5eBuildChoiceOptionV1 {
  id: string
  label: string
  description?: string
  grants: readonly Dnd5eBuildGrantV1[]
  /** All requirements must match selections made in earlier groups. */
  requires?: readonly { advancementId: string; optionIds: readonly string[] }[]
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
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'build-grant'
      grants: readonly Dnd5eBuildGrantV1[]
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      kind: 'select'
      label: string
      description?: string
      count: number
      options: readonly Dnd5eBuildChoiceOptionV1[]
    }
  | {
      schemaVersion: typeof DND5E_ADVANCEMENT_SCHEMA_VERSION
      id: string
      level: number
      /** Host expands the installed spell catalog into ordinary closed options. */
      kind: 'spell-select'
      label: string
      description?: string
      count: number
      mode: 'cantrip' | 'known' | 'once-per-long-rest' | 'ritual-book'
      levels: readonly number[]
      castAtLevel?: number
      /** Optional stable-id allowlist, used for ritual-only or curated choices. */
      spellIds?: readonly string[]
      classSelection: {
        advancementId: string
        options: readonly {
          optionId: string
          classId: string
          ability: AbilityKey
        }[]
      }
      /** Package-local spells not present in the SRD catalog. */
      additionalSpells?: readonly {
        id: string
        label: string
        level: number
        classes: readonly string[]
      }[]
    }

const ADVANCEMENT_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const PROFICIENCY_CATEGORIES = new Set(['skill', 'tool', 'weapon', 'armor', 'saving-throw'])
const SPELL_GRANT_MODES = new Set(['cantrip', 'known', 'once-per-long-rest', 'ritual-book'])

function validText(value: unknown, maximum = 240): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= maximum
}

function validateBuildGrant(grant: Dnd5eBuildGrantV1, label: string): readonly string[] {
  const errors: string[] = []
  if (!grant || typeof grant !== 'object') return [`${label} is invalid`]
  if (grant.kind === 'ability-score') {
    if (!ABILITIES.has(grant.ability)) errors.push(`${label}.ability is invalid`)
    if (!Number.isInteger(grant.amount) || grant.amount < 1 || grant.amount > 12) {
      errors.push(`${label}.amount is invalid`)
    }
    if (grant.maximumScore != null && (
      !Number.isInteger(grant.maximumScore) || grant.maximumScore < 1 || grant.maximumScore > 30
    )) errors.push(`${label}.maximumScore is invalid`)
  } else if (grant.kind === 'proficiency') {
    if (!PROFICIENCY_CATEGORIES.has(grant.category)) errors.push(`${label}.category is invalid`)
    if (!validText(grant.id, 160)) errors.push(`${label}.id is invalid`)
  } else if (grant.kind === 'spell') {
    if (!validText(grant.spellId, 160)) errors.push(`${label}.spellId is invalid`)
    if (!SPELL_GRANT_MODES.has(grant.mode)) errors.push(`${label}.mode is invalid`)
    if (grant.ability != null && !ABILITIES.has(grant.ability)) errors.push(`${label}.ability is invalid`)
    if (grant.castAtLevel != null && (
      !Number.isInteger(grant.castAtLevel) || grant.castAtLevel < 0 || grant.castAtLevel > 9
    )) errors.push(`${label}.castAtLevel is invalid`)
  } else if (grant.kind === 'feature') {
    if (!ADVANCEMENT_ID.test(grant.featureId)) errors.push(`${label}.featureId is invalid`)
  } else if (grant.kind === 'tag') {
    if (!ADVANCEMENT_ID.test(grant.key)) errors.push(`${label}.key is invalid`)
    if (!validText(grant.value, 240)) errors.push(`${label}.value is invalid`)
  } else errors.push(`${label}.kind is invalid`)
  return errors
}

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
  } else if (advancement.kind === 'build-grant') {
    if (!advancement.grants.length || advancement.grants.length > 128) {
      errors.push('advancement build grants are invalid')
    } else advancement.grants.forEach((grant, index) => {
      errors.push(...validateBuildGrant(grant, `advancement.grants[${index}]`))
    })
  } else if (advancement.kind === 'select') {
    if (!validText(advancement.label, 160)) errors.push('advancement selection label is invalid')
    if (advancement.description != null && !validText(advancement.description, 2_000)) {
      errors.push('advancement selection description is invalid')
    }
    if (
      !advancement.options.length || advancement.options.length > 512 ||
      !Number.isInteger(advancement.count) || advancement.count < 1 ||
      advancement.count > advancement.options.length ||
      new Set(advancement.options.map((option) => option.id)).size !== advancement.options.length
    ) errors.push('advancement selection options are invalid')
    advancement.options.forEach((option, optionIndex) => {
      if (!ADVANCEMENT_ID.test(option.id) || !validText(option.label, 160)) {
        errors.push(`advancement.options[${optionIndex}] is invalid`)
      }
      if (option.description != null && !validText(option.description, 2_000)) {
        errors.push(`advancement.options[${optionIndex}].description is invalid`)
      }
      if (!option.grants.length || option.grants.length > 64) {
        errors.push(`advancement.options[${optionIndex}].grants are invalid`)
      } else option.grants.forEach((grant, grantIndex) => {
        errors.push(...validateBuildGrant(grant, `advancement.options[${optionIndex}].grants[${grantIndex}]`))
      })
      option.requires?.forEach((requirement, requirementIndex) => {
        if (
          !ADVANCEMENT_ID.test(requirement.advancementId) || !requirement.optionIds.length ||
          requirement.optionIds.length > 512 ||
          requirement.optionIds.some((optionId) => !ADVANCEMENT_ID.test(optionId))
        ) errors.push(`advancement.options[${optionIndex}].requires[${requirementIndex}] is invalid`)
      })
    })
  } else if (advancement.kind === 'spell-select') {
    if (!validText(advancement.label, 160)) errors.push('advancement spell selection label is invalid')
    if (advancement.description != null && !validText(advancement.description, 2_000)) {
      errors.push('advancement spell selection description is invalid')
    }
    if (
      !Number.isInteger(advancement.count) || advancement.count < 1 || advancement.count > 20 ||
      !SPELL_GRANT_MODES.has(advancement.mode) ||
      !advancement.levels.length || advancement.levels.length > 10 ||
      advancement.levels.some((level) => !Number.isInteger(level) || level < 0 || level > 9) ||
      new Set(advancement.levels).size !== advancement.levels.length ||
      (advancement.castAtLevel != null && (!Number.isInteger(advancement.castAtLevel) || advancement.castAtLevel < 0 || advancement.castAtLevel > 9)) ||
      (advancement.spellIds != null && (
        !advancement.spellIds.length || advancement.spellIds.length > 512 ||
        advancement.spellIds.some((spellId) => !ADVANCEMENT_ID.test(spellId))
      )) ||
      !ADVANCEMENT_ID.test(advancement.classSelection.advancementId) ||
      !advancement.classSelection.options.length || advancement.classSelection.options.length > 32 ||
      new Set(advancement.classSelection.options.map((option) => option.optionId)).size !== advancement.classSelection.options.length ||
      advancement.classSelection.options.some((option) =>
        !ADVANCEMENT_ID.test(option.optionId) || !ADVANCEMENT_ID.test(option.classId) || !ABILITIES.has(option.ability))
    ) errors.push('advancement spell selection is invalid')
    if (advancement.additionalSpells != null && (
      advancement.additionalSpells.length > 256 ||
      new Set(advancement.additionalSpells.map((spell) => spell.id)).size !== advancement.additionalSpells.length ||
      advancement.additionalSpells.some((spell) =>
        !ADVANCEMENT_ID.test(spell.id) || !validText(spell.label, 160) ||
        !Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9 ||
        !spell.classes.length || spell.classes.some((classId) => !ADVANCEMENT_ID.test(classId)))
    )) errors.push('advancement additional spells are invalid')
  }
  return errors
}

/** Cross-record validation for dependent build choices. */
export function validateDnd5eAdvancementCollectionV1(
  advancements: readonly Dnd5eAdvancementDefinitionV1[],
): readonly string[] {
  const errors: string[] = []
  const byId = new Map(advancements.map((advancement, index) => [advancement.id, { advancement, index }]))
  if (byId.size !== advancements.length) errors.push('advancement ids must be unique')
  advancements.forEach((advancement, index) => {
    if (advancement.kind === 'spell-select') {
      const dependency = byId.get(advancement.classSelection.advancementId)
      if (!dependency || dependency.index >= index || dependency.advancement.kind !== 'select') {
        errors.push(`${advancement.id} requires an earlier class selection group`)
        return
      }
      const dependencyOptionIds = new Set(dependency.advancement.options.map((candidate) => candidate.id))
      if (advancement.classSelection.options.some((option) => !dependencyOptionIds.has(option.optionId))) {
        errors.push(`${advancement.id} requires an unknown class option`)
      }
      return
    }
    if (advancement.kind !== 'select') return
    advancement.options.forEach((option) => option.requires?.forEach((requirement) => {
      const dependency = byId.get(requirement.advancementId)
      if (!dependency || dependency.index >= index || dependency.advancement.kind !== 'select') {
        errors.push(`${advancement.id}.${option.id} requires an earlier selection group`)
        return
      }
      const dependencyOptionIds = new Set(dependency.advancement.options.map((candidate) => candidate.id))
      if (requirement.optionIds.some((optionId) => !dependencyOptionIds.has(optionId))) {
        errors.push(`${advancement.id}.${option.id} requires an unknown option`)
      }
    }))
  })
  return errors
}
