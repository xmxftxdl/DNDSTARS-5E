import { useState } from 'react'
import { setRoomCharacterSpellSlot } from '../../store/roomCommands'
import type { Character } from '../../types/character'
import { editableSpellSlotResources, type EditableSpellSlotResource } from './spellSlotResourceEditorModel'

function SpellSlotCounter({
  characterId,
  resource,
}: {
  characterId: string
  resource: EditableSpellSlotResource
}) {
  const [draft, setDraft] = useState(String(resource.current))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const commit = async (requested: number) => {
    const current = Math.min(resource.max, Math.max(0, Math.floor(requested)))
    setDraft(String(current))
    if (current === resource.current) return
    setPending(true)
    setMessage('')
    try {
      const result = await setRoomCharacterSpellSlot({
        characterId,
        resourceKey: resource.key,
        current,
      })
      if (result.status === 'rejected') {
        setDraft(String(resource.current))
        setMessage(result.message ?? '法术位修改被拒绝。')
      }
    } catch {
      setDraft(String(resource.current))
      setMessage('法术位保存失败，请重试。')
    } finally {
      setPending(false)
    }
  }

  return <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 px-3 py-2" data-spell-slot-resource={resource.key}>
    <div className="text-[11px] text-slate-500">{resource.label}</div>
    <div className="mt-1 flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending || resource.current <= 0}
        onClick={() => void commit(resource.current - 1)}
        aria-label={`${resource.label}减少 1`}
        className="h-7 w-7 rounded-lg border border-white/10 bg-black/20 text-sm font-bold text-violet-100 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-35"
      >−</button>
      <input
        type="number"
        min={0}
        max={resource.max}
        value={draft}
        disabled={pending}
        aria-label={`${resource.label}当前数量`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(Number(draft) || 0)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="h-7 w-12 rounded-lg border border-white/10 bg-void-950/80 px-1 text-center text-sm font-bold tabular-nums text-violet-100 outline-none focus:border-violet-300/50"
      />
      <span className="text-xs font-semibold tabular-nums text-slate-500">/ {resource.max}</span>
      <button
        type="button"
        disabled={pending || resource.current >= resource.max}
        onClick={() => void commit(resource.current + 1)}
        aria-label={`${resource.label}增加 1`}
        className="ml-auto h-7 w-7 rounded-lg border border-white/10 bg-black/20 text-sm font-bold text-violet-100 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-35"
      >+</button>
    </div>
    {message ? <p role="alert" className="mt-1 text-[10px] leading-4 text-rose-300">{message}</p> : null}
  </div>
}

export default function SpellSlotResourceEditor({
  character,
  compact = false,
}: {
  character: Character
  compact?: boolean
}) {
  const resources = editableSpellSlotResources(character)
  if (resources.length === 0) return null

  return <section className={compact ? '' : 'glass rounded-2xl border border-violet-300/15 p-4'} data-testid="spell-slot-resource-editor">
    {!compact ? <div className="mb-3">
      <h3 className="text-sm font-semibold text-violet-100">当前法术位</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">角色本人和 DM 可以修正当前剩余数量；上限仍由职业等级与规则自动计算。</p>
    </div> : null}
    <div className="grid gap-2 sm:grid-cols-2">
      {resources.map((resource) => (
        <SpellSlotCounter
          key={`${resource.key}:${resource.current}:${resource.max}`}
          characterId={character.id}
          resource={resource}
        />
      ))}
    </div>
  </section>
}
