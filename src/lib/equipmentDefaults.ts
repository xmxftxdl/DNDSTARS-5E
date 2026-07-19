import type { EquipmentSlot } from '../types/equipment'

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'mainWeapon',
  'offHand',
  'armor',
  'helmet',
  'shoes',
  'ring',
  'necklace',
]

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainWeapon: '主手武器',
  offHand: '副手／盾牌',
  armor: '护甲',
  helmet: '头部',
  shoes: '足部',
  ring: '戒指',
  necklace: '项链',
}
