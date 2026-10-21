import type { AbilityKey } from '../../lib/dnd'
import { SKILLS, ABILITIES } from '../../lib/dnd'
import type { Character, Dnd5eContentChoiceReceiptV1 } from '../../types/character'
import type {
  Dnd5eAdvancementDefinitionV1,
  Dnd5eBuildChoiceOptionV1,
  Dnd5eBuildGrantV1,
} from './activities/dnd5eAdvancementContracts'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import { DND5E_TOOL_CHOICES } from './buildChoiceCatalogs'
import { DND5E_BUILD_FIGHTING_STYLES, dnd5eGrantedFightingStyles } from './fightingStyleGrants'

export interface Dnd5eBuildChoiceRequirementV1 {
  id: string
  label: string
  description?: string
  count: number
  options: readonly Dnd5eBuildChoiceOptionV1[]
  customTag?: { key: string; label: string }
}

export const DND5E_CUSTOM_BUILD_CHOICE_PREFIX = '$custom:'

export type Dnd5eBuildChoiceApplyResultV1 =
  | { ok: true; character: Character; receipt: Dnd5eContentChoiceReceiptV1 }
  | { ok: false; reason: 'missing-choice' | 'invalid-choice' | 'ability-score-maximum' }

/** Skills may be learned earlier in the same build; an existing expertise cannot be doubled again. */
export function dnd5eBuildChoiceExpertiseAvailableV1(character: Character, grants: readonly Dnd5eBuildGrantV1[], fixedGrantCount = 0): boolean {
  const skills = new Set([...character.skills, ...grants.flatMap(grant =>
    grant.kind === 'proficiency' && grant.category === 'skill' ? [grant.id] : [])])
  const expertise = new Set([
    ...dnd5eCharacterBuildTagsV1(character, 'skill-expertise'),
    ...Object.values(character.dnd5eClassChoices?.classes ?? {}).flatMap(choice => choice?.selections?.expertise ?? []),
  ])
  for (const [index, grant] of grants.entries()) {
    if (grant.kind !== 'tag' || grant.key !== 'skill-expertise') continue
    if (!SKILLS.some(skill => skill.key === grant.value) || !skills.has(grant.value)) return false
    // Fixed training retains existing expertise; choosing an already expert skill still wastes a choice.
    if (expertise.has(grant.value) && index >= fixedGrantCount) return false
    expertise.add(grant.value)
  }
  return true
}

function selectionAdvancements(
  advancements: readonly Dnd5eAdvancementDefinitionV1[] | undefined,
): readonly Extract<Dnd5eAdvancementDefinitionV1, { kind: 'select' }>[] {
  return (advancements ?? []).flatMap((advancement) => {
    if (advancement.kind === 'select') return [advancement]
    if (advancement.kind === 'proficiency') return [{
      schemaVersion: advancement.schemaVersion, id: advancement.id, level: advancement.level,
      kind: 'select' as const, label: '选择熟练', count: advancement.count,
      options: advancement.choices.map(id => ({
        id, label: advancement.category === 'skill' ? SKILLS.find(skill => skill.key === id)?.label ?? id
          : advancement.category === 'saving-throw' ? ABILITIES.find(ability => ability.key === id)?.label ?? id
          : advancement.category === 'tool' ? DND5E_TOOL_CHOICES.find(tool => tool.id === id)?.label ?? id : id,
        grants: [{ kind: 'proficiency' as const, category: advancement.category, id }],
      })),
    }]
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
    ...(advancement.customTag ? { customTag: { ...advancement.customTag } } : {}),
  }))
}

export function dnd5eBuildChoiceOptionAvailableV1(
  option: Dnd5eBuildChoiceOptionV1,
  selections: Readonly<Record<string, readonly string[]>>,
  character: Pick<Character, 'savingThrows'>,
): boolean {
  return (option.requiresSavingThrowProficiency?.every(requirement =>
    character.savingThrows.includes(requirement.ability) === requirement.proficient) ?? true) &&
    (option.requires?.every((requirement) => {
    const selected = selections[requirement.advancementId] ?? []
    return requirement.optionIds.some((optionId) => selected.includes(optionId))
  }) ?? true)
}

/** Preview earlier valid grants in the same order used by the level-up transaction. */
export function dnd5eBuildChoiceCharacterBeforeContentV1(
  character: Character,
  contentId: string,
  contents: readonly { contentId: string; advancements?: readonly Dnd5eAdvancementDefinitionV1[] }[],
  selections: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>,
): Character {
  let current = character
  for (const content of contents) {
    if (content.contentId === contentId) break
    const applied = applyDnd5eContentBuildChoicesV1({ character: current, contentId: content.contentId,
      advancements: content.advancements, selections: selections[content.contentId] })
    if (applied.ok) current = applied.character
  }
  return current
}

