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
  const selectedStoryEvents = storyEvents.filter((event) => selectedStoryEventIds.includes(event.id))
  const selectedSceneIds = new Set(selectedStoryEvents.flatMap((event) => event.sceneIds))
  const selectedPersonIds = new Set(selectedStoryEvents.flatMap((event) => event.personIds))
  const selectedClueIds = new Set(selectedStoryEvents.flatMap((event) => event.clueIds))
  const selectedScenes = analysis?.scenes.filter((scene) => selectedSceneIds.has(scene.id)) ?? []
  const selectedPeople = analysis?.people.filter((person) => selectedPersonIds.has(person.id)) ?? []
  const selectedClues = analysis?.clues.filter((clue) => selectedClueIds.has(clue.id)) ?? []

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
    <div className="space-y-4" data-testid="dm-session-prep-dashboard" data-session-prep-contrast-surface="true">
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-cyan-500/[0.025] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100">本次备团</h2>
            <p className="mt-1 text-xs text-slate-500">只确定这一场要跑的节点；人物、线索与场景会自动带入，不再重复整理整套模组。</p>
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
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-100">1</span><GitBranch className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-slate-100">选择本场剧情节点</h3><span className="ml-auto text-[10px] text-slate-500">已选 {selectedStoryEventIds.length}</span></div>
          <p className="mt-1 pl-7 text-[10px] text-slate-600">建议选择 1–3 个：开场、核心冲突和可能结尾；细节在剧情工作区查看。</p>
          <div className="mt-3 grid max-h-[24rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {storyEvents.map((event) => {
              const selected = selectedStoryEventIds.includes(event.id)
              const selectionIndex = selectedStoryEventIds.indexOf(event.id)
              return <SelectableEntry
                key={event.id}
                selected={selected}
                order={selectionIndex >= 0 ? selectionIndex + 1 : undefined}
                title={event.title}
                meta={`${event.status === 'active' ? '进行中' : '待发生'} · ${event.timeLabel || '时间待校准'}${event.summary ? ` · ${event.summary}` : ''}`}
                onToggle={() => toggleStoryEvent(event.id)}
              />
            })}
            {storyEvents.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-white/8 px-3 py-8 text-center text-xs text-slate-600">剧情时间线中没有待处理事件。</p>}
          </div>
          <button type="button" onClick={onOpenStory} className="mt-3 inline-flex text-[11px] font-semibold text-violet-200">查看剧情流程图与原文书签 →</button>
        </section>

        <section className="rounded-2xl border border-cyan-400/12 bg-cyan-500/[0.025] p-4" data-testid="dm-session-auto-materials">
          <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-100">2</span><Boxes className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-semibold text-slate-100">自动带入本场素材</h3></div>
          <p className="mt-1 pl-7 text-[10px] text-slate-600">只读汇总；更换剧情节点后自动更新。</p>
          {selectedStoryEvents.length > 0 ? <div className="mt-4 space-y-4">
            <MaterialGroup title="可运行场景" values={selectedScenes.map((scene) => scene.name)} empty="节点未关联场景" />
            <MaterialGroup title="登场人物" values={selectedPeople.map((person) => person.name)} empty="节点未关联人物" />
            <MaterialGroup title="关键线索" values={selectedClues.map((clue) => clue.name)} empty="节点未关联线索" />
          </div> : <p className="mt-4 rounded-xl border border-dashed border-white/8 px-3 py-8 text-center text-xs text-slate-600">先从左侧选择本场剧情节点。</p>}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-100">3</span><Bot className="h-4 w-4 text-amber-300" /><h3 className="text-sm font-semibold text-slate-100">开团前检查</h3><span className="ml-auto text-[10px] text-slate-500">{plan.checklist.filter((item) => item.completed).length}/{plan.checklist.length}</span></div>
          <div className="mt-3 space-y-2">
            {plan.checklist.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-xl border border-white/7 bg-white/[0.018] px-3 py-2.5">
                <button type="button" aria-label={item.completed ? '标记为未完成' : '标记为完成'} onClick={() => updateChecklist({ ...item, completed: !item.completed })} className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.completed ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200' : 'border-white/15 text-transparent'}`}><Check className="h-3 w-3" /></button>
                <span className={`min-w-0 flex-1 text-xs leading-5 ${item.completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{item.text}</span>
                <button type="button" aria-label="删除检查项" onClick={() => update('checklist', plan.checklist.filter((candidate) => candidate.id !== item.id))} className="text-slate-700 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2"><input value={checklistText} maxLength={240} onChange={(event) => setChecklistText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem() } }} placeholder="添加检查项" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/40" /><button type="button" onClick={addChecklistItem} className="rounded-xl border border-white/10 px-2.5 text-slate-400 hover:text-violet-200"><CirclePlus className="h-4 w-4" /></button></div>
        </section>

        <label className="block rounded-2xl border border-white/8 bg-black/15 p-4 text-xs text-slate-400">
          DM 临场备忘
          <textarea value={plan.privateNotes} maxLength={12_000} rows={7} onChange={(event) => update('privateNotes', event.target.value)} placeholder="记录开场画面、NPC 反应、失败推进和可能脱轨的替代路线。" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none focus:border-violet-400/40" />
        </label>
      </div>

      {!analysis && (
        <section className="rounded-2xl border border-dashed border-violet-400/20 bg-violet-500/[0.025] p-5 text-center">
          <BookOpenText className="mx-auto h-6 w-6 text-violet-300" />
          <p className="mt-2 text-sm font-semibold text-slate-200">尚未导入模组资料</p>
          <p className="mt-1 text-xs text-slate-500">你仍可手动填写场次计划；导入 PDF 后可从分析结果中勾选人物、场景和线索。</p>
          <button type="button" onClick={onOpenReview} className="mt-3 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400">导入并分析模组</button>
        </section>
      )}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink to={`${campaignBasePath}/dm-tools/workshop`} icon={Boxes} title="内容工坊" detail={`${analysis?.importCandidates.length ?? 0} 项候选资源`} />
        <QuickLink to={`${campaignBasePath}/dm-tools/simulation`} icon={Swords} title="遭遇预演" detail={`${analysis?.encounters.length ?? 0} 个遭遇`} />
        <QuickLink to={`${campaignBasePath}/maps`} icon={MapPinned} title="地图编排" detail="几何、灯光与触发器" />
        <QuickLink to={`${campaignBasePath}/communications`} icon={MessageSquareText} title="讲义与日志" detail="团务记录与前情提要" />
      </section>
    </div>
  )
}

function SelectableEntry({ selected, disabled, order, title, meta, onToggle }: { selected: boolean; disabled?: boolean; order?: number; title: string; meta: string; onToggle: () => void }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onToggle} className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-violet-400/30 bg-violet-500/[0.08]' : 'border-white/7 bg-white/[0.018] hover:border-white/15'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${selected ? 'border-violet-400/60 bg-violet-500/25 text-violet-100' : 'border-white/15 text-transparent'}`}>{order ?? <Check className="h-3 w-3" />}</span><span className="min-w-0"><strong className="block truncate text-xs text-slate-200">{title}</strong><span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-slate-500">{meta}</span></span></button>
}

function MaterialGroup({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <div><div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-slate-400">{title}</p><span className="text-[9px] text-slate-600">{values.length}</span></div>{values.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="rounded-full border border-white/8 bg-white/[0.025] px-2 py-1 text-[10px] text-slate-300">{value}</span>)}</div> : <p className="mt-1 text-[10px] text-slate-700">{empty}</p>}</div>
}

function QuickLink({ to, icon: Icon, title, detail }: { to: string; icon: typeof Boxes; title: string; detail: string }) {
  return <Link to={to} className="group rounded-2xl border border-white/8 bg-black/15 p-4 transition hover:border-violet-400/20 hover:bg-violet-500/[0.035]"><Icon className="h-4 w-4 text-cyan-300" /><strong className="mt-3 block text-xs text-slate-200 group-hover:text-white">{title}</strong><span className="mt-1 block text-[10px] text-slate-500">{detail}</span></Link>
}
