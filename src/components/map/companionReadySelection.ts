import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import { isDnd5eCompanionReadyTriggers } from '../../rulesets/dnd5e/companionReady'

export function companionReadyOperations(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.command === 'ready' && operation.allowsReadyTrigger && operation.ready
      ? [{ id: operation.id, trigger: operation.ready.trigger }] : [])) ?? []
}

export async function requestCompanionReadySelections(input: {
  operations: readonly { id: string; trigger: string }[]
  prompt: (message: string, initial: string) => Promise<string | null>
  isCurrent: () => boolean
}): Promise<Record<string, string> | null> {
  const entries: [string, string][] = []
  for (const operation of input.operations) {
    if (!input.isCurrent()) return null
    const trigger = await input.prompt('预备动作：描述一个守卫能够察觉的触发条件（最多 320 字）。', operation.trigger)
    if (trigger == null || !input.isCurrent()) return null
    const selection = { [operation.id]: trigger.trim() }
    if (!isDnd5eCompanionReadyTriggers(selection)) throw Error('invalid-companion-ready-trigger')
    entries.push([operation.id, trigger.trim()])
  }
  return Object.fromEntries(entries)
}
