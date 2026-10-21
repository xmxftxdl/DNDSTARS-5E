import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { usePersistentAreaPanelAnchor } from './usePersistentAreaPanelAnchor'

export default function TerrainClearingPanel({ map, area, actors, combatActive, onStart, onClose }: {
  map: BattleMap; area: Dnd5ePluginArea; actors: readonly Token[]; combatActive: boolean;
  onStart: (actorTokenId: string) => void; onClose: () => void
}) {
  const ref = usePersistentAreaPanelAnchor(area, map)
  const feet = map.feetPerCell ?? 5
  const minutes = Math.max(1, Math.ceil(feet * feet / (area.terrainClearing?.squareFeetPerMinute ?? 25)))
  return <div ref={ref} className="absolute z-[90] overflow-y-auto rounded-xl border border-amber-300/40 bg-slate-950/95 p-3 text-sm text-slate-100" data-testid="terrain-clearing-panel">
    <div className="flex items-center justify-between gap-4"><strong>{area.label}</strong><button type="button" onClick={onClose} aria-label="关闭清理面板">×</button></div>
    <p className="my-2 text-xs text-slate-300">选择角色，再点击地图高亮格清理。每格 {feet} × {feet} 尺。
      {combatActive ? `每轮消耗一个动作推进一次，共需 ${Math.max(1, Math.ceil(feet * feet * 10 / (area.terrainClearing?.squareFeetPerMinute ?? 25)))} 轮工作；进度会保留。` : `至少耗时 ${minutes} 分钟；已有进度会抵扣，完成时推进队伍时间。`}</p>
    <div className="flex flex-wrap gap-2">{actors.map(actor =>
      <button key={actor.id} type="button" className="rounded bg-amber-700/70 px-3 py-2" onClick={() => onStart(actor.id)}>{actor.label} · 清理碎石</button>)}</div>
    {!!area.terrainClearingProgress?.length && <p className="mt-2 text-xs">已有 {area.terrainClearingProgress.length} 格正在清理，累计投入 {area.terrainClearingProgress.reduce((sum, p) => sum + p.workedRounds, 0)} 轮。</p>}
    {!actors.length && <p>当前没有可控制的角色。</p>}
  </div>
}
