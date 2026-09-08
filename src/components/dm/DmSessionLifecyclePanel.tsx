import { BookOpenText, Check, CircleStop, History, Play, RotateCcw, ScrollText, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AccountCampaignPrepPlanDraftV1, AccountCampaignSessionReviewV1 } from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import type { CampaignJournalEntry } from '../../lib/roomCommunications'
import { applySessionReview, buildSessionReview, orderedStoryEvents, startCampaignSession, storyEventAvailability, synchronizeStoryWorkspace } from './dmCampaignStoryModel'

function formatTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function DmSessionLifecyclePanel({
  view,
  analysis,
  plan,
  journalEntries,
  journalConnected,
  communicationsHref,
  onPlanChange,
}: {
  view: 'session' | 'review'
  analysis: PdfCampaignAnalysisV2 | null
  plan: AccountCampaignPrepPlanDraftV1
  journalEntries: readonly CampaignJournalEntry[]
  journalConnected: boolean
  communicationsHref: string
  onPlanChange: (plan: AccountCampaignPrepPlanDraftV1) => void
}) {
  const workspace = synchronizeStoryWorkspace(plan.storyWorkspace, analysis)
  const session = workspace.activeSession
  const review = session?.review
  const orderedEvents = orderedStoryEvents(workspace)
  const currentEntries = session
    ? journalEntries.filter((entry) => !session.baselineJournalEntryIds.includes(entry.id) && entry.createdAt >= session.startedAt)
    : []
  const updateWorkspace = (nextWorkspace: typeof workspace) => onPlanChange({ ...plan, storyWorkspace: nextWorkspace })
  const updateReview = (nextReview: AccountCampaignSessionReviewV1) => {
    if (!session) return
    updateWorkspace({ ...workspace, activeSession: { ...session, review: nextReview } })
  }

  if (view === 'session' && workspace.mode === 'prep') {
    return <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3" data-testid="dm-session-runtime">
      <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
      <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">团务模式 · 备团</p><p className="mt-1 truncate text-xs text-slate-300">{plan.sessionTitle} · 统一剧情事件 {workspace.events.length} 个 · 已选本场节点 {plan.selectedStoryEventIds.length} 个</p></div>
      <button type="button" onClick={() => updateWorkspace(startCampaignSession(workspace, plan.sessionTitle, journalEntries))} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-400"><Play className="h-4 w-4" />开始本场团务</button>
    </section>
  }

  if (view === 'session') {
    return (
      <section className={`mb-4 rounded-3xl border p-5 ${workspace.mode === 'running' ? 'border-cyan-400/25 bg-cyan-500/[0.055]' : workspace.mode === 'review' ? 'border-amber-400/25 bg-amber-500/[0.045]' : 'border-white/8 bg-black/15'}`} data-testid="dm-session-runtime">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${workspace.mode === 'running' ? 'animate-pulse bg-cyan-300' : workspace.mode === 'review' ? 'bg-amber-300' : 'bg-slate-600'}`} /><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">团务模式 · {workspace.mode === 'running' ? '进行中' : workspace.mode === 'review' ? '等待复盘' : '备团'}</p></div>
            <h2 className="mt-2 text-lg font-bold text-slate-100">{session?.title ?? plan.sessionTitle}</h2>
            <p className="mt-1 text-xs text-slate-500">{workspace.mode === 'prep' ? '开始后，事件状态和本房间新增战役日志会归入同一场团务。' : workspace.mode === 'running' ? `已运行 ${Math.max(1, Math.round((Date.now() - (session?.startedAt ?? Date.now())) / 60_000))} 分钟 · 收集 ${currentEntries.length} 条日志` : '团务已结束，请在“团后复盘”确认人物、线索和下一场准备更新。'}</p>
          </div>
          {workspace.mode === 'prep' ? (
            <button type="button" onClick={() => updateWorkspace(startCampaignSession(workspace, plan.sessionTitle, journalEntries))} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-400"><Play className="h-4 w-4" />开始本场团务</button>
          ) : workspace.mode === 'running' ? (
            <button type="button" onClick={() => updateWorkspace(buildSessionReview(analysis, workspace, journalEntries))} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-amber-400"><CircleStop className="h-4 w-4" />结束并生成复盘</button>
          ) : <span className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">请前往团后复盘</span>}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <RuntimeMetric icon={ScrollText} label="统一剧情事件" value={`${workspace.events.filter((event) => event.status === 'completed').length}/${workspace.events.length} 已完成`} />
          <RuntimeMetric icon={BookOpenText} label="本场团务日志" value={journalConnected ? `${currentEntries.length} 条已收集` : '当前未连接战役房间'} />
          <RuntimeMetric icon={Users} label="人物与线索状态" value={`${workspace.personStates.length + workspace.clueStates.length} 项已沉淀`} />
        </div>
        {workspace.mode === 'running' && <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{orderedEvents.filter((event) => event.status !== 'completed' && event.status !== 'skipped' && storyEventAvailability(workspace, event.id) !== 'blocked').slice(0, 9).map((event) => { const availability = storyEventAvailability(workspace, event.id); return <button key={event.id} type="button" onClick={() => updateWorkspace({ ...workspace, events: workspace.events.map((candidate) => candidate.id === event.id ? { ...candidate, status: candidate.status === 'active' ? 'completed' : 'active' } : candidate) })} className={`rounded-xl border px-3 py-2.5 text-left ${event.status === 'active' ? 'border-cyan-400/30 bg-cyan-500/10' : availability === 'waiting' ? 'border-amber-400/20 bg-amber-500/[0.04]' : 'border-white/8 bg-black/15'}`}><strong className="block truncate text-xs text-slate-200">{event.title}</strong><span className="mt-1 block text-[10px] text-slate-500">{event.status === 'active' ? '点击标记为已完成' : availability === 'waiting' ? '等待 DM 判断分支' : '点击设为当前事件'}</span></button> })}</div>}
        <p className="mt-4 text-[10px] text-slate-600">{journalConnected ? '已连接当前战役房间；这里只读取团务日志，不会把聊天私信自动写入复盘。' : <>进入这个战役的 DM 房间后，可自动读取新增战役日志；也可先在 <Link to={communicationsHref} className="text-violet-300">通讯与日志</Link> 手动记录。</>}</p>
      </section>
    )
  }

  return (
    <div className="space-y-4" data-testid="dm-session-review">
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-cyan-500/[0.025] p-5">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-200"><History className="h-5 w-5" /></div><div><h2 className="text-xl font-bold text-slate-100">团后复盘</h2><p className="mt-1 text-xs leading-5 text-slate-500">系统从本场新增的战役日志提取候选更新；只有 DM 勾选并确认后，才会改变人物状态、线索状态与下一场检查清单。</p></div></div>
      </section>

      {!session && <section className="rounded-2xl border border-dashed border-white/10 p-8 text-center"><History className="mx-auto h-7 w-7 text-slate-700" /><p className="mt-2 text-sm font-semibold text-slate-300">当前没有待复盘团务</p><p className="mt-1 text-xs text-slate-600">请先在“本次备团”开始并结束一场团务。</p></section>}
      {session && workspace.mode === 'running' && <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.035] p-5"><p className="text-sm font-semibold text-cyan-100">团务仍在进行中</p><p className="mt-1 text-xs text-slate-500">结束团务后才会固定日志范围并生成复盘建议。</p><button type="button" onClick={() => updateWorkspace(buildSessionReview(analysis, workspace, journalEntries))} className="mt-3 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black">结束并生成复盘</button></section>}
      {session && workspace.mode === 'review' && review && <>
        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-100">{session.title}</h3><p className="mt-1 text-[10px] text-slate-600">{formatTime(session.startedAt)} 至 {formatTime(session.endedAt ?? Date.now())} · {session.journalEntryIds.length} 条日志</p></div><button type="button" onClick={() => updateWorkspace(buildSessionReview(analysis, { ...workspace, activeSession: { ...session, review: undefined } }, journalEntries))} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-400"><RotateCcw className="h-3 w-3" />重新生成建议</button></div>
          <label className="mt-4 block text-[10px] text-slate-500">本场摘要<textarea value={review.summary} maxLength={12_000} rows={6} onChange={(event) => updateReview({ ...review, summary: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none focus:border-violet-400/40" /></label>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReviewList title="人物状态建议" empty="日志中没有识别到人物状态变化。">{review.personUpdates.map((update, index) => { const person = analysis?.people.find((entry) => entry.id === update.personId); return <ReviewToggle key={`${update.personId}-${index}`} checked={update.accepted} title={person?.name ?? update.personId} detail={update.note} badge={update.status} onToggle={() => updateReview({ ...review, personUpdates: review.personUpdates.map((entry, candidate) => candidate === index ? { ...entry, accepted: !entry.accepted } : entry) })} /> })}</ReviewList>
          <ReviewList title="线索状态建议" empty="日志中没有识别到明确的线索变化。">{review.clueUpdates.map((update, index) => { const clue = analysis?.clues.find((entry) => entry.id === update.clueId); return <ReviewToggle key={`${update.clueId}-${index}`} checked={update.accepted} title={clue?.name ?? update.clueId} detail={update.note} badge={update.status} onToggle={() => updateReview({ ...review, clueUpdates: review.clueUpdates.map((entry, candidate) => candidate === index ? { ...entry, accepted: !entry.accepted } : entry) })} /> })}</ReviewList>
        </div>
        <ReviewList title="自动生成的下一场准备清单" empty="暂无新的准备建议。">{review.nextChecklist.map((item, index) => <ReviewToggle key={item.id} checked={item.accepted} title={item.text} detail="确认后加入下一场备团检查清单" onToggle={() => updateReview({ ...review, nextChecklist: review.nextChecklist.map((entry, candidate) => candidate === index ? { ...entry, accepted: !entry.accepted } : entry) })} />)}</ReviewList>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4"><div><p className="text-xs font-semibold text-emerald-100">DM 权威确认</p><p className="mt-1 text-[10px] text-slate-500">将应用 {review.personUpdates.filter((entry) => entry.accepted).length} 个人物更新、{review.clueUpdates.filter((entry) => entry.accepted).length} 个线索更新和 {review.nextChecklist.filter((entry) => entry.accepted).length} 项准备任务。</p></div><button type="button" onClick={() => onPlanChange(applySessionReview(plan))} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-400"><Sparkles className="h-4 w-4" />确认复盘并准备下一场</button></section>
      </>}

      {workspace.recaps.length > 0 && <section className="rounded-2xl border border-white/8 bg-black/15 p-4"><h3 className="text-sm font-semibold text-slate-100">历史复盘 · {workspace.recaps.length}</h3><div className="mt-3 space-y-2">{[...workspace.recaps].reverse().slice(0, 10).map((recap) => <details key={recap.id} className="rounded-xl border border-white/7 bg-white/[0.018] px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-300">{recap.title}<span className="ml-2 text-[10px] font-normal text-slate-600">{formatTime(recap.endedAt)}</span></summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{recap.summary}</p></details>)}</div></section>}
      {(workspace.personStates.length > 0 || workspace.clueStates.length > 0) && <section className="grid gap-4 lg:grid-cols-2"><StateSummary title="当前人物状态" entries={workspace.personStates.map((state) => ({ id: state.personId, title: analysis?.people.find((person) => person.id === state.personId)?.name ?? state.personId, status: state.status, note: state.note }))} /><StateSummary title="当前线索状态" entries={workspace.clueStates.map((state) => ({ id: state.clueId, title: analysis?.clues.find((clue) => clue.id === state.clueId)?.name ?? state.clueId, status: state.status, note: state.note }))} /></section>}
    </div>
  )
}

function RuntimeMetric({ icon: Icon, label, value }: { icon: typeof ScrollText; label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="flex items-center gap-2 text-[10px] text-slate-500"><Icon className="h-3.5 w-3.5" />{label}</div><strong className="mt-2 block text-xs text-slate-200">{value}</strong></div>
}

function ReviewList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0
  return <section className="rounded-2xl border border-white/8 bg-black/15 p-4"><h3 className="text-sm font-semibold text-slate-100">{title}</h3><div className="mt-3 space-y-2">{count ? children : <p className="rounded-xl border border-dashed border-white/8 px-3 py-6 text-center text-xs text-slate-600">{empty}</p>}</div></section>
}

function ReviewToggle({ checked, title, detail, badge, onToggle }: { checked: boolean; title: string; detail: string; badge?: string; onToggle: () => void }) {
  return <button type="button" aria-pressed={checked} onClick={onToggle} className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left ${checked ? 'border-violet-400/25 bg-violet-500/[0.07]' : 'border-white/7 bg-white/[0.015] opacity-60'}`}><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-violet-400/60 bg-violet-500/25 text-white' : 'border-white/15 text-transparent'}`}><Check className="h-3 w-3" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-xs text-slate-200">{title}</strong>{badge && <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500">{badge}</span>}</span><span className="mt-1 line-clamp-3 block text-[10px] leading-4 text-slate-500">{detail}</span></span></button>
}

function StateSummary({ title, entries }: { title: string; entries: Array<{ id: string; title: string; status: string; note: string }> }) {
  return <div className="rounded-2xl border border-white/8 bg-black/15 p-4"><h3 className="text-sm font-semibold text-slate-100">{title} · {entries.length}</h3><div className="mt-3 space-y-2">{entries.map((entry) => <div key={entry.id} className="rounded-xl border border-white/7 px-3 py-2.5"><div className="flex items-center gap-2"><strong className="text-xs text-slate-200">{entry.title}</strong><span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500">{entry.status}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-500">{entry.note}</p></div>)}</div></div>
}
