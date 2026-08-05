import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, HelpCircle, Info, TextCursorInput, X } from 'lucide-react'
import {
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
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const frame = window.requestAnimationFrame(() => {
      if (active.kind === 'prompt') {
        inputRef.current?.focus()
        inputRef.current?.select()
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
    settleAppDialog(active.id, active.kind === 'prompt' ? null : false)
  }
  const accept = () => {
    settleAppDialog(active.id, active.kind === 'prompt' ? draft : true)
  }
  const danger = active.tone === 'danger'
  const Icon = danger
    ? AlertTriangle
    : active.kind === 'alert'
      ? Info
      : active.kind === 'prompt'
        ? TextCursorInput
        : HelpCircle

  return (
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
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
        } else if (event.key === 'Enter' && active.kind === 'prompt') {
          event.preventDefault()
          accept()
        }
      }}
    >
      <section
        className={`w-full max-w-md overflow-hidden rounded-3xl border bg-void-950 shadow-[0_30px_120px_rgba(0,0,0,0.78)] ${
          danger ? 'border-rose-300/30' : 'border-violet-300/25'
        }`}
      >
        <header className={`flex items-start gap-4 border-b border-white/10 bg-gradient-to-r px-6 py-5 ${
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

        <div className="space-y-5 px-6 py-5">
          <p
            id={`app-dialog-message-${active.id}`}
            className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300"
          >
            {active.message}
          </p>

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
          </div>

          {queuedCount > 0 ? (
            <p className="text-right text-[10px] text-slate-600">后续还有 {queuedCount} 条提示</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
