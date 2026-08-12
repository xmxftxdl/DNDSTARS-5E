import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  Dnd5eMonsterAbilityTemplate,
  Dnd5eMonsterAbilityTemplateSection,
} from '../../rulesets/dnd5e/monsterWorkshopAbilityTemplates'

const SECTION_OPTIONS: readonly [Dnd5eMonsterAbilityTemplateSection | 'all', string][] = [
  ['all', '全部'],
  ['trait', '特性'],
  ['action', '动作'],
  ['bonus-action', '附赠动作'],
  ['reaction', '反应'],
  ['legendary', '传奇动作'],
  ['lair', '巢穴动作'],
]

const SECTION_LABELS = Object.fromEntries(SECTION_OPTIONS) as Record<
  Dnd5eMonsterAbilityTemplateSection | 'all',
  string
>

const MAX_VISIBLE_RESULTS = 120

interface Dnd5eMonsterAbilityTemplateLibraryProps {
  open: boolean
  templates: readonly Dnd5eMonsterAbilityTemplate[]
  initialSection?: Dnd5eMonsterAbilityTemplateSection | 'all'
  onAdd: (template: Dnd5eMonsterAbilityTemplate) => void
  onClose: () => void
}

export default function Dnd5eMonsterAbilityTemplateLibrary({
  open,
  templates,
  initialSection = 'all',
  onAdd,
  onClose,
}: Dnd5eMonsterAbilityTemplateLibraryProps) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<Dnd5eMonsterAbilityTemplateSection | 'all'>(initialSection)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN')
    return templates.filter((template) =>
      (section === 'all' || template.section === section) &&
      (!needle || template.searchText.includes(needle)))
  }, [query, section, templates])

  if (!open) return null

  return <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Headless 怪物能力模板库" onClick={(event) => { event.stopPropagation(); onClose() }}>
    <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-void-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Headless 怪物能力模板库</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            从已验证的怪物图鉴复制完整规则。共享空间、吞没、携带、逃脱、持续伤害等复杂结构会被完整保留；依赖动作、多重攻击顺序和使用次数也会一起复制。
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭能力模板库">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-white/10 px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索能力、机制或来源怪物，例如：共享空间、吞没、魔法抗性"
            className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/50"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTION_OPTIONS.map(([value, label]) => {
            const count = value === 'all'
              ? templates.length
              : templates.filter((template) => template.section === value).length
            return <button
              key={value}
              type="button"
              onClick={() => setSection(value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${section === value
                ? 'border-violet-300/40 bg-violet-500/20 text-violet-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'}`}
            >{label} <span className="ml-1 text-[10px] opacity-60">{count}</span></button>
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {filtered.length === 0
          ? <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center text-sm text-slate-500">没有匹配的 Headless 能力模板。</div>
          : <div className="grid gap-3 lg:grid-cols-2">
            {filtered.slice(0, MAX_VISIBLE_RESULTS).map((template) => <article key={template.id} className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.035] p-3 hover:border-violet-300/25">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-slate-100">{template.name}</h3>
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200">{SECTION_LABELS[template.section]}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">Headless</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {template.sourceMonsterName}{template.sourceMonsterEnglishName && template.sourceMonsterEnglishName !== template.sourceMonsterName ? ` / ${template.sourceMonsterEnglishName}` : ''}
                    {' · '}{template.ruleKind}
                    {template.dependencyCount > 0 ? ` · 自动带入 ${template.dependencyCount} 个依赖动作` : ''}
                  </p>
                  {template.mechanicTags.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {template.mechanicTags.map((tag) => (
                        <span key={tag} className="rounded-full border border-cyan-300/15 bg-cyan-500/[0.07] px-1.5 py-0.5 text-[9px] text-cyan-200/80">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={() => onAdd(template)} className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-500/20 px-2.5 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/30">
                  <Plus className="h-3.5 w-3.5" /> 加入
                </button>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{template.description || '此能力没有额外说明。'}</p>
            </article>)}
          </div>}
        {filtered.length > MAX_VISIBLE_RESULTS && <p className="mt-4 text-center text-xs text-slate-500">
          当前显示前 {MAX_VISIBLE_RESULTS} 项，共 {filtered.length} 项；继续输入名称或来源怪物可缩小范围。
        </p>}
      </div>
    </div>
  </div>
}
