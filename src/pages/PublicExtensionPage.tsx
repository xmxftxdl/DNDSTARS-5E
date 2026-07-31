import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicWebsiteShell from '../components/PublicWebsiteShell'

export default function PublicExtensionPage() {
  return (
    <PublicWebsiteShell>
      <section
        data-public-page="extension"
        className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden py-24 sm:py-28"
      >
        <div className="pointer-events-none absolute right-0 top-0 h-[32rem] w-[32rem] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Extension Marketplace</p>
            <h1 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
              房规与内容，以安全扩展交付
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              扩展不只是规则正文。声明式能力可以接入伤害、治疗、状态、资源、目标和休息恢复，
              同时由 Host 重新验证角色资格与权限。
            </p>
            <Link
              to="/app/extensions"
              className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200"
            >
              进入扩展市场
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
                <h2 className="mt-4 font-bold text-slate-100">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicWebsiteShell>
  )
}
