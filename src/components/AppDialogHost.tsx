import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  HelpCircle,
  Info,
  Minus,
  MoveVertical,
  Plus,
  Search,
  SlidersHorizontal,
  SquareMousePointer,
  TextCursorInput,
  X,
} from 'lucide-react'
import {
  filterAppActionChoices,
  getAppDialogSnapshot,
  settleAppDialog,
  subscribeToAppDialogs,
} from '../lib/appDialog'

export default function AppDialogHost() {
  const { active, queuedCount } = useSyncExternalStore(
    subscribeToAppDialogs,
    getAppDialogSnapshot,
    getAppDialogSnapshot,
  )

  if (!active) return null
  return <AppDialogContent key={active.id} active={active} queuedCount={queuedCount} />
}

interface AppDialogContentProps {
  active: NonNullable<ReturnType<typeof getAppDialogSnapshot>['active']>
  queuedCount: number
}

function AppDialogContent({ active, queuedCount }: AppDialogContentProps) {
  const [draft, setDraft] = useState(() => active.defaultValue ?? '')
  const [stepDirection, setStepDirection] = useState(() => active.stepperDefaultDirection ?? 'up')
  const [stepValue, setStepValue] = useState(() => active.stepperDefaultValue ?? 0)
  const [choiceGroupValues, setChoiceGroupValues] = useState<Record<string, string>>(
    () => ({ ...active.choiceGroupDefaultValues }),
  )
  const [actionChoiceQuery, setActionChoiceQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const actionChoiceSearchRef = useRef<HTMLInputElement>(null)
  const primaryButtonRef = useRef<HTMLButtonElement>(null)
  const firstActionChoiceRef = useRef<HTMLButtonElement>(null)
  const filteredActionChoices = filterAppActionChoices(active.actionChoices, actionChoiceQuery)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const frame = window.requestAnimationFrame(() => {
      if (active.kind === 'prompt') {
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (active.kind === 'action-choice') {
        if (active.actionChoiceSearchable) actionChoiceSearchRef.current?.focus()
        else firstActionChoiceRef.current?.focus()
      } else {
        primaryButtonRef.current?.focus()
      }
    })
    return () => {
      window.cancelAnimationFrame(frame)
      previouslyFocused?.focus()
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])

  const dismiss = () => {
    settleAppDialog(
      active.id,
      active.kind === 'prompt' ||
      active.kind === 'direction-stepper' ||
      active.kind === 'choice-groups' ||
      active.kind === 'action-choice'
        ? null
        : false,
    )
  }
  const accept = () => {
    settleAppDialog(
      active.id,
      active.kind === 'prompt'
        ? draft
        : active.kind === 'direction-stepper'
          ? { direction: stepDirection, value: stepValue }
          : active.kind === 'choice-groups'
            ? { values: choiceGroupValues }
          : true,
    )
  }
  const danger = active.tone === 'danger'
  const Icon = danger
    ? AlertTriangle
    : active.kind === 'alert'
      ? Info
      : active.kind === 'prompt'
        ? TextCursorInput
        : active.kind === 'direction-stepper'
          ? MoveVertical
          : active.kind === 'choice-groups'
            ? SlidersHorizontal
            : active.kind === 'action-choice'
              ? SquareMousePointer
            : HelpCircle

  return (
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`app-dialog-title-${active.id}`}
      aria-describedby={`app-dialog-message-${active.id}`}
      data-testid="app-dialog"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          if (active.kind === 'alert') accept()
          else dismiss()
        } else if (
          event.key === 'Enter' &&
          (
            active.kind === 'prompt' ||
            active.kind === 'direction-stepper' ||
            active.kind === 'choice-groups'
          )
        ) {
          event.preventDefault()
          accept()
        }
      }}
    >
      <section
        className={`flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border bg-void-950 shadow-[0_30px_120px_rgba(0,0,0,0.78)] ${
          danger ? 'border-rose-300/30' : 'border-violet-300/25'
        }`}
      >
        <header className={`flex shrink-0 items-start gap-4 border-b border-white/10 bg-gradient-to-r px-6 py-5 ${
          danger
            ? 'from-rose-500/20 via-red-500/10 to-transparent'
            : 'from-violet-500/20 via-indigo-500/10 to-transparent'
        }`}>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            danger ? 'bg-rose-500/20 text-rose-100' : 'bg-violet-500/20 text-violet-100'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
              danger ? 'text-rose-300' : 'text-violet-300'
            }`}>
              Astral Trace
            </p>
            <h2 id={`app-dialog-title-${active.id}`} className="mt-1 text-xl font-bold text-slate-50">
              {active.title}
            </h2>
          </div>
          {active.kind !== 'alert' ? (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 overflow-y-auto px-6 py-5" data-testid="app-dialog-message-scroll">
            <p
              id={`app-dialog-message-${active.id}`}
              className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300"
            >
              {active.message}
            </p>
          </div>

          <div className="shrink-0 space-y-5 border-t border-white/10 px-6 py-5" data-testid="app-dialog-actions">
            {active.kind === 'prompt' ? (
              <input
                ref={inputRef}
                value={draft}
                placeholder={active.placeholder}
                onChange={(event) => setDraft(event.target.value)}
                className="w-full rounded-xl border border-violet-300/25 bg-black/30 px-4 py-3 text-sm text-slate-50 outline-none transition placeholder:text-slate-600 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-500/20"
                data-testid="app-dialog-input"
              />
            ) : null}

            {active.kind === 'direction-stepper' ? (
              <div className="space-y-4" data-testid="app-dialog-direction-stepper">
                <div className="grid grid-cols-2 gap-3" role="group" aria-label="移动方向">
                  <button
                    type="button"
                    onClick={() => setStepDirection('up')}
                    aria-pressed={stepDirection === 'up'}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      stepDirection === 'up'
                        ? 'border-sky-300/70 bg-sky-500/20 text-sky-100 ring-2 ring-sky-500/20'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
                    }`}
                    data-testid="app-dialog-direction-up"
                  >
                    <ArrowUp className="h-4 w-4" />
                    {active.stepperUpLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepDirection('down')}
                    aria-pressed={stepDirection === 'down'}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      stepDirection === 'down'
                        ? 'border-sky-300/70 bg-sky-500/20 text-sky-100 ring-2 ring-sky-500/20'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
                    }`}
                    data-testid="app-dialog-direction-down"
                  >
                    <ArrowDown className="h-4 w-4" />
                    {active.stepperDownLabel}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <button
                    type="button"
                    onClick={() => setStepValue((value) => Math.max(
                      active.stepperMinValue ?? 0,
                      value - (active.stepperStep ?? 1),
                    ))}
                    disabled={stepValue <= (active.stepperMinValue ?? 0)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-100 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`减少 ${active.stepperStep ?? 1}${active.stepperUnit ?? ''}`}
                    data-testid="app-dialog-stepper-decrease"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <output
                    className="min-w-0 flex-1 text-center text-2xl font-black tabular-nums text-white"
                    aria-live="polite"
                    data-testid="app-dialog-stepper-value"
                  >
                    {stepValue}{active.stepperUnit ? ` ${active.stepperUnit}` : ''}
                  </output>
                  <button
                    type="button"
                    onClick={() => setStepValue((value) => Math.min(
                      active.stepperMaxValue ?? value,
                      value + (active.stepperStep ?? 1),
                    ))}
                    disabled={stepValue >= (active.stepperMaxValue ?? stepValue)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-100 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`增加 ${active.stepperStep ?? 1}${active.stepperUnit ?? ''}`}
                    data-testid="app-dialog-stepper-increase"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : null}

            {active.kind === 'choice-groups' ? (
              <div className="space-y-5" data-testid="app-dialog-choice-groups">
                {active.choiceGroups?.map((group) => (
                  <fieldset key={group.id} className="space-y-2.5">
                    <legend className="text-xs font-bold tracking-wide text-slate-300">
                      {group.label}
                    </legend>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {group.options.map((option) => {
                        const selected = choiceGroupValues[group.id] === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setChoiceGroupValues((values) => ({
                              ...values,
                              [group.id]: option.id,
                            }))}
                            aria-pressed={selected}
                            className={`min-h-12 rounded-xl border px-3 py-2.5 text-left transition ${
                              selected
                                ? 'border-sky-300/70 bg-sky-500/20 text-sky-50 ring-2 ring-sky-500/20'
                                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
                            }`}
                            data-testid={`app-dialog-choice-${group.id}-${option.id}`}
                          >
                            <span className="block text-sm font-bold">{option.label}</span>
                            {option.description ? (
                              <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                                {option.description}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : null}

            {active.kind === 'action-choice' ? (
              <div className="space-y-3" data-testid="app-dialog-action-choices">
                {active.actionChoiceSearchable ? (
                  <label className="relative block">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      ref={actionChoiceSearchRef}
                      type="search"
                      value={actionChoiceQuery}
                      onChange={(event) => setActionChoiceQuery(event.target.value)}
                      placeholder={active.actionChoiceSearchPlaceholder ?? '搜索选项'}
                      aria-label={active.actionChoiceSearchPlaceholder ?? '搜索选项'}
                      className="w-full rounded-xl border border-violet-300/25 bg-black/30 py-3 pl-10 pr-4 text-sm text-slate-50 outline-none transition placeholder:text-slate-600 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-500/20"
                      data-testid="app-dialog-action-search"
                    />
                  </label>
                ) : null}
                <div
                  className={`grid max-h-[48dvh] gap-2.5 overflow-y-auto overscroll-contain pr-1 ${
                    active.actionChoiceLayout === 'list' ? 'grid-cols-1' : 'sm:grid-cols-2'
                  }`}
                  data-testid="app-dialog-action-list"
                >
                  {filteredActionChoices.map((option, index) => {
                    const toneClass = {
                      violet: 'border-violet-300/25 bg-violet-500/15 text-violet-100 hover:border-violet-300/50 hover:bg-violet-500/25',
                      emerald: 'border-emerald-300/25 bg-emerald-500/15 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-500/25',
                      sky: 'border-sky-300/25 bg-sky-500/15 text-sky-100 hover:border-sky-300/50 hover:bg-sky-500/25',
                      rose: 'border-rose-300/25 bg-rose-500/15 text-rose-100 hover:border-rose-300/50 hover:bg-rose-500/25',
                    }[option.tone ?? 'violet']
                    return (
                      <button
                        key={option.id}
                        ref={index === 0 ? firstActionChoiceRef : undefined}
                        type="button"
                        onClick={() => settleAppDialog(active.id, option.id)}
                        className={`min-h-14 rounded-xl border px-4 py-3 text-left transition ${toneClass}`}
                        data-testid={`app-dialog-action-${option.id}`}
                      >
                        <span className="block text-sm font-bold">{option.label}</span>
                        {option.description ? (
                          <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                            {option.description}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                  {filteredActionChoices.length < 1 ? (
                    <p
                      className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500"
                      data-testid="app-dialog-action-empty"
                    >
                      没有匹配的选项
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              {active.kind !== 'alert' ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  data-testid="app-dialog-cancel"
                >
                  {active.cancelLabel}
                </button>
              ) : null}
              {active.kind !== 'action-choice' ? (
                <button
                  ref={primaryButtonRef}
                  type="button"
                  onClick={accept}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition ${
                    danger
                      ? 'bg-rose-500 hover:bg-rose-400'
                      : 'bg-violet-500 hover:bg-violet-400'
                  }`}
                  data-testid="app-dialog-confirm"
                >
                  {active.confirmLabel}
                </button>
              ) : null}
            </div>

            {queuedCount > 0 ? (
              <p className="text-right text-[10px] text-slate-600">后续还有 {queuedCount} 条提示</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
