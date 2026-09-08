import type { Character } from '../../types/character'

export function dnd5eSpellbookEditLocks(input: {
  isDM: boolean
  cantripChoicesLocked: boolean
  spellChoicesLocked: boolean
  wizardSpellbookLocked: boolean
}): Omit<typeof input, 'isDM'> {
  if (input.isDM) {
    return {
      cantripChoicesLocked: false,
      spellChoicesLocked: false,
      wizardSpellbookLocked: false,
    }
  }
  return {
    cantripChoicesLocked: input.cantripChoicesLocked,
    spellChoicesLocked: input.spellChoicesLocked,
    wizardSpellbookLocked: input.wizardSpellbookLocked,
  }
}

export function dnd5eWizardSpellPreparationDisabled(spellLevel: number, inWizardBook: boolean): boolean {
  return spellLevel > 0 && !inWizardBook
}

export function dnd5eAdvancementWizardSpellbookIds(
  records: Character['dnd5eLevelAdvancements'],
  classId: string,
): ReadonlySet<string> {
  const spellIds = new Set<string>()
  for (const record of records ?? []) {
    if (record.classId !== classId) continue
    for (const spellId of record.decision.spellSelections?.wizardSpellbook ?? []) {
      spellIds.add(spellId)
    }
  }
  return spellIds
}
