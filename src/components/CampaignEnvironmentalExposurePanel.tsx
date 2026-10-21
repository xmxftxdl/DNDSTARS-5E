import { useEffect, useState } from 'react'
import { useMapStore } from '../store/maps'
import { formatCampaignTime } from '../lib/campaignTime'
import { loadEnvironmentalExposureTargets, runCampaignEnvironmentalExposure } from '../pages/maps/campaignEnvironmentalExposureController'

type Context = Awaited<ReturnType<typeof loadEnvironmentalExposureTargets>>

export default function CampaignEnvironmentalExposurePanel({ onDicePending }: { onDicePending?: (pending: boolean) => void }) {
  const mapId = useMapStore(state => state.selectedId)
  const [context, setContext] = useState<Context>()
  const [targetId, setTargetId] = useState('')
  const [hazard, setHazard] = useState<'extreme-heat' | 'extreme-cold'>('extreme-cold')
  const [duration, setDuration] = useState(60)
  const [dc, setDc] = useState(10)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let cancelled = false
    setContext(undefined); setTargetId(''); setConfirmed(false)
    if (!mapId) return
    void loadEnvironmentalExposureTargets(mapId).then(value => {
      if (!cancelled) { setContext(value); setTargetId(value.targets[0]?.id ?? '') }
    }).catch(error => { if (!cancelled) setMessage(String(error)) })
    return () => { cancelled = true }
  }, [mapId, refresh])
  const target = context?.targets.find(row => row.id === targetId)
  const from = (context?.worldMinute ?? 0) - duration
  const valid = !!context && !!target && Number.isSafeInteger(duration) && duration > 0 && from >= 0 && Number.isSafeInteger(dc) && dc >= 1 && dc <= 100
  const submit = async () => {
    if (!mapId || !context || !valid || !confirmed || busy) return
    setBusy(true); setMessage('')
    onDicePending?.(!target?.protections.includes(hazard))
    try {
      const receipt = await runCampaignEnvironmentalExposure({ mapId, targetId, hazard, dc, fromWorldMinute: from,
        toWorldMinute: context.worldMinute, continuityConfirmed: confirmed, exposureId: crypto.randomUUID() })
      setMessage(receipt.outcome === 'protected' ? '环境防护生效：无需投骰，不增加力竭。' : receipt.outcome === 'success' ? '豁免成功：不增加力竭。' : '豁免失败：增加 1 级力竭。')
      setRefresh(value => value + 1)
    } catch (error) { setMessage(`未能结算：${error instanceof Error ? error.message : String(error)}`) }
    finally { setBusy(false); onDicePending?.(false) }
  }
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:col-span-2">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-200">气候暴露</h3>
      <button type="button" disabled={busy || !mapId} onClick={() => setRefresh(value => value + 1)} className="text-xs text-violet-200">刷新目标</button></div>
    <p className="mt-2 text-xs text-slate-400">结算截至当前游戏时间的一段已发生暴露。按规则选择时段和 DC；此操作不推进时间。</p>
    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
      <label>暴露目标<select aria-label="气候暴露目标" disabled={busy} value={targetId} onChange={event => { setTargetId(event.target.value); setConfirmed(false) }} className="mt-1 w-full rounded bg-slate-900 p-2">
        <option value="">选择地图目标</option>{context?.targets.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>气候<select aria-label="暴露气候" disabled={busy} value={hazard} onChange={event => { setHazard(event.target.value as typeof hazard); setConfirmed(false) }} className="mt-1 w-full rounded bg-slate-900 p-2">
        <option value="extreme-cold">极端寒冷</option><option value="extreme-heat">极端炎热</option></select></label>
      <label>已暴露分钟<input aria-label="已暴露分钟" type="number" min={1} disabled={busy} value={duration} onChange={event => { setDuration(Number(event.target.value)); setConfirmed(false) }} className="mt-1 w-full rounded bg-slate-900 p-2" /></label>
      <label>体质豁免 DC<input aria-label="气候豁免DC" type="number" min={1} max={100} disabled={busy} value={dc} onChange={event => setDc(Number(event.target.value))} className="mt-1 w-full rounded bg-slate-900 p-2" /></label>
    </div>
    {valid && <p className="mt-2 text-xs text-slate-400">{formatCampaignTime(from)} → {formatCampaignTime(context!.worldMinute)}</p>}
    {target?.protections.includes(hazard) && <p className="mt-2 text-xs text-emerald-300">目标具有对应环境防护，将自动通过。</p>}
    <label className="mt-3 flex gap-2 text-xs text-slate-300"><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />确认目标在上述整个时段持续暴露，且防护条件未改变。</label>
    <button type="button" disabled={busy || !valid || !confirmed} onClick={() => void submit()} className="mt-3 rounded bg-violet-600 px-3 py-2 text-xs text-white disabled:opacity-40">{busy ? '等待豁免及结算…' : '结算气候暴露'}</button>
    {message && <p role="status" className="mt-2 text-xs text-slate-200">{message}</p>}
  </section>
}
