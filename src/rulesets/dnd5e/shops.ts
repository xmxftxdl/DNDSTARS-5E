import type { Character } from '../../types/character'
import type {
  Dnd5eCurrency,
  Dnd5eCurrencyWallet,
  Dnd5eInventoryCategory,
  Dnd5eInventoryIconId,
  Dnd5eInventoryItemTemplate,
  Dnd5eMagicItemRarity,
} from '../../types/inventory'
import { DND5E_INVENTORY_ICON_IDS } from '../../types/inventory'
import {
  applyDnd5eInventoryGrantBundle,
  dnd5eInventoryItemTemplate,
  listDnd5eInventoryItemTemplates,
  normalizeDnd5eInventory,
} from './items'

export const DND5E_SHOPS_RESOURCE = 'dnd5e-shops'
export const DND5E_SHOPS_SCHEMA_VERSION = 1 as const
export const DND5E_SHOP_TRANSACTION_LIMIT = 200
export const DND5E_SHOP_RECEIPT_LIMIT = 512

export type Dnd5eShopKind =
  | 'general-store'
  | 'equipment'
  | 'arcane'
  | 'apothecary'
  | 'magic-curios'

export interface Dnd5eShopPreset {
  kind: Dnd5eShopKind
  name: string
  shortName: string
  description: string
  defaultStockCount: number
}

export const DND5E_SHOP_PRESETS: readonly Dnd5eShopPreset[] = [
  {
    kind: 'general-store',
    name: '旅人百货店',
    shortName: '百货店',
    description: '旅行用品、工具、容器与常见消耗品。',
    defaultStockCount: 12,
  },
  {
    kind: 'equipment',
    name: '铁砧装备店',
    shortName: '装备店',
    description: '武器、护甲、盾牌与少量魔法装备。',
    defaultStockCount: 12,
  },
  {
    kind: 'arcane',
    name: '星辉奥术店',
    shortName: '法师店',
    description: '施法法器、具体法术卷轴、魔杖、法杖与奥术奇物。',
    defaultStockCount: 10,
  },
  {
    kind: 'apothecary',
    name: '翠瓶炼金铺',
    shortName: '药水店',
    description: '治疗药水、毒素、炼金物与其他瓶装消耗品。',
    defaultStockCount: 8,
  },
  {
    kind: 'magic-curios',
    name: '秘藏奇物店',
    shortName: '魔法奇物店',
    description: '随机出现的已鉴定魔法物品，不包含神器。',
    defaultStockCount: 8,
  },
] as const

export interface Dnd5eShopOffer {
  id: string
  templateId: string
  name: string
  englishName?: string
  description: string
  /** 完整规则效果快照；旧商店会在规范化时从当前规则目录回填。 */
  rulesText?: string
  category: Dnd5eInventoryCategory
  icon: Dnd5eInventoryIconId
  rarity?: Dnd5eMagicItemRarity
  sourceLabel: string
  quantity: number
  basePriceCopper: number
  /** DM 为这一件商品指定的最终售价；存在时不再应用店铺价格倍率。 */
  priceOverrideCopper?: number
  updatedAt: number
}

export interface Dnd5eShopDefinition {
  id: string
  kind: Dnd5eShopKind
  name: string
  description: string
  open: boolean
  /** 独立的玩家投影门闩；旧存档缺失时必须按 false 处理。 */
  visibleToPlayers: boolean
  priceMultiplier: number
  offers: Dnd5eShopOffer[]
  revision: number
  createdAt: number
  updatedAt: number
}

export interface Dnd5eShopTransaction {
  id: string
  shopId: string
  offerId: string
  characterId: string
  characterName: string
  templateId: string
  itemName: string
  quantity: number
  totalPriceCopper: number
  createdAt: number
}

export interface SharedDnd5eShopsState {
  schemaVersion: typeof DND5E_SHOPS_SCHEMA_VERSION
  revision: number
  shops: Dnd5eShopDefinition[]
  transactions: Dnd5eShopTransaction[]
  purchaseReceipts: string[]
  updatedAt: number
  _sync?: {
    schemaVersion: 1
    revision: number
    writerId: string
    writtenAt: number
  }
}

export interface Dnd5eShopPurchaseRequest {
  id: string
  shopId: string
  offerId: string
  characterId: string
  quantity: number
  expectedShopRevision?: number
  expectedInventoryRevision?: number
  expectedUnitPriceCopper?: number
}

export type Dnd5eShopPurchaseFailure =
  | 'invalid-request'
  | 'shop-not-found'
  | 'shop-closed'
  | 'offer-not-found'
  | 'out-of-stock'
  | 'template-not-found'
  | 'character-not-found'
  | 'insufficient-funds'
  | 'stale-shop-revision'
  | 'stale-inventory-revision'
  | 'inventory-grant-failed'

