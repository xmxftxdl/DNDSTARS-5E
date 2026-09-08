import type { Dnd5eDamageType } from '../../rulesets/dnd5e/damageTypes'

export interface PersistentAreaAdjudicationEffectDraft {
  id: string
  targetTokenId: string
  operation: '' | 'damage'
  amount: string
  damageType: '' | Dnd5eDamageType
  addCondition: string
  conditionDurationRounds: string
  conditionDurationTickOn: 'target-turn-end'
  removeCondition: string
}

export type PersistentAreaSaveOverride = 'unchanged' | 'success' | 'failure'

function damageForSaveOverride(input: {
  saveOverride: PersistentAreaSaveOverride
  proposedDamage?: number
  proposedDamageOnSaveSuccess?: number
  proposedDamageOnSaveFailure?: number
}): number | undefined {
  if (input.saveOverride === 'success') return input.proposedDamageOnSaveSuccess
  if (input.saveOverride === 'failure') return input.proposedDamageOnSaveFailure
  return input.proposedDamage
}

/**
 * Keep the DM-facing final-damage draft synchronized with a save override.
 * A value the DM has already edited is intentionally preserved.
 */
export function projectPersistentAreaAdjudicationEffectsForSaveOverride<T extends {
  targetTokenId: string
  operation: string
  amount: string
}>(input: {
  effects: readonly T[]
  targetTokenId?: string
  currentSaveOverride: PersistentAreaSaveOverride
  nextSaveOverride: PersistentAreaSaveOverride
  proposedDamage?: number
  proposedDamageOnSaveSuccess?: number
  proposedDamageOnSaveFailure?: number
}): T[] {
  const currentDamage = damageForSaveOverride({
    saveOverride: input.currentSaveOverride,
    proposedDamage: input.proposedDamage,
    proposedDamageOnSaveSuccess: input.proposedDamageOnSaveSuccess,
    proposedDamageOnSaveFailure: input.proposedDamageOnSaveFailure,
  })
  const nextDamage = damageForSaveOverride({
    saveOverride: input.nextSaveOverride,
    proposedDamage: input.proposedDamage,
    proposedDamageOnSaveSuccess: input.proposedDamageOnSaveSuccess,
    proposedDamageOnSaveFailure: input.proposedDamageOnSaveFailure,
  })
  if (currentDamage == null || nextDamage == null || currentDamage === nextDamage) {
    return [...input.effects]
  }
  return input.effects.map((effect) =>
    effect.targetTokenId === input.targetTokenId &&
    effect.operation === 'damage' &&
    effect.amount === String(currentDamage)
      ? { ...effect, amount: String(nextDamage) }
      : effect,
  )
}

export function initialPersistentAreaAdjudicationEffects(input: {
  id: string
  targetTokenId?: string
  proposedDamage?: number
  proposedDamageType?: Dnd5eDamageType
  proposedCondition?: string
}): PersistentAreaAdjudicationEffectDraft[] {
  if (
    !input.targetTokenId ||
    (input.proposedDamage == null && !input.proposedCondition)
  ) return []
  return [{
    id: input.id,
    targetTokenId: input.targetTokenId,
    operation: input.proposedDamage != null ? 'damage' : '',
    amount: input.proposedDamage != null ? String(input.proposedDamage) : '',
    damageType: input.proposedDamageType ?? '',
    addCondition: input.proposedCondition ?? '',
    conditionDurationRounds: '',
    conditionDurationTickOn: 'target-turn-end',
    removeCondition: '',
  }]
}

export function initialSpellAdjudicationEffects(input: {
  id: string
  spellId: string
  casterTokenId?: string
  contextKind?: string
}): PersistentAreaAdjudicationEffectDraft[] {
  // An Activity boundary only asks the DM to confirm the explicitly manual
  // remainder of an otherwise authoritative Activity. Its concrete proposals
  // have already been prepared by the Headless executor. Prefilling the old
  // Etherealness adjudication draft here applied a second, unselected caster
  // effect on an 8th/9th-level cast.
  if (
    input.contextKind === 'activity-boundary' ||
    input.spellId !== 'etherealness' ||
    !input.casterTokenId
  ) return []
  return [{
    id: input.id,
    targetTokenId: input.casterTokenId,
    operation: '',
    amount: '',
    damageType: '',
    addCondition: '以太化',
    conditionDurationRounds: '4800',
    conditionDurationTickOn: 'target-turn-end',
    removeCondition: '',
  }]
}
