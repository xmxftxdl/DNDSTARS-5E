import type { Character } from '../../types/character'
import { dnd5eEffectiveSpellcastingSources, dnd5eEffectiveSpellSelections } from './subclassSpellcasting'
import { dnd5eCharacterBuildSpellGrantsV1 } from './buildChoices'
import { dnd5eRacialRulesForCharacter } from './racialAutomation'

export function cloneDnd5eKnownSpellRequirements(value: unknown, label: string): readonly string[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value) || value.length < 1 || value.length > 32 ||
    value.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(id)) ||
    new Set(value).size !== value.length) throw Error(`${label}: invalid known spell requirements`)
  return [...value]
}

/** Learning evidence, not the list of spells available for purchase/preparation. */
export function dnd5eCharacterLearnedSpellIds(character: Character): ReadonlySet<string> {
  const learned = new Set<string>()
  const add = (ids: readonly string[] | undefined) => {
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') learned.add(id)
  }
  for (const source of dnd5eEffectiveSpellcastingSources(character)) {
    const selections = dnd5eEffectiveSpellSelections(character, source)
    add(selections[source.cantripSelectionKey])
    if (source.definition.spellcasting?.kind === 'full-known' || source.definition.spellcasting?.kind === 'half-known' ||
      source.definition.spellcasting?.kind === 'pact') add(selections[source.spellSelectionKey])
    if (source.classId === 'wizard') add(selections['wizard-spellbook'])
  }
  for (const grant of dnd5eCharacterBuildSpellGrantsV1(character)) {
    if (grant.mode === 'cantrip' || grant.mode === 'known') learned.add(grant.spellId)
  }
  for (const grant of dnd5eRacialRulesForCharacter(character).innateSpells) {
    if (grant.castAtLevel === 0) learned.add(grant.spellId)
  }
  return learned
}
