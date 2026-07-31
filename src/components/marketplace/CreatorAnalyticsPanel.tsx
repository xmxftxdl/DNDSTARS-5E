import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Download,
  Eye,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { accountApiErrorMessage } from '../../lib/accountApi'
import {
  loadMarketplaceCreatorAnalytics,
  loadMarketplaceCreatorPublications,
  type MarketplaceCreatorAnalytics,
  type MarketplaceCreatorPublication,
} from '../../lib/pluginCatalogApi'

const STATUS_LABELS: Record<string, string> = {
  pending: '等待审核',
  published: '已发布',
  rejected: '已拒绝',
  suspended: '已暂停',
  withdrawn: '已撤回',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-100',
  published: 'bg-emerald-500/10 text-emerald-100',
  rejected: 'bg-rose-500/10 text-rose-100',
  suspended: 'bg-orange-500/10 text-orange-100',
  withdrawn: 'bg-slate-500/10 text-slate-300',
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(amountMinor / 100)
}

function compact(value: number) {
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export default function CreatorAnalyticsPanel() {
  const [periodDays, setPeriodDays] = useState(30)
  const [analytics, setAnalytics] = useState<MarketplaceCreatorAnalytics | null>(null)
  const [publications, setPublications] = useState<MarketplaceCreatorPublication[]>([])
  const [currency, setCurrency] = useState('CNY')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [nextAnalytics, nextPublications] = await Promise.all([
        loadMarketplaceCreatorAnalytics(periodDays),
        loadMarketplaceCreatorPublications(),
      ])
      setAnalytics(nextAnalytics)
      setPublications(nextPublications)
      const currencies = Object.keys(nextAnalytics.totals.revenueMinor)
      if (currencies.length > 0 && !currencies.includes(currency)) setCurrency(currencies[0])
      setError(null)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      loadMarketplaceCreatorAnalytics(periodDays),
      loadMarketplaceCreatorPublications(),
    ]).then(([nextAnalytics, nextPublications]) => {
      if (!active) return
      setAnalytics(nextAnalytics)
      setPublications(nextPublications)
      setError(null)
    }).catch((cause) => {
      if (active) setError(accountApiErrorMessage(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [periodDays])

  const maxActivity = useMemo(() => Math.max(
    1,
    ...(analytics?.series.map((point) => Math.max(point.views, point.installs, point.sales)) ?? []),
  ), [analytics])
  const maxRevenue = useMemo(() => Math.max(
    1,
    ...(analytics?.series.map((point) => Math.abs(point.revenueMinor[currency] ?? 0)) ?? []),
  ), [analytics, currency])
  const availableCurrencies = useMemo(() => {
    const values = new Set(['CNY'])
    for (const key of Object.keys(analytics?.totals.revenueMinor ?? {})) values.add(key)
    return [...values]
  }, [analytics])

  if (loading && !analytics) {
    return (
      <div className="mt-5 flex min-h-40 items-center justify-center gap-2 rounded-3xl border border-white/8 bg-black/15 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" />正在汇总创作者数据…
      </div>
    )
  }
  if (error && !analytics) {
    return (
      <p className="mt-5 rounded-2xl border border-white/8 p-5 text-sm text-slate-500">
        发布第一个扩展后，这里会显示浏览、安装和收入数据。
      </p>
    )
  }
  if (!analytics) return null

  const cards = [
    { label: '详情浏览', value: compact(analytics.totals.views), icon: Eye, tone: 'text-cyan-300' },
    { label: '下载次数', value: compact(analytics.totals.downloads), icon: Download, tone: 'text-blue-300' },
    { label: '安装转化率', value: `${(analytics.totals.installConversionRate * 100).toFixed(1)}%`, icon: TrendingUp, tone: 'text-violet-300' },
    { label: '活跃安装', value: compact(analytics.totals.activeInstallations), icon: PackageCheck, tone: 'text-emerald-300' },
    { label: '销量', value: compact(analytics.totals.sales), icon: ShoppingBag, tone: 'text-amber-300' },
  ]

  return (
    <section className="mt-5 rounded-3xl border border-white/8 bg-black/15 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <BarChart3 className="h-5 w-5 text-violet-300" />创作者数据
          </h2>
          <p className="mt-1 text-sm text-slate-500">浏览按账号或网络地址每日去重；安装指保存到账号插件库。</p>
        </div>
        <div className="flex gap-2">
          <select
            value={periodDays}
            onChange={(event) => {
              setLoading(true)
              setPeriodDays(Number(event.target.value))
            }}
            className="rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-300"
          >
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
            <option value={365}>近 1 年</option>
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-xl border border-white/10 p-2 text-slate-400 disabled:opacity-50"
            aria-label="刷新创作者数据"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>
      {error && <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{error}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <Icon className={`h-4 w-4 ${tone}`} />
            <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <h3 className="font-semibold text-slate-100">流量与转化趋势</h3>
          <div className="mt-4 flex h-40 items-end gap-1 overflow-hidden" aria-label="流量与转化柱状图">
            {analytics.series.map((point) => (
              <div key={point.day} className="group relative flex h-full min-w-1 flex-1 items-end gap-px" title={`${point.day}：浏览 ${point.views}，安装 ${point.installs}，销量 ${point.sales}`}>
                <span className="w-1/2 rounded-t bg-cyan-400/55" style={{ height: `${Math.max(2, point.views / maxActivity * 100)}%` }} />
                <span className="w-1/2 rounded-t bg-violet-400/70" style={{ height: `${Math.max(2, point.installs / maxActivity * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan-400/55" />浏览</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400/70" />安装</span>
          </div>
        </article>

        <article className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-100">净收入趋势</h3>
              <p className="mt-1 text-xs text-slate-500">包含销售、退款与争议冲销。</p>
            </div>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="rounded-lg border border-white/10 bg-void-900 px-2 py-1 text-xs text-slate-300"
            >
              {availableCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="mt-4 flex h-32 items-end gap-1 overflow-hidden" aria-label="净收入趋势柱状图">
            {analytics.series.map((point) => {
              const amount = point.revenueMinor[currency] ?? 0
              return (
                <span
                  key={point.day}
                  title={`${point.day}：${money(amount, currency)}`}
                  className={`min-w-1 flex-1 rounded-t ${amount < 0 ? 'bg-rose-400/70' : 'bg-emerald-400/65'}`}
                  style={{ height: `${Math.max(2, Math.abs(amount) / maxRevenue * 100)}%` }}
                />
              )
            })}
          </div>
          <p className="mt-3 text-lg font-semibold text-emerald-200">
            {money(analytics.totals.revenueMinor[currency] ?? 0, currency)}
          </p>
        </article>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">扩展</th><th className="px-4 py-3">浏览</th><th className="px-4 py-3">转化率</th>
              <th className="px-4 py-3">活跃安装</th><th className="px-4 py-3">销量</th><th className="px-4 py-3">净收入</th>
            </tr>
          </thead>
          <tbody>
            {analytics.products.map((product) => (
              <tr key={product.productId} className="border-t border-white/6 text-slate-300">
                <td className="px-4 py-3"><p className="font-medium text-slate-100">{product.name}</p><p className="text-xs text-slate-600">{product.productId}</p></td>
                <td className="px-4 py-3">{product.views}</td>
                <td className="px-4 py-3">{(product.installConversionRate * 100).toFixed(1)}%</td>
                <td className="px-4 py-3">{product.activeInstallations}</td>
                <td className="px-4 py-3">{product.sales}</td>
                <td className="px-4 py-3">{Object.entries(product.revenueMinor).map(([code, amount]) => <span key={code} className="mr-2 whitespace-nowrap">{money(amount, code)}</span>)}</td>
              </tr>
            ))}
            {analytics.products.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">暂无已提交的扩展。</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="mt-5">
        <h3 className="font-semibold text-slate-100">发布与审核状态</h3>
        <div className="mt-3 space-y-2">
          {publications.flatMap((publication) => publication.versions.map((version) => (
            <article key={`${publication.id}@${version.version}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 px-4 py-3">
              <div>
                <p className="text-sm text-slate-200">{publication.name} · v{version.version}</p>
                <p className="mt-1 text-xs text-slate-600">{new Date(version.submittedAt).toLocaleString('zh-CN')}</p>
                {version.moderationNote && <p className="mt-2 text-xs text-amber-100/80">审核说明：{version.moderationNote}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[version.status] ?? 'bg-white/5 text-slate-300'}`}>
                {STATUS_LABELS[version.status] ?? version.status}
              </span>
            </article>
          )))}
          {publications.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-600">尚未提交扩展审核。</p>}
        </div>
      </section>
    </section>
  )
}
