import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { usePersistentAreaPanelAnchor } from './usePersistentAreaPanelAnchor'

export default function IllusionInvestigationPanel({ map, area, actors, pending, onInvestigate, onClose }: {
  map: BattleMap; area: Dnd5ePluginArea; actors: readonly Token[]; pending?: boolean;
  onInvestigate: (tokenId: string) => void; onClose: () => void
}) {
  const ref = usePersistentAreaPanelAnchor(area, map)
  return <div ref={ref} className="absolute z-[90] rounded-xl border border-violet-300/40 bg-slate-950/95 p-3 text-sm text-slate-100" data-testid="illusion-investigation-panel">
    <div className="flex items-center justify-between gap-4"><strong>{area.label}</strong><button type="button" onClick={onClose} aria-label="关闭调查面板">×</button></div>
    <p className="my-2 text-xs text-slate-300">消耗动作进行智力（调查）检定，尝试识破这个幻象。</p>
    <div className="flex flex-wrap gap-2">{actors.map(actor => {
      const known = area.illusionRecognition?.knownTokenIds.includes(actor.id)
      return <button key={actor.id} type="button" className="rounded bg-violet-700/70 px-3 py-2 disabled:opacity-50" disabled={pending || known} onClick={() => onInvestigate(actor.id)}>{actor.label} · {known ? '已识破' : '调查幻象'}</button>
    })}</div>
    {!actors.length && <p>当前没有可控制的角色。</p>}
  </div>
}