export type Dnd5eShopPurchaseResult =
  | {
      ok: true
      state: SharedDnd5eShopsState
      characters: Character[]
      totalPriceCopper: number
      message: string
      deduplicated?: boolean
    }
  | {
      ok: false
      state: SharedDnd5eShopsState
      characters: Character[]
      reason: Dnd5eShopPurchaseFailure
      message: string
    }

const CURRENCY_IN_COPPER: Readonly<Record<Dnd5eCurrency, number>> = {
  cp: 1,
  sp: 10,
  ep: 50,
  gp: 100,
  pp: 1_000,
}

const MAGIC_PRICE_COPPER: Readonly<Record<Dnd5eMagicItemRarity, number>> = {
  common: 7_500,
  uncommon: 30_000,
  rare: 300_000,
  'very-rare': 3_000_000,
  legendary: 15_000_000,
  artifact: 100_000_000,
  varies: 100_000,
}

const APOTHECARY_ICONS = new Set<Dnd5eInventoryIconId>([
  'acid',
  'alchemists-fire',
  'holy-water',
  'antitoxin',
  'poison',
  'healing-potion',
  'magic-potion',
])

const SHOP_KINDS = new Set<Dnd5eShopKind>(DND5E_SHOP_PRESETS.map((preset) => preset.kind))
const CATEGORIES = new Set<Dnd5eInventoryCategory>([
  'equipment', 'magic-item', 'adventuring-gear', 'consumable', 'tool', 'container',
])
const ICONS = new Set<Dnd5eInventoryIconId>(DND5E_INVENTORY_ICON_IDS)
const RARITIES = new Set<Dnd5eMagicItemRarity>([
  'common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'varies',
])
const LEGACY_ABSTRACT_SPELL_SCROLL_TEMPLATE_ID = 'srd-5.1:magic-item:spell-scroll'

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value: unknown, fallback: string, maximum = 240): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maximum)
    : fallback
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback
}

function shopId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptySharedDnd5eShops(): SharedDnd5eShopsState {
  return {
    schemaVersion: DND5E_SHOPS_SCHEMA_VERSION,
    revision: 0,
    shops: [],
    transactions: [],
    purchaseReceipts: [],
    updatedAt: 0,
  }
}

function normalizeOffer(value: unknown): Dnd5eShopOffer | null {
  if (!plainObject(value)) return null
  const templateId = boundedText(value.templateId, '', 240)
  // 旧版目录只有一个无法施放、也没有具体法术的“法术卷轴”占位条目。
  // 具体卷轴上线后不再保留这个含糊商品，避免旧商店继续把它展示给 DM。
  if (!templateId || templateId === LEGACY_ABSTRACT_SPELL_SCROLL_TEMPLATE_ID) return null
  const liveTemplate = dnd5eInventoryItemTemplate(templateId)
  const category = CATEGORIES.has(value.category as Dnd5eInventoryCategory)
    ? value.category as Dnd5eInventoryCategory
    : 'adventuring-gear'
  const icon = ICONS.has(value.icon as Dnd5eInventoryIconId)
    ? value.icon as Dnd5eInventoryIconId
    : 'generic'
  const rarity = RARITIES.has(value.rarity as Dnd5eMagicItemRarity)
    ? value.rarity as Dnd5eMagicItemRarity
    : undefined
  return {
    id: boundedText(value.id, `offer:${templateId}`, 300),
    templateId,
    name: boundedText(value.name, templateId, 160),
    ...(typeof value.englishName === 'string' && value.englishName.trim()
      ? { englishName: value.englishName.trim().slice(0, 160) }
      : {}),
    description: boundedText(value.description, '由当前规则目录提供的物品。', 2_000),
    ...((typeof value.rulesText === 'string' && value.rulesText.trim()) || liveTemplate?.rulesText
      ? { rulesText: boundedText(value.rulesText, liveTemplate?.rulesText ?? '', 20_000) }
      : {}),
    category,
    icon,
    ...(rarity ? { rarity } : {}),
    sourceLabel: boundedText(value.sourceLabel, '自定义规则', 160),
    quantity: boundedInteger(value.quantity, 0, 0, 999),
    basePriceCopper: boundedInteger(value.basePriceCopper, 100, 1, 1_000_000_000),
    ...(Number.isSafeInteger(value.priceOverrideCopper) && Number(value.priceOverrideCopper) >= 1
      ? { priceOverrideCopper: Math.min(1_000_000_000, Number(value.priceOverrideCopper)) }
      : {}),
    updatedAt: Math.max(0, Number(value.updatedAt) || 0),
  }
}

