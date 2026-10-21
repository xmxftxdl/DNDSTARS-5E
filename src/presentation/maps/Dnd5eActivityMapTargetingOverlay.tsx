import { Sparkles } from 'lucide-react'
import type { Dnd5eActivityMapTargetingSession } from './useDnd5eActivityMapTargeting'

export default function Dnd5eActivityMapTargetingOverlay(props: {
  session: Dnd5eActivityMapTargetingSession
  onCancel: () => void
  onFinishCells?: () => void
}) {
  const { session } = props
  const prompt = session.minimumCells != null
    ? `${session.label}：点击地图格子选择，再次点击取消，已选 ${session.selectedCells.length} 格。`
    : session.kind === 'area'
    ? `为“${session.label}”选择范围落点${session.template.shape === 'rect' && session.template.rotatable ? '（Q/E 旋转模板）' : ''}。`
    : session.kind === 'summon'
      ? `为“${session.label}”选择召唤位置（${session.selectedCells.length}/${session.requiredCells}）。`
      : session.kind === 'surface'
      ? `为“${session.label}”点击高亮的结构表面。`
      : `为“${session.label}”选择移动终点（${session.selectedCells.length}/${session.requiredCells}）。`

  return <div
    data-testid="dnd5e-activity-map-targeting-overlay"
    aria-live="polite"
    className="map-combat-action-bar border-violet-400/40"
  >
    <Sparkles className="h-4 w-4 shrink-0 text-violet-300" />
    <span className="text-violet-100">{prompt}</span>
    {session.minimumCells != null && <button type="button" onClick={props.onFinishCells}
      disabled={session.selectedCells.length < session.minimumCells}
      className="rounded-lg bg-violet-600 px-3 py-1 text-xs text-white disabled:opacity-40">完成选择</button>}
    <button
      type="button"
      onClick={props.onCancel}
      className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
    >
      取消本次 Activity
    </button>
  </div>
}
