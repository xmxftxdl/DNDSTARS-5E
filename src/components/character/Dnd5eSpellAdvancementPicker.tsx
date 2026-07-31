import { Check, LockKeyhole, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import {
  dnd5eSpellAdvancementSelectionsComplete,
  type Dnd5eSpellAdvancementPlan,
} from '../../rulesets/dnd5e/spellAdvancement'
import type { Dnd5eAdvancementSpellSelectionsV1 } from '../../types/character'

interface Dnd5eSpellAdvancementPickerProps {
  plan: Dnd5eSpellAdvancementPlan
  value: Dnd5eAdvancementSpellSelectionsV1
  onChange(value: Dnd5eAdvancementSpellSelectionsV1): void
}

type SelectionKind = 'cantrips' | 'knownSpells' | 'wizardSpellbook'

function removedCount(previous: readonly string[], next: readonly string[]): number {
  const selected = new Set(next)
  return previous.filter((id) => !selected.has(id)).length
}

export default function Dnd5eSpellAdvancementPicker({
  plan,
  value,
  onChange,
}: Dnd5eSpellAdvancementPickerProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  const complete = dnd5eSpellAdvancementSelectionsComplete(plan, value)

  const patch = (kind: SelectionKind, ids: string[]) => {
    onChange({
      ...value,
      [kind]: ids,
    })
  }

  const renderChoices = (
    kind: SelectionKind,
    title: string,
    description: string,
    target: number,
    previous: readonly string[],
    options: Dnd5eSpellAdvancementPlan['spellOptions'],
    replaceable: boolean,
  ) => {
    const selected = value[kind] ?? []
    const visible = options.filter((spell) => {
      if (!normalizedQuery) return true
      return `${spell.name} ${spell.englishName ?? ''} ${spell.id}`
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedQuery)
    })
    const toggle = (id: string) => {
      if (selected.includes(id)) {
        const next = selected.filter((spellId) => spellId !== id)
        if (kind === 'wizardSpellbook' && previous.includes(id)) return
        if (!replaceable && previous.includes(id)) return
        if (removedCount(previous, next) > (replaceable ? 1 : 0)) return
        patch(kind, next)
        return
      }
      if (selected.length >= target) return
      patch(kind, [...selected, id])
    }

    return (
      <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.035] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-violet-100">{title}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            selected.length === target
              ? 'bg-emerald-500/15 text-emerald-200'
              : 'bg-amber-500/15 text-amber-100'
          }`}>
            {selected.length}/{target}
          </span>
        </div>
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((spell) => {
            const active = selected.includes(spell.id)
            const locked = previous.includes(spell.id) &&
              (kind === 'wizardSpellbook' || !replaceable)
            return (
              <button
                key={spell.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(spell.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-violet-300/45 bg-violet-500/12 text-violet-50'
                    : 'border-white/8 bg-black/15 text-slate-400 hover:border-white/15'
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">{spell.name}</strong>
                    <span className="mt-1 block truncate text-[10px] opacity-60">
                      {spell.level === 0 ? '戏法' : `${spell.level} 环`}
                      {spell.englishName ? ` · ${spell.englishName}` : ''}
                    </span>
                  </span>
                  {locked
                    ? <LockKeyhole className="h-3.5 w-3.5 shrink-0 opacity-55" />
                    : active
                      ? <Check className="h-4 w-4 shrink-0" />
                      : null}
                </span>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  spell.automationLevel === 'full'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : spell.automationLevel === 'partial'
                      ? 'bg-amber-500/15 text-amber-200'
                      : 'bg-white/5 text-slate-500'
                }`}>
                  {spell.automationLevel === 'full'
                    ? 'Headless'
                    : spell.automationLevel === 'partial'
                      ? '部分自动'
                      : 'DM 裁定'}
                </span>
              </button>
            )
          })}
        </div>
        {visible.length === 0 && (
          <p className="mt-3 rounded-xl border border-dashed border-white/8 px-4 py-5 text-center text-xs text-slate-600">
            没有符合搜索条件的法术。
          </p>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-300/20 bg-violet-500/[0.06] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-violet-100">本级施法选择</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {plan.className} {plan.toClassLevel} 级 · 当前可用最高 {plan.highestSpellLevel} 环法术。
              {plan.newlyUnlockedSpellLevels.length > 0
                ? ` 本级解锁 ${plan.newlyUnlockedSpellLevels.map((level) => `${level} 环`).join('、')}。`
                : ''}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            complete
              ? 'bg-emerald-500/15 text-emerald-200'
              : 'bg-amber-500/15 text-amber-100'
          }`}>
            {complete ? '选择完整' : '尚未选完'}
          </span>
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索本级可选法术"
            className="w-full rounded-xl border border-white/10 bg-void-950/70 py-2.5 pl-9 pr-3 text-sm text-slate-200"
          />
        </label>
      </div>

      {plan.targetCantripCount > 0 && renderChoices(
        'cantrips',
        '已学习戏法',
        plan.canReplaceCantrip
          ? '补足本级已知数量；也可以替换至多一个原有戏法。'
          : '选择本职业当前等级应掌握的戏法。',
        plan.targetCantripCount,
        plan.previousCantrips,
        plan.cantripOptions,
        plan.canReplaceCantrip,
      )}
      {plan.targetKnownSpellCount != null && renderChoices(
        'knownSpells',
        '已知法术',
        plan.canReplaceKnownSpell
          ? '补足本级已知数量；升级时可以替换至多一个原有已知法术。'
          : '选择本职业当前等级应掌握的已知法术。',
        plan.targetKnownSpellCount,
        plan.previousKnownSpells,
        plan.spellOptions,
        plan.canReplaceKnownSpell,
      )}
      {plan.targetWizardSpellbookCount != null && renderChoices(
        'wizardSpellbook',
        '法师法术书',
        plan.fromClassLevel === 0
          ? '1 级法师必须在法术书中记录六个 1 环法师法术。'
          : '每获得一个法师等级，免费将两个当前可施放环级的法师法术加入法术书；既有法术不可移除。',
        plan.targetWizardSpellbookCount,
        plan.previousWizardSpellbook,
        plan.spellOptions,
        false,
      )}
    </div>
  )
}

