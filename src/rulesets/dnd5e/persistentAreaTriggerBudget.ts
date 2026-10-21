import type { Dnd5ePluginArea } from '../../store/maps'
import type { Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'

/** Shared by candidate collection, Host preparation and the source choice UI. */
export function dnd5ePersistentAreaRemainingTargetBudget(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
  turnKey?: string,
): number {
  const receipts = (area.triggerReceipts ?? []).filter(receipt =>
    !receipt.declined && receipt.triggerId === (trigger.frequencyGroupId ?? trigger.id))
  const lifetime = trigger.maximumTotalUses == null ? Infinity
    : Math.max(0, trigger.maximumTotalUses - receipts.length)
  const turn = trigger.maximumTargetsPerTurn == null ? Infinity
    : !turnKey ? 0 : Math.max(0, trigger.maximumTargetsPerTurn -
      receipts.filter(receipt => receipt.turnKey === turnKey).length)
  return Math.min(lifetime, turn)
}
