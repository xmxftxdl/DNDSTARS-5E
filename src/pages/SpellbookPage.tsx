import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  BookOpen, Bot, ChevronRight, Download, FileJson, Filter, Search, ShieldCheck, Trash2, Upload,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { modeFromPort } from '../lib/appMode'
import { getRoomSession } from '../lib/roomSession'
import {
  DND5E_SPELL_CLASS_LABELS,
  DND5E_SPELL_SCHOOL_LABELS,
  DND5E_SPELLCASTING_CLASS_IDS,
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  dnd5eSpellbookEntriesWithPlugins,
  parseDnd5eSpellImportFile,
  type Dnd5eImportedSpell,
  type Dnd5eSpellbookEntry,
  type Dnd5eSpellcastingClassId,
} from '../rulesets/dnd5e/spellbook'
import {
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginSpells,
  subscribeDnd5eRulesPluginRegistry,
} from '../rulesets/dnd5e/pluginApi'
import { useSpellbookStore } from '../store/spellbook'
import { dnd5eConditionLabel } from '../rulesets/dnd5e/conditions'
import {
  DND5E_SRD_5_1_LICENSE_URL,
  DND5E_SRD_5_1_SOURCE_URL,
  DND5E_SRD_5_1_TRANSLATION_NOTICE,
} from '../rulesets/dnd5e/srdContent'

type SourceFilter = 'all' | 'srd-core' | 'room-import'
type AutomationFilter = 'all' | 'headless' | 'adjudication'

function levelLabel(level: number): string {
  return level === 0 ? '戏法' : `${level} 环`
}

function sourceLabel(entry: Dnd5eSpellbookEntry): string {
  if (entry.sourceKind === 'room-import') return '房间导入'
  return 'SRD 5.1 · 中文资料'
}

function castingTimeLabel(spell: Dnd5eImportedSpell): string {
  const units = {
    action: '动作',
    'bonus-action': '附赠动作',
    reaction: '反应',
    minute: '分钟',
    hour: '小时',
  } as const
  if (spell.castingTime.unit === 'action' || spell.castingTime.unit === 'bonus-action' || spell.castingTime.unit === 'reaction') {
    return `${spell.castingTime.value > 1 ? spell.castingTime.value : ''}${units[spell.castingTime.unit]}`
  }
  return `${spell.castingTime.value} ${units[spell.castingTime.unit]}`
}

function rangeLabel(spell: Dnd5eImportedSpell): string {
  const types = { self: '自身', touch: '触及', sight: '视线', unlimited: '无限', special: '特殊', distance: '' }
  const base = spell.range.type === 'distance' ? `${spell.range.feet ?? 0} 尺` : types[spell.range.type]
  if (!spell.range.shape) return base
  const shapes = { cone: '锥形', cube: '立方体', cylinder: '柱形', line: '线形', radius: '半径', sphere: '球形' }
  return `${base} · ${spell.range.sizeFeet ?? 0} 尺${shapes[spell.range.shape]}`
}

function componentLabel(spell: Dnd5eImportedSpell): string {
  const values = [
    spell.components.verbal ? 'V' : '',
    spell.components.somatic ? 'S' : '',
    spell.components.material ? 'M' : '',
  ].filter(Boolean)
  return values.length > 0 ? values.join('、') : '无'
}

function durationLabel(spell: Dnd5eImportedSpell): string {
  const prefix = spell.duration.concentration ? '专注，至多 ' : ''
  if (spell.duration.type === 'instantaneous') return '立即'
  if (spell.duration.type === 'until-dispelled') return `${prefix}直到被解除`
  if (spell.duration.type === 'special') return `${prefix}特殊`
  const units = { round: '轮', minute: '分钟', hour: '小时', day: '天' }
  return `${prefix}${spell.duration.value ?? 0} ${spell.duration.unit ? units[spell.duration.unit] : ''}`
}

