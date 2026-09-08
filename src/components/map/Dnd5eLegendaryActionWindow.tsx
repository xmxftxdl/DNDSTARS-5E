import { useMemo, useState } from 'react'
import { Crown, Maximize2, Minus, SkipForward, Swords } from 'lucide-react'
import type { Token } from '../../store/maps'
import type { Dnd5eLegendaryActionWindowCandidate } from '../../rulesets/dnd5e/legendaryActionWindow'
import {
  dnd5eManualMonsterSpellOptions,
  dnd5eMonsterAdjudicationSpellOptions,
} from '../../lib/monsterManualSpell'

export interface Dnd5eLegendaryActionWindowSelection {
  actorTokenId: string
  actionIndex: number
  targetTokenId: string
  spellId?: string
  spellSlotLevel?: number
  spellAutomation?: 'headless' | 'dm-adjudication'
}

export default function Dnd5eLegendaryActionWindow({
  endingTokenName,
  candidates,
  targets,
  pending = false,
  onUse,
  onSkip,
}: {
  endingTokenName: string
  candidates: readonly Dnd5eLegendaryActionWindowCandidate[]
  targets: readonly Token[]
  pending?: boolean
  onUse: (selection: Dnd5eLegendaryActionWindowSelection) => void
  onSkip: () => void
}) {
  const [actorTokenId, setActorTokenId] = useState(candidates[0]?.token.id ?? '')
  const candidate = candidates.find((entry) => entry.token.id === actorTokenId) ?? candidates[0]
  const firstExecutable = candidate?.actions.find((action) => action.affordable)
  const [actionIndex, setActionIndex] = useState(firstExecutable?.actionIndex ?? -1)
  const [targetTokenId, setTargetTokenId] = useState(targets[0]?.id ?? '')
  const [spellId, setSpellId] = useState('')
  const [spellSlotLevel, setSpellSlotLevel] = useState<number | undefined>()
  const [minimized, setMinimized] = useState(false)
  const action = candidate?.actions.find((entry) => entry.actionIndex === actionIndex) ?? firstExecutable
  const resolvedActionIndex = action?.actionIndex ?? -1
  const spellOptions = useMemo(() => {
    if (!candidate) return []
    const registeredById = new Map(
      dnd5eManualMonsterSpellOptions(candidate.token).map((spell) => [spell.spellId, spell]),
    )
    return dnd5eMonsterAdjudicationSpellOptions(candidate.token)
      .filter((spell) => action?.id !== 'cantrip' || spell.availableSlotLevels.includes(0))
      .map((spell) => {
        const registered = registeredById.get(spell.spellId)
        return {
          ...spell,
          automation: registered?.automation === 'full'
            ? 'headless' as const
            : 'dm-adjudication' as const,
          target: registered?.target,
          area: registered?.area,
        }
      })
  }, [action?.id, candidate])
  const selectedSpell = spellOptions.find((spell) => spell.spellId === spellId) ?? spellOptions[0]
  const selectedSpellSlotLevel = selectedSpell?.availableSlotLevels.includes(spellSlotLevel ?? -1)
    ? spellSlotLevel
    : selectedSpell?.availableSlotLevels[0]
  const targetOptions = useMemo(() => {
    if (action?.windowExecution !== 'spell-selection') {
      return targets.filter((target) => target.id !== actorTokenId && target.type === 'player')
    }
    if (!selectedSpell || selectedSpell.automation === 'dm-adjudication') return []
    if (selectedSpell.target === 'hostile') return targets.filter((target) => target.type === 'player')
    if (selectedSpell.target === 'ally') return targets.filter((target) => target.type === 'enemy')
    return targets.filter((target) => target.id !== actorTokenId)
  }, [action?.windowExecution, actorTokenId, selectedSpell, targets])
  const resolvedTargetTokenId = targetOptions.some((target) => target.id === targetTokenId)
    ? targetTokenId
    : targetOptions[0]?.id ?? ''
  const requiresTarget = action?.windowExecution === 'targeted-attack' ||
    action?.windowExecution === 'area-action' ||
    (action?.windowExecution === 'spell-selection' &&
      selectedSpell?.automation === 'headless' && !selectedSpell.area)
  const executable = !!candidate && !!action && action.affordable &&
    (action.windowExecution !== 'spell-selection' ||
      (!!selectedSpell && selectedSpellSlotLevel != null)) &&
    (!requiresTarget || !!resolvedTargetTokenId) && !pending
  const pointLabel = candidate
    ? `${candidate.currentPoints} / ${candidate.maximumPoints}`
    : '0 / 0'

  if (!candidate) return null
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="pointer-events-auto fixed right-4 top-20 z-[130] flex max-w-[min(28rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-amber-300/35 bg-void-950/95 px-4 py-3 text-left shadow-2xl backdrop-blur"
        aria-label="展开传奇动作选择"
        data-testid="legendary-action-window-restore"
      >
        <Crown className="h-5 w-5 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-amber-100">传奇动作待处理</span>
          <span className="block truncate text-xs text-slate-400">
            {endingTokenName} · {candidate.token.label} · {pointLabel} 点
          </span>
        </span>
        <Maximize2 className="h-4 w-4 shrink-0 text-slate-300" />
      </button>
    )
  }
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="传奇动作窗口"
      data-testid="legendary-action-window"
    >
      <section className="w-full max-w-2xl rounded-2xl border border-amber-300/25 bg-void-950 p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 text-amber-100">
              <Crown className="h-5 w-5" />
              <h2 className="text-lg font-bold">传奇动作时机</h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {endingTokenName} 的回合即将结束。使用一次传奇动作，或跳过后继续推进先攻。
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wider text-amber-300/70">传奇动作点</p>
              <p className="text-lg font-black tabular-nums text-amber-100" data-testid="legendary-action-points">
                {pointLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="最小化传奇动作选择"
              data-testid="legendary-action-window-minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </header>

        {candidates.length > 1 ? (
          <label className="mt-4 block text-xs font-semibold text-slate-400">
            传奇怪物
            <select
              value={candidate.token.id}
              onChange={(event) => {
                const nextActorTokenId = event.target.value
                const nextCandidate = candidates.find((entry) => entry.token.id === nextActorTokenId)
                setActorTokenId(nextActorTokenId)
                setActionIndex(nextCandidate?.actions.find((entry) => entry.affordable)?.actionIndex ?? -1)
                setSpellId('')
                setSpellSlotLevel(undefined)
              }}
              disabled={pending}
              className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-100"
            >
              {candidates.map((entry) => (
                <option key={entry.token.id} value={entry.token.id}>
                  {entry.token.label} · {entry.currentPoints}/{entry.maximumPoints} 点
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-4 space-y-2">
          {candidate.actions.map((entry) => {
            const dmAdjudication = entry.windowExecution === 'dm-adjudication'
            const disabled = !entry.affordable || pending
            return (
              <button
                key={entry.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setActionIndex(entry.actionIndex)
                  if (entry.windowExecution === 'spell-selection') {
                    setSpellId('')
                    setSpellSlotLevel(undefined)
                  }
                }}
                className={[
                  'w-full rounded-xl border px-3 py-3 text-left transition',
                  resolvedActionIndex === entry.actionIndex
                    ? 'border-amber-300/45 bg-amber-500/15'
                    : 'border-white/10 bg-white/[0.03]',
                  disabled ? 'cursor-not-allowed opacity-45' : 'hover:border-amber-300/30 hover:bg-amber-500/10',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-slate-100">{entry.name}</span>
                  <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-200">
                    消耗 {entry.cost} 点
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{entry.description}</p>
                {!entry.affordable ? (
                  <p className="mt-1 text-[11px] text-rose-300">传奇动作点不足</p>
                ) : dmAdjudication ? (
                  <p className="mt-1 text-[11px] text-amber-300">
                    需要 DM 裁定；选择后可填写最终效果，批准时才扣除传奇动作点。
                  </p>
                ) : entry.windowExecution === 'teleport-placement' ? (
                  <p className="mt-1 text-[11px] text-cyan-300">
                    交互式 Headless：下一步在地图上选择可见且未占据的落点。
                  </p>
                ) : entry.windowExecution === 'spell-selection' ? (
                  <p className="mt-1 text-[11px] text-cyan-300">
                    交互式 Headless：选择已注册法术后，目标、骰子、法术位与效果照常结算。
                  </p>
                ) : null}
              </button>
            )
          })}
        </div>

        {action?.windowExecution === 'spell-selection' ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-cyan-300/20 bg-cyan-500/[0.06] p-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-400">
              已注册法术
              <select
                value={selectedSpell?.spellId ?? ''}
                onChange={(event) => {
                  setSpellId(event.target.value)
                  setSpellSlotLevel(undefined)
                }}
                disabled={pending || spellOptions.length === 0}
                className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-100"
              >
                {spellOptions.map((spell) => (
                  <option key={spell.spellId} value={spell.spellId}>
                    {spell.spellName}{spell.automation === 'headless' ? ' · Headless' : ' · DM 裁定'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-400">
              环位 / 资源
              <select
                value={selectedSpellSlotLevel ?? ''}
                onChange={(event) => setSpellSlotLevel(Number(event.target.value))}
                disabled={pending || !selectedSpell}
                className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-100"
              >
                {(selectedSpell?.availableSlotLevels ?? []).map((level) => (
                  <option key={level} value={level}>
                    {selectedSpell?.resourceLabels[String(level)] ?? (level === 0 ? '戏法' : `${level} 环`)}
                  </option>
                ))}
              </select>
            </label>
            {selectedSpell?.automation === 'dm-adjudication' ? (
              <p className="sm:col-span-2 text-xs text-amber-300">
                该法术缺少完整处理器；确认后只为这一个法术打开 DM 裁定，并暂停至 DM 点击继续。
              </p>
            ) : spellOptions.length === 0 ? (
              <p className="sm:col-span-2 text-xs text-amber-300">
                当前没有仍有资源且已注册完整处理器的法术；未结构化法术必须走 DM 裁定。
              </p>
            ) : null}
          </div>
        ) : null}

        {requiresTarget ? (
          <label className="mt-4 block text-xs font-semibold text-slate-400">
            {action?.windowExecution === 'area-action'
              ? '范围方向 / 锚点目标'
              : action?.windowExecution === 'spell-selection'
                ? '法术目标'
                : '攻击目标'}
            <select
              value={resolvedTargetTokenId}
              onChange={(event) => setTargetTokenId(event.target.value)}
              disabled={pending}
              className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-100"
            >
              {targetOptions.map((target) => (
                <option key={target.id} value={target.id}>{target.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <footer className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            data-testid="legendary-action-skip"
            disabled={pending}
            onClick={onSkip}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            <SkipForward className="h-4 w-4" /> 跳过并继续
          </button>
          <button
            type="button"
            data-testid="legendary-action-use"
            disabled={!executable}
            onClick={() => onUse({
              actorTokenId: candidate.token.id,
              actionIndex: resolvedActionIndex,
              targetTokenId: resolvedTargetTokenId,
              ...(action?.windowExecution === 'spell-selection' && selectedSpell && selectedSpellSlotLevel != null
                ? {
                    spellId: selectedSpell.spellId,
                    spellSlotLevel: selectedSpellSlotLevel,
                    spellAutomation: selectedSpell.automation,
                  }
                : {}),
            })}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-void-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Swords className="h-4 w-4" /> {pending
              ? '结算中…'
              : action?.windowExecution === 'dm-adjudication'
                ? '交给 DM 裁定'
                : action?.windowExecution === 'teleport-placement'
                  ? '选择传送落点'
                  : action?.windowExecution === 'spell-selection'
                    ? selectedSpell?.automation === 'dm-adjudication'
                      ? '提交 DM 裁定'
                      : selectedSpell?.area && selectedSpell.area.origin !== 'self'
                      ? '继续选择范围落点'
                      : '施展所选法术'
                    : '使用传奇动作'}
          </button>
        </footer>
      </section>
    </div>
  )
}
