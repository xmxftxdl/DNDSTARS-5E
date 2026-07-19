import { useState } from 'react'
import { Heart, Shield, Plus, Minus } from 'lucide-react'

interface HpPanelProps {
  current: number
  max: number
  temp: number
  editable: boolean
  maxEditable?: boolean
  onChange: (patch: { currentHp?: number; maxHp?: number; tempHp?: number }) => void
}

export default function HpPanel({ current, max, temp, editable, maxEditable = editable, onChange }: HpPanelProps) {
  const [amount, setAmount] = useState(1)
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const barColor =
    pct > 50 ? 'from-emerald-500 to-emerald-400' : pct > 25 ? 'from-amber-500 to-amber-400' : 'from-rose-600 to-rose-500'

  const clamp = (v: number) => Math.max(0, Math.min(max + temp, v))

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-rose-300">
          <Heart className="h-5 w-5" />
          <span className="text-sm font-semibold">生命值</span>
        </div>
        {temp > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300">
            <Shield className="h-3 w-3" />+{temp} 临时
          </span>
        )}
      </div>

      <div className="flex items-end gap-1">
        {editable ? (
          <input
            type="number"
            value={current}
            onChange={(e) => onChange({ currentHp: clamp(Number(e.target.value) || 0) })}
            className="w-20 rounded-lg border border-white/10 bg-void-900/60 px-2 py-1 text-2xl font-bold text-slate-100 outline-none focus:border-rose-500"
          />
        ) : (
          <span className="text-3xl font-bold text-slate-100">{current}</span>
        )}
        <span className="pb-1 text-lg text-slate-500">/ {max}</span>
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-void-900/80">
        <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onChange({ currentHp: clamp(current - amount) })}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300 transition-colors hover:bg-rose-500/25"
          title="受伤"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          className="w-16 rounded-lg border border-white/10 bg-void-900/60 py-1.5 text-center text-sm font-semibold text-slate-200 outline-none focus:border-arcane-500"
        />
        <button
          onClick={() => onChange({ currentHp: clamp(current + amount) })}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 transition-colors hover:bg-emerald-500/25"
          title="治疗"
        >
          <Plus className="h-4 w-4" />
        </button>

        {maxEditable && (
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <span>生命上限</span>
            <input
              type="number"
              value={max}
              onChange={(e) => onChange({ maxHp: Math.max(1, Number(e.target.value) || 1) })}
              className="w-14 rounded-lg border border-white/10 bg-void-900/60 px-1 py-1 text-center text-sm font-semibold text-slate-200 outline-none focus:border-arcane-500"
            />
          </div>
        )}
      </div>
    </div>
  )
}
