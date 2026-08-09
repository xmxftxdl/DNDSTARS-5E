import type { Character } from '../types/character'

export const DND5E_CORE_INSPIRATION_FEATURE_ID = 'dnd5e-core-inspiration'
export const DND5E_CORE_INSPIRATION_RESOURCE_KEY = 'dnd5e-core-inspiration'

export interface D20EnemyModifierOption {
  characterId: string
  featureId: string
  featureLabel: string
  modifierKind?: 'replace-d20' | 'adjust-d20' | 'choice-reroll'
  sourceTokenId?: string
  dieSides?: number
  direction?: 'add' | 'subtract'
  rerollScope?: 'self-roll' | 'attack-against-self'
  resourceCosts?: readonly { resourceKey: string; amount: number }[]
  decisionRequired?: boolean
}

/**
 * Character-sheet Inspiration is a core d20 reroll resource, rather than a
 * class resource or Bardic Inspiration die. Keep it in the same choice-reroll
 * protocol as Lucky so the player decision, Host roll and resource spend all
 * belong to one authoritative transaction.
 */
export function dnd5eCoreInspirationChoiceRerollOption(
  character: Pick<Character, 'id' | 'inspiration'>,
  sourceTokenId?: string,
): D20EnemyModifierOption | undefined {
  if (!Number.isSafeInteger(character.inspiration) || character.inspiration < 1) return undefined
  return {
    characterId: character.id,
    featureId: DND5E_CORE_INSPIRATION_FEATURE_ID,
    featureLabel: '激励',
    modifierKind: 'choice-reroll',
    sourceTokenId,
    rerollScope: 'self-roll',
    resourceCosts: [{ resourceKey: DND5E_CORE_INSPIRATION_RESOURCE_KEY, amount: 1 }],
    decisionRequired: true,
  }
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
  if (modifiers.some((entry) => entry.modifierKind === 'choice-reroll')) return true
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
