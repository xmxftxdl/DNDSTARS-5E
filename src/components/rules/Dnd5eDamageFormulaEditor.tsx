import { Plus, Trash2 } from 'lucide-react'
import type { AbilityKey } from '../../lib/dnd'
import {
  summarizeDnd5eWorkshopDamageFormula,
  type Dnd5eWorkshopDamageFormulaTermV1,
  type Dnd5eWorkshopDamageFormulaV1,
} from '../../rulesets/dnd5e/workshopDamageFormula'

export interface Dnd5eDamageFormulaEditorValue {
  count: number
  sides: number
  fixedModifier: number
  modifierFormula?: Dnd5eWorkshopDamageFormulaV1
}

interface Props {
  value: Dnd5eDamageFormulaEditorValue
  onChange: (value: Dnd5eDamageFormulaEditorValue) => void
  compact?: boolean
  allowSpellcastingModifier?: boolean
  allowLevelTerms?: boolean
  className?: string
}

const ABILITY_LABELS: readonly [AbilityKey, string][] = [
  ['str', '力量调整值'], ['dex', '敏捷调整值'], ['con', '体质调整值'],
  ['int', '智力调整值'], ['wis', '感知调整值'], ['cha', '魅力调整值'],
]

function termKey(term: Dnd5eWorkshopDamageFormulaTermV1): string {
  return term.kind === 'ability-modifier' ? `ability:${term.ability}` : term.kind
}

function termFromKey(key: string): Dnd5eWorkshopDamageFormulaTermV1 {
  if (key.startsWith('ability:')) return { kind: 'ability-modifier', ability: key.slice(8) as AbilityKey }
  if (key === 'spellcasting-ability-modifier') return { kind: 'spellcasting-ability-modifier' }
  if (key === 'character-level') return { kind: 'character-level' }
  if (key === 'class-level') return { kind: 'class-level', classId: 'fighter' }
  return { kind: 'proficiency-bonus' }
}

export default function Dnd5eDamageFormulaEditor({
  value,
  onChange,
  compact = false,
  allowSpellcastingModifier = true,
  allowLevelTerms = true,
  className = '',
}: Props) {
  const terms = [...(value.modifierFormula?.terms ?? [])]
  const patchTerms = (nextTerms: readonly Dnd5eWorkshopDamageFormulaTermV1[]) => onChange({
    ...value,
    modifierFormula: nextTerms.length > 0 ? { schemaVersion: 1, terms: nextTerms } : undefined,
  })
  const inputClass = 'mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-violet-300/50'
  const options: Array<readonly [string, string]> = [
    ['proficiency-bonus', '熟练加值'],
    ...ABILITY_LABELS.map(([ability, label]) => [`ability:${ability}`, label] as const),
  ]
  if (allowSpellcastingModifier) options.push(['spellcasting-ability-modifier', '施法调整值'])
  if (allowLevelTerms) options.push(['character-level', '角色等级'], ['class-level', '指定职业等级'])
  const preview = `${value.count}d${value.sides}${value.fixedModifier === 0 ? '' : value.fixedModifier > 0 ? ` + ${value.fixedModifier}` : ` - ${Math.abs(value.fixedModifier)}`}${terms.length ? ` + ${summarizeDnd5eWorkshopDamageFormula(value.modifierFormula)}` : ''}`

  return (
    <div data-testid="dnd5e-damage-formula-editor" className={`rounded-lg border border-violet-300/15 bg-violet-500/[0.035] p-3 ${className}`}>
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'sm:grid-cols-3'}`}>
        <label className="text-[11px] text-slate-400">骰子数量<input aria-label="伤害骰数量" type="number" min={0} max={1000} value={value.count} onChange={(event) => onChange({ ...value, count: Number(event.target.value) })} className={inputClass} /></label>
        <label className="text-[11px] text-slate-400">骰面<input aria-label="伤害骰面数" type="number" min={2} max={10000} value={value.sides} onChange={(event) => onChange({ ...value, sides: Number(event.target.value) })} className={inputClass} /></label>
        <label className="text-[11px] text-slate-400">固定调整值<input aria-label="固定伤害调整值" type="number" min={-1000000} max={1000000} value={value.fixedModifier} onChange={(event) => onChange({ ...value, fixedModifier: Number(event.target.value) })} className={inputClass} /></label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-violet-100">动态调整值</div>
          <div className="mt-0.5 text-[10px] text-slate-500">由 Host 在结算时读取使用者当前属性。</div>
        </div>
        <button type="button" disabled={terms.length >= 8} onClick={() => patchTerms([...terms, { kind: 'proficiency-bonus' }])} className="inline-flex items-center gap-1 rounded-md border border-violet-300/25 bg-violet-400/10 px-2 py-1 text-[11px] text-violet-100 disabled:opacity-40"><Plus className="h-3 w-3" />添加</button>
      </div>

      {terms.length > 0 && <div className="mt-2 space-y-2">
        {terms.map((term, index) => (
          <div key={`${index}:${termKey(term)}`} className="grid grid-cols-[minmax(0,1fr)_80px_auto] items-end gap-2">
            <label className="text-[10px] text-slate-500">来源<select aria-label={`动态调整值 ${index + 1}`} value={termKey(term)} onChange={(event) => patchTerms(terms.map((entry, entryIndex) => entryIndex === index ? termFromKey(event.target.value) : entry))} className={inputClass}>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-[10px] text-slate-500">倍数<input aria-label={`动态调整值倍数 ${index + 1}`} type="number" min={-100} max={100} value={term.multiplier ?? 1} onChange={(event) => patchTerms(terms.map((entry, entryIndex) => entryIndex === index ? { ...entry, multiplier: Number(event.target.value) } : entry))} className={inputClass} /></label>
            <button type="button" aria-label={`删除动态调整值 ${index + 1}`} onClick={() => patchTerms(terms.filter((_, entryIndex) => entryIndex !== index))} className="mb-0.5 rounded-md p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
            {term.kind === 'class-level' && <label className="col-span-2 text-[10px] text-slate-500">职业 ID<input aria-label={`职业 ID ${index + 1}`} value={term.classId} onChange={(event) => patchTerms(terms.map((entry, entryIndex) => entryIndex === index && entry.kind === 'class-level' ? { ...entry, classId: event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') } : entry))} className={inputClass} /></label>}
            {(term.kind === 'character-level' || term.kind === 'class-level') && <label className="text-[10px] text-slate-500">除数（向下取整）<input aria-label={`等级除数 ${index + 1}`} type="number" min={1} max={100} value={term.divisor ?? 1} onChange={(event) => patchTerms(terms.map((entry, entryIndex) => entryIndex === index && (entry.kind === 'character-level' || entry.kind === 'class-level') ? { ...entry, divisor: Number(event.target.value) } : entry))} className={inputClass} /></label>}
          </div>
        ))}
      </div>}

      <div data-testid="dnd5e-damage-formula-preview" className="mt-3 rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-[11px] text-slate-300">
        公式：<strong className="text-violet-100">{preview}</strong>
      </div>
    </div>
  )
}
