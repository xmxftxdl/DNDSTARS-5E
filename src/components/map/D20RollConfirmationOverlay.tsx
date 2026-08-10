import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Clock3, Dices, EyeOff } from 'lucide-react'
import type { CombatInterruptByKind } from '../../lib/combatInterruptProtocol'

interface D20RollConfirmationOverlayProps {
  interrupt: CombatInterruptByKind<'roll-confirmation'>
  isDM: boolean
  playerCharacter?: { id: string; name: string }
  busy?: boolean
  onContribute: (input: {
    featureId: string
    featureLabel: string
    replacementValue?: number
    direction?: 'add' | 'subtract'
    choiceDecision?: 'use' | 'decline'
    decline?: boolean
    selectedIndex?: number
  }) => void | Promise<void>
  onContinue: (acceptedContributionId?: string, dmOverrideValue?: number) => void | Promise<void>
}

function featurePresentation(input: {
  featureLabel: string
  modifierKind?: 'replace-d20' | 'adjust-d20' | 'choice-reroll'
  dieSides?: number
  direction?: 'add' | 'subtract'
  additionalDice?: 1 | 2
}) {
  if (input.modifierKind === 'adjust-d20') return {
    kind: '奖励骰',
    hint: `投掷 d${input.dieSides ?? '?'}，${input.direction === 'subtract' ? '从本次结果中减去' : '加入本次结果'}`,
    classes: 'border-amber-300/35 bg-amber-500/10 text-amber-100',
  }
  if (input.modifierKind === 'choice-reroll') return {
    kind: /幸运|luck/i.test(input.featureLabel) ? '幸运' : '重掷',
    hint: `额外投掷 ${input.additionalDice ?? 1} 枚 d20`,
    classes: 'border-violet-300/35 bg-violet-500/12 text-violet-100',
  }
  return {
    kind: /预言|portent/i.test(input.featureLabel) ? '预言骰' : '替换结果',
    hint: '使用该特性保存的结果替换本次 d20',
    classes: 'border-sky-300/35 bg-sky-500/10 text-sky-100',
  }
}

