import type { ComponentType, ReactNode } from 'react'
import {
  BookOpenText,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  History,
  MapPinned,
  Save,
  Users,
} from 'lucide-react'

export type DmPrepWorkspaceSection = 'session' | 'story' | 'world' | 'resources' | 'review'

const WORKSPACE_SECTIONS: Array<{
  id: DmPrepWorkspaceSection
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}> = [
  { id: 'session', label: '本次备团', description: '下一场需要准备什么', icon: Clock3 },
  { id: 'story', label: '剧情', description: '时间线、事件与线索', icon: BookOpenText },
  { id: 'world', label: '世界', description: '人物、关系、势力与地点', icon: Users },
  { id: 'resources', label: '资源', description: '地图、怪物与待导入内容', icon: MapPinned },
  { id: 'review', label: '团务复盘', description: 'AI 导入、复核与归档', icon: History },
]

export type DmPrepSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface DmPrepWorkspaceShellProps {
  activeSection: DmPrepWorkspaceSection
  onSectionChange: (section: DmPrepWorkspaceSection) => void
  saveStatus: DmPrepSaveStatus
  lastSavedAt?: number | null
  readiness: number
  taskCount: number
  children: ReactNode
  sidebarFooter?: ReactNode
  rightRail?: ReactNode
}

const SAVE_STATUS_COPY: Record<DmPrepSaveStatus, { label: string; className: string; icon: typeof Save }> = {
  idle: { label: '尚无可保存草稿', className: 'text-slate-500', icon: Save },
  dirty: { label: '有修改等待自动保存', className: 'text-amber-200', icon: CircleAlert },
  saving: { label: '正在保存到战役', className: 'text-sky-200', icon: Save },
  saved: { label: '已保存到账号战役', className: 'text-emerald-200', icon: CheckCircle2 },
  error: { label: '保存失败，请在复核页重试', className: 'text-rose-200', icon: CircleAlert },
}

function formatSavedTime(value?: number | null): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function DmPrepWorkspaceShell({
  activeSection,
  onSectionChange,
  saveStatus,
  lastSavedAt,
  readiness,
  taskCount,
  children,
  sidebarFooter,
  rightRail,
}: DmPrepWorkspaceShellProps) {
  const saveCopy = SAVE_STATUS_COPY[saveStatus]
  const SaveIcon = saveCopy.icon
  const savedTime = formatSavedTime(lastSavedAt)

  return (
    <div className="grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)_15rem]" data-testid="dm-prep-workspace">
      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/15 p-2 xl:flex-col" aria-label="备团工作台">
          {WORKSPACE_SECTIONS.map((section) => {
            const Icon = section.icon
            const active = section.id === activeSection
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={`flex min-w-36 shrink-0 items-start gap-2 rounded-xl border px-3 py-3 text-left transition xl:min-w-0 ${active
                  ? 'border-violet-400/25 bg-violet-500/12 text-violet-100'
                  : 'border-transparent text-slate-500 hover:border-white/8 hover:bg-white/[0.025] hover:text-slate-300'}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <strong className="block text-xs">{section.label}</strong>
                  <span className="mt-1 hidden text-[10px] leading-4 opacity-70 xl:block">{section.description}</span>
                </span>
              </button>
            )
          })}
        </nav>
        {sidebarFooter && <div className="mt-3 hidden xl:block">{sidebarFooter}</div>}
      </aside>

      <main className="min-w-0">{children}</main>

      <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className={`flex items-center gap-2 text-xs font-semibold ${saveCopy.className}`}>
            <SaveIcon className={`h-4 w-4 ${saveStatus === 'saving' ? 'animate-pulse' : ''}`} />
            {saveCopy.label}
          </div>
          {savedTime && <p className="mt-1 pl-6 text-[10px] text-slate-600">最近保存 {savedTime}</p>}
        </section>
        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-300">备团就绪度</span>
            <strong className="text-sm text-violet-200">{readiness}%</strong>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${readiness}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
            <Boxes className="h-3.5 w-3.5" />战役 AI 任务 {taskCount} 项
          </div>
        </section>
        {rightRail}
      </aside>
    </div>
  )
}
