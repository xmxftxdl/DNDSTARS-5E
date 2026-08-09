import { useMemo, useState } from 'react'
import { Braces, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ABILITIES, type AbilityKey } from '../../lib/dnd'
import {
  DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION,
  declarativeClassCompatibilityReportV1,
  validateDeclarativeClassDefinitionV1,
  type DeclarativeClassDefinitionV1,
  type Dnd5eSpellcastingKind,
} from '../../rulesets/dnd5e'

interface Props {
  value: DeclarativeClassDefinitionV1[]
  onChange(value: DeclarativeClassDefinitionV1[]): void
}

const SPELLCASTING: readonly [Dnd5eSpellcastingKind, string][] = [
  ['full-known', '全施法者（已知）'], ['full-prepared', '全施法者（准备）'],
  ['half-known', '半施法者（已知）'], ['half-prepared', '半施法者（准备）'],
  ['one-third-known', '1/3 施法者'], ['pact', '契约魔法'],
]

function csv(value: string): string[] {
  return value.split(/[，,]+/).map((entry) => entry.trim()).filter(Boolean)
}

function createClass(index: number): DeclarativeClassDefinitionV1 {
  return {
    schemaVersion: DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION,
    id: `custom-class-${index}`,
    name: `自定义职业 ${index}`,
    summary: '由内容作者提供的声明式职业。',
    hitDie: 8,
    primaryAbilities: ['str'],
    savingThrows: ['str', 'con'],
    armorProficiencies: [],
    weaponProficiencies: ['简易武器'],
    skills: { choiceCount: 2, options: 'any' },
    multiclassPrerequisites: [{ oneOf: ['str'], minimum: 13 }],
    features: [],
  }
}

