import { useMemo, useState } from 'react'
import { Clock3, Link2, ShieldCheck, Tags, Trash2 } from 'lucide-react'
import type { AbilityKey } from '../../lib/dnd'
import {
  DND5E_STANDARD_CONDITION_IDS,
  DND5E_STANDARD_CONDITIONS,
  dnd5eActiveStandardConditions,
  dnd5eConditionLabel,
  dnd5eStandardConditionId,
} from '../../rulesets/dnd5e/conditions'
import {
  applyDnd5eActiveEffect,
  createDnd5eConditionEffect,
  dnd5eActiveEffectRemainingLabel,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  removeDnd5eActiveEffectById,
  removeDnd5eActiveEffectsByStandardCondition,
  type Dnd5eActiveEffectBreakTrigger,
  type Dnd5eActiveEffectDuration,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectStackingPolicy,
} from '../../rulesets/dnd5e/activeEffects'
import { DND5E_CONDITION_MARKERS } from './dnd5eConditionMarkers'

const ABILITY_OPTIONS: readonly { value: AbilityKey; label: string }[] = [
  { value: 'str', label: '力量' },
  { value: 'dex', label: '敏捷' },
  { value: 'con', label: '体质' },
  { value: 'int', label: '智力' },
  { value: 'wis', label: '感知' },
  { value: 'cha', label: '魅力' },
]

const BREAK_OPTIONS: readonly { value: Dnd5eActiveEffectBreakTrigger; label: string }[] = [
  { value: 'takes-damage', label: '受到伤害' },
  { value: 'targeted-by-attack', label: '成为攻击目标' },
  { value: 'hit-by-attack', label: '被攻击命中' },
  { value: 'makes-attack', label: '发动攻击' },
  { value: 'casts-spell', label: '施放法术' },
  { value: 'moves', label: '发生移动' },
]

