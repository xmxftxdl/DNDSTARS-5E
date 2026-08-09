import { Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { showAppConfirm } from '../../lib/appDialog'
import type { Dnd5ePluginArea } from '../../store/maps'

export default function Dnd5ePersistentAreaDetailPanel({ area, sourceName, onDelete, onClose }: {
  area?: Dnd5ePluginArea
  sourceName?: string
  onDelete: (areaId: string) => void | Promise<void>
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()
  if (!area) return null
  const remove = async () => {
    if (deleting || !await showAppConfirm({ title: '删除持续法术', message: `从地图上删除「${area.label}」及其关联实体吗？若它对应施法者当前的专注，该专注也会结束。`, confirmLabel: '确认删除', tone: 'danger' })) return
    setDeleting(true); setError(undefined)
    try { await onDelete(area.id); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '持续法术删除失败，请重试。'); setDeleting(false) }
  }
  return <div data-testid="dnd5e-persistent-area-detail-panel" className="glass absolute bottom-3 right-3 z-[90] w-[min(320px,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-orange-300/20 shadow-2xl">
    <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-300/35 bg-violet-500/15 text-violet-200"><Sparkles className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-slate-100">{area.label}</h2><p className="mt-0.5 text-xs text-slate-400">{sourceName ? `施法者：${sourceName}` : '持续法术区域'}</p></div>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200" aria-label="关闭持续法术详情"><X className="h-4 w-4" /></button>
    </div>
    <div className="px-4 py-3">
      <p className="text-xs leading-relaxed text-slate-400">删除会同步移除地图上的持续动画、规则区域和关联法术实体；只会结束与该区域精确匹配的当前专注。</p>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      <button type="button" disabled={deleting} onClick={() => void remove()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"><Trash2 className="h-4 w-4" />{deleting ? '删除中…' : '删除持续法术'}</button>
    </div>
  </div>
}
