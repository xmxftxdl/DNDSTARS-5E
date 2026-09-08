import type { EquipmentItem, EquipmentSlot } from './equipment'
import type { AbilityKey } from '../lib/dnd'
import type { Dnd5eDamageType } from '../rulesets/dnd5e/damageTypes'

export const DND5E_INVENTORY_ICON_IDS = [
  'weapon',
  'sword',
  'dagger',
  'club',
  'staff',
  'hammer',
  'sickle',
  'spear',
  'polearm',
  'trident',
  'flail',
  'bow',
  'crossbow',
  'sling',
  'sling-bullets',
  'dart',
  'whip',
  'blowgun',
  'net',
  'ammunition',
  'armor',
  'light-armor',
  'medium-armor',
  'heavy-armor',
  'shield',
  'backpack',
  'bedroll',
  'clothing',
  'container',
  'book',
  'instrument',
  'tool',
  'gaming-set',
  'mount',
  'vehicle',
  'ship',
  'rope',
  'string',
  'nails',
  'pickaxe',
  'axe',
  'torch',
  'tinderbox',
  'oil-flask',
  'waterskin',
  'rations',
  'healers-kit',
  'ball-bearings',
  'caltrops',
  'hunting-trap',
  'acid',
  'alchemists-fire',
  'holy-water',
  'antitoxin',
  'poison',
  'healing-potion',
  'perfume',
  'small-knife',
  'dulcimer',
  'spellcasting-focus',
  'magic-ring',
  'magic-potion',
  'magic-wand',
  'magic-staff',
  'magic-rod',
  'magic-scroll',
  'magic-wondrous',
  'generic',
] as const

export type Dnd5eInventoryIconId = typeof DND5E_INVENTORY_ICON_IDS[number]

export type Dnd5eInventoryCategory = 'equipment' | 'magic-item' | 'adventuring-gear' | 'consumable' | 'tool' | 'container'

export type Dnd5eMagicItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very-rare'
  | 'legendary'
  | 'artifact'
  | 'varies'

export type Dnd5eMagicItemKind =
  | 'armor'
  | 'weapon'
  | 'ammunition'
  | 'wondrous-item'
  | 'potion'
  | 'ring'
  | 'rod'
  | 'scroll'
  | 'staff'
  | 'wand'

export interface Dnd5eMagicItemMetadata {
  kind: Dnd5eMagicItemKind
  rarity: Dnd5eMagicItemRarity
  attunement: 'none' | 'required'
  attunementRequirement?: string
  /** headless 表示当前声明式效果已全部接入；其余物品不会伪装成已自动结算。 */
  automation: 'headless' | 'dm-adjudication'
  /** Immutable rules fact; Remove Curse breaks attunement but does not erase it. */
  cursed?: boolean
}

export const DND5E_INVENTORY_SCHEMA_VERSION = 3 as const

export type Dnd5eCurrency = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'

/**
 * 当前角色与场景编辑界面使用的货币。
 * ep/pp 仍保留在存档类型中，用于无损读取旧角色与旧场景。
 */
export const DND5E_EDITABLE_CURRENCIES = ['cp', 'sp', 'gp'] as const satisfies readonly Dnd5eCurrency[]

export type Dnd5eEditableCurrency = (typeof DND5E_EDITABLE_CURRENCIES)[number]

export const DND5E_EDITABLE_CURRENCY_LABELS: Readonly<Record<Dnd5eEditableCurrency, string>> = {
  cp: '铜币',
  sp: '银币',
  gp: '金币',
}

export type Dnd5eCurrencyWallet = Record<Dnd5eCurrency, number>

export type Dnd5eAmmunitionKind = 'arrow' | 'crossbow-bolt' | 'sling-bullet' | 'blowgun-needle'

export type Dnd5eInventoryResourceReset = 'none' | 'short-rest' | 'long-rest' | 'dawn'

export interface Dnd5eInventoryResourceDiceRecovery {
  kind: 'dice'
  trigger: 'dawn'
  dice: { count: number; sides: number; bonus: number }
}

