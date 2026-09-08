import { useMemo, useState } from 'react'
import { Hand, ListChecks } from 'lucide-react'
import type { Dnd5eBasicActionPayload } from '../../lib/sharedCombatTypes'
import type { Dnd5eActivityBasicActionGrantV1 } from '../../rulesets/dnd5e'
import { dnd5eBasicActionEconomyAvailable } from './dnd5eBasicActionEconomy'

export interface Dnd5eBasicActionTarget {
  tokenId: string
  label: string
  opposed?: boolean
  currentHp: number
  distanceFeet: number
  awakenable?: boolean
  animateDeadControlled?: boolean
  controlledUndeadCommandRangeFeet?: 60 | 120
  animateObjectsControlled?: boolean
}

export function dnd5eControlledUndeadCommandTargets(
  targets: readonly Dnd5eBasicActionTarget[],
): Dnd5eBasicActionTarget[] {
  return targets.filter((target) =>
    target.animateDeadControlled === true && target.currentHp > 0 &&
      target.distanceFeet <= (target.controlledUndeadCommandRangeFeet ?? 60),
  )
}

export interface Dnd5eGrappleEscapeTarget {
  grapplerTokenId: string
  dc?: number
}

export interface Dnd5eDismissibleEffect {
  effectId: string
  label: string
  actionLabel: string
}

const EMPTY_GRAPPLE_ESCAPES: readonly Dnd5eGrappleEscapeTarget[] = []
const EMPTY_DISMISSIBLE_EFFECTS: readonly Dnd5eDismissibleEffect[] = []

type BasicActionKind = Dnd5eBasicActionPayload['kind']

