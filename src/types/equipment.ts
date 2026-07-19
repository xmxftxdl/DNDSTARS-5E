export type EquipmentSlot =
  | 'mainWeapon'
  | 'offHand'
  | 'armor'
  | 'helmet'
  | 'shoes'
  | 'ring'
  | 'necklace'

export interface EquipmentItem {
  id: string
  name: string
  slot: EquipmentSlot
  /** 兼容旧装备的显示值；规则结算读取 dnd5e。 */
  ac?: number
  /** D&D 5e 2014 规则数据。 */
  dnd5e?:
    | {
        kind: 'weapon'
        category: 'simple' | 'martial'
        mode: 'melee' | 'ranged'
        damage: { count: number; sides: number; type: 'slashing' | 'piercing' | 'bludgeoning' }
        attackAbility: 'str' | 'dex' | 'finesse'
        reachFeet?: number
        rangeFeet?: { normal: number; long: number }
        properties?: readonly string[]
      }
    | {
        kind: 'armor'
        category: 'light' | 'medium' | 'heavy'
        baseArmorClass: number
        dexterityBonus: 'full' | 'max-2' | 'none'
        /** 电爪等规则需要区分目标是否穿戴金属护甲。 */
        material?: 'metal' | 'nonmetal'
        strengthRequirement?: number
        stealthDisadvantage?: boolean
      }
    | {
        kind: 'shield'
        armorClassBonus: number
      }
}

export interface CharacterEquipment {
  mainWeapon?: EquipmentItem
  offHand?: EquipmentItem
  armor?: EquipmentItem
  helmet?: EquipmentItem
  shoes?: EquipmentItem
  ring?: EquipmentItem
  necklace?: EquipmentItem
}

/** @deprecated 旧存档字段，迁移用 */
export interface LegacyCharacterEquipment extends CharacterEquipment {
  weapon?: EquipmentItem
}
