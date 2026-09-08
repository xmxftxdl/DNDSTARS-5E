import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Footprints,
  Gauge,
  Hand,
  LogOut,
  Rabbit,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react'
import type { Token } from '../../store/maps'
import { getEnemyTemplate } from '../../lib/enemyPool'
import { getEnemyStatBlock, type MonsterAction } from '../../lib/enemyStatBlocks'
import { getImage } from '../../lib/imageStore'
import { resolveCompactPortraitImageId } from '../../lib/portraitPresentation'
import { ABILITIES, abilityMod, formatMod } from '../../lib/dnd'
import type { D20RollMode } from '../../rulesets/contracts'
import { dnd5eManualMonsterSpellOptions } from '../../lib/monsterManualSpell'
import { dnd5eMonsterTokenEffectiveSpeed } from '../../application/combat/monsterMovementProjection'
import { dnd5eMonsterMapSpeed, getDnd5eSrdMonster } from '../../rulesets/dnd5e/monsters'
import {
  dnd5eManualMonsterActionIndexById,
  dnd5eManualMonsterJumpMaximumFeet,
  dnd5eManualMonsterMultiattackContinuation,
  type Dnd5eManualMonsterMovementIntent,
  type Dnd5eManualMonsterMovementKind,
  type Dnd5eManualMonsterMultiattackContinuation,
} from '../../lib/monsterManualControl'
import {
  dnd5eActiveArmorClassBonus,
  dnd5eActiveJumpDistanceMultiplier,
  dnd5eActiveMaximumAttacksPerTurn,
  effectiveDnd5eActiveEffects,
  normalizeDnd5eActiveEffects,
} from '../../rulesets/dnd5e/activeEffects'
import { isTokenMovementLocked } from '../../lib/combatStatus'

function SharedMonsterIcon({
  token,
  className,
}: {
  token: Token
  className: string
}) {
  const template = token.poolId ? getEnemyTemplate(token.poolId) : undefined
  const fallbackSrc = token.tokenPortrait || template?.tokenPortrait
  const compactPortraitImageId = resolveCompactPortraitImageId(token)
  const [loaded, setLoaded] = useState<{ imageId: string; src: string }>()

  useEffect(() => {
    if (!compactPortraitImageId) return
    const imageId = compactPortraitImageId
    let disposed = false
    let objectUrl: string | undefined
    void getImage(imageId).then((blob) => {
      if (!blob || disposed) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ imageId, src: objectUrl })
    })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [compactPortraitImageId])

  const sharedSrc =
    compactPortraitImageId && loaded?.imageId === compactPortraitImageId
      ? loaded?.src
      : undefined
  if (sharedSrc || fallbackSrc) {
    return (
      <img
        src={sharedSrc ?? fallbackSrc}
        alt={token.label}
        className={className}
      />
    )
  }
  return <span className="text-xl" aria-hidden="true">{token.emoji || template?.emoji || '👹'}</span>
}

const MANUAL_ATTACK_ROLL_MODES: readonly {
  mode: D20RollMode
  label: string
}[] = [
  { mode: 'advantage', label: '优势' },
  { mode: 'normal', label: '正常' },
  { mode: 'disadvantage', label: '劣势' },
]

