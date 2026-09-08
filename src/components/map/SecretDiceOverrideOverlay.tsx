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
      className="pointer-events-none fixed inset-y-0 left-0 z-[121] flex w-[min(23rem,calc(100vw-1rem))] items-center p-3"
      data-layout="left-drawer"
      role="dialog"
      aria-label="DM 暗骰确认"
      data-testid="secret-dice-override"
    >
      <section className="pointer-events-auto max-h-[min(38rem,calc(100vh-1.5rem))] w-full overflow-y-auto rounded-2xl border border-violet-300/30 bg-void-950/96 shadow-[0_22px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <header className="flex items-start gap-3 border-b border-white/10 bg-gradient-to-r from-violet-500/20 to-transparent p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
            <EyeOff className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">暗骰待 DM 确认</p>
            <h2 className="mt-0.5 truncate text-base font-bold text-slate-50">{label}</h2>
            {targetName ? <p className="truncate text-xs text-slate-400">目标：{targetName}</p> : null}
          </div>
          <span className="ml-auto rounded-xl border border-violet-300/20 bg-black/25 px-3 py-1.5 text-sm font-black text-violet-100">
            {values.length}d{sides}
          </span>
        </header>

        <div className="space-y-3 p-4">
          <p className="text-xs leading-5 text-slate-400">
            这些骰面不会发送到玩家端。DM 可以修正任意一枚骰子，确认后的值将交给 Headless 继续结算。
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {draft.map((value, index) => (
              <label key={index} className="min-w-0 text-center text-[10px] font-semibold text-slate-500">
                第 {index + 1} 枚
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={`第 ${index + 1} 枚 d${sides} 骰面`}
                  value={value}
                  onChange={(event) => setDraft((current) => current.map(
                    (item, itemIndex) => itemIndex === index ? event.target.value : item,
                  ))}
                  className="mt-1 min-w-0 w-full rounded-xl border border-fuchsia-400/25 bg-black/25 px-1 py-2 text-center text-lg font-black tabular-nums text-fuchsia-100 outline-none focus:border-fuchsia-300/60"
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
      </section>
    </div>
  )
}
