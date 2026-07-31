import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Download,
  Flag,
  LoaderCircle,
  PackageOpen,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { formatMarketplacePrice } from '../../shared/marketplace-publication.mjs'
import {
  activeMarketplaceEntitlement,
  type MarketplaceEntitlementV1,
} from '../../shared/marketplace-entitlement.mjs'
import PageHeader from '../components/PageHeader'
import { accountApiErrorMessage } from '../lib/accountApi'
import {
  completeSandboxMarketplaceOrder,
  createMarketplaceOrder,
  downloadPublicPlugin,
  loadMarketplaceCapabilities,
  loadPluginCatalogEntry,
  loadMarketplaceEntitlements,
  reportPublicPlugin,
  startMarketplaceCheckout,
  type PluginCatalogEntry,
  type MarketplaceCapabilities,
} from '../lib/pluginCatalogApi'

function downloadBytes(bytes: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function PluginCatalogDetailPage() {
  const { pluginId = '' } = useParams()
  const [plugin, setPlugin] = useState<PluginCatalogEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [entitlements, setEntitlements] = useState<MarketplaceEntitlementV1[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<MarketplaceCapabilities | null>(null)

  useEffect(() => {
    let active = true
    void loadPluginCatalogEntry(pluginId)
      .then((entry) => { if (active) setPlugin(entry) })
      .catch((cause) => { if (active) setError(accountApiErrorMessage(cause)) })
    void loadMarketplaceEntitlements().then((values) => {
      if (active) setEntitlements(values)
    }).catch(() => undefined)
    void loadMarketplaceCapabilities().then((value) => {
      if (active) setCapabilities(value)
    }).catch(() => undefined)
    return () => { active = false }
  }, [pluginId])

  const version = plugin?.versions[0]
  const entitlement = plugin && version
    ? activeMarketplaceEntitlement(entitlements, {
        accountId: entitlements[0]?.accountId ?? '',
        productId: plugin.id,
        version: version.version,
      })
    : null
  const download = async () => {
    if (!plugin || !version) return
    if (version.marketplace?.pricing.kind === 'paid' && !entitlement) {
      setError('当前账号尚未获得该商品许可；支付功能将在订单系统完成后开放。')
      return
    }
    setBusy(true)
    try {
      const result = await downloadPublicPlugin(plugin.id, version)
      downloadBytes(result.bytes, result.fileName)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const purchase = async () => {
    if (!plugin || !version || version.marketplace?.pricing.kind !== 'paid') return
    if (!capabilities?.checkoutAvailable) {
      setNotice('当前为免费扩展市场 Beta，付费购买尚未开放。')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const created = await createMarketplaceOrder({
        productId: plugin.id,
        version: version.version,
      })
      if (!created.sandboxAvailable) {
        if (!created.checkoutAvailable) {
          setNotice(`订单 ${created.order.orderId} 已创建，但支付渠道尚未开放。`)
          return
        }
        const checkout = await startMarketplaceCheckout(created.order.orderId)
        window.location.assign(checkout.checkout.checkoutUrl)
        return
      }
      const fulfilled = await completeSandboxMarketplaceOrder(created.order.orderId)
      if (fulfilled.status !== 'fulfilled') throw new Error('marketplace-order-not-fulfilled')
      setEntitlements(await loadMarketplaceEntitlements())
      setNotice('沙盒支付已完成，商品许可已经发放到当前账号。')
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const report = async () => {
    if (!plugin || !version) return
    const details = window.prompt('请说明版权、安全、误导或其他问题：')?.trim()
    if (!details) return
    try {
      await reportPublicPlugin({ pluginId: plugin.id, version: version.version, category: 'copyright', details })
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    }
  }

  if (!plugin || !version) return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-400">{error ?? <><LoaderCircle className="h-4 w-4 animate-spin" />正在读取商品详情…</>}</div>

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={plugin.name} description={`${plugin.contentCategory} · v${version.version}`} actions={<Link to="/app/extensions" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">返回扩展市场</Link>} />
      {error && <p className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {notice && <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <main className="rounded-3xl border border-white/8 bg-black/15 p-7">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <PackageOpen className="h-4 w-4" /><span>{plugin.id}</span>
          </div>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-8 text-slate-300">
            {version.storeDescription || plugin.description || '作者暂未填写商品详情。'}
          </div>
          {version.changelog && <section className="mt-8 border-t border-white/8 pt-5"><h2 className="font-semibold text-white">版本说明</h2><p className="mt-2 text-sm leading-7 text-slate-400">{version.changelog}</p></section>}
          {version.marketplace?.rightsManifest && (
            <section className="mt-8 border-t border-white/8 pt-5">
              <h2 className="flex items-center gap-2 font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300" />权利与内容披露</h2>
              <p className="mt-3 text-sm text-slate-400">作者声明来源：{version.marketplace.rightsManifest.contentOrigin}</p>
              <p className="mt-1 text-sm text-slate-400">AI 辅助内容：{version.marketplace.rightsManifest.containsAi ? '包含' : '未声明包含'}</p>
              {version.marketplace.rightsManifest.aiDisclosure && <p className="mt-2 text-sm leading-7 text-slate-500">{version.marketplace.rightsManifest.aiDisclosure}</p>}
            </section>
          )}
        </main>
        <aside className="h-fit rounded-3xl border border-white/8 bg-black/20 p-5">
          <p className="text-3xl font-bold text-white">{version.marketplace ? formatMarketplacePrice(version.marketplace.pricing) : '免费'}</p>
          {version.marketplace?.commerceState === 'preview' && <p className="mt-2 text-xs text-amber-200">市场预览阶段</p>}
          <Link to={`/app/extensions/publishers/${encodeURIComponent(plugin.publisher.accountId)}`} className="mt-5 flex items-center gap-2 text-sm text-arcane-200">
            {plugin.publisher.creatorVerified && <BadgeCheck className="h-4 w-4 text-emerald-300" />}{plugin.publisher.displayName}
          </Link>
          <p className="mt-2 text-xs text-slate-600">许可证：{version.license}</p>
          {version.marketplace?.pricing.kind === 'paid' && !entitlement ? (
            <button type="button" disabled={busy || !capabilities?.checkoutAvailable} onClick={() => void purchase()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-arcane-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {capabilities?.checkoutAvailable ? '创建购买订单' : '付费购买尚未开放'}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void download()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-arcane-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" />{version.marketplace?.pricing.kind === 'paid' ? '下载已购内容' : '下载扩展'}</button>
          )}
          <button type="button" onClick={() => void report()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-xs text-slate-500"><Flag className="h-3.5 w-3.5" />举报商品</button>
        </aside>
      </div>
    </div>
  )
}
