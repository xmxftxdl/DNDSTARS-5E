import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Server } from 'lucide-react'
import type { AppMode } from '../lib/appMode'
import { inspectSharedProtocol, type SharedProtocolStatus } from '../lib/sharedProtocol'

export default function ServerCompatibilityBanner({ mode }: { mode: AppMode | null }) {
  const [status, setStatus] = useState<SharedProtocolStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const inspect = useCallback(async () => {
    setChecking(true)
    try {
      setStatus(await inspectSharedProtocol())
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void inspect(), 0)
    const timer = window.setInterval(() => void inspect(), 30_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [inspect])

  if (!status || status.kind === 'compatible' || status.kind === 'offline') return null
  const isDm = mode !== 'player'
  const incompatible = status.kind === 'incompatible'
  return (
    <div className="fixed inset-x-0 top-0 z-[200] border-b border-amber-400/40 bg-amber-950/95 px-4 py-3 text-amber-50 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {incompatible ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <Server className="h-5 w-5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {incompatible ? '共享服务协议与当前页面不兼容' : '检测到仍在运行的旧版共享服务'}
          </p>
          <p className="text-xs text-amber-100/80">
            {isDm
              ? '请停止旧的 5273 进程，再运行 npm run dev:dm。重启前新协议、隔离与战役快照不会生效。'
              : '请让 DM 重启 5273 共享服务；在此之前请避免继续编辑角色或战斗。'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void inspect()}
          disabled={checking}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-300/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          重新检测
        </button>
      </div>
    </div>
  )
}
