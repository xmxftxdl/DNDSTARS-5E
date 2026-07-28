import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicWebsiteShell from '../components/PublicWebsiteShell'

export default function PublicPricingPage() {
  return (
    <PublicWebsiteShell>
      <section
        data-public-page="pricing"
        className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden py-24 sm:py-28"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-amber-400/8 blur-[120px]" />
        <div className="relative mx-auto max-w-5xl px-5 text-center lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Pricing</p>
          <h1 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
            先把冒险跑顺，再决定价格
          </h1>
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
            <Link
              to="/app"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-200"
            >
              进入 APP
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicWebsiteShell>
  )
}
