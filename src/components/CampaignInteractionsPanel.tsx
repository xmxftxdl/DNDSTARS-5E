import { useEffect, useState } from 'react'
import { useMapStore } from '../store/maps'
import { loadCampaignInteractionChoices, runCampaignInteraction } from '../pages/maps/campaignInteractionController'

type Choice = Awaited<ReturnType<typeof loadCampaignInteractionChoices>>[number]

export default function CampaignInteractionsPanel() {
  const mapId = useMapStore(state => state.selectedId)
  const [choices, setChoices] = useState<Choice[]>([])
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let cancelled = false
    setChoices([])
    setConfirmed({})
    setError('')
    setBusy(!!mapId)
    if (mapId) {
      void loadCampaignInteractionChoices(mapId).then(rows => {
        if (!cancelled) setChoices(rows)
      }).catch(cause => {
        if (!cancelled) setError(`读取失败：${cause instanceof Error ? cause.message : String(cause)}`)
      }).finally(() => { if (!cancelled) setBusy(false) })
    }
    return () => { cancelled = true }
  }, [mapId, refresh])
  const act = async (choice: Choice, action: 'start' | 'interrupt' | 'complete') => {
    if (!mapId || busy) return
    setBusy(true)
    setError('')
    try {
      await runCampaignInteraction({ ...choice, mapId, action, continuityConfirmed: confirmed[choice.interactionId ?? ''] })
      setRefresh(value => value + 1)
    } catch (cause) {
      setError(`未能结算，请刷新列表后重试：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:col-span-2">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-200">持续交互</h3>
      <button type="button" disabled={busy || !mapId} onClick={() => setRefresh(value => value + 1)} className="text-xs text-violet-200 disabled:opacity-40">刷新列表</button>
    </div>
    <p className="mt-2 text-xs text-slate-400">当前地图中需要持续交流或准备的效果。完成时会一起推进时间并授予后续能力；普通推进时间会打断尚未确认的交互。</p>
    {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    {!choices.length && <p className="mt-3 text-xs text-slate-500">{busy ? '正在读取…' : mapId ? '当前地图没有待处理的持续交互。' : '请先选择地图。'}</p>}
    {choices.map(choice => <div key={`${choice.bearerId}:${choice.effectId}`} className="mt-3 rounded-xl border border-white/10 p-3 text-xs text-slate-300">
      <p className="font-semibold">{choice.label} · {choice.source} → {choice.bearer} · {choice.minutes} 分钟</p>
      {choice.issue && <p className="mt-1 text-amber-200">当前不满足持续条件，请检查参与者、距离及交流条件。</p>}
      {choice.interactionId && !choice.issue && <label className="mt-2 flex items-start gap-2">
        <input type="checkbox" checked={confirmed[choice.interactionId] ?? false} disabled={busy} onChange={event => setConfirmed(value => ({ ...value, [choice.interactionId!]: event.target.checked }))} />
        <span>确认整个时段内持续条件均满足，包括规则要求的交流、距离及私密条件。</span>
      </label>}
      <div className="mt-2 flex gap-3">
        {choice.interactionId ? <>
          <button type="button" disabled={busy || !!choice.issue || !confirmed[choice.interactionId]} onClick={() => void act(choice, 'complete')} className="text-violet-200 disabled:opacity-40">完成并推进时间</button>
          <button type="button" disabled={busy} onClick={() => void act(choice, 'interrupt')} className="text-rose-200 disabled:opacity-40">打断</button>
        </> : <button type="button" disabled={busy || !!choice.issue} onClick={() => void act(choice, 'start')} className="text-violet-200 disabled:opacity-40">开始交互</button>}
      </div>
    </div>)}
  </section>
}