export default function Dnd5eDeclarativeClassEditor({ value, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedJson, setAdvancedJson] = useState(() => JSON.stringify(value, null, 2))
  const [advancedError, setAdvancedError] = useState<string | null>(null)
  const validation = useMemo(() => value.flatMap((definition) => {
    try {
      validateDeclarativeClassDefinitionV1(definition, `职业 ${definition.name || definition.id}`)
      return []
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)]
    }
  }), [value])
  const compatibility = useMemo(() => declarativeClassCompatibilityReportV1(value), [value])
  const patchClass = (index: number, patch: Partial<DeclarativeClassDefinitionV1>) => {
    onChange(value.map((definition, itemIndex) => itemIndex === index ? { ...definition, ...patch } : definition))
  }
  const applyAdvancedJson = () => {
    try {
      const parsed = JSON.parse(advancedJson) as unknown
      if (!Array.isArray(parsed)) throw new Error('高级 JSON 必须是职业数组。')
      parsed.forEach((definition, index) => validateDeclarativeClassDefinitionV1(definition, `职业 ${index + 1}`))
      onChange(parsed as DeclarativeClassDefinitionV1[])
      setAdvancedError(null)
    } catch (error) {
      setAdvancedError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">声明式职业协议 V1</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            定义职业底盘、1–20 级特性、升级选择、施法与起始装备。职业进度会自动注册；尚未绑定声明式能力的战斗特性会明确降级为部分自动或 DM 裁定。
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">
            <Braces className="h-3.5 w-3.5" /> 高级 JSON
          </button>
          <button type="button" onClick={() => onChange([...value, createClass(value.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100">
            <Plus className="h-3.5 w-3.5" /> 添加职业
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.04] px-4 py-3 text-xs text-sky-100/75">
        兼容报告：完全自动 {compatibility.full} · 部分自动 {compatibility.partial} · 手动裁定 {compatibility.manual}
        {validation.length > 0 && <span className="ml-2 text-rose-300">· {validation[0]}</span>}
      </div>

      {advancedOpen && (
        <section className="mb-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.035] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">可编辑完整 V1 协议，包括起始装备、升级选择和 20 级施法表；只接受纯 JSON。</p>
            <button type="button" onClick={() => { setAdvancedJson(JSON.stringify(value, null, 2)); setAdvancedError(null) }} className="inline-flex items-center gap-1 text-xs text-violet-200">
              <RefreshCw className="h-3.5 w-3.5" /> 从表单刷新
            </button>
          </div>
          <textarea aria-label="职业高级 JSON" value={advancedJson} onChange={(event) => setAdvancedJson(event.target.value)} rows={18} spellCheck={false} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40" />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-rose-300">{advancedError}</p>
            <button type="button" onClick={applyAdvancedJson} className="rounded-xl bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100">校验并应用 JSON</button>
          </div>
        </section>
      )}

      <div className="space-y-4">
        {value.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-600">尚未添加职业。</p>}
        {value.map((definition, index) => (
          <article key={`${definition.id}-${index}`} className="rounded-2xl border border-sky-400/12 bg-black/15 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="职业 ID" value={definition.id} onChange={(id) => patchClass(index, { id })} />
              <Field label="中文名称" value={definition.name} onChange={(name) => patchClass(index, { name })} />
              <NumberField label="生命骰" value={definition.hitDie} min={6} max={12} step={2} onChange={(hitDie) => patchClass(index, { hitDie: hitDie as 6 | 8 | 10 | 12 })} />
              <NumberField label="技能选择数" value={definition.skills.choiceCount} min={0} max={18} onChange={(choiceCount) => patchClass(index, { skills: { ...definition.skills, choiceCount } })} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextArea label="职业摘要" value={definition.summary} onChange={(summary) => patchClass(index, { summary })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="护甲熟练（逗号分隔）" value={definition.armorProficiencies.join(', ')} onChange={(text) => patchClass(index, { armorProficiencies: csv(text) })} />
                <Field label="武器熟练（逗号分隔）" value={definition.weaponProficiencies.join(', ')} onChange={(text) => patchClass(index, { weaponProficiencies: csv(text) })} />
                <Field label="可选技能 ID（any 或逗号分隔）" value={definition.skills.options === 'any' ? 'any' : definition.skills.options.join(', ')} onChange={(text) => patchClass(index, { skills: { ...definition.skills, options: text.trim() === 'any' ? 'any' : csv(text) } })} />
                <Field label="工具熟练（逗号分隔）" value={(definition.toolProficiencies ?? []).join(', ')} onChange={(text) => patchClass(index, { toolProficiencies: csv(text) })} />
              </div>
            </div>
            <fieldset className="mt-3 rounded-xl border border-white/8 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-500">主属性与豁免熟练</legend>
              <div className="flex flex-wrap gap-2">
                {ABILITIES.map((ability) => (
                  <label key={ability.key} className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-2 text-xs text-slate-400">
                    <input type="checkbox" checked={definition.primaryAbilities.includes(ability.key)} onChange={(event) => patchClass(index, {
                      primaryAbilities: event.target.checked ? [...definition.primaryAbilities, ability.key] : definition.primaryAbilities.filter((entry) => entry !== ability.key),
                    })} /> 主属性：{ability.label}
                  </label>
                ))}
                {ABILITIES.map((ability) => (
                  <label key={`save-${ability.key}`} className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-2 text-xs text-slate-400">
                    <input type="checkbox" checked={definition.savingThrows.includes(ability.key)} onChange={(event) => {
                      const current = [...definition.savingThrows]
                      const next = event.target.checked ? [...current, ability.key].slice(-2) : current.filter((entry) => entry !== ability.key)
                      if (next.length === 2) patchClass(index, { savingThrows: next as [AbilityKey, AbilityKey] })
                    }} /> 豁免：{ability.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <section className="mt-3 rounded-xl border border-white/8 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-xs font-semibold text-slate-300">子职入口</h4><p className="mt-1 text-[10px] text-slate-600">这里只定义基础职业何时选择子职；具体子职内容仍在“子职”编辑器中创建。</p></div>
                <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={!!definition.subclass} onChange={(event) => patchClass(index, { subclass: event.target.checked ? { level: 3, id: 'subclass', name: '基础子职', summary: '请填写子职说明。' } : undefined })} /> 启用子职</label>
              </div>
              {definition.subclass && <div className="mt-3 grid gap-3 md:grid-cols-[100px_1fr_1fr_2fr]">
                <NumberField label="选择等级" value={definition.subclass.level} min={1} max={20} onChange={(level) => patchClass(index, { subclass: { ...definition.subclass!, level } })} />
                <Field label="默认子职 ID" value={definition.subclass.id} onChange={(id) => patchClass(index, { subclass: { ...definition.subclass!, id } })} />
                <Field label="默认子职名称" value={definition.subclass.name} onChange={(name) => patchClass(index, { subclass: { ...definition.subclass!, name } })} />
                <Field label="子职说明" value={definition.subclass.summary} onChange={(summary) => patchClass(index, { subclass: { ...definition.subclass!, summary } })} />
              </div>}
            </section>

            <section className="mt-3 rounded-xl border border-white/8 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-xs font-semibold text-slate-300">施法协议</h4><p className="mt-1 text-[10px] text-slate-600">法术目录仍需把该职业 ID 列入可用职业。</p></div>
                <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={!!definition.spellcasting} onChange={(event) => patchClass(index, { spellcasting: event.target.checked ? { kind: 'full-known', ability: 'int', ritualCasting: false, focus: '无' } : undefined })} /> 启用施法</label>
              </div>
              {definition.spellcasting && <div className="mt-3 grid gap-3 md:grid-cols-4">
                <SelectField label="施法类型" value={definition.spellcasting.kind} options={SPELLCASTING} onChange={(kind) => patchClass(index, { spellcasting: { ...definition.spellcasting!, kind: kind as Dnd5eSpellcastingKind } })} />
                <SelectField label="施法属性" value={definition.spellcasting.ability} options={ABILITIES.map((ability) => [ability.key, ability.label])} onChange={(ability) => patchClass(index, { spellcasting: { ...definition.spellcasting!, ability: ability as AbilityKey } })} />
                <Field label="法器" value={definition.spellcasting.focus} onChange={(focus) => patchClass(index, { spellcasting: { ...definition.spellcasting!, focus } })} />
                <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={definition.spellcasting.ritualCasting} onChange={(event) => patchClass(index, { spellcasting: { ...definition.spellcasting!, ritualCasting: event.target.checked } })} /> 仪式施法</label>
              </div>}
            </section>

            <section className="mt-3 rounded-xl border border-white/8 p-3">
              <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-semibold text-slate-300">1–20 级职业特性</h4><button type="button" onClick={() => patchClass(index, { features: [...definition.features, { id: `feature-${definition.features.length + 1}`, level: 1, name: '新特性', description: '请填写规则正文。', automation: 'manual' }] })} className="inline-flex items-center gap-1 text-xs text-sky-200"><Plus className="h-3.5 w-3.5" /> 添加等级特性</button></div>
              <div className="space-y-2">
                {definition.features.map((feature, featureIndex) => (
                  <div key={`${feature.id}-${featureIndex}`} className="grid gap-2 rounded-xl bg-white/[0.025] p-3 md:grid-cols-[1fr_100px_1fr_140px_auto]">
                    <Field label="特性 ID" value={feature.id} onChange={(id) => patchClass(index, { features: definition.features.map((entry, entryIndex) => entryIndex === featureIndex ? { ...entry, id } : entry) })} />
                    <NumberField label="等级" value={feature.level} min={1} max={20} onChange={(level) => patchClass(index, { features: definition.features.map((entry, entryIndex) => entryIndex === featureIndex ? { ...entry, level } : entry) })} />
                    <Field label="名称" value={feature.name} onChange={(name) => patchClass(index, { features: definition.features.map((entry, entryIndex) => entryIndex === featureIndex ? { ...entry, name } : entry) })} />
                    <SelectField label="期望自动化" value={feature.automation} options={[["full", "完全"], ["partial", "部分"], ["manual", "手动"]]} onChange={(automation) => patchClass(index, { features: definition.features.map((entry, entryIndex) => entryIndex === featureIndex ? { ...entry, automation: automation as 'full' | 'partial' | 'manual' } : entry) })} />
                    <button type="button" aria-label={`删除职业特性 ${feature.name}`} onClick={() => patchClass(index, { features: definition.features.filter((_, entryIndex) => entryIndex !== featureIndex) })} className="self-end rounded-lg p-2 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                    <div className="md:col-span-5"><TextArea label="规则正文" value={feature.description} onChange={(description) => patchClass(index, { features: definition.features.map((entry, entryIndex) => entryIndex === featureIndex ? { ...entry, description } : entry) })} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-3 rounded-xl border border-white/8 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><h4 className="text-xs font-semibold text-slate-300">职业升级节点</h4><p className="mt-1 text-[10px] text-slate-600">由 Host 按职业等级授予同一扩展中的特性，并声明 ASI、子职入口和每次攻击动作的攻击次数。</p></div>
                <button type="button" onClick={() => {
                  const advancements = definition.advancements ?? []
                  const level = Math.min(20, Math.max(1, ...advancements.map((entry) => entry.level + 1)))
                  patchClass(index, { advancements: [...advancements, { level }] })
                }} className="inline-flex items-center gap-1 text-xs text-sky-200"><Plus className="h-3.5 w-3.5" /> 添加升级节点</button>
              </div>
              <div className="space-y-2">
                {(definition.advancements ?? []).map((advancement, advancementIndex) => (
                  <div key={`${advancement.level}-${advancementIndex}`} className="grid gap-2 rounded-xl bg-white/[0.025] p-3 md:grid-cols-[90px_1fr_auto]">
                    <NumberField label="职业等级" value={advancement.level} min={1} max={20} onChange={(level) => patchClass(index, { advancements: definition.advancements?.map((entry, entryIndex) => entryIndex === advancementIndex ? { ...entry, level } : entry) })} />
                    <Field label="授予特性 ID（同扩展，逗号分隔）" value={(advancement.grants ?? []).join(', ')} onChange={(text) => patchClass(index, { advancements: definition.advancements?.map((entry, entryIndex) => entryIndex === advancementIndex ? { ...entry, grants: csv(text) } : entry) })} />
                    <button type="button" aria-label={`删除 ${advancement.level} 级升级节点`} onClick={() => patchClass(index, { advancements: definition.advancements?.filter((_, entryIndex) => entryIndex !== advancementIndex) })} className="self-end rounded-lg p-2 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                    <div className="flex flex-wrap items-center gap-4 md:col-span-3">
                      <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={advancement.subclassChoice === true} onChange={(event) => patchClass(index, { advancements: definition.advancements?.map((entry, entryIndex) => entryIndex === advancementIndex ? { ...entry, subclassChoice: event.target.checked || undefined } : entry) })} /> 选择子职</label>
                      <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={advancement.abilityScoreImprovement === true} onChange={(event) => patchClass(index, { advancements: definition.advancements?.map((entry, entryIndex) => entryIndex === advancementIndex ? { ...entry, abilityScoreImprovement: event.target.checked || undefined } : entry) })} /> 属性值提升 / 专长</label>
                      <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={advancement.attacksPerAction != null} onChange={(event) => patchClass(index, { advancements: definition.advancements?.map((entry, entryIndex) => entryIndex === advancementIndex ? { ...entry, attacksPerAction: event.target.checked ? 2 : undefined } : entry) })} /> Extra Attack</label>
                      {advancement.attacksPerAction != null && <div className="w-32"><NumberField label="攻击次数" value={advancement.attacksPerAction} min={1} max={10} onChange={(attacksPerAction) => patchClass(index, { advancements: definition.advancements?.map((entry, entryIndex) => entryIndex === advancementIndex ? { ...entry, attacksPerAction } : entry) })} /></div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-3 rounded-xl border border-white/8 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><h4 className="text-xs font-semibold text-slate-300">职业资源成长</h4><p className="mt-1 text-[10px] text-slate-600">等级表从 1 级开始，表较短时沿用最后一个值；资源 ID 会自动加上扩展命名空间。</p></div>
                <button type="button" onClick={() => patchClass(index, { resources: [...(definition.resources ?? []), { id: `resource-${(definition.resources?.length ?? 0) + 1}`, label: '新职业资源', resetOn: 'long-rest', maximumByLevel: [1] }] })} className="inline-flex items-center gap-1 text-xs text-sky-200"><Plus className="h-3.5 w-3.5" /> 添加资源</button>
              </div>
              <div className="space-y-2">
                {(definition.resources ?? []).map((resource, resourceIndex) => (
                  <div key={`${resource.id}-${resourceIndex}`} className="grid gap-2 rounded-xl bg-white/[0.025] p-3 md:grid-cols-[1fr_1fr_150px_1fr_auto]">
                    <Field label="资源 ID" value={resource.id} onChange={(id) => patchClass(index, { resources: definition.resources?.map((entry, entryIndex) => entryIndex === resourceIndex ? { ...entry, id } : entry) })} />
                    <Field label="显示名称" value={resource.label} onChange={(label) => patchClass(index, { resources: definition.resources?.map((entry, entryIndex) => entryIndex === resourceIndex ? { ...entry, label } : entry) })} />
                    <SelectField label="恢复周期" value={resource.resetOn} options={[["combat", "每场战斗"], ["short-rest", "短休"], ["long-rest", "长休"]]} onChange={(resetOn) => patchClass(index, { resources: definition.resources?.map((entry, entryIndex) => entryIndex === resourceIndex ? { ...entry, resetOn: resetOn as 'combat' | 'short-rest' | 'long-rest' } : entry) })} />
                    <Field label="1～20 级最大值（逗号分隔）" value={resource.maximumByLevel.join(', ')} onChange={(text) => patchClass(index, { resources: definition.resources?.map((entry, entryIndex) => entryIndex === resourceIndex ? { ...entry, maximumByLevel: csv(text).map(Number) } : entry) })} />
                    <button type="button" aria-label={`删除职业资源 ${resource.label}`} onClick={() => patchClass(index, { resources: definition.resources?.filter((_, entryIndex) => entryIndex !== resourceIndex) })} className="self-end rounded-lg p-2 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </section>
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/15 px-3 py-2 text-xs font-semibold text-rose-300"><Trash2 className="h-3.5 w-3.5" /> 删除职业</button></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/40" /></label>
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange(value: number): void }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-lg border border-white/10 bg-void-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/40" /></label>
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span><textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900/80 px-3 py-2 text-xs leading-5 text-slate-100 outline-none focus:border-sky-400/40" /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/40">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
}
