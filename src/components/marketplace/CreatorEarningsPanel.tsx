import { useEffect, useState } from 'react'
import { CircleDollarSign, LoaderCircle, Send } from 'lucide-react'
import type {
  MarketplaceLedgerBalance,
  MarketplaceLedgerEntryV1,
} from '../../../shared/marketplace-ledger.mjs'
import type { MarketplacePayoutV1 } from '../../../shared/marketplace-payout.mjs'
import { accountApiErrorMessage } from '../../lib/accountApi'
import {
  loadMarketplaceCreatorLedger,
  loadMarketplaceCreatorPayouts,
  requestMarketplaceCreatorPayout,
} from '../../lib/pluginCatalogApi'

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100)
}

const KIND_LABELS: Record<MarketplaceLedgerEntryV1['kind'], string> = {
  sale: '销售收入',
  refund: '退款冲销',
  dispute: '争议冻结',
  payout: '提现预占',
  'payout-release': '提现退回',
}

const PAYOUT_STATUS_LABELS: Record<MarketplacePayoutV1['status'], string> = {
  pending: '等待审核',
  approved: '等待打款',
  paid: '已打款',
  rejected: '已拒绝',
}

export default function CreatorEarningsPanel() {
  const [balances, setBalances] = useState<MarketplaceLedgerBalance[]>([])
  const [entries, setEntries] = useState<MarketplaceLedgerEntryV1[]>([])
  const [holdDays, setHoldDays] = useState(14)
  const [payouts, setPayouts] = useState<MarketplacePayoutV1[]>([])
  const [payoutCurrency, setPayoutCurrency] = useState<'CNY' | 'USD'>('CNY')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([
      loadMarketplaceCreatorLedger(),
      loadMarketplaceCreatorPayouts(),
    ])
      .then(([result, payoutRecords]) => {
        if (!active) return
        setBalances(result.balances)
        setEntries(result.entries)
        setHoldDays(result.settlementHoldDays)
        setPayouts(payoutRecords)
      })
      .catch((cause) => {
        if (active) setError(accountApiErrorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const requestPayout = async () => {
    const amountMinor = Math.round(Number(payoutAmount) * 100)
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return
    setRequestingPayout(true)
    try {
      const payout = await requestMarketplaceCreatorPayout({
        currency: payoutCurrency,
        amountMinor,
      })
      const updatedLedger = await loadMarketplaceCreatorLedger()
      setPayouts((current) => [payout, ...current])
      setBalances(updatedLedger.balances)
      setEntries(updatedLedger.entries)
      setPayoutAmount('')
      setError(null)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setRequestingPayout(false)
    }
  }

  if (loading) {
    return <div className="mt-5 flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-white/8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />读取创作者流水…</div>
  }
  if (error && balances.length === 0 && payouts.length === 0) {
    return <p className="mt-5 rounded-2xl border border-white/8 p-5 text-sm text-slate-500">完成创作者申请并发布商品后，这里会显示销售与结算数据。</p>
  }

  return (
    <section className="mt-5 rounded-3xl border border-white/8 bg-black/15 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <CircleDollarSign className="h-5 w-5 text-emerald-300" />
        收入与结算
      </h2>
      <p className="mt-1 text-sm text-slate-500">收入按实际净到账金额分配，并经过 {holdDays} 天退款观察期。</p>
      {error && <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{error}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {balances.map((balance) => (
          <article key={balance.currency} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs text-slate-500">{balance.currency}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{money(balance.availableMinor, balance.currency)}</p>
            <p className="mt-1 text-xs text-amber-200/70">观察期内 {money(balance.pendingMinor, balance.currency)}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <h3 className="font-semibold text-slate-100">申请提现</h3>
        <p className="mt-1 text-xs text-slate-500">人民币最低 ¥100，美元最低 $20；提交后立即预占可结算余额。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={payoutCurrency}
            onChange={(event) => setPayoutCurrency(event.target.value as 'CNY' | 'USD')}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
          >
            <option value="CNY">人民币</option>
            <option value="USD">美元</option>
          </select>
          <input
            type="number"
            min={payoutCurrency === 'CNY' ? 100 : 20}
            step="0.01"
            value={payoutAmount}
            onChange={(event) => setPayoutAmount(event.target.value)}
            placeholder={payoutCurrency === 'CNY' ? '最低 100.00' : '最低 20.00'}
            className="min-w-40 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
          />
          <button
            type="button"
            disabled={requestingPayout}
            onClick={() => void requestPayout()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
          >
            {requestingPayout
              ? <LoaderCircle className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
            提交申请
          </button>
        </div>
        {payouts.length > 0 && (
          <div className="mt-4 space-y-2">
            {payouts.slice(0, 20).map((payout) => (
              <div key={payout.payoutId} className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2 text-sm">
                <span className="text-slate-400">{new Date(payout.createdAt).toLocaleDateString('zh-CN')} · {PAYOUT_STATUS_LABELS[payout.status]}</span>
                <span className="font-medium text-slate-200">{money(payout.amountMinor, payout.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 space-y-2">
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-600">暂无销售流水。</p>
        ) : entries.slice(0, 50).map((entry) => (
          <article key={entry.entryId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 px-4 py-3">
            <div>
              <p className="text-sm text-slate-200">{KIND_LABELS[entry.kind]} · {entry.productId}</p>
              <p className="mt-1 text-xs text-slate-600">{new Date(entry.createdAt).toLocaleString('zh-CN')} · 订单 {entry.orderId}</p>
            </div>
            <p className={`font-semibold ${entry.amountMinor >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {entry.amountMinor >= 0 ? '+' : ''}{money(entry.amountMinor, entry.currency)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