export default function Dnd5eBasicActionsPanel({
  canAct,
  actionAvailable = canAct,
  bonusActionAvailable = canAct,
  pending,
  targets,
  grappleEscapes = EMPTY_GRAPPLE_ESCAPES,
  dismissibleEffects = EMPTY_DISMISSIBLE_EFFECTS,
  canDismissWardingBond = false,
  basicActionGrants = [],
  allowedBasicActions,
  onAction,
}: {
  canAct: boolean
  actionAvailable?: boolean
  bonusActionAvailable?: boolean
  pending: boolean
  targets: readonly Dnd5eBasicActionTarget[]
  grappleEscapes?: readonly Dnd5eGrappleEscapeTarget[]
  dismissibleEffects?: readonly Dnd5eDismissibleEffect[]
  canDismissWardingBond?: boolean
  basicActionGrants?: readonly Dnd5eActivityBasicActionGrantV1[]
  allowedBasicActions?: readonly ('dash' | 'dismiss-effect')[]
  onAction: (payload: Dnd5eBasicActionPayload) => void
}) {
  const [kind, setKind] = useState<BasicActionKind>('help')
  const [targetTokenId, setTargetTokenId] = useState('')
  const [helpKind, setHelpKind] = useState<'ability-check' | 'attack'>('attack')
  const [shoveOutcome, setShoveOutcome] = useState<'prone' | 'push'>('prone')
  const [readyTrigger, setReadyTrigger] = useState('')
  const [readyKind, setReadyKind] = useState<'attack' | 'move' | 'interact-object' | 'other'>('attack')
  const [interactionId, setInteractionId] = useState('')
  const [adjudicationDescription, setAdjudicationDescription] = useState('')
  const [selectedGrantId, setSelectedGrantId] = useState('')
  const [selectedDismissEffectId, setSelectedDismissEffectId] = useState('')
  const [animateDeadTargetIds, setAnimateDeadTargetIds] = useState<string[] | null>(null)
  const [animateDeadCommand, setAnimateDeadCommand] = useState('守卫这里，并攻击进入的敌对生物。')
  const [animateObjectsTargetIds, setAnimateObjectsTargetIds] = useState<string[] | null>(null)
  const [animateObjectsCommand, setAnimateObjectsCommand] = useState('攻击最近的敌对生物，并留在施法者 30 尺内。')

  const grappleEscapeTargetIds = useMemo(
    () => new Set(grappleEscapes.map((entry) => entry.grapplerTokenId)),
    [grappleEscapes],
  )
  const quickEscapeTargets = useMemo(() => [...new Map(
    grappleEscapes.map((escape) => [escape.grapplerTokenId, escape] as const),
  ).values()].flatMap((escape) => {
    const target = targets.find((candidate) =>
      candidate.tokenId === escape.grapplerTokenId && candidate.currentHp > 0,
    )
    return target ? [{ ...escape, target }] : []
  }), [grappleEscapes, targets])
  const targetRelation = kind === 'help' && helpKind === 'ability-check' ? 'ally'
    : kind === 'help' || kind === 'grapple' || kind === 'shove' ||
      kind === 'release-grapple' ? 'enemy'
      : kind === 'escape-grapple' ? 'grappler'
      : kind === 'wake' ? 'sleeping'
      : 'none'
  const targetOptions = useMemo(() => targets.filter((target) => {
    if (target.currentHp <= 0) return false
    if (targetRelation === 'ally') return target.opposed === false
    if (targetRelation === 'enemy') return target.opposed === true && target.distanceFeet <= 5
    if (targetRelation === 'grappler') return grappleEscapeTargetIds.has(target.tokenId)
    if (targetRelation === 'sleeping') return target.awakenable === true && target.distanceFeet <= 5
    return true
  }), [grappleEscapeTargetIds, targetRelation, targets])
  const selectedTarget = targetOptions.some((target) => target.tokenId === targetTokenId)
    ? targetTokenId
    : targetOptions[0]?.tokenId ?? ''
  const matchingBasicActionGrants = (kind === 'grapple' || kind === 'shove')
    ? basicActionGrants.filter((grant) => grant.actions.includes(kind))
    : []
  const activeBasicActionGrantId = matchingBasicActionGrants.some((grant) => grant.grantId === selectedGrantId)
    ? selectedGrantId
    : ''
  const economyAvailable = dnd5eBasicActionEconomyAvailable({
    kind,
    actionAvailable,
    bonusActionAvailable,
    usesBonusActionGrant: !!activeBasicActionGrantId,
  })
  const actionAllowedByRestriction = allowedBasicActions == null ||
    (kind === 'dismiss-effect' && allowedBasicActions.includes('dismiss-effect'))
  const activeDismissEffectId = dismissibleEffects.some((effect) =>
    effect.effectId === selectedDismissEffectId)
    ? selectedDismissEffectId
    : dismissibleEffects[0]?.effectId ?? ''
  const animateDeadTargets = dnd5eControlledUndeadCommandTargets(targets)
  const selectedAnimateDeadTargetIds = (animateDeadTargetIds ?? animateDeadTargets.map((target) => target.tokenId))
    .filter((targetId) => animateDeadTargets.some((target) => target.tokenId === targetId))
  const animateObjectsTargets = targets.filter((target) =>
    target.animateObjectsControlled === true && target.currentHp > 0 && target.distanceFeet <= 500,
  )
  const selectedAnimateObjectsTargetIds = (animateObjectsTargetIds ?? animateObjectsTargets.map((target) => target.tokenId))
    .filter((targetId) => animateObjectsTargets.some((target) => target.tokenId === targetId))

  const buildPayload = (): Dnd5eBasicActionPayload | undefined => {
    if (
      kind === 'dash' || kind === 'hide' || kind === 'escape-effect' ||
      kind === 'dismiss-warding-bond'
    ) return { kind }
    if (kind === 'dismiss-effect') return activeDismissEffectId
      ? { kind, effectId: activeDismissEffectId }
      : undefined
    if (kind === 'help') return selectedTarget ? { kind, helpKind, targetTokenId: selectedTarget } : undefined
    // The defending creature chooses Athletics or Acrobatics. The authority
    // engine selects its stronger legal option; the attacker never controls it.
    if (kind === 'grapple') return selectedTarget ? { kind, targetTokenId: selectedTarget, targetDefense: 'athletics', ...(activeBasicActionGrantId ? { activityBasicActionGrantId: activeBasicActionGrantId } : {}) } : undefined
    if (kind === 'shove') return selectedTarget ? { kind, targetTokenId: selectedTarget, targetDefense: 'athletics', outcome: shoveOutcome, ...(activeBasicActionGrantId ? { activityBasicActionGrantId: activeBasicActionGrantId } : {}) } : undefined
    if (kind === 'release-grapple') return selectedTarget ? { kind, targetTokenId: selectedTarget } : undefined
    if (kind === 'escape-grapple') return selectedTarget ? { kind, targetTokenId: selectedTarget } : undefined
    if (kind === 'wake') return selectedTarget ? { kind, targetTokenId: selectedTarget } : undefined
    if (kind === 'command-animate-dead') {
      const command = animateDeadCommand.trim()
      return command && selectedAnimateDeadTargetIds.length > 0
        ? { kind, targetTokenIds: selectedAnimateDeadTargetIds, command }
        : undefined
    }
    if (kind === 'command-animate-objects') {
      const command = animateObjectsCommand.trim()
      return command && selectedAnimateObjectsTargetIds.length > 0
        ? { kind, targetTokenIds: selectedAnimateObjectsTargetIds, command }
        : undefined
    }
    if (kind === 'ready') {
      return readyTrigger.trim() ? { kind, trigger: readyTrigger.trim(), actionKind: readyKind } : undefined
    }
    if (kind === 'other-action' || kind === 'other-bonus-action') {
      return {
        kind,
        ...(adjudicationDescription.trim() ? { description: adjudicationDescription.trim() } : {}),
      }
    }
    return interactionId.trim() ? { kind: 'use-object', interactionId: interactionId.trim() } : undefined
  }
  const payload = buildPayload()

  return (
    <section className="rounded-xl border border-white/10 bg-void-900/45 p-4">
      {quickEscapeTargets.length > 0 ? (
        <div className="mb-3 space-y-2 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3" data-testid="grapple-escape-controls">
          <p className="text-xs font-semibold text-amber-100">你正被擒抱，挣脱需要消耗一个动作。</p>
          {quickEscapeTargets.map(({ target, dc }) => (
            <button
              key={target.tokenId}
              type="button"
              onClick={() => onAction({ kind: 'escape-grapple', targetTokenId: target.tokenId })}
              disabled={!canAct || !actionAvailable || pending || allowedBasicActions != null}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Hand className="h-4 w-4" />挣脱 {target.label} 的擒抱{dc != null ? `（DC ${dc}）` : ''}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-cyan-300" />
        <div><h3 className="font-bold text-slate-100">基础动作</h3><p className="text-xs text-slate-500">D&amp;D 5e 2014 · Headless 权威结算</p></div>
      </div>
      {allowedBasicActions != null ? <p
        data-testid="basic-action-restriction-notice"
        className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100"
      >当前形态只允许规则明确列出的动作；此面板中的其他基础行动不可执行。</p> : null}
      <label className="mt-3 block text-xs text-slate-400">
        动作
        <select value={kind} onChange={(event) => setKind(event.target.value as BasicActionKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200">
          <option value="help">协助</option>
          <option value="ready">准备</option>
          <option value="use-object">使用物件</option>
          <option value="grapple">擒抱</option>
          <option value="shove">推撞</option>
          <option value="release-grapple">松开擒抱</option>
          <option value="escape-grapple">挣脱擒抱</option>
          <option value="escape-effect">挣脱法术束缚</option>
          {dismissibleEffects.length > 0 ? <option value="dismiss-effect">主动解除效果</option> : null}
          {canDismissWardingBond ? <option value="dismiss-warding-bond">解除守护之链</option> : null}
          <option value="wake">唤醒睡眠生物</option>
          {animateDeadTargets.length > 0 ? <option value="command-animate-dead">操纵死尸：心灵命令</option> : null}
          {animateObjectsTargets.length > 0 ? <option value="command-animate-objects">活化物件：心灵命令</option> : null}
          <option value="other-action">其他（动作）</option>
          <option value="other-bonus-action">其他（附赠动作）</option>
        </select>
      </label>
      {kind === 'help' ? <label className="mt-2 block text-xs text-slate-400">协助类型<select value={helpKind} onChange={(event) => setHelpKind(event.target.value as typeof helpKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="attack">协助下一次攻击</option><option value="ability-check">协助能力检定</option></select></label> : null}
      {targetRelation !== 'none' ? <label className="mt-2 block text-xs text-slate-400">目标<select value={selectedTarget} onChange={(event) => setTargetTokenId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="">选择目标…</option>{targetOptions.map((target) => <option key={target.tokenId} value={target.tokenId}>{target.label} · {target.distanceFeet}尺</option>)}</select></label> : null}
      {kind === 'grapple' || kind === 'shove' ? <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">目标将自动使用力量（运动）或敏捷（体操）中较高的一项进行对抗。</p> : null}
      {matchingBasicActionGrants.length > 0 ? <label className="mt-2 block text-xs text-emerald-200">行动来源<select value={activeBasicActionGrantId} onChange={(event) => setSelectedGrantId(event.target.value)} className="mt-1 w-full rounded-lg border border-emerald-400/20 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="">普通攻击动作/替换一次攻击</option>{matchingBasicActionGrants.map((grant) => <option key={grant.grantId} value={grant.grantId}>{grant.label} · 附赠动作{kind === 'shove' && grant.shovePushDistanceBonusFeet ? ` · 额外推开 ${grant.shovePushDistanceBonusFeet} 尺` : ''}</option>)}</select></label> : null}
      {kind === 'release-grapple' ? <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">无需动作，立即松开由你通过基础动作擒抱的目标。</p> : null}
      {kind === 'escape-grapple' ? <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">消耗一个动作，以自身力量（运动）或敏捷（体操）中较高的一项，对抗擒抱者的力量（运动）。</p> : null}
      {kind === 'escape-effect' ? <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">消耗一个动作，按照当前状态规定的能力与 DC 进行检定；成功时由 Headless 权威结算移除该状态。纠缠术使用力量；黑触手允许力量或敏捷，由系统采用更有利的一项。</p> : null}
      {kind === 'dismiss-effect' ? <>
        <label className="mt-2 block text-xs text-slate-400">要解除的效果<select value={activeDismissEffectId} onChange={(event) => setSelectedDismissEffectId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="">选择效果…</option>{dismissibleEffects.map((effect) => <option key={effect.effectId} value={effect.effectId}>{effect.label} · {effect.actionLabel}</option>)}</select></label>
        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">消耗一个动作，结束规则明确允许主动解除的自身效果；由 Headless 权威事务同时结算动作资源与状态移除。</p>
      </> : null}
      {kind === 'dismiss-warding-bond' ? <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">消耗一个动作，结束由你施放且仍然生效的守护之链；目标身上的 AC、豁免与伤害抗性会在同一权威事务中移除。</p> : null}
      {kind === 'wake' ? <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">消耗一个动作，摇醒5尺内可被唤醒的昏迷生物。目标醒来，但仍保留其他状态。</p> : null}
      {kind === 'command-animate-dead' ? <div className="mt-2 space-y-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.06] p-3">
        <p className="text-xs leading-5 text-violet-100">附赠动作 · 操纵死尸创造的亡灵须在 60 尺内；唤起死灵创造的亡灵须在 120 尺内。只能选择仍受该角色控制的亡灵，且所有选中亡灵收到同一命令。</p>
        {animateDeadTargets.map((target) => <label key={target.tokenId} className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={selectedAnimateDeadTargetIds.includes(target.tokenId)} onChange={() => setAnimateDeadTargetIds((current) => {
            const selected = current ?? animateDeadTargets.map((candidate) => candidate.tokenId)
            return selected.includes(target.tokenId)
              ? selected.filter((targetId) => targetId !== target.tokenId)
              : [...selected, target.tokenId]
          })} />
          {target.label} · {target.distanceFeet}尺
        </label>)}
        <label className="block text-xs text-slate-400">相同命令<input value={animateDeadCommand} onChange={(event) => setAnimateDeadCommand(event.target.value)} maxLength={320} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200" /></label>
      </div> : null}
      {kind === 'command-animate-objects' ? <div className="mt-2 space-y-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.06] p-3">
        <p className="text-xs leading-5 text-violet-100">附赠动作 · 只能选择 500 尺内由该角色当前专注的活化物件；所有选中物件收到同一命令。没有命令时，它们只会保护自己。</p>
        {animateObjectsTargets.map((target) => <label key={target.tokenId} className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={selectedAnimateObjectsTargetIds.includes(target.tokenId)} onChange={() => setAnimateObjectsTargetIds((current) => {
            const selected = current ?? animateObjectsTargets.map((candidate) => candidate.tokenId)
            return selected.includes(target.tokenId)
              ? selected.filter((targetId) => targetId !== target.tokenId)
              : [...selected, target.tokenId]
          })} />
          {target.label} · {target.distanceFeet}尺
        </label>)}
        <label className="block text-xs text-slate-400">相同命令<input value={animateObjectsCommand} onChange={(event) => setAnimateObjectsCommand(event.target.value)} maxLength={320} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200" /></label>
      </div> : null}
      {kind === 'shove' ? <label className="mt-2 block text-xs text-slate-400">推撞结果<select value={shoveOutcome} onChange={(event) => setShoveOutcome(event.target.value as typeof shoveOutcome)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="prone">击倒</option><option value="push">沿远离攻击者方向推开 5 尺</option></select></label> : null}
      {kind === 'ready' ? <><label className="mt-2 block text-xs text-slate-400">触发条件<input value={readyTrigger} onChange={(event) => setReadyTrigger(event.target.value)} maxLength={320} placeholder="例如：敌人进入门口时" className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200" /></label><label className="mt-2 block text-xs text-slate-400">准备内容<select value={readyKind} onChange={(event) => setReadyKind(event.target.value as typeof readyKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="attack">攻击</option><option value="move">移动</option><option value="interact-object">物件交互</option><option value="other">其他（DM 裁定）</option></select></label></> : null}
      {kind === 'use-object' ? <label className="mt-2 block text-xs text-slate-400">物件或用途<input value={interactionId} onChange={(event) => setInteractionId(event.target.value)} maxLength={320} placeholder="例如：喝下治疗药水" className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200" /></label> : null}
      {kind === 'other-action' || kind === 'other-bonus-action' ? (
        <label className="mt-2 block text-xs text-slate-400">
          说明（可选）
          <textarea
            value={adjudicationDescription}
            onChange={(event) => setAdjudicationDescription(event.target.value)}
            maxLength={320}
            rows={3}
            placeholder="可描述你想做的事、目标与预期结果；留空也可提交。"
            className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"
          />
          <span className="mt-1 block text-[11px] leading-5 text-amber-200/70">
            Host 接受请求后立即消耗{kind === 'other-bonus-action' ? '附赠动作' : '动作'}，随后交由 DM 裁定；驳回裁定不会返还该行动资源。
          </span>
        </label>
      ) : null}
      <button type="button" onClick={() => payload && onAction(payload)} disabled={!canAct || !economyAvailable || pending || !payload || !actionAllowedByRestriction} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"><Hand className="h-4 w-4" />{kind === 'other-action' || kind === 'other-bonus-action' ? '提交 DM 裁定' : kind === 'command-animate-dead' || kind === 'command-animate-objects' ? '下达相同命令' : '执行动作'}</button>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">疾走与躲藏使用底部快捷栏。准备动作先登记触发条件；触发时消耗反应。推开会由 DM 权威端检查边界、占位与墙体，并自动移动 5 尺。</p>
    </section>
  )
}
