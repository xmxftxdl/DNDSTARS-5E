import { useCallback, useEffect, useRef, useState } from 'react'
import type { BattleMap } from '../../store/maps'
import { getImage } from '../../lib/imageStore'
import type { Dnd5eRemoteSensorLocation } from '../../rulesets/dnd5e/remoteSensorPlacement'

interface Request { title: string; maps: readonly BattleMap[]; initialMapId: string }
function LocationDialog({ request, finish }: { request: Request; finish: (location?: Dnd5eRemoteSensorLocation) => void }) {
  const [mapId, setMapId] = useState(request.initialMapId)
  const [cell, setCell] = useState<{ col: number; row: number }>()
  const [height, setHeight] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [imageUrl, setImageUrl] = useState<string>()
  const map = request.maps.find(entry => entry.id === mapId)
  useEffect(() => {
    let disposed = false, url: string | undefined
    setImageUrl(undefined)
    void getImage(mapId).then(blob => {
      if (!blob || disposed) return
      url = URL.createObjectURL(blob); setImageUrl(url)
    }).catch(() => undefined)
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [mapId])
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') finish() }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [finish])
  return <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={request.title}>
    <div className="w-full max-w-4xl rounded-xl border border-purple-500/40 bg-slate-950 p-4 text-slate-100 shadow-2xl">
      <h2 className="text-lg font-semibold">{request.title}</h2>
      <p className="my-2 text-sm text-slate-400">依据施法者指定的地点，在地图上点选位置，再确认生前记忆。这里只显示同位面的地图；其他地图请先设置位面。</p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label>地图 <select aria-label="地图" autoFocus value={mapId} onChange={event => { setMapId(event.target.value); setCell(undefined); setZoom(1) }} className="rounded bg-slate-800 p-2">
          {request.maps.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select></label>
        <label>高度（尺） <input aria-label="传感器高度（尺）" type="number" min={-1000} max={10000} value={height} onChange={event => setHeight(Number(event.target.value))} className="w-24 rounded bg-slate-800 p-2" /></label>
        <label>缩放 <select value={zoom} onChange={event => setZoom(Number(event.target.value))} className="rounded bg-slate-800 p-2">
          {[1, 2, 4].map(value => <option key={value} value={value}>{value}×</option>)}
        </select></label>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded border border-slate-700 bg-slate-900">
        {map && <svg viewBox={`0 0 ${map.width} ${map.height}`} style={{ width: `${zoom * 100}%`, height: 'auto', display: 'block', cursor: 'crosshair' }}
          role="img" aria-label="点击地图选择传感器位置" onClick={event => {
            const box = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - box.left) / box.width * map.width
            const y = (event.clientY - box.top) / box.height * map.height
            setCell({ col: Math.floor((x - map.gridOffsetX) / map.gridSize), row: Math.floor((y - map.gridOffsetY) / map.gridSize) })
          }}>
          <rect width={map.width} height={map.height} fill="#172033" />
          {imageUrl && <image href={imageUrl} width={map.width} height={map.height} preserveAspectRatio="none" />}
          <defs><pattern id="remote-sensor-grid" width={map.gridSize} height={map.gridSize} x={map.gridOffsetX} y={map.gridOffsetY} patternUnits="userSpaceOnUse">
            <path d={`M ${map.gridSize} 0 L 0 0 0 ${map.gridSize}`} fill="none" stroke="#cbd5e1" strokeOpacity="0.4" strokeWidth={Math.max(1, map.gridSize / 60)} />
          </pattern></defs>
          <rect width={map.width} height={map.height} fill="url(#remote-sensor-grid)" />
          {cell && <rect x={map.gridOffsetX + cell.col * map.gridSize} y={map.gridOffsetY + cell.row * map.gridSize} width={map.gridSize} height={map.gridSize}
            fill="#a78bfa66" stroke="#e9d5ff" strokeWidth={Math.max(2, map.gridSize / 15)} />}
        </svg>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">{cell ? `已标出位置：${cell.col}, ${cell.row}` : '请在地图上点选位置'}</span>
        <div className="flex gap-2"><button type="button" onClick={() => finish()} className="rounded bg-slate-800 px-4 py-2">取消</button>
          <button type="button" disabled={!map || !cell || !Number.isFinite(height) || height < -1000 || height > 10000} className="rounded bg-purple-600 px-4 py-2 disabled:opacity-40"
            onClick={() => { if (map && cell) finish({ mapId: map.id, ...cell, elevationFeet: height }) }}>选择此处</button></div>
      </div>
    </div>
  </div>
}

export function useRemoteSensorLocationDialog() {
  const [request, setRequest] = useState<Request & { id: number }>()
  const sequence = useRef(0)
  const pending = useRef<((location?: Dnd5eRemoteSensorLocation) => void) | undefined>(undefined)
  const finish = useCallback((location?: Dnd5eRemoteSensorLocation) => { const resolve = pending.current; pending.current = undefined; setRequest(undefined); resolve?.(location) }, [])
  useEffect(() => () => { pending.current?.(); pending.current = undefined }, [])
  const choose = useCallback((next: Request) => new Promise<Dnd5eRemoteSensorLocation | undefined>(resolve => {
    pending.current?.(); pending.current = resolve; setRequest({ ...next, id: ++sequence.current })
  }), [])
  return { choose, dialog: request ? <LocationDialog key={request.id} request={request} finish={finish} /> : null }
}
