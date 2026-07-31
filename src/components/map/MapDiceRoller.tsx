import { useMemo, useState } from 'react'
import { Dices, X } from 'lucide-react'
import { ABILITIES, SKILLS } from '../../lib/dnd'
import type { Dnd5eAbilityCheckPayload, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  dnd5eAbilityCheckModifier,
  dnd5eSkillCheckModifier,
  dnd5eSkillCheckProficiencyRank,
  dnd5eTotemWarriorFeatureForCharacter,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

export interface MapFreeDiceRollRequest {
  count: number
  sides: number
  bonus: number
  label: string
  visibility: 'public' | 'dm'
}

interface MapDiceRollerProps {
  isDm: boolean
  character?: Character
  canCheck: boolean
  pending: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  combatRollsVisible?: boolean
  onCombatRollsVisibleChange?: (visible: boolean) => void
  onRoll: (request: MapFreeDiceRollRequest) => Promise<void>
  onCheck: (payload: Dnd5eAbilityCheckPayload) => void
}

export default function MapDiceRoller({
  isDm,
  character,
  canCheck,
  pending,
  turnEconomy,
  combatRollsVisible = true,
  onCombatRollsVisibleChange,
  onRoll,
  onCheck,
}: MapDiceRollerProps) {
  const [open, setOpen] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [count, setCount] = useState(1)
  const [sides, setSides] = useState<number>(20)
  const [bonus, setBonus] = useState(0)
  const [label, setLabel] = useState('自由掷骰')
  const [visibility, setVisibility] = useState<'public' | 'dm'>('public')
  const [asCheck, setAsCheck] = useState(false)
  const [selection, setSelection] = useState('ability:str')
  const [dc, setDc] = useState(10)
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal')
  const [spendAction, setSpendAction] = useState(false)
  const [bearAspectTask, setBearAspectTask] = useState(false)

  const selectedCheck = useMemo(() => {
    if (!character) return undefined
    const [kind, key] = selection.split(':')
    if (kind === 'skill') {
      const skill = SKILLS.find((candidate) => candidate.key === key) ?? SKILLS[0]
      return {
        ability: skill.ability,
        skill: skill.key,
        label: `${ABILITIES.find((ability) => ability.key === skill.ability)?.label ?? skill.ability}（${skill.label}）`,
        modifier: dnd5eSkillCheckModifier(character, skill.key),
      }
    }
    const ability = ABILITIES.find((candidate) => candidate.key === key) ?? ABILITIES[0]
    return {
      ability: ability.key,
      skill: undefined,
      label: `${ability.label}检定`,
      modifier: dnd5eAbilityCheckModifier(character, ability.key),
    }
  }, [character, selection])

  const bearAspectAvailable =
    character != null &&
    selectedCheck?.ability === 'str' &&
    selectedCheck.skill == null &&
    !!dnd5eTotemWarriorFeatureForCharacter(character, 'aspect-of-the-beast-bear')
  const checkDisabled = !selectedCheck || !canCheck || pending || (spendAction && turnEconomy.action.current < 1)

  const roll = async () => {
    setRolling(true)
    try {
      await onRoll({ count, sides, bonus, label: label.trim() || '自由掷骰', visibility })
    } finally {
      setRolling(false)
    }
  }

  return (
    <div className="pointer-events-auto absolute right-3 top-1/2 z-[52] flex -translate-y-1/2 items-center gap-2">
      {open && (
        <section
          role="dialog"
          aria-label="自由掷骰"
          data-testid="map-dice-roller-panel"
          className="w-[min(25rem,calc(100vw-5.5rem))] rounded-2xl border border-cyan-300/20 bg-void-950/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-cyan-100"><Dices className="h-4 w-4" />自由掷骰</h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">普通骰公开同步；DM 也可选择暗骰。鉴定会交给 5e Headless 重新计算角色调整值。</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭自由掷骰" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1" aria-label="选择骰子">
            {DIE_SIDES.map((die) => (
              <button
                key={die}
                type="button"
                onClick={() => setSides(die)}
                aria-pressed={sides === die}
                className={`rounded-lg border px-1 py-2 text-xs font-black transition ${sides === die ? 'border-cyan-300/70 bg-cyan-500/20 text-cyan-100' : 'border-white/8 bg-white/[0.035] text-slate-400 hover:bg-white/[0.08]'}`}
              >d{die}</button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-[72px_82px_minmax(0,1fr)] gap-2">
            <label className="text-[10px] font-semibold text-slate-500">数量
              <input type="number" min={1} max={12} value={count} onChange={(event) => setCount(Math.min(12, Math.max(1, Math.floor(Number(event.target.value) || 1))))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" />
            </label>
            <label className="text-[10px] font-semibold text-slate-500">调整值
              <input type="number" min={-99} max={99} value={bonus} onChange={(event) => setBonus(Math.min(99, Math.max(-99, Math.floor(Number(event.target.value) || 0))))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" />
            </label>
            <label className="text-[10px] font-semibold text-slate-500">掷骰名称
              <input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" />
            </label>
          </div>

          {isDm && !asCheck && (
            <div className="mt-2 space-y-2">
              <label className="block text-[10px] font-semibold text-slate-500">自由掷骰可见性
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100">
                  <option value="public">明骰 · 全房间可见</option>
                  <option value="dm">暗骰 · 仅 DM 可见</option>
                </select>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.055] px-3 py-2.5 text-xs text-fuchsia-100">
                <input
                  type="checkbox"
                  checked={combatRollsVisible}
                  onChange={(event) => onCombatRollsVisibleChange?.(event.target.checked)}
                  className="mt-0.5 accent-fuchsia-400"
                  data-testid="combat-roll-visibility-toggle"
                />
                <span>
                  <strong className="block font-semibold">战斗投掷对玩家可见</strong>
                  <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                    关闭后，怪物的命中、豁免、充能与伤害骰只在 DM 端显示；暗骰 d20 可由 DM 确认或修正。
                  </span>
                </span>
              </label>
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-500/[0.04] px-3 py-2.5 text-xs font-semibold text-cyan-100">
            <input type="checkbox" checked={asCheck} onChange={(event) => setAsCheck(event.target.checked)} className="accent-cyan-400" />
            作为属性／技能鉴定
          </label>

          {asCheck ? (
            <div className="mt-3">
              {character && selectedCheck ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_70px_94px]">
                    <label className="text-[10px] font-semibold text-slate-500">检定项目
                      <select value={selection} onChange={(event) => setSelection(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100">
                        <optgroup label="纯属性检定">
                          {ABILITIES.map((ability) => <option key={ability.key} value={`ability:${ability.key}`}>{ability.label} · {dnd5eAbilityCheckModifier(character, ability.key) >= 0 ? '+' : ''}{dnd5eAbilityCheckModifier(character, ability.key)}</option>)}
                        </optgroup>
                        <optgroup label="技能检定">
                          {SKILLS.map((skill) => {
                            const modifier = dnd5eSkillCheckModifier(character, skill.key)
                            const rank = dnd5eSkillCheckProficiencyRank(character, skill.key)
                            return <option key={skill.key} value={`skill:${skill.key}`}>{skill.label} · {modifier >= 0 ? '+' : ''}{modifier}{rank === 2 ? '（专精）' : rank === 1 ? '（熟练）' : ''}</option>
                          })}
                        </optgroup>
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold text-slate-500">DC
                      <input type="number" min={0} max={100} value={dc} onChange={(event) => setDc(Math.min(100, Math.max(0, Math.floor(Number(event.target.value) || 0))))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" />
                    </label>
                    <label className="text-[10px] font-semibold text-slate-500">掷骰方式
                      <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100"><option value="normal">正常</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select>
                    </label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400"><input type="checkbox" checked={spendAction} onChange={(event) => setSpendAction(event.target.checked)} />DM 将本次检定判定为一个主动动作</label>
                  {bearAspectAvailable ? (
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-amber-200">
                      <input
                        type="checkbox"
                        checked={bearAspectTask}
                        onChange={(event) => setBearAspectTask(event.target.checked)}
                      />
                      熊之形：本次力量检定用于推、拉、举起或破坏物体
                    </label>
                  ) : null}
                  {!canCheck && <p className="mt-2 text-[11px] text-amber-300/80">只有当前获得行动权的玩家角色可以提交 Headless 鉴定。</p>}
                  <button
                    type="button"
                    disabled={checkDisabled}
                    onClick={() => onCheck({
                      ability: selectedCheck.ability,
                      skill: selectedCheck.skill,
                      context: bearAspectAvailable && bearAspectTask
                        ? 'push-pull-lift-break'
                        : undefined,
                      dc,
                      mode,
                      spendAction: spendAction || undefined,
                    })}
                    className="mt-3 w-full rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-40"
                  >{pending ? '等待 DM 结算…' : `进行${selectedCheck.label}（${selectedCheck.modifier >= 0 ? '+' : ''}${selectedCheck.modifier}）· DC ${dc}`}</button>
                </>
              ) : <p className="rounded-xl border border-amber-300/15 bg-amber-500/[0.06] p-3 text-xs leading-5 text-amber-100/80">请先选择一个已加入地图的玩家角色。</p>}
            </div>
          ) : (
            <button
              type="button"
              disabled={rolling}
              onClick={() => void roll()}
              className="mt-3 w-full rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/35 disabled:cursor-wait disabled:opacity-40"
            >{rolling ? '骰子滚动中…' : `投掷 ${count}d${sides}${bonus === 0 ? '' : bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`}`}</button>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="自由掷骰"
        aria-expanded={open}
        data-testid="map-dice-roller-toggle"
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border shadow-xl backdrop-blur-md transition ${open ? 'border-cyan-200/70 bg-cyan-500/25 text-cyan-50 ring-2 ring-cyan-300/20' : 'border-cyan-300/25 bg-void-950/88 text-cyan-200 hover:bg-cyan-500/20'}`}
        title="自由掷骰／属性与技能鉴定"
      ><Dices className="h-5 w-5" /></button>
    </div>
  )
}