function mechanicsLabel(spell: Dnd5eImportedSpell): string | undefined {
  const mechanics = spell.mechanics
  if (!mechanics) return undefined
  const lines: string[] = []
  const resolutions = {
    'spell-attack': '法术攻击', 'saving-throw': '豁免', automatic: '自动生效', 'dm-adjudication': 'DM 裁定',
  } as const
  lines.push(`结算方式：${resolutions[mechanics.resolution]}`)
  if (mechanics.savingThrow) {
    const abilities = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }
    const outcomes = { none: '成功不受影响', half: '成功伤害减半', full: '成功仍承受完整效果' }
    lines.push(`豁免：${abilities[mechanics.savingThrow.ability]}；${outcomes[mechanics.savingThrow.onSuccess]}`)
  }
  if (mechanics.damage) {
    const { dice } = mechanics.damage
    const damageTypes = {
      acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场', lightning: '闪电',
      necrotic: '黯蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵', radiant: '光耀', slashing: '挥砍', thunder: '雷鸣',
    }
    lines.push(`伤害：${dice.count}d${dice.sides}${dice.bonus ? `${dice.bonus > 0 ? '+' : ''}${dice.bonus}` : ''} ${damageTypes[mechanics.damage.type]}`)
  }
  for (const effect of mechanics.conditions ?? []) {
    lines.push(`状态：${dnd5eConditionLabel(effect.condition)}（${effect.trigger === 'on-hit' ? '命中时' : effect.trigger === 'on-failed-save' ? '豁免失败时' : '生效时'}）`)
  }
  if (mechanics.upcast) lines.push(`升环：从 ${mechanics.upcast.fromSlotLevel} 环开始，包含 ${mechanics.upcast.effects.length} 项结构化增益`)
  return lines.join('\n')
}

