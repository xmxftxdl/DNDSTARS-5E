import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

/** Object animation is a closed target contract, not permission to treat scenery as creatures. */
export function dnd5eActivityAnimatesSelectedObjects(activity: Dnd5eActivityDefinitionV1 | undefined): boolean {
  if (!activity || activity.target.kind !== 'creature' || activity.target.relation !== 'any' ||
      activity.target.allowObjectAttack || activity.target.allowDuplicateTargets || activity.checks?.length) return false
  const operations = activity.outcomes.flatMap(outcome => outcome.operations)
  return operations.some(operation => operation.kind === 'summon' && !!operation.animatedObjectSize) &&
    operations.every(operation =>
      operation.kind === 'summon'
        ? !!operation.animatedObjectSize && operation.count.kind === 'constant' && operation.count.value === 1 &&
          operation.timing === 'immediate' && !operation.corpseFormChoiceId && !operation.afterDamageKillOperationId
        : operation.kind === 'apply-effect' && operation.target === 'actor')
}
