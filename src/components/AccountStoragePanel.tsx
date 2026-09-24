import { useCallback, useEffect, useState } from 'react'
import { accountApiErrorMessage, loadAccountStorage, updateAccountStorage, type AccountStorageUsage } from '../lib/accountApi'

const gib = 1024 ** 3
export default function AccountStoragePanel({ administrator = false }: { administrator?: boolean }) {
  const [usage, setUsage] = useState<AccountStorageUsage | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [plan, setPlan] = useState<'basic' | 'upgraded'>('basic')
  const [override, setOverride] = useState('')
  const refresh = useCallback(() => {
    void loadAccountStorage().then(setUsage).catch(cause => setError(accountApiErrorMessage(cause)))
  }, [])
  useEffect(refresh, [refresh])
  return <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6" aria-label="战役素材空间">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">战役素材空间</h2><button type="button" onClick={refresh} className="text-sm text-arcane-200">刷新用量</button></div>
    {usage && <>
      <p className="mt-3 text-sm text-slate-200">{usage.plan === 'upgraded' ? '升级账号' : '基础账号'} · 已用 {(usage.usedBytes / gib).toFixed(2)} GB / {(usage.limitBytes / gib).toFixed(2)} GB</p>
      <progress className="mt-3 h-2 w-full" aria-label="素材空间使用量" value={Math.min(usage.usedBytes, usage.limitBytes)} max={Math.max(1, usage.limitBytes)} />
      <p className="mt-2 text-xs text-slate-400">账号下所有战役的上传图片、讲义图片和音频共用额度。空间不足时暂停新增素材，已有文件会保留。基础账号 5 GB，升级账号 50 GB；需要扩容请联系管理员。</p>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    {administrator && <form className="mt-5 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(''); setNotice('')
      try {
        await updateAccountStorage(accountId.trim().toUpperCase(), { plan, quotaBytes: override === '' ? null : Math.round(Number(override) * gib) })
        setNotice('账号空间配额已更新，已有素材不会删除。'); refresh()
      } catch (cause) { setError(accountApiErrorMessage(cause)) }
      finally { setBusy(false) }
    }}>
      <label className="text-xs text-slate-300">账号 ID<input required pattern="[A-Za-z0-9]{12}" value={accountId} onChange={event => setAccountId(event.target.value)} className="mt-1 block rounded bg-slate-900 p-2" /></label>
      <label className="text-xs text-slate-300">账号等级<select value={plan} onChange={event => setPlan(event.target.value as 'basic' | 'upgraded')} className="mt-1 block rounded bg-slate-900 p-2"><option value="basic">基础 · 5 GB</option><option value="upgraded">升级 · 50 GB</option></select></label>
      <label className="text-xs text-slate-300">自定义 GB（可留空）<input type="number" min="0" step="0.1" value={override} onChange={event => setOverride(event.target.value)} className="mt-1 block rounded bg-slate-900 p-2" /></label>
      <button type="submit" disabled={busy} className="rounded bg-arcane-500/20 px-4 py-2 text-sm text-arcane-100 disabled:opacity-40">{busy ? '保存中…' : '更新配额'}</button>
    </form>}
  </section>
}
