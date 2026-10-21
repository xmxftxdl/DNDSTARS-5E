import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import { isDnd5eCompanionTaskDescriptions } from '../../rulesets/dnd5e/companionTask'

export function companionTaskOperations(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.command === 'task' && operation.allowsTaskDescription && operation.task
      ? [{ id: operation.id, description: operation.task.description }] : [])) ?? []
}

export async function requestCompanionTaskSelections(input: {
  operations: readonly { id: string; description: string }[]
  prompt: (message: string, initial: string) => Promise<string | null>
  isCurrent: () => boolean
}): Promise<Record<string, string> | null> {
  const entries: [string, string][] = []
  for (const operation of input.operations) {
    if (!input.isCurrent()) return null
    const description = await input.prompt('口头任务：描述要完成的任务（最多 1000 字）。探索、传信等结果由 DM 确认。', operation.description)
    if (description == null || !input.isCurrent()) return null
    const selection = { [operation.id]: description.trim() }
    if (!isDnd5eCompanionTaskDescriptions(selection)) throw Error('invalid-companion-task-description')
    entries.push([operation.id, description.trim()])
  }
  return Object.fromEntries(entries)
}
