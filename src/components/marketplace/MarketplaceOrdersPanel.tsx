import { useEffect, useState } from 'react'
import { LoaderCircle, ReceiptText, XCircle } from 'lucide-react'
import { formatMarketplacePrice } from '../../../shared/marketplace-publication.mjs'
import type { MarketplaceOrderV1 } from '../../../shared/marketplace-order.mjs'
import { accountApiErrorMessage } from '../../lib/accountApi'
import {
  cancelMarketplaceOrder,
  loadMarketplaceOrders,
} from '../../lib/pluginCatalogApi'

const STATUS_LABELS: Record<MarketplaceOrderV1['status'], string> = {
  pending: '等待付款',
  fulfilled: '已完成',
  canceled: '已取消',
  expired: '已过期',
  refunded: '已退款',
  disputed: '争议处理中',
}

export default function MarketplaceOrdersPanel() {
  const [orders, setOrders] = useState<MarketplaceOrderV1[]>([])
  const [loading, setLoading] = useState(true)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadMarketplaceOrders()
      .then((values) => {
        if (!active) return
        setOrders(values)
        setError(null)
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

  const cancel = async (orderId: string) => {
    setBusyOrderId(orderId)
    try {
      const updated = await cancelMarketplaceOrder(orderId)
      setOrders((current) => current.map((order) =>
        order.orderId === updated.orderId ? updated : order))
      setError(null)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusyOrderId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <ReceiptText className="h-5 w-5 text-arcane-300" />
          我的订单
        </h2>
        <p className="mt-1 text-sm text-slate-500">查看扩展市场购买记录、授权结果和退款状态。</p>
      </div>
      {error && <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />读取订单…
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
          还没有购买订单。
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.orderId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/15 p-4">
              <div>
                <p className="font-medium text-slate-100">{order.productId}</p>
                <p className="mt-1 text-xs text-slate-500">
                  v{order.version} · {order.orderId} · {new Date(order.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold text-white">{formatMarketplacePrice({
                    kind: 'paid',
                    currency: order.currency,
                    amountMinor: order.amountMinor,
                    settlementBasis: 'net-receipts',
                    creatorShareBps: 6_000,
                    platformShareBps: 4_000,
                  })}</p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[order.status]}</p>
                </div>
                {order.status === 'pending' && (
                  <button
                    type="button"
                    disabled={busyOrderId === order.orderId}
                    onClick={() => void cancel(order.orderId)}
                    className="rounded-xl border border-white/10 p-2 text-slate-500 hover:text-rose-300 disabled:opacity-50"
                    aria-label="取消订单"
                  >
                    {busyOrderId === order.orderId
                      ? <LoaderCircle className="h-4 w-4 animate-spin" />
                      : <XCircle className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
