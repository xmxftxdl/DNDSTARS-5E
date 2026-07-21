import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellPlus, CalendarClock, Clock3, MoonStar, X } from 'lucide-react'
import {
  canBenefitFromLongRest,
  formatCampaignDuration,
  formatCampaignTime,
  type CampaignTimerKind,
} from '../lib/campaignTime'
import type { AppMode } from '../lib/appMode'
import { useCampaignTimeStore } from '../store/campaignTime'
import { useCharacterStore } from '../store/characters'

export default function CampaignTimeWidget({ mode }: { mode?: AppMode }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [customAmount, setCustomAmount] = useState(10)
  const [customUnit, setCustomUnit] = useState<'minute' | 'hour' | 'day'>('minute')
  const [timerLabel, setTimerLabel] = useState('')
  const [timerDuration, setTimerDuration] = useState(10)
  const [timerUnit, setTimerUnit] = useState<'minute' | 'hour'>('minute')
  const [timerKind, setTimerKind] = useState<CampaignTimerKind>('reminder')
  const [timerCharacterId, setTimerCharacterId] = useState('')
  const clock = useCampaignTimeStore((state) => state.state)
  const mutate = useCampaignTimeStore((state) => state.mutate)
  const characters = useCharacterStore((state) => state.characters)
  const isDm = mode !== 'player'
  const dndCharacters = characters.filter((character) => character.rulesetId === 'dnd5e-2014-srd-5.1')
  const visibleTimers = useMemo(() => clock.timers
    .filter((timer) => timer.status === 'active' || timer.status === 'expired')
    .sort((left, right) => left.expiresAtWorldMinute - right.expiresAtWorldMinute), [clock.timers])
  const longRestCompletion = clock.worldMinute + 8 * 60
  const eligibleLongRests = dndCharacters.filter((character) =>
    canBenefitFromLongRest(character.dnd5eLastLongRestWorldMinute, longRestCompletion),
  ).length

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  const advance = (minutes: number, reason: string) => run(() => mutate({ operation: 'advance', minutes, reason }))
  const createTimer = () => {
    const character = characters.find((entry) => entry.id === timerCharacterId)
    const durationMinutes = timerDuration * (timerUnit === 'hour' ? 60 : 1)
    if (!timerLabel.trim() || durationMinutes < 1) return
    void run(async () => {
      await mutate({
        operation: 'create-timer',
        kind: timerKind,
        label: timerLabel.trim(),
        durationMinutes,
        characterId: character?.id,
        characterName: character?.name,
      })
      setTimerLabel('')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-left transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
      >
        <Clock3 className="h-4 w-4 text-violet-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] text-slate-500">战役时间</span>
          <span className="block truncate text-xs font-semibold text-slate-200">{formatCampaignTime(clock.worldMinute)}</span>
        </span>
        {visibleTimers.some((timer) => timer.status === 'expired') && <span className="h-2 w-2 rounded-full bg-amber-400" />}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/75 p-4" onMouseDown={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-lg font-bold text-slate-100"><CalendarClock className="h-5 w-5 text-violet-300" />战役时间</p>
                <p className="mt-1 text-2xl font-bold text-violet-200">{formatCampaignTime(clock.worldMinute)}</p>
                <p className="mt-1 text-xs text-slate-500">房间级权威时钟；玩家端只读，刷新与重连不会丢失。</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            {isDm && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="text-sm font-semibold text-slate-200">推进时间</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[{ label: '+10 分钟', minutes: 10 }, { label: '+1 小时', minutes: 60 }, { label: '+8 小时', minutes: 480 }, { label: '+1 天', minutes: 1_440 }].map((entry) => (
                      <button key={entry.minutes} type="button" disabled={busy} onClick={() => void advance(entry.minutes, entry.label)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-violet-400/30 hover:bg-violet-500/10 disabled:opacity-50">{entry.label}</button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input type="number" min={1} value={customAmount} onChange={(event) => setCustomAmount(Math.max(1, Number(event.target.value) || 1))} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100" />
                    <select value={customUnit} onChange={(event) => setCustomUnit(event.target.value as typeof customUnit)} className="rounded-xl border border-white/10 bg-slate-900 px-2 text-xs text-slate-200"><option value="minute">分钟</option><option value="hour">小时</option><option value="day">天</option></select>
                    <button type="button" disabled={busy} onClick={() => {
                      const multiplier = customUnit === 'day' ? 1_440 : customUnit === 'hour' ? 60 : 1
                      void advance(customAmount * multiplier, 'DM 自定义推进')
                    }} className="rounded-xl bg-violet-500/20 px-3 text-xs font-semibold text-violet-200 disabled:opacity-50">推进</button>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void run(() => mutate({ operation: 'long-rest', reason: '队伍完成长休' }))} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500/20 px-3 py-2.5 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50"><MoonStar className="h-4 w-4" />完成长休并推进 8 小时</button>
                  <p className="mt-2 text-[11px] text-slate-500">{eligibleLongRests}/{dndCharacters.length} 名角色可获得长休收益；24 小时内重复长休只推进时间。</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200"><BellPlus className="h-4 w-4 text-amber-300" />新建分钟级提醒</h3>
                  <input value={timerLabel} onChange={(event) => setTimerLabel(event.target.value.slice(0, 160))} placeholder="例如：隐形术专注到期" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select value={timerKind} onChange={(event) => setTimerKind(event.target.value as CampaignTimerKind)} className="rounded-xl border border-white/10 bg-slate-900 px-2 py-2 text-xs text-slate-200"><option value="reminder">普通提醒</option><option value="concentration">非战斗专注</option></select>
                    <select value={timerCharacterId} onChange={(event) => setTimerCharacterId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-2 py-2 text-xs text-slate-200"><option value="">不关联角色</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input type="number" min={1} value={timerDuration} onChange={(event) => setTimerDuration(Math.max(1, Number(event.target.value) || 1))} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100" />
                    <select value={timerUnit} onChange={(event) => setTimerUnit(event.target.value as typeof timerUnit)} className="rounded-xl border border-white/10 bg-slate-900 px-2 text-xs text-slate-200"><option value="minute">分钟</option><option value="hour">小时</option></select>
                    <button type="button" disabled={busy || !timerLabel.trim()} onClick={createTimer} className="rounded-xl bg-amber-400/15 px-3 text-xs font-semibold text-amber-200 disabled:opacity-40">创建</button>
                  </div>
                </section>
              </div>
            )}

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-200">计时器与专注提醒</h3><span className="text-[11px] text-slate-500">{visibleTimers.length} 项</span></div>
              <div className="mt-3 space-y-2">
                {visibleTimers.length === 0 && <p className="py-4 text-center text-xs text-slate-600">暂无进行中或待确认的提醒</p>}
                {visibleTimers.map((timer) => {
                  const remaining = Math.max(0, timer.expiresAtWorldMinute - clock.worldMinute)
                  return <div key={timer.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                    <span className={`h-2 w-2 rounded-full ${timer.status === 'expired' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{timer.label}</p><p className="mt-0.5 text-[10px] text-slate-500">{timer.characterName ? `${timer.characterName} · ` : ''}{timer.kind === 'concentration' ? '专注' : '提醒'} · {timer.status === 'expired' ? '已到期' : `剩余 ${formatCampaignDuration(remaining)}`}</p></div>
                    {isDm && <button type="button" disabled={busy} onClick={() => void run(() => mutate({ operation: timer.status === 'expired' ? 'dismiss-timer' : 'cancel-timer', timerId: timer.id }))} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-100">{timer.status === 'expired' ? '归档' : '取消'}</button>}
                  </div>
                })}
              </div>
            </section>
            {error && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
