import { Flame, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Token } from '../../store/maps'
import { showAppConfirm } from '../../lib/appDialog'

interface Dnd5eSpellEffectDetailPanelProps {
  token: Token
  sourceName?: string
  onDelete: () => void | Promise<void>
  onClose: () => void
}

export default function Dnd5eSpellEffectDetailPanel({
  token,
  sourceName,
  onDelete,
  onClose,
}: Dnd5eSpellEffectDetailPanelProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()
  const effect = token.dnd5eSpellEffect
  if (!effect) return null

  const remove = async () => {
    if (deleting) return
    if (!await showAppConfirm({
      title: '删除法术实体',
      message: `删除「${token.label || '法术实体'}」及其关联区域？`,
      confirmLabel: '确认删除',
      tone: 'danger',
    })) return
    setDeleting(true)
    setError(undefined)
    try {
      await onDelete()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '法术实体删除失败，请重试。')
      setDeleting(false)
    }
  }

  return (
    <div
      data-testid="dnd5e-spell-effect-detail-panel"
      className="glass absolute bottom-3 right-3 z-[90] w-[min(320px,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-orange-300/20 shadow-2xl"
    >
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-orange-300/35 bg-orange-500/15 text-orange-200">
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-slate-100">{token.label || '法术实体'}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {sourceName ? `施法者：${sourceName}` : `法术：${effect.spellId}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
          aria-label="关闭法术实体详情"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs leading-relaxed text-slate-400">
          删除会同时移除该实体关联的范围区域；若施法者仍在专注于炽焰法球，也会安全结束该专注。
        </p>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <button
          type="button"
          disabled={deleting}
          onClick={() => void remove()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? '删除中…' : '删除法术实体'}
        </button>
      </div>
    </div>
  )
}