export interface Dnd5eInventoryLastChargeDestructionRule {
  trigger: 'spend-last-charge'
  dieSides: 20
  destroyOn: number
}

export const DND5E_INVENTORY_HEADLESS_EFFECT_SCHEMA_VERSION = 1 as const

/** 模板声明每一件物品提供的实例资源；实际当前值只保存在库存实例中。 */
export interface Dnd5eInventoryResourceDefinition {
  id: string
  label: string
  maximum: number
  initial?: number
  resetOn: Dnd5eInventoryResourceReset
  recovery?: Dnd5eInventoryResourceDiceRecovery
  lastChargeDestruction?: Dnd5eInventoryLastChargeDestructionRule
}

export interface Dnd5eInventoryResourceState {
  id: string
  label: string
  current: number
  maximum: number
  resetOn: Dnd5eInventoryResourceReset
  recovery?: Dnd5eInventoryResourceDiceRecovery
  lastChargeDestruction?: Dnd5eInventoryLastChargeDestructionRule
}

export interface Dnd5eAttackRollRerollEffect {
  /** Optional on legacy packages; the Host normalizes an absent value to V1. */
  schemaVersion?: typeof DND5E_INVENTORY_HEADLESS_EFFECT_SCHEMA_VERSION
  /** Stable within one item template. Legacy packages receive a deterministic id. */
  id?: string
  kind: 'attack-roll-reroll'
  resourceId: string
  resourceCost?: number
  maximumDice: 1
  trigger: 'after-attack-roll'
  appliesTo: 'attacks-with-this-weapon' | 'weapon-attacks'
}

interface Dnd5eInventoryHeadlessEffectBase {
  /** Optional on legacy packages; the Host normalizes an absent value to V1. */
  schemaVersion?: typeof DND5E_INVENTORY_HEADLESS_EFFECT_SCHEMA_VERSION
  /** Stable within one item template. Legacy packages receive a deterministic id. */
  id?: string
  /** Optional instance resource spent atomically with the combat result. */
  resourceId?: string
  resourceCost?: number
}

export interface Dnd5eOnHitBonusDamageEffect extends Dnd5eInventoryHeadlessEffectBase {
  kind: 'on-hit-bonus-damage'
  trigger: 'after-attack-hit'
  appliesTo: 'attacks-with-this-weapon' | 'weapon-attacks'
  damage: {
    count: number
    sides: number
    bonus: number
    modifierFormula?: import('../rulesets/dnd5e/workshopDamageFormula').Dnd5eWorkshopDamageFormulaV1
  }
  damageType: 'inherit' | Dnd5eDamageType
  /** Damage dice are doubled on a critical hit unless explicitly disabled. */
  doubleDiceOnCritical?: boolean
  oncePerTurn?: boolean
  /** Optional Host-validated creature-type allowlist, for example Dragon Slayer. */
  targetCreatureTypes?: readonly string[]
}

interface Dnd5eDamageReductionEffectBase extends Dnd5eInventoryHeadlessEffectBase {
  kind: 'damage-reduction'
  trigger: 'before-damage'
  damageTypes?: readonly Dnd5eDamageType[]
  oncePerTurn?: boolean
}

export type Dnd5eDamageReductionEffect = Dnd5eDamageReductionEffectBase & (
  | { amount: number; dice?: never }
  | { amount?: never; dice: { count: number; sides: number; bonus: number } }
)

export interface Dnd5eDeathPreventionEffect extends Dnd5eInventoryHeadlessEffectBase {
  kind: 'death-prevention'
  trigger: 'before-drop-to-zero'
  hitPointsAfter: number
  /** Defaults to false so massive-damage instant death still wins. */
  preventsMassiveDamage?: boolean
}

export type Dnd5eInventoryHeadlessEffect =
  | Dnd5eAttackRollRerollEffect
  | Dnd5eOnHitBonusDamageEffect
  | Dnd5eDamageReductionEffect
  | Dnd5eDeathPreventionEffect

