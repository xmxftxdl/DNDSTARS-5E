import type { AbilityKey } from '../../lib/dnd'
import type { Character, Dnd5eContentChoiceReceiptV1 } from '../../types/character'
import type {
  Dnd5eAdvancementDefinitionV1,
  Dnd5eBuildChoiceOptionV1,
  Dnd5eBuildGrantV1,
} from './activities/dnd5eAdvancementContracts'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'

export interface Dnd5eBuildChoiceRequirementV1 {
  id: string
  label: string
  description?: string
  count: number
  options: readonly Dnd5eBuildChoiceOptionV1[]
}

export type Dnd5eBuildChoiceApplyResultV1 =
  | { ok: true; character: Character; receipt: Dnd5eContentChoiceReceiptV1 }
  | { ok: false; reason: 'missing-choice' | 'invalid-choice' | 'ability-score-maximum' }

function selectionAdvancements(
  advancements: readonly Dnd5eAdvancementDefinitionV1[] | undefined,
): readonly Extract<Dnd5eAdvancementDefinitionV1, { kind: 'select' }>[] {
  return (advancements ?? []).flatMap((advancement) => {
    if (advancement.kind === 'select') return [advancement]
    if (advancement.kind !== 'spell-select') return []
    const allowedIds = advancement.spellIds ? new Set(advancement.spellIds) : undefined
    const catalog = [
      ...DND5E_SRD_SPELL_CATALOG.map((spell) => ({
        id: spell.id,
        label: spell.name,
        level: spell.level,
        classes: [...spell.classes] as string[],
      })),
      ...(advancement.additionalSpells ?? []).map((spell) => ({
        id: spell.id,
        label: spell.label,
        level: spell.level,
        classes: [...spell.classes],
      })),
    ]
    const seen = new Set<string>()
    const options = advancement.classSelection.options.flatMap((classOption) =>
      catalog.flatMap((spell) => {
        const key = `${classOption.optionId}:${spell.id}`
        if (
          seen.has(key) || !advancement.levels.includes(spell.level) ||
          !spell.classes.includes(classOption.classId) ||
          (allowedIds && !allowedIds.has(spell.id))
        ) return []
        seen.add(key)
        return [{
          id: `spell-${classOption.optionId}-${spell.id}`,
          label: `${spell.label} · ${classOption.classId}`,
          grants: [{
            kind: 'spell' as const,
            spellId: spell.id,
            mode: advancement.mode,
            ability: classOption.ability,
            castAtLevel: advancement.castAtLevel,
          }],
          requires: [{
            advancementId: advancement.classSelection.advancementId,
            optionIds: [classOption.optionId],
          }],
        }]
      }),
    )
    return [{
      schemaVersion: advancement.schemaVersion,
      id: advancement.id,
      level: advancement.level,
      kind: 'select' as const,
      label: advancement.label,
      description: advancement.description,
      count: advancement.count,
      options,
    }]
  })
}

export function dnd5eBuildChoiceRequirementsV1(
  advancements: readonly Dnd5eAdvancementDefinitionV1[] | undefined,
): readonly Dnd5eBuildChoiceRequirementV1[] {
  return selectionAdvancements(advancements).map((advancement) => ({
    id: advancement.id,
    label: advancement.label,
    description: advancement.description,
    count: advancement.count,
    options: advancement.options.map((option) => structuredClone(option)),
  }))
}

function optionAvailable(
  option: Dnd5eBuildChoiceOptionV1,
  selections: Readonly<Record<string, readonly string[]>>,
): boolean {
  return option.requires?.every((requirement) => {
    const selected = selections[requirement.advancementId] ?? []
    return requirement.optionIds.some((optionId) => selected.includes(optionId))
  }) ?? true
}

function resolvedBuildGrants(
  advancements: readonly Dnd5eAdvancementDefinitionV1[] | undefined,
  selections: Readonly<Record<string, readonly string[]>>,
): { ok: true; grants: Dnd5eBuildGrantV1[] } | { ok: false; reason: 'missing-choice' | 'invalid-choice' } {
  const selects = selectionAdvancements(advancements)
  const knownSelectionIds = new Set(selects.map((advancement) => advancement.id))
  if (Object.keys(selections).some((selectionId) => !knownSelectionIds.has(selectionId))) {
    return { ok: false, reason: 'invalid-choice' }
  }
  const grants = (advancements ?? []).flatMap((advancement) =>
    advancement.kind === 'build-grant' ? advancement.grants.map((grant) => structuredClone(grant)) : [],
  )
  for (const advancement of selects) {
    const selected = [...new Set(selections[advancement.id] ?? [])]
    if (selected.length < advancement.count) return { ok: false, reason: 'missing-choice' }
    if (selected.length !== advancement.count) return { ok: false, reason: 'invalid-choice' }
    for (const optionId of selected) {
      const option = advancement.options.find((candidate) => candidate.id === optionId)
      if (!option || !optionAvailable(option, selections)) return { ok: false, reason: 'invalid-choice' }
      grants.push(...option.grants.map((grant) => structuredClone(grant)))
    }
  }
  return { ok: true, grants }
}

