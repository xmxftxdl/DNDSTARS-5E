import { useState } from 'react'
import type { BattleMap } from '../../store/maps'

/** Public availability never includes the expected password or its digest. */
export function DruidGrovePasswordPanel({ map, isDM = false, onSpeak }: {
  map: BattleMap; isDM?: boolean; onSpeak: (areaId: string, phrase: string, actorId?: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [areaId, setAreaId] = useState('')
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [actorId, setActorId] = useState('')
  const actors = map.tokens.filter(t => t.type !== 'obstacle')
  const available = (area: NonNullable<BattleMap['dnd5ePluginAreas']>[number]) => area.grovePasswordAvailable || (isDM && !!area.grovePasswordDigest)
  const renderedAreas = (map.dnd5ePluginAreas ?? []).filter((area, index, all) => available(area) && area.effectGroup &&
    all.findIndex(other => available(other) && other.effectGroup?.castId === area.effectGroup?.castId &&
      other.pluginId === area.pluginId && other.sourceTokenId === area.sourceTokenId) === index)
  const areas = isDM ? renderedAreas : map.dnd5eGrovePasswordPrompts?.length
    ? map.dnd5eGrovePasswordPrompts.map(prompt => ({ id: prompt.areaId, sourceTokenId: prompt.sourceTokenId })) : renderedAreas
  if (!areas.length) return null
  const selected = areas.find(area => area.id === areaId) ?? areas[0]
  return <div className="absolute bottom-56 left-3 z-50 max-h-[calc(100%-15rem)] overflow-y-auto rounded-xl border border-emerald-700 bg-slate-950/95 p-3 text-sm text-slate-100">
    <button type="button" onClick={() => { setOpen(!open); setPhrase(''); setError('') }}>林地口令{open ? ' · 收起' : ''}</button>
    {open && <form className="mt-2 flex flex-col gap-2" onSubmit={async event => {
      event.preventDefault()
      if (busy || !phrase.trim()) return
      setBusy(true); setError('')
      try { await onSpeak(selected.id, phrase, isDM ? actors.find(t => t.id === actorId)?.id ?? actors[0]?.id : undefined); setPhrase(''); setOpen(false) }
      catch (cause) { setError(cause instanceof Error ? cause.message : '口令提交失败') }
      finally { setBusy(false) }
    }}>
      {isDM && <select aria-label="说出口令的生物" value={actors.find(t => t.id === actorId)?.id ?? actors[0]?.id ?? ''} onChange={event => setActorId(event.target.value)} className="bg-slate-900">
        {actors.map(actor => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
      </select>}
      {areas.length > 1 && <select aria-label="选择林地" value={selected.id} onChange={event => setAreaId(event.target.value)} className="bg-slate-900">
        {areas.map((area, index) => <option key={area.id} value={area.id}>林地 {index + 1} · {map.tokens.find(t => t.id === area.sourceTokenId)?.label ?? '施法者'}</option>)}
      </select>}
      <input aria-label="林地口令" value={phrase} maxLength={120} onChange={event => setPhrase(event.target.value)} placeholder="说出口令" className="rounded border border-slate-600 bg-slate-900 px-2 py-1" />
      <button type="submit" disabled={busy || !phrase.trim() || (isDM && !actors.length)} className="rounded bg-emerald-800 px-2 py-1 disabled:opacity-50">{busy ? '提交中' : '说出口令'}</button>
      {error && <p role="alert" className="max-w-64 text-rose-300">{error}</p>}
    </form>}
  </div>
}
