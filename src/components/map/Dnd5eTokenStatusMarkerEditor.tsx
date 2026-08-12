import { useMemo, useState } from 'react'
import { Plus, Tags, Trash2 } from 'lucide-react'
import {
  DND5E_BASE_TOKEN_STATUS_MARKER_DEFINITIONS,
  createDnd5eTokenStatusMarker,
  dnd5eTokenStatusMarkerDefinition,
  type Dnd5eTokenStatusMarker,
  type Dnd5eTokenStatusMarkerId,
  type Dnd5eTokenStatusMarkerOption,
} from '../../rulesets/dnd5e/tokenStatusMarkers'
import { dnd5eTokenStatusMarkerStyle } from './dnd5eTokenStatusMarkerPresentation'

export default function Dnd5eTokenStatusMarkerEditor({
  markers,
  options,
  onChange,
}: {
  markers: readonly Dnd5eTokenStatusMarker[]
  options?: readonly Dnd5eTokenStatusMarkerOption[]
  onChange: (markers: Dnd5eTokenStatusMarker[]) => void
}) {
  const effectiveOptions = options ?? DND5E_BASE_TOKEN_STATUS_MARKER_DEFINITIONS.map(
    (definition): Dnd5eTokenStatusMarkerOption => ({
      definition,
      kind: 'base',
      sourceTokenIds: [],
      sourceLabels: [],
    }),
  )
  const activeIds = useMemo(() => new Set(markers.map((marker) => marker.statusId)), [markers])
  const available = effectiveOptions.filter(
    (option) => !activeIds.has(option.definition.id),
  )
  const [selectedStatusId, setSelectedStatusId] = useState<Dnd5eTokenStatusMarkerId>(
    available[0]?.definition.id ?? 'blinded',
  )
  const selected = available.some((option) => option.definition.id === selectedStatusId)
    ? selectedStatusId
    : available[0]?.definition.id

  return (
    <section
      className="rounded-xl border border-sky-300/15 bg-sky-500/[0.05] p-3"
      data-testid="dnd5e-token-status-marker-editor"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-100">
          <Tags className="h-3.5 w-3.5" />
          Token 状态标记
        </div>
        <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-200">
          {markers.length} 项
        </span>
      </div>
      <p className="mb-2 text-[10px] leading-4 text-slate-500">
        仅用于地图显示，不会赋予中毒、倒地等 Headless 规则。DM 可在战斗内外随时添加或移除。
      </p>

      {markers.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5" data-testid="dnd5e-token-status-marker-list">
          {markers.map((marker) => {
            const definition = dnd5eTokenStatusMarkerDefinition(marker.statusId)
            const style = dnd5eTokenStatusMarkerStyle(marker.statusId)
            return (
              <button
                key={marker.id}
                type="button"
                data-testid={`dnd5e-token-status-marker-remove-${marker.statusId}`}
                title={`移除${marker.label ?? definition.label}标记`}
                onClick={() => onChange(markers.filter((candidate) => candidate.id !== marker.id))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-void-950/45 px-2 py-1.5 text-[11px] text-slate-200 transition-colors hover:border-rose-300/35 hover:text-rose-100"
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: style.fill,
                    color: style.text,
                    boxShadow: `inset 0 0 0 1px ${style.stroke}`,
                  }}
                >
                  {style.glyph}
                </span>
                {marker.label ?? definition.label}
                <Trash2 className="h-3 w-3 text-slate-500" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mb-2 rounded-lg border border-dashed border-white/10 px-2 py-2 text-[10px] text-slate-500">
          当前没有手动 Token 标记。
        </p>
      )}

      <div className="flex gap-2">
        <select
          aria-label="选择 Token 状态标记"
          value={selected ?? ''}
          disabled={available.length === 0}
          onChange={(event) => setSelectedStatusId(event.target.value as Dnd5eTokenStatusMarkerId)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400 disabled:opacity-50"
        >
          {available.length === 0 ? <option value="">可用标记已全部添加</option> : null}
          {available.map((option) => (
            <option key={option.definition.id} value={option.definition.id}>
              {option.definition.label}{option.kind === 'participant-grant'
                ? `（${option.target === 'self' ? '自身' : `由 ${option.sourceLabels.join('、')} 施加`}）`
                : '（基础状态）'}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="dnd5e-token-status-marker-add"
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            onChange([...markers, createDnd5eTokenStatusMarker(selected)])
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-sky-300/20 bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </button>
      </div>
    </section>
  )
}
