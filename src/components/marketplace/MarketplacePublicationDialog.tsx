import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, ShieldCheck, Sparkles, X } from 'lucide-react'
import {
  MARKETPLACE_CREATOR_AGREEMENT_VERSION,
  type MarketplacePublicationV1,
  type MarketplaceRightsAssetV1,
  type MarketplaceRightsManifestV1,
} from '../../../shared/marketplace-publication.mjs'
import type { AccountPluginVersion } from '../../lib/accountApi'
import { loadMarketplaceCapabilities } from '../../lib/pluginCatalogApi'

export interface MarketplacePublicationInput {
  visibility: 'public'
  changelog: string
  tags: string[]
  storeDescription: string
  commerce: {
    schemaVersion: 1
    productType: 'plugin' | 'adventure'
    pricing: Pick<MarketplacePublicationV1['pricing'], 'kind' | 'currency' | 'amountMinor'>
  }
  rightsManifest: {
    schemaVersion: 1
    contentOrigin: MarketplaceRightsManifestV1['contentOrigin']
    creatorDeclaration: true
    acceptedCreatorAgreement: typeof MARKETPLACE_CREATOR_AGREEMENT_VERSION
    containsAi: boolean
    aiDisclosure?: string
    assets: MarketplaceRightsAssetV1[]
  }
}