function normalizedConditionLabels(conditions: readonly string[]): Array<{ key: string; label: string; glyph: string }> {
  const seen = new Set<string>()
  return conditions.flatMap((value) => {
    const standard = dnd5eStandardConditionId(value)
    const key = standard ? `standard:${standard}` : `extension:${value}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ key, label: dnd5eConditionLabel(value), glyph: standard ? DND5E_CONDITION_MARKERS[standard].glyph : '•' }]
  })
}

export function Dnd5eConditionTags({
  conditions,
  emptyLabel,
  onClick,
}: {
  conditions: readonly string[]
  emptyLabel?: string
  onClick?: (condition: string) => void
}) {
  const labels = normalizedConditionLabels(conditions)
  if (labels.length === 0) return emptyLabel ? <p className="text-xs text-slate-500">{emptyLabel}</p> : null
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="dnd5e-active-condition-tags">
      {labels.map((condition) => {
        const Tag = onClick ? 'button' : 'span'
        return (
          <Tag
            key={condition.key}
            type={onClick ? 'button' : undefined}
            onClick={onClick ? () => onClick(condition.key.replace(/^standard:/, '')) : undefined}
            className="inline-flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-100 hover:border-violet-300/40"
          >
            <span aria-hidden="true" className="text-violet-300">{condition.glyph}</span>
            {condition.label}
          </Tag>
        )
      })}
    </div>
  )
}

export interface Dnd5eConditionSourceOption {
  id: string
  label: string
}

export default function Dnd5eConditionEditor({
  activeEffects,
  targetId = 'unknown-target',
  sourceOptions = [],
  conditionImmunities = [],
  onChange,
}: {
  conditions: readonly string[]
  activeEffects?: readonly Dnd5eActiveEffectInstance[]
  targetId?: string
  sourceOptions?: readonly Dnd5eConditionSourceOption[]
  conditionImmunities?: readonly string[]
  onChange: (conditions: string[], activeEffects: Dnd5eActiveEffectInstance[]) => void
}) {
  const effects = useMemo(() => normalizeDnd5eActiveEffects(activeEffects), [activeEffects])
  const active = new Set(dnd5eActiveStandardConditions({ conditions: dnd5eConditionsFromActiveEffects(effects) }))
  const immunities = new Set(conditionImmunities.flatMap((value) => {
    const condition = dnd5eStandardConditionId(value)
    return condition ? [condition] : []
  }))
  const [sourceActorId, setSourceActorId] = useState('')
  const [sourceLabel, setSourceLabel] = useState('DM 裁定')
  const [durationType, setDurationType] = useState<'permanent' | 'rounds' | 'until-turn-boundary' | 'concentration'>('permanent')
  const [rounds, setRounds] = useState(1)
  const [boundary, setBoundary] = useState<'source-turn-start' | 'source-turn-end' | 'target-turn-start' | 'target-turn-end'>('target-turn-end')
  const [repeatSave, setRepeatSave] = useState(false)
  const [saveAbility, setSaveAbility] = useState<AbilityKey>('wis')
  const [saveDc, setSaveDc] = useState(10)
  const [saveTiming, setSaveTiming] = useState<'target-turn-start' | 'target-turn-end'>('target-turn-end')
  const [breakOn, setBreakOn] = useState<Dnd5eActiveEffectBreakTrigger[]>([])
  const [stackingPolicy, setStackingPolicy] = useState<Dnd5eActiveEffectStackingPolicy>('refresh-duration')

  const commit = (next: readonly Dnd5eActiveEffectInstance[]) => {
    const list = [...next]
    onChange(dnd5eConditionsFromActiveEffects(list), list)
  }

  const configuredDuration = (): Dnd5eActiveEffectDuration => {
    if (durationType === 'rounds') return { type: 'rounds', remainingRounds: Math.max(1, Math.floor(rounds)), tickOn: saveTiming }
    if (durationType === 'until-turn-boundary') return { type: 'until-turn-boundary', boundary }
    if (durationType === 'concentration') {
      return { type: 'concentration', sourceActorId: sourceActorId || 'dm', remainingRounds: Math.max(1, Math.floor(rounds)) }
    }
    return { type: 'permanent' }
  }

  const removeEffect = (effectId: string) => commit(removeDnd5eActiveEffectById({ effects, id: effectId }).effects)

  return (
    <section className="rounded-xl border border-violet-300/15 bg-violet-500/[0.06] p-3" data-testid="dnd5e-condition-editor">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-100">
          <Tags className="h-3.5 w-3.5" />
          D&D 5e 状态效果
        </div>
        <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-200">实例 {effects.length}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {DND5E_STANDARD_CONDITION_IDS.map((condition) => {
          const selected = active.has(condition)
          const immune = immunities.has(condition)
          const disabled = immune && !selected
          const marker = DND5E_CONDITION_MARKERS[condition]
          const label = DND5E_STANDARD_CONDITIONS[condition].label
          return (
            <button
              key={condition}
              type="button"
              data-testid={`dnd5e-condition-toggle-${condition}`}
              aria-pressed={selected}
              disabled={disabled}
              title={disabled ? `${label}：目标免疫` : selected ? `移除全部${label}来源` : `按下方配置附加${label}`}
              onClick={() => {
                if (selected) {
                  commit(removeDnd5eActiveEffectsByStandardCondition({ effects, condition }).effects)
                  return
                }
                const incoming = createDnd5eConditionEffect({
                  id: `dm:${targetId}:${condition}:${Date.now()}`,
                  condition,
                  targetId,
                  source: {
                    kind: 'dm', actorId: sourceActorId || undefined,
                    actorName: sourceOptions.find((entry) => entry.id === sourceActorId)?.label,
                    label: sourceLabel.trim() || 'DM 裁定',
                  },
                  duration: configuredDuration(),
                  repeatSave: repeatSave ? { ability: saveAbility, dc: Math.max(1, Math.floor(saveDc)), timing: saveTiming, onSuccess: 'remove' } : undefined,
                  breakOn,
                  stackingPolicy,
                })
                const mutation = applyDnd5eActiveEffect({ effects, incoming, conditionImmunities })
                if (mutation.status !== 'rejected-immune') commit(mutation.effects)
              }}
              className={[
                'flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors',
                selected ? 'border-violet-300/55 bg-violet-400/25 font-semibold text-violet-50' : 'border-white/8 bg-void-950/35 text-slate-400 hover:border-violet-300/25 hover:bg-violet-400/10 hover:text-slate-200',
                disabled ? 'cursor-not-allowed opacity-45' : '',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: marker.fill, color: marker.text, boxShadow: `inset 0 0 0 1px ${marker.stroke}` }}
              >
                {marker.glyph}
              </span>
              <span className="truncate">{label}</span>
              {immune && <ShieldCheck className="ml-auto h-3 w-3 shrink-0 text-emerald-300" aria-label="免疫" />}
            </button>
          )
        })}
      </div>

      <details className="mt-3 rounded-lg border border-white/8 bg-void-950/30 p-2" open>
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">新状态生命周期配置</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <label>来源角色
            <select value={sourceActorId} onChange={(event) => setSourceActorId(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200">
              <option value="">DM / 无角色</option>
              {sourceOptions.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
          </label>
          <label>来源法术 / 特性
            <input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200" />
          </label>
          <label>持续方式
            <select value={durationType} onChange={(event) => setDurationType(event.target.value as typeof durationType)} className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200">
              <option value="permanent">直到手动解除</option>
              <option value="rounds">持续若干轮</option>
              <option value="until-turn-boundary">到指定回合边界</option>
              <option value="concentration">随来源专注</option>
            </select>
          </label>
          {durationType === 'rounds' || durationType === 'concentration' ? <label>轮数
            <input type="number" min={1} value={rounds} onChange={(event) => setRounds(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200" />
          </label> : null}
          {durationType === 'until-turn-boundary' ? <label>解除时点
            <select value={boundary} onChange={(event) => setBoundary(event.target.value as typeof boundary)} className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200">
              <option value="target-turn-start">目标回合开始</option><option value="target-turn-end">目标回合结束</option>
              <option value="source-turn-start">来源回合开始</option><option value="source-turn-end">来源回合结束</option>
            </select>
          </label> : null}
          <label>重复 / 覆盖
            <select value={stackingPolicy} onChange={(event) => setStackingPolicy(event.target.value as Dnd5eActiveEffectStackingPolicy)} className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200">
              <option value="refresh-duration">刷新持续时间</option><option value="reject">拒绝重复</option>
              <option value="replace">新效果覆盖</option><option value="keep-strongest">保留更强效果</option><option value="stack">允许叠加</option>
            </select>
          </label>
        </div>

        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={repeatSave} onChange={(event) => setRepeatSave(event.target.checked)} className="accent-violet-500" />
          每回合重新豁免
        </label>
        {repeatSave ? <div className="mt-2 grid grid-cols-3 gap-2">
          <select value={saveAbility} onChange={(event) => setSaveAbility(event.target.value as AbilityKey)} className="rounded border border-white/10 bg-void-950 px-2 py-1 text-[10px] text-slate-200">
            {ABILITY_OPTIONS.map((ability) => <option key={ability.value} value={ability.value}>{ability.label}</option>)}
          </select>
          <input aria-label="豁免 DC" type="number" min={1} value={saveDc} onChange={(event) => setSaveDc(Math.max(1, Number(event.target.value) || 1))} className="rounded border border-white/10 bg-void-950 px-2 py-1 text-[10px] text-slate-200" />
          <select value={saveTiming} onChange={(event) => setSaveTiming(event.target.value as typeof saveTiming)} className="rounded border border-white/10 bg-void-950 px-2 py-1 text-[10px] text-slate-200">
            <option value="target-turn-end">回合结束</option><option value="target-turn-start">回合开始</option>
          </select>
        </div> : null}

        <p className="mt-2 text-[10px] text-slate-500">事件解除</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {BREAK_OPTIONS.map((option) => {
            const selected = breakOn.includes(option.value)
            return <button key={option.value} type="button" aria-pressed={selected} onClick={() => setBreakOn(selected ? breakOn.filter((entry) => entry !== option.value) : [...breakOn, option.value])} className={`rounded px-2 py-1 text-[10px] ${selected ? 'bg-rose-500/20 text-rose-200' : 'bg-white/5 text-slate-500'}`}>{option.label}</button>
          })}
        </div>
      </details>

      {effects.length > 0 ? <div className="mt-3 space-y-1.5" data-testid="dnd5e-active-effect-list">
        {effects.map((effect) => <div key={effect.id} className="rounded-lg border border-white/8 bg-void-950/35 px-2 py-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="font-semibold">{effect.label}</span>
            <span className="text-slate-500">· {effect.source.actorName ?? effect.source.label ?? effect.source.rulesId ?? '未知来源'}</span>
            <button type="button" onClick={() => removeEffect(effect.id)} className="ml-auto text-slate-500 hover:text-rose-300" title="移除该状态实例"><Trash2 className="h-3 w-3" /></button>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-slate-500">
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{dnd5eActiveEffectRemainingLabel(effect)}</span>
            {effect.duration.type === 'concentration' ? <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" />专注</span> : null}
            {effect.repeatSave ? <span>{ABILITY_OPTIONS.find((entry) => entry.value === effect.repeatSave?.ability)?.label}豁免 DC {effect.repeatSave.dc}</span> : null}
            {effect.breakOn?.length ? <span>解除：{effect.breakOn.map((entry) => BREAK_OPTIONS.find((option) => option.value === entry)?.label ?? entry).join('、')}</span> : null}
          </div>
        </div>)}
      </div> : <p className="mt-2 text-[10px] text-slate-500">当前没有状态效果。</p>}
    </section>
  )
}
