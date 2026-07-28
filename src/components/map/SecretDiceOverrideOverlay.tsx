import { useMemo, useState } from 'react'
import { CheckCircle2, EyeOff } from 'lucide-react'

interface SecretDiceOverrideOverlayProps {
  label: string
  targetName: string
  sides: number
  values: readonly number[]
  onConfirm: (values: number[]) => void
}

export default function SecretDiceOverrideOverlay({
  label,
  targetName,
  sides,
  values,
  onConfirm,
}: SecretDiceOverrideOverlayProps) {
  const [draft, setDraft] = useState(() => values.map(String))

  const parsed = useMemo(
    () => draft.map((value) => Number(value)),
    [draft],
  )
  const valid = parsed.length === values.length && parsed.every(
    (value) => Number.isInteger(value) && value >= 1 && value <= sides,
  )

  return (
    <div
      className="fixed inset-0 z-[121] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="DM 暗骰确认"
      data-testid="secret-dice-override"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-fuchsia-300/25 bg-void-950 shadow-[0_28px_100px_rgba(0,0,0,0.72)]">
        <header className="flex items-start gap-4 border-b border-white/10 bg-gradient-to-r from-fuchsia-500/20 via-rose-500/10 to-transparent px-6 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-fuchsia-100">
            <EyeOff className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">暗骰待 DM 确认</p>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-50">{label}</h2>
            {targetName ? <p className="mt-1 text-sm text-slate-400">目标：{targetName}</p> : null}
          </div>
          <span className="ml-auto rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-black text-fuchsia-100">
            {values.length}d{sides}
          </span>
        </header>

        <div className="space-y-4 px-6 py-5">
          <p className="text-xs leading-5 text-slate-400">
            这些骰面不会发送到玩家端。DM 可以修正任意一枚骰子，确认后的值将交给 Headless 继续结算。
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {draft.map((value, index) => (
              <label key={index} className="text-center text-[10px] font-semibold text-slate-500">
                第 {index + 1} 枚
                <input
                  type="number"
                  min={1}
                  max={sides}
                  value={value}
                  onChange={(event) => setDraft((current) => current.map(
                    (item, itemIndex) => itemIndex === index ? event.target.value : item,
                  ))}
                  className="mt-1 w-full rounded-xl border border-fuchsia-400/25 bg-black/25 px-2 py-2 text-center text-lg font-black tabular-nums text-fuchsia-100 outline-none focus:border-fuchsia-300/60"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(parsed)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-3 font-bold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CheckCircle2 className="h-5 w-5" />
            采用暗骰并继续结算
          </button>
        </div>
      </div>
    </div>
  )
}