function normalizeShop(value: unknown): Dnd5eShopDefinition | null {
  if (!plainObject(value)) return null
  const id = boundedText(value.id, '', 180)
  if (!id || !SHOP_KINDS.has(value.kind as Dnd5eShopKind)) return null
  const now = Math.max(0, Number(value.updatedAt) || 0)
  const offers = Array.isArray(value.offers)
    ? value.offers.slice(0, 500).map(normalizeOffer).filter((offer): offer is Dnd5eShopOffer => !!offer)
    : []
  const uniqueOffers = [...new Map(offers.map((offer) => [offer.id, offer])).values()]
  return {
    id,
    kind: value.kind as Dnd5eShopKind,
    name: boundedText(value.name, '未命名商店', 120),
    description: boundedText(value.description, '一间冒险者商店。', 500),
    open: value.open !== false,
    visibleToPlayers: value.visibleToPlayers === true,
    priceMultiplier: Math.max(0.25, Math.min(5, Number(value.priceMultiplier) || 1)),
    offers: uniqueOffers,
    revision: boundedInteger(value.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    createdAt: Math.max(0, Number(value.createdAt) || now),
    updatedAt: now,
  }
}

function normalizeTransaction(value: unknown): Dnd5eShopTransaction | null {
  if (!plainObject(value)) return null
  const id = boundedText(value.id, '', 300)
  const shopIdValue = boundedText(value.shopId, '', 180)
  const offerId = boundedText(value.offerId, '', 300)
  const characterId = boundedText(value.characterId, '', 180)
  const templateId = boundedText(value.templateId, '', 240)
  if (!id || !shopIdValue || !offerId || !characterId || !templateId) return null
  return {
    id,
    shopId: shopIdValue,
    offerId,
    characterId,
    characterName: boundedText(value.characterName, '未知角色', 160),
    templateId,
    itemName: boundedText(value.itemName, templateId, 160),
    quantity: boundedInteger(value.quantity, 1, 1, 99),
    totalPriceCopper: boundedInteger(value.totalPriceCopper, 1, 1, 1_000_000_000),
    createdAt: Math.max(0, Number(value.createdAt) || 0),
  }
}

export function normalizeSharedDnd5eShops(value: unknown): SharedDnd5eShopsState {
  if (!plainObject(value)) return emptySharedDnd5eShops()
  const shops = Array.isArray(value.shops)
    ? value.shops.slice(0, 100).map(normalizeShop).filter((shop): shop is Dnd5eShopDefinition => !!shop)
    : []
  const transactions = Array.isArray(value.transactions)
    ? value.transactions.slice(-DND5E_SHOP_TRANSACTION_LIMIT)
      .map(normalizeTransaction).filter((entry): entry is Dnd5eShopTransaction => !!entry)
    : []
  const purchaseReceipts = Array.isArray(value.purchaseReceipts)
    ? value.purchaseReceipts
      .filter((receipt): receipt is string => typeof receipt === 'string' && !!receipt.trim())
      .map((receipt) => receipt.trim().slice(0, 300))
      .slice(-DND5E_SHOP_RECEIPT_LIMIT)
    : []
  const sync = plainObject(value._sync) && value._sync.schemaVersion === 1 &&
    Number.isInteger(value._sync.revision) && typeof value._sync.writerId === 'string' &&
    Number.isFinite(value._sync.writtenAt)
    ? value._sync as SharedDnd5eShopsState['_sync']
    : undefined
  return {
    schemaVersion: DND5E_SHOPS_SCHEMA_VERSION,
    revision: boundedInteger(value.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    shops: [...new Map(shops.map((shop) => [shop.id, shop])).values()],
    transactions,
    purchaseReceipts: [...new Set(purchaseReceipts)],
    updatedAt: Math.max(0, Number(value.updatedAt) || 0),
    ...(sync ? { _sync: sync } : {}),
  }
}

export function validateSharedDnd5eShops(value: unknown): boolean {
  if (!plainObject(value) || value.schemaVersion !== DND5E_SHOPS_SCHEMA_VERSION ||
    !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 ||
    !Array.isArray(value.shops) || !Array.isArray(value.transactions) ||
    !Array.isArray(value.purchaseReceipts) || value.shops.length > 100 ||
    value.transactions.length > DND5E_SHOP_TRANSACTION_LIMIT ||
    value.purchaseReceipts.length > DND5E_SHOP_RECEIPT_LIMIT ||
    !Number.isFinite(value.updatedAt) || Number(value.updatedAt) < 0) return false
  const shopIds = new Set<string>()
  for (const rawShop of value.shops) {
    if (!plainObject(rawShop) || typeof rawShop.id !== 'string' || !rawShop.id.trim() ||
      rawShop.id.length > 180 || shopIds.has(rawShop.id) ||
      !SHOP_KINDS.has(rawShop.kind as Dnd5eShopKind) ||
      typeof rawShop.name !== 'string' || !rawShop.name.trim() || rawShop.name.length > 120 ||
      typeof rawShop.description !== 'string' || rawShop.description.length > 500 ||
      typeof rawShop.open !== 'boolean' || !Number.isFinite(rawShop.priceMultiplier) ||
      (rawShop.visibleToPlayers != null && typeof rawShop.visibleToPlayers !== 'boolean') ||
      Number(rawShop.priceMultiplier) < 0.25 || Number(rawShop.priceMultiplier) > 5 ||
      !Number.isSafeInteger(rawShop.revision) || Number(rawShop.revision) < 0 ||
      !Number.isFinite(rawShop.createdAt) || Number(rawShop.createdAt) < 0 ||
      !Number.isFinite(rawShop.updatedAt) || Number(rawShop.updatedAt) < 0 ||
      !Array.isArray(rawShop.offers) || rawShop.offers.length > 500) return false
    shopIds.add(rawShop.id)
    const offerIds = new Set<string>()
    for (const rawOffer of rawShop.offers) {
      if (!plainObject(rawOffer) || typeof rawOffer.id !== 'string' || !rawOffer.id.trim() ||
        rawOffer.id.length > 300 || offerIds.has(rawOffer.id) ||
        typeof rawOffer.templateId !== 'string' || !rawOffer.templateId.trim() || rawOffer.templateId.length > 240 ||
        typeof rawOffer.name !== 'string' || !rawOffer.name.trim() || rawOffer.name.length > 160 ||
        (rawOffer.englishName != null && (typeof rawOffer.englishName !== 'string' ||
          !rawOffer.englishName.trim() || rawOffer.englishName.length > 160)) ||
        typeof rawOffer.description !== 'string' || rawOffer.description.length > 2_000 ||
        (rawOffer.rulesText != null && (typeof rawOffer.rulesText !== 'string' ||
          !rawOffer.rulesText.trim() || rawOffer.rulesText.length > 20_000)) ||
        !CATEGORIES.has(rawOffer.category as Dnd5eInventoryCategory) ||
        !ICONS.has(rawOffer.icon as Dnd5eInventoryIconId) ||
        (rawOffer.rarity != null && !RARITIES.has(rawOffer.rarity as Dnd5eMagicItemRarity)) ||
        typeof rawOffer.sourceLabel !== 'string' || !rawOffer.sourceLabel.trim() || rawOffer.sourceLabel.length > 160 ||
        !Number.isSafeInteger(rawOffer.quantity) || Number(rawOffer.quantity) < 0 || Number(rawOffer.quantity) > 999 ||
        !Number.isSafeInteger(rawOffer.basePriceCopper) || Number(rawOffer.basePriceCopper) < 1 ||
        Number(rawOffer.basePriceCopper) > 1_000_000_000 ||
        (rawOffer.priceOverrideCopper != null && (
          !Number.isSafeInteger(rawOffer.priceOverrideCopper) || Number(rawOffer.priceOverrideCopper) < 1 ||
          Number(rawOffer.priceOverrideCopper) > 1_000_000_000
        )) ||
        !Number.isFinite(rawOffer.updatedAt) || Number(rawOffer.updatedAt) < 0) return false
      offerIds.add(rawOffer.id)
    }
  }
  const receipts = new Set<string>()
  for (const receipt of value.purchaseReceipts) {
    if (typeof receipt !== 'string' || !receipt.trim() || receipt.length > 300 || receipts.has(receipt)) return false
    receipts.add(receipt)
  }
  const transactionIds = new Set<string>()
  for (const transaction of value.transactions) {
    if (!plainObject(transaction) || typeof transaction.id !== 'string' || !transaction.id.trim() ||
      transaction.id.length > 300 || transactionIds.has(transaction.id) ||
      typeof transaction.shopId !== 'string' || !transaction.shopId.trim() || transaction.shopId.length > 180 ||
      typeof transaction.offerId !== 'string' || !transaction.offerId.trim() || transaction.offerId.length > 300 ||
      typeof transaction.characterId !== 'string' || !transaction.characterId.trim() || transaction.characterId.length > 180 ||
      typeof transaction.characterName !== 'string' || !transaction.characterName.trim() || transaction.characterName.length > 160 ||
      typeof transaction.templateId !== 'string' || !transaction.templateId.trim() || transaction.templateId.length > 240 ||
      typeof transaction.itemName !== 'string' || !transaction.itemName.trim() || transaction.itemName.length > 160 ||
      !Number.isSafeInteger(transaction.quantity) || Number(transaction.quantity) < 1 || Number(transaction.quantity) > 99 ||
      !Number.isSafeInteger(transaction.totalPriceCopper) || Number(transaction.totalPriceCopper) < 1 ||
      Number(transaction.totalPriceCopper) > 1_000_000_000 ||
      !Number.isFinite(transaction.createdAt) || Number(transaction.createdAt) < 0) return false
    transactionIds.add(transaction.id)
  }
  return value._sync == null || (
    plainObject(value._sync) && value._sync.schemaVersion === 1 &&
    Number.isInteger(value._sync.revision) && Number(value._sync.revision) >= 0 &&
    typeof value._sync.writerId === 'string' && Number.isFinite(value._sync.writtenAt)
  )
}

export function dnd5eShopPreset(kind: Dnd5eShopKind): Dnd5eShopPreset {
  return DND5E_SHOP_PRESETS.find((preset) => preset.kind === kind) ?? DND5E_SHOP_PRESETS[0]
}

export function createDnd5eShop(kind: Dnd5eShopKind, now = Date.now()): Dnd5eShopDefinition {
  const preset = dnd5eShopPreset(kind)
  return {
    id: shopId(),
    kind,
    name: preset.name,
    description: preset.description,
    // 新商店先作为 DM 草稿存在；只有 DM 明确公开后才进入玩家投影。
    open: false,
    visibleToPlayers: false,
    priceMultiplier: 1,
    offers: [],
    revision: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function templateAllowedInShop(template: Dnd5eInventoryItemTemplate, kind: Dnd5eShopKind): boolean {
  if (template.magicItem?.rarity === 'artifact') return false
  if (kind === 'general-store') return !template.magicItem && template.category !== 'equipment'
  if (kind === 'equipment') {
    return template.category === 'equipment' ||
      ['weapon', 'armor', 'ammunition'].includes(template.magicItem?.kind ?? '')
  }
  if (kind === 'apothecary') {
    return template.magicItem?.kind === 'potion' || APOTHECARY_ICONS.has(template.icon)
  }
  if (kind === 'arcane') {
    return template.icon === 'spellcasting-focus' ||
      ['scroll', 'wand', 'staff', 'rod', 'ring', 'wondrous-item'].includes(template.magicItem?.kind ?? '')
  }
  return !!template.magicItem
}

export function dnd5eShopEligibleTemplates(
  kind: Dnd5eShopKind,
  catalog: readonly Dnd5eInventoryItemTemplate[] = listDnd5eInventoryItemTemplates(),
): readonly Dnd5eInventoryItemTemplate[] {
  return catalog
    .filter((template) => templateAllowedInShop(template, kind))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5eShopBasePriceCopper(template: Dnd5eInventoryItemTemplate): number {
  if (template.cost && Number.isFinite(template.cost.amount) && template.cost.amount > 0) {
    return Math.max(1, Math.min(1_000_000_000,
      Math.round(template.cost.amount * CURRENCY_IN_COPPER[template.cost.currency])))
  }
  if (template.magicItem) return MAGIC_PRICE_COPPER[template.magicItem.rarity]
  if (template.category === 'equipment') return 1_000
  if (template.category === 'consumable') return 200
  if (template.category === 'container') return 500
  return 100
}

function randomInteger(minimum: number, maximum: number, random: () => number): number {
  const roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0))
  return minimum + Math.floor(roll * (maximum - minimum + 1))
}

function stockQuantity(template: Dnd5eInventoryItemTemplate, random: () => number): number {
  if (template.magicItem && template.magicItem.kind !== 'potion' && template.magicItem.kind !== 'ammunition') {
    return randomInteger(1, 2, random)
  }
  if (template.stackable || template.category === 'consumable') return randomInteger(3, 10, random)
  return randomInteger(1, 4, random)
}

function shuffleTemplates(
  templates: readonly Dnd5eInventoryItemTemplate[],
  random: () => number,
): Dnd5eInventoryItemTemplate[] {
  const shuffled = [...templates]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomInteger(0, index, random)
    const held = shuffled[index]
    shuffled[index] = shuffled[target]
    shuffled[target] = held
  }
  return shuffled
}

function arcaneScrollWeight(template: Dnd5eInventoryItemTemplate): number {
  if (template.magicItem?.kind !== 'scroll') return 0
  if (template.magicItem.rarity === 'common') return 18
  if (template.magicItem.rarity === 'uncommon') return 8
  if (template.magicItem.rarity === 'rare') return 3
  if (template.magicItem.rarity === 'very-rare') return 1
  if (template.magicItem.rarity === 'legendary') return 0.15
  return 0.05
}

function weightedScrollSelection(
  templates: readonly Dnd5eInventoryItemTemplate[],
  count: number,
  random: () => number,
): Dnd5eInventoryItemTemplate[] {
  const remaining = [...templates]
  const selected: Dnd5eInventoryItemTemplate[] = []
  while (remaining.length > 0 && selected.length < count) {
    const totalWeight = remaining.reduce((sum, template) => sum + arcaneScrollWeight(template), 0)
    let roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * totalWeight
    let selectedIndex = remaining.length - 1
    for (let index = 0; index < remaining.length; index += 1) {
      roll -= arcaneScrollWeight(remaining[index])
      if (roll < 0) {
        selectedIndex = index
        break
      }
    }
    selected.push(remaining.splice(selectedIndex, 1)[0])
  }
  return selected
}

function restockSelection(
  kind: Dnd5eShopKind,
  pool: readonly Dnd5eInventoryItemTemplate[],
  count: number,
  random: () => number,
): Dnd5eInventoryItemTemplate[] {
  if (kind !== 'arcane' || count < 1) return shuffleTemplates(pool, random).slice(0, count)

  const scrolls = pool.filter((template) => template.magicItem?.kind === 'scroll')
  const otherGoods = pool.filter((template) => template.magicItem?.kind !== 'scroll')
  const preferredScrollCount = Math.min(scrolls.length, count, Math.max(1, Math.round(count * 0.3)))
  const selectedScrolls = weightedScrollSelection(scrolls, preferredScrollCount, random)
  const selectedOtherGoods = shuffleTemplates(otherGoods, random).slice(0, count - selectedScrolls.length)
  const missing = count - selectedScrolls.length - selectedOtherGoods.length
  const extraScrolls = missing > 0
    ? weightedScrollSelection(
        scrolls.filter((template) => !selectedScrolls.some((selected) => selected.id === template.id)),
        missing,
        random,
      )
    : []
  return [...selectedScrolls, ...selectedOtherGoods, ...extraScrolls]
}

function offerFromTemplate(
  template: Dnd5eInventoryItemTemplate,
  quantity: number,
  now: number,
): Dnd5eShopOffer {
  return {
    id: `offer:${template.id}`,
    templateId: template.id,
    name: template.name,
    ...(template.englishName ? { englishName: template.englishName } : {}),
    description: template.description.slice(0, 2_000),
    rulesText: template.rulesText.slice(0, 20_000),
    category: template.category,
    icon: template.icon,
    ...(template.magicItem?.rarity ? { rarity: template.magicItem.rarity } : {}),
    sourceLabel: template.source.book,
    quantity,
    basePriceCopper: dnd5eShopBasePriceCopper(template),
    updatedAt: now,
  }
}

function isSpellScrollOffer(offer: Dnd5eShopOffer): boolean {
  return offer.icon === 'magic-scroll' ||
    dnd5eInventoryItemTemplate(offer.templateId)?.magicItem?.kind === 'scroll'
}

/** 返回商店中每一种可明确识别的法术卷轴名称。 */
export function dnd5eShopSpellScrollNames(shop: Pick<Dnd5eShopDefinition, 'offers'>): string[] {
  return shop.offers
    .filter((offer) => offer.templateId !== LEGACY_ABSTRACT_SPELL_SCROLL_TEMPLATE_ID && isSpellScrollOffer(offer))
    .map((offer) => offer.name)
}

/** 商店中的非魔法物品没有规则稀有度字段，展示时统一视为“普通”。 */
export function dnd5eShopOfferDisplayRarity(
  offer: Pick<Dnd5eShopOffer, 'rarity'>,
): Dnd5eMagicItemRarity {
  return offer.rarity ?? 'common'
}

/** 返回一次补货中实际抽中（新增或增加库存）的具体法术卷轴名称。 */
export function dnd5eRestockedSpellScrollNames(
  before: Pick<Dnd5eShopDefinition, 'offers'>,
  after: Pick<Dnd5eShopDefinition, 'offers'>,
): string[] {
  const previousQuantity = new Map(before.offers.map((offer) => [offer.templateId, offer.quantity]))
  return after.offers
    .filter((offer) => isSpellScrollOffer(offer) &&
      offer.quantity > (previousQuantity.get(offer.templateId) ?? 0))
    .map((offer) => offer.name)
}

export function restockDnd5eShop(
  shop: Dnd5eShopDefinition,
  count: number,
  options: {
    random?: () => number
    now?: number
    catalog?: readonly Dnd5eInventoryItemTemplate[]
  } = {},
): Dnd5eShopDefinition {
  const random = options.random ?? Math.random
  const now = options.now ?? Date.now()
  const pool = [...dnd5eShopEligibleTemplates(shop.kind, options.catalog)]
  const selected = restockSelection(
    shop.kind,
    pool,
    Math.max(0, Math.min(50, Math.floor(count))),
    random,
  )
  const byTemplateId = new Map(shop.offers
    .filter((offer) => offer.templateId !== LEGACY_ABSTRACT_SPELL_SCROLL_TEMPLATE_ID)
    .map((offer) => [offer.templateId, offer]))
  for (const template of selected) {
    const added = stockQuantity(template, random)
    const existing = byTemplateId.get(template.id)
    byTemplateId.set(template.id, existing
      ? {
          ...offerFromTemplate(template, 0, now),
          id: existing.id,
          quantity: Math.min(999, existing.quantity + added),
          ...(existing.priceOverrideCopper != null
            ? { priceOverrideCopper: existing.priceOverrideCopper }
            : {}),
        }
      : offerFromTemplate(template, added, now))
  }
  return {
    ...shop,
    offers: [...byTemplateId.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'zh-CN')),
    revision: shop.revision + 1,
    updatedAt: now,
  }
}

export function dnd5eShopUnitPriceCopper(
  offer: Pick<Dnd5eShopOffer, 'basePriceCopper' | 'priceOverrideCopper'>,
  shop: Pick<Dnd5eShopDefinition, 'priceMultiplier'>,
): number {
  if (offer.priceOverrideCopper != null) {
    return Math.max(1, Math.min(1_000_000_000, Math.round(offer.priceOverrideCopper)))
  }
  return Math.max(1, Math.min(1_000_000_000,
    Math.round(offer.basePriceCopper * shop.priceMultiplier)))
}

export function setDnd5eShopOfferPrice(
  shop: Dnd5eShopDefinition,
  offerId: string,
  priceOverrideCopper: number | undefined,
  now = Date.now(),
): Dnd5eShopDefinition | null {
  if (!shop.offers.some((offer) => offer.id === offerId)) return null
  const normalizedOverride = priceOverrideCopper == null
    ? undefined
    : Math.max(1, Math.min(1_000_000_000, Math.round(Number(priceOverrideCopper) || 1)))
  return {
    ...shop,
    offers: shop.offers.map((offer) => {
      if (offer.id !== offerId) return offer
      const updated = { ...offer, updatedAt: now }
      if (normalizedOverride == null) {
        delete updated.priceOverrideCopper
      } else {
        updated.priceOverrideCopper = normalizedOverride
      }
      return updated
    }),
    revision: shop.revision + 1,
    updatedAt: now,
  }
}

export function dnd5eWalletCopper(wallet: Partial<Dnd5eCurrencyWallet> | undefined): number {
  return (Object.keys(CURRENCY_IN_COPPER) as Dnd5eCurrency[]).reduce((total, currency) => {
    const amount = Number(wallet?.[currency])
    return total + (Number.isSafeInteger(amount) && amount > 0 ? amount * CURRENCY_IN_COPPER[currency] : 0)
  }, 0)
}

export function dnd5eWalletFromCopper(totalCopper: number): Dnd5eCurrencyWallet {
  let remaining = Math.max(0, Math.floor(totalCopper))
  const wallet: Dnd5eCurrencyWallet = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
  // 本项目的可见经济只使用金币、银币、铜币。ep/pp 仅为旧存档兼容字段，
  // 结算找零时不再生成这两种货币。
  for (const currency of ['gp', 'sp', 'cp'] as const) {
    wallet[currency] = Math.floor(remaining / CURRENCY_IN_COPPER[currency])
    remaining %= CURRENCY_IN_COPPER[currency]
  }
  return wallet
}

export function formatDnd5eCopper(copper: number): string {
  const wallet = dnd5eWalletFromCopper(copper)
  const labels = {
    gp: '金币', sp: '银币', cp: '铜币',
  }
  const values = (['gp', 'sp', 'cp'] as const)
    .filter((currency) => wallet[currency] > 0)
    .map((currency) => `${wallet[currency]} ${labels[currency]}`)
  return values.join(' ') || '0 铜币'
}

function purchaseFailureMessage(reason: Dnd5eShopPurchaseFailure): string {
  switch (reason) {
    case 'shop-not-found': return '商店已不存在。'
    case 'shop-closed': return '商店当前未向玩家开放。'
    case 'offer-not-found': return '该商品已下架。'
    case 'out-of-stock': return '库存数量不足。'
    case 'template-not-found': return '当前规则目录中找不到该商品，可能需要重新同步扩展。'
    case 'character-not-found': return '找不到购买角色。'
    case 'insufficient-funds': return '角色携带的货币不足。'
    case 'stale-shop-revision': return '商店刚刚发生变化，请按新库存重试。'
    case 'stale-inventory-revision': return '角色背包刚刚发生变化，请重试。'
    case 'inventory-grant-failed': return '商品未能写入角色背包。'
    default: return '购买请求无效。'
  }
}

function failPurchase(
  state: SharedDnd5eShopsState,
  characters: readonly Character[],
  reason: Dnd5eShopPurchaseFailure,
): Dnd5eShopPurchaseResult {
  return { ok: false, state, characters: [...characters], reason, message: purchaseFailureMessage(reason) }
}

/**
 * Host 端的纯结算事务。调用方只有在同时持久化返回的 characters 与 state 后，
 * 才能把购买视为成功。
 */
export function settleDnd5eShopPurchase(
  sharedInput: SharedDnd5eShopsState,
  characters: readonly Character[],
  request: Dnd5eShopPurchaseRequest,
  now = Date.now(),
): Dnd5eShopPurchaseResult {
  const state = normalizeSharedDnd5eShops(sharedInput)
  if (!request.id?.trim() || request.id.length > 140 || !/^[a-zA-Z0-9:._-]+$/.test(request.id) ||
    !request.shopId || !request.offerId ||
    !request.characterId || !Number.isSafeInteger(request.quantity) ||
    request.quantity < 1 || request.quantity > 99) {
    return failPurchase(state, characters, 'invalid-request')
  }
  if (state.purchaseReceipts.includes(request.id)) {
    return {
      ok: true,
      state,
      characters: [...characters],
      totalPriceCopper: 0,
      message: '这笔购买已经结算，不会重复扣款或发货。',
      deduplicated: true,
    }
  }
  const shop = state.shops.find((candidate) => candidate.id === request.shopId)
  if (!shop) return failPurchase(state, characters, 'shop-not-found')
  if (!shop.open || !shop.visibleToPlayers) return failPurchase(state, characters, 'shop-closed')
  if (request.expectedShopRevision != null && request.expectedShopRevision !== shop.revision) {
    return failPurchase(state, characters, 'stale-shop-revision')
  }
  const offer = shop.offers.find((candidate) => candidate.id === request.offerId)
  if (!offer) return failPurchase(state, characters, 'offer-not-found')
  if (offer.quantity < request.quantity) return failPurchase(state, characters, 'out-of-stock')
  const template = dnd5eInventoryItemTemplate(offer.templateId)
  if (!template) return failPurchase(state, characters, 'template-not-found')
  const characterIndex = characters.findIndex((character) => character.id === request.characterId)
  if (characterIndex < 0) return failPurchase(state, characters, 'character-not-found')
  const character = characters[characterIndex]
  const inventory = normalizeDnd5eInventory(character)
  if (request.expectedInventoryRevision != null && request.expectedInventoryRevision !== (inventory.revision ?? 0)) {
    return failPurchase(state, characters, 'stale-inventory-revision')
  }
  const unitPrice = dnd5eShopUnitPriceCopper(offer, shop)
  if (request.expectedUnitPriceCopper != null && request.expectedUnitPriceCopper !== unitPrice) {
    return failPurchase(state, characters, 'stale-shop-revision')
  }
  const totalPriceCopper = unitPrice * request.quantity
  const currentCopper = dnd5eWalletCopper(inventory.currency)
  if (!Number.isSafeInteger(totalPriceCopper) || totalPriceCopper < 1 || currentCopper < totalPriceCopper) {
    return failPurchase(state, characters, 'insufficient-funds')
  }

  const debitedCharacter: Character = {
    ...character,
    dnd5eInventory: {
      ...inventory,
      revision: (inventory.revision ?? 0) + 1,
      currency: dnd5eWalletFromCopper(currentCopper - totalPriceCopper),
    },
  }
  const debitedCharacters = characters.map((candidate, index) =>
    index === characterIndex ? debitedCharacter : candidate)
  const grantResult = applyDnd5eInventoryGrantBundle(debitedCharacters, {
    characterId: character.id,
    grants: [{ templateId: template.id, quantity: request.quantity, identified: true }],
    receiptId: `shop:${request.id}`,
  })
  if (!grantResult.ok) return failPurchase(state, characters, 'inventory-grant-failed')

  const nextShop: Dnd5eShopDefinition = {
    ...shop,
    offers: shop.offers.map((candidate) => candidate.id === offer.id
      ? { ...candidate, quantity: candidate.quantity - request.quantity, updatedAt: now }
      : candidate),
    revision: shop.revision + 1,
    updatedAt: now,
  }
  const transaction: Dnd5eShopTransaction = {
    id: request.id,
    shopId: shop.id,
    offerId: offer.id,
    characterId: character.id,
    characterName: character.name,
    templateId: template.id,
    itemName: template.name,
    quantity: request.quantity,
    totalPriceCopper,
    createdAt: now,
  }
  return {
    ok: true,
    state: {
      schemaVersion: DND5E_SHOPS_SCHEMA_VERSION,
      revision: state.revision + 1,
      shops: state.shops.map((candidate) => candidate.id === shop.id ? nextShop : candidate),
      transactions: [...state.transactions, transaction].slice(-DND5E_SHOP_TRANSACTION_LIMIT),
      purchaseReceipts: [...state.purchaseReceipts, request.id].slice(-DND5E_SHOP_RECEIPT_LIMIT),
      updatedAt: now,
    },
    characters: grantResult.characters,
    totalPriceCopper,
    message: `${character.name} 购买了 ${template.name} ×${request.quantity}，花费 ${formatDnd5eCopper(totalPriceCopper)}。`,
  }
}