/**
 * Immutable item/effect identity plus mutable instance resources projected into
 * the authoritative combat snapshot. Combat actions never re-read a mutable
 * plugin catalog while they are settling.
 */
export interface Dnd5eInventoryHeadlessEffectSnapshot {
  instanceId: string
  templateId: string
  itemName: string
  equipmentId?: string
  equippedSlot?: EquipmentSlot
  effectId: string
  effect: Dnd5eInventoryHeadlessEffect
  resources: Record<string, Dnd5eInventoryResourceState>
}

/**
 * Minimal Host-authored projection used by Detect Magic. It deliberately
 * carries no executable rules text: the detector may learn that a visible
 * item bears magic without being allowed to execute or identify that item.
 */
export interface Dnd5eInventoryMagicDetectionSnapshot {
  instanceId: string
  templateId: string
  displayName: string
  equippedSlot?: EquipmentSlot
  containerInstanceId?: string
}

/** Host-authored inventory projection for the three SRD reaction spells. */
export interface Dnd5eInventoryReactionSpellSnapshot {
  instanceId: string
  templateId: string
  itemName: string
  spellId: 'shield' | 'counterspell' | 'hellish-rebuke'
  castAtLevel: number
  spellSaveDc?: number
  spellAttackBonus?: number
  spellcastingAbility: AbilityKey
  quantity: number
}

