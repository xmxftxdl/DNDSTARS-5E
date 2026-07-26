import { DoorOpen, LibraryBig, Puzzle, Sparkles } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const accountNavigation = [
  { to: '/app', label: '我的战役', icon: LibraryBig, end: true },
  { to: '/app/rooms', label: '创建／加入房间', icon: DoorOpen },
  { to: '/app/extensions', label: '我的扩展', icon: Puzzle },
]

export default function AccountAppShell({
  accountName,
  activeCampaignPath,
  children,
}: {
  accountName?: string
  activeCampaignPath?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-5">
            <Link to="/app" className="flex items-center gap-3">
              <span className="glow-arcane flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600">
                <Sparkles className="h-5 w-5 text-white" />
              </span>
              <span>
                <span className="block text-base font-bold text-gradient">星痕 APP</span>
                <span className="block text-[11px] text-slate-500">战役与扩展控制台</span>
              </span>
            </Link>

            {accountName && (
              <span className="max-w-44 truncate text-xs font-semibold text-slate-400 lg:hidden">
                {accountName}
              </span>
            )}
          </div>

          <nav aria-label="账号控制台导航" className="flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-black/15 p-1.5">
            {accountNavigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-testid={`account-nav-${to === '/app' ? 'campaigns' : to.split('/').at(-1)}`}
                className={({ isActive }) => [
                  'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-arcane-500/18 text-arcane-100 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.28)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {accountName && <span className="max-w-48 truncate text-xs font-semibold text-slate-400">{accountName}</span>}
            {activeCampaignPath && (
              <Link
                to={activeCampaignPath}
                className="rounded-xl bg-arcane-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-arcane-400"
              >
                返回当前战役
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {children}
      </main>
    </div>
  )
}
