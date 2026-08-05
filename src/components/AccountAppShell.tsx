import { DoorOpen, Home, LibraryBig, Puzzle, UserRound } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import starMarkLogo from '../assets/starmark-logo.png'
import ThemeToggle from './ThemeToggle'

const accountNavigation = [
  { to: '/app', label: '我的战役', icon: LibraryBig, end: true },
  { to: '/app/rooms', label: '创建／加入房间', icon: DoorOpen },
  { to: '/app/extensions', label: '扩展市场', icon: Puzzle },
  { to: '/app/profile', label: '个人资料', icon: UserRound },
]

export default function AccountAppShell({
  accountName,
  accountAvatar,
  activeCampaignPath,
  children,
}: {
  accountName?: string
  accountAvatar?: string
  activeCampaignPath?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-5">
            <Link to="/app" className="flex items-center gap-3">
              <span className="glow-arcane flex h-10 w-10 items-center justify-center">
                <img src={starMarkLogo} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
              </span>
              <span>
                <span className="block text-base font-bold text-gradient">星痕</span>
                <span className="block text-[11px] text-slate-500">战役与扩展控制台</span>
              </span>
            </Link>

            {accountName && (
              <span className="max-w-44 truncate text-xs font-semibold text-slate-400 lg:hidden">
                {accountName}
              </span>
            )}
            <ThemeToggle compact className="lg:hidden" />
            <Link
              to="/"
              aria-label="返回主页"
              className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5 hover:text-white lg:hidden"
            >
              <Home className="h-4 w-4" />
            </Link>
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
            <ThemeToggle compact />
            <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white">
              <Home className="h-4 w-4" />返回主页
            </Link>
            {accountName && (
              <Link to="/app/profile" className="flex max-w-52 items-center gap-2 truncate rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-arcane-500/10">
                  {accountAvatar
                    ? <img src={accountAvatar} alt="" className="h-full w-full object-cover" />
                    : <UserRound className="h-4 w-4 text-arcane-200" />}
                </span>
                <span className="truncate">{accountName}</span>
              </Link>
            )}
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
