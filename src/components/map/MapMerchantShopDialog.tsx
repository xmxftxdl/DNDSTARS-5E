import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeDollarSign, Coins, RefreshCw, ShoppingBag, Store, X } from 'lucide-react'
import type { Character } from '../../types/character'
import Dnd5eActionIcon from './Dnd5eActionIcon'
import { dnd5eShopOfferIconSpec } from '../../lib/dnd5eShopOfferIcon'
import {
  subscribeDnd5eShopPurchaseReceipts,
  submitDnd5eShopPurchase,
} from '../../lib/dnd5eShopAuthority'
import { dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'
import { DND5E_MAGIC_ITEM_RARITY_LABELS } from '../../rulesets/dnd5e/magicItems'
import {
  dnd5eShopOfferDisplayRarity,
  dnd5eShopUnitPriceCopper,
  dnd5eWalletCopper,
  formatDnd5eCopper,
} from '../../rulesets/dnd5e/shops'
import { useDnd5eShopStore } from '../../store/dnd5eShops'
import type { Token } from '../../store/maps'

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `merchant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function MapMerchantShopDialog({
  mapId,
  merchant,
  buyerToken,
  buyer,
  onClose,
}: {
  mapId: string
  merchant: Token
  buyerToken: Token
  buyer: Character
  onClose: () => void
}) {
  const shared = useDnd5eShopStore((state) => state.shared)
  const loadShared = useDnd5eShopStore((state) => state.loadShared)
  const [pendingOfferId, setPendingOfferId] = useState<string>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const pendingRequestId = useRef<string | undefined>(undefined)
  const shop = shared.shops.find((candidate) => candidate.id === merchant.merchantShopId)
  const inventory = useMemo(() => normalizeDnd5eInventory(buyer), [buyer])
  const walletCopper = dnd5eWalletCopper(inventory.currency)

  useEffect(() => {
    void loadShared()
  }, [loadShared])

  useEffect(() => subscribeDnd5eShopPurchaseReceipts((receipt) => {
    if (receipt.requestId !== pendingRequestId.current) return
    pendingRequestId.current = undefined
    setPendingOfferId(undefined)
    if (receipt.status === 'applied') {
      setError('')
      setNotice(receipt.message)
    } else {
      setNotice('')
      setError(receipt.message)
    }
  }), [])

  const purchase = async (offerId: string, unitPrice: number) => {
    if (!shop || pendingOfferId) return
    const id = requestId()
    pendingRequestId.current = id
    setPendingOfferId(offerId)
    setNotice('')
    setError('')
    const result = await submitDnd5eShopPurchase({
      id,
      shopId: shop.id,
      offerId,
      characterId: buyer.id,
      quantity: 1,
      expectedShopRevision: shop.revision,
      expectedInventoryRevision: inventory.revision ?? 0,
      expectedUnitPriceCopper: unitPrice,
      merchant: {
        mapId,
        merchantTokenId: merchant.id,
        buyerTokenId: buyerToken.id,
      },
    })
    if (result.status === 'submitted') {
      setNotice(result.message)
      window.setTimeout(() => {
        if (pendingRequestId.current !== id) return
        pendingRequestId.current = undefined
        setPendingOfferId(undefined)
        setNotice('')
        setError('交易等待超时，请确认 DM 权威端在线后重试。')
      }, 20_000)
      return
    }
    pendingRequestId.current = undefined
    setPendingOfferId(undefined)
    if (result.status === 'applied') setNotice(result.message)
    else setError(result.message)
  }

  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${merchant.label}的商店`}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-300/20 bg-void-950 shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-xl">{merchant.emoji || '🧑'}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-amber-300" />
              <h2 className="truncate text-lg font-bold text-slate-100">{shop?.name ?? `${merchant.label}的商店`}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{shop?.description ?? '这位商人当前没有向玩家开放店面。'}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] px-3 py-2 sm:flex">
              <Coins className="h-4 w-4 text-amber-300" />
              <span className="font-mono text-xs font-semibold text-amber-100">{formatDnd5eCopper(walletCopper)}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {(notice || error) && (
          <p className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${error
            ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
            : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'}`}>
            {error || notice}
          </p>
        )}

        {!shop || !shop.open || !shop.visibleToPlayers ? (
          <div className="flex min-h-52 flex-1 flex-col items-center justify-center p-8 text-center">
            <Store className="h-10 w-10 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">商店尚未营业，或刚刚被 DM 关闭。</p>
          </div>
        ) : shop.offers.length === 0 ? (
          <div className="flex min-h-52 flex-1 items-center justify-center p-8 text-sm text-slate-500">当前库存为空。</div>
        ) : (
          <div className="grid flex-1 gap-px overflow-y-auto bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {shop.offers.map((offer) => {
              const template = dnd5eInventoryItemTemplate(offer.templateId)
              const unitPrice = dnd5eShopUnitPriceCopper(offer, shop)
              const displayRarity = dnd5eShopOfferDisplayRarity(offer)
              const affordable = walletCopper >= unitPrice
              const pending = pendingOfferId === offer.id
              return (
                <article key={offer.id} className="flex min-h-64 flex-col bg-slate-950/95 p-4">
                  <div className="flex items-start gap-3">
                    <Dnd5eActionIcon spec={dnd5eShopOfferIconSpec(offer, template)} className="h-14 w-14 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-100">{offer.name}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {DND5E_MAGIC_ITEM_RARITY_LABELS[displayRarity]} · 库存 {offer.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                    {offer.rulesText?.trim() || template?.rulesText || offer.description}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div>
                      <p className="text-[10px] text-slate-600">单价</p>
                      <p className="flex items-center gap-1 font-mono text-xs font-bold text-amber-200">
                        <BadgeDollarSign className="h-3.5 w-3.5" />
                        {formatDnd5eCopper(unitPrice)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!!pendingOfferId || offer.quantity < 1 || !affordable}
                      onClick={() => void purchase(offer.id, unitPrice)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                      {pending ? '结算中' : offer.quantity < 1 ? '售罄' : !affordable ? '货币不足' : '购买'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
