/** Existing saved automatic areas may still carry the old approval flag. */
export function persistentAreaNeedsDmApproval(coreSpellId: string | undefined, dmAdjustable: boolean | undefined): boolean {
  return coreSpellId !== 'wall-of-ice' && coreSpellId !== 'web' && coreSpellId !== 'sleet-storm' && coreSpellId !== 'stinking-cloud' && dmAdjustable === true
}
