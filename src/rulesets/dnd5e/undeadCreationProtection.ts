import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from './activities/dnd5eActivityChoices'

/** A mechanical ward on remains; a higher slot is not itself Wish. */
export interface Dnd5eUndeadCreationProtection {
  minimumPower: 'wish'
}

export function normalizeDnd5eUndeadCreationProtection(value: unknown): Dnd5eUndeadCreationProtection | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  return record.minimumPower === 'wish' && Object.keys(record).every(key => key === 'minimumPower')
    ? { minimumPower: 'wish' } : undefined
}

/** Only Host-owned effects are accepted here. Caller-supplied spell names cannot bypass a ward. */
export function dnd5eUndeadCreationIsProtected(effects: readonly Dnd5eActiveEffectInstance[] | undefined): boolean {
  return effects?.some(effect => !!normalizeDnd5eUndeadCreationProtection(effect.undeadCreationProtection) &&
    !effect.suspendedBy?.length &&
    (effect.duration.type !== 'rounds' || effect.duration.remainingRounds > 0) &&
    (effect.duration.type !== 'concentration' || effect.duration.remainingRounds == null || effect.duration.remainingRounds > 0)) === true
}

/** Dead-target permission belongs only to the selected protective branch. */
export function dnd5eActivityProtectsRemains(activity: Dnd5eActivityDefinitionV1 | undefined,
  choices: Readonly<Record<string, string>> | undefined): boolean {
  return activity?.outcomes.some(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices) &&
    outcome.operations.some(operation => operation.kind === 'apply-effect' &&
      activity.effects?.some(effect => effect.id === operation.effectId && !!effect.undeadCreationProtection))) === true
}
