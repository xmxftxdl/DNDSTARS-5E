import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from './dnd5eActivityContracts'
import { collectDnd5eFormulaRollDeclarations } from './dnd5eFormula'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'

/** A maintained effect may retaliate without its bearer taking an action. */
export function isDnd5eAutonomousBoundHpRetaliation(activity: Dnd5eActivityDefinitionV1): boolean {
  if (!activity.requiresEffectGrant || !['free', 'special'].includes(activity.activation?.kind) ||
    activity.target?.kind !== 'creature' || activity.target.count !== 1 ||
    activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'reaction-window' ||
    activity.invocation.confirmation !== 'automatic' || activity.checks?.length || activity.choices?.length || activity.consumption?.length ||
    !Array.isArray(activity.requirements) || !activity.requirements.some(requirement =>
      requirement?.kind === 'effect-bound-temporary-hit-points' && requirement.subject === 'actor') ||
    !Array.isArray(activity.outcomes) || !activity.outcomes.length) return false
  try {
    return activity.outcomes.every(outcome => Array.isArray(outcome?.operations) && outcome.operations.length > 0 &&
      outcome.operations.every((operation: Dnd5eActivityOperationV1) => operation?.kind === 'damage' && operation.target === 'target' &&
        collectDnd5eFormulaRollDeclarations([operation.amount]).length === 0))
  } catch { return false }
}

export function dnd5eBoundHpRetaliationGrant(actor: Dnd5eHeadlessCombatState['combatants'][string],
  packageId: string, activity: Dnd5eActivityDefinitionV1) {
  if (!isDnd5eAutonomousBoundHpRetaliation(activity)) return undefined
  const pool = actor.classState.temporaryHitPointsSource
  if (!(actor.temporaryHp > 0) || !pool?.effectDefinitionId) return undefined
  return actor.classState.activeEffects?.find(effect => !effect.suspendedBy?.length &&
    effect.source.pluginId === packageId && effect.source.actorId === pool.actorId &&
    effect.grantedActivities?.includes(activity.id) &&
    [effect.definitionId, effect.stackingKey].some(id => id === pool.effectDefinitionId || id?.startsWith(`${pool.effectDefinitionId}:`)))
}