export function ManualAttackRollModeControl({
  actionKey,
  confirmTestId,
  disabled,
  confirmLabel,
  onConfirm,
}: {
  actionKey: string
  confirmTestId?: string
  disabled: boolean
  confirmLabel: string
  onConfirm: (mode?: D20RollMode) => void
}) {
  // Undefined means "use the Headless-computed mode". Defaulting this control
  // to an explicit normal ruling silently erased effects such as Magic Circle,
  // Blur and Dodge before the target-dependent attack preparation could apply
  // them. The three buttons remain available as deliberate DM overrides.
  const [mode, setMode] = useState<D20RollMode | undefined>()
  return (
    <div
      data-testid={`manual-monster-roll-mode-${actionKey}`}
      className="mt-2 rounded-lg border border-white/10 bg-black/15 p-1.5"
    >
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="本次攻击命中掷骰模式">
        {MANUAL_ATTACK_ROLL_MODES.map((option) => {
          const selected = mode === option.mode
          return (
            <button
              key={option.mode}
              type="button"
              data-testid={`manual-monster-roll-mode-${actionKey}-${option.mode}`}
              data-selected={selected || undefined}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => setMode(option.mode)}
              className={[
                'rounded-md border px-2 py-1 text-[10px] font-semibold transition',
                selected
                  ? 'border-amber-200/70 bg-amber-300/20 text-amber-50 shadow-[0_0_10px_rgba(251,191,36,.18)]'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200',
                'disabled:cursor-not-allowed disabled:opacity-40',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        data-testid={confirmTestId}
        disabled={disabled}
        onClick={() => {
          onConfirm(mode)
          // The audit contract treats every attack as a fresh ruling. A prior
          // advantage/disadvantage choice must never leak into the next one.
          setMode(undefined)
        }}
        className="mt-1.5 w-full rounded-lg bg-rose-500/20 px-2 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirmLabel} · {mode === 'advantage' ? '优势' : mode === 'disadvantage' ? '劣势' : mode === 'normal' ? '正常' : '自动'}
      </button>
    </div>
  )
}

function ActionList({
  title,
  actions,
  tone,
  canAct,
  actionUsed,
  multiattackUnavailable,
  activeEffectDefinitionIds,
  rechargeReadyByActionId,
  actionUsesByActionId,
  onSelectAction,
  onSelectAdjudicatedAction,
}: {
  title: string
  actions?: readonly MonsterAction[]
  tone: 'rose' | 'emerald' | 'cyan' | 'amber' | 'fuchsia'
  canAct?: boolean
  actionUsed?: boolean
  multiattackUnavailable?: boolean
  activeEffectDefinitionIds?: ReadonlySet<string>
  rechargeReadyByActionId?: Readonly<Record<string, boolean>>
  actionUsesByActionId?: Readonly<Record<string, { current: number; max: number }>>
  onSelectAction?: (
    actionIndex: number,
    actionName: string,
    rollMode?: D20RollMode,
    actionId?: string,
  ) => void
  onSelectAdjudicatedAction?: (
    actionIndex: number,
    actionName: string,
    actionId?: string,
  ) => void
}) {
  if (!actions?.length) return null
  const toneClasses = {
    rose: 'border-rose-400/15 bg-rose-500/10 text-rose-100',
    emerald: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-100',
    cyan: 'border-cyan-400/15 bg-cyan-500/10 text-cyan-100',
    amber: 'border-amber-400/15 bg-amber-500/10 text-amber-100',
    fuchsia: 'border-fuchsia-400/15 bg-fuchsia-500/10 text-fuchsia-100',
  }[tone]
  return (
    <section>
      <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</h4>
      <div className="space-y-1.5">
        {actions.map((action, actionIndex) => {
          const recharge = action.usage?.kind === 'recharge'
            ? action.usage
            : undefined
          const sharedUsageActionId = action.sharedUsageActionId ?? action.id
          const rechargeReady = !recharge || !sharedUsageActionId ||
            rechargeReadyByActionId?.[sharedUsageActionId] !== false
          const perDay = action.usage?.kind === 'per-day'
            ? action.usage
            : undefined
          const perDayUses = perDay && sharedUsageActionId
            ? actionUsesByActionId?.[sharedUsageActionId]
            : undefined
          const perDayRemaining = perDay
            ? Math.max(0, Math.min(perDay.max, perDayUses?.current ?? perDay.max))
            : undefined
          const perDayReady = perDayRemaining == null || perDayRemaining > 0
          const canHeadlessTargetedCondition =
            canAct &&
            action.automation === 'headless' &&
            (action.kind === 'targeted-condition' || action.kind === 'targeted-special')
          const canHeadlessAttack =
            canAct &&
            action.automation === 'headless' &&
            (
              action.kind === 'melee' ||
              action.kind === 'ranged' ||
              action.kind === 'aoe' ||
              action.kind === 'multiattack'
            )
          const canHeadlessSelfAction =
            canAct &&
            action.automation === 'headless' &&
            action.kind === 'self-special'
          const hasAttackRoll =
            action.kind === 'melee' ||
            action.kind === 'ranged' ||
            action.kind === 'multiattack'
          const unavailableByAttackCap =
            action.kind === 'multiattack' && multiattackUnavailable === true
          const unavailableByRequiredEffect =
            action.requiredActiveEffectDefinitionId != null &&
            !activeEffectDefinitionIds?.has(action.requiredActiveEffectDefinitionId)
          const unavailableByForbiddenEffect =
            action.forbiddenActiveEffectDefinitionId != null &&
            activeEffectDefinitionIds?.has(action.forbiddenActiveEffectDefinitionId) === true
          const unavailableByEffect = unavailableByRequiredEffect || unavailableByForbiddenEffect
          const canAdjudicate = canAct && action.automation !== 'headless'
          return (
            <article
              key={`${title}:${action.name}:${actionIndex}`}
              className={`rounded-xl border px-3 py-2 ${toneClasses}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold">{action.name}</p>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {recharge ? (
                    <span className={[
                      'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                      rechargeReady
                        ? 'bg-cyan-500/15 text-cyan-100'
                        : 'bg-slate-500/15 text-slate-400',
                    ].join(' ')}>
                      充能 {recharge.minimum}–{recharge.dieSides} · {rechargeReady ? '已就绪' : '未充能'}
                    </span>
                  ) : null}
                  {perDay ? (
                    <span className={[
                      'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                      perDayReady
                        ? 'bg-cyan-500/15 text-cyan-100'
                        : 'bg-slate-500/15 text-slate-400',
                    ].join(' ')}>
                      每日次数 {perDayRemaining}/{perDay.max}
                    </span>
                  ) : null}
                  {action.legendaryCost != null ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                      消耗 {Math.max(1, action.legendaryCost)} 点
                    </span>
                  ) : null}
                  <span className={[
                    'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                    action.automation === 'headless'
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-amber-500/15 text-amber-200',
                  ].join(' ')}>
                    {action.automation === 'headless' ? 'Headless' : 'DM 裁定'}
                  </span>
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-400">
                {action.description}
              </p>
              {canHeadlessAttack && hasAttackRoll ? (
                <ManualAttackRollModeControl
                  actionKey={action.id || `${title}-${actionIndex}`}
                  confirmTestId={action.id ? `manual-monster-action-${action.id}` : undefined}
                  disabled={!!actionUsed || unavailableByAttackCap || unavailableByEffect || !rechargeReady || !perDayReady}
                  confirmLabel={
                    unavailableByAttackCap
                      ? '受效果限制：本回合最多一次攻击'
                      : unavailableByRequiredEffect
                      ? '需要先激活对应效果'
                      : unavailableByForbiddenEffect
                      ? '当前效果禁止该动作'
                      : actionUsed
                      ? '本回合动作已使用'
                      : `选择目标 · ${action.name}`
                  }
                  onConfirm={(rollMode) =>
                    onSelectAction?.(actionIndex, action.name, rollMode, action.id)}
                />
              ) : canHeadlessAttack || canHeadlessTargetedCondition || canHeadlessSelfAction || canAdjudicate ? (
                <button
                  type="button"
                  data-testid={action.id ? `manual-monster-action-${action.id}` : undefined}
                  disabled={actionUsed || unavailableByEffect || !rechargeReady || !perDayReady}
                  onClick={() => canAdjudicate
                    ? onSelectAdjudicatedAction?.(actionIndex, action.name, action.id)
                    : onSelectAction?.(actionIndex, action.name, 'normal', action.id)}
                  className="mt-2 w-full rounded-lg bg-rose-500/20 px-2 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {!rechargeReady
                    ? `等待充能 ${recharge?.minimum}–${recharge?.dieSides}`
                    : !perDayReady
                    ? '每日次数已耗尽'
                    : unavailableByRequiredEffect
                    ? '需要先激活对应效果'
                    : unavailableByForbiddenEffect
                    ? '当前效果禁止该动作'
                    : actionUsed
                    ? '本回合动作已使用'
                    : canAdjudicate
                      ? `提交 DM 裁定 · ${action.name}`
                      : action.kind === 'self-special'
                        ? `执行 · ${action.name}`
                        : `${action.kind === 'aoe' ? '选择落点' : '选择目标'} · ${action.name}`}
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function DmMonsterControlDock({
  monsters,
  currentTokenId,
  actionUsed,
  bonusActionUsed = false,
  actionPending = false,
  turnStartPending = false,
  movementRemainingFeet,
  movementMaximumFeet,
  movementIntent,
  canNimbleEscape = false,
  onSelectAction,
  onSelectAdjudicatedAction,
  onSelectSpell,
  onSelectAdjudicatedSpell,
  onSelectContinuation,
  onEscapeActiveEffect,
  onActivateReckless,
  onSelectMovement,
  onCancelMovement,
  endTurnPending = false,
  onEndTurn,
  initialExpanded = false,
}: {
  monsters: readonly Token[]
  currentTokenId?: string
  actionUsed: boolean
  bonusActionUsed?: boolean
  actionPending?: boolean
  turnStartPending?: boolean
  movementRemainingFeet?: number
  movementMaximumFeet?: number
  movementIntent?: Dnd5eManualMonsterMovementIntent
  canNimbleEscape?: boolean
  onSelectAction: (
    token: Token,
    actionIndex: number,
    actionName: string,
    resourceKind?: 'action' | 'bonus-action',
    rollMode?: D20RollMode,
    actionId?: string,
  ) => void
  onSelectAdjudicatedAction?: (
    token: Token,
    actionIndex: number,
    actionName: string,
    resourceKind?: 'action' | 'bonus-action',
  ) => void
  onSelectSpell?: (
    token: Token,
    spellId: string,
    spellName: string,
    slotLevel: number,
    castingTime: 'action' | 'bonus-action' | 'reaction',
  ) => void
  onSelectAdjudicatedSpell?: (
    token: Token,
    spellId: string,
    spellName: string,
    slotLevel: number,
    castingTime: 'action' | 'bonus-action' | 'reaction',
  ) => void
  onSelectContinuation?: (
    token: Token,
    continuation: Dnd5eManualMonsterMultiattackContinuation,
    rollMode?: D20RollMode,
  ) => void
  onEscapeActiveEffect?: (token: Token, effectId: string) => void
  onActivateReckless?: (token: Token) => void
  onSelectMovement?: (
    token: Token,
    kind: Dnd5eManualMonsterMovementKind,
  ) => void
  onCancelMovement?: () => void
  endTurnPending?: boolean
  onEndTurn: () => void
  initialExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [selectedTokenId, setSelectedTokenId] = useState<string>()
  const selectedToken = useMemo(
    () => monsters.find((token) => token.id === selectedTokenId) ??
      monsters.find((token) => token.id === currentTokenId) ??
      monsters[0],
    [currentTokenId, monsters, selectedTokenId],
  )
  const stats = selectedToken?.poolId ? getEnemyStatBlock(selectedToken.poolId) : undefined
  const structuredMonster = selectedToken?.poolId ? getDnd5eSrdMonster(selectedToken.poolId) : undefined
  const template = selectedToken?.poolId ? getEnemyTemplate(selectedToken.poolId) : undefined
  const isCurrent = !!selectedToken && selectedToken.id === currentTokenId
  const canAct = isCurrent
  const movementLocked = !!selectedToken && isTokenMovementLocked(selectedToken)
  const escapeEffect = normalizeDnd5eActiveEffects(
    selectedToken?.dnd5eCombatState?.activeEffects,
  ).find((effect) => effect.escapeCheck?.economy === 'action')
  const maximumAttacksPerTurn = dnd5eActiveMaximumAttacksPerTurn(
    selectedToken?.dnd5eCombatState?.activeEffects,
  )
  const activeEffectDefinitionIds = new Set(
    effectiveDnd5eActiveEffects(selectedToken?.dnd5eCombatState?.activeEffects)
      .map((effect) => effect.definitionId),
  )
  const multiattackUnavailable = maximumAttacksPerTurn != null && maximumAttacksPerTurn < 2
  const spellOptions = selectedToken
    ? dnd5eManualMonsterSpellOptions(selectedToken)
    : []
  const multiattackContinuation = canAct && !multiattackUnavailable
    ? dnd5eManualMonsterMultiattackContinuation(selectedToken)
    : undefined
  const maxHp = selectedToken?.maxHp ?? template?.maxHp ?? stats?.maxHp ?? 1
  const hp = selectedToken?.hp ?? maxHp
  const hpPercent = Math.max(0, Math.min(100, maxHp > 0 ? hp / maxHp * 100 : 0))
  const effectiveArmorClass = stats
    ? stats.ac + dnd5eActiveArmorClassBonus(selectedToken?.dnd5eCombatState?.activeEffects)
    : undefined
  const effectiveSpeedLabel = movementLocked
    ? '0 尺'
    : stats && isCurrent && movementMaximumFeet != null
    ? `${Math.max(0, Math.floor(movementMaximumFeet))} 尺`
    : structuredMonster && selectedToken
      ? `${dnd5eMonsterTokenEffectiveSpeed(selectedToken, dnd5eMonsterMapSpeed(structuredMonster))} 尺`
      : stats?.speed
  const legendaryMaximum = stats?.legendaryActions?.length
    ? Math.max(0, stats.legendaryActionPoints ?? 3)
    : 0
  const legendaryCurrent = legendaryMaximum > 0
    ? Math.max(
        0,
        Math.min(
          legendaryMaximum,
          selectedToken?.dnd5eCombatState?.monsterLegendaryActionPoints ?? legendaryMaximum,
        ),
      )
    : 0
  const effectiveMovementRemainingFeet = movementLocked ? 0 : Math.max(0, movementRemainingFeet ?? 0)
  const movementAvailable = effectiveMovementRemainingFeet > 0
  const jumpDistanceMultiplier = dnd5eActiveJumpDistanceMultiplier(
    selectedToken?.dnd5eCombatState?.activeEffects,
  )
  const runningJumpMaximumFeet = stats
    ? dnd5eManualMonsterJumpMaximumFeet('running-jump', stats.abilities.str, jumpDistanceMultiplier)
    : undefined
  const standingJumpMaximumFeet = stats
    ? dnd5eManualMonsterJumpMaximumFeet('standing-jump', stats.abilities.str, jumpDistanceMultiplier)
    : undefined
  const movementOptions: Array<{
    kind: Dnd5eManualMonsterMovementKind
    label: string
    title: string
    disabled: boolean
    icon: typeof Footprints
  }> = [
    { kind: 'move', label: '移动', title: '使用剩余移动力移动', disabled: !movementAvailable, icon: Footprints },
    { kind: 'dash', label: '疾走', title: '消耗动作，增加等于速度的移动力', disabled: actionUsed || movementLocked, icon: Gauge },
    { kind: 'disengage', label: '撤离', title: '消耗动作，本回合移动不触发借机攻击', disabled: actionUsed || !movementAvailable, icon: LogOut },
    { kind: 'running-jump', label: '助跑跳', title: runningJumpMaximumFeet == null ? '按力量值限制助跑跳远距离' : `先步行助跑至少 10 尺，最多跳 ${runningJumpMaximumFeet} 尺`, disabled: !movementAvailable, icon: Rabbit },
    { kind: 'standing-jump', label: '立定跳', title: standingJumpMaximumFeet == null ? '按力量值一半限制立定跳远距离' : `无需助跑，最多跳 ${standingJumpMaximumFeet} 尺`, disabled: !movementAvailable, icon: Rabbit },
    ...(canNimbleEscape ? [{
      kind: 'nimble-disengage' as const,
      label: '灵巧撤离',
      title: '消耗附赠动作撤离，仍可用动作攻击',
      disabled: bonusActionUsed || !movementAvailable,
      icon: LogOut,
    }] : []),
  ]

  if (monsters.length === 0) return null

  return (
    <div
      data-testid="dm-monster-control-dock"
      className="pointer-events-auto absolute bottom-3 left-3 z-[110] flex max-w-[min(620px,calc(100%-1.5rem))] flex-col-reverse gap-2"
    >
      <div className="glass flex items-center gap-2 rounded-2xl border border-rose-300/15 bg-void-950/90 p-2 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
          title={expanded ? '收起怪物控制台' : '展开怪物控制台'}
        >
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>
        <div className="flex min-w-0 gap-2 overflow-x-auto py-0.5">
          {monsters.map((token) => {
            const current = token.id === currentTokenId
            const selected = token.id === selectedToken?.id
            const tokenMaxHp = token.maxHp ?? getEnemyTemplate(token.poolId ?? '')?.maxHp ?? 1
            const defeated = (token.hp ?? tokenMaxHp) <= 0
            return (
              <button
                key={token.id}
                type="button"
                data-current={current || undefined}
                data-selected={selected || undefined}
                onClick={() => {
                  setSelectedTokenId(token.id)
                  setExpanded(true)
                }}
                className={[
                  'relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-900 transition',
                  current ? 'scale-110 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,.55)]' :
                    selected ? 'border-rose-300' : 'border-white/15 hover:border-white/35',
                  defeated ? 'grayscale opacity-40' : '',
                ].join(' ')}
                title={`${token.label}${current ? ' · 当前回合' : ''}`}
              >
                <SharedMonsterIcon token={token} className="h-full w-full object-cover" />
                {current ? (
                  <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-void-950 bg-amber-300" />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {expanded && selectedToken ? (
        <div className="glass max-h-[min(620px,calc(100vh-10rem))] w-[min(520px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-rose-300/15 bg-void-950/95 shadow-2xl backdrop-blur-xl">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-void-950/95 px-4 py-3 backdrop-blur-xl">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-void-900"
              style={{ borderColor: selectedToken.color || template?.color || '#fb7185' }}
            >
              <SharedMonsterIcon token={selectedToken} className="h-full w-full object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-bold text-slate-100">{selectedToken.label}</h3>
                {isCurrent ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">当前回合</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                HP {hp}/{maxHp}
                {stats ? ` · AC ${effectiveArmorClass} · CR ${stats.cr}` : ''}
                {legendaryMaximum > 0
                  ? ` · 传奇动作点 ${legendaryCurrent}/${legendaryMaximum}`
                  : ''}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-rose-400" style={{ width: `${hpPercent}%` }} />
              </div>
            </div>
            {canAct ? (
              <button
                type="button"
                onClick={onEndTurn}
                disabled={endTurnPending}
                className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-45"
              >
                {endTurnPending ? '推进中…' : '结束回合'}
              </button>
            ) : null}
          </header>

          <div className="space-y-4 p-4">
            {structuredMonster?.traits.some((trait) => trait.rule?.kind === 'reckless') ? (
              <section className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <button
                  type="button"
                  data-testid="manual-monster-reckless"
                  disabled={!canAct || actionUsed || actionPending || turnStartPending ||
                    !!selectedToken?.dnd5eCombatState?.recklessAttackTurnKey}
                  onClick={() => selectedToken && onActivateReckless?.(selectedToken)}
                  className="rounded-lg bg-amber-400/20 px-3 py-2 font-semibold disabled:opacity-40"
                >
                  {selectedToken?.dnd5eCombatState?.recklessAttackTurnKey ? '鲁莽攻击已启用' : '启用鲁莽攻击（可选）'}
                </button>
                <p className="mt-2">本回合近战武器攻击获得优势；直到下回合开始，对你的攻击也获得优势。</p>
              </section>
            ) : null}
            {!isCurrent && (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                现在可以检视该怪物；只有轮到它时 DM 才能执行行动。
              </p>
            )}
            {turnStartPending && isCurrent ? (
              <p
                data-testid="manual-monster-turn-start-pending"
                className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100"
              >
                正在结算本回合开始的充能、状态与持续效果；完成后会自动开放移动和动作。
              </p>
            ) : null}
            {canAct && movementRemainingFeet != null ? (
              <section
                data-testid="manual-monster-movement-status"
                className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <span>先选择移动方式，再点击地图落点；取消不会消耗动作。</span>
                  <span className="shrink-0 font-bold tabular-nums">
                    剩余 {effectiveMovementRemainingFeet}/{Math.max(
                      effectiveMovementRemainingFeet,
                      movementMaximumFeet ?? movementRemainingFeet,
                    )} 尺
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {movementOptions.map((option) => {
                    const Icon = option.icon
                    const selected = movementIntent?.kind === option.kind
                    return (
                      <button
                        key={option.kind}
                        type="button"
                        data-testid={`manual-monster-move-${option.kind}`}
                        data-selected={selected || undefined}
                        disabled={actionPending || option.disabled}
                        title={option.title}
                        onClick={() => {
                          if (selected) onCancelMovement?.()
                          else {
                            // Movement needs the battlefield, not the expanded
                            // stat block. Keep the compact token rail available
                            // while releasing the map click surface.
                            setExpanded(false)
                            onSelectMovement?.(selectedToken, option.kind)
                          }
                        }}
                        className={[
                          'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition',
                          selected
                            ? 'border-cyan-200/70 bg-cyan-300/25 text-white shadow-[0_0_12px_rgba(34,211,238,.28)]'
                            : 'border-white/10 bg-black/15 text-cyan-100 hover:bg-cyan-300/15',
                          'disabled:cursor-not-allowed disabled:opacity-35',
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {canAct && escapeEffect?.escapeCheck ? (
              <section
                data-testid="manual-monster-active-effect-escape"
                className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100"
              >
                <p className="font-semibold">
                  {escapeEffect.label || '受限状态'}使你无法正常移动；可以消耗一个动作尝试挣脱。
                </p>
                <button
                  type="button"
                  data-testid="manual-monster-escape-active-effect"
                  disabled={actionUsed || actionPending}
                  onClick={() => onEscapeActiveEffect?.(selectedToken, escapeEffect.id)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200/25 bg-amber-300/15 px-2 py-1.5 text-[11px] font-semibold text-amber-50 hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Hand className="h-3.5 w-3.5" />
                  挣脱{escapeEffect.label || '状态'}（{ABILITIES.find((ability) => ability.key === escapeEffect.escapeCheck?.ability)?.label ?? escapeEffect.escapeCheck.ability}检定 DC {escapeEffect.escapeCheck.dc}）
                </button>
              </section>
            ) : null}

            {multiattackContinuation ? (
              <section
                data-testid="manual-monster-multiattack-continuation"
                className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-amber-100">继续多重攻击</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">
                      {multiattackContinuation.parentActionName} · 第 {multiattackContinuation.occurrenceNumber}/{multiattackContinuation.occurrenceCount} 击：
                      {multiattackContinuation.actionName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                    Headless 续击
                  </span>
                </div>
                <div>
                  <ManualAttackRollModeControl
                    actionKey={`continuation-${multiattackContinuation.parentActionId}-${multiattackContinuation.occurrenceIndex}`}
                    confirmTestId="continue-monster-multiattack"
                    disabled={actionPending}
                    confirmLabel={actionPending
                      ? '正在结算当前攻击…'
                      : `选择目标 · ${multiattackContinuation.actionName}`}
                    onConfirm={(rollMode) =>
                      onSelectContinuation?.(selectedToken, multiattackContinuation, rollMode)}
                  />
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                  父动作已消耗；本按钮只结算尚未完成的这一击，不会再次消耗动作。
                </p>
              </section>
            ) : null}

            {stats ? (
              <>
                <section className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/5 px-2 py-2">
                    <Shield className="mx-auto h-4 w-4 text-cyan-300" />
                    <p className="mt-1 text-[10px] text-slate-500">护甲等级</p>
                    <p className="text-sm font-bold text-slate-100">{effectiveArmorClass}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-2 py-2">
                    <Swords className="mx-auto h-4 w-4 text-rose-300" />
                    <p className="mt-1 text-[10px] text-slate-500">挑战等级</p>
                    <p className="text-sm font-bold text-slate-100">{stats.cr}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-2 py-2">
                    <Sparkles className="mx-auto h-4 w-4 text-violet-300" />
                    <p className="mt-1 text-[10px] text-slate-500">速度</p>
                    <p className="truncate text-sm font-bold text-slate-100">{effectiveSpeedLabel}</p>
                  </div>
                </section>

                <section>
                  <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">属性</h4>
                  <div className="grid grid-cols-6 gap-1">
                    {ABILITIES.map((ability) => {
                      const score = stats.abilities[ability.key]
                      return (
                        <div key={ability.key} className="rounded-lg bg-white/5 px-1 py-1.5 text-center">
                          <p className="text-[9px] text-slate-500">{ability.label}</p>
                          <p className="text-xs font-bold text-slate-100">{score}</p>
                          <p className="text-[9px] text-slate-400">{formatMod(abilityMod(score))}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {stats.skills?.length ? (
                  <section>
                    <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">技能</h4>
                    <p className="text-xs leading-relaxed text-slate-300">
                      {stats.skills.map((skill) => `${skill.name} ${skill.bonus}`).join('；')}
                    </p>
                  </section>
                ) : null}

                {(stats.senses || stats.languages || stats.damageResistances?.length ||
                  stats.damageImmunities?.length || stats.conditionImmunities?.length) ? (
                  <section className="space-y-1 rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                    {stats.senses ? <p><span className="text-slate-500">感官 · </span>{stats.senses}</p> : null}
                    {stats.languages ? <p><span className="text-slate-500">语言 · </span>{stats.languages}</p> : null}
                    {stats.damageResistances?.length ? <p><span className="text-slate-500">伤害抗性 · </span>{stats.damageResistances.join('、')}</p> : null}
                    {stats.damageImmunities?.length ? <p><span className="text-slate-500">伤害免疫 · </span>{stats.damageImmunities.join('、')}</p> : null}
                    {stats.conditionImmunities?.length ? <p><span className="text-slate-500">状态免疫 · </span>{stats.conditionImmunities.join('、')}</p> : null}
                  </section>
                ) : null}

                {stats.traits.length ? (
                  <section>
                    <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">特性</h4>
                    <div className="space-y-1.5">
                      {stats.traits.map((trait) => (
                        <article key={trait.name} className="rounded-xl border border-violet-400/15 bg-violet-500/10 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-violet-100">{trait.name}</p>
                            <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                              {trait.automation === 'headless' ? 'Headless' : 'DM 裁定'}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-400">{trait.description}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <ActionList
                  title="动作"
                  actions={stats.actions}
                  tone="rose"
                  canAct={canAct}
                  actionUsed={actionUsed}
                  multiattackUnavailable={multiattackUnavailable}
                  activeEffectDefinitionIds={activeEffectDefinitionIds}
                  rechargeReadyByActionId={
                    selectedToken.dnd5eCombatState?.monsterRechargeReadyByActionId
                  }
                  actionUsesByActionId={
                    selectedToken.dnd5eCombatState?.monsterActionUsesByActionId
                  }
                  onSelectAction={(actionIndex, actionName, rollMode, actionId) =>
                    onSelectAction(
                      selectedToken,
                      dnd5eManualMonsterActionIndexById(
                        selectedToken,
                        actionId,
                        actionIndex,
                      ),
                      actionName,
                      'action',
                      rollMode,
                      actionId,
                    )}
                  onSelectAdjudicatedAction={(actionIndex, actionName, actionId) =>
                    onSelectAdjudicatedAction?.(
                      selectedToken,
                      dnd5eManualMonsterActionIndexById(
                        selectedToken,
                        actionId,
                        actionIndex,
                      ),
                      actionName,
                      'action',
                    )}
                />

                {stats.spellcasting ? (
                  <section className="rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-sky-100">法术</h4>
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-200">
                        {spellOptions.filter((spell) => spell.automation === 'full').length} 项可结算
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-400">{stats.spellcasting}</p>
                    {spellOptions.length ? (
                      <div className="mt-2 space-y-1.5">
                        {spellOptions.map((spell) => {
                          const economyUsed = spell.castingTime === 'bonus-action'
                            ? bonusActionUsed
                            : spell.castingTime === 'reaction'
                              ? true
                              : actionUsed
                          const castingTimeLabel = spell.castingTime === 'bonus-action'
                            ? '附赠动作'
                            : spell.castingTime === 'reaction'
                              ? '反应'
                              : '动作'
                          return (
                            <article
                              key={spell.spellId}
                              className="rounded-lg border border-sky-300/10 bg-void-950/35 px-2.5 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-sky-100">
                                    {spell.spellName}
                                  </p>
                                  <p className="mt-0.5 text-[9px] text-slate-500">
                                    {spell.level === 0 ? '戏法' : `${spell.level} 环`} · {castingTimeLabel} · {spell.rangeFeet} 尺
                                    {spell.area ? ' · 范围选点' : ' · 选择目标'}
                                  </p>
                                </div>
                                <span className={[
                                  'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold',
                                  spell.automation === 'full'
                                    ? 'bg-emerald-500/15 text-emerald-200'
                                    : 'bg-amber-500/15 text-amber-200',
                                ].join(' ')}>
                                  {spell.automation === 'full' ? 'Headless' : 'DM 裁定'}
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                  {spell.availableSlotLevels.map((slotLevel) => (
                                    <button
                                      key={`${spell.spellId}:${slotLevel}`}
                                      type="button"
                                      data-testid={`manual-monster-spell-${spell.spellId}-${slotLevel}`}
                                      disabled={!canAct || actionPending || economyUsed}
                                      onClick={() => spell.automation === 'full'
                                        ? onSelectSpell?.(
                                            selectedToken,
                                            spell.spellId,
                                            spell.spellName,
                                            slotLevel,
                                            spell.castingTime,
                                          )
                                        : onSelectAdjudicatedSpell?.(
                                            selectedToken,
                                            spell.spellId,
                                            spell.spellName,
                                            slotLevel,
                                            spell.castingTime,
                                          )}
                                      className="rounded-md border border-sky-300/15 bg-sky-500/15 px-2 py-1 text-[10px] font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                      {spell.automation === 'full' ? '' : 'DM 裁定 · '}
                                      {spell.resourceLabels[String(slotLevel)] ?? `${slotLevel} 环`}
                                    </button>
                                  ))}
                                  {spell.availableSlotLevels.length === 0 ? (
                                    <span className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-200">
                                      资源已耗尽
                                    </span>
                                  ) : null}
                                </div>
                              {spell.automation !== 'full' ? (
                                <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/80">
                                  {spell.compatibilityReason ?? '该法术仍需 DM 手动裁定。'}
                                </p>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <ActionList
                  title="附赠动作"
                  actions={stats.bonusActions}
                  tone="emerald"
                  canAct={canAct}
                  actionUsed={bonusActionUsed}
                  activeEffectDefinitionIds={activeEffectDefinitionIds}
                  onSelectAction={(actionIndex, actionName, rollMode, actionId) =>
                    onSelectAction(
                      selectedToken,
                      dnd5eManualMonsterActionIndexById(
                        selectedToken,
                        actionId,
                        actionIndex,
                        'bonus-action',
                      ),
                      actionName,
                      'bonus-action',
                      rollMode,
                      actionId,
                    )}
                  onSelectAdjudicatedAction={(actionIndex, actionName, actionId) =>
                    onSelectAdjudicatedAction?.(
                      selectedToken,
                      dnd5eManualMonsterActionIndexById(
                        selectedToken,
                        actionId,
                        actionIndex,
                        'bonus-action',
                      ),
                      actionName,
                      'bonus-action',
                    )}
                />
                <ActionList title="反应" actions={stats.reactions} tone="cyan" activeEffectDefinitionIds={activeEffectDefinitionIds} />
                {stats.legendaryActions?.length ? (
                  <section>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">传奇动作</h4>
                      <span
                        data-testid="monster-legendary-action-points"
                        className="rounded-lg border border-amber-300/15 bg-amber-500/10 px-2 py-1 text-[10px] font-bold tabular-nums text-amber-200"
                      >
                        传奇动作点 {legendaryCurrent} / {legendaryMaximum}
                      </span>
                    </div>
                    <ActionList title="可用动作" actions={stats.legendaryActions} tone="amber" activeEffectDefinitionIds={activeEffectDefinitionIds} />
                  </section>
                ) : null}
                <ActionList title="巢穴动作" actions={stats.lairActions} tone="fuchsia" activeEffectDefinitionIds={activeEffectDefinitionIds} />
              </>
            ) : (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                该 Token 没有关联到可校验的怪物数据块，DM 仍可检视生命值，但不能执行 Headless 行动。
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
