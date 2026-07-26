import {
  ArrowRight,
  BookOpenText,
  Bot,
  Boxes,
  Check,
  Dices,
  DoorOpen,
  Map as MapIcon,
  Menu,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const publicNavigation = [
  { to: '/', label: '产品', section: 'product' },
  { to: '/combat', label: '战斗', section: 'combat' },
  { to: '/extensions', label: '扩展', section: 'extensions' },
  { to: '/blog', label: '博客', section: 'blog' },
  { to: '/pricing', label: '价格', section: 'pricing' },
] as const

const pathSection = new Map<string, string>(publicNavigation.map((item) => [item.to, item.section]))

function PublicNavLink({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
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

export default function PublicLandingPage() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const section = pathSection.get(location.pathname)
    if (!section || section === 'product') {
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    window.requestAnimationFrame(() => {
      document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
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
            {publicNavigation.map((item) => <PublicNavLink key={item.to} to={item.to} label={item.label} />)}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link to="/app" className="px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">
              登录
            </Link>
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

      <main>
        <section id="product" className="relative flex min-h-screen scroll-mt-18 items-center overflow-hidden pt-24">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[44rem] w-[70rem] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px]" />
          <div className="pointer-events-none absolute -right-48 bottom-0 h-[34rem] w-[34rem] rounded-full bg-cyan-500/8 blur-[120px]" />

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-5 py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/8 px-3 py-1.5 text-xs font-semibold text-violet-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                D&D 5e 2014 · SRD 5.1 · DM 权威结算
              </div>
              <h1 className="mt-7 font-display text-5xl font-bold leading-[1.08] text-white sm:text-6xl lg:text-7xl">
                记录每一场冒险，
                <span className="mt-2 block bg-gradient-to-r from-violet-300 via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">
                  让传奇永不褪色
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">
                星痕是一套面向线上跑团的虚拟桌面。房间同步、地图视野、自动规则结算、角色管理与可安装扩展，
                都汇聚在同一个由 DM 掌控的战役工作台中。
              </p>
              <p className="mt-3 text-sm font-semibold tracking-wide text-slate-500">
                Chronicle Every Adventure. Legends Never Die.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to="/app"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-950/60 transition hover:-translate-y-0.5 hover:bg-violet-400"
                >
                  <DoorOpen className="h-4 w-4" />
                  开始冒险
                </Link>
                <Link
                  to="/combat"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-violet-300/30 hover:bg-white/[0.07]"
                >
                  查看战斗系统
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 rounded-[3rem] bg-violet-500/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0d18]/95 p-4 shadow-2xl shadow-black/60">
                <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">遗忘神殿 · 第 4 轮</p>
                    <p className="mt-1 font-semibold text-slate-100">轮到 塞拉菲娜</p>
                  </div>
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">已同步</span>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_30%_30%,rgba(34,197,94,0.20),transparent_30%),linear-gradient(135deg,#172033,#10121d_55%,#24182b)]">
                  <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(139,92,246,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.6)_1px,transparent_1px)] [background-size:40px_40px]" />
                  <div className="absolute left-[18%] top-[58%] h-16 w-16 rounded-full border-2 border-cyan-300 bg-cyan-400/15 shadow-[0_0_28px_rgba(34,211,238,.45)]" />
                  <div className="absolute left-[58%] top-[30%] h-14 w-14 rounded-full border-2 border-rose-400 bg-rose-500/15 shadow-[0_0_24px_rgba(251,113,133,.4)]" />
                  <div className="absolute left-[34%] top-[20%] h-32 w-32 rounded-full border border-orange-300/70 bg-orange-500/12 shadow-[inset_0_0_40px_rgba(249,115,22,.28),0_0_28px_rgba(249,115,22,.18)]" />
                  <div className="absolute bottom-3 left-3 right-3 flex gap-2 rounded-xl border border-white/8 bg-slate-950/80 p-2 backdrop-blur">
                    {[Swords, Sparkles, Boxes, Dices].map((Icon, index) => (
                      <span key={index} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/8 bg-white/[0.05] text-violet-200">
                        <Icon className="h-4 w-4" />
                      </span>
                    ))}
                    <span className="ml-auto flex items-center rounded-lg bg-violet-500 px-3 text-xs font-bold text-white">结束回合</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/8 bg-white/[0.018]">
          <div className="mx-auto grid max-w-7xl gap-px px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {[
              ['DM 权威', '关键结算由房主确认'],
              ['多端同步', '角色、地图与日志实时一致'],
              ['Headless 规则', '自动化不依赖页面状态'],
              ['安全扩展', 'Worker 沙箱与能力白名单'],
            ].map(([title, text]) => (
              <div key={title} className="px-5 py-6">
                <p className="font-bold text-slate-100">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="combat" className="scroll-mt-18 py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">Combat</p>
              <h2 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">规则在后台运行，故事留在桌面上</h2>
              <p className="mt-5 text-lg leading-8 text-slate-400">
                自动、手动两种战斗模式共享同一套权威事务。玩家选择行动和目标，系统处理距离、视线、掩护、豁免、状态与资源，DM 随时可以中断和裁定。
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: MapIcon, title: '战术地图', text: '迷雾、墙门、光源、高度、区域效果与三维移动。' },
                { icon: Dices, title: '可见骰子', text: '公开骰、暗骰、奖励骰与可追溯 Roll Ledger。' },
                { icon: Swords, title: 'Headless 结算', text: '攻击、法术、状态、资源和 Interrupt 进入统一事务。' },
                { icon: Bot, title: '怪物战术', text: '确定性方案评分，可审计、可复现、由 DM 掌控。' },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/12 text-violet-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-bold text-slate-100">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="extensions" className="scroll-mt-18 border-y border-white/8 bg-[#090b15] py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Extensions</p>
              <h2 className="mt-4 font-display text-4xl font-bold text-white">房规与内容，以安全扩展交付</h2>
              <p className="mt-5 text-lg leading-8 text-slate-400">
                扩展不只是规则正文。声明式能力可以接入伤害、治疗、状态、资源、目标和休息恢复，同时由 Host 重新验证角色资格与权限。
              </p>
              <Link to="/app/extensions" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200">
                登录后管理扩展
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['房间自动同步', 'DM 启用精确版本后，玩家加入时自动获得并激活。'],
                ['安全沙箱', '禁止直接访问 DOM、网络、localStorage 与内部 Store。'],
                ['兼容报告', '明确标出 full、partial、manual 及无法自动化的原因。'],
                ['可移植内容', '账号保存、下载、导入与版本管理，不和单一房间锁死。'],
              ].map(([title, text]) => (
                <article key={title} className="rounded-2xl border border-white/8 bg-black/20 p-5">
                  <Check className="h-5 w-5 text-emerald-300" />
                  <h3 className="mt-4 font-bold text-slate-100">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="blog" className="scroll-mt-18 py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Blog</p>
                <h2 className="mt-4 font-display text-4xl font-bold text-white">开发日志与跑团实践</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-500">内容频道筹备中</span>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { icon: BookOpenText, tag: '规则', title: '为什么自动化仍然必须保留 DM 权威' },
                { icon: MapIcon, tag: '地图', title: '从战争迷雾到三维视线：一张地图如何成为场景' },
                { icon: Users, tag: '产品', title: '账号、战役与实时房间为什么要分成三层' },
              ].map(({ icon: Icon, tag, title }) => (
                <article key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <Icon className="h-5 w-5 text-cyan-300" />
                  <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">{tag}</p>
                  <h3 className="mt-2 text-lg font-bold leading-7 text-slate-200">{title}</h3>
                  <p className="mt-4 text-xs text-slate-600">即将发布</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-18 border-t border-white/8 bg-white/[0.018] py-28">
          <div className="mx-auto max-w-5xl px-5 text-center lg:px-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Pricing</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-white">先把冒险跑顺，再决定价格</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-400">
              当前为开发测试阶段，核心目标是稳定多人同步和规则结算。正式套餐、房间容量与创意工坊分成会在上线前公开说明。
            </p>
            <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-amber-300/15 bg-amber-300/[0.035] p-7 text-left">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-bold text-slate-100">开发测试版</p>
                  <p className="mt-1 text-sm text-slate-500">用于功能验证与小规模跑团</p>
                </div>
                <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">暂不收费</span>
              </div>
              <ul className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                {['D&D 5e 2014 · SRD 5.1', 'DM 与玩家实时房间', '地图和 Headless 战斗', '账号扩展管理'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-300" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/app" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-200">
                进入 APP
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 Astral Trace · 星痕</p>
          <p>D&D 5e 核心内容基于 SRD 5.1，并依 CC BY 4.0 保留署名。</p>
        </div>
      </footer>
    </div>
  )
}
