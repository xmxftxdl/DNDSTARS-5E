import { ArrowRight, Menu, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getAccountSession, subscribeAccountSession } from '../lib/accountSession'

const publicNavigation = [
  { to: '/', label: '产品' },
  { to: '/combat', label: '战斗' },
  { to: '/extension', label: '扩展市场' },
  { to: '/blog', label: '博客' },
  { to: '/pricing', label: '价格' },
] as const

function PublicNavLink({
  to,
  label,
  onClick,
}: {
  to: string
  label: string
  onClick?: () => void
}) {
  const location = useLocation()
  const active = location.pathname === to

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={active
        ? 'text-sm font-semibold text-white'
        : 'text-sm font-semibold text-slate-400 transition hover:text-white'}
    >
      {label}
    </Link>
  )
}

export default function PublicWebsiteShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [account, setAccount] = useState(() => getAccountSession())

  useEffect(() => subscribeAccountSession(setAccount), [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#06070f] text-slate-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#06070f]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="星痕首页">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-950">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <span>
              <span className="block font-display text-base font-bold tracking-wide text-white">星痕</span>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-violet-300">Astral Trace</span>
            </span>
          </Link>

          <nav aria-label="产品网站导航" className="hidden items-center gap-7 md:flex">
            {publicNavigation.map((item) => (
              <PublicNavLink key={item.to} to={item.to} label={item.label} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {account ? (
              <Link to="/app/profile" className="flex max-w-48 items-center gap-2 truncate rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-500/10">
                  {account.avatar
                    ? <img src={account.avatar} alt="" className="h-full w-full object-cover" />
                    : <UserRound className="h-4 w-4 text-violet-200" />}
                </span>
                <span className="truncate">{account.username ?? account.displayName}</span>
              </Link>
            ) : (
              <>
                <Link to="/app?auth=login" className="px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">
                  登录
                </Link>
                <Link to="/app?auth=register" className="px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">
                  注册
                </Link>
              </>
            )}
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400"
            >
              进入 APP
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            aria-label={mobileOpen ? '关闭导航' : '打开导航'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="rounded-xl border border-white/10 p-2 text-slate-300 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/8 bg-[#080914] px-5 py-5 md:hidden">
            <nav className="grid gap-4">
              {publicNavigation.map((item) => (
                <PublicNavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
              {!account && (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/app?auth=login" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200">登录</Link>
                  <Link to="/app?auth=register" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200">注册</Link>
                </div>
              )}
              {account && (
                <Link
                  to="/app/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100"
                >
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-violet-500/10">
                    {account.avatar
                      ? <img src={account.avatar} alt="" className="h-full w-full object-cover" />
                      : <UserRound className="h-4 w-4 text-violet-200" />}
                  </span>
                  {account.username ?? account.displayName}
                </Link>
              )}
              <Link
                to="/app"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold text-white"
              >
                进入 APP
                <ArrowRight className="h-4 w-4" />
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="pt-18">{children}</main>

      <footer className="border-t border-white/8 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 Astral Trace · 星痕</p>
          <p>D&amp;D 5e 核心内容基于 SRD 5.1，并依 CC BY 4.0 保留署名。</p>
        </div>
      </footer>
    </div>
  )
}
