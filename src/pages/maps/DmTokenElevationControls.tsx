import { useRef, useState } from 'react'
import type { BattleMap, Token } from '../../store/maps'
import { mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import type { Character } from '../../types/character'
import { dmTokenElevationPermission, resolveDmTokenElevation } from './dmTokenElevation'

export default function DmTokenElevationControls({ map, geometry, token, onChange }: {
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  characters: readonly Character[]
  onChange: (elevationFeet: number) => Promise<void>
}) {
  const permission = dmTokenElevationPermission()
  const ground = mapGeometryTerrainElevationAtPoint(geometry, token)
  const current = mapGeometryTokenElevation(geometry, token) - ground
  const [draft, setDraft] = useState(String(current))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  async function apply(height: number) {
    if (savingRef.current) return
    try {
      const elevation = resolveDmTokenElevation(map, geometry, token, height, permission)
      savingRef.current = true
      setSaving(true)
      await onChange(elevation)
      setDraft(String(height))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '高度设置失败。')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  return <section className="my-4 space-y-2 rounded-xl border border-sky-400/25 bg-sky-950/30 p-3" aria-label="DM 高度设置">
    <div className="flex items-center justify-between text-xs"><strong className="text-sky-100">离地高度（尺）</strong></div>
    <fieldset disabled={!permission.allowed || saving} className="space-y-2 disabled:opacity-50">
    <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); apply(draft.trim() ? Number(draft) : NaN) }}>
      <label className="min-w-0 flex-1 text-xs text-slate-300"><input aria-label="DM 离地高度" type="number" min="0" max={10000 - ground} step="any" value={draft} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-slate-100" /></label>
      <button type="submit" className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs text-white">{saving ? '保存中…' : '设置高度'}</button>
    </form>
    <div className="flex gap-2 text-xs text-slate-200">{[['降低 5 尺', Math.max(0, current - 5)], ['升高 5 尺', current + 5], ['落地', 0]].map(([label, height]) => <button key={label} type="button" className="rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10" onClick={() => apply(Number(height))}>{label}</button>)}</div>
    </fieldset>
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
  </section>
}
