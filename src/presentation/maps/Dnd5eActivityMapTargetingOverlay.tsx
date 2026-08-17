import { Sparkles } from 'lucide-react'
import type { Dnd5eActivityMapTargetingSession } from './useDnd5eActivityMapTargeting'

export default function Dnd5eActivityMapTargetingOverlay(props: {
  session: Dnd5eActivityMapTargetingSession
  onCancel: () => void
}) {
  const { session } = props
  const prompt = session.kind === 'area'
    ? `为“${session.label}”选择范围落点${session.template.shape === 'rect' && session.template.rotatable ? '（Q/E 旋转模板）' : ''}。`
    : session.kind === 'summon'
      ? `为“${session.label}”选择召唤位置（${session.selectedCells.length}/${session.requiredCells}）。`
      : `为“${session.label}”选择移动终点（${session.selectedCells.length}/${session.requiredCells}）。`

  return <div
    data-testid="dnd5e-activity-map-targeting-overlay"
    aria-live="polite"
    className="absolute left-1/2 top-14 z-[114] flex max-w-[min(94vw,920px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-void-950/95 px-3 py-2 text-sm shadow-2xl backdrop-blur-sm"
  >
    <Sparkles className="h-4 w-4 shrink-0 text-violet-300" />
    <span className="text-violet-100">{prompt}</span>
    <button
      type="button"
      onClick={props.onCancel}
      className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
    >
      取消本次 Activity
    </button>
  </div>
}
