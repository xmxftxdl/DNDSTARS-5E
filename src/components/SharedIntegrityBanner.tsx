import { useEffect, useState } from 'react'
import { ArchiveRestore, X } from 'lucide-react'
import {
  clearSharedIntegrityIssues,
  latestSharedIntegrityIssue,
  SHARED_INTEGRITY_EVENT,
  type SharedIntegrityIssue,
} from '../lib/sharedResourceValidation'

export default function SharedIntegrityBanner() {
  const [issue, setIssue] = useState<SharedIntegrityIssue | null>(() => latestSharedIntegrityIssue())
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<SharedIntegrityIssue>).detail
      setIssue(detail ?? latestSharedIntegrityIssue())
    }
    window.addEventListener(SHARED_INTEGRITY_EVENT, refresh)
    return () => window.removeEventListener(SHARED_INTEGRITY_EVENT, refresh)
  }, [])
  if (!issue) return null
  return (
    <div className="fixed bottom-4 right-4 z-[190] max-w-md rounded-xl border border-rose-400/40 bg-rose-950/95 p-4 text-rose-50 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <ArchiveRestore className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">已阻止损坏的共享状态</p>
          <p className="mt-1 text-xs text-rose-100/80">
            资源「{issue.resource}」：{issue.reason}。原始内容已{issue.source === 'server' ? '在服务端' : '在本机'}隔离，未覆盖当前状态。
          </p>
          {issue.quarantineId && <p className="mt-1 truncate font-mono text-[10px] text-rose-200/60">隔离编号：{issue.quarantineId}</p>}
        </div>
        <button
          type="button"
          title="关闭提示"
          onClick={() => {
            clearSharedIntegrityIssues()
            setIssue(null)
          }}
          className="rounded p-1 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
