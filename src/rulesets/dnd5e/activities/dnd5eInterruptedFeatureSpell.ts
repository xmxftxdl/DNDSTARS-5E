import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

export function dnd5eInterruptedFeatureSpellRollIds(activity: Dnd5eActivityDefinitionV1): ReadonlySet<string> {
  const retained = new Set(dnd5eInterruptedFeatureSpellActivity(activity).checks?.map(check => check.id))
  return new Set((activity.checks ?? []).filter(check => !retained.has(check.id)).flatMap(check =>
    'opposedRollId' in check ? [check.rollId, check.opposedRollId] : [check.rollId]))
}

/** Project only the interrupted spell out of a feature; costs and independent effects remain. */
export function dnd5eInterruptedFeatureSpellActivity(activity: Dnd5eActivityDefinitionV1): Dnd5eActivityDefinitionV1 {
  if (!activity.spellInvocation) return activity
  const removedOperations = new Set(activity.spellInvocation.operationIds)
  const references = (value: unknown, ids = new Set<string>()): Set<string> => {
    if (Array.isArray(value)) for (const child of value) references(child, ids)
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if ((key === 'checkId' || key === 'savingThrowCheckId' || key === 'afterCheckId') && typeof child === 'string') ids.add(child)
      else references(child, ids)
    }
    return ids
  }
  const outcomes = activity.outcomes.flatMap(outcome => {
    const operations = outcome.operations.filter(operation => !removedOperations.has(operation.id))
    return operations.length ? [{ ...outcome, operations }] : []
  })
  const removedChecks = references(activity.outcomes.flatMap(outcome => {
    const operations = outcome.operations.filter(operation => removedOperations.has(operation.id))
    return operations.length ? [{ ...outcome, operations }] : []
  }))
  const retainedChecks = references({ outcomes, consumption: activity.consumption, requirements: activity.requirements,
    scaling: activity.scaling, choices: activity.choices, target: activity.target })
  // Preserve any check needed by a retained check, including chained saves/tables.
  for (const check of activity.checks ?? []) if (!removedChecks.has(check.id)) retainedChecks.add(check.id)
  let previousSize = -1
  while (previousSize !== retainedChecks.size) {
    previousSize = retainedChecks.size
    for (const check of activity.checks ?? []) if (retainedChecks.has(check.id)) references(check, retainedChecks)
  }
  return { ...activity, spellInvocation: undefined, outcomes,
    checks: activity.checks?.filter(check => !removedChecks.has(check.id) || retainedChecks.has(check.id)) }
}
