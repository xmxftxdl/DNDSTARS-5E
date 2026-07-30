import { useMemo, useState } from 'react'
import { Dices } from 'lucide-react'
import { ABILITIES, SKILLS } from '../../lib/dnd'
import type { Dnd5eAbilityCheckPayload, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { dnd5eAbilityCheckModifier, dnd5eSkillCheckModifier, dnd5eSkillCheckProficiencyRank, dnd5eTotemWarriorFeatureForCharacter } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

export default function Dnd5eAbilityCheckPanel({ character, canAct, pending, turnEconomy, onCheck }: {
  character: Character
  canAct: boolean
  pending: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  onCheck: (payload: Dnd5eAbilityCheckPayload) => void
}) {
  const [selection, setSelection] = useState('ability:str')
  const [dc, setDc] = useState(10)
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal')
  const [spendAction, setSpendAction] = useState(false)
  const [bearAspectTask, setBearAspectTask] = useState(false)
  const selected = useMemo(() => {
    const [kind, key] = selection.split(':')
    if (kind === 'skill') {
      const skill = SKILLS.find((candidate) => candidate.key === key) ?? SKILLS[0]
      return {
        label: `${ABILITIES.find((ability) => ability.key === skill.ability)?.label ?? skill.ability}（${skill.label}）`,
        ability: skill.ability,
        skill: skill.key,
        modifier: dnd5eSkillCheckModifier(character, skill.key),
        rank: dnd5eSkillCheckProficiencyRank(character, skill.key),
      }
    }
    const ability = ABILITIES.find((candidate) => candidate.key === key) ?? ABILITIES[0]
    return {
      label: `${ability.label}检定`,
      ability: ability.key,
      modifier: dnd5eAbilityCheckModifier(character, ability.key),
      rank: 0 as const,
    }
  }, [character, selection])
  const modifierText = `${selected.modifier >= 0 ? '+' : ''}${selected.modifier}`
  const disabled = !canAct || pending || (spendAction && turnEconomy.action.current < 1)
  const bearAspectAvailable =
    selected.ability === 'str' &&
    selected.skill == null &&
    !!dnd5eTotemWarriorFeatureForCharacter(
      character,
      'aspect-of-the-beast-bear',
    )

  return <section className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4 md:col-span-2">
    <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100"><Dices className="h-4 w-4" />属性与技能检定</div>
    <p className="mt-1 text-[11px] text-slate-500">由 DM 掷骰并交给 5e Headless 复核；万事通、可靠才能、体魄超凡及可用的职业加骰会自动进入结算。</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_110px]">
      <label className="text-[11px] text-slate-500">检定项目
        <select value={selection} onChange={(event) => setSelection(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200">
          <optgroup label="纯属性检定">
            {ABILITIES.map((ability) => <option key={ability.key} value={`ability:${ability.key}`}>{ability.label} · {dnd5eAbilityCheckModifier(character, ability.key) >= 0 ? '+' : ''}{dnd5eAbilityCheckModifier(character, ability.key)}</option>)}
          </optgroup>
          <optgroup label="技能检定">
            {SKILLS.map((skill) => {
              const rank = dnd5eSkillCheckProficiencyRank(character, skill.key)
              const modifier = dnd5eSkillCheckModifier(character, skill.key)
              return <option key={skill.key} value={`skill:${skill.key}`}>{skill.label} · {modifier >= 0 ? '+' : ''}{modifier}{rank === 2 ? '（专精）' : rank === 1 ? '（熟练）' : ''}</option>
            })}
          </optgroup>
        </select>
      </label>
      <label className="text-[11px] text-slate-500">DC
        <input type="number" min={0} max={100} value={dc} onChange={(event) => setDc(Math.min(100, Math.max(0, Math.floor(Number(event.target.value) || 0))))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200" />
      </label>
      <label className="text-[11px] text-slate-500">掷骰方式
        <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200">
          <option value="normal">正常</option><option value="advantage">优势</option><option value="disadvantage">劣势</option>
        </select>
      </label>
    </div>
    <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
      <input type="checkbox" checked={spendAction} onChange={(event) => setSpendAction(event.target.checked)} />
      DM 将本次检定判定为一个主动动作
    </label>
    {bearAspectAvailable ? <label className="mt-2 flex items-center gap-2 text-xs text-amber-200">
      <input
        type="checkbox"
        checked={bearAspectTask}
        onChange={(event) => setBearAspectTask(event.target.checked)}
      />
      熊之形：本次力量检定用于推、拉、举起或破坏物体
    </label> : null}
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCheck({
        ability: selected.ability,
        skill: selected.skill,
        context: bearAspectAvailable && bearAspectTask
          ? 'push-pull-lift-break'
          : undefined,
        dc,
        mode,
        spendAction: spendAction || undefined,
      })}
      className="mt-3 w-full rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? '等待 DM 结算…' : `进行${selected.label}（${modifierText}）`}
    </button>
  </section>
}
