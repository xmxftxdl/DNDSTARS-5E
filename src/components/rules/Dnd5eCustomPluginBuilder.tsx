import { useMemo, useState } from 'react'
import { Download, Plus, Save, Trash2 } from 'lucide-react'
import { ABILITIES, type AbilityKey } from '../../lib/dnd'
import {
  buildDnd5eCustomRulesPluginSource,
  dnd5eCustomRulesPluginFileName,
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomRulesPluginDraft,
  type Dnd5ePluginAbilityGenerationDefinition,
  type Dnd5ePluginRaceDefinition,
} from '../../rulesets/dnd5e'

interface RaceDraft {
  id: string
  name: string
  description: string
  speedFeet: number
  abilityBonuses: Record<AbilityKey, number>
  flexibleCount: number
  flexibleAmount: number
  flexibleExclude: AbilityKey[]
}

interface MethodDraft {
  id: string
  name: string
  summary: string
  kind: 'standard-array' | 'point-buy' | 'roll'
  scores: string
  budget: number
  minimum: number
  maximum: number
  costs: string
  diceCount: number
  dieSides: number
  dropLowest: number
}

interface Props {
  defaultPublisher?: string
  busy?: boolean
  onInstall(file: File): Promise<void>
}

const emptyBonuses = (): Record<AbilityKey, number> => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })

function newRace(index: number): RaceDraft {
  return {
    id: `custom-race-${index}`,
    name: `自定义种族 ${index}`,
    description: '',
    speedFeet: 30,
    abilityBonuses: emptyBonuses(),
    flexibleCount: 0,
    flexibleAmount: 1,
    flexibleExclude: [],
  }
}

function newMethod(index: number): MethodDraft {
  return {
    id: `custom-method-${index}`,
    name: `自定义加点 ${index}`,
    summary: '由房间 DM 配置的属性生成规则。',
    kind: 'standard-array',
    scores: '15, 14, 13, 12, 10, 8',
    budget: 27,
    minimum: 8,
    maximum: 15,
    costs: '8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9',
    diceCount: 4,
    dieSides: 6,
    dropLowest: 1,
  }
}

function numericList(value: string): number[] {
  return value.split(/[，,\s]+/).filter(Boolean).map(Number)
}

function costTable(value: string): Record<number, number> {
  const result: Record<number, number> = {}
  for (const entry of value.split(/[，,]+/)) {
    const [score, cost] = entry.trim().split(/[:：]/).map(Number)
    if (Number.isFinite(score) && Number.isFinite(cost)) result[score] = cost
  }
  return result
}

function toRaceDefinition(race: RaceDraft): Dnd5ePluginRaceDefinition {
  const abilityBonuses = Object.fromEntries(
    ABILITIES.flatMap(({ key }) => race.abilityBonuses[key] === 0 ? [] : [[key, race.abilityBonuses[key]]]),
  ) as Partial<Record<AbilityKey, number>>
  return {
    id: race.id.trim(),
    name: race.name.trim(),
    description: race.description.trim(),
    speedFeet: race.speedFeet,
    abilityBonuses,
    ...(race.flexibleCount > 0 ? {
      flexibleAbilityBonus: {
        count: race.flexibleCount,
        amount: race.flexibleAmount,
        ...(race.flexibleExclude.length > 0 ? { exclude: race.flexibleExclude } : {}),
      },
    } : {}),
  }
}

function toMethodDefinition(method: MethodDraft): Dnd5ePluginAbilityGenerationDefinition {
  const base = { id: method.id.trim(), name: method.name.trim(), summary: method.summary.trim() }
  if (method.kind === 'standard-array') return { ...base, kind: 'standard-array', scores: numericList(method.scores) }
  if (method.kind === 'point-buy') return {
    ...base,
    kind: 'point-buy',
    budget: method.budget,
    minimum: method.minimum,
    maximum: method.maximum,
    costs: costTable(method.costs),
  }
  return {
    ...base,
    kind: 'roll',
    diceCount: method.diceCount,
    dieSides: method.dieSides,
    dropLowest: method.dropLowest,
  }
}

