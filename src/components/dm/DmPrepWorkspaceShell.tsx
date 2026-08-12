import type { ComponentType, ReactNode } from 'react'
import {
  BookOpenText,
  CheckCircle2,
  Clock3,
  History,
  MapPinned,
  Users,
} from 'lucide-react'

export type DmPrepWorkspaceSection = 'session' | 'story' | 'world' | 'resources' | 'recap' | 'imports'

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
  { id: 'recap', label: '团务复盘', description: '日志、状态与下一场', icon: History },
  { id: 'imports', label: '导入与复核', description: 'AI 任务、校验与归档', icon: CheckCircle2 },
]

interface DmPrepWorkspaceShellProps {
  activeSection: DmPrepWorkspaceSection
  onSectionChange: (section: DmPrepWorkspaceSection) => void
  children: ReactNode
  sidebarFooter?: ReactNode
}

export default function DmPrepWorkspaceShell({
  activeSection,
  onSectionChange,
  children,
  sidebarFooter,
}: DmPrepWorkspaceShellProps) {
  return (
    <div className="grid w-full gap-4 2xl:grid-cols-[13rem_minmax(0,1fr)]" data-testid="dm-prep-workspace">
      <aside className="min-w-0 2xl:sticky 2xl:top-4 2xl:self-start">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/15 p-2 2xl:flex-col" aria-label="备团工作台">
          {WORKSPACE_SECTIONS.map((section) => {
            const Icon = section.icon
            const active = section.id === activeSection
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={`flex min-w-36 shrink-0 items-start gap-2 rounded-xl border px-3 py-3 text-left transition 2xl:min-w-0 ${active
                  ? 'border-violet-400/25 bg-violet-500/12 text-violet-100'
                  : 'border-transparent text-slate-500 hover:border-white/8 hover:bg-white/[0.025] hover:text-slate-300'}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <strong className="block text-xs">{section.label}</strong>
                  <span className="mt-1 hidden text-[10px] leading-4 opacity-70 2xl:block">{section.description}</span>
                </span>
              </button>
            )
          })}
        </nav>
        {sidebarFooter && <div className="mt-3 hidden 2xl:block">{sidebarFooter}</div>}
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
