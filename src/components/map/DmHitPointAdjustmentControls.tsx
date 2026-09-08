import { useState } from 'react'
import { Minus, Plus, ShieldMinus, ShieldPlus } from 'lucide-react'
import type { ManualSettlementOperation } from '../../lib/combatSettlementMode'

interface Props {
  temporaryHp: number
  onAdjust: (operation: ManualSettlementOperation, amount: number) => void | Promise<unknown>
}

/** Compact DM-only HP authority controls shared by character and monster details. */
export default function DmHitPointAdjustmentControls({ temporaryHp, onAdjust }: Props) {
  const [amount, setAmount] = useState(1)
  const adjust = (operation: ManualSettlementOperation) => {
    const result = onAdjust(operation, amount)
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).catch(() => undefined)
    }
  }

  return (
    <div
      data-testid="dm-hit-point-adjustment-controls"
      className="mt-2 rounded-lg border border-white/[0.07] bg-black/15 p-2"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="减少临时生命调整数值"
          onClick={() => setAmount((value) => Math.max(0, value - 1))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:bg-white/8"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={0}
          max={1_000_000}
          aria-label="临时生命调整数值"
          value={amount}
          onChange={(event) => setAmount(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-void-950/70 px-2 py-1.5 text-center text-xs font-bold tabular-nums text-slate-100 outline-none focus:border-arcane-500"
        />
        <button
          type="button"
          aria-label="增加临时生命调整数值"
          onClick={() => setAmount((value) => value + 1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:bg-white/8"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="ml-1 shrink-0 rounded bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-200">
          临时 {Math.max(0, Math.floor(temporaryHp))}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          data-testid="dm-apply-damage"
          disabled={amount <= 0}
          onClick={() => adjust('damage')}
          className="rounded-md bg-rose-500/15 px-2 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="mr-1 inline h-3 w-3" />结算伤害
        </button>
        <button
          type="button"
          data-testid="dm-apply-healing"
          disabled={amount <= 0}
          onClick={() => adjust('healing')}
          className="rounded-md bg-emerald-500/15 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="mr-1 inline h-3 w-3" />结算治疗
        </button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          data-testid="dm-temp-hp-decrease"
          disabled={amount <= 0 || temporaryHp <= 0}
          onClick={() => adjust('decrease-temporary-hit-points')}
          className="rounded-md bg-slate-500/15 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShieldMinus className="mr-1 inline h-3 w-3" />减少临时 HP
        </button>
        <button
          type="button"
          data-testid="dm-temp-hp-increase"
          disabled={amount <= 0}
          onClick={() => adjust('increase-temporary-hit-points')}
          className="rounded-md bg-sky-500/15 px-2 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShieldPlus className="mr-1 inline h-3 w-3" />增加临时 HP
        </button>
      </div>
    </div>
  )
}
