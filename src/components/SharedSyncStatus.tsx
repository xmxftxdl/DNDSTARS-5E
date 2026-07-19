import { useSyncExternalStore } from 'react'
import { Activity, CheckCircle2, RefreshCw, ShieldAlert, X } from 'lucide-react'
import {
  acknowledgeSharedConflict,
  getSharedSyncHealth,
  subscribeSharedSyncHealth,
} from '../lib/sharedSyncHealth'

export function SharedSyncRecoveryBanner() {
  const health = useSyncExternalStore(subscribeSharedSyncHealth, getSharedSyncHealth, getSharedSyncHealth)
  if (health.status === 'healthy') return null
  const conflict = health.status === 'conflict'
  return (
    <div className={`fixed bottom-4 left-1/2 z-[185] w-[min(92vw,620px)] -translate-x-1/2 rounded-xl border p-4 shadow-2xl backdrop-blur ${conflict ? 'border-amber-400/40 bg-amber-950/95 text-amber-50' : 'border-sky-400/40 bg-sky-950/95 text-sky-50'}`}>
      <div className="flex items-start gap-3">
        {conflict ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{conflict ? '已阻止旧版本覆盖' : '正在补拉权威状态'}</p>
          <p className="mt-1 text-xs opacity-80">{health.lastMessage}</p>
        </div>
        {conflict && (
          <button type="button" title="关闭" onClick={acknowledgeSharedConflict} className="rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleTimeString('zh-CN') : '暂无'
}

export function SharedSyncDiagnosticsPanel() {
  const health = useSyncExternalStore(subscribeSharedSyncHealth, getSharedSyncHealth, getSharedSyncHealth)
  const revisions = Object.entries(health.resourceRevisions).sort(([left], [right]) => left.localeCompare(right))
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-black/15 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-500/15 p-3 text-sky-300"><Activity className="h-6 w-6" /></div>
          <div>
            <h3 className="font-semibold text-slate-100">多人同步诊断</h3>
            <p className="mt-1 text-sm text-slate-500">资源版本、冲突拦截与事件断档恢复均由共享协议记录。</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${health.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
          {health.status === 'healthy' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {health.status === 'healthy' ? '同步正常' : health.status === 'conflict' ? '已拦截冲突' : '正在恢复'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-slate-950/40 p-3"><p className="text-[11px] text-slate-500">阻止旧写入</p><p className="mt-1 text-xl font-bold text-slate-200">{health.conflictsPrevented}</p></div>
        <div className="rounded-xl bg-slate-950/40 p-3"><p className="text-[11px] text-slate-500">事件断档恢复</p><p className="mt-1 text-xl font-bold text-slate-200">{health.eventGapsRecovered}</p></div>
        <div className="rounded-xl bg-slate-950/40 p-3"><p className="text-[11px] text-slate-500">忽略重复事件</p><p className="mt-1 text-xl font-bold text-slate-200">{health.duplicateEventsIgnored}</p></div>
        <div className="rounded-xl bg-slate-950/40 p-3"><p className="text-[11px] text-slate-500">最近写入</p><p className="mt-1 text-sm font-semibold text-slate-300">{formatTime(health.lastSuccessfulWriteAt)}</p></div>
      </div>
      {health.lastMessage && <p className="mt-3 text-xs text-slate-500">{health.lastMessage}</p>}
      {revisions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {revisions.slice(0, 16).map(([name, revision]) => (
            <span key={name} className="rounded-lg border border-white/8 bg-slate-950/30 px-2.5 py-1 font-mono text-[11px] text-slate-400">
              {name} · r{revision}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
