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
  /** 护甲等级（AC），与防御力独立 */
  ac?: number
  /** 武器物理攻击力 */
  physicalAttack?: number
  /** 武器魔法攻击力 */
  magicAttack?: number
  /** 护甲物理防御（减伤） */
  defense?: number
  /** 装备魔法防御（减伤） */
  magicDefense?: number
  /** 生命值加成 */
  hpBonus?: number
  /** 暴击伤害加成（百分点，如 2 表示 +2%） */
  critDamagePercent?: number
  /** D&D 5e 2014 规则数据；旧数值字段仅用于旧项目兼容。 */
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
