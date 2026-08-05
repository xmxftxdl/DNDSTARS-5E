import type { CombatDialogState } from './useCombatDialog'

export default function CombatDialogOverlay({
  dialog,
  onClose,
}: {
  dialog: CombatDialogState | null
  onClose: (accepted: boolean) => void
}) {
  if (!dialog) return null
  const border = dialog.tone === 'violet'
    ? 'border-violet-400/35'
    : dialog.tone === 'amber'
      ? 'border-amber-400/35'
      : dialog.tone === 'rose'
        ? 'border-rose-400/35'
        : 'border-sky-400/35'
  const heading = dialog.tone === 'violet'
    ? 'text-violet-100'
    : dialog.tone === 'amber'
      ? 'text-amber-100'
      : dialog.tone === 'rose'
        ? 'text-rose-100'
        : 'text-sky-100'
  const confirm = dialog.tone === 'violet'
    ? 'bg-violet-500/25 text-violet-100 hover:bg-violet-500/35'
    : dialog.tone === 'amber'
      ? 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/35'
      : dialog.tone === 'rose'
        ? 'bg-rose-500/25 text-rose-100 hover:bg-rose-500/35'
        : 'bg-sky-500/25 text-sky-100 hover:bg-sky-500/35'
  return (
    <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="combat-dialog-title"
        className={`mx-4 w-full max-w-md rounded-2xl border bg-void-950/95 p-5 shadow-2xl ${border}`}
      >
        <h3 id="combat-dialog-title" className={`text-lg font-semibold ${heading}`}>
          {dialog.title}
        </h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
          {dialog.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {dialog.cancelText && (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
            >
              {dialog.cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${confirm}`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
