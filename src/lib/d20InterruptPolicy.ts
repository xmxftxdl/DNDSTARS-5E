export interface D20EnemyModifierOption {
  characterId: string
  featureId: string
  featureLabel: string
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
  return input.outcome === 'success' && (input.eligibleEnemyModifiers?.length ?? 0) > 0
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
