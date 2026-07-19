import { useMemo, useState } from 'react'
import { Search, Skull, X } from 'lucide-react'
import {
  DND5E_SRD_ENEMY_POOL,
  searchEnemyPool,
  type EnemyTemplate,
} from '../../lib/enemyPool'

export default function EnemyPoolPicker({
  open,
  title = '怪物池',
  hint,
  onClose,
  onPick,
}: {
  open: boolean
  title?: string
  hint?: string
  onClose: () => void
  onPick: (template: EnemyTemplate) => void
}) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchEnemyPool(query, DND5E_SRD_ENEMY_POOL), [query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[min(640px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Skull className="h-5 w-5 shrink-0 text-rose-400" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {hint && <p className="text-xs text-slate-500">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、标签或描述…"
              className="w-full rounded-xl border border-white/10 bg-void-900/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-arcane-500"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            SRD 5.1 · 共 {DND5E_SRD_ENEMY_POOL.length} 种怪物 · 显示 {results.length} 项
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">没有匹配的怪物</p>
          ) : (
            <ul className="space-y-1">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(m)
                      setQuery('')
                      onClose()
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-rose-500/30 hover:bg-rose-500/10"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-void-900 text-xl"
                      style={{ borderColor: m.color }}
                    >
                      {m.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-100">{m.name}</span>
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-rose-200">
                          HP {m.maxHp}
                        </span>
                        {m.armorClass != null && (
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-200">
                            AC {m.armorClass}
                          </span>
                        )}
                        {m.challengeRating && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200">
                            CR {m.challengeRating}
                          </span>
                        )}
                        {m.size != null && m.size !== 1 && (
                          <span className="text-[10px] text-slate-500">{m.size}× 体型</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{m.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
