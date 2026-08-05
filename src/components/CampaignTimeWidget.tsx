import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellPlus, CalendarClock, Clock3, Coffee, MoonStar, X } from 'lucide-react'
import {
  campaignDay,
  campaignDisplayMinute,
  campaignGregorianDate,
  campaignMinuteOfDay,
  canBenefitFromLongRest,
  formatCampaignDuration,
  formatCampaignTime,
  type CampaignTimerKind,
  type CampaignTimeDisplayMode,
} from '../lib/campaignTime'
import type { AppMode } from '../lib/appMode'
import { useCampaignTimeStore } from '../store/campaignTime'
import {
  completeDnd5eCampaignLongRest,
  completeDnd5eCampaignShortRest,
} from '../store/campaignLongRest'
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
  const [restKind, setRestKind] = useState<'short-rest' | 'long-rest'>('long-rest')
  const [restCharacterIds, setRestCharacterIds] = useState<string[]>([])
  const [ignoreLongRestCooldown, setIgnoreLongRestCooldown] = useState(false)
  const [manualMode, setManualMode] = useState<CampaignTimeDisplayMode>('campaign-day')
  const [manualDay, setManualDay] = useState(1)
  const [manualDate, setManualDate] = useState('')
  const [manualTime, setManualTime] = useState('08:00')
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
  const blockedSelectedLongRests = restKind === 'long-rest'
    ? dndCharacters.filter((character) =>
        restCharacterIds.includes(character.id) &&
        !canBenefitFromLongRest(character.dnd5eLastLongRestWorldMinute, longRestCompletion),
      ).length
    : 0

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
  const startRest = () => {
    if (restCharacterIds.length === 0) {
      setError('请至少选择一名获得休息收益的角色。')
      return
    }
    if (restKind === 'long-rest' && blockedSelectedLongRests > 0 && !ignoreLongRestCooldown) {
      setError('选中的角色中有人在 24 小时内已获得过长休收益；请取消选择或启用 DM 覆盖。')
      return
    }
    void run(() => restKind === 'short-rest'
      ? completeDnd5eCampaignShortRest('DM 安排队伍短休', restCharacterIds)
      : completeDnd5eCampaignLongRest(
          'DM 安排队伍长休',
          restCharacterIds,
          ignoreLongRestCooldown,
        ))
  }
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
  const openClock = () => {
    const displayMinute = campaignDisplayMinute(clock)
    const minuteOfDay = campaignMinuteOfDay(displayMinute)
    const today = new Date()
    const localDate = `${today.getFullYear().toString().padStart(4, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    setManualMode(clock.displayMode)
    setManualDay(campaignDay(displayMinute))
    setManualDate(campaignGregorianDate(clock) ?? localDate)
    setManualTime(`${Math.floor(minuteOfDay / 60).toString().padStart(2, '0')}:${(minuteOfDay % 60).toString().padStart(2, '0')}`)
    setRestCharacterIds(dndCharacters.map((character) => character.id))
    setIgnoreLongRestCooldown(false)
    setError('')
    setOpen(true)
  }
  const setManualClock = () => {
    const [hour, minute] = manualTime.split(':').map(Number)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      setError('请输入有效的小时和分钟。')
      return
    }
    if (manualMode === 'gregorian' && !manualDate) {
      setError('请选择公历日期。')
      return
    }
    void run(() => mutate({
      operation: 'set-time',
      displayMode: manualMode,
      day: manualMode === 'campaign-day' ? manualDay : undefined,
      date: manualMode === 'gregorian' ? manualDate : undefined,
      hour,
      minute,
      reason: 'DM 手动设定战役时间',
    }))
  }

  return (
    <>
      <button
        type="button"
        onClick={openClock}
        className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-left transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
      >
        <Clock3 className="h-4 w-4 text-violet-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] text-slate-500">战役时间</span>
          <span className="block truncate text-xs font-semibold text-slate-200">{formatCampaignTime(clock)}</span>
        </span>
        {visibleTimers.some((timer) => timer.status === 'expired') && <span className="h-2 w-2 rounded-full bg-amber-400" />}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/75 p-4" onMouseDown={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-lg font-bold text-slate-100"><CalendarClock className="h-5 w-5 text-violet-300" />战役时间</p>
                <p className="mt-1 text-2xl font-bold text-violet-200">{formatCampaignTime(clock)}</p>
                <p className="mt-1 text-xs text-slate-500">房间级权威时钟；玩家端只读，刷新与重连不会丢失。</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            {isDm && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.035] p-4 md:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-200">手动设定当前时间</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setManualMode('campaign-day')} className={`rounded-xl border px-3 py-2 text-xs ${manualMode === 'campaign-day' ? 'border-violet-400/50 bg-violet-500/20 text-violet-100' : 'border-white/10 text-slate-400'}`}>战役第 N 日</button>
                    <button type="button" onClick={() => setManualMode('gregorian')} className={`rounded-xl border px-3 py-2 text-xs ${manualMode === 'gregorian' ? 'border-violet-400/50 bg-violet-500/20 text-violet-100' : 'border-white/10 text-slate-400'}`}>公历日期</button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                    {manualMode === 'campaign-day' ? (
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">第<input type="number" min={1} max={999999} value={manualDay} onChange={(event) => setManualDay(Math.max(1, Math.min(999999, Number(event.target.value) || 1)))} className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none" />日</label>
                    ) : (
                      <input type="date" min="0001-01-01" max="9999-12-31" value={manualDate} onChange={(event) => setManualDate(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
                    )}
                    <input type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
                    <button type="button" disabled={busy} onClick={setManualClock} className="rounded-xl bg-violet-500/20 px-4 py-2 text-xs font-semibold text-violet-100 disabled:opacity-50">应用时间</button>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">晚于当前显示时间会真实推进房间时钟并触发计时规则；更早的输入只校准日期显示，不会倒放已经结算的长休、光源或冷却。</p>
                </section>
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

                <section className="rounded-2xl border border-indigo-300/15 bg-indigo-500/[0.035] p-4 md:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        {restKind === 'long-rest' ? <MoonStar className="h-4 w-4 text-indigo-300" /> : <Coffee className="h-4 w-4 text-emerald-300" />}
                        队伍休息
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500">由 DM 指定休息类型和实际获得收益的角色。</p>
                    </div>
                    <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                      <button type="button" onClick={() => setRestKind('short-rest')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${restKind === 'short-rest' ? 'bg-emerald-500/20 text-emerald-100' : 'text-slate-500'}`}>短休</button>
                      <button type="button" onClick={() => setRestKind('long-rest')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${restKind === 'long-rest' ? 'bg-indigo-500/25 text-indigo-100' : 'text-slate-500'}`}>长休</button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-300">受益角色 · 已选 {restCharacterIds.length}/{dndCharacters.length}</p>
                    <div className="flex gap-2 text-[11px]">
                      <button type="button" onClick={() => setRestCharacterIds(dndCharacters.map((character) => character.id))} className="text-violet-300 hover:text-violet-200">全选</button>
                      <button type="button" onClick={() => setRestCharacterIds([])} className="text-slate-500 hover:text-slate-300">清空</button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {dndCharacters.map((character) => {
                      const selected = restCharacterIds.includes(character.id)
                      const eligible = canBenefitFromLongRest(character.dnd5eLastLongRestWorldMinute, longRestCompletion)
                      return (
                        <label key={character.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${selected ? 'border-indigo-400/35 bg-indigo-500/10' : 'border-white/8 bg-black/15'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => setRestCharacterIds((current) => event.target.checked
                              ? [...new Set([...current, character.id])]
                              : current.filter((id) => id !== character.id))}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-slate-200">{character.name}</span>
                            <span className={`mt-0.5 block text-[10px] ${restKind === 'long-rest' && !eligible ? 'text-amber-300' : 'text-slate-500'}`}>
                              {restKind === 'short-rest' ? '恢复短休资源' : eligible ? '可正常获得长休收益' : '24 小时内已获得过长休收益'}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                    {dndCharacters.length === 0 && <p className="py-4 text-center text-xs text-slate-600 sm:col-span-2">当前房间没有可选择的 D&D 5e 角色</p>}
                  </div>

                  {restKind === 'long-rest' && (
                    <label className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-500/[0.04] px-3 py-2.5 text-xs text-amber-100/80">
                      <input type="checkbox" checked={ignoreLongRestCooldown} onChange={(event) => setIgnoreLongRestCooldown(event.target.checked)} className="mt-0.5" />
                      <span>DM 覆盖 24 小时限制：允许选中的角色再次获得长休收益。当前正常可受益 {eligibleLongRests}/{dndCharacters.length} 名。</span>
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={busy || restCharacterIds.length === 0 || (restKind === 'long-rest' && blockedSelectedLongRests > 0 && !ignoreLongRestCooldown)}
                    onClick={startRest}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${restKind === 'long-rest' ? 'bg-indigo-500/25 text-indigo-100 hover:bg-indigo-500/35' : 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'}`}
                  >
                    {restKind === 'long-rest' ? <MoonStar className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                    {restKind === 'long-rest' ? '完成长休并推进 8 小时' : '完成短休并推进 1 小时'}
                  </button>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                    {restKind === 'long-rest'
                      ? '仅选中角色恢复生命值、生命骰、法术位与长休资源。'
                      : '仅选中角色恢复短休资源；使用生命骰恢复生命值仍由玩家在角色卡中决定。'}
                  </p>
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
