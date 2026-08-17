import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeDollarSign,
  Boxes,
  Check,
  CircleOff,
  Coins,
  FlaskConical,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Dnd5eActionIcon from '../components/map/Dnd5eActionIcon'
import { modeFromPort } from '../lib/appMode'
import { showAppConfirm } from '../lib/appDialog'
import { dnd5eShopOfferIconSpec } from '../lib/dnd5eShopOfferIcon'
import {
  subscribeDnd5eShopPurchaseReceipts,
  submitDnd5eShopPurchase,
} from '../lib/dnd5eShopAuthority'
import { getPlayerCharacter } from '../lib/playerView'
import { getRoomSession } from '../lib/roomSession'
import { dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from '../rulesets/dnd5e/items'
import { DND5E_MAGIC_ITEM_RARITY_LABELS } from '../rulesets/dnd5e/magicItems'
import {
  DND5E_SHOP_PRESETS,
  dnd5eShopOfferDisplayRarity,
  dnd5eShopPreset,
  dnd5eShopSpellScrollNames,
  dnd5eShopUnitPriceCopper,
  dnd5eWalletCopper,
  formatDnd5eCopper,
  type Dnd5eShopDefinition,
  type Dnd5eShopKind,
  type Dnd5eShopOffer,
} from '../rulesets/dnd5e/shops'
import { useCharacterStore } from '../store/characters'
import { useDnd5eShopStore } from '../store/dnd5eShops'
import {
  DND5E_EDITABLE_CURRENCY_LABELS,
  type Dnd5eEditableCurrency,
} from '../types/inventory'

const SHOP_ICONS: Readonly<Record<Dnd5eShopKind, LucideIcon>> = {
  'general-store': Store,
  equipment: Shield,
  arcane: WandSparkles,
  apothecary: FlaskConical,
  'magic-curios': Sparkles,
}

const CATEGORY_LABELS = {
  equipment: '装备',
  'magic-item': '魔法物品',
  'adventuring-gear': '冒险用具',
  consumable: '消耗品',
  tool: '工具',
  container: '容器',
} as const

const PRICE_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

const RARITY_BADGE_CLASSES = {
  common: 'bg-slate-400/10 text-slate-300',
  uncommon: 'bg-emerald-400/10 text-emerald-300',
  rare: 'bg-blue-400/10 text-blue-300',
  'very-rare': 'bg-violet-400/10 text-violet-300',
  legendary: 'bg-amber-400/10 text-amber-300',
  artifact: 'bg-rose-400/10 text-rose-300',
  varies: 'bg-slate-400/10 text-slate-300',
} as const

type ShopPriceCurrency = Dnd5eEditableCurrency

const SHOP_PRICE_CURRENCIES: readonly {
  currency: ShopPriceCurrency
  label: string
  copper: number
}[] = [
  { currency: 'cp', label: DND5E_EDITABLE_CURRENCY_LABELS.cp, copper: 1 },
  { currency: 'sp', label: DND5E_EDITABLE_CURRENCY_LABELS.sp, copper: 10 },
  { currency: 'gp', label: DND5E_EDITABLE_CURRENCY_LABELS.gp, copper: 100 },
]

function shopPriceDraft(copper: number): { amount: string; currency: ShopPriceCurrency } {
  for (const option of [...SHOP_PRICE_CURRENCIES].reverse()) {
    if (copper % option.copper === 0) {
      return { amount: String(copper / option.copper), currency: option.currency }
    }
  }
  return { amount: String(copper), currency: 'cp' }
}

function ShopOfferPriceEditor({
  shop,
  offer,
  unitPrice,
  disabled,
  onCommit,
}: {
  shop: Pick<Dnd5eShopDefinition, 'name' | 'priceMultiplier'>
  offer: Pick<Dnd5eShopOffer, 'name' | 'priceOverrideCopper'>
  unitPrice: number
  disabled: boolean
  onCommit: (priceOverrideCopper?: number) => void
}) {
  const initial = shopPriceDraft(unitPrice)
  const [amount, setAmount] = useState(initial.amount)
  const [currency, setCurrency] = useState<ShopPriceCurrency>(initial.currency)

  const multiplier = SHOP_PRICE_CURRENCIES.find((option) => option.currency === currency)?.copper ?? 1
  const numericAmount = Number(amount)
  const draftCopper = Number.isFinite(numericAmount) && numericAmount > 0
    ? Math.max(1, Math.min(1_000_000_000, Math.round(numericAmount * multiplier)))
    : null
  const hasOverride = offer.priceOverrideCopper != null

  return (
    <form
      className="w-full rounded-lg border border-amber-300/15 bg-amber-400/[0.045] p-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (draftCopper == null || draftCopper === unitPrice) return
        onCommit(draftCopper)
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-amber-200">DM 售价</span>
        {hasOverride && (
          <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
            自定义价
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          aria-label={`${shop.name} ${offer.name}售价数量`}
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          disabled={disabled}
          onChange={(event) => setAmount(event.target.value)}
          className="w-20 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-right font-mono text-xs font-semibold text-amber-100 outline-none focus:border-amber-300/40 disabled:opacity-50"
        />
        <select
          aria-label={`${shop.name} ${offer.name}售价币种`}
          value={currency}
          disabled={disabled}
          onChange={(event) => setCurrency(event.target.value as ShopPriceCurrency)}
          className="rounded-md border border-white/10 bg-slate-950 px-1.5 py-1.5 text-xs font-semibold text-slate-200 outline-none disabled:opacity-50"
        >
          {SHOP_PRICE_CURRENCIES.map((option) => (
            <option key={option.currency} value={option.currency}>{option.label}</option>
          ))}
        </select>
        <button
          type="submit"
          title="保存这件商品的最终售价"
          disabled={disabled || draftCopper == null || draftCopper === unitPrice}
          className="rounded-md bg-amber-400/15 p-1.5 text-amber-200 hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        {hasOverride && (
          <button
            type="button"
            title={`恢复店铺标准售价（当前倍率 ×${shop.priceMultiplier}）`}
            disabled={disabled}
            onClick={() => onCommit(undefined)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200 disabled:opacity-30"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  )
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function ShopsPage() {
  const session = getRoomSession()
  const isDm = session?.role === 'dm' || (!session && modeFromPort() !== 'player')
  const characters = useCharacterStore((state) => state.characters)
  const selectedCharacterId = useCharacterStore((state) => state.selectedId)
  const shared = useDnd5eShopStore((state) => state.shared)
  const createShop = useDnd5eShopStore((state) => state.createShop)
  const updateShop = useDnd5eShopStore((state) => state.updateShop)
  const updateOfferPrice = useDnd5eShopStore((state) => state.updateOfferPrice)
  const restockShop = useDnd5eShopStore((state) => state.restockShop)
  const clearShop = useDnd5eShopStore((state) => state.clearShop)
  const removeShop = useDnd5eShopStore((state) => state.removeShop)
  const [buyerId, setBuyerId] = useState(selectedCharacterId ?? characters[0]?.id ?? '')
  const [restockCounts, setRestockCounts] = useState<Record<string, number>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingOffers, setPendingOffers] = useState<Set<string>>(() => new Set())
  const pendingRequests = useRef(new Map<string, string>())

  const effectiveBuyerId = characters.some((character) => character.id === buyerId)
    ? buyerId
    : (selectedCharacterId ?? characters[0]?.id ?? '')
  const buyer = useMemo(() => {
    if (isDm) return characters.find((character) => character.id === effectiveBuyerId)
    return getPlayerCharacter(characters, { slot: session?.slot })
  }, [characters, effectiveBuyerId, isDm, session?.slot])
  const buyerInventory = buyer ? normalizeDnd5eInventory(buyer) : undefined
  const walletCopper = dnd5eWalletCopper(buyerInventory?.currency)
  const visibleShops = isDm
    ? shared.shops
    : shared.shops.filter((shop) => shop.open && shop.visibleToPlayers)

  useEffect(() => {
    if (isDm) return
    return subscribeDnd5eShopPurchaseReceipts((receipt) => {
      const offerId = pendingRequests.current.get(receipt.requestId)
      if (offerId) {
        pendingRequests.current.delete(receipt.requestId)
        setPendingOffers((current) => {
          const next = new Set(current)
          next.delete(offerId)
          return next
        })
      }
      if (receipt.status === 'applied') {
        setError(null)
        setNotice(receipt.message)
      } else {
        setNotice(null)
        setError(receipt.message)
      }
    })
  }, [isDm])

  const runManagement = async (key: string, operation: () => Promise<{ ok: boolean; message: string }>) => {
    setBusyKey(key)
    setNotice(null)
    setError(null)
    try {
      const result = await operation()
      if (result.ok) setNotice(result.message)
      else setError(result.message)
    } finally {
      setBusyKey(null)
    }
  }

  const purchase = async (
    shopId: string,
    offerId: string,
    shopRevision: number,
    expectedUnitPriceCopper: number,
  ) => {
    if (!buyer || !buyerInventory || pendingOffers.has(offerId)) return
    const id = requestId()
    pendingRequests.current.set(id, offerId)
    setPendingOffers((current) => new Set(current).add(offerId))
    setNotice(null)
    setError(null)
    const result = await submitDnd5eShopPurchase({
      id,
      shopId,
      offerId,
      characterId: buyer.id,
      quantity: 1,
      expectedShopRevision: shopRevision,
      expectedInventoryRevision: buyerInventory.revision ?? 0,
      expectedUnitPriceCopper,
    })
    if (result.status !== 'submitted') {
      pendingRequests.current.delete(id)
      setPendingOffers((current) => {
        const next = new Set(current)
        next.delete(offerId)
        return next
      })
      if (result.status === 'applied') setNotice(result.message)
      else setError(result.message)
    } else {
      setNotice(result.message)
      window.setTimeout(() => {
        if (!pendingRequests.current.has(id)) return
        pendingRequests.current.delete(id)
        setPendingOffers((current) => {
          const next = new Set(current)
          next.delete(offerId)
          return next
        })
      }, 20_000)
    }
  }

  const confirmClear = async (shopId: string, shopName: string) => {
    const accepted = await showAppConfirm({
      title: `清空 ${shopName} 的库存？`,
      message: '所有当前商品和数量都会移除，之后仍可一键随机补货。',
      confirmLabel: '清空库存',
      tone: 'danger',
    })
    if (accepted) await runManagement(`clear:${shopId}`, () => clearShop(shopId))
  }

  const confirmRemove = async (shopId: string, shopName: string) => {
    const accepted = await showAppConfirm({
      title: `移除 ${shopName}？`,
      message: '商店及当前库存都会被移除；已完成的交易记录仍会保留。',
      confirmLabel: '移除商店',
      tone: 'danger',
    })
    if (accepted) await runManagement(`remove:${shopId}`, () => removeShop(shopId))
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="冒险者商店"
        description={isDm
          ? '按店铺类型从当前规则目录随机进货；新商店默认仅 DM 可见，确认库存与售价后再向玩家公开。'
          : '选择 DM 向你公开的商店购买物品；扣款、入包和减库存由 DM 权威端一次结算。'}
      />

      {(notice || error) && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error
          ? 'border-rose-400/25 bg-rose-500/10 text-rose-200'
          : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'}`}>
          {error ?? notice}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">购买角色</p>
            {isDm ? (
              <select
                value={effectiveBuyerId}
                onChange={(event) => setBuyerId(event.target.value)}
                className="mt-2 min-w-56 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">选择角色</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name}</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-base font-semibold text-slate-100">{buyer?.name ?? '尚未分配角色'}</p>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3">
            <Coins className="h-5 w-5 text-amber-300" />
            <div>
              <p className="text-[11px] text-slate-500">随身货币总值</p>
              <p className="font-mono text-sm font-semibold text-amber-100">
                {buyer ? formatDnd5eCopper(walletCopper) : '—'}
              </p>
            </div>
          </div>
        </div>
        {!buyer && (
          <p className="mt-3 text-sm text-amber-200">需要先创建角色并将其分配给当前玩家，才能购买商品。</p>
        )}
      </section>

      {isDm && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-arcane-300" />
            <h3 className="text-base font-semibold text-slate-100">一键创建随机商店</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {DND5E_SHOP_PRESETS.map((preset) => {
              const Icon = SHOP_ICONS[preset.kind]
              const key = `create:${preset.kind}`
              return (
                <button
                  key={preset.kind}
                  type="button"
                  disabled={busyKey != null}
                  onClick={() => void runManagement(key, () => createShop(preset.kind, preset.defaultStockCount))}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-arcane-400/30 hover:bg-arcane-500/[0.07] disabled:opacity-50"
                >
                  <Icon className="h-6 w-6 text-arcane-300" />
                  <p className="mt-3 font-semibold text-slate-100">{preset.shortName}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{preset.description}</p>
                  <p className="mt-3 text-xs font-medium text-arcane-300">
                    {busyKey === key ? '正在生成…' : `创建并随机加入约 ${preset.defaultStockCount} 类商品`}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {visibleShops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <CircleOff className="mx-auto h-9 w-9 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            {isDm ? '还没有商店。可从上方选择一种类型一键创建。' : '目前没有向你公开的商店。'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleShops.map((shop) => {
            const Icon = SHOP_ICONS[shop.kind]
            const preset = dnd5eShopPreset(shop.kind)
            const restockCount = restockCounts[shop.id] ?? preset.defaultStockCount
            const spellScrollNames = shop.kind === 'arcane' ? dnd5eShopSpellScrollNames(shop) : []
            return (
              <section key={shop.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-arcane-500/10">
                      <Icon className="h-6 w-6 text-arcane-300" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-100">{shop.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${shop.visibleToPlayers
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : 'bg-slate-500/10 text-slate-400'}`}>
                          {shop.visibleToPlayers ? '玩家可见' : '仅 DM 可见'}
                        </span>
                        {shop.priceMultiplier !== 1 && (
                          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            价格 ×{shop.priceMultiplier}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{shop.description}</p>
                      {spellScrollNames.length > 0 && (
                        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-violet-200/80">
                          <span className="font-semibold text-violet-300">当前具体卷轴：</span>
                          {spellScrollNames.join('、')}
                        </p>
                      )}
                    </div>
                  </div>

                  {isDm && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyKey != null}
                        onClick={() => void runManagement(`open:${shop.id}`, () => updateShop(shop.id, {
                          open: !shop.visibleToPlayers,
                          visibleToPlayers: !shop.visibleToPlayers,
                        }))}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        {shop.visibleToPlayers ? '从玩家端隐藏' : '向玩家公开'}
                      </button>
                      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-500">
                        售价
                        <select
                          aria-label={`${shop.name}价格倍率`}
                          value={shop.priceMultiplier}
                          disabled={busyKey != null}
                          onChange={(event) => void runManagement(`price:${shop.id}`, () =>
                            updateShop(shop.id, { priceMultiplier: Number(event.target.value) }))}
                          className="bg-transparent font-semibold text-slate-200 outline-none"
                        >
                          {PRICE_MULTIPLIERS.map((multiplier) => (
                            <option key={multiplier} value={multiplier}>×{multiplier}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-500">
                        随机种类
                        <input
                          aria-label={`${shop.name}随机补货种类数`}
                          type="number"
                          min={1}
                          max={50}
                          value={restockCount}
                          onChange={(event) => setRestockCounts((current) => ({
                            ...current,
                            [shop.id]: Math.max(1, Math.min(50, Math.floor(Number(event.target.value) || 1))),
                          }))}
                          className="w-12 bg-transparent text-right font-semibold text-slate-200 outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busyKey != null}
                        onClick={() => void runManagement(`restock:${shop.id}`, () => restockShop(shop.id, restockCount))}
                        className="flex items-center gap-1.5 rounded-lg bg-arcane-500/15 px-3 py-2 text-xs font-semibold text-arcane-200 hover:bg-arcane-500/25 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${busyKey === `restock:${shop.id}` ? 'animate-spin' : ''}`} />
                        一键随机补货
                      </button>
                      <button
                        type="button"
                        title="清空库存"
                        disabled={busyKey != null || shop.offers.length === 0}
                        onClick={() => void confirmClear(shop.id, shop.name)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40"
                      >
                        <PackageOpen className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="移除商店"
                        disabled={busyKey != null}
                        onClick={() => void confirmRemove(shop.id, shop.name)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {shop.offers.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-500">
                    库存为空{isDm ? '，点击“一键随机补货”即可进货。' : '。'}
                  </p>
                ) : (
                  <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-3">
                    {shop.offers.map((offer) => {
                      const unitPrice = dnd5eShopUnitPriceCopper(offer, shop)
                      const liveTemplate = dnd5eInventoryItemTemplate(offer.templateId)
                      const rulesText = offer.rulesText?.trim() || liveTemplate?.rulesText.trim() ||
                        offer.description.trim() || '物品定义缺少规则正文；请由 DM 补全具体效果后再出售。'
                      const iconSpec = dnd5eShopOfferIconSpec(offer, liveTemplate)
                      const displayRarity = dnd5eShopOfferDisplayRarity(offer)
                      const pending = pendingOffers.has(offer.id)
                      const affordable = walletCopper >= unitPrice
                      const soldOut = offer.quantity < 1
                      return (
                        <article key={offer.id} className="flex min-h-72 flex-col bg-slate-950/90 p-4">
                          <div className="flex items-start gap-3">
                            <Dnd5eActionIcon spec={iconSpec} className="h-16 w-16 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate font-semibold text-slate-100">{offer.name}</p>
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${RARITY_BADGE_CLASSES[displayRarity]}`}>
                                      {DND5E_MAGIC_ITEM_RARITY_LABELS[displayRarity]}
                                    </span>
                                  </div>
                                  {offer.englishName && (
                                    <p className="truncate text-[11px] text-slate-600">{offer.englishName}</p>
                                  )}
                                </div>
                                <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${soldOut
                                  ? 'bg-rose-400/10 text-rose-300'
                                  : 'bg-white/5 text-slate-400'}`}>
                                  {soldOut ? '售罄' : `库存 ${offer.quantity}`}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-500">
                                  {CATEGORY_LABELS[offer.category]}
                                </span>
                                <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-600">{offer.sourceLabel}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-lg border border-cyan-300/10 bg-cyan-400/[0.035] px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300/75">具体效果</p>
                            <p className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-5 text-slate-300">
                              {rulesText}
                            </p>
                          </div>
                          <div className={`mt-auto gap-3 pt-4 ${isDm ? 'grid' : 'flex items-end justify-between'}`}>
                            {isDm ? (
                              <ShopOfferPriceEditor
                                key={`${offer.id}:${unitPrice}`}
                                shop={shop}
                                offer={offer}
                                unitPrice={unitPrice}
                                disabled={busyKey != null}
                                onCommit={(priceOverrideCopper) => void runManagement(
                                  `offer-price:${shop.id}:${offer.id}`,
                                  () => updateOfferPrice(shop.id, offer.id, priceOverrideCopper),
                                )}
                              />
                            ) : (
                              <div>
                                <p className="text-[10px] text-slate-600">单价</p>
                                <p className="flex items-center gap-1 font-mono text-sm font-bold text-amber-200">
                                  <BadgeDollarSign className="h-4 w-4" />
                                  {formatDnd5eCopper(unitPrice)}
                                </p>
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={!buyer || !shop.open || !shop.visibleToPlayers || soldOut || pending || !affordable}
                              title={!buyer ? '尚未选择购买角色' : !affordable ? '货币不足' : undefined}
                              onClick={() => void purchase(shop.id, offer.id, shop.revision, unitPrice)}
                              className={`flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${isDm ? 'w-full justify-center' : ''}`}
                            >
                              {pending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                              {pending ? '结算中' : soldOut ? '已售罄' : !affordable ? '货币不足' : '购买 1 件'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {isDm && shared.transactions.length > 0 && (
        <section className="mt-8 rounded-2xl border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">最近交易</h3>
          </div>
          <div className="space-y-2">
            {shared.transactions.slice(-10).reverse().map((transaction) => (
              <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-xs">
                <span className="text-slate-400">
                  {transaction.characterName} · {transaction.itemName} ×{transaction.quantity}
                </span>
                <span className="font-mono text-amber-200">{formatDnd5eCopper(transaction.totalPriceCopper)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