/**
 * Applies one content definition's build choices atomically. The function is
 * intentionally content-kind agnostic; the caller supplies only a stable
 * content id and the definition's data-only advancements.
 */
export function applyDnd5eContentBuildChoicesV1(input: {
  character: Character
  contentId: string
  advancements: readonly Dnd5eAdvancementDefinitionV1[] | undefined
  selections?: Readonly<Record<string, readonly string[]>>
}): Dnd5eBuildChoiceApplyResultV1 {
  const selections = Object.fromEntries(Object.entries(input.selections ?? {}).map(([id, values]) => [
    id,
    [...new Set(values)],
  ]))
  const resolved = resolvedBuildGrants(input.advancements, selections)
  if (!resolved.ok) return resolved

  const abilities = { ...input.character.abilities }
  const skills = new Set(input.character.skills)
  const savingThrows = new Set(input.character.savingThrows)
  for (const grant of resolved.grants) {
    if (grant.kind === 'ability-score') {
      const maximum = grant.maximumScore ?? 20
      if (abilities[grant.ability] + grant.amount > maximum) {
        return { ok: false, reason: 'ability-score-maximum' }
      }
      abilities[grant.ability] += grant.amount
    } else if (grant.kind === 'proficiency' && grant.category === 'skill') {
      skills.add(grant.id)
    } else if (grant.kind === 'proficiency' && grant.category === 'saving-throw') {
      savingThrows.add(grant.id as AbilityKey)
    }
  }
  const receipt: Dnd5eContentChoiceReceiptV1 = {
    schemaVersion: 1,
    contentId: input.contentId,
    selections,
    resolvedGrants: resolved.grants.map((grant) => structuredClone(grant)),
  }
  return {
    ok: true,
    character: {
      ...input.character,
      abilities,
      skills: [...skills],
      savingThrows: [...savingThrows],
      dnd5eContentChoices: {
        ...input.character.dnd5eContentChoices,
        [input.contentId]: receipt,
      },
    },
    receipt,
  }
}

export function dnd5eCharacterBuildGrantsV1(
  character: Pick<Character, 'dnd5eContentChoices'>,
): readonly Dnd5eBuildGrantV1[] {
  return Object.values(character.dnd5eContentChoices ?? {}).flatMap((receipt) =>
    receipt.schemaVersion === 1 ? receipt.resolvedGrants : [],
  )
}

export function dnd5eCharacterBuildProficienciesV1(
  character: Pick<Character, 'dnd5eContentChoices'>,
  category: Extract<Dnd5eBuildGrantV1, { kind: 'proficiency' }>['category'],
): ReadonlySet<string> {
  return new Set(dnd5eCharacterBuildGrantsV1(character).flatMap((grant) =>
    grant.kind === 'proficiency' && grant.category === category ? [grant.id] : [],
  ))
}

export function dnd5eCharacterBuildTagsV1(
  character: Pick<Character, 'dnd5eContentChoices'>,
  key: string,
): readonly string[] {
  return [...new Set(dnd5eCharacterBuildGrantsV1(character).flatMap((grant) =>
    grant.kind === 'tag' && grant.key === key ? [grant.value] : [],
  ))]
}

export function dnd5eCharacterBuildSpellGrantsV1(
  character: Pick<Character, 'dnd5eContentChoices'>,
): readonly Extract<Dnd5eBuildGrantV1, { kind: 'spell' }>[] {
  return dnd5eCharacterBuildGrantsV1(character).filter(
    (grant): grant is Extract<Dnd5eBuildGrantV1, { kind: 'spell' }> => grant.kind === 'spell',
  )
}

export function dnd5eCharacterBuildFeatureIdsV1(
  character: Pick<Character, 'dnd5eContentChoices'>,
): readonly string[] {
  return [...new Set(dnd5eCharacterBuildGrantsV1(character).flatMap((grant) =>
    grant.kind === 'feature' ? [grant.featureId] : [],
  ))]
}
