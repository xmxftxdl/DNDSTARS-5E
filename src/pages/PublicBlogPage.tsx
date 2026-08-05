import { BookOpenText, Map as MapIcon, Users } from 'lucide-react'
import PublicWebsiteShell from '../components/PublicWebsiteShell'

export default function PublicBlogPage() {
  return (
    <PublicWebsiteShell>
      <section
        data-public-page="blog"
        className="min-h-[calc(100vh-4.5rem)] py-24 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Blog</p>
              <h1 className="mt-4 font-display text-4xl font-bold text-slate-100 sm:text-5xl">
                开发日志与跑团实践
              </h1>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-500">
              内容频道筹备中
            </span>
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
                <h2 className="mt-2 text-lg font-bold leading-7 text-slate-200">{title}</h2>
                <p className="mt-4 text-xs text-slate-600">即将发布</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicWebsiteShell>
  )
}
