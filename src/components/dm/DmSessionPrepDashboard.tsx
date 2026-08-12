import { useState } from 'react'
import {
  BookOpenText,
  Bot,
  Boxes,
  Check,
  CirclePlus,
  GitBranch,
  MapPinned,
  MessageSquareText,
  Save,
  Swords,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type {
  AccountCampaignPrepPlanDraftV1,
  AccountCampaignPrepChecklistItemV1,
} from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'

interface DmSessionPrepDashboardProps {
  analysis: PdfCampaignAnalysisV2 | null
  campaignBasePath: string
  plan: AccountCampaignPrepPlanDraftV1
  onPlanChange: (plan: AccountCampaignPrepPlanDraftV1) => void
  onSave: () => void
  saving?: boolean
  persistenceEnabled?: boolean
  onOpenReview: () => void
  onOpenStory: () => void
}

function toggleId(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((candidate) => candidate !== id) : [...values, id]
}

export default function DmSessionPrepDashboard({
  analysis,
  campaignBasePath,
  plan,
  onPlanChange,
  onSave,
  saving = false,
  persistenceEnabled = true,
  onOpenReview,
  onOpenStory,
}: DmSessionPrepDashboardProps) {
  const [checklistText, setChecklistText] = useState('')
  const storyEvents = (plan.storyWorkspace?.events ?? [])
    .filter((event) => event.status === 'planned' || event.status === 'active')
  const selectedStoryEventIds = plan.selectedStoryEventIds ?? []
  const selectedCount = selectedStoryEventIds.length + plan.selectedPersonIds.length + plan.selectedClueIds.length

  const update = <Key extends keyof AccountCampaignPrepPlanDraftV1>(
    key: Key,
    value: AccountCampaignPrepPlanDraftV1[Key],
  ) => onPlanChange({ ...plan, [key]: value })

  const updateChecklist = (item: AccountCampaignPrepChecklistItemV1) => {
    update('checklist', plan.checklist.map((candidate) => candidate.id === item.id ? item : candidate))
  }

  const addChecklistItem = () => {
    const text = checklistText.trim()
    if (!text || plan.checklist.length >= 64) return
    update('checklist', [...plan.checklist, {
      id: `prep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      completed: false,
    }])
    setChecklistText('')
  }

  const toggleStoryEvent = (eventId: string) => {
    const nextSelectedStoryEventIds = toggleId(selectedStoryEventIds, eventId)
    const selectedStoryEvents = storyEvents.filter((event) => nextSelectedStoryEventIds.includes(event.id))
    onPlanChange({
      ...plan,
      selectedStoryEventIds: nextSelectedStoryEventIds,
      selectedSceneIds: [...new Set(selectedStoryEvents.flatMap((event) => event.sceneIds))],
      selectedPersonIds: [...new Set(selectedStoryEvents.flatMap((event) => event.personIds))],
      selectedClueIds: [...new Set(selectedStoryEvents.flatMap((event) => event.clueIds))],
    })
  }

  return (
    <div className="space-y-4" data-testid="dm-session-prep-dashboard">
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.1] via-transparent to-cyan-500/[0.035] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">可恢复的场次计划</p>
            <h2 className="mt-2 text-xl font-bold text-slate-100">本次备团</h2>
            <p className="mt-1 text-xs text-slate-500">已选择 {selectedCount} 项战役资料；勾选、备注和检查清单会保存到账号战役。</p>
          </div>
          <button
            type="button"
            disabled={saving || !persistenceEnabled}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />{saving ? '保存中…' : '保存本次备团'}
          </button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <label className="space-y-1.5 text-xs text-slate-400">
            场次名称
            <input value={plan.sessionTitle} maxLength={120} onChange={(event) => update('sessionTitle', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/40" />
          </label>
          <label className="space-y-1.5 text-xs text-slate-400">
            本场目标
            <input value={plan.objective} maxLength={1200} onChange={(event) => update('objective', event.target.value)} placeholder="例如：调查伪信来源，并让玩家决定是否前往潮骨驿站。" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/40" />
          </label>
        </div>
      </section>

      <div className="space-y-4">
        <div>
          <SelectableCard icon={GitBranch} title="本场剧情脉络" count={storyEvents.length} empty="剧情时间线中没有待处理事件。">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <span className="rounded-full border border-violet-400/15 bg-violet-500/[0.05] px-2 py-1">已选 {selectedStoryEventIds.length} 个节点</span>
              <span className="rounded-full border border-white/8 px-2 py-1">关联人物 {plan.selectedPersonIds.length}</span>
              <span className="rounded-full border border-white/8 px-2 py-1">关联线索 {plan.selectedClueIds.length}</span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
            {storyEvents.map((event) => (
              <SelectableEntry
                key={event.id}
                selected={selectedStoryEventIds.includes(event.id)}
                title={event.title}
                meta={`${event.status === 'active' ? '进行中' : '待发生'} · ${event.timeLabel || '时间待校准'}${event.summary ? ` · ${event.summary}` : ''}`}
                onToggle={() => toggleStoryEvent(event.id)}
              />
            ))}
            </div>
            <button type="button" onClick={onOpenStory} className="mt-3 inline-flex text-[11px] font-semibold text-violet-200">打开剧情时间线管理节点、人物与线索 →</button>
          </SelectableCard>
        </div>

        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-amber-300" /><h3 className="text-sm font-semibold text-slate-100">开团前检查</h3><span className="ml-auto text-[10px] text-slate-500">{plan.checklist.filter((item) => item.completed).length}/{plan.checklist.length}</span></div>
          <div className="mt-3 space-y-2">
            {plan.checklist.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-xl border border-white/7 bg-white/[0.018] px-3 py-2.5">
                <button type="button" aria-label={item.completed ? '标记为未完成' : '标记为完成'} onClick={() => updateChecklist({ ...item, completed: !item.completed })} className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.completed ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200' : 'border-white/15 text-transparent'}`}><Check className="h-3 w-3" /></button>
                <span className={`min-w-0 flex-1 text-xs leading-5 ${item.completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{item.text}</span>
                <button type="button" aria-label="删除检查项" onClick={() => update('checklist', plan.checklist.filter((candidate) => candidate.id !== item.id))} className="text-slate-700 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={checklistText} maxLength={240} onChange={(event) => setChecklistText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem() } }} placeholder="添加检查项" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/40" />
            <button type="button" onClick={addChecklistItem} className="rounded-xl border border-white/10 px-2.5 text-slate-400 hover:text-violet-200"><CirclePlus className="h-4 w-4" /></button>
          </div>
        </section>
      </div>

      <label className="block rounded-2xl border border-white/8 bg-black/15 p-4 text-xs text-slate-400">
        DM 私密备忘
        <textarea value={plan.privateNotes} maxLength={12_000} rows={5} onChange={(event) => update('privateNotes', event.target.value)} placeholder="记录可能脱轨的路线、临场替代方案、NPC 反应或不希望玩家提前看见的信息。" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none focus:border-violet-400/40" />
      </label>

      {!analysis && (
        <section className="rounded-2xl border border-dashed border-violet-400/20 bg-violet-500/[0.025] p-5 text-center">
          <BookOpenText className="mx-auto h-6 w-6 text-violet-300" />
          <p className="mt-2 text-sm font-semibold text-slate-200">尚未导入模组资料</p>
          <p className="mt-1 text-xs text-slate-500">你仍可手动填写场次计划；导入 PDF 后可从分析结果中勾选人物、场景和线索。</p>
          <button type="button" onClick={onOpenReview} className="mt-3 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400">导入并分析模组</button>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink to={`${campaignBasePath}/dm-tools/workshop`} icon={Boxes} title="内容工坊" detail={`${analysis?.importCandidates.length ?? 0} 项候选资源`} />
        <QuickLink to={`${campaignBasePath}/dm-tools/simulation`} icon={Swords} title="遭遇预演" detail={`${analysis?.encounters.length ?? 0} 个遭遇`} />
        <QuickLink to={`${campaignBasePath}/maps`} icon={MapPinned} title="地图编排" detail="几何、灯光与触发器" />
        <QuickLink to={`${campaignBasePath}/communications`} icon={MessageSquareText} title="讲义与日志" detail="团务记录与前情提要" />
      </section>
    </div>
  )
}

function SelectableCard({ icon: Icon, title, count, empty, children }: { icon: typeof GitBranch; title: string; count: number; empty: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-slate-100">{title}</h3><span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-500">{count}</span></div><div className="max-h-[30rem] overflow-y-auto pr-1">{count ? children : <p className="rounded-xl border border-dashed border-white/8 px-3 py-6 text-center text-xs text-slate-600">{empty}</p>}</div></section>
}

function SelectableEntry({ selected, title, meta, onToggle }: { selected: boolean; title: string; meta: string; onToggle: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onToggle} className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-violet-400/30 bg-violet-500/[0.08]' : 'border-white/7 bg-white/[0.018] hover:border-white/15'}`}><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-violet-400/60 bg-violet-500/25 text-violet-100' : 'border-white/15 text-transparent'}`}><Check className="h-3 w-3" /></span><span className="min-w-0"><strong className="block truncate text-xs text-slate-200">{title}</strong><span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-slate-500">{meta}</span></span></button>
}

function QuickLink({ to, icon: Icon, title, detail }: { to: string; icon: typeof Boxes; title: string; detail: string }) {
  return <Link to={to} className="group rounded-2xl border border-white/8 bg-black/15 p-4 transition hover:border-violet-400/20 hover:bg-violet-500/[0.035]"><Icon className="h-4 w-4 text-cyan-300" /><strong className="mt-3 block text-xs text-slate-200 group-hover:text-white">{title}</strong><span className="mt-1 block text-[10px] text-slate-500">{detail}</span></Link>
}
