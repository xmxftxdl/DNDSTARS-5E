import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BookMarked, BookOpen, Bot, Search, Sparkles, X } from 'lucide-react'
import type { Character } from '../../types/character'
import {
  DND5E_SPELL_CLASS_LABELS,
  DND5E_SPELL_SCHOOL_LABELS,
  dnd5eSpellbookEntriesWithPlugins,
  type Dnd5eSpellbookEntry,
} from '../../rulesets/dnd5e/spellbook'
import {
  dnd5eClassDefinitionForCharacter,
  dnd5eClassProgression,
  dnd5eCombatSpellSelectionLimits,
  dnd5ePactSlotLevel,
  dnd5eSpellSelectionKey,
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginSpells,
  subscribeDnd5eRulesPluginRegistry,
  DND5E_SRD_CLASS_DEFINITIONS,
  dnd5eCharacterClassLevel,
  normalizeDnd5eClassLevels,
  type Dnd5eClassId,
} from '../../rulesets/dnd5e'
import { useSpellbookStore } from '../../store/spellbook'
import { DND5E_SRD_5_1_LICENSE_URL, DND5E_SRD_5_1_SOURCE_URL } from '../../rulesets/dnd5e/srdContent'

const WIZARD_SPELLBOOK_KEY = 'wizard-spellbook'

