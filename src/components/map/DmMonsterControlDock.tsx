import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Footprints,
  Gauge,
  LogOut,
  Pause,
  Play,
  Rabbit,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react'
import type { Token } from '../../store/maps'
import { getEnemyTemplate } from '../../lib/enemyPool'
import { getEnemyStatBlock, type MonsterAction } from '../../lib/enemyStatBlocks'
import { getImage } from '../../lib/imageStore'
import { ABILITIES, abilityMod, formatMod } from '../../lib/dnd'
import type { CombatSettlementMode } from '../../lib/combatSettlementMode'
import type { Dnd5eMonsterControlStateV1 } from '../../lib/monsterControlState'
import { dnd5eManualMonsterSpellOptions } from '../../lib/monsterManualSpell'
import {
  dnd5eManualMonsterMultiattackContinuation,
  type Dnd5eManualMonsterMovementIntent,
  type Dnd5eManualMonsterMovementKind,
  type Dnd5eManualMonsterMultiattackContinuation,
} from '../../lib/monsterManualControl'

function SharedMonsterIcon({
  token,
  className,
}: {
  token: Token
  className: string
}) {
  const template = token.poolId ? getEnemyTemplate(token.poolId) : undefined
  const fallbackSrc = token.tokenPortrait || template?.tokenPortrait
  const [loaded, setLoaded] = useState<{ imageId: string; src: string }>()

  useEffect(() => {
    if (!token.portraitImageId) return
    const imageId = token.portraitImageId
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
  }, [token.portraitImageId])

  const sharedSrc =
    token.portraitImageId && loaded?.imageId === token.portraitImageId
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

function ActionList({
  title,
  actions,
  tone,
  canAct,
  actionUsed,
  onSelectAction,
}: {
  title: string
  actions?: readonly MonsterAction[]
  tone: 'rose' | 'emerald' | 'cyan' | 'amber' | 'fuchsia'
  canAct?: boolean
  actionUsed?: boolean
  onSelectAction?: (actionIndex: number, actionName: string) => void
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
          const canHeadlessAttack =
            canAct &&
            action.automation === 'headless' &&
            (
              action.kind === 'melee' ||
              action.kind === 'ranged' ||
              (action.kind === 'aoe' && action.actorLanding === true) ||
              action.kind === 'multiattack'
            )
          return (
            <article
              key={`${title}:${action.name}:${actionIndex}`}
              className={`rounded-xl border px-3 py-2 ${toneClasses}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold">{action.name}</p>
                <span className={[
                  'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold',
                  action.automation === 'headless'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-amber-500/15 text-amber-200',
                ].join(' ')}>
                  {action.automation === 'headless' ? 'Headless' : 'DM 裁定'}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-400">
                {action.description}
              </p>
              {canHeadlessAttack ? (
                <button
                  type="button"
                  disabled={actionUsed}
                  onClick={() => onSelectAction?.(actionIndex, action.name)}
                  className="mt-2 w-full rounded-lg bg-rose-500/20 px-2 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionUsed
                    ? '本回合动作已使用'
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
  control,
  settlementMode,
  actionUsed,
  bonusActionUsed = false,
  actionPending = false,
  movementRemainingFeet,
  movementMaximumFeet,
  movementIntent,
  canNimbleEscape = false,
  onRequestTakeover,
  onResumeAutomation,
  onSelectAction,
  onSelectSpell,
  onSelectContinuation,
  onSelectMovement,
  onCancelMovement,
  onEndTurn,
  initialExpanded = false,
}: {
  monsters: readonly Token[]
  currentTokenId?: string
  control: Dnd5eMonsterControlStateV1
  settlementMode: CombatSettlementMode
  actionUsed: boolean
  bonusActionUsed?: boolean
  actionPending?: boolean
  movementRemainingFeet?: number
  movementMaximumFeet?: number
  movementIntent?: Dnd5eManualMonsterMovementIntent
  canNimbleEscape?: boolean
  onRequestTakeover: () => void
  onResumeAutomation: () => void
  onSelectAction: (
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
  onSelectContinuation?: (
    token: Token,
    continuation: Dnd5eManualMonsterMultiattackContinuation,
  ) => void
  onSelectMovement?: (
    token: Token,
    kind: Dnd5eManualMonsterMovementKind,
  ) => void
  onCancelMovement?: () => void
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
  const template = selectedToken?.poolId ? getEnemyTemplate(selectedToken.poolId) : undefined
  const isCurrent = !!selectedToken && selectedToken.id === currentTokenId
  const isManual = control.mode === 'manual'
  const canAct = isManual && isCurrent
  const spellOptions = selectedToken
    ? dnd5eManualMonsterSpellOptions(selectedToken)
    : []
  const multiattackContinuation = canAct
    ? dnd5eManualMonsterMultiattackContinuation(selectedToken)
    : undefined
  const maxHp = selectedToken?.maxHp ?? template?.maxHp ?? stats?.maxHp ?? 1
  const hp = selectedToken?.hp ?? maxHp
  const hpPercent = Math.max(0, Math.min(100, maxHp > 0 ? hp / maxHp * 100 : 0))
  const movementAvailable = Math.max(0, movementRemainingFeet ?? 0) > 0
  const movementOptions: Array<{
    kind: Dnd5eManualMonsterMovementKind
    label: string
    title: string
    disabled: boolean
    icon: typeof Footprints
  }> = [
    { kind: 'move', label: '移动', title: '使用剩余移动力移动', disabled: !movementAvailable, icon: Footprints },
    { kind: 'dash', label: '疾走', title: '消耗动作，增加等于速度的移动力', disabled: actionUsed, icon: Gauge },
    { kind: 'disengage', label: '撤离', title: '消耗动作，本回合移动不触发借机攻击', disabled: actionUsed || !movementAvailable, icon: LogOut },
    { kind: 'running-jump', label: '助跑跳', title: '按力量值限制助跑跳远距离', disabled: !movementAvailable, icon: Rabbit },
    { kind: 'standing-jump', label: '立定跳', title: '按力量值一半限制立定跳远距离', disabled: !movementAvailable, icon: Rabbit },
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
      className="pointer-events-auto absolute bottom-3 left-3 z-[55] flex max-w-[min(620px,calc(100%-1.5rem))] flex-col-reverse gap-2"
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
        <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-white/10 pl-2">
          {isManual ? (
            <button
              type="button"
              data-testid="resume-monster-automation"
              disabled={settlementMode === 'manual'}
              onClick={onResumeAutomation}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              title={settlementMode === 'manual' ? '手动结算模式不运行怪物 AI' : '恢复怪物自动行动'}
            >
              <Play className="h-4 w-4" />
              恢复 AI
            </button>
          ) : (
            <button
              type="button"
              data-testid="request-monster-takeover"
              disabled={control.pauseRequested}
              onClick={onRequestTakeover}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:cursor-wait disabled:opacity-70"
            >
              {control.pauseRequested ? <Clock3 className="h-4 w-4 animate-pulse" /> : <Pause className="h-4 w-4" />}
              {control.pauseRequested ? '结算后接管' : '暂停并接管'}
            </button>
          )}
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
                {stats ? ` · AC ${stats.ac} · CR ${stats.cr}` : ''}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-rose-400" style={{ width: `${hpPercent}%` }} />
              </div>
            </div>
            {canAct ? (
              <button
                type="button"
                onClick={onEndTurn}
                className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                结束回合
              </button>
            ) : null}
          </header>

          <div className="space-y-4 p-4">
            {!isCurrent && (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                现在可以检视该怪物；只有轮到它且 DM 已接管时才能执行行动。
              </p>
            )}
            {control.pauseRequested && isCurrent && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                已请求接管。当前命中、伤害、豁免与附带效果会先完整结算，随后操作权交给 DM。
              </p>
            )}
            {canAct && movementRemainingFeet != null ? (
              <section
                data-testid="manual-monster-movement-status"
                className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <span>先选择移动方式，再点击地图落点；取消不会消耗动作。</span>
                  <span className="shrink-0 font-bold tabular-nums">
                    剩余 {Math.max(0, movementRemainingFeet)}/{Math.max(
                      Math.max(0, movementRemainingFeet),
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
                          else onSelectMovement?.(selectedToken, option.kind)
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
                <button
                  type="button"
                  data-testid="continue-monster-multiattack"
                  disabled={actionPending}
                  onClick={() => onSelectContinuation?.(selectedToken, multiattackContinuation)}
                  className="mt-2 w-full rounded-lg bg-amber-400/20 px-2 py-1.5 text-[11px] font-semibold text-amber-50 hover:bg-amber-400/30 disabled:cursor-wait disabled:opacity-40"
                >
                  {actionPending
                    ? '正在结算当前攻击…'
                    : `选择目标 · ${multiattackContinuation.actionName}`}
                </button>
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
                    <p className="text-sm font-bold text-slate-100">{stats.ac}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-2 py-2">
                    <Swords className="mx-auto h-4 w-4 text-rose-300" />
                    <p className="mt-1 text-[10px] text-slate-500">挑战等级</p>
                    <p className="text-sm font-bold text-slate-100">{stats.cr}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-2 py-2">
                    <Sparkles className="mx-auto h-4 w-4 text-violet-300" />
                    <p className="mt-1 text-[10px] text-slate-500">速度</p>
                    <p className="truncate text-sm font-bold text-slate-100">{stats.speed}</p>
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
                  onSelectAction={(actionIndex, actionName) =>
                    onSelectAction(selectedToken, actionIndex, actionName, 'action')}
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
                              {spell.automation === 'full' ? (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {spell.availableSlotLevels.map((slotLevel) => (
                                    <button
                                      key={`${spell.spellId}:${slotLevel}`}
                                      type="button"
                                      data-testid={`manual-monster-spell-${spell.spellId}-${slotLevel}`}
                                      disabled={!canAct || actionPending || economyUsed}
                                      onClick={() => onSelectSpell?.(
                                        selectedToken,
                                        spell.spellId,
                                        spell.spellName,
                                        slotLevel,
                                        spell.castingTime,
                                      )}
                                      className="rounded-md border border-sky-300/15 bg-sky-500/15 px-2 py-1 text-[10px] font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                      {spell.resourceLabels[String(slotLevel)] ?? `${slotLevel} 环`}
                                    </button>
                                  ))}
                                  {spell.availableSlotLevels.length === 0 ? (
                                    <span className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-200">
                                      资源已耗尽
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/80">
                                  {spell.compatibilityReason ?? '该法术仍需 DM 手动裁定。'}
                                </p>
                              )}
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
                  onSelectAction={(actionIndex, actionName) =>
                    onSelectAction(selectedToken, actionIndex, actionName, 'bonus-action')}
                />
                <ActionList title="反应" actions={stats.reactions} tone="cyan" />
                <ActionList title="传奇动作" actions={stats.legendaryActions} tone="amber" />
                <ActionList title="巢穴动作" actions={stats.lairActions} tone="fuchsia" />
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
