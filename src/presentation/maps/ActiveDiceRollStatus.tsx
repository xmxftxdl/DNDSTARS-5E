import type { ActiveDiceRollStatusView } from './diceRollStatusModel'

export default function ActiveDiceRollStatus({
  status,
}: {
  status: ActiveDiceRollStatusView
}) {
  return (
    <div
      data-testid="active-dice-roll-status"
      data-roll-id={status.id}
      className="pointer-events-none flex max-w-[min(42rem,calc(100vw-2rem))] items-center gap-2 rounded-xl border border-sky-300/35 bg-void-950/90 px-3 py-2 text-xs text-slate-200 shadow-2xl backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-300" />
      </span>
      <span className="shrink-0 font-semibold text-sky-200">正在投掷</span>
      <span className="shrink-0 rounded-md bg-sky-400/15 px-1.5 py-0.5 font-mono font-bold text-sky-100">
        {status.formula}
      </span>
      <span className="min-w-0 truncate font-semibold text-white">{status.label}</span>
      {status.targetName && (
        <span className="min-w-0 truncate text-slate-400">→ {status.targetName}</span>
      )}
    </div>
  )
}
