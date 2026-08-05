import type { EquipmentSlot } from '../../types/equipment'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { equipmentSlotAcceptsItemSlot } from '../../lib/equipmentDefaults'

export const DND5E_INVENTORY_DRAG_MIME = 'application/x-astraltrace-inventory-instance'

export type Dnd5eInventoryDropDestination =
  | { kind: 'equipment'; slot: EquipmentSlot }
  | { kind: 'quickbar'; slotIndex: number }

export type Dnd5eInventoryDropDecision =
  | { accepted: true; action: 'equip' | 'assign-quickbar' }
  | { accepted: false; reason: string }

/**
 * UI preview only. The authoritative inventory/quickbar handlers must still revalidate the instance.
 */
export function dnd5eInventoryDropDecision(
  entry: Dnd5eInventoryEntry | undefined,
  destination: Dnd5eInventoryDropDestination,
): Dnd5eInventoryDropDecision {
  if (!entry) return { accepted: false, reason: '物品实例不存在或已经失效。' }
  if (destination.kind === 'quickbar') {
    if (!Number.isInteger(destination.slotIndex) || destination.slotIndex < 0 || destination.slotIndex > 6) {
      return { accepted: false, reason: '快捷栏槽位无效。' }
    }
    return { accepted: true, action: 'assign-quickbar' }
  }
  if (entry.identified === false) return { accepted: false, reason: '未鉴定物品不能装备。' }
  if (!entry.item.equipment) return { accepted: false, reason: '该物品不是可穿戴装备。' }
  if (!equipmentSlotAcceptsItemSlot(destination.slot, entry.item.equipment.slot)) {
    return { accepted: false, reason: `该物品不能放入这个穿戴槽。` }
  }
  return { accepted: true, action: 'equip' }
}
