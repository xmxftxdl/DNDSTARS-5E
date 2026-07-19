import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, Home, RefreshCw, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  scope?: string
  compact?: boolean
}

interface State {
  error: Error | null
  incidentId: string | null
}

function incidentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, incidentId: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, incidentId: incidentId() }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[页面恢复边界:${this.props.scope ?? '应用'}]`, error, info)
    try {
      window.localStorage.setItem('dndstars5e-last-crash:v1', JSON.stringify({
        incidentId: this.state.incidentId,
        scope: this.props.scope ?? '应用',
        message: error.message,
        componentStack: info.componentStack?.slice(0, 16_000),
        detectedAt: Date.now(),
      }))
    } catch {
      // Recovery UI must remain available even if browser storage is full.
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={this.props.compact ? 'p-6' : 'mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center p-6'}>
        <div className="glass w-full rounded-2xl border border-rose-400/30 p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">
              <AlertOctagon className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-slate-100">这个页面遇到了错误，其他数据仍然安全</h2>
              <p className="mt-2 text-sm text-slate-400">
                已拦截「{this.props.scope ?? '当前页面'}」的异常，没有让整个 DM/玩家端变成白屏。
              </p>
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-rose-200">
                {this.state.error.message || '未知页面错误'}
              </pre>
              <p className="mt-2 text-[11px] text-slate-500">故障编号：{this.state.incidentId}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => this.setState({ error: null, incidentId: null })}
                  className="flex items-center gap-2 rounded-lg bg-arcane-500 px-3 py-2 text-sm font-semibold text-white hover:bg-arcane-400"
                >
                  <RotateCcw className="h-4 w-4" />
                  重试此页面
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新载入应用
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign('/')}
                  className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <Home className="h-4 w-4" />
                  返回战役总览
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
