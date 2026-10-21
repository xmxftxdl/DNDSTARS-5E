import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMapStore } from '../../store/maps'

export interface ObjectFlightArrivalSelection {
  sourceMapId: string
  destinationMapId: string
  receiptId: string
  point: { x: number; y: number; elevationFeet: number }
}

export default function ObjectFlightArrivalControl({ onResolve }: {
  onResolve: (selection: ObjectFlightArrivalSelection) => Promise<void>
}) {
  const maps = useMapStore(state => state.maps)
  const selectedId = useMapStore(state => state.selectedId)
  const pending = maps.flatMap(map => (map.dnd5eObjectFlightDepartures ?? [])
    .filter(receipt => receipt.status === 'pending').map(receipt => ({ map, receipt })))
  const [open, setOpen] = useState(false)
  const [receiptId, setReceiptId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [point, setPoint] = useState<{ x: number; y: number; elevationFeet: number }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const flight = pending.find(row => row.receipt.id === receiptId)
  const destination = maps.find(map => map.id === destinationId)
  if (!pending.length && !open) return null
  const resolve = async () => {
    if (!flight || !destination || !point || busy) return
    setBusy(true); setError('')
    try {
      await onResolve({ sourceMapId: flight.map.id, destinationMapId: destination.id, receiptId, point })
      setOpen(false); setPoint(undefined)
    } catch (cause) {
      setError(`未完成结算：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally { setBusy(false) }
  }
  return <>
    <button type="button" className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs text-amber-200"
      onClick={() => { setReceiptId(pending[0]?.receipt.id ?? ''); setDestinationId(selectedId ?? maps[0]?.id ?? '');
        setPoint(undefined); setError(''); setOpen(true) }}>
      恢复物件飞行 · {pending.length}
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/75 p-4">
      <section role="dialog" aria-modal="true" aria-label="恢复物件飞行" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/15 bg-slate-950 p-5 text-sm text-slate-200">
        <h2 className="font-bold">恢复物件飞行</h2>
        <p className="mt-2 text-xs text-slate-400">选择物件进入的地图，在位置示意图上点击到达点。后续沿原方向继续飞行；不再次消耗施法资源。</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label>待恢复物件 <select aria-label="待恢复物件" disabled={busy} value={receiptId}
            onChange={event => { setReceiptId(event.target.value); setPoint(undefined) }} className="rounded bg-slate-800 p-2">
            {pending.map(row => <option key={row.receipt.id} value={row.receipt.id}>{row.receipt.object.label} · {row.map.name} · 剩余 {Math.round(row.receipt.remainingFeet * 10) / 10} 尺</option>)}
          </select></label>
          <label>目的地图 <select aria-label="目的地图" disabled={busy} value={destinationId}
            onChange={event => { setDestinationId(event.target.value); setPoint(undefined) }} className="rounded bg-slate-800 p-2">
            {maps.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
          </select></label>
        </div>
        {destination && <svg aria-label="点击选择飞行到达点" viewBox={`0 0 ${destination.width} ${destination.height}`}
          className="mt-4 max-h-[45vh] w-full border border-white/15 bg-slate-900" style={{ aspectRatio: `${destination.width}/${destination.height}` }}
          onClick={event => {
            if (busy) return
            const svg = event.currentTarget, matrix = svg.getScreenCTM()
            if (!matrix) return
            const cursor = svg.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY
            const local = cursor.matrixTransform(matrix.inverse())
            if (local.x < 0 || local.y < 0 || local.x >= destination.width || local.y >= destination.height) return
            setPoint({ x: local.x, y: local.y, elevationFeet: point?.elevationFeet ?? flight?.receipt.departure.elevationFeet ?? 0 })
          }}>
          <defs><pattern id="object-flight-arrival-grid" width={destination.gridSize} height={destination.gridSize} patternUnits="userSpaceOnUse"
            x={destination.gridOffsetX} y={destination.gridOffsetY}><path d={`M ${destination.gridSize} 0 L 0 0 0 ${destination.gridSize}`} fill="none" stroke="#475569" strokeWidth="1" /></pattern></defs>
          <rect width={destination.width} height={destination.height} fill="url(#object-flight-arrival-grid)" />
          {destination.tokens.map(token => <g key={token.id}>
            <circle cx={token.x} cy={token.y} r={Math.max(5, destination.gridSize * token.size / 3)} fill={token.color || '#7c3aed'} stroke="#e2e8f0" />
            <text x={token.x} y={token.y - destination.gridSize / 2} textAnchor="middle" fill="#e2e8f0" fontSize={Math.max(10, destination.gridSize / 3)}>{token.label}</text>
          </g>)}
          {point && <g><circle cx={point.x} cy={point.y} r={destination.gridSize / 3} fill="#fbbf24" fillOpacity=".25" stroke="#fbbf24" strokeWidth="3" />
            <path d={`M ${point.x - 10} ${point.y} h20 M ${point.x} ${point.y - 10} v20`} stroke="#fbbf24" strokeWidth="2" /></g>}
        </svg>}
        {point && <label className="mt-3 flex items-center gap-2">到达高度（尺）<input aria-label="到达高度（尺）" type="number" value={point.elevationFeet} disabled={busy}
          onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) setPoint({ ...point, elevationFeet: value }) }}
          className="w-24 rounded bg-slate-800 p-2" /></label>}
        {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>取消</button>
          <button type="button" disabled={busy || !flight || !destination || !point} onClick={() => void resolve()}
            className="rounded bg-violet-600 px-4 py-2 disabled:opacity-40">{busy ? '正在结算…' : '继续飞行并结算'}</button>
        </div>
      </section>
    </div>, document.body)}
  </>
}
