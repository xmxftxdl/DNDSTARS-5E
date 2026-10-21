import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { collectDnd5eFormulaRollDeclarations } from './dnd5eFormula'

/** Profile supported by the persisted crafting UI/Host route. Other exchange
 * combinations remain explicit gaps rather than falling through instant execution. */
export function dnd5eActivityHasInventoryExchangeRitualProfile(activity: Dnd5eActivityDefinitionV1): boolean {
  if (!['minute', 'hour'].includes(activity.activation.kind) || activity.target.kind !== 'self' ||
    activity.choices?.length || activity.checks?.length || activity.scaling?.length || activity.authorityBinding ||
    activity.legacySource?.kind === 'spell' || activity.invocation?.kind === 'triggered' ||
    activity.outcomes.length !== 1 || activity.outcomes[0].when.kind !== 'always' ||
    activity.outcomes[0].operations.length !== 1 ||
    activity.consumption?.some(cost => cost.kind !== 'resource')) return false
  const operation = activity.outcomes[0].operations[0]
  return operation.kind === 'exchange-inventory-items' && collectDnd5eFormulaRollDeclarations([
    operation.quantity, ...(activity.consumption ?? []).flatMap(cost => cost.kind === 'resource' ? [cost.amount] : []),
  ]).length === 0
}
