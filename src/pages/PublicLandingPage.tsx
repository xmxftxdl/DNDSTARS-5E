import {
  ArrowRight,
  Boxes,
  Dices,
  DoorOpen,
  ShieldCheck,
  Sparkles,
  Swords,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicWebsiteShell from '../components/PublicWebsiteShell'

export default function PublicLandingPage() {
  return (
    <PublicWebsiteShell>
      <section
        data-public-page="product"
        className="relative flex min-h-[calc(100vh-4.5rem)] items-center overflow-hidden"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-[44rem] w-[70rem] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px]" />
        <div className="pointer-events-none absolute -right-48 bottom-0 h-[34rem] w-[34rem] rounded-full bg-cyan-500/8 blur-[120px]" />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-5 py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/8 px-3 py-1.5 text-xs font-semibold text-violet-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              D&amp;D 5e 2014 · SRD 5.1 · DM 权威结算
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

          <div className="grid gap-px rounded-2xl border border-white/8 bg-white/[0.018] sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      </section>
    </PublicWebsiteShell>
  )
}
