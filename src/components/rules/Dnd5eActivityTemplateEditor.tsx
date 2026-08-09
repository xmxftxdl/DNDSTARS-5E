import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import {
  listDnd5eTrackableDefinitionsV1,
  validateDnd5eActivityDefinitionV1,
  type Dnd5eActivityDefinitionV1,
  type Dnd5eTrackableDefinitionV1,
} from '../../rulesets/dnd5e'
import {
  DND5E_ACTIVITY_AUTHORING_PRESETS,
  dnd5eActivityFromAuthoringPresetV1,
  type Dnd5eActivityAuthoringPresetId,
} from './dnd5eActivityTemplateModel'

function ActivityJsonCard({
  value,
  trackedDefinitions,
  onChange,
  onDelete,
}: {
  value: Dnd5eActivityDefinitionV1
  trackedDefinitions: readonly Dnd5eTrackableDefinitionV1[]
  onChange(value: Dnd5eActivityDefinitionV1): void
  onDelete(): void
}) {
  const [source, setSource] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)
  const apply = () => {
    try {
      const parsed = JSON.parse(source) as Dnd5eActivityDefinitionV1
      const errors = validateDnd5eActivityDefinitionV1(parsed)
      if (errors.length) throw new Error(errors.join('\n'))
      onChange(parsed)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  const invocation = value.invocation?.kind === 'triggered'
    ? `${value.invocation.event} · ${value.invocation.confirmation}`
    : '主动使用'
  const trackedDefinitionId = value.requirements?.find((entry) => entry.kind === 'activity-definition')?.definitionId ?? ''
  const setTrackedDefinitionId = (definitionId: string) => {
    const requirements = [
      ...(value.requirements ?? []).filter((entry) => entry.kind !== 'activity-definition'),
      ...(definitionId ? [{ kind: 'activity-definition' as const, definitionId }] : []),
    ]
    const next: Dnd5eActivityDefinitionV1 = {
      ...value,
      ...(requirements.length > 0 ? { requirements } : { requirements: undefined }),
    }
    setSource(JSON.stringify(next, null, 2))
    setError(null)
    onChange(next)
  }
  return <details className="group rounded-2xl border border-white/8 bg-black/15">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-100">{value.name}</span>
        <span className="mt-1 block truncate text-[11px] text-slate-500">
          {value.id} · {invocation} · {value.legacySource?.kind}:{value.legacySource?.id}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-white/8 p-4">
      {value.invocation?.kind === 'triggered' && <label className="mb-3 block text-xs text-slate-400">
        <span className="mb-1.5 block font-semibold text-slate-300">限定触发来源（稳定 ID，可选）</span>
        <select
          aria-label={`${value.name} 触发来源稳定 ID`}
          value={trackedDefinitionId}
          onChange={(event) => setTrackedDefinitionId(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-200"
        >
          <option value="">任意符合当前触发时机的行动</option>
          {trackedDefinitions.map((entry) => <option key={entry.definitionId} value={entry.definitionId}>
            {entry.kind} · {entry.name} · {entry.definitionId}
          </option>)}
        </select>
        <span className="mt-1.5 block leading-5 text-slate-500">
          选择后，只有该法术、特性、物品或行动结算到此触发窗口时才会触发；Host 会按权威执行记录校验此 ID。
        </span>
      </label>}
      <p className="mb-2 text-xs leading-5 text-slate-500">
        该 JSON 只描述白名单原语，不能包含 JavaScript。Host 会重新验证触发窗口、确认方、目标、检定、消耗和效果。
      </p>
      <textarea
        aria-label={`${value.name} Activity JSON`}
        value={source}
        onChange={(event) => setSource(event.target.value)}
        onBlur={apply}
        spellCheck={false}
        className="min-h-80 w-full rounded-xl border border-white/10 bg-void-950/75 px-3 py-2 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-arcane-400/50"
      />
      {error && <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-rose-400/20 bg-rose-500/5 p-3 text-xs text-rose-200">{error}</pre>}
      <div className="mt-3 flex justify-between gap-3">
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-200">
          <Trash2 className="h-3.5 w-3.5" /> 删除
        </button>
        <button type="button" onClick={apply} className="rounded-xl bg-arcane-500/15 px-3 py-2 text-xs font-semibold text-arcane-100">校验并应用</button>
      </div>
    </div>
  </details>
}

export default function Dnd5eActivityTemplateEditor({
  value,
  onChange,
}: {
  value: readonly Dnd5eActivityDefinitionV1[]
  onChange(value: Dnd5eActivityDefinitionV1[]): void
}) {
  const [presetId, setPresetId] = useState<Dnd5eActivityAuthoringPresetId>('active')
  const preset = DND5E_ACTIVITY_AUTHORING_PRESETS.find((entry) => entry.id === presetId) ?? DND5E_ACTIVITY_AUTHORING_PRESETS[0]!
  const trackedDefinitions = useMemo(() => listDnd5eTrackableDefinitionsV1(), [value])
  return <section>
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">统一 Activity 模板</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          法术、物品、特性、专长、种族、背景、职业、子职和怪物都通过同一模板声明时机、行动经济、条件、目标、检定与效果。
        </p>
      </div>
      <div className="flex gap-2">
        <select value={presetId} onChange={(event) => setPresetId(event.target.value as Dnd5eActivityAuthoringPresetId)} className="rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-200">
          {DND5E_ACTIVITY_AUTHORING_PRESETS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <button type="button" onClick={() => onChange([...value, dnd5eActivityFromAuthoringPresetV1(preset, value)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/15 px-3 py-2 text-xs font-semibold text-arcane-100">
          <Plus className="h-3.5 w-3.5" /> 添加模板
        </button>
      </div>
    </div>
    <div className="space-y-3">
      {value.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-600">当前内容将由兼容适配器自动生成 Activity；也可以在这里添加原生模板覆盖它。</p>}
      {value.map((activity, index) => <ActivityJsonCard
        key={`${activity.id}:${index}:${JSON.stringify(activity)}`}
        value={activity}
        trackedDefinitions={trackedDefinitions}
        onChange={(next) => onChange(value.map((entry, itemIndex) => itemIndex === index ? next : entry))}
        onDelete={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
      />)}
    </div>
  </section>
}
