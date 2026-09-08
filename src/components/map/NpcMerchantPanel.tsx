import { useMemo, useState } from 'react'
import { Eye, EyeOff, Link2, Store, Unlink, X } from 'lucide-react'
import { DND5E_MERCHANT_INTERACTION_RANGE_FEET } from '../../lib/dnd5eMerchantInteraction'
import {
  DND5E_SHOP_PRESETS,
  dnd5eShopPreset,
  type Dnd5eShopKind,
} from '../../rulesets/dnd5e/shops'
import { useDnd5eShopStore } from '../../store/dnd5eShops'
import type { Token } from '../../store/maps'

export default function NpcMerchantPanel({
  token,
  onBindShop,
  onClose,
}: {
  token: Token
  onBindShop: (shopId?: string) => void
  onClose: () => void
}) {
  const shops = useDnd5eShopStore((state) => state.shared.shops)
  const createShop = useDnd5eShopStore((state) => state.createShop)
  const updateShop = useDnd5eShopStore((state) => state.updateShop)
  const [kind, setKind] = useState<Dnd5eShopKind>('general-store')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const boundShop = useMemo(
    () => shops.find((shop) => shop.id === token.merchantShopId),
    [shops, token.merchantShopId],
  )

  const createAndBind = async () => {
    setBusy(true)
    setMessage('')
    try {
      const preset = dnd5eShopPreset(kind)
      const result = await createShop(kind, preset.defaultStockCount)
      if (!result.ok || !result.shopId) {
        setMessage(result.message)
        return
      }
      onBindShop(result.shopId)
      setMessage(`${result.message} 已绑定到 ${token.label}；确认库存后可向玩家公开。`)
    } finally {
      setBusy(false)
    }
  }

  const toggleVisibility = async () => {
    if (!boundShop) return
    setBusy(true)
    setMessage('')
    try {
      const makeVisible = !boundShop.visibleToPlayers
      const result = await updateShop(boundShop.id, {
        open: makeVisible,
        visibleToPlayers: makeVisible,
      })
      setMessage(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="glass absolute right-3 top-14 z-50 w-[min(26rem,calc(100%-1.5rem))] rounded-2xl border border-amber-300/20 p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-xl">
          {token.emoji || '🧑'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-amber-300" />
            <h3 className="truncate font-semibold text-slate-100">{token.label} · 商人设置</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            玩家进入 {DND5E_MERCHANT_INTERACTION_RANGE_FEET} 尺并点击该 NPC 后，可打开绑定商店进行权威交易。
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/55 p-3">
        <label className="text-[11px] font-semibold text-slate-400">
          绑定已有商店
          <select
            value={boundShop?.id ?? ''}
            disabled={busy}
            onChange={(event) => {
              onBindShop(event.target.value || undefined)
              setMessage(event.target.value ? 'NPC 已绑定到所选商店。' : '已解除 NPC 的商人身份。')
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none"
          >
            <option value="">不是商人</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name} · {shop.visibleToPlayers ? '玩家可见' : '仅 DM'}</option>
            ))}
          </select>
        </label>

        {!boundShop && (
          <div className="mt-3 flex gap-2">
            <select
              aria-label="新商店类型"
              value={kind}
              disabled={busy}
              onChange={(event) => setKind(event.target.value as Dnd5eShopKind)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none"
            >
              {DND5E_SHOP_PRESETS.map((preset) => (
                <option key={preset.kind} value={preset.kind}>{preset.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createAndBind()}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-40"
            >
              <Link2 className="h-3.5 w-3.5" />
              转换为商人
            </button>
          </div>
        )}

        {boundShop && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.035] p-2.5">
            <div>
              <p className="text-xs font-semibold text-slate-200">{boundShop.name}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{boundShop.offers.length} 类商品 · {boundShop.visibleToPlayers ? '玩家可交易' : '尚未公开'}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleVisibility()}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${boundShop.visibleToPlayers
                  ? 'bg-slate-500/10 text-slate-300'
                  : 'bg-emerald-500/15 text-emerald-200'}`}
              >
                {boundShop.visibleToPlayers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {boundShop.visibleToPlayers ? '停止营业' : '向玩家营业'}
              </button>
              <button
                type="button"
                disabled={busy}
                title="解除商店绑定"
                onClick={() => {
                  onBindShop(undefined)
                  setMessage('已解除 NPC 的商人身份；商店本身仍然保留。')
                }}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {message && <p className="mt-3 text-xs leading-5 text-amber-100/80">{message}</p>}
    </aside>
  )
}
