import type { EquipmentSlot } from '../types/equipment'

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'mainWeapon',
  'offHand',
  'armor',
  'helmet',
  'shoes',
  'ring',
  'ring2',
  'belt',
  'necklace',
]

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainWeapon: '主手武器',
  offHand: '副手／盾牌',
  armor: '护甲',
  helmet: '头部',
  shoes: '足部',
  ring: '戒指 1',
  ring2: '戒指 2',
  belt: '腰带',
  necklace: '项链',
}

const EQUIPMENT_SLOT_SET = new Set<string>(EQUIPMENT_SLOTS)

export function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === 'string' && EQUIPMENT_SLOT_SET.has(value)
}

/** 戒指模板声明 ring，但可以放入任一戒指位。其他装备仍必须严格匹配声明槽位。 */
export function equipmentSlotAcceptsItemSlot(destination: EquipmentSlot, itemSlot: EquipmentSlot): boolean {
  return itemSlot === 'ring'
    ? destination === 'ring' || destination === 'ring2'
    : destination === itemSlot
}
