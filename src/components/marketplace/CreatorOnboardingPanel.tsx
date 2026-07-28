import { useEffect, useState } from 'react'
import { BadgeCheck, CircleAlert, FileCheck2, IdCard, LoaderCircle } from 'lucide-react'
import {
  MARKETPLACE_CREATOR_NOTICE_VERSION,
  MARKETPLACE_CREATOR_POLICY_VERSION,
} from '../../../shared/marketplace-publication.mjs'
import {
  accountApiErrorMessage,
} from '../../lib/accountApi'
import {
  applyForMarketplaceCreator,
  loadMarketplaceCreatorProfile,
  type MarketplaceCreatorProfile,
} from '../../lib/pluginCatalogApi'

export default function CreatorOnboardingPanel({
  onChanged,
}: {
  onChanged?: (profile: MarketplaceCreatorProfile) => void
}) {
  const [profile, setProfile] = useState<MarketplaceCreatorProfile | null>(null)
  const [region, setRegion] = useState('中国大陆')
  const [verificationReference, setVerificationReference] = useState('')
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [acceptedNotice, setAcceptedNotice] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadMarketplaceCreatorProfile()
      .then((value) => { if (active) setProfile(value) })
      .catch((cause) => { if (active) setError(accountApiErrorMessage(cause)) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])

  const submit = async () => {
    if (!acceptedPolicy || !acceptedNotice) return setError('请阅读并接受创作者政策与用户须知。')
    if (verificationReference.trim().length < 6) return setError('请输入实名认证服务提供的有效核验单号。')
    setBusy(true)
    setError(null)
    try {
      const next = await applyForMarketplaceCreator({
        countryOrRegion: region,
        verificationReference: verificationReference.trim(),
        acceptedPolicyVersion: MARKETPLACE_CREATOR_POLICY_VERSION,
        acceptedNoticeVersion: MARKETPLACE_CREATOR_NOTICE_VERSION,
      })
      setProfile(next)
      onChanged?.(next)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (busy && !profile) return <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />正在读取创作者资格…</div>

  if (profile?.status === 'verified') {
    return (
      <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.045] p-7">
        <BadgeCheck className="h-10 w-10 text-emerald-300" />
        <h2 className="mt-4 text-xl font-bold text-white">创作者身份已验证</h2>
        <p className="mt-2 text-sm leading-7 text-slate-400">你可以提交付费插件与战役包。每件商品仍需单独提交权利清单并通过内容审核。</p>
        {profile.verifiedAt && <p className="mt-3 text-xs text-slate-600">认证时间：{new Date(profile.verifiedAt).toLocaleString('zh-CN')}</p>}
      </section>
    )
  }

  if (profile?.status === 'pending') {
    return (
      <section className="rounded-3xl border border-amber-400/20 bg-amber-500/[0.045] p-7">
        <FileCheck2 className="h-10 w-10 text-amber-300" />
        <h2 className="mt-4 text-xl font-bold text-white">实名认证审核中</h2>
        <p className="mt-2 text-sm leading-7 text-slate-400">审核通过后才能为商品设置价格。免费扩展及私人内容不受影响。</p>
        <p className="mt-3 text-xs text-slate-600">核验引用：{profile.verificationReference}</p>
      </section>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-3xl border border-white/8 bg-black/15 p-6">
        <h2 className="text-xl font-bold text-white">创作者政策</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-slate-400">
          <p>创作者获得商品可分配净收入的 60%，平台获得 40%。净收入为实际到账金额扣除税费、支付渠道费用、退款与拒付后的金额。</p>
          <p>创作者必须拥有文字、规则、图片、地图、音频、字体和代码的发布及商业分发权。平台审核不构成对原创性或权属的法律确认。</p>
          <p>争议商品将暂停销售并冻结该商品尚未结算的收入。重复侵权、伪造授权或恶意代码可能导致创作者权限终止。</p>
          <p>单件商品价格范围为 ¥1–¥99；平台可根据退款、税务、内容安全和适用法律调整可销售状态。</p>
        </div>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-white/8 p-4 text-sm text-slate-300">
          <input className="mt-1" type="checkbox" checked={acceptedPolicy} onChange={(event) => setAcceptedPolicy(event.target.checked)} />
          <span>我已阅读并接受创作者政策 {MARKETPLACE_CREATOR_POLICY_VERSION}。</span>
        </label>
      </section>

      <section className="rounded-3xl border border-white/8 bg-black/15 p-6">
        <div className="flex items-center gap-2"><IdCard className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-bold text-white">实名认证</h2></div>
        <p className="mt-3 text-sm leading-6 text-slate-500">平台只保存核验服务返回的引用和认证状态，不在插件目录或浏览器中保存身份证件原文。</p>
        <label className="mt-5 block text-xs text-slate-500">国家或地区
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white">
            <option>中国大陆</option><option>中国香港</option><option>中国澳门</option><option>中国台湾</option><option>其他</option>
          </select>
        </label>
        <label className="mt-3 block text-xs text-slate-500">实名认证核验单号
          <input value={verificationReference} onChange={(event) => setVerificationReference(event.target.value)} placeholder="由受信任的实名核验服务返回" className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-white" />
        </label>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/8 p-4 text-sm text-slate-300">
          <input className="mt-1" type="checkbox" checked={acceptedNotice} onChange={(event) => setAcceptedNotice(event.target.checked)} />
          <span>我已阅读用户须知 {MARKETPLACE_CREATOR_NOTICE_VERSION}，并同意为审核、结算、税务和争议处理使用实名核验结果。</span>
        </label>
        {profile?.status === 'rejected' && <p className="mt-3 text-sm text-rose-200">上次申请未通过：{profile.moderationNote || '请检查资料后重新申请。'}</p>}
        {error && <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-sm text-rose-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={busy} className="mt-5 w-full rounded-xl bg-arcane-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? '正在提交…' : '提交创作者认证申请'}</button>
      </section>
    </div>
  )
}
