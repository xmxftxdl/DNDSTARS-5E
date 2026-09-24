import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Character } from '../../types/character'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { ropeTrickEffect, ropeTrickMovementBlock } from '../../rulesets/dnd5e/ropeTrick'
import { usePersistentAreaPanelAnchor } from '../../components/map/usePersistentAreaPanelAnchor'

export function RopeTrickPanel({ area, map, actors, characters, onInteract, onClose }: {
  area: Dnd5ePluginArea; map: BattleMap; actors: readonly Character[]; characters: readonly Character[];
  onInteract: (characterId: string, transition: 'enter' | 'leave') => Promise<void>;
  onClose: () => void;
}) {
  const [actorId, setActorId] = useState(actors[0]?.id ?? '')
  const [pending, setPending] = useState(false)
  const anchorRef = usePersistentAreaPanelAnchor(area, map)
  const actor = actors.find((entry) => entry.id === actorId)
  const inside = actor && ropeTrickEffect(actor, area.id)
  const token = map.tokens.find((entry) => entry.characterId === actor?.id)
  const movementBlock = actor && token ? ropeTrickMovementBlock(actor, token) : undefined
  const occupants = characters.filter((entry) => ropeTrickEffect(entry, area.id))
  return createPortal(<div ref={anchorRef} role="dialog" aria-label="魔绳术入口" style={{ zIndex: 2147483000 }} className="fixed w-80 overflow-y-auto rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-sm text-slate-100 shadow-xl">
    <div className="flex justify-between"><strong>魔绳术 · 绳子入口</strong><button aria-label="关闭魔绳术入口" onClick={onClose}>×</button></div>
    <p className="my-3">异次元空间 {occupants.length}/8 · 中型或更小</p>
    <p className="mb-3 text-slate-400">{occupants.map((entry) => entry.name).join('、') || '空间内暂无生物'}</p>
    <select aria-label="与绳子互动的角色" value={actorId} onChange={(event) => setActorId(event.target.value)} className="w-full rounded bg-slate-800 p-2">
      {actors.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
    <button disabled={!actor || !token || pending || !!movementBlock} className="mt-3 w-full rounded bg-teal-800 p-2 disabled:opacity-40" onClick={async () => {
      setPending(true)
      try { await onInteract(actorId, inside ? 'leave' : 'enter') } finally { setPending(false) }
    }}>{inside ? '离开异次元空间' : '沿绳子进入异次元空间'}</button>
    {movementBlock && <p role="status" className="mt-2 text-xs text-amber-200">{movementBlock}</p>}
    <p className="mt-3 text-xs text-slate-400">靠近绳子后进入；攻击和法术无法穿过入口。法术结束时移除空间状态。</p>
  </div>, document.body)
}
