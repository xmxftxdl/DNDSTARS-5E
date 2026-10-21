import { useRef, useState } from 'react'
import type { Token } from '../../store/maps'

export function DruidGroveRootingControls({ token, onSettle }: {
  token: Token; onSettle?: (canRoot: boolean) => Promise<void>
}) {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!token.dnd5eGroveRooting) return null
  const pending = token.dnd5eGroveRooting === 'pending'
  const canDecide = pending && token.type === 'obstacle' && token.dnd5eObjectState?.vegetation === 'living' &&
    !token.dnd5eGroveGuardian && (token.hp == null || token.hp > 0) && !!onSettle
  const settle = async (canRoot: boolean) => {
    if (busyRef.current || !canDecide) return
    busyRef.current = true; setBusy(true); setError('')
    try { await onSettle!(canRoot) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '生根判定未能保存，请重试。') }
    finally { busyRef.current = false; setBusy(false) }
  }
  return <section data-testid="grove-rooting-controls" className="rounded-xl border border-emerald-400/25 bg-emerald-950/25 p-3 text-xs text-emerald-100">
    <p className="font-semibold">林地守卫已恢复为树木</p>
    <p className="mt-1">{pending ? '由 DM 根据当前位置的地面条件判定能否重新生根。' : token.dnd5eGroveRooting === 'rooted' ? '已重新生根。' : '此处无法生根；树木已停止活动。'}</p>
    {canDecide && <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void settle(true)} className="rounded bg-emerald-800 px-3 py-2 disabled:opacity-50">此处可以生根</button>
      <button type="button" disabled={busy} onClick={() => void settle(false)} className="rounded border border-emerald-400/30 px-3 py-2 disabled:opacity-50">此处无法生根</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
  </section>
}
