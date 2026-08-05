export type EquipmentSlot =
  | 'mainWeapon'
  | 'offHand'
  | 'armor'
  | 'helmet'
  | 'shoes'
  | 'ring'
  | 'ring2'
  | 'belt'
  | 'necklace'

/** Host 可执行的声明式装备效果；插件不能借此执行任意代码。 */
export interface Dnd5eEquipmentEffects {
  /** 固定武器攻击修正；写在武器上时仅作用于该武器，写在其他装备上时作用于所有武器。 */
  weaponAttackBonus?: number
  /** 固定武器伤害修正；作用域规则同 weaponAttackBonus。 */
  weaponDamageBonus?: number
  /** 对最终护甲等级的固定修正。 */
  armorClassBonus?: number
  /** 对六项豁免的固定修正。 */
  savingThrowBonus?: number
  /** 对步行速度的固定尺数修正。 */
  speedBonusFeet?: number
}

export interface EquipmentItem {
  id: string
  /** 魔法／插件变体沿用哪一件基础装备的熟练项与武器类型。 */
  baseEquipmentId?: string
  name: string
  slot: EquipmentSlot
  /** 兼容旧装备的显示值；规则结算读取 dnd5e。 */
  ac?: number
  /** 装备在任意槽位后，由 Host 汇总并写入 Headless 快照。 */
  effects?: Dnd5eEquipmentEffects
  /** D&D 5e 2014 规则数据。 */
  dnd5e?:
    | {
        kind: 'weapon'
        category: 'simple' | 'martial'
        mode: 'melee' | 'ranged'
        damage: { count: number; sides: number; type: 'slashing' | 'piercing' | 'bludgeoning' }
        attackAbility: 'str' | 'dex' | 'finesse'
        /** 武器本体是否为魔法武器；临时法术附魔不写回装备。 */
        magical?: boolean
        /** 用于绕过依赖武器材质的抗性／免疫；材质本身不代表魔法。 */
        specialMaterial?: 'silvered' | 'adamantine'
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
  ring2?: EquipmentItem
  belt?: EquipmentItem
  necklace?: EquipmentItem
}

/** @deprecated 旧存档字段，迁移用 */
export interface LegacyCharacterEquipment extends CharacterEquipment {
  weapon?: EquipmentItem
}
