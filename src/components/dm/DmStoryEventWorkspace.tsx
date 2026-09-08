import { CirclePlus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { AccountCampaignPrepPlanDraftV1 } from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2, PdfSourceCitationV2 } from '../../lib/pdfCampaignAnalysisV2'
import { synchronizeStoryWorkspace } from './dmCampaignStoryModel'
import DmStoryFlowGraph, { type DmStoryFlowGraphHandle } from './DmStoryFlowGraph'

export default function DmStoryEventWorkspace({ analysis, plan, onPlanChange, onOpenSourceWorkspace }: {
  analysis: PdfCampaignAnalysisV2
  plan: AccountCampaignPrepPlanDraftV1
  onPlanChange: (update: AccountCampaignPrepPlanDraftV1 | ((current: AccountCampaignPrepPlanDraftV1) => AccountCampaignPrepPlanDraftV1)) => void
  onOpenSourceWorkspace?: (citation: PdfSourceCitationV2) => void
}) {
  const workspace = useMemo(
    () => synchronizeStoryWorkspace(plan.storyWorkspace, analysis),
    [analysis, plan.storyWorkspace],
  )
  const planWorkspaceSnapshot = JSON.stringify(plan.storyWorkspace)
  const synchronizedWorkspaceSnapshot = JSON.stringify(workspace)
  const flowGraphRef = useRef<DmStoryFlowGraphHandle | null>(null)
  const commitWorkspace = (nextWorkspace: typeof workspace) => onPlanChange((current) => ({
    ...current,
    storyWorkspace: nextWorkspace,
  }))

  useEffect(() => {
    if (planWorkspaceSnapshot === synchronizedWorkspaceSnapshot) return
    // Rebase automatic analysis synchronization onto the newest parent draft. A queued
    // synchronization effect must never restore the render-time plan and erase a DM node
    // that was added between paint and this effect running.
    onPlanChange((current) => {
      const synchronized = synchronizeStoryWorkspace(current.storyWorkspace, analysis)
      return JSON.stringify(current.storyWorkspace) === JSON.stringify(synchronized)
        ? current
        : { ...current, storyWorkspace: synchronized }
    })
  }, [analysis, onPlanChange, planWorkspaceSnapshot, synchronizedWorkspaceSnapshot])

  return (
    <div className="space-y-4" data-testid="dm-story-event-workspace" data-story-contrast-surface="true">
      <section className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">剧情主线</h2>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">默认只看关键事件；点击节点查看完整内容、关联场景与 PDF 原文书签。</p>
          </div>
          <button type="button" onClick={() => flowGraphRef.current?.addEvent()} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-100 hover:bg-violet-500/20"><CirclePlus className="h-3.5 w-3.5" />添加事件</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-slate-500">
          <span className="rounded-full border border-white/8 px-2 py-1">{workspace.events.length} 个统一事件</span>
          <span className="rounded-full border border-white/8 px-2 py-1">关联 {new Set(workspace.events.flatMap((event) => event.sceneIds)).size} 个可运行场景</span>
          <span className="rounded-full border border-white/8 px-2 py-1">条件分支 {(workspace.graphLinks ?? []).filter((link) => link.condition && link.condition.kind !== 'always').length}</span>
        </div>
      </section>

      <DmStoryFlowGraph ref={flowGraphRef} workspace={workspace} analysis={analysis} onChange={commitWorkspace} onOpenSourceWorkspace={onOpenSourceWorkspace} />
    </div>
  )
}
