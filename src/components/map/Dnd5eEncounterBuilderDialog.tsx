import { useMemo, useState } from 'react'
import { Minus, Plus, Search, Swords, X } from 'lucide-react'
import { searchEnemyPool, type EnemyTemplate } from '../../lib/enemyPool'
import {
  normalizeDnd5eEncounterEntries,
  summarizeDnd5eEncounter,
  type Dnd5eEncounterEntry,
} from '../../rulesets/dnd5e/encounterBuilder'

export default function Dnd5eEncounterBuilderDialog({
  open,
  pool,
  onClose,
  onConfirm,
}: {
  open: boolean
  pool: readonly EnemyTemplate[]
  onClose: () => void
  onConfirm: (entries: readonly Dnd5eEncounterEntry[]) => void
}) {
  const [query, setQuery] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const results = useMemo(() => searchEnemyPool(query, pool).slice(0, 80), [pool, query])
  const entries = useMemo(() => normalizeDnd5eEncounterEntries(
    pool.flatMap((template) => quantities[template.id] > 0
      ? [{ template, quantity: quantities[template.id] }]
      : []),
  ), [pool, quantities])
  const summary = useMemo(() => summarizeDnd5eEncounter(entries), [entries])

  if (!open) return null

  const changeQuantity = (template: EnemyTemplate, delta: number) => {
    setQuantities((current) => ({
      ...current,
      [template.id]: Math.max(0, Math.min(50, (current[template.id] ?? 0) + delta)),
    }))
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass flex max-h-[min(760px,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Swords className="h-5 w-5 text-rose-300" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-100">遭遇构建器</h2>
            <p className="text-xs text-slate-500">从 SRD 5.1 与房间怪物中编组；确认后由 DM 一次性写入地图。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col border-r border-white/10">
            <div className="relative border-b border-white/10 p-3">
              <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称、CR、类型或标签"
                className="w-full rounded-xl border border-white/10 bg-void-900/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-arcane-500"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {results.map((template) => {
                const quantity = quantities[template.id] ?? 0
                return (
                  <div key={template.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
                    <span className="text-xl">{template.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                        <span className="font-medium">{template.name}</span>
                        {template.challengeRating && <span className="text-xs text-amber-300">CR {template.challengeRating}</span>}
                        {template.experiencePoints != null && <span className="text-xs text-slate-500">{template.experiencePoints} XP</span>}
                      </div>
                      <p className="truncate text-xs text-slate-500">AC {template.armorClass ?? '—'} · HP {template.maxHp} · {template.tags.slice(0, 3).join(' · ')}</p>
                    </div>
                    <div className="flex items-center rounded-lg border border-white/10 bg-black/20">
                      <button type="button" aria-label={`减少${template.name}`} onClick={() => changeQuantity(template, -1)} className="p-2 text-slate-400 hover:text-white"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-7 text-center text-sm tabular-nums text-slate-100">{quantity}</span>
                      <button type="button" aria-label={`增加${template.name}`} onClick={() => changeQuantity(template, 1)} className="p-2 text-slate-400 hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-slate-200">当前编组</h3>
            <div className="mt-3 space-y-2">
              {entries.length === 0 && <p className="text-xs text-slate-500">尚未加入怪物。</p>}
              {entries.map((entry) => (
                <div key={entry.template.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="truncate text-slate-300">{entry.template.name}</span>
                  <span className="ml-3 tabular-nums text-slate-100">× {entry.quantity}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-400">
              <div className="flex justify-between"><span>生物数量</span><span className="text-slate-100">{summary.creatureCount}</span></div>
              <div className="mt-2 flex justify-between"><span>基础经验值</span><span className="text-amber-200">{summary.baseExperience} XP</span></div>
              <p className="mt-3 leading-5 text-slate-500">这里只统计 SRD 怪物基础 XP，不擅自套用非 SRD 的遭遇难度阈值。战斗结束仍由现有 XP 结算面板分配。</p>
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-white/5">取消</button>
          <button
            type="button"
            disabled={summary.creatureCount === 0}
            onClick={() => { onConfirm(entries); setQuantities({}); setQuery('') }}
            className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            放置 {summary.creatureCount} 只怪物
          </button>
        </div>
      </div>
    </div>
  )
}
