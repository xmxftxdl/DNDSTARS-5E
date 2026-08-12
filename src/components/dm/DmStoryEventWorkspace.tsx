import { CirclePlus } from 'lucide-react'
import { useEffect } from 'react'
import type { AccountCampaignPrepPlanDraftV1 } from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import { createDmStoryEvent, synchronizeStoryWorkspace } from './dmCampaignStoryModel'
import DmStoryFlowGraph from './DmStoryFlowGraph'

export default function DmStoryEventWorkspace({ analysis, plan, onPlanChange }: {
  analysis: PdfCampaignAnalysisV2
  plan: AccountCampaignPrepPlanDraftV1
  onPlanChange: (plan: AccountCampaignPrepPlanDraftV1) => void
}) {
  const workspace = synchronizeStoryWorkspace(plan.storyWorkspace, analysis)
  const commitWorkspace = (nextWorkspace: typeof workspace) => onPlanChange({ ...plan, storyWorkspace: nextWorkspace })

  useEffect(() => {
    if (JSON.stringify(plan.storyWorkspace) === JSON.stringify(workspace)) return
    onPlanChange({ ...plan, storyWorkspace: workspace })
  }, [onPlanChange, plan, workspace])

  return (
    <div className="space-y-4" data-testid="dm-story-event-workspace">
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-cyan-500/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">StoryEvent V1</p>
            <h2 className="mt-2 text-xl font-bold text-slate-100">统一剧情事件</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">纵向流程图是唯一编辑入口。AI 只提供初始事件；DM 可以拖动节点、修订详情并用人物状态建立条件分支。</p>
          </div>
          <button type="button" onClick={() => {
            const next = createDmStoryEvent()
            const lastY = Math.max(-176, ...workspace.events.map((event) => event.graphPosition?.y ?? -176))
            commitWorkspace({ ...workspace, events: [...workspace.events, { ...next, graphPosition: { x: 420, y: lastY + 232 } }] })
          }} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400"><CirclePlus className="h-4 w-4" />添加事件</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <span className="rounded-full border border-white/8 px-2 py-1">{workspace.events.length} 个统一事件</span>
          <span className="rounded-full border border-white/8 px-2 py-1">关联 {new Set(workspace.events.flatMap((event) => event.sceneIds)).size} 个可运行场景</span>
          <span className="rounded-full border border-white/8 px-2 py-1">条件分支 {(workspace.graphLinks ?? []).filter((link) => link.condition && link.condition.kind !== 'always').length}</span>
        </div>
      </section>

      <DmStoryFlowGraph workspace={workspace} analysis={analysis} onChange={commitWorkspace} />
    </div>
  )
}