function resolvedBuildGrants(
  advancements: readonly Dnd5eAdvancementDefinitionV1[] | undefined,
  selections: Readonly<Record<string, readonly string[]>>,
  character: Pick<Character, 'savingThrows'>,
): { ok: true; grants: Dnd5eBuildGrantV1[]; fixedGrantCount: number } | { ok: false; reason: 'missing-choice' | 'invalid-choice' } {
  const selects = selectionAdvancements(advancements)
  const knownSelectionIds = new Set(selects.map((advancement) => advancement.id))
  if (Object.keys(selections).some((selectionId) => !knownSelectionIds.has(selectionId))) {
    return { ok: false, reason: 'invalid-choice' }
  }
  const grants = (advancements ?? []).flatMap((advancement) =>
    advancement.kind === 'build-grant' ? advancement.grants.map((grant) => structuredClone(grant)) : [],
  )
  const fixedGrantCount = grants.length
  for (const advancement of selects) {
    const selected = [...new Set(selections[advancement.id] ?? [])]
    if (selected.length < advancement.count) return { ok: false, reason: 'missing-choice' }
    if (selected.length !== advancement.count) return { ok: false, reason: 'invalid-choice' }
    for (const optionId of selected) {
      if (optionId.startsWith(DND5E_CUSTOM_BUILD_CHOICE_PREFIX)) {
        const value = optionId.slice(DND5E_CUSTOM_BUILD_CHOICE_PREFIX.length).trim()
        if (!advancement.customTag || !value || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value) ||
          selected.filter(id => id.startsWith(DND5E_CUSTOM_BUILD_CHOICE_PREFIX)).length !== 1) {
          return { ok: false, reason: 'invalid-choice' }
        }
        grants.push({ kind: 'tag', key: advancement.customTag.key, value })
        continue
      }
      const option = advancement.options.find((candidate) => candidate.id === optionId)
      if (!option || !dnd5eBuildChoiceOptionAvailableV1(option, selections, character)) return { ok: false, reason: 'invalid-choice' }
      grants.push(...option.grants.map((grant) => structuredClone(grant)))
    }
  }
  return { ok: true, grants, fixedGrantCount }
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
  const resolved = resolvedBuildGrants(input.advancements, selections, input.character)
  if (!resolved.ok) return resolved
  // Rebuilding this content replaces its receipt; other sources retain their training.
  const previousChoices = { ...input.character.dnd5eContentChoices }
  delete previousChoices[input.contentId]
  const styles = new Set(dnd5eGrantedFightingStyles({ ...input.character, dnd5eContentChoices: previousChoices }))
  for (const grant of resolved.grants) {
    if (grant.kind !== 'tag' || grant.key !== 'fighting-style') continue
    if (!DND5E_BUILD_FIGHTING_STYLES.some(style => style === grant.value) || styles.has(grant.value)) return { ok: false, reason: 'invalid-choice' }
    styles.add(grant.value)
  }
  const trainedWeapons = new Set(dnd5eCharacterBuildTagsV1({ ...input.character, dnd5eContentChoices: previousChoices }, 'monk-weapon'))
  for (const [index, grant] of resolved.grants.entries()) {
    if (grant.kind !== 'tag' || grant.key !== 'monk-weapon') continue
    if (trainedWeapons.has(grant.value) && index >= resolved.fixedGrantCount) return { ok: false, reason: 'invalid-choice' }
    trainedWeapons.add(grant.value)
  }
  if (!dnd5eBuildChoiceExpertiseAvailableV1(input.character, resolved.grants, resolved.fixedGrantCount)) return { ok: false, reason: 'invalid-choice' }

  const abilities = { ...input.character.abilities }
  const skills = new Set(input.character.skills)
  const savingThrows = new Set(input.character.savingThrows)
  for (const [index, grant] of resolved.grants.entries()) {
    if (grant.kind === 'ability-score') {
      const maximum = grant.maximumScore ?? 20
      if (abilities[grant.ability] + grant.amount > maximum) {
        // A fixed improvement can be exhausted without invalidating the other
        // benefits. Selected improvements still require an available score.
        if (index < resolved.fixedGrantCount) {
          abilities[grant.ability] = Math.max(abilities[grant.ability], maximum)
          continue
        }
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

/** Shared by player choice lists and authoritative map snapshots. */
export function dnd5eCharacterKnownLanguagesV1(
  character?: Pick<Character, 'dnd5eContentChoices' | 'dnd5eBackgroundLanguages'>,
): readonly string[] {
  return [...new Set([
    'common',
    ...(character?.dnd5eBackgroundLanguages ?? []),
    ...(character ? dnd5eCharacterBuildTagsV1(character, 'language') : []),
  ].map(language => language.trim().toLocaleLowerCase()).filter(Boolean))]
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
