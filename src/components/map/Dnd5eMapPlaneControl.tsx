import { useEffect, useState } from 'react'
import { normalizeDnd5eMapPlane } from '../../rulesets/dnd5e/mapPlane'

export default function Dnd5eMapPlaneControl({ mapId, value, onChange, etherealAdjacent, onEtherealAdjacentChange }: {
  mapId: string; value?: string; onChange: (plane: string | undefined) => void
  etherealAdjacent?: boolean; onEtherealAdjacentChange?: (value: boolean | undefined) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [mapId, value])
  const commit = () => {
    const normalized = normalizeDnd5eMapPlane(draft)
    setDraft(normalized ?? '')
    if (normalized !== value) onChange(normalized)
  }
  return <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
    <label className="flex items-center gap-1"
    title="属于同一位面的地图请填写相同名称；留空表示位面尚未确定。">
    位面
    <input aria-label="地图所属位面" value={draft} maxLength={120} placeholder="未设置"
      className="w-28 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-xs"
      onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} />
    </label>
    {onEtherealAdjacentChange && <label className="flex items-center gap-1">
      以太相邻
      <select aria-label="地图是否与以太相邻" value={etherealAdjacent == null ? 'auto' : etherealAdjacent ? 'yes' : 'no'}
        title="自动仅识别主物质位面；其他位面请按房间设定选择。以太位面自身不能再次进入以太。"
        className="rounded border border-white/10 bg-black/20 px-1 py-0.5 text-xs"
        onChange={event => onEtherealAdjacentChange(event.target.value === 'auto' ? undefined : event.target.value === 'yes')}>
        <option value="auto">自动 / 未确定</option><option value="yes">相邻</option><option value="no">不相邻</option>
      </select>
    </label>}
  </div>
}
