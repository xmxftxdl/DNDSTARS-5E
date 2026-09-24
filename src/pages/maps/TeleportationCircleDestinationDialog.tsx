import { useEffect, useState } from 'react'
import type { BattleMap } from '../../store/maps'
import { getImage } from '../../lib/imageStore'
import { pixelToCell, tokenCenterForAnchorCell } from '../../lib/gridCombat'
import type { TeleportationCircleExit } from '../../rulesets/dnd5e/teleportationCircle'

export function TeleportationCircleDestinationDialog({ maps, onDone }: {
  maps: readonly BattleMap[]; onDone: (exit: TeleportationCircleExit | null) => void
}) {
  const [mapId, setMapId] = useState(maps[0]?.id ?? '')
  const [point, setPoint] = useState<{ x: number; y: number }>()
  const [image, setImage] = useState<{ mapId: string; url: string }>()
  const map = maps.find(entry => entry.id === mapId)
  useEffect(() => {
    let cancelled = false, url = ''
    void getImage(mapId).then(blob => {
      if (cancelled || !blob) return
      url = URL.createObjectURL(blob); setImage({ mapId, url })
    }).catch(() => undefined)
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [mapId])
  return <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70">
    <section role="dialog" aria-modal="true" aria-label="传送法阵出口" className="w-[760px] max-w-[95vw] rounded-xl border border-cyan-500/40 bg-[#10131c] p-5 text-slate-100">
      <h2 className="font-bold text-cyan-200">传送法阵 · 指定出口</h2>
      <p className="my-2 text-sm text-slate-400">选择同一位面的目标地图，点击预览放置出口。此预览不会切换玩家地图。</p>
      <select aria-label="出口地图" className="mb-3 w-full rounded bg-slate-800 p-2" value={mapId} onChange={event => { setMapId(event.target.value); setPoint(undefined) }}>
        {maps.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
      {map && <svg aria-label="点击地图指定出口" viewBox={`0 0 ${map.width} ${map.height}`} className="max-h-[60vh] w-full cursor-crosshair bg-slate-900" style={{ aspectRatio: `${map.width}/${map.height}` }} onClick={event => {
        const svg = event.currentTarget, matrix = svg.getScreenCTM()
        if (!matrix) return
        const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        if (p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) return
        setPoint(tokenCenterForAnchorCell(pixelToCell(p.x, p.y, map), { size: 1 }, map))
      }}>
        {image?.mapId === map.id && <image href={image.url} width={map.width} height={map.height} />}
        {map.tokens.map(token => <g key={token.id}><circle cx={token.x} cy={token.y} r={map.gridSize * (token.size ?? 1) * .4} fill={token.color || '#64748b'} stroke="white" /><text x={token.x} y={token.y} textAnchor="middle" fontSize={map.gridSize * .28} fill="white">{token.label}</text></g>)}
        {point && <g><circle cx={point.x} cy={point.y} r={map.gridSize * 5 / (map.feetPerCell ?? 5)} fill="#22d3ee33" stroke="#67e8f9" strokeWidth={3} /><text x={point.x} y={point.y} textAnchor="middle" fill="white" fontSize={map.gridSize * .5}>出口</text></g>}
      </svg>}
      <p className="mt-2 text-xs text-slate-400">角色抵达时自动分配附近空位，避开占位与障碍。</p>
      <div className="mt-4 flex justify-end gap-3"><button onClick={() => onDone(null)}>取消</button><button disabled={!map || !point} className="rounded bg-cyan-800 px-4 py-2 disabled:opacity-40" onClick={() => { if (map && point) onDone({ mapId: map.id, ...point }) }}>确认出口</button></div>
    </section>
  </div>
}