export default function Dnd5eSpellbookPanel({ character, onChange }: { character: Character; onChange: (patch: Partial<Character>) => void }) {
  const imported = useSpellbookStore((state) => state.spells)
  const pluginRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const [query, setQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [detailSpellId, setDetailSpellId] = useState<string | null>(null)
  const classLevels = normalizeDnd5eClassLevels(character)
  const castingDefinitions = DND5E_SRD_CLASS_DEFINITIONS.filter((candidate) =>
    (classLevels[candidate.id] ?? 0) > 0 && !!candidate.spellcasting)
  const [casterClassId, setCasterClassId] = useState<Dnd5eClassId | undefined>()
  const definition = castingDefinitions.find((candidate) => candidate.id === casterClassId) ?? castingDefinitions[0] ?? dnd5eClassDefinitionForCharacter(character)
  void pluginRevision
  const pluginSpells = registeredDnd5ePluginSpells()
  const allEntries = dnd5eSpellbookEntriesWithPlugins(imported, pluginSpells)
  if (!definition?.spellcasting) return <section className="glass rounded-2xl p-6 text-sm text-slate-500">该职业没有 D&D 5e 2014 施法或契约魔法能力。</section>
  const classLevel = dnd5eCharacterClassLevel(character, definition.id)
  const classCharacter = { ...character, charClass: definition.name, level: classLevel }
  const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, classLevel - 1))]
  const highestSpellLevel = definition.spellcasting.kind === 'pact'
    ? dnd5ePactSlotLevel(classLevel)
    : progression.spellSlots.length
  const limits = dnd5eCombatSpellSelectionLimits(classCharacter)
  const stored = character.dnd5eClassChoices?.classes?.[definition.id] ?? { subclass: definition.subclass.id, selections: {} }
  const selections = stored.selections ?? {}
  const selectionKey = dnd5eSpellSelectionKey(classCharacter)
  const selectedCantrips = [...new Set(selections['spell-cantrips'] ?? [])]
  const selectedSpells = [...new Set(selectionKey ? selections[selectionKey] ?? [] : [])]
  const wizardBook = [...new Set([
    ...(selections[WIZARD_SPELLBOOK_KEY] ?? []),
    ...(definition.id === 'wizard' ? selectedSpells : []),
  ])]
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  const candidates = allEntries.filter((spell) => {
    if (!(spell.classes as readonly string[]).includes(definition.id)) return false
    if (spell.level > highestSpellLevel) return false
    if (spell.level === 0 && (progression.cantripsKnown ?? 0) < 1) return false
    if (levelFilter !== 'all' && spell.level !== Number(levelFilter)) return false
    if (!normalizedQuery) return true
    return `${spell.name} ${spell.englishName ?? ''} ${spell.id}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery)
  })
  const entriesById = new Map(allEntries.map((spell) => [spell.id, spell]))
  const selectedCantripEntries = selectedCantrips.flatMap((id) => entriesById.get(id) ?? [])
  const selectedSpellEntries = selectedSpells.flatMap((id) => entriesById.get(id) ?? [])
  const wizardBookEntries = wizardBook.flatMap((id) => entriesById.get(id) ?? []).filter((spell) => spell.level > 0)
  const availableCandidates = candidates.filter((spell) => spell.level === 0
    ? !selectedCantrips.includes(spell.id)
    : definition.id === 'wizard'
      ? !wizardBook.includes(spell.id)
      : !selectedSpells.includes(spell.id))
  const detailSpell = detailSpellId ? entriesById.get(detailSpellId) : undefined
  const preparationMode = definition.id === 'wizard' || selectionKey === 'spell-prepared'

  const setSelections = (next: Record<string, string[]>) => {
    onChange({
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        classes: {
          ...character.dnd5eClassChoices?.classes,
          [definition.id]: { ...stored, selections: next },
        },
      },
    })
  }

  const toggleCantrip = (id: string) => {
    const selected = selectedCantrips.includes(id)
    if (!selected && selectedCantrips.length >= limits.cantrips) return
    setSelections({
      ...selections,
      'spell-cantrips': selected ? selectedCantrips.filter((spellId) => spellId !== id) : [...selectedCantrips, id],
    })
  }

  const toggleKnownOrPrepared = (id: string) => {
    if (!selectionKey) return
    const selected = selectedSpells.includes(id)
    if (!selected && selectedSpells.length >= limits.spells) return
    if (definition.id === 'wizard' && !wizardBook.includes(id)) return
    setSelections({
      ...selections,
      [selectionKey]: selected ? selectedSpells.filter((spellId) => spellId !== id) : [...selectedSpells, id],
    })
  }

  const toggleWizardBook = (id: string) => {
    const selected = wizardBook.includes(id)
    const nextBook = selected ? wizardBook.filter((spellId) => spellId !== id) : [...wizardBook, id]
    setSelections({
      ...selections,
      [WIZARD_SPELLBOOK_KEY]: nextBook,
      ...(selectionKey && selected ? { [selectionKey]: selectedSpells.filter((spellId) => spellId !== id) } : {}),
    })
  }

  const modeLabel = definition.id === 'wizard'
    ? '法术书与今日准备'
    : definition.spellcasting.kind === 'full-prepared' || definition.spellcasting.kind === 'half-prepared'
      ? '今日准备法术'
      : '已知法术'

  const renderSpellChoice = (spell: Dnd5eSpellbookEntry, showWizardBookAction = true) => <SpellChoice
    key={`${spell.sourceKind}:${spell.id}`}
    spell={spell}
    wizard={definition.id === 'wizard' && showWizardBookAction}
    inWizardBook={wizardBook.includes(spell.id)}
    selected={spell.level === 0 ? selectedCantrips.includes(spell.id) : selectedSpells.includes(spell.id)}
    disabled={spell.level === 0
      ? !selectedCantrips.includes(spell.id) && selectedCantrips.length >= limits.cantrips
      : definition.id !== 'wizard' && !selectedSpells.includes(spell.id) && selectedSpells.length >= limits.spells}
    preparationDisabled={definition.id === 'wizard' && !wizardBook.includes(spell.id)}
    selectionMode={preparationMode ? 'prepared' : 'known'}
    onView={() => setDetailSpellId(spell.id)}
    onToggleBook={() => toggleWizardBook(spell.id)}
    onToggle={() => spell.level === 0 ? toggleCantrip(spell.id) : toggleKnownOrPrepared(spell.id)}
  />

  return <section className="glass rounded-2xl p-5">
    <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2"><BookMarked className="h-5 w-5 text-violet-300" /><h3 className="text-lg font-bold text-slate-100">{definition.name}法术书</h3></div>
        <p className="mt-1 text-sm text-slate-500">{definition.name} {classLevel}级 · {modeLabel} · 最高可学 {highestSpellLevel} 环</p>
        {castingDefinitions.length > 1 && <select aria-label="选择施法职业" value={definition.id} onChange={(event) => setCasterClassId(event.target.value as Dnd5eClassId)} className="mt-3 rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-xs text-slate-200">
          {castingDefinitions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} {classLevels[candidate.id]}级</option>)}
        </select>}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <CountBadge label="戏法" current={selectedCantrips.length} max={limits.cantrips} />
        {definition.id === 'wizard' ? <CountBadge label="法术书" current={wizardBook.length} /> : null}
        <CountBadge label={definition.id === 'wizard' || selectionKey === 'spell-prepared' ? '已准备' : '已知'} current={selectedSpells.length} max={limits.spells} />
      </div>
    </div>

    <div className="mt-4 rounded-xl border border-violet-400/15 bg-violet-500/[0.05] px-4 py-3 text-xs leading-5 text-slate-400">
      {definition.id === 'wizard'
        ? `法师把抄录的 1–${highestSpellLevel} 环法术加入法术书，再从法术书中准备至多 ${limits.spells} 个法术。戏法不写入法术书。升级自动获得和冒险中抄录法术的具体来源由玩家与 DM 确认。`
        : selectionKey === 'spell-prepared'
          ? `长休后可从本职业当前可用法术表中准备至多 ${limits.spells} 个法术。`
          : `当前等级可选择至多 ${limits.spells} 个已知法术；升级时的替换仍由玩家与 DM 按 2014 职业规则确认。`}
    </div>

    <div className="mt-5 space-y-4">
      <SpellCollection
        title="已学习戏法"
        description="这些戏法已记录在角色上，不占用法术位。"
        count={selectedCantripEntries.length}
        empty="尚未学习戏法。"
      >{selectedCantripEntries.map((spell) => renderSpellChoice(spell, false))}</SpellCollection>

      {definition.id === 'wizard' ? <SpellCollection
        title="法术书（已学习法术）"
        description="法师已经抄录或学习的法术；只有这里的法术才能加入今日准备。"
        count={wizardBookEntries.length}
        empty="法术书中还没有一环或更高环级法术。"
      >{wizardBookEntries.map((spell) => renderSpellChoice(spell))}</SpellCollection> : null}

      <SpellCollection
        title={preparationMode ? '今日已准备法术' : '已学习／已知法术'}
        description={preparationMode ? '当前可以使用法术位施放的已准备法术。' : '角色当前已经学习并掌握的法术。'}
        count={selectedSpellEntries.length}
        empty={preparationMode ? '今天尚未准备任何法术。' : '尚未学习任何法术。'}
      >{selectedSpellEntries.map((spell) => renderSpellChoice(spell, false))}</SpellCollection>
    </div>

    <div className="mt-6 border-t border-white/10 pt-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h4 className="text-sm font-semibold text-slate-200">所有可选法术</h4><p className="mt-1 text-xs text-slate-500">已学习或已准备的法术收在上方；在这里搜索尚未选择的职业法术。</p></div>
        <span className="text-xs text-slate-600">当前筛选 {availableCandidates.length} 项</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索法术" className="w-full rounded-xl border border-white/10 bg-void-950/60 py-2.5 pl-9 pr-3 text-sm text-slate-200" /></label>
      <select aria-label="筛选法术环级" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="rounded-xl border border-white/10 bg-void-950/60 px-3 py-2.5 text-sm text-slate-200"><option value="all">全部环级</option>{Array.from({ length: highestSpellLevel + 1 }, (_, value) => <option key={value} value={value}>{value === 0 ? '戏法' : `${value} 环`}</option>)}</select>
      </div>
    </div>

    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {availableCandidates.map((spell) => renderSpellChoice(spell))}
    </div>
    {availableCandidates.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">没有符合条件的未选择法术。</p> : null}
    <p className="mt-4 text-[11px] leading-5 text-slate-600">房间导入和仅目录法术可以正常记录在人物法术书中，但不会出现在自动战斗施法栏；只有带“Headless”标记的法术会自动结算。</p>
    {detailSpell ? <SpellDetailsDialog spell={detailSpell} onClose={() => setDetailSpellId(null)} /> : null}
  </section>
}

function SpellChoice({ spell, wizard, inWizardBook, selected, disabled, preparationDisabled, selectionMode, onView, onToggleBook, onToggle }: {
  spell: Dnd5eSpellbookEntry
  wizard: boolean
  inWizardBook: boolean
  selected: boolean
  disabled: boolean
  preparationDisabled: boolean
  selectionMode: 'known' | 'prepared'
  onView: () => void
  onToggleBook: () => void
  onToggle: () => void
}) {
  const school = spell.imported ? DND5E_SPELL_SCHOOL_LABELS[spell.imported.school] : spell.reference?.school ?? spell.combat?.school
  const description = spell.imported?.description ?? spell.reference?.description ?? spell.combat?.description
  return <div className={`rounded-xl border p-3 ${selected ? 'border-violet-300/30 bg-violet-500/[0.08]' : 'border-white/8 bg-black/10'}`}>
    <button type="button" onClick={onView} className="block w-full rounded-lg text-left outline-none transition hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-violet-400/60" aria-label={`查看${spell.name}详情`}>
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-sm text-slate-100">{spell.name}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{spell.level === 0 ? '戏法' : `${spell.level} 环`}{school ? ` · ${school}` : ''}</span></div>{spell.headless ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-200"><Bot className="h-3 w-3" />Headless</span> : null}</div>
      <span className="mt-2 block text-[10px] leading-4 text-slate-500">职业：{spellClassLabel(spell)}</span>
      {description ? <span className="mt-2 line-clamp-2 block text-[11px] leading-4 text-slate-500">{description}</span> : null}
      <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-violet-300"><BookOpen className="h-3 w-3" />点击查看完整规则</span>
    </button>
    <div className="mt-3 flex flex-wrap gap-2">
      {wizard && spell.level > 0 ? <ToggleButton active={inWizardBook} onClick={onToggleBook} label={inWizardBook ? '移出法术书' : '加入法术书'} /> : null}
      {(!wizard || spell.level === 0 || inWizardBook) ? <ToggleButton
        active={selected}
        disabled={disabled || preparationDisabled}
        onClick={onToggle}
        label={spell.level === 0
          ? (selected ? '移除戏法' : '学习戏法')
          : selectionMode === 'prepared'
            ? (selected ? '取消准备' : '准备')
            : selected ? '移除已知' : '学习法术'}
      /> : null}
    </div>
  </div>
}

function SpellCollection({ title, description, count, empty, children }: {
  title: string
  description: string
  count: number
  empty: string
  children: ReactNode
}) {
  return <section className="rounded-2xl border border-white/8 bg-black/10 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h4 className="text-sm font-semibold text-slate-200">{title}</h4><p className="mt-1 text-xs text-slate-500">{description}</p></div>
      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-slate-300">{count}</span>
    </div>
    {count > 0 ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{children}</div> : <p className="mt-3 rounded-xl border border-dashed border-white/8 px-4 py-5 text-center text-xs text-slate-600">{empty}</p>}
  </section>
}

function spellClassLabel(spell: Dnd5eSpellbookEntry): string {
  return spell.classes.map((classId) => DND5E_SPELL_CLASS_LABELS[classId]).join('、')
}

type ImportedSpell = NonNullable<Dnd5eSpellbookEntry['imported']>

function importedCastingTime(spell: ImportedSpell): string {
  const units = { action: '动作', 'bonus-action': '附赠动作', reaction: '反应', minute: '分钟', hour: '小时' } as const
  return `${spell.castingTime.value} ${units[spell.castingTime.unit]}`
}

function importedRange(spell: ImportedSpell): string {
  const types = { self: '自身', touch: '触及', sight: '视线', unlimited: '无限', special: '特殊' } as const
  const base = spell.range.type === 'distance' ? `${spell.range.feet ?? 0} 尺` : types[spell.range.type]
  if (!spell.range.shape) return base
  const shapes = { cone: '锥形', cube: '立方体', cylinder: '柱形', line: '线形', radius: '半径', sphere: '球形' } as const
  return `${base} · ${spell.range.sizeFeet ?? 0} 尺${shapes[spell.range.shape]}`
}

function importedComponents(spell: ImportedSpell): string {
  const components = [spell.components.verbal ? 'V' : '', spell.components.somatic ? 'S' : '', spell.components.material ? 'M' : ''].filter(Boolean)
  const material = spell.components.materialText ? `（${spell.components.materialText}）` : ''
  return `${components.join('、') || '无'}${material}`
}

function importedDuration(spell: ImportedSpell): string {
  const prefix = spell.duration.concentration ? '专注，至多 ' : ''
  if (spell.duration.type === 'instantaneous') return '立即'
  if (spell.duration.type === 'until-dispelled') return `${prefix}直到被解除`
  if (spell.duration.type === 'special') return `${prefix}特殊`
  const units = { round: '轮', minute: '分钟', hour: '小时', day: '天' } as const
  return `${prefix}${spell.duration.value ?? 0} ${spell.duration.unit ? units[spell.duration.unit] : ''}`
}

function SpellDetailsDialog({ spell, onClose }: { spell: Dnd5eSpellbookEntry; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const reference = spell.reference
  const imported = spell.imported
  const combat = spell.combat
  const school = imported ? DND5E_SPELL_SCHOOL_LABELS[imported.school] : reference?.school ?? combat?.school ?? '未记录'
  const castingTime = reference?.castingTime ?? (imported ? importedCastingTime(imported) : combat?.castingTime === 'bonus-action' ? '1 附赠动作' : combat?.castingTime === 'reaction' ? '1 反应' : '1 动作')
  const range = reference?.range ?? (imported ? importedRange(imported) : combat ? `${combat.rangeFeet} 尺` : '未记录')
  const components = reference?.components ?? (imported ? importedComponents(imported) : '未记录')
  const duration = reference?.duration ?? (imported ? importedDuration(imported) : combat?.concentration ? '专注' : '未记录')
  const description = imported?.description ?? reference?.description ?? combat?.description ?? '该法术尚未附带规则正文。'
  const higherLevels = imported?.higherLevels ?? reference?.higherLevels

  return createPortal(<div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="character-spell-detail-title" className="glass max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/12 p-5 shadow-2xl shadow-black/50">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div><h3 id="character-spell-detail-title" className="text-xl font-bold text-slate-50">{spell.name}</h3>{spell.englishName && spell.englishName !== spell.name ? <p className="mt-1 text-sm text-slate-500">{spell.englishName}</p> : null}<p className="mt-2 text-xs text-slate-400">职业：{spellClassLabel(spell)}</p></div>
        <button type="button" onClick={onClose} aria-label="关闭法术详情" className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SpellDetail label="环级" value={spell.level === 0 ? '戏法' : `${spell.level} 环`} />
        <SpellDetail label="学派" value={school} />
        <SpellDetail label="仪式" value={(imported?.ritual ?? reference?.ritual) ? '是' : '否'} />
        <SpellDetail label="施法时间" value={castingTime} />
        <SpellDetail label="射程／范围" value={range} />
        <SpellDetail label="成分" value={components} />
        <SpellDetail label="持续时间" value={duration} />
        <SpellDetail label="自动结算" value={spell.headless ? '已接入 Headless' : '由 DM 裁定'} />
      </div>
      <SpellRuleBlock title="规则正文" text={description} />
      {higherLevels ? <SpellRuleBlock title="升环效果" text={higherLevels} /> : null}
      {combat && (reference || imported) ? <SpellRuleBlock title="Headless 结算说明" text={combat.description} /> : null}
      <p className="mt-5 rounded-xl border border-white/8 bg-black/10 p-3 text-xs leading-5 text-slate-500">
        {reference ? <>规则目录：<a className="text-violet-300 hover:text-violet-200" href={DND5E_SRD_5_1_SOURCE_URL} target="_blank" rel="noreferrer">英文 SRD 5.1</a> · <a className="text-violet-300 hover:text-violet-200" href={DND5E_SRD_5_1_LICENSE_URL} target="_blank" rel="noreferrer">CC BY 4.0</a><br />中文条目：{spell.name}{spell.englishName ? `（${spell.englishName}）` : ''} · 中文正文已完成语境审校</> : imported ? `房间导入：${imported.source.title} · ${imported.source.publisher} · ${imported.source.license}` : 'SRD 5.1 核心目录 · 中文正文待人工审校，未装载未审校旧正文'}<br />ID：{spell.id}
      </p>
    </section>
  </div>, document.body)
}

function SpellDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><span className="block text-[10px] uppercase tracking-wider text-slate-600">{label}</span><strong className="mt-1 block text-xs leading-5 text-slate-200">{value}</strong></div>
}

function SpellRuleBlock({ title, text }: { title: string; text: string }) {
  return <div className="mt-5"><h4 className="text-sm font-semibold text-slate-200">{title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-400">{text}</p></div>
}

function ToggleButton({ active, disabled, onClick, label }: { active: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-violet-500/20 text-violet-100' : 'bg-white/5 text-slate-400 hover:text-slate-200'}`}>{active ? <Sparkles className="h-3 w-3" /> : null}{label}</button>
}

function CountBadge({ label, current, max }: { label: string; current: number; max?: number }) {
  return <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-slate-400">{label} <strong className="text-slate-100">{current}{max == null ? '' : `/${max}`}</strong></span>
}