export default function MarketplacePublicationDialog({
  plugin,
  busy,
  onClose,
  onSubmit,
}: {
  plugin: AccountPluginVersion
  busy: boolean
  onClose: () => void
  onSubmit: (input: MarketplacePublicationInput) => Promise<void>
}) {
  const [paid, setPaid] = useState(false)
  const [price, setPrice] = useState('19.90')
  const [changelog, setChangelog] = useState('')
  const [tags, setTags] = useState('')
  const [storeDescription, setStoreDescription] = useState(plugin.description ?? '')
  const [contentOrigin, setContentOrigin] = useState<'original' | 'commissioned' | 'licensed' | 'open-license' | 'mixed'>('original')
  const [license, setLicense] = useState(plugin.license)
  const [sourceUrl, setSourceUrl] = useState('')
  const [evidenceReference, setEvidenceReference] = useState('')
  const [containsAi, setContainsAi] = useState(false)
  const [containsArtwork, setContainsArtwork] = useState(false)
  const [aiDisclosure, setAiDisclosure] = useState('')
  const [declared, setDeclared] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paidPublishingEnabled, setPaidPublishingEnabled] = useState(false)

  useEffect(() => {
    let active = true
    void loadMarketplaceCapabilities()
      .then((capabilities) => {
        if (active) setPaidPublishingEnabled(capabilities.paidPublishingEnabled)
      })
      .catch(() => {
        if (active) setPaidPublishingEnabled(false)
      })
    return () => { active = false }
  }, [])

  const amountMinor = useMemo(() => Math.round(Number(price) * 100), [price])
  const validPrice = !paid || (Number.isSafeInteger(amountMinor) && amountMinor >= 100 && amountMinor <= 9_900)

  const submit = async () => {
    if (paid && !paidPublishingEnabled) return setError('付费发布尚未开放；当前免费扩展市场 Beta 只接受免费扩展。')
    if (!declared) return setError('必须确认你拥有发布和销售这些内容所需的权利。')
    if (!validPrice) return setError('付费商品价格应在 ¥1.00 至 ¥99.00 之间。')
    if (storeDescription.trim().length < 20) return setError('商品详情至少需要 20 个字符。')
    if (!license.trim()) return setError('请填写内容许可证或权利说明。')
    if (containsAi && !aiDisclosure.trim()) return setError('请说明 AI 生成或辅助的内容与所用工具。')
    setError(null)
    await onSubmit({
      visibility: 'public',
      changelog: changelog.trim(),
      tags: tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
      storeDescription: storeDescription.trim(),
      commerce: {
        schemaVersion: 1,
        productType: plugin.contentCategory === 'adventure' ? 'adventure' : 'plugin',
        pricing: {
          kind: paid ? 'paid' : 'free',
          currency: 'CNY',
          amountMinor: paid ? amountMinor : 0,
        },
      },
      rightsManifest: {
        schemaVersion: 1,
        contentOrigin,
        creatorDeclaration: true,
        acceptedCreatorAgreement: MARKETPLACE_CREATOR_AGREEMENT_VERSION,
        containsAi,
        ...(containsAi ? { aiDisclosure: aiDisclosure.trim() } : {}),
        assets: [{
          category: plugin.contentCategory === 'adventure' ? 'text' : 'rules',
          sourceType: contentOrigin === 'original'
            ? 'original'
            : contentOrigin === 'commissioned'
              ? 'commissioned'
              : contentOrigin === 'open-license'
                ? 'open-license'
                : 'licensed',
          license: license.trim(),
          ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
          ...(evidenceReference.trim() ? { evidenceReference: evidenceReference.trim() } : {}),
        }, ...(containsArtwork ? [{
          category: 'art' as const,
          sourceType: contentOrigin === 'original'
            ? 'original' as const
            : contentOrigin === 'commissioned'
              ? 'commissioned' as const
              : contentOrigin === 'open-license'
                ? 'open-license' as const
                : 'licensed' as const,
          license: license.trim(),
          ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
          ...(evidenceReference.trim() ? { evidenceReference: evidenceReference.trim() } : {}),
        }] : [])],
      },
    })
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="提交扩展市场审核">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-void-950 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/8 bg-void-950/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arcane-300">Creator submission</p>
            <h2 className="mt-1 text-xl font-bold text-white">提交扩展市场审核</h2>
            <p className="mt-1 text-sm text-slate-500">{plugin.name} · v{plugin.version}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-6 p-6">
          <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5 text-emerald-300" /><h3 className="font-semibold text-white">价格与创作者奖励</h3></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <select value={paid ? 'paid' : 'free'} onChange={(event) => setPaid(event.target.value === 'paid')} className="rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white">
                <option value="free">免费发布</option>
                <option value="paid" disabled={!paidPublishingEnabled}>付费商品（尚未开放）</option>
              </select>
              {paid && <label className="flex items-center rounded-xl border border-white/10 bg-void-900 px-3"><span className="mr-2 text-slate-500">¥</span><input aria-label="商品价格" type="number" min="1" max="99" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="w-full bg-transparent py-2.5 text-sm text-white outline-none" /></label>}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {paidPublishingEnabled
                ? '付费商品将使用平台已启用的支付与结算通道。'
                : '当前为免费扩展市场 Beta。支付、实名认证服务商和结算通道全部就绪前，服务端会拒绝付费发布。'}
            </p>
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <h3 className="font-semibold text-white">商品详情</h3>
            <p className="mt-1 text-xs text-slate-500">由作者自由编写，将显示在独立商品详情页。请说明内容、适用等级、依赖和使用方式。</p>
            <textarea value={storeDescription} onChange={(event) => setStoreDescription(event.target.value)} maxLength={20_000} rows={7} className="mt-3 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm leading-6 text-white" />
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" /><h3 className="font-semibold text-white">权利清单</h3></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-500">内容来源
                <select value={contentOrigin} onChange={(event) => setContentOrigin(event.target.value as typeof contentOrigin)} className="mt-1 block w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white">
                  <option value="original">完全原创</option><option value="commissioned">委托创作</option><option value="licensed">取得商业授权</option><option value="open-license">开放许可证</option><option value="mixed">混合来源</option>
                </select>
              </label>
              <label className="text-xs text-slate-500">许可证或权利说明
                <input value={license} onChange={(event) => setLicense(event.target.value)} className="mt-1 block w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-500">来源或许可证链接（可选）
                <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" className="mt-1 block w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-500">权利证明索引（仅审核用途，可选）
                <input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} placeholder="合同编号、源文件说明或登记号" className="mt-1 block w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />
              </label>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm text-slate-200">
              <input className="mt-1" type="checkbox" checked={containsArtwork} onChange={(event) => setContainsArtwork(event.target.checked)} />
              <span>包内含图标、Token、立绘或其他美术素材；将同时提交美术分发权声明。</span>
            </label>
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <label className="flex items-center gap-3 text-sm text-slate-200"><input type="checkbox" checked={containsAi} onChange={(event) => setContainsAi(event.target.checked)} /><Sparkles className="h-4 w-4 text-violet-300" />包含 AI 生成或 AI 辅助内容</label>
            {containsAi && <textarea value={aiDisclosure} onChange={(event) => setAiDisclosure(event.target.value)} placeholder="说明使用的模型、生成的内容类型以及人工修改情况" rows={3} className="mt-3 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <input value={changelog} onChange={(event) => setChangelog(event.target.value)} placeholder="版本更新说明（可选）" className="rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="搜索标签，以逗号分隔" className="rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-4 text-sm leading-6 text-amber-50/90">
            <input className="mt-1" type="checkbox" checked={declared} onChange={(event) => setDeclared(event.target.checked)} />
            <span>我声明拥有发布、销售并授权平台分发这些内容所需的全部权利，并接受创作者协议 {MARKETPLACE_CREATOR_AGREEMENT_VERSION}。平台审核不构成对原创性或权属的法律确认。</span>
          </label>
          <p className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.04] px-4 py-3 text-xs leading-5 text-rose-100/80">
            仅限本地使用的资料并不自动取得公开分发权。请勿提交 PHB 原文、官方美术或其他未获市场分发授权的内容；这类内容应保留为 local-only 或 room-ephemeral 包。
          </p>
          {error && <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{error}</p>}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-white/8 bg-void-950/95 px-6 py-4 backdrop-blur">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">取消</button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? '正在提交…' : '提交人工审核'}</button>
        </footer>
      </div>
    </div>
  )
}