export default function Dnd5eCustomPluginBuilder({ defaultPublisher = '房间 DM', busy = false, onInstall }: Props) {
  const [open, setOpen] = useState(false)
  const [metadata, setMetadata] = useState({
    id: 'local.dm.character-creation-rules',
    name: '房间角色创建规则',
    version: '1.0.0',
    publisher: defaultPublisher || '房间 DM',
    license: '自定义内容；由房间 DM 负责授权',
    description: '由 DNDSTARS 角色规则编辑器生成。',
  })
  const [races, setRaces] = useState<RaceDraft[]>([])
  const [methods, setMethods] = useState<MethodDraft[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  const draft = useMemo<Dnd5eCustomRulesPluginDraft>(() => ({
    manifest: {
      ...metadata,
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      stateSchemaVersion: 1,
    },
    races: races.map(toRaceDefinition),
    abilityGenerationMethods: methods.map(toMethodDefinition),
  }), [metadata, methods, races])

  const buildFile = () => {
    const errors = validateDnd5eCustomRulesPluginDraft(draft)
    if (errors.length > 0) {
      setLocalError(errors.join('；'))
      return null
    }
    setLocalError(null)
    const source = buildDnd5eCustomRulesPluginSource(draft)
    return new File([source], dnd5eCustomRulesPluginFileName(draft.manifest.id), { type: 'text/javascript' })
  }

  const download = () => {
    const file = buildFile()
    if (!file) return
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const install = async () => {
    const file = buildFile()
    if (file) await onInstall(file)
  }

  const patchRace = (index: number, patch: Partial<RaceDraft>) => {
    setRaces((current) => current.map((race, itemIndex) => itemIndex === index ? { ...race, ...patch } : race))
  }
  const patchMethod = (index: number, patch: Partial<MethodDraft>) => {
    setMethods((current) => current.map((method, itemIndex) => itemIndex === index ? { ...method, ...patch } : method))
  }

  return (
    <section data-testid="custom-rules-plugin-builder" className="glass mb-5 rounded-2xl border border-arcane-400/15 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">DM 角色规则插件编辑器</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            手工添加种族属性调整、速度和属性生成方式。保存后仍作为 Worker 沙箱插件运行，可下载文件并在以后直接导入。
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
          {open ? '收起编辑器' : '创建角色规则插件'}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {([
              ['插件 ID', 'id'], ['插件名称', 'name'], ['版本', 'version'],
              ['发布者', 'publisher'], ['许可证', 'license'], ['说明', 'description'],
            ] as const).map(([label, key]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
                <input
                  aria-label={label}
                  value={metadata[key]}
                  onChange={(event) => setMetadata((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
                />
              </label>
            ))}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-200">自定义种族</h3><p className="mt-1 text-xs text-slate-600">固定调整与“任选若干属性”可以同时使用。</p></div>
              <button type="button" onClick={() => setRaces((current) => [...current, newRace(current.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> 添加种族</button>
            </div>
            <div className="space-y-3">
              {races.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">尚未添加种族。</p>}
              {races.map((race, index) => (
                <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <BuilderInput label="种族 ID" value={race.id} onChange={(value) => patchRace(index, { id: value })} />
                    <BuilderInput label="显示名称" value={race.name} onChange={(value) => patchRace(index, { name: value })} />
                    <BuilderNumber label="速度（尺）" value={race.speedFeet} min={0} max={500} onChange={(value) => patchRace(index, { speedFeet: value })} />
                    <BuilderInput label="说明" value={race.description} onChange={(value) => patchRace(index, { description: value })} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {ABILITIES.map((ability) => (
                      <BuilderNumber key={ability.key} label={`${ability.label}固定调整`} value={race.abilityBonuses[ability.key]} min={-10} max={10} onChange={(value) => patchRace(index, { abilityBonuses: { ...race.abilityBonuses, [ability.key]: value } })} />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[140px_140px_1fr_auto] md:items-end">
                    <BuilderNumber label="可选属性数量" value={race.flexibleCount} min={0} max={6} onChange={(value) => patchRace(index, { flexibleCount: value })} />
                    <BuilderNumber label="每项调整" value={race.flexibleAmount} min={-10} max={10} onChange={(value) => patchRace(index, { flexibleAmount: value })} />
                    <fieldset><legend className="mb-1.5 text-xs font-semibold text-slate-500">不可选择的属性</legend><div className="flex flex-wrap gap-1.5">{ABILITIES.map((ability) => <button key={ability.key} type="button" aria-pressed={race.flexibleExclude.includes(ability.key)} onClick={() => patchRace(index, { flexibleExclude: race.flexibleExclude.includes(ability.key) ? race.flexibleExclude.filter((key) => key !== ability.key) : [...race.flexibleExclude, ability.key] })} className={`rounded-lg border px-2 py-1 text-xs ${race.flexibleExclude.includes(ability.key) ? 'border-amber-400/35 bg-amber-500/10 text-amber-100' : 'border-white/8 text-slate-500'}`}>{ability.label}</button>)}</div></fieldset>
                    <button type="button" aria-label={`删除种族 ${race.name}`} onClick={() => setRaces((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-200">属性生成／加点规则</h3><p className="mt-1 text-xs text-slate-600">支持标准数组、购点成本表和自定义投骰。</p></div>
              <button type="button" onClick={() => setMethods((current) => [...current, newMethod(current.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> 添加加点规则</button>
            </div>
            <div className="space-y-3">
              {methods.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">尚未添加属性生成规则。</p>}
              {methods.map((method, index) => (
                <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <BuilderInput label="规则 ID" value={method.id} onChange={(value) => patchMethod(index, { id: value })} />
                    <BuilderInput label="显示名称" value={method.name} onChange={(value) => patchMethod(index, { name: value })} />
                    <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">规则类型</span><select aria-label="规则类型" value={method.kind} onChange={(event) => patchMethod(index, { kind: event.target.value as MethodDraft['kind'] })} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100"><option value="standard-array">标准数组</option><option value="point-buy">购点</option><option value="roll">投骰</option></select></label>
                    <BuilderInput label="简要说明" value={method.summary} onChange={(value) => patchMethod(index, { summary: value })} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    {method.kind === 'standard-array' && <BuilderInput label="六个数值（逗号分隔）" value={method.scores} onChange={(value) => patchMethod(index, { scores: value })} className="min-w-72 flex-1" />}
                    {method.kind === 'point-buy' && <><BuilderNumber label="预算" value={method.budget} min={0} max={1000} onChange={(value) => patchMethod(index, { budget: value })} /><BuilderNumber label="最低值" value={method.minimum} min={1} max={30} onChange={(value) => patchMethod(index, { minimum: value })} /><BuilderNumber label="最高值" value={method.maximum} min={1} max={30} onChange={(value) => patchMethod(index, { maximum: value })} /><BuilderInput label="成本表（分数:成本）" value={method.costs} onChange={(value) => patchMethod(index, { costs: value })} className="min-w-80 flex-1" /></>}
                    {method.kind === 'roll' && <><BuilderNumber label="骰子数量" value={method.diceCount} min={1} max={20} onChange={(value) => patchMethod(index, { diceCount: value })} /><BuilderNumber label="骰子面数" value={method.dieSides} min={2} max={1000} onChange={(value) => patchMethod(index, { dieSides: value })} /><BuilderNumber label="舍弃最低骰数量" value={method.dropLowest} min={0} max={19} onChange={(value) => patchMethod(index, { dropLowest: value })} /></>}
                    <button type="button" aria-label={`删除加点规则 ${method.name}`} onClick={() => setMethods((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-auto rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {localError && <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{localError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><Download className="h-4 w-4" /> 下载插件文件</button>
            <button type="button" disabled={busy} onClick={() => void install()} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? '正在保存…' : '保存、启用并发布'}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function BuilderInput({ label, value, onChange, className = '' }: { label: string; value: string; onChange(value: string): void; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(value: number): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}
