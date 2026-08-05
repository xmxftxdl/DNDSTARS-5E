import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import {
  dnd5eBuilderAutomationStatus,
  summarizeDnd5eBuilderResourceInventory,
  type Dnd5eBuilderAutomationStatus,
  type Dnd5eBuilderResourceInventoryEntry,
} from './dnd5eBuilderResourceInventoryModel'

const STATUS_LABELS: Record<Dnd5eBuilderAutomationStatus, string> = {
  full: '完整 Headless',
  partial: '部分 Headless',
  manual: 'DM 裁定',
  'reference-only': '仅资料',
}

const STATUS_CLASSES: Record<Dnd5eBuilderAutomationStatus, string> = {
  full: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  partial: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  manual: 'border-slate-400/20 bg-slate-500/10 text-slate-300',
  'reference-only': 'border-violet-400/20 bg-violet-500/8 text-violet-200',
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  )
}

export default function Dnd5eBuilderResourceInventory({
  sectionLabel,
  entries,
  headerAction,
  entryActionLabel,
  onEntryAction,
}: {
  sectionLabel: string
  entries: readonly Dnd5eBuilderResourceInventoryEntry[]
  headerAction?: ReactNode
  entryActionLabel?: string
  onEntryAction?: (entry: Dnd5eBuilderResourceInventoryEntry) => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const summary = summarizeDnd5eBuilderResourceInventory(entries)

  return (
    <section data-testid="builder-resource-inventory" className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-cyan-50">已接入的{sectionLabel}</h3>
          <p className="mt-1 text-xs text-cyan-100/55">
            当前扩展包含 {summary.resources} 项；下方只显示“{sectionLabel}”分类的资源。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerAction}
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-400/8 px-3 py-2 text-xs font-semibold text-cyan-100"
          >
            <Info className="h-3.5 w-3.5" />
            详细信息
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">
          当前扩展尚未接入{sectionLabel}。
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const status = dnd5eBuilderAutomationStatus(entry.automation)
            return (
              <article key={entry.id} className="min-w-0 rounded-xl border border-white/8 bg-black/15 p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-200">{entry.name || '未命名资源'}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">{entry.id || '未填写 ID'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${STATUS_CLASSES[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                {entry.summary && <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{entry.summary}</p>}
                {entryActionLabel && onEntryAction && (
                  <button
                    type="button"
                    aria-label={`${entryActionLabel}：${entry.name || entry.id}`}
                    onClick={() => onEntryAction(entry)}
                    className="mt-3 w-full rounded-lg border border-violet-400/20 bg-violet-500/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-500/12"
                  >
                    {entryActionLabel}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}

      {detailsOpen && (
        <div className="mt-4 border-t border-cyan-300/10 pt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="资源总数" value={summary.resources} tone="text-slate-100" />
            <Stat label="完整 Headless" value={summary.full} tone="text-emerald-300" />
            <Stat label="部分 Headless" value={summary.partial} tone="text-amber-300" />
            <Stat label="DM 裁定" value={summary.manual} tone="text-slate-300" />
            <Stat label="仅资料" value={summary.referenceOnly} tone="text-violet-300" />
            <Stat label="能力／机制总数" value={summary.automationUnits} tone="text-cyan-200" />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            Headless 数量按能力或机制统计：一个职业、子职或怪物可能包含多项能力，因此可能高于资源总数。
          </p>
          {entries.some((entry) => entry.reasons?.length) && (
            <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-300/10 bg-amber-500/[0.025] px-3 py-2.5 text-[11px] leading-5 text-amber-100/70">
              {entries.flatMap((entry) => (entry.reasons ?? []).map((reason, index) => (
                <li key={`${entry.id}:${index}`}><strong>{entry.name || entry.id}：</strong>{reason}</li>
              )))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
