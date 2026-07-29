export function dnd5eWizardSpellPreparationDisabled(spellLevel: number, inWizardBook: boolean): boolean {
  return spellLevel > 0 && !inWizardBook
}
