import type { EquipmentItem, EquipmentSlot } from './equipment'

export type Dnd5eInventoryIconId =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'backpack'
  | 'bedroll'
  | 'rope'
  | 'torch'
  | 'tinderbox'
  | 'waterskin'
  | 'rations'
  | 'healers-kit'
  | 'ball-bearings'
  | 'caltrops'
  | 'hunting-trap'
  | 'acid'
  | 'alchemists-fire'
  | 'holy-water'
  | 'antitoxin'
  | 'poison'
  | 'healing-potion'
  | 'generic'

export type Dnd5eInventoryCategory = 'equipment' | 'adventuring-gear' | 'consumable' | 'tool' | 'container'

export const DND5E_INVENTORY_SCHEMA_VERSION = 2 as const

export type Dnd5eInventoryResourceReset = 'none' | 'short-rest' | 'long-rest' | 'dawn'

/** 模板声明每一件物品提供的实例资源；实际当前值只保存在库存实例中。 */
export interface Dnd5eInventoryResourceDefinition {
  id: string
  label: string
  maximum: number
  initial?: number
  resetOn: Dnd5eInventoryResourceReset
}

export interface Dnd5eInventoryResourceState {
  id: string
  label: string
  current: number
  maximum: number
  resetOn: Dnd5eInventoryResourceReset
}

export interface Dnd5eAttackRollRerollEffect {
  kind: 'attack-roll-reroll'
  resourceId: string
  maximumDice: 1
  trigger: 'after-attack-roll'
  appliesTo: 'attacks-with-this-weapon' | 'weapon-attacks'
}

export type Dnd5eInventoryHeadlessEffect = Dnd5eAttackRollRerollEffect

export interface Dnd5eItemCost {
  amount: number
  currency: 'cp' | 'sp' | 'gp'
}

export type Dnd5eInventoryUseEffect =
  | {
      kind: 'healing'
      dice: { count: number; sides: number; bonus: number }
    }
  | {
      kind: 'dm-adjudication'
      adjudication: string
    }

export type Dnd5eInventoryTargeting =
  | {
      kind: 'map-area'
      areaKind: 'ball-bearings' | 'caltrops' | 'hunting-trap'
      rangeFeet: number
      widthFeet: number
      heightFeet: number
    }
  | {
      kind: 'creature'
      rangeFeet: number
      includeSelf?: boolean
    }

export interface Dnd5eInventoryItemTemplate {
  /** 稳定、可由规则包命名空间扩展的模板 ID。 */
  id: string
  name: string
  englishName?: string
  category: Dnd5eInventoryCategory
  icon: Dnd5eInventoryIconId
  description: string
  rulesText: string
  weightLb?: number
  cost?: Dnd5eItemCost
  stackable: boolean
  equipment?: EquipmentItem
  /** 可持久化的实例资源，例如充能。归零不会删除物品实例。 */
  resources?: readonly Dnd5eInventoryResourceDefinition[]
  /** 只能由 Host Headless 事务解释，插件不能直接执行这些效果。 */
  headlessEffects?: readonly Dnd5eInventoryHeadlessEffect[]
  use?: {
    economy: 'action' | 'bonusAction' | 'none'
    consumeQuantity: number
    /** 需要地图或生物目标的物品先完成目标选择，再由 DM 权威端结算。 */
    targeting?: Dnd5eInventoryTargeting
    /** 例如医疗包每件有 10 次使用；存在时优先消费充能，归零后才移除物品。 */
    chargesPerItem?: number
    effect: Dnd5eInventoryUseEffect
  }
  source: {
    book: 'SRD 5.1' | string
    license: 'CC BY 4.0' | string
  }
}

/**
 * 库存保存规则模板快照，而不是只保存一个目录索引。这样 DM 导入或插件提供的物品
 * 在规则包暂时未加载时仍能显示；执行时仍由权威端按当前模板重新验证。
 */
export interface Dnd5eInventoryEntry {
  instanceId: string
  templateId: string
  item: Dnd5eInventoryItemTemplate
  quantity: number
  resources?: Record<string, Dnd5eInventoryResourceState>
  /** schema V1 迁移字段；V2 运行时不会再写入。 */
  remainingCharges?: number
  equippedSlot?: EquipmentSlot
  acquiredAt: number
}

export interface Dnd5eInventory {
  /** 允许读入 V1 旧存档；所有规范化和写入都会升级为 V2。 */
  schemaVersion: 1 | typeof DND5E_INVENTORY_SCHEMA_VERSION
  entries: Dnd5eInventoryEntry[]
}

export type Dnd5eInventoryMutation =
  | { type: 'grant'; characterId: string; templateId: string; quantity: number }
  | { type: 'discard'; characterId: string; instanceId: string; quantity: number }
  | { type: 'transfer'; characterId: string; targetCharacterId: string; instanceId: string; quantity: number }
  | { type: 'equip'; characterId: string; instanceId: string }
  | { type: 'unequip'; characterId: string; instanceId: string }
  | { type: 'use'; characterId: string; instanceId: string; healingRolls?: number[] }

export type Dnd5eInventoryMutationFailure =
  | 'character-not-found'
  | 'target-not-found'
  | 'item-not-found'
  | 'template-not-found'
  | 'invalid-quantity'
  | 'insufficient-quantity'
  | 'not-equipment'
  | 'not-usable'
  | 'invalid-rolls'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'same-character'
  | 'unauthorized'

export interface Dnd5eInventoryMutationResult {
  ok: boolean
  reason?: Dnd5eInventoryMutationFailure
  characters: import('./character').Character[]
  message?: string
  healingRolled?: number
  healingApplied?: number
  requiresDmAdjudication?: string
  spentEconomy?: 'action' | 'bonusAction'
}
