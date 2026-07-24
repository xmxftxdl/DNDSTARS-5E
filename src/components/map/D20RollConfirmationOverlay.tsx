import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Dices, EyeOff, Sparkles } from 'lucide-react'
import type { CombatInterruptByKind } from '../../lib/combatInterruptProtocol'

interface D20RollConfirmationOverlayProps {
  interrupt: CombatInterruptByKind<'roll-confirmation'>
  isDM: boolean
  playerCharacter?: { id: string; name: string }
  busy?: boolean
  onContribute: (input: {
    featureId: string
    featureLabel: string
    replacementValue: number
  }) => void | Promise<void>
  onContinue: (acceptedContributionId?: string, dmOverrideValue?: number) => void | Promise<void>
}

export default function D20RollConfirmationOverlay({
  interrupt,
  isDM,
  playerCharacter,
  busy = false,
  onContribute,
  onContinue,
}: D20RollConfirmationOverlayProps) {
  const contributions = useMemo(
    () => [...(interrupt.contributions ?? [])].sort((left, right) => left.createdAt - right.createdAt),
    [interrupt.contributions],
  )
  const eligibleModifiers = Array.isArray(interrupt.payload.eligibleModifiers)
    ? interrupt.payload.eligibleModifiers
    : []
  const ownEligibleFeatures = playerCharacter
    ? eligibleModifiers.filter((entry) => entry.characterId === playerCharacter.id)
    : []
  const [selectedContributionId, setSelectedContributionId] = useState('')
  const [selectedFeatureId, setSelectedFeatureId] = useState(ownEligibleFeatures[0]?.featureId ?? '')
  const [replacementValue, setReplacementValue] = useState('')
  const [dmOverrideValue, setDmOverrideValue] = useState(String(interrupt.payload.originalValue))
  const [submitting, setSubmitting] = useState(false)
  const isSecretDmRoll = interrupt.payload.visibility === 'dm-only' &&
    interrupt.payload.allowDmOverride === true

  const ownContribution = playerCharacter
    ? contributions.find((entry) => entry.characterId === playerCharacter.id)
    : undefined
  const effectiveSelectedContributionId = contributions.some((entry) => entry.id === selectedContributionId)
    ? selectedContributionId
    : ''
  const selectedContribution = contributions.find((entry) => entry.id === effectiveSelectedContributionId)
  const parsedDmOverride = Number(dmOverrideValue)
  const dmOverrideValid = Number.isInteger(parsedDmOverride) && parsedDmOverride >= 1 && parsedDmOverride <= 20
  const finalValue = isSecretDmRoll && dmOverrideValid
    ? parsedDmOverride
    : selectedContribution?.replacementValue ?? interrupt.payload.originalValue

  const submitContribution = async () => {
    const parsedValue = Number(replacementValue)
    const selectedFeature = ownEligibleFeatures.find((entry) => entry.featureId === selectedFeatureId)
    if (!selectedFeature || !Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 20) return
    setSubmitting(true)
    try {
      await onContribute({
        featureId: selectedFeature.featureId,
        featureLabel: selectedFeature.featureLabel,
        replacementValue: parsedValue,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
      data-testid="d20-roll-confirmation"
      role="dialog"
      aria-modal="true"
      aria-label={isSecretDmRoll ? 'DM 暗骰确认' : '敌方 d20 结果修改'}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-violet-300/25 bg-void-950 shadow-[0_28px_100px_rgba(0,0,0,0.7)]">
        <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/20 via-indigo-500/10 to-transparent px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
              {isSecretDmRoll ? <EyeOff className="h-6 w-6" /> : <Dices className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                {isSecretDmRoll ? '暗骰待 DM 确认' : '敌方成功结果 · 反应窗口'}
              </p>
              <h2 className="mt-1 truncate text-xl font-bold text-slate-50">{interrupt.payload.label}</h2>
              {interrupt.payload.targetName && (
                <p className="mt-1 text-sm text-slate-400">目标：{interrupt.payload.targetName}</p>
              )}
            </div>
            <div className="ml-auto rounded-2xl border border-violet-300/20 bg-black/25 px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">原始 d20</p>
              <p className="text-3xl font-black tabular-nums text-violet-100">
                {interrupt.payload.originalValue}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-500/8 px-3 py-2 text-xs text-amber-100/80">
            <Clock3 className="h-4 w-4 shrink-0" />
            {isSecretDmRoll
              ? '暗骰不会向玩家公开。DM 可修正骰面后继续，最终值会写入权威 RollLedger。'
              : isDM
                ? '只有拥有已声明改骰特性的玩家可以提交结果；DM 可采用一项声明，或保留原始骰值继续。'
                : ownEligibleFeatures.length > 0
                  ? '你拥有可改变敌方 d20 的特性。若不使用，无需操作，DM 可以直接继续。'
                  : '你没有可用于本次敌方 d20 的特性，请等待 DM 继续结算。'}
          </div>

          {isDM ? (
            <div className="space-y-3">
              {isSecretDmRoll ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    DM 最终暗骰值
                  </span>
                  <input
                    data-testid="d20-dm-override"
                    type="number"
                    min={1}
                    max={20}
                    value={dmOverrideValue}
                    onChange={(event) => setDmOverrideValue(event.target.value)}
                    className="w-full rounded-xl border border-fuchsia-400/25 bg-black/25 px-4 py-3 text-center text-2xl font-black tabular-nums text-fuchsia-100 outline-none focus:border-fuchsia-300/60"
                  />
                </label>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    DM 选择最终结果
                  </p>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${effectiveSelectedContributionId === '' ? 'border-violet-400/45 bg-violet-500/12' : 'border-white/10 bg-white/[0.03]'}`}>
                    <input
                      type="radio"
                      name="d20-confirmation-result"
                      checked={effectiveSelectedContributionId === ''}
                      onChange={() => setSelectedContributionId('')}
                    />
                    <div>
                      <p className="font-semibold text-slate-100">保留原始投掷</p>
                      <p className="text-xs text-slate-500">采用 {interrupt.payload.originalValue}</p>
                    </div>
                  </label>
                  {contributions.map((entry) => (
                    <label key={entry.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${effectiveSelectedContributionId === entry.id ? 'border-emerald-400/45 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
                      <input
                        type="radio"
                        name="d20-confirmation-result"
                        checked={effectiveSelectedContributionId === entry.id}
                        onChange={() => setSelectedContributionId(entry.id)}
                      />
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-100">
                          {entry.characterName} · {entry.featureLabel}
                        </p>
                        <p className="text-xs text-slate-500">声明将 d20 替换为 {entry.replacementValue}</p>
                      </div>
                      <span className="text-2xl font-black tabular-nums text-emerald-200">
                        {entry.replacementValue}
                      </span>
                    </label>
                  ))}
                  {contributions.length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-slate-500">
                      尚无玩家提交特性声明。DM 可以保留原始结果继续。
                    </p>
                  )}
                </>
              )}
              <button
                type="button"
                disabled={busy || (isSecretDmRoll && !dmOverrideValid)}
                onClick={() => void onContinue(
                  isSecretDmRoll ? undefined : effectiveSelectedContributionId || undefined,
                  isSecretDmRoll ? parsedDmOverride : undefined,
                )}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 font-bold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50"
                data-testid="d20-roll-continue"
              >
                <CheckCircle2 className="h-5 w-5" />
                {busy ? '正在提交…' : `采用 ${finalValue} 并继续结算`}
              </button>
            </div>
          ) : playerCharacter && ownEligibleFeatures.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {playerCharacter.name} 的可用特性
              </p>
              {ownContribution && (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
                  已提交：{ownContribution.featureLabel}，替换为 {ownContribution.replacementValue}。
                  再次提交会更新本次声明。
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">能力／特性</span>
                  <select
                    value={selectedFeatureId}
                    onChange={(event) => setSelectedFeatureId(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/60"
                  >
                    {ownEligibleFeatures.map((feature) => (
                      <option key={feature.featureId} value={feature.featureId}>
                        {feature.featureLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">替换点数</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={replacementValue}
                    onChange={(event) => setReplacementValue(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/60"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={submitting || !selectedFeatureId || Number(replacementValue) < 1 || Number(replacementValue) > 20}
                onClick={() => void submitContribution()}
                className="w-full rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-3 font-semibold text-violet-100 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="d20-roll-contribute"
              >
                {submitting ? '正在提交…' : '提交给 DM 审核'}
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-slate-400">
              当前没有可用于本次投掷的特性，等待 DM 继续。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