export interface Dnd5eItemCost {
  amount: number
  currency: Dnd5eCurrency
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
  | {
      kind: 'spell-slot-recovery'
      maximumSlotLevel: number
      amount: number
      selection: 'selected-expended-slot'
    }
  | {
      /**
       * Versioned, declarative item spell source. The client may only submit
       * the owning instance id; the Host resolves and revalidates every field
       * below from the authoritative inventory snapshot.
       */
      kind: 'spell-cast'
      schemaVersion: 1
      spellId: string
      castAtLevel: number
      /** Item text may define a fixed save DC or spell attack bonus. */
      spellSaveDc?: number
      spellAttackBonus?: number
      /** Use the wielder's best available spellcasting ability when the item text says so. */
      useCharacterSpellcasting?: boolean
      /** Magic items normally waive components unless their text says otherwise. */
      requiresComponents?: boolean
      /** Optional class spell-list gate used by concrete spell scrolls. */
      spellcastingClassIds?: readonly string[]
      /** Optional restriction imposed by the item in addition to the spell's normal targeting. */
      targeting?: 'spell-default' | 'self-only'
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

export interface Dnd5eInventoryUseAction {
  id: string
  label: string
  economy: 'action' | 'bonusAction' | 'none'
  consumeQuantity: number
  resourceCost?: { resourceId: string; amount: number }
  targeting?: Dnd5eInventoryTargeting
  chargesPerItem?: number
  effect: Dnd5eInventoryUseEffect
}

/**
 * Explicit rules identity for a spell material. Price alone is never enough to
 * satisfy a spell: a 500 gp weapon must not be accepted as a 500 gp diamond.
 */
export interface Dnd5eSpellcastingMaterialMetadata {
  /** Stable, namespaced ingredient identities understood by spell requirements. */
  tags: readonly string[]
  /** Rules value of one inventory unit, independent from a shop's sale price. */
  unitValueGp?: number
}

export interface Dnd5eInventoryItemTemplate {
  /** 稳定、可由规则包命名空间扩展的模板 ID。 */
  id: string
  name: string
  englishName?: string
  category: Dnd5eInventoryCategory
  icon: Dnd5eInventoryIconId
  /** Optional namespaced bitmap supplied by an installed rules package. */
  iconAssetId?: string
  description: string
  rulesText: string
  weightLb?: number
  /** Physical longest edge used by spells with an object-size limit. */
  longestDimensionFeet?: number
  cost?: Dnd5eItemCost
  /** 装入该容器的物品总重上限。只限制内容物，不包含容器自身重量。 */
  containerCapacityWeightLb?: number
  /** 弹药模板的标准弹药种类；远程武器事务按该字段权威扣除。 */
  ammunitionKind?: Dnd5eAmmunitionKind
  stackable: boolean
  /** Optional explicit identity used by authoritative costly/consumed M checks. */
  spellcastingMaterial?: Dnd5eSpellcastingMaterialMetadata
  equipment?: EquipmentItem
  /** SRD 魔法物品的可检索规则元数据；普通装备不携带此字段。 */
  magicItem?: Dnd5eMagicItemMetadata
  /** 可持久化的实例资源，例如充能。归零不会删除物品实例。 */
  resources?: readonly Dnd5eInventoryResourceDefinition[]
  /** 只能由 Host Headless 事务解释，插件不能直接执行这些效果。 */
  headlessEffects?: readonly Dnd5eInventoryHeadlessEffect[]
  use?: {
    economy: 'action' | 'bonusAction' | 'none'
    consumeQuantity: number
    /** Optional rechargeable instance resource spent by this use transaction. */
    resourceCost?: { resourceId: string; amount: number }
    /** 需要地图或生物目标的物品先完成目标选择，再由 DM 权威端结算。 */
    targeting?: Dnd5eInventoryTargeting
    /** 例如医疗包每件有 10 次使用；存在时优先消费充能，归零后才移除物品。 */
    chargesPerItem?: number
    effect: Dnd5eInventoryUseEffect
  }
  /** Multiple Host-validated actions may spend one shared instance resource. */
  useActions?: readonly Dnd5eInventoryUseAction[]
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
  /** Instance-bound wear retained independently from the immutable item template. */
  condition?: {
    armorClassPenalty?: number
    destroyed?: boolean
  }
  /** 同调只属于具体实例；转交、丢弃或失去该实例时不会跟随模板。 */
  attuned?: boolean
  /** 角色在下一次短休中准备与此物品同调；每次短休至多完成一件。 */
  attunementPending?: boolean
  attunedAt?: number
  /** 未鉴定魔法物品不会公开规则正文，也不会激活装备或 Headless 效果。 */
  identified?: boolean
  /** 玩家投影可公开的唯一鉴定线索；不会泄露模板 ID、物品类型或规则效果。 */
  unidentifiedMagicItemRarity?: Dnd5eMagicItemRarity
  /** 直接容器。容器仍属于同一角色，且禁止形成嵌套循环。 */
  containerInstanceId?: string
  acquiredAt: number
  /** Campaign-clock expiry for Host-generated temporary items such as Goodberry. */
  expiresAtWorldMinute?: number
  /** Traceable rules identity; never interpreted as executable content. */
  generatedByRulesId?: string
  /** Host-owned food/drink contamination markers. Empty/omitted means safe. */
  contaminants?: readonly ('poison' | 'disease')[]
  /** Host-owned location for a spell-linked object; Ethereal entries cannot be used/equipped. */
  planarState?: 'material' | 'ethereal'
  /** Durable spell-authority record that owns the planar transition. */
  linkedSpellAuthorityRecordId?: string
  /** Exact costly focus whose destruction or dispelling ends the linked spell. */
  linkedSpellFocusAuthorityRecordId?: string
}

export interface Dnd5eInventory {
  /** 允许读入 V1/V2 旧存档；所有规范化和写入都会升级为 V3。 */
  schemaVersion: 1 | 2 | typeof DND5E_INVENTORY_SCHEMA_VERSION
  /**
   * Monotonic instance-state revision. Item Activity intents carry the value
   * they were prepared from so the Host can reject stale charge/quantity use.
   */
  revision?: number
  entries: Dnd5eInventoryEntry[]
  /** V1/V2 存档可缺失；规范化后总会补齐五种币值。 */
  currency?: Dnd5eCurrencyWallet
  /**
   * DM Host 权威奖励收据。奖励和收据与库存写入同一个角色快照，
   * 用于在 SSE 重放、刷新或 CAS 重试后避免重复发放。
   */
  authorityGrantReceipts?: string[]
  /**
   * Durable receipts for authoritative item-use transactions. Unlike the
   * transport's in-memory request cache these survive refresh and SSE replay.
   */
  authorityUseReceipts?: string[]
}

export interface Dnd5eInventoryGrant {
  templateId: string
  quantity: number
  identified?: boolean
  expiresAtWorldMinute?: number
  generatedByRulesId?: string
}

export interface Dnd5eInventoryCurrencyGrant {
  currency: Dnd5eCurrency
  amount: number
}

export type Dnd5eInventoryMutation =
  | { type: 'grant'; characterId: string; templateId: string; quantity: number; identified?: boolean }
  | { type: 'discard'; characterId: string; instanceId: string; quantity: number }
  | { type: 'transfer'; characterId: string; targetCharacterId: string; instanceId: string; quantity: number }
  | { type: 'equip'; characterId: string; instanceId: string; slot?: EquipmentSlot }
  | { type: 'unequip'; characterId: string; instanceId: string }
  | { type: 'prepare-attunement'; characterId: string; instanceId: string; dmPrerequisiteConfirmed?: boolean }
  | { type: 'cancel-attunement'; characterId: string; instanceId: string }
  | { type: 'end-attunement'; characterId: string; instanceId: string }
  | { type: 'set-container'; characterId: string; instanceId: string; containerInstanceId?: string }
  | { type: 'adjust-currency'; characterId: string; currency: Dnd5eCurrency; delta: number }
  | {
      type: 'identify'
      characterId: string
      instanceId: string
      /** Durable Host command receipt used by Activity-based Identify. */
      receiptId?: string
      expectedInventoryRevision?: number
    }
  | {
      type: 'break-cursed-attunement'
      characterId: string
      instanceId: string
      receiptId?: string
      expectedInventoryRevision?: number
    }
  | {
      type: 'purify-consumable'
      characterId: string
      instanceId: string
      receiptId?: string
      expectedInventoryRevision?: number
    }
  | {
      /** DM-authored scene state used by poison, disease, and purification rules. */
      type: 'set-consumable-contaminants'
      characterId: string
      instanceId: string
      contaminants: readonly ('poison' | 'disease')[]
    }
  | {
      type: 'use'
      characterId: string
      instanceId: string
      /** Selects one Host-declared action when an item exposes multiple ways to use it. */
      useActionId?: string
      /** Creature-targeted healing applies to this character; the source still pays the item cost. */
      targetCharacterId?: string
      healingRolls?: number[]
      /** Required only by spell-slot-recovery and revalidated by the Host. */
      spellSlotLevel?: number
      /** Stable Host transaction id used for durable idempotency. */
      receiptId?: string
      /** Inventory revision observed while the action was prepared. */
      expectedInventoryRevision?: number
    }

export type Dnd5eInventoryMutationFailure =
  | 'character-not-found'
  | 'target-not-found'
  | 'invalid-target'
  | 'item-not-found'
  | 'template-not-found'
  | 'invalid-quantity'
  | 'insufficient-quantity'
  | 'not-equipment'
  | 'invalid-equipment-slot'
  | 'not-usable'
  | 'attunement-not-required'
  | 'attunement-limit'
  | 'attunement-prerequisite'
  | 'invalid-rolls'
  | 'invalid-spell-slot'
  | 'spell-slot-unavailable'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'same-character'
  | 'invalid-currency'
  | 'insufficient-currency'
  | 'not-container'
  | 'container-cycle'
  | 'container-capacity'
  | 'item-unidentified'
  | 'item-inactive'
  | 'not-magic-item'
  | 'ammunition-unavailable'
  | 'invalid-receipt'
  | 'stale-inventory-revision'
  | 'unauthorized'

export interface Dnd5eInventoryMutationResult {
  ok: boolean
  reason?: Dnd5eInventoryMutationFailure
  characters: import('./character').Character[]
  message?: string
  healingRolled?: number
  healingApplied?: number
  spellSlotLevel?: number
  spellSlotsRecovered?: number
  requiresDmAdjudication?: string
  spentEconomy?: 'action' | 'bonusAction'
  deduplicated?: boolean
}