export default function D20RollConfirmationOverlay({
  interrupt,
  isDM,
  playerCharacter,
  busy = false,
  onContribute,
  onContinue,
}: D20RollConfirmationOverlayProps) {
  const eligibleModifiers = useMemo(() => Array.isArray(interrupt.payload.eligibleModifiers)
    ? interrupt.payload.eligibleModifiers : [], [interrupt.payload.eligibleModifiers])
  const ownEligibleFeatures = playerCharacter
    ? eligibleModifiers.filter((entry) => entry.characterId === playerCharacter.id) : []
  const ownContribution = playerCharacter
    ? interrupt.contributions?.find((entry) => entry.characterId === playerCharacter.id) : undefined
  const [selectedFeatureId, setSelectedFeatureId] = useState(ownEligibleFeatures[0]?.featureId ?? '')
  const [replacementValue, setReplacementValue] = useState('')
  const [dmOverrideValue, setDmOverrideValue] = useState(String(interrupt.payload.originalValue))
  const [submitting, setSubmitting] = useState(false)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [timedOutInterruptId, setTimedOutInterruptId] = useState('')
  const timeoutHandledRef = useRef('')
  const selectedFeature = ownEligibleFeatures.find((entry) => entry.featureId === selectedFeatureId) ?? ownEligibleFeatures[0]
  const rollOptions = ownContribution?.kind === 'choice-reroll' &&
    interrupt.payload.rollOptions?.contributionId === ownContribution.id
    ? interrupt.payload.rollOptions.values : undefined
  const requiresResultChoice = (selectedFeature?.selectionPolicy ?? 'owner-chooses') === 'owner-chooses' && !!rollOptions
  const isSecretDmRoll = interrupt.payload.visibility === 'dm-only' && interrupt.payload.allowDmOverride === true
  const deadline = !isSecretDmRoll ? interrupt.expiresAt ?? interrupt.createdAt + 10_000 : undefined
  const remainingMs = deadline == null ? 0 : Math.max(0, deadline - clockNow)
  const countdownPercent = deadline == null ? 0 : Math.max(0, Math.min(100,
    remainingMs / Math.max(1, deadline - interrupt.createdAt) * 100))
  const parsedOverride = Number(dmOverrideValue)
  const overrideValid = Number.isInteger(parsedOverride) && parsedOverride >= 1 && parsedOverride <= 20

  useEffect(() => {
    if (deadline == null) return
    const updateClock = window.setInterval(() => setClockNow(Date.now()), 100)
    const timeout = window.setTimeout(() => {
      const timeoutKey = `${interrupt.id}:${deadline}`
      if (timeoutHandledRef.current === timeoutKey) return
      timeoutHandledRef.current = timeoutKey
      setTimedOutInterruptId(interrupt.id)
      const result = isDM
        ? onContinue()
        : playerCharacter && ownEligibleFeatures.length > 0
          ? onContribute({ featureId: '', featureLabel: '', decline: true })
          : undefined
      if (result) void Promise.resolve(result).catch(() => undefined)
    }, Math.max(0, deadline - Date.now()))
    return () => { window.clearInterval(updateClock); window.clearTimeout(timeout) }
  }, [deadline, interrupt.id, isDM, onContinue, onContribute, ownEligibleFeatures.length, playerCharacter])

  // Public adjustments belong to the owning player. The DM Host settles them
  // automatically in the background and never receives a second review dialog.
  if (timedOutInterruptId === interrupt.id || (isDM && !isSecretDmRoll) ||
    (!isDM && (!playerCharacter || ownEligibleFeatures.length < 1))) return null

  const submit = async (decline = false, selectedIndex?: number) => {
    if (!selectedFeature && !decline) return
    const parsedReplacement = Number(replacementValue)
    if (!decline && selectedFeature?.modifierKind !== 'adjust-d20' &&
      selectedFeature?.modifierKind !== 'choice-reroll' &&
      (!Number.isInteger(parsedReplacement) || parsedReplacement < 1 || parsedReplacement > 20)) return
    setSubmitting(true)
    try {
      await onContribute({
        featureId: selectedFeature?.featureId ?? '',
        featureLabel: selectedFeature?.featureLabel ?? '',
        ...(decline ? { decline: true } : selectedFeature?.modifierKind === 'choice-reroll'
          ? { choiceDecision: 'use' as const }
          : selectedFeature?.modifierKind === 'adjust-d20'
            ? { direction: selectedFeature.direction }
            : { replacementValue: parsedReplacement }),
        ...(selectedIndex != null ? { selectedIndex } : {}),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-[120] flex w-[min(23rem,calc(100vw-1rem))] items-center p-3">
      <section
        className="pointer-events-auto max-h-[min(38rem,calc(100vh-1.5rem))] w-full overflow-y-auto rounded-2xl border border-violet-300/30 bg-void-950/96 shadow-[0_22px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        data-testid="d20-roll-confirmation"
        data-layout="left-drawer"
        role="dialog"
        aria-label={isSecretDmRoll ? 'DM 暗骰确认' : 'd20 结果调整'}
      >
        <header className="border-b border-white/10 bg-gradient-to-r from-violet-500/20 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
              {isSecretDmRoll ? <EyeOff className="h-5 w-5" /> : <Dices className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                {isSecretDmRoll ? 'DM 暗骰' : '投骰修正'}
              </p>
              <h2 className="mt-0.5 truncate text-base font-bold text-slate-50">{interrupt.payload.label}</h2>
              {interrupt.payload.targetName && <p className="truncate text-xs text-slate-400">目标：{interrupt.payload.targetName}</p>}
            </div>
            <div className="rounded-xl border border-violet-300/20 bg-black/25 px-3 py-1.5 text-center">
              <p className="text-[9px] text-slate-500">原始 d20</p>
              <p className="text-2xl font-black tabular-nums text-violet-100">{interrupt.payload.originalValue}</p>
            </div>
          </div>
        </header>

        {!isSecretDmRoll && deadline != null && (
          <div className="border-b border-white/8 px-4 py-2" data-testid="d20-countdown">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>未选择将自动跳过</span>
              <span className="font-bold tabular-nums text-violet-200">{Math.ceil(remainingMs / 1000)} 秒</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/8">
              <div data-testid="d20-countdown-bar" className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-300 transition-[width] duration-100 ease-linear"
                style={{ width: `${countdownPercent}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-3 p-4">
          {isSecretDmRoll ? (
            <>
              <p className="flex gap-2 rounded-lg border border-fuchsia-300/15 bg-fuchsia-500/8 p-2 text-xs text-fuchsia-100/80">
                <Clock3 className="h-4 w-4 shrink-0" />暗骰只在 DM 端显示；确认后直接写入权威账本。
              </p>
              <input data-testid="d20-dm-override" type="number" min={1} max={20}
                value={dmOverrideValue} onChange={(event) => setDmOverrideValue(event.target.value)}
                className="w-full rounded-xl border border-fuchsia-400/25 bg-black/25 px-4 py-3 text-center text-2xl font-black text-fuchsia-100 outline-none focus:border-fuchsia-300/60" />
              <button type="button" disabled={busy || !overrideValid}
                onClick={() => void onContinue(undefined, parsedOverride)} data-testid="d20-roll-continue"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 font-bold text-white disabled:opacity-45">
                <CheckCircle2 className="h-4 w-4" />{busy ? '正在提交…' : '确认并继续'}
              </button>
            </>
          ) : (
            <>
              {ownContribution && (
                <p className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2 text-xs text-emerald-100" data-testid="d20-player-decision-sent">
                  {ownContribution.kind === 'decline-d20' ? '已选择不更改点数，Host 正在继续结算。' : requiresResultChoice ? 'Host 已完成额外投骰，请选择最终采用的结果。' : `已选择「${ownContribution.featureLabel}」，Host 正在自动结算。`}
                </p>
              )}
              {requiresResultChoice && rollOptions && (
                <div className="grid grid-cols-3 gap-2" data-testid="d20-result-options">
                  {rollOptions.map((value, index) => (
                    <button key={`${index}:${value}`} type="button" onClick={() => void submit(false, index)}
                      data-testid={`d20-result-option-${index}`}
                      className="rounded-xl border border-violet-300/25 bg-violet-500/12 px-2 py-3 text-center hover:bg-violet-500/25">
                      <span className="block text-[10px] text-slate-400">{index === 0 ? '原始结果' : `新骰 ${index}`}</span>
                      <span className="text-2xl font-black tabular-nums text-violet-100">{value}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1.5" data-testid="d20-feature-options" role="radiogroup" aria-label="可用投骰特性">
                <span className="text-xs text-slate-400">选择要使用的特性</span>
                {ownEligibleFeatures.map((feature) => {
                  const presentation = featurePresentation(feature)
                  const selected = selectedFeature?.featureId === feature.featureId
                  return <button key={feature.featureId} type="button" role="radio" aria-checked={selected}
                    disabled={requiresResultChoice} onClick={() => setSelectedFeatureId(feature.featureId)}
                    data-testid={`d20-feature-option-${feature.featureId}`}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${presentation.classes} ${selected ? 'ring-2 ring-white/25' : 'opacity-75 hover:opacity-100'}`}>
                    <span className="min-w-0"><strong className="block truncate text-sm">{feature.featureLabel}</strong>
                      <span className="block truncate text-[10px] opacity-70">{presentation.hint}</span></span>
                    <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[9px] font-bold">{presentation.kind}</span>
                  </button>
                })}
              </div>
              {selectedFeature?.modifierKind !== 'adjust-d20' && selectedFeature?.modifierKind !== 'choice-reroll' && (
                <label className="block space-y-1"><span className="text-xs text-slate-400">替换点数</span>
                  <input type="number" min={1} max={20} value={replacementValue}
                    onChange={(event) => setReplacementValue(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/60" />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={submitting || requiresResultChoice} onClick={() => void submit(true)} data-testid="d20-roll-decline"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-40">
                  不使用
                </button>
                <button type="button" disabled={submitting || !selectedFeature || requiresResultChoice} onClick={() => void submit()} data-testid="d20-roll-contribute"
                  className="rounded-xl border border-violet-400/30 bg-violet-500/18 px-3 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/28 disabled:opacity-40">
                  {submitting ? '提交中…' : `使用${selectedFeature?.featureLabel ?? '特性'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
