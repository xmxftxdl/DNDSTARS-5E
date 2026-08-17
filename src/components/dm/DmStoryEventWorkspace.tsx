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
      <section className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">剧情主线</h2>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">默认只看关键事件；点击节点查看完整内容、关联场景与 PDF 原文书签。</p>
          </div>
          <button type="button" onClick={() => {
            const next = createDmStoryEvent()
            const lastY = Math.max(-176, ...workspace.events.map((event) => event.graphPosition?.y ?? -176))
            commitWorkspace({ ...workspace, events: [...workspace.events, { ...next, graphPosition: { x: 420, y: lastY + 232 } }] })
          }} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-100 hover:bg-violet-500/20"><CirclePlus className="h-3.5 w-3.5" />添加事件</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-slate-500">
          <span className="rounded-full border border-white/8 px-2 py-1">{workspace.events.length} 个统一事件</span>
          <span className="rounded-full border border-white/8 px-2 py-1">关联 {new Set(workspace.events.flatMap((event) => event.sceneIds)).size} 个可运行场景</span>
          <span className="rounded-full border border-white/8 px-2 py-1">条件分支 {(workspace.graphLinks ?? []).filter((link) => link.condition && link.condition.kind !== 'always').length}</span>
        </div>
      </section>

      <DmStoryFlowGraph workspace={workspace} analysis={analysis} onChange={commitWorkspace} />
    </div>
  )
}
