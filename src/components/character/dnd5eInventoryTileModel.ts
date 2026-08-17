import type { Dnd5eInventoryEntry } from '../../types/inventory'

export const DND5E_INVENTORY_CATEGORY_LABELS = {
  equipment: '装备',
  'magic-item': '魔法物品',
  'adventuring-gear': '冒险用品',
  consumable: '消耗品',
  tool: '工具',
  container: '容器',
} as const

export function displayDnd5eInventoryItemName(entry: Dnd5eInventoryEntry): string {
  return entry.item.magicItem && entry.identified === false ? '未鉴定魔法物品' : entry.item.name
}
