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
  fixedAmount?: number
  /** Closed Host-owned values accepted by a stored-result replacement feature. */
  replacementValues?: readonly number[]
  direction?: 'add' | 'subtract'
  rerollScope?: 'self-roll' | 'attack-against-self'
  /** One extra die creates a two-result choice; two create a three-result choice. */
  additionalDice?: 1 | 2
  /** Controls which result the authoritative Host must apply after the reroll. */
  selectionPolicy?: 'owner-chooses' | 'highest' | 'lowest' | 'must-use-latest'
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
  existingRollMode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
): D20EnemyModifierOption | undefined {
  // 2014 Inspiration grants advantage; advantage/disadvantage never stacks.
  // Do not offer (or animate) another d20 after the roll has already been
  // prepared with either mode.
  if (existingRollMode !== 'normal') return undefined
  if (!Number.isSafeInteger(character.inspiration) || character.inspiration < 1) return undefined
  return {
    characterId: character.id,
    featureId: DND5E_CORE_INSPIRATION_FEATURE_ID,
    featureLabel: '激励',
    modifierKind: 'choice-reroll',
    sourceTokenId,
    rerollScope: 'self-roll',
    additionalDice: 1,
    // 2014 Inspiration grants advantage. The roll-confirmation bridge creates
    // the second d20 after the player commits the resource, so the Host must
    // take the higher result instead of opening a second, timeout-prone choice.
    selectionPolicy: 'highest',
    resourceCosts: [{ resourceKey: DND5E_CORE_INSPIRATION_RESOURCE_KEY, amount: 1 }],
    decisionRequired: true,
  }
}

/**
 * Multi-die recipes also carry damage and random-table rolls. Only a single,
 * normal-mode d20 test made by an identified player may enter the Inspiration
 * choice bridge; advantage/disadvantage pools already contain their second die.
 */
export function shouldOfferDnd5ePlayerD20ChoiceReroll(input: {
  count: number
  sides: number
  rollKind?: 'attack' | 'ability-check' | 'saving-throw'
  rollMode?: 'normal' | 'advantage' | 'disadvantage'
  rollerSide?: 'player' | 'enemy'
}): boolean {
  return input.count === 1 && input.sides === 20 && input.rollKind != null &&
    (input.rollMode ?? 'normal') === 'normal' && input.rollerSide === 'player'
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
      (entry.modifierKind ?? 'replace-d20') === 'replace-d20' &&
        (entry.replacementValues?.length ?? 0) > 0 ||
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
