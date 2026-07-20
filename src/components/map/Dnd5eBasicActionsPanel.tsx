import { useMemo, useState } from 'react'
import { Hand, ListChecks } from 'lucide-react'
import type { Dnd5eBasicActionPayload } from '../../lib/sharedCombatTypes'

export interface Dnd5eBasicActionTarget {
  tokenId: string
  label: string
  opposed?: boolean
  currentHp: number
  distanceFeet: number
}

type BasicActionKind = Dnd5eBasicActionPayload['kind']

export default function Dnd5eBasicActionsPanel({
  canAct,
  pending,
  targets,
  onAction,
}: {
  canAct: boolean
  pending: boolean
  targets: readonly Dnd5eBasicActionTarget[]
  onAction: (payload: Dnd5eBasicActionPayload) => void
}) {
  const [kind, setKind] = useState<BasicActionKind>('dash')
  const [targetTokenId, setTargetTokenId] = useState('')
  const [helpKind, setHelpKind] = useState<'ability-check' | 'attack'>('attack')
  const [targetDefense, setTargetDefense] = useState<'athletics' | 'acrobatics'>('athletics')
  const [shoveOutcome, setShoveOutcome] = useState<'prone' | 'push'>('prone')
  const [readyTrigger, setReadyTrigger] = useState('')
  const [readyKind, setReadyKind] = useState<'attack' | 'move' | 'interact-object' | 'other'>('attack')
  const [interactionId, setInteractionId] = useState('')

  const targetRelation = kind === 'help' && helpKind === 'ability-check' ? 'ally'
    : kind === 'help' || kind === 'grapple' || kind === 'shove' ? 'enemy'
      : 'none'
  const targetOptions = useMemo(() => targets.filter((target) => {
    if (target.currentHp <= 0) return false
    if (targetRelation === 'ally') return target.opposed === false
    if (targetRelation === 'enemy') return target.opposed === true && target.distanceFeet <= 5
    return true
  }), [targetRelation, targets])
  const selectedTarget = targetOptions.some((target) => target.tokenId === targetTokenId)
    ? targetTokenId
    : targetOptions[0]?.tokenId ?? ''

  const buildPayload = (): Dnd5eBasicActionPayload | undefined => {
    if (kind === 'dash' || kind === 'hide') return { kind }
    if (kind === 'help') return selectedTarget ? { kind, helpKind, targetTokenId: selectedTarget } : undefined
    if (kind === 'grapple') return selectedTarget ? { kind, targetTokenId: selectedTarget, targetDefense } : undefined
    if (kind === 'shove') return selectedTarget ? { kind, targetTokenId: selectedTarget, targetDefense, outcome: shoveOutcome } : undefined
    if (kind === 'ready') {
      return readyTrigger.trim() ? { kind, trigger: readyTrigger.trim(), actionKind: readyKind } : undefined
    }
    return interactionId.trim() ? { kind: 'use-object', interactionId: interactionId.trim() } : undefined
  }
  const payload = buildPayload()

  return (
    <section className="rounded-xl border border-white/10 bg-void-900/45 p-4">
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-cyan-300" />
        <div><h3 className="font-bold text-slate-100">基础动作</h3><p className="text-xs text-slate-500">D&amp;D 5e 2014 · Headless 权威结算</p></div>
      </div>
      <label className="mt-3 block text-xs text-slate-400">
        动作
        <select value={kind} onChange={(event) => setKind(event.target.value as BasicActionKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200">
          <option value="dash">疾走</option>
          <option value="hide">躲藏</option>
          <option value="help">协助</option>
          <option value="ready">准备</option>
          <option value="use-object">使用物件</option>
          <option value="grapple">擒抱</option>
          <option value="shove">推撞</option>
        </select>
      </label>
      {kind === 'help' ? <label className="mt-2 block text-xs text-slate-400">协助类型<select value={helpKind} onChange={(event) => setHelpKind(event.target.value as typeof helpKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="attack">协助下一次攻击</option><option value="ability-check">协助能力检定</option></select></label> : null}
      {targetRelation !== 'none' ? <label className="mt-2 block text-xs text-slate-400">目标<select value={selectedTarget} onChange={(event) => setTargetTokenId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="">选择目标…</option>{targetOptions.map((target) => <option key={target.tokenId} value={target.tokenId}>{target.label} · {target.distanceFeet}尺</option>)}</select></label> : null}
      {kind === 'grapple' || kind === 'shove' ? <label className="mt-2 block text-xs text-slate-400">目标对抗方式<select value={targetDefense} onChange={(event) => setTargetDefense(event.target.value as typeof targetDefense)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="athletics">力量（运动）</option><option value="acrobatics">敏捷（体操）</option></select></label> : null}
      {kind === 'shove' ? <label className="mt-2 block text-xs text-slate-400">推撞结果<select value={shoveOutcome} onChange={(event) => setShoveOutcome(event.target.value as typeof shoveOutcome)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="prone">击倒</option><option value="push">推开 5 尺（DM 移动）</option></select></label> : null}
      {kind === 'ready' ? <><label className="mt-2 block text-xs text-slate-400">触发条件<input value={readyTrigger} onChange={(event) => setReadyTrigger(event.target.value)} maxLength={320} placeholder="例如：敌人进入门口时" className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200" /></label><label className="mt-2 block text-xs text-slate-400">准备内容<select value={readyKind} onChange={(event) => setReadyKind(event.target.value as typeof readyKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200"><option value="attack">攻击</option><option value="move">移动</option><option value="interact-object">物件交互</option><option value="other">其他（DM 裁定）</option></select></label></> : null}
      {kind === 'use-object' ? <label className="mt-2 block text-xs text-slate-400">物件或用途<input value={interactionId} onChange={(event) => setInteractionId(event.target.value)} maxLength={320} placeholder="例如：喝下治疗药水" className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200" /></label> : null}
      <button type="button" onClick={() => payload && onAction(payload)} disabled={!canAct || pending || !payload} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"><Hand className="h-4 w-4" />执行动作</button>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">准备动作先登记触发条件；触发时消耗反应。推开结果由 DM 依地图合法格确认位移。</p>
    </section>
  )
}
