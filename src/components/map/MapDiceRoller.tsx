import { MAX_DICE_POOL_COUNT } from '../../lib/dicePoolLimits'
import { useMemo, useState } from 'react'
import { Dices, Eye, EyeOff, RotateCcw, X } from 'lucide-react'
import { ABILITIES, SKILLS } from '../../lib/dnd'
import type { Dnd5eAbilityCheckPayload, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  dnd5eAbilityCheckModifier,
  dnd5eAbilityCheckMode,
  dnd5eCharacterClassLevel,
  dnd5eTotalCharacterLevel,
  dnd5eSkillCheckModifier,
  dnd5eSkillCheckProficiencyRank,
  dnd5eRageFeatureForCharacter,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import {
  mixedDiceFormula, updateMixedDice, type MapFreeDiceSelection,
  type MapFreeDiceResolution,
} from './mapFreeDiceRoll'

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

export interface MapFreeDiceRollRequest {
  groups?: MapFreeDiceSelection[]
  count: number
  sides: number
  bonus: number
  label: string
  visibility: 'public' | 'dm'
  resolution?: MapFreeDiceResolution
}

interface MapDiceRollerProps {
  visibility?: 'public' | 'dm'
  onVisibilityChange?: (visibility: 'public' | 'dm') => void
  isDm: boolean
  embedded?: boolean
  onRequestClose?: () => void
  character?: Character
  canCheck: boolean
  headlessCheck: boolean
  pending: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  perceptionTargets?: readonly { id: string; label: string }[]
  combatRollsVisible?: boolean
  onCombatRollsVisibleChange?: (visible: boolean) => void
  onRoll: (request: MapFreeDiceRollRequest) => Promise<void>
  onReroll?: () => Promise<void>
  onCheck: (payload: Dnd5eAbilityCheckPayload) => void
}

export default function MapDiceRoller({
  visibility: controlledVisibility,
  onVisibilityChange,
  isDm,
  embedded = false,
  onRequestClose,
  character,
  canCheck,
  headlessCheck,
  pending,
  turnEconomy,
  perceptionTargets = [],
  combatRollsVisible = true,
  onCombatRollsVisibleChange,
  onRoll,
  onReroll,
  onCheck,
}: MapDiceRollerProps) {
  const [open, setOpen] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [groups, setGroups] = useState<MapFreeDiceSelection[]>([])
  const count = groups.reduce((sum, group) => sum + group.count, 0)
  const [sides, setSides] = useState<number>(20)
  const [bonus, setBonus] = useState(0)
  const [label, setLabel] = useState('自由掷骰')
  const [localVisibility, setLocalVisibility] = useState<'public' | 'dm'>('public')
  const visibility = controlledVisibility ?? localVisibility
  const setVisibility = (next: 'public' | 'dm') => {
    setLocalVisibility(next)
    onVisibilityChange?.(next)
  }
  const [asCheck, setAsCheck] = useState(false)
  const [selection, setSelection] = useState('ability:str')
  const [dc, setDc] = useState(10)
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal')
  const [spendAction, setSpendAction] = useState(false)
  const [bearAspectTask, setBearAspectTask] = useState(false)
  const [climbingTask, setClimbingTask] = useState(false)
  const [draconicInteraction, setDraconicInteraction] = useState(false)
  const [perceivedTargetId, setPerceivedTargetId] = useState('')

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
    !!dnd5eRageFeatureForCharacter(character, 'object-strength-and-carrying')
  const selectedProficiencyRank = character && selectedCheck?.skill
    ? dnd5eSkillCheckProficiencyRank(character, selectedCheck.skill)
    : 0
  const draconicInteractionAvailable =
    character != null &&
    selectedCheck?.ability === 'cha' &&
    selectedProficiencyRank === 1 &&
    dnd5eCharacterClassLevel(character, 'sorcerer') >= 1 &&
    character.dnd5eClassChoices?.classes?.sorcerer?.subclass === 'draconic'
  const draconicInteractionBonus =
    draconicInteractionAvailable && draconicInteraction && selectedProficiencyRank === 1
      ? 2 + Math.floor((dnd5eTotalCharacterLevel(character!) - 1) / 4)
      : 0
  const selectedCheckModifier = (selectedCheck?.modifier ?? 0) + draconicInteractionBonus
  const checkDisabled = !selectedCheck || !canCheck || pending ||
    (headlessCheck && spendAction && turnEconomy.action.current < 1)
  const close = () => {
    if (embedded) onRequestClose?.()
    else setOpen(false)
  }

  const submitCheck = () => {
    if (!selectedCheck) return
    const requestedMode = bearAspectAvailable && bearAspectTask ? 'advantage' : mode
    const effectiveMode = character
      ? dnd5eAbilityCheckMode(character, {
          ability: selectedCheck.ability,
          skill: selectedCheck.skill,
          perceivedTargetId: selectedCheck.skill === 'perception' && perceivedTargetId
            ? perceivedTargetId
            : undefined,
          requestedMode,
        })
      : requestedMode
    if (!headlessCheck) {
      close()
      void onRoll({
        count: effectiveMode === 'normal' ? 1 : 2,
        sides: 20,
        bonus: selectedCheckModifier,
        label: `${selectedCheck.label} · DC ${dc}`,
        visibility: 'public',
        resolution: {
          keep: effectiveMode === 'advantage'
            ? 'highest'
            : effectiveMode === 'disadvantage'
              ? 'lowest'
              : undefined,
          dc,
        },
      })
      return
    }
    close()
    onCheck({
      ability: selectedCheck.ability,
      skill: selectedCheck.skill,
      perceivedTargetId: selectedCheck.skill === 'perception' && perceivedTargetId
        ? perceivedTargetId
        : undefined,
      context: bearAspectAvailable && bearAspectTask
        ? 'push-pull-lift-break'
        : selectedCheck.skill === 'athletics' && climbingTask
          ? 'climbing'
        : draconicInteractionAvailable && draconicInteraction
          ? 'interact-with-dragons'
          : undefined,
      dc,
      mode,
      spendAction: spendAction || undefined,
    })
  }

  const roll = async () => {
    if (count < 1) return
    setRolling(true)
    close()
    try {
      await onRoll({ count, sides: groups[0]?.sides ?? sides, groups, bonus, label: label.trim() || '自由掷骰', visibility })
      setGroups([])
    } finally {
      setRolling(false)
    }
  }
  const reroll = async () => {
    if (!onReroll || rolling || pending) return
    setRolling(true)
    close()
    try {
      await onReroll()
    } finally {
      setRolling(false)
    }
  }
  const diceFormula = mixedDiceFormula(groups) || '尚未添加骰子'
  const addDie = (die: number) => {
    setSides(die)
    setGroups(current => updateMixedDice(current, die, (current.find(group => group.sides === die)?.count ?? 0) + 1))
  }
  const removeDie = (die: number) => {
    setGroups(current => updateMixedDice(current, die, (current.find(group => group.sides === die)?.count ?? 0) - 1))
  }

  const panel = (
    <section
      role={embedded ? 'group' : 'dialog'}
      aria-label="自由掷骰"
      data-testid="map-dice-roller-panel"
      data-embedded={embedded ? 'true' : 'false'}
      className={embedded
        ? 'map-dice-roller map-dice-roller--embedded w-full'
        : 'w-[min(25rem,calc(100vw-5.5rem))] rounded-2xl border border-cyan-300/20 bg-void-950/95 p-4 shadow-2xl backdrop-blur-xl'}
    >
          {!embedded ? <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-cyan-100"><Dices className="h-4 w-4" />自由掷骰</h3>
            </div>
            <button type="button" onClick={close} aria-label="关闭自由掷骰" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div> : null}

          <div
            className={embedded ? 'map-dice-roller__topbar' : undefined}
            data-testid={embedded ? 'map-dice-roller-topbar' : undefined}
          >
          <div className={`${embedded ? 'map-dice-roller__die-picker' : 'mt-4'} grid grid-cols-7 gap-1`} aria-label="选择骰子">
            {DIE_SIDES.map((die) => (
              <button
                key={die}
                type="button"
                onClick={() => addDie(die)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  removeDie(die)
                }}
                aria-label={`添加 d${die}，当前 ${groups.find(group => group.sides === die)?.count ?? 0} 枚`}
                data-active={groups.some(group => group.sides === die) ? 'true' : 'false'}
                title={`点击添加 d${die}；右键移除`}
                className={`relative rounded-lg border px-1 py-2 text-xs font-black transition ${groups.some(group => group.sides === die) ? 'border-cyan-300/70 bg-cyan-500/20 text-cyan-100' : 'border-white/8 bg-white/[0.035] text-slate-400 hover:bg-white/[0.08]'}`}
              >
                {embedded ? <svg className="map-dice-roller__die-icon" viewBox="0 0 36 36" aria-hidden="true">
                  <path d={die === 4 ? 'M18 3 34 31H2Z' : die === 6 ? 'M6 5H30V31H6Z' : die === 8 ? 'M18 2 33 18 18 34 3 18Z' : 'M18 2 32 10V26L18 34 4 26V10Z'} fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <text x="18" y={die === 4 ? '24' : '22'} textAnchor="middle" fill="currentColor" fontSize={die === 100 ? '10' : '12'} fontWeight="700">{die}</text>
                </svg> : <>d{die}</>}
                {groups.some(group => group.sides === die) ? (
                  <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-cyan-300 px-1 text-[9px] font-black text-cyan-950">
                    {groups.find(group => group.sides === die)?.count}
                  </span>
                ) : null}
              </button>
            ))}
            {embedded && !asCheck && <button
              type="button"
              disabled={count < 1 || rolling}
              onClick={() => void roll()}
              className="map-dice-roller__rail-roll"
              aria-label={rolling ? '投掷中…' : `投掷 ${diceFormula}`}
              title={rolling ? '投掷中…' : `投掷 ${diceFormula}${bonus === 0 ? '' : bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`}`}
              data-testid="map-dice-roller-quick-roll"
            ><Dices size={19} aria-hidden="true" /></button>}
            {embedded && !asCheck && <button
              type="button"
              disabled={!onReroll || rolling || pending}
              onClick={() => void reroll()}
              className="map-dice-roller__rail-roll"
              aria-label="重骰：重新投掷上一次的骰子组合"
              title="重骰：重新投掷上一次的骰子组合"
            ><RotateCcw size={18} aria-hidden="true" /></button>}
            {embedded && isDm && <div className="map-dice-roller__visibility-shortcuts" role="group" aria-label="自由投掷明暗骰">
              <button type="button" title="明骰：全房间可见" aria-label="明骰：全房间可见" aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}><Eye size={18} /></button>
              <button type="button" title="暗骰：仅 DM 可见" aria-label="暗骰：仅 DM 可见" aria-pressed={visibility === 'dm'} disabled={asCheck} onClick={() => setVisibility('dm')}><EyeOff size={18} /></button>
            </div>}
          </div>
          </div>

          <div className={embedded ? 'map-dice-roller__settings' : undefined}>
          <div className="mt-3 grid grid-cols-[72px_82px_minmax(0,1fr)] gap-2">
            <label className="text-[10px] font-semibold text-slate-500">数量
              <input aria-label={`d${sides} 数量`} type="number" min={0} max={MAX_DICE_POOL_COUNT} value={groups.find(group => group.sides === sides)?.count ?? 0} onChange={(event) => setGroups(current => updateMixedDice(current, sides, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" />
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
              <label title="关闭后，怪物的命中、豁免、充能与伤害骰只在 DM 端显示；暗骰 d20 可由 DM 确认或修正。" className="map-dice-roller__combat-visibility flex items-start gap-2 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.055] px-3 py-2.5 text-xs text-fuchsia-100">
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
            <input type="checkbox" checked={asCheck} onChange={(event) => { setAsCheck(event.target.checked); if (event.target.checked) setVisibility('public') }} className="accent-cyan-400" />
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
                  {selectedCheck.skill === 'perception' && perceptionTargets.length > 0 ? (
                    <label className="mt-2 block text-[10px] font-semibold text-slate-500">观察目标
                      <select value={perceivedTargetId} onChange={(event) => setPerceivedTargetId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100">
                        <option value="">区域搜索／未指定单一生物</option>
                        {perceptionTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {headlessCheck ? (
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400"><input type="checkbox" checked={spendAction} onChange={(event) => setSpendAction(event.target.checked)} />DM 将本次检定判定为一个主动动作</label>
                  ) : (
                    <p className="mt-2 text-[11px] leading-5 text-emerald-300/80">战斗外鉴定不会消耗行动；骰值、调整值与是否通过会公开同步。</p>
                  )}
                  {selectedCheck.skill === 'athletics' ? (
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={climbingTask} onChange={event => setClimbingTask(event.target.checked)} />
                      本次用于攀爬
                    </label>
                  ) : null}
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
                  {draconicInteractionAvailable ? (
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-amber-200">
                      <input
                        type="checkbox"
                        checked={draconicInteraction}
                        onChange={(event) => setDraconicInteraction(event.target.checked)}
                      />
                      龙族先祖：本次魅力检定用于与龙类互动
                    </label>
                  ) : null}
                  {!canCheck && <p className="mt-2 text-[11px] text-amber-300/80">{headlessCheck ? '只有当前获得行动权的玩家角色可以提交 Headless 鉴定。' : '请选择自己控制的玩家角色后再进行鉴定。'}</p>}
                  <button
                    type="button"
                    disabled={checkDisabled}
                    onClick={submitCheck}
                    className="mt-3 w-full rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-40"
                  >{pending ? '等待 DM 结算…' : `进行${selectedCheck.label}（${selectedCheckModifier >= 0 ? '+' : ''}${selectedCheckModifier}）· DC ${dc}`}</button>
                </>
              ) : <p className="rounded-xl border border-amber-300/15 bg-amber-500/[0.06] p-3 text-xs leading-5 text-amber-100/80">请先选择一个已加入地图的玩家角色。</p>}
            </div>
          ) : (
            <button
              type="button"
              disabled={rolling || count < 1}
              onClick={() => void roll()}
              className="mt-3 w-full rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/35 disabled:cursor-wait disabled:opacity-40"
            >{rolling ? '骰子滚动中…' : count < 1 ? '请先选择骰子' : `投掷 ${diceFormula}${bonus === 0 ? '' : bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`}`}</button>
          )}
          </div>
    </section>
  )

  if (embedded) return panel

  return (
    <div className="pointer-events-auto absolute right-20 top-1/2 z-[120] flex -translate-y-1/2 items-center gap-2">
      {open && panel}

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
