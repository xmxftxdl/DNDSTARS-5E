import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import { DND5E_DAMAGE_TYPE_LABELS } from '../damageTypes'

export function dnd5eActivityRolledChoiceIds(activity: Dnd5eActivityDefinitionV1): ReadonlySet<string> {
  return new Set(activity.outcomes.flatMap(outcome => outcome.operations.flatMap(operation =>
    operation.kind === 'damage' && operation.damageTypeFromRoll ? [operation.damageTypeFromRoll.indexChoiceId] : [])))
}

/** The Host presents actual rolled faces, never client-authored type labels. */
export function dnd5eActivityRolledChoices(activity: Dnd5eActivityDefinitionV1, rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>) {
  const ids = dnd5eActivityRolledChoiceIds(activity)
  return (activity.choices ?? []).filter(choice => ids.has(choice.id)).map(choice => {
    const operation = activity.outcomes.flatMap(outcome => outcome.operations).find(operation =>
      operation.kind === 'damage' && operation.damageTypeFromRoll?.indexChoiceId === choice.id)
    if (operation?.kind !== 'damage' || !operation.damageTypeFromRoll) throw new Error('Missing rolled choice mapping')
    const mapping = operation.damageTypeFromRoll
    return { ...choice, options: choice.options.map(option => {
      const face = rolls[mapping.rollId]?.values[Number(option.id)]
      const type = face == null ? undefined : mapping.types[face - 1]
      if (!type) throw new Error('Missing authoritative die for choice')
      return { ...option, label: `${option.label}：${face}（${DND5E_DAMAGE_TYPE_LABELS[type]}）` }
    }) }
  })
}
