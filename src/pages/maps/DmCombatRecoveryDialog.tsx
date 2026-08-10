import { useEffect, useMemo, useState } from 'react'
import { Clock3, RefreshCw, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
import { showAppConfirm } from '../../lib/appDialog'
import type {
  DmCombatRecoveryResult,
  DmUndoTransactionSummary,
} from '../../ports/sharedRoomGateway'

const COMBAT_RESOURCES = new Set([
  'maps', 'characters', 'combat', 'combat-interrupts', 'combat-log',
  'combat-statistics', 'map-geometry', 'map-fog', 'map-exploration',
])

function combatTransactionLabel(transaction: DmUndoTransactionSummary): string {
  const round = transaction.combat?.afterRound ?? transaction.combat?.beforeRound
  return `${round ? `R${round} · ` : ''}${transaction.label || '战斗权威事务'}`
}

function isCombatRecoveryCandidate(
  transaction: DmUndoTransactionSummary,
  mapId: string,
  combatId: string,
): boolean {
  if (transaction.status !== 'applied') return false
  if (transaction.label === '更新 combat') return false
  if (!transaction.combatRecoverable && !transaction.resources.some((name) => COMBAT_RESOURCES.has(name))) {
    return false
  }
  if (transaction.combat?.mapId && transaction.combat.mapId !== mapId) return false
  if (transaction.combat?.combatId && transaction.combat.combatId !== combatId) return false
  return transaction.resources.includes('combat') || transaction.combat?.combatId === combatId
}

export interface DmCombatRecoveryDialogProps {
  open: boolean
  mapId: string
  combatId: string
  round: number
  currentActorLabel?: string
  onClose: () => void
  onRecovered: (result: DmCombatRecoveryResult) => void | Promise<void>
}

export default function DmCombatRecoveryDialog({
  open,
  mapId,
  combatId,
  round,
  currentActorLabel,
  onClose,
  onRecovered,
}: DmCombatRecoveryDialogProps) {
  const [history, setHistory] = useState<DmUndoTransactionSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState('')

  const candidates = useMemo(() => history.filter((transaction) =>
    isCombatRecoveryCandidate(transaction, mapId, combatId)), [combatId, history, mapId])
  const selected = candidates.find((transaction) => transaction.transactionId === selectedId)
  const affectedCount = selected
    ? candidates.filter((transaction) => transaction.createdAt >= selected.createdAt).length
    : 0

  useEffect(() => {
    if (!open) return
    let disposed = false
    queueMicrotask(() => {
      if (disposed) return
      setLoading(true)
      setError('')
      void browserSharedRoomService.loadDmUndoHistory().then((transactions) => {
        if (disposed) return
        setHistory(transactions)
        const first = transactions.find((transaction) =>
          isCombatRecoveryCandidate(transaction, mapId, combatId))
        setSelectedId(first?.transactionId ?? '')
      }).catch(() => {
        if (!disposed) setError('无法读取服务器战斗检查点，请检查房间连接。')
      }).finally(() => {
        if (!disposed) setLoading(false)
      })
    })
    return () => { disposed = true }
  }, [combatId, mapId, open])

  if (!open) return null

  const recover = async () => {
    if (!selected || recovering) return
    const confirmed = await showAppConfirm({
      title: '恢复完整战斗检查点',
      message: `将恢复到“${combatTransactionLabel(selected)}”执行前，并撤销其后 ${affectedCount} 个战斗事务。HP、法术位、坐标、行动资源、状态、专注和持续区域会一起恢复。该操作不会重放旧玩家请求。`,
      confirmLabel: '确认恢复',
      cancelLabel: '取消',
      tone: 'danger',
    })
    if (!confirmed) return
    setRecovering(true)
    setError('')
    try {
      const result = await browserSharedRoomService.recoverDmCombatToTransaction(selected.transactionId)
      // The server commit is already atomic and authoritative. Close the
      // blocking dialog immediately, then let the workspace reload its local
      // projections; a slow map/character migration must not make a completed
      // recovery look stuck or invite a duplicate click.
      onClose()
      await onRecovered(result)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message === 'dm-undo-state-changed'
        ? '检查点之后存在未纳入战斗事务的角色或地图修改。为避免覆盖新数据，服务器拒绝了恢复。'
        : message === 'dm-combat-recovery-transaction-not-found'
          ? '该检查点已经恢复或不再可用，请刷新列表。'
          : '恢复失败；服务器没有写入任何部分结果，请检查连接后重试。')
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div data-testid="dm-combat-recovery-dialog" className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="flex max-h-[min(760px,92vh)] w-[min(760px,96vw)] flex-col overflow-hidden rounded-2xl border border-sky-300/20 bg-void-950 shadow-2xl">
        <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="rounded-xl bg-sky-500/15 p-2.5 text-sky-200"><RotateCcw className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-100">DM 战斗恢复</h2>
            <p className="mt-1 text-xs text-slate-400">当前 R{round}{currentActorLabel ? ` · ${currentActorLabel} 回合` : ''}。恢复由服务器原子执行，不会出现只还 HP、未还法术位的中间状态。</p>
          </div>
          <button type="button" aria-label="关闭战斗恢复" onClick={onClose} disabled={recovering} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 rounded-xl border border-emerald-300/15 bg-emerald-500/[0.05] p-3 text-xs leading-5 text-emerald-100/80">
            <div className="flex items-center gap-2 font-semibold text-emerald-100"><ShieldCheck className="h-4 w-4" />完整恢复范围</div>
            <p className="mt-1">角色与怪物 HP、法术位和职业资源、Token 坐标、回合及行动经济、ActiveEffect、专注、持续区域、地图几何、战斗日志和统计。</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><RefreshCw className="h-4 w-4 animate-spin" />读取检查点…</div>
          ) : candidates.length === 0 ? (
            <p className="rounded-xl border border-white/8 bg-white/[0.03] p-6 text-center text-sm text-slate-500">当前战斗还没有可恢复的完整事务。</p>
          ) : (
            <div className="space-y-2" data-testid="dm-combat-recovery-history">
              {candidates.slice(0, 16).map((transaction) => {
                const active = transaction.transactionId === selectedId
                return (
                  <button
                    key={transaction.transactionId}
                    type="button"
                    data-testid={`dm-combat-recovery-transaction-${transaction.transactionId}`}
                    onClick={() => setSelectedId(transaction.transactionId)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${active ? 'border-sky-300/40 bg-sky-500/10' : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.05]'}`}
                  >
                    <Clock3 className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-sky-200' : 'text-slate-600'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-200">{combatTransactionLabel(transaction)}</span>
                      <span className="mt-1 block text-[11px] text-slate-500">{new Date(transaction.createdAt).toLocaleTimeString('zh-CN')} · {transaction.resources.join('、')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {selected && <p data-testid="dm-combat-recovery-impact" className="mt-4 text-xs text-amber-200">将撤销所选事务及其后的 {affectedCount} 个战斗事务。</p>}
          {error && <p data-testid="dm-combat-recovery-error" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} disabled={recovering} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">取消</button>
          <button type="button" data-testid="dm-combat-recovery-confirm" onClick={() => void recover()} disabled={!selected || recovering} className="flex items-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40">
            {recovering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {recovering ? '恢复中…' : '恢复所选检查点'}
          </button>
        </footer>
      </section>
    </div>
  )
}
