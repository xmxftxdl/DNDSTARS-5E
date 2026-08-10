import {
  campaignDay,
  campaignDisplayMinute,
  campaignGregorianDate,
  campaignMinuteOfDay,
  campaignWorldMinuteFromDisplay,
  formatCampaignTime,
  type SharedCampaignTimeState,
} from '../../lib/campaignTime'
import type { PdfSceneRecordV1 } from '../../lib/pdfCampaignAnalysis'

export default function PdfTimelineGameTimeField({ record, clock, onChange }: {
  record: PdfSceneRecordV1
  clock: SharedCampaignTimeState
  onChange: (value: PdfSceneRecordV1) => void
}) {
  const bound = Number.isSafeInteger(record.gameTimeWorldMinute) && Number(record.gameTimeWorldMinute) >= 0
  const worldMinute = bound ? Number(record.gameTimeWorldMinute) : clock.worldMinute
  const eventClock = { ...clock, worldMinute }
  const displayMinute = campaignDisplayMinute(eventClock)
  const minuteOfDay = campaignMinuteOfDay(displayMinute)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  const setDisplayTime = (next: { day?: number; date?: string; hour?: number; minute?: number }) => {
    const converted = campaignWorldMinuteFromDisplay(clock, {
      day: next.day ?? campaignDay(displayMinute),
      date: next.date ?? campaignGregorianDate(eventClock),
      hour: next.hour ?? hour,
      minute: next.minute ?? minute,
    })
    if (converted != null) onChange({ ...record, gameTimeWorldMinute: converted })
  }
  return (
    <section className="rounded-xl border border-rose-400/20 bg-rose-500/[0.035] p-3" data-testid="pdf-timeline-game-time-field">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-rose-200">游戏时间（用于当前时间红线）</p>
          <p className="mt-1 text-[9px] text-slate-500">{bound ? formatCampaignTime(eventClock) : '未绑定：仅保留原文时间，不参与红线排序。'}</p>
        </div>
        <div className="flex items-center gap-2">
          {bound && <button type="button" onClick={() => {
            const next = { ...record }
            delete next.gameTimeWorldMinute
            onChange(next)
          }} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04]">取消绑定</button>}
          <button type="button" onClick={() => onChange({ ...record, gameTimeWorldMinute: clock.worldMinute })} className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-semibold text-rose-100 hover:bg-rose-500/20">设为当前时间</button>
        </div>
      </div>
      {bound && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {clock.displayMode === 'gregorian' ? (
            <label className="block text-[10px] font-semibold text-slate-500">公历日期
              <input type="date" value={campaignGregorianDate(eventClock) ?? ''} onChange={(event) => setDisplayTime({ date: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none focus:border-rose-400/45" />
            </label>
          ) : (
            <label className="block text-[10px] font-semibold text-slate-500">战役日
              <input type="number" min={1} value={campaignDay(displayMinute)} onChange={(event) => setDisplayTime({ day: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none focus:border-rose-400/45" />
            </label>
          )}
          <label className="block text-[10px] font-semibold text-slate-500">时刻
            <input type="time" value={timeValue} onChange={(event) => {
              const [nextHour, nextMinute] = event.target.value.split(':').map(Number)
              setDisplayTime({ hour: nextHour, minute: nextMinute })
            }} className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none focus:border-rose-400/45" />
          </label>
        </div>
      )}
    </section>
  )
}
