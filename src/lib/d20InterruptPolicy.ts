export interface D20EnemyModifierOption {
  characterId: string
  featureId: string
  featureLabel: string
  modifierKind?: 'replace-d20' | 'adjust-d20'
  sourceTokenId?: string
  dieSides?: number
  direction?: 'add' | 'subtract'
}

export type D20ResolvedOutcome = 'success' | 'failure' | 'unknown'

/**
 * Public combat rolls only pause after a successful enemy result and only when
 * at least one player owns an explicitly eligible feature. DM-only rolls keep a
 * confirmation window so the DM can correct the hidden die before settlement.
 */
export function shouldOpenD20RollConfirmation(input: {
  visibility: 'public' | 'dm-only'
  outcome: D20ResolvedOutcome
  eligibleEnemyModifiers?: readonly D20EnemyModifierOption[]
}): boolean {
  if (input.visibility === 'dm-only') return true
  const modifiers = input.eligibleEnemyModifiers ?? []
  if (input.outcome === 'success') {
    return modifiers.some((entry) =>
      entry.modifierKind !== 'adjust-d20' || entry.direction === 'subtract')
  }
  if (input.outcome === 'failure') {
    return modifiers.some((entry) =>
      entry.modifierKind === 'adjust-d20' && entry.direction === 'add')
  }
  return false
}

export function canBonusDieChangeFailure(input: {
  success: boolean
  naturalOne?: boolean
  currentTotal: number
  targetNumber: number
  dieSides?: number
}): boolean {
  return !input.success &&
    input.naturalOne !== true &&
    Number.isInteger(input.dieSides) &&
    Number(input.dieSides) > 0 &&
    input.currentTotal + Number(input.dieSides) >= input.targetNumber
}
