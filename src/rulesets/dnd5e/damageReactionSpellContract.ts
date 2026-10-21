import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

export interface Dnd5eReactionSpellMetadata {
  level: number
  castingTime: { unit: string; value: number }
}

/** Static entry contract only; not a substitute for live eligibility or behavior acceptance. */
export function dnd5eDamageReactionSpellEntryIssues(activity: Dnd5eActivityDefinitionV1, spell: Dnd5eReactionSpellMetadata,
  event: 'before-damage' | 'creature-died' = 'before-damage'): string[] {
  const issues: string[] = []
  if (activity.legacySource?.kind !== 'spell' || activity.requiresEffectGrant || activity.authorityBinding || activity.activation.kind !== 'reaction' ||
      activity.invocation?.kind !== 'triggered' || activity.invocation.event !== event || activity.invocation.confirmation !== 'actor-choice')
    issues.push('reaction-spell-entry-invalid')
  if (spell.castingTime.unit !== 'reaction' || spell.castingTime.value !== 1) issues.push('reaction-spell-definition-invalid')
  const slots = activity.consumption?.filter(cost => cost.kind === 'spell-slot') ?? []
  if (!Number.isInteger(spell.level) || spell.level < 1 || spell.level > 9 || slots.length !== 1 || slots[0].minimumLevel !== spell.level)
    issues.push('reaction-spell-slot-contract-invalid')
  return issues
}
