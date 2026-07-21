import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Character } from '../../types/character'
import {
  DND5E_MULTICLASS_PREREQUISITES,
  DND5E_SRD_CLASS_DEFINITIONS,
  addDnd5eMulticlassLevel,
  dnd5eClassDefinition,
  dnd5eMeetsMulticlassPrerequisite,
  normalizeDnd5eClassLevels,
  validateDnd5eMulticlassLevelGain,
  type Dnd5eClassId,
} from '../../rulesets/dnd5e'
import { ABILITIES } from '../../lib/dnd'

const ABILITY_LABELS = Object.fromEntries(ABILITIES.map((ability) => [ability.key, ability.label]))

function prerequisiteLabel(classId: Dnd5eClassId): string {
  return DND5E_MULTICLASS_PREREQUISITES[classId]
    .map((alternatives) => alternatives.map((ability) => `${ABILITY_LABELS[ability]} 13`).join('或'))
    .join('，')
}

function failureLabel(reason: Exclude<ReturnType<typeof validateDnd5eMulticlassLevelGain>, { ok: true }>['reason']): string {
  if (reason === 'maximum-level') return '角色总等级已达到 20 级。'
  if (reason === 'current-class-prerequisite') return '当前已有职业的兼职属性门槛未满足。'
  return '目标职业的兼职属性门槛未满足。'
}

export default function Dnd5eMulticlassPanel({
  character,
  selectedClassId,
  onSelectClass,
  onChange,
}: {
  character: Character
  selectedClassId?: Dnd5eClassId
  onSelectClass: (classId: Dnd5eClassId) => void
  onChange: (patch: Partial<Character>) => void
}) {
  const levels = normalizeDnd5eClassLevels(character)
  const unowned = DND5E_SRD_CLASS_DEFINITIONS.filter((definition) => !levels[definition.id])
  const [targetClassId, setTargetClassId] = useState<Dnd5eClassId>(unowned[0]?.id ?? 'fighter')
  const targetDefinition = dnd5eClassDefinition(targetClassId)
  const validation = validateDnd5eMulticlassLevelGain(character, targetClassId)
  const owned = useMemo(() => DND5E_SRD_CLASS_DEFINITIONS.filter((definition) => (levels[definition.id] ?? 0) > 0), [levels])

  const addLevel = () => {
    const next = addDnd5eMulticlassLevel(character, targetClassId)
    if (next === character) return
    onChange({
      dnd5eClassLevels: next.dnd5eClassLevels,
      level: next.level,
      hitPointMaximumMode: Object.keys(next.dnd5eClassLevels ?? {}).length > 1 ? 'fixed' : character.hitPointMaximumMode,
    })
    onSelectClass(targetClassId)
  }

  return <section className="glass rounded-2xl border border-violet-400/15 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-slate-100">职业等级与兼职</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">总等级 {character.level}/20。熟练加值按总等级计算；职业特性、生命骰和施法能力按各职业等级计算。</p>
      </div>
      <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-400">起始职业：{character.charClass}</span>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {owned.map((definition) => <button
        key={definition.id}
        type="button"
        onClick={() => onSelectClass(definition.id)}
        className={`rounded-xl border px-3 py-3 text-left transition ${selectedClassId === definition.id ? 'border-violet-400/45 bg-violet-500/15' : 'border-white/8 bg-black/15 hover:border-white/15'}`}
      >
        <span className="block text-sm font-semibold text-slate-100">{definition.name} {levels[definition.id]}级</span>
        <span className="mt-1 block text-[11px] text-slate-500">d{definition.hitDie} 生命骰 · 点击查看该职业特性</span>
      </button>)}
    </div>

    {character.level < 20 && <div className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">下一等级加入</span>
          <select value={targetClassId} onChange={(event) => setTargetClassId(event.target.value as Dnd5eClassId)} className="rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200">
            {DND5E_SRD_CLASS_DEFINITIONS.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}{levels[definition.id] ? `（当前 ${levels[definition.id]}级）` : ''}</option>)}
          </select>
        </label>
        <button type="button" disabled={!validation.ok} onClick={addLevel} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">
          <Plus className="h-4 w-4" />提升一级
        </button>
      </div>
      <p className={`mt-2 text-xs ${validation.ok ? 'text-slate-500' : 'text-amber-300'}`}>
        {targetDefinition?.name}兼职门槛：{prerequisiteLabel(targetClassId)}。
        {validation.ok
          ? dnd5eMeetsMulticlassPrerequisite(character, targetClassId) ? ' 当前满足。' : ' 已拥有该职业，可继续提升。'
          : ` ${failureLabel(validation.reason)}`}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-slate-600">加入新职业不会重新授予其 1 级豁免熟练或起始装备；职业特性与有限的兼职熟练由对应职业规则处理。</p>
    </div>}
  </section>
}