function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export default function SpellbookPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const imported = useSpellbookStore((state) => state.spells)
  const importSpells = useSpellbookStore((state) => state.importSpells)
  const removeSpell = useSpellbookStore((state) => state.removeSpell)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [classId, setClassId] = useState<'all' | Dnd5eSpellcastingClassId>('all')
  const [source, setSource] = useState<SourceFilter>('all')
  const [automation, setAutomation] = useState<AutomationFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isDM = (getRoomSession()?.role ?? modeFromPort()) !== 'player'
  const pluginRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const entries = useMemo(() => {
    void pluginRevision
    return dnd5eSpellbookEntriesWithPlugins(imported, registeredDnd5ePluginSpells())
  }, [imported, pluginRevision])
  const headlessCount = entries.filter((entry) => entry.headless).length
  const adjudicationCount = entries.length - headlessCount
  const reviewedTranslationCount = entries.filter((entry) => entry.translationStatus === 'context-reviewed').length
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
    return entries.filter((entry) => {
      if (level !== 'all' && entry.level !== Number(level)) return false
      if (classId !== 'all' && !entry.classes.includes(classId)) return false
      if (automation === 'headless' && !entry.headless) return false
      if (automation === 'adjudication' && entry.headless) return false
      if (source === 'srd-core' && entry.sourceKind !== 'srd-core') return false
      if (source === 'room-import' && entry.sourceKind !== 'room-import') return false
      if (!normalizedQuery) return true
      return `${entry.name} ${entry.englishName ?? ''} ${entry.id}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery)
    })
  }, [automation, classId, entries, level, query, source])
  const selected = filtered.find((entry) => entry.id === selectedId) ?? filtered[0]

  const importFile = async (file: File) => {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const bundle = await parseDnd5eSpellImportFile(file)
      const result = await importSpells(bundle.spells)
      setNotice(`已导入 ${bundle.spells.length} 个法术：新增 ${result.added} 个，更新 ${result.replaced} 个。房间玩家将自动同步。`)
      setSelectedId(bundle.spells[0]?.id ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (spell: Dnd5eImportedSpell) => {
    if (!window.confirm(`从房间法术书移除“${spell.name}”？角色存档中的法术 ID 会保留，但在重新导入前只显示为缺失资料。`)) return
    setBusy(true)
    setError(null)
    try {
      await removeSpell(spell.id)
      setSelectedId(null)
      setNotice(`已移除 ${spell.name}。`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="法术书"
        description="D&D 5e 2014 · SRD 5.1 法术目录、角色选法术资料与房间自定义法术。"
        actions={isDM ? <div className="flex flex-wrap gap-2">
          <a href="/spell-templates/dnd5e-2014-spell-template.json" download className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 hover:text-white">
            <Download className="h-4 w-4" />下载法术模板
          </a>
          {imported.length > 0 ? <button
            type="button"
            onClick={() => downloadJson('dndstars5e-room-spells.json', {
              format: DND5E_SPELL_IMPORT_FORMAT,
              schemaVersion: DND5E_SPELL_IMPORT_SCHEMA_VERSION,
              spells: imported,
            })}
            className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 hover:text-white"
          ><FileJson className="h-4 w-4" />导出房间法术</button> : null}
          <input
            ref={fileRef}
            type="file"
            accept=".json,.dndstars5e-spells,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void importFile(file)
              event.currentTarget.value = ''
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="glow-arcane flex items-center gap-2 rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          ><Upload className="h-4 w-4" />{busy ? '正在处理…' : '导入法术 JSON'}</button>
        </div> : undefined}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Summary icon={BookOpen} label="SRD 5.1 法术目录" value="319" />
        <Summary icon={Bot} label="已接入 Headless" value={`${headlessCount}`} />
        <Summary icon={ShieldCheck} label="需要 DM 裁定" value={`${adjudicationCount}`} />
        <Summary icon={FileJson} label="已完成语境审校" value={`${reviewedTranslationCount} / 319`} />
      </div>

      <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3 text-sm leading-6 text-sky-100">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0" /><p>
          SRD 5.1 核心目录共 319 个法术；其中 {reviewedTranslationCount} 个已按英文 SRD 5.1 完成语境翻译与逐条复核，其余条目只保留目录信息。{DND5E_SRD_5_1_TRANSLATION_NOTICE}规则正文完整不代表已自动结算：标有“Headless”的法术才能自动处理伤害、豁免和状态；其他法术仍由 DM 依据英文 SRD 裁定。
        </p></div>
      </div>
      {notice ? <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}
      {error ? <p className="mb-4 rounded-xl border border-red-400/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <section className="glass mb-4 grid gap-3 rounded-2xl p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(130px,auto))]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名、英文名或 ID" className="w-full rounded-xl border border-white/10 bg-void-950/60 py-2.5 pl-10 pr-3 text-sm text-slate-100" />
        </label>
        <FilterSelect value={level} onChange={setLevel} label="环级" options={[
          { value: 'all', label: '全部环级' },
          ...Array.from({ length: 10 }, (_, value) => ({ value: String(value), label: levelLabel(value) })),
        ]} />
        <FilterSelect value={classId} onChange={(value) => setClassId(value as typeof classId)} label="职业" options={[
          { value: 'all', label: '全部职业' },
          ...DND5E_SPELLCASTING_CLASS_IDS.map((value) => ({ value, label: DND5E_SPELL_CLASS_LABELS[value] })),
        ]} />
        <FilterSelect value={source} onChange={(value) => setSource(value as SourceFilter)} label="来源" options={[
          { value: 'all', label: '全部来源' },
          { value: 'srd-core', label: 'SRD 5.1' },
          { value: 'room-import', label: '房间导入' },
        ]} />
        <FilterSelect value={automation} onChange={(value) => setAutomation(value as AutomationFilter)} label="自动化状态" options={[
          { value: 'all', label: `全部状态（${entries.length}）` },
          { value: 'headless', label: `已接入 Headless（${headlessCount}）` },
          { value: 'adjudication', label: `需要 DM 裁定（${adjudicationCount}）` },
        ]} />
      </section>

      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)]">
        <section className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-4 py-3 text-xs text-slate-500">找到 {filtered.length} 个法术</div>
          <div className="max-h-[720px] overflow-y-auto p-2">
            {filtered.map((entry) => <button
              key={`${entry.sourceKind}:${entry.id}`}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected?.id === entry.id ? 'bg-arcane-500/15 ring-1 ring-arcane-400/30' : 'hover:bg-white/5'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-200">{entry.level}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-100">{entry.name}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-500">{entry.englishName && entry.englishName !== entry.name ? `${entry.englishName} · ` : ''}{sourceLabel(entry)}</span></span>
              <AutomationBadge headless={entry.headless} compact />
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
            </button>)}
            {filtered.length === 0 ? <p className="px-4 py-16 text-center text-sm text-slate-500">没有符合条件的法术。</p> : null}
          </div>
        </section>
        <SpellDetails entry={selected} isDM={isDM} busy={busy} onRemove={(spell) => void remove(spell)} />
      </div>
    </div>
  )
}

function SpellDetails({ entry, isDM, busy, onRemove }: { entry?: Dnd5eSpellbookEntry; isDM: boolean; busy: boolean; onRemove: (spell: Dnd5eImportedSpell) => void }) {
  if (!entry) return <section className="glass flex items-center justify-center rounded-2xl text-sm text-slate-500">选择一个法术查看详情。</section>
  const imported = entry.imported
  const combat = entry.combat
  const reference = entry.reference
  return <section className="glass rounded-2xl p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
      <div><h2 className="text-2xl font-bold text-slate-50">{entry.name}</h2>{entry.englishName && entry.englishName !== entry.name ? <p className="mt-1 text-sm text-slate-500">{entry.englishName}</p> : null}</div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.sourceKind === 'room-import' ? 'bg-sky-500/10 text-sky-200' : 'bg-slate-500/10 text-slate-400'}`}>{sourceLabel(entry)}</span>
        {entry.sourceKind === 'srd-core' ? <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.translationStatus === 'context-reviewed' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>{entry.translationStatus === 'context-reviewed' ? '中文已审校' : '正文待翻译'}</span> : null}
        <AutomationBadge headless={entry.headless} />
        {isDM && imported ? <button type="button" disabled={busy} onClick={() => onRemove(imported)} title="移除房间法术" className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="h-4 w-4" /></button> : null}
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Detail label="环级" value={levelLabel(entry.level)} />
      <Detail label="学派" value={imported ? DND5E_SPELL_SCHOOL_LABELS[imported.school] : reference?.school ?? combat?.school ?? '待补充'} />
      <Detail label="仪式" value={(imported?.ritual ?? reference?.ritual) ? '是' : '否'} />
      <Detail label="职业" value={entry.classes.map((id) => DND5E_SPELL_CLASS_LABELS[id]).join('、')} />
      {imported ? <>
        <Detail label="施法时间" value={castingTimeLabel(imported)} />
        <Detail label="射程／范围" value={rangeLabel(imported)} />
        <Detail label="成分" value={componentLabel(imported)} />
        <Detail label="持续时间" value={durationLabel(imported)} />
      </> : reference ? <>
        <Detail label="施法时间" value={reference.castingTime} />
        <Detail label="射程／范围" value={reference.range} />
        <Detail label="成分" value={reference.components} />
        <Detail label="持续时间" value={reference.duration} />
      </> : combat ? <>
        <Detail label="施法时间" value={combat.castingTime === 'bonus-action' ? '附赠动作' : combat.castingTime === 'reaction' ? '反应' : '动作'} />
        <Detail label="射程" value={`${combat.rangeFeet} 尺`} />
        <Detail label="目标" value={combat.target === 'area' ? '区域' : combat.target === 'ally' ? '友方' : '敌方'} />
        <Detail label="专注" value={combat.concentration ? '需要' : '不需要'} />
      </> : null}
    </div>
    {imported?.castingTime.reactionTrigger ? <RuleBlock title="反应触发条件" text={imported.castingTime.reactionTrigger} /> : null}
    {imported?.components.materialText ? <RuleBlock title="材料成分" text={`${imported.components.materialText}${imported.components.materialCostGp ? `（价值 ${imported.components.materialCostGp} gp）` : ''}${imported.components.materialConsumed ? '，会被消耗' : ''}`} /> : null}
    {imported ? <RuleBlock title="法术描述" text={imported.description} /> : reference ? <RuleBlock title="规则正文" text={reference.description} /> : <RuleBlock title="规则正文" text="该法术的中文资料缺失，请检查构建时的 319 条目录完整性测试。" />}
    {(imported?.higherLevels ?? reference?.higherLevels) ? <RuleBlock title="升环效果" text={imported?.higherLevels ?? reference?.higherLevels ?? ''} /> : null}
    {imported && mechanicsLabel(imported) ? <RuleBlock title="结构化机械模板（不授予自动执行权限）" text={mechanicsLabel(imported) ?? ''} /> : null}
    {combat ? <RuleBlock title="Headless 结算说明" text={combat.description} /> : null}
    {imported ? <div className="mt-5 rounded-xl border border-white/8 bg-black/10 p-3 text-xs leading-5 text-slate-500">来源：{imported.source.title} · 发布者：{imported.source.publisher} · 许可证：{imported.source.license}<br />ID：{imported.id}</div> : reference ? <div className="mt-5 rounded-xl border border-white/8 bg-black/10 p-3 text-xs leading-5 text-slate-500">规则目录：<a className="text-violet-300 hover:text-violet-200" href={DND5E_SRD_5_1_SOURCE_URL} target="_blank" rel="noreferrer">英文 SRD 5.1</a> · <a className="text-violet-300 hover:text-violet-200" href={DND5E_SRD_5_1_LICENSE_URL} target="_blank" rel="noreferrer">CC BY 4.0</a><br />中文条目：{entry.name}（{entry.englishName}）· SRD ID：{entry.id}<br />中文正文：已按英文 SRD 5.1 完成语境审校 · 自动结算：{entry.headless ? '已接入 Headless' : '尚未接入，由 DM 裁定'}</div> : <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80">该法术属于 SRD 5.1 目录，但中文规则正文尚未完成人工审校，因此核心包不显示未审校旧正文。请由 DM 依据英文 SRD 5.1 裁定。<br />ID：{entry.id}</div>}
  </section>
}

function Summary({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return <div className="glass flex items-center gap-3 rounded-2xl p-4"><span className="rounded-xl bg-arcane-500/10 p-2.5"><Icon className="h-5 w-5 text-arcane-300" /></span><span><span className="block text-xs text-slate-500">{label}</span><strong className="mt-0.5 block text-xl text-slate-100">{value}</strong></span></div>
}

function AutomationBadge({ headless, compact = false }: { headless: boolean; compact?: boolean }) {
  const label = headless ? (compact ? 'HEADLESS' : '已接入 HEADLESS') : 'DM 裁定'
  return <span
    title={headless ? '该法术已接入自动战斗结算' : '该法术尚未接入自动结算，需要 DM 按规则正文裁定'}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold tracking-wide ${compact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1 text-[11px]'} ${headless ? 'border-emerald-300/25 bg-emerald-500/15 text-emerald-100' : 'border-amber-300/20 bg-amber-500/10 text-amber-100'}`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${headless ? 'bg-emerald-300' : 'bg-amber-300'}`} />
    {label}
  </span>
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<{ value: string; label: string }> }) {
  return <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-950/60 py-2.5 pl-9 pr-8 text-sm text-slate-200">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><span className="block text-[10px] uppercase tracking-wider text-slate-600">{label}</span><strong className="mt-1 block text-xs leading-5 text-slate-200">{value}</strong></div>
}

function RuleBlock({ title, text }: { title: string; text: string }) {
  return <div className="mt-5"><h3 className="text-sm font-semibold text-slate-200">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-400">{text}</p></div>
}
