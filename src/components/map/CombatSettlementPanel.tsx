import { useState } from 'react'
import { Dices, Eye, EyeOff, HeartPulse, Minus, Plus, ShieldPlus } from 'lucide-react'
import type { CombatSettlementMode, ManualSettlementOperation } from '../../lib/combatSettlementMode'

export interface ManualSettlementTarget {
  id: string
  label: string
  type: 'player' | 'enemy' | 'npc'
  currentHp: number
  maxHp: number
  temporaryHp: number
  supportsTemporaryHp: boolean
}

interface Props {
  mode: CombatSettlementMode
  isDM: boolean
  rollerName: string
  targets: readonly ManualSettlementTarget[]
  currentTurnTokenId?: string
  onRoll(input: {
    count: number
    sides: number
    bonus: number
    label: string
    visibility: 'public' | 'dm'
  }): Promise<void>
  onSettle?(targetId: string, operation: ManualSettlementOperation, amount: number): void
}

export default function CombatSettlementPanel({
  mode,
  isDM,
  rollerName,
  targets,
  currentTurnTokenId,
  onRoll,
  onSettle,
}: Props) {
  const [open, setOpen] = useState(true)
  const [count, setCount] = useState(1)
  const [sides, setSides] = useState(20)
  const [bonus, setBonus] = useState(0)
  const [label, setLabel] = useState('手动检定')
  const [visibility, setVisibility] = useState<'public' | 'dm'>('public')
  const [rolling, setRolling] = useState(false)
  const [targetId, setTargetId] = useState(currentTurnTokenId ?? targets[0]?.id ?? '')
  const [amount, setAmount] = useState(1)
  const target = targets.find((item) => item.id === targetId) ?? targets.find((item) => item.id === currentTurnTokenId) ?? targets[0]

  const roll = async () => {
    if (rolling) return
    setRolling(true)
    try {
      await onRoll({ count, sides, bonus, label: label.trim() || '手动投骰', visibility: isDM ? visibility : 'public' })
    } finally {
      setRolling(false)
    }
  }

  const settle = (operation: ManualSettlementOperation) => {
    if (!target || !onSettle) return
    onSettle(target.id, operation, amount)
  }

  return (
    <div data-testid="combat-settlement-panel" className="absolute right-3 top-16 z-40 w-[min(25rem,calc(100vw-1.5rem))] rounded-2xl border border-violet-400/20 bg-void-950/92 shadow-2xl backdrop-blur-md">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Dices className="h-4 w-4 text-violet-300" />
        <span className="text-sm font-bold text-slate-100">{mode === 'manual' ? '手动结算台' : '怪物手动操作台'}</span>
        <span className="ml-auto text-xs text-slate-500">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/8 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-300">{rollerName} 的骰盘</p>{isDM && <button type="button" data-testid="manual-roll-visibility" aria-label="切换明骰暗骰" onClick={() => setVisibility((value) => value === 'public' ? 'dm' : 'public')} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${visibility === 'public' ? 'bg-emerald-500/12 text-emerald-200' : 'bg-fuchsia-500/12 text-fuchsia-200'}`}>{visibility === 'public' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{visibility === 'public' ? '明骰' : '暗骰'}</button>}</div>
            <div className="grid grid-cols-[70px_90px_70px_1fr] gap-2">
              <label><span className="sr-only">骰子数量</span><input aria-label="骰子数量" type="number" min={1} max={12} value={count} onChange={(event) => setCount(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} className="w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" /></label>
              <label><span className="sr-only">骰子类型</span><select aria-label="骰子类型" value={sides} onChange={(event) => setSides(Number(event.target.value))} className="w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100">{[4, 6, 8, 10, 12, 20, 100].map((value) => <option key={value} value={value}>d{value}</option>)}</select></label>
              <label><span className="sr-only">投骰加值</span><input aria-label="投骰加值" type="number" min={-100} max={100} value={bonus} onChange={(event) => setBonus(Math.min(100, Math.max(-100, Number(event.target.value) || 0)))} className="w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" /></label>
              <label><span className="sr-only">投骰名称</span><input aria-label="投骰名称" value={label} onChange={(event) => setLabel(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-sm text-slate-100" /></label>
            </div>
            <button type="button" data-testid="manual-roll-submit" disabled={rolling} onClick={() => void roll()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-100 disabled:opacity-50"><Dices className="h-4 w-4" />{rolling ? '投骰中…' : `投掷 ${count}d${sides}${bonus === 0 ? '' : bonus > 0 ? `+${bonus}` : bonus}`}</button>
          </div>

          {isDM && onSettle && (
            <div className="border-t border-white/8 pt-4">
              <p className="mb-2 text-xs font-semibold text-slate-300">DM 手动应用结果</p>
              <select aria-label="手动结算目标" value={target?.id ?? ''} onChange={(event) => setTargetId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-100">{targets.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.currentHp}/{item.maxHp}{item.temporaryHp > 0 ? ` +${item.temporaryHp}临时` : ''}</option>)}</select>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" aria-label="减少结算数值" onClick={() => setAmount((value) => Math.max(0, value - 1))} className="h-9 w-9 rounded-lg border border-white/10 text-slate-300"><Minus className="mx-auto h-4 w-4" /></button>
                <input aria-label="手动结算数值" type="number" min={0} max={1000000} value={amount} onChange={(event) => setAmount(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-center text-sm font-bold text-slate-100" />
                <button type="button" aria-label="增加结算数值" onClick={() => setAmount((value) => value + 1)} className="h-9 w-9 rounded-lg border border-white/10 text-slate-300"><Plus className="mx-auto h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button type="button" data-testid="manual-settle-damage" disabled={!target} onClick={() => settle('damage')} className="rounded-lg bg-rose-500/15 px-2 py-2 text-xs font-semibold text-rose-200 disabled:opacity-40"><Minus className="mr-1 inline h-3.5 w-3.5" />伤害</button>
                <button type="button" data-testid="manual-settle-healing" disabled={!target} onClick={() => settle('healing')} className="rounded-lg bg-emerald-500/15 px-2 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40"><HeartPulse className="mr-1 inline h-3.5 w-3.5" />治疗</button>
                <button type="button" data-testid="manual-settle-temp-hp" disabled={!target?.supportsTemporaryHp} onClick={() => settle('temporary-hit-points')} className="rounded-lg bg-sky-500/15 px-2 py-2 text-xs font-semibold text-sky-200 disabled:opacity-40"><ShieldPlus className="mr-1 inline h-3.5 w-3.5" />临时 HP</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
