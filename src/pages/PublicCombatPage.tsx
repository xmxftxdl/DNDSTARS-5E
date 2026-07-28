import { Bot, Dices, Map as MapIcon, Swords } from 'lucide-react'
import PublicWebsiteShell from '../components/PublicWebsiteShell'

export default function PublicCombatPage() {
  return (
    <PublicWebsiteShell>
      <section
        data-public-page="combat"
        className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden py-24 sm:py-28"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-violet-600/12 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">Combat</p>
            <h1 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
              规则在后台运行，故事留在桌面上
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              自动、手动两种战斗模式共享同一套权威事务。玩家选择行动和目标，系统处理距离、视线、掩护、
              豁免、状态与资源，DM 随时可以中断和裁定。
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
                <h2 className="mt-5 font-bold text-slate-100">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicWebsiteShell>
  )
}
