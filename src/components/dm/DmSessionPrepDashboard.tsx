import { BookOpenText, Bot, Boxes, KeyRound, MapPinned, MessageSquareText, Swords, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'

interface DmSessionPrepDashboardProps {
  analysis: PdfCampaignAnalysisV2 | null
  campaignBasePath: string
  onOpenReview: () => void
}

function brief(value: string, fallback: string): string {
  const normalized = value.trim()
  if (!normalized) return fallback
  return normalized.length > 260 ? `${normalized.slice(0, 257)}…` : normalized
}

export default function DmSessionPrepDashboard({ analysis, campaignBasePath, onOpenReview }: DmSessionPrepDashboardProps) {
  if (!analysis) {
    return (
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.1] to-transparent p-6 sm:p-8">
        <BookOpenText className="h-8 w-8 text-violet-300" />
        <h2 className="mt-4 text-xl font-bold text-slate-100">先建立这场战役的备团档案</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">导入模组 PDF 后，人物、时间线、线索、地图和怪物会进入独立工作区。AI 只生成草稿，所有正式资源仍由 DM 审阅。</p>
        <button type="button" onClick={onOpenReview} className="mt-5 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400">导入并分析模组</button>
      </section>
    )
  }

  const scenes = analysis.scenes.slice(0, 3)
  const people = analysis.people.slice(0, 4)
  const clues = analysis.clues.slice(0, 4)
  const tips = [...analysis.prepTips].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - ({ high: 0, medium: 1, low: 2 }[b.priority]))).slice(0, 4)

  return (
    <div className="space-y-4" data-testid="dm-session-prep-dashboard">
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.1] via-transparent to-cyan-500/[0.035] p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">下一场概览</p>
        <h2 className="mt-2 text-xl font-bold text-slate-100">本次备团</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{brief(analysis.overview, '尚未形成战役概览，请前往团务复盘审阅 AI 草稿。')}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard icon={MapPinned} title="预计场景" count={analysis.scenes.length}>
          {scenes.length ? scenes.map((scene) => <Entry key={scene.id} title={scene.name} meta={scene.location || '地点待确认'} />) : <Empty>尚未整理场景。</Empty>}
          <Link to={`${campaignBasePath}/maps`} className="mt-3 inline-flex text-xs font-semibold text-emerald-200">进入地图与场景编排 →</Link>
        </DashboardCard>
        <DashboardCard icon={Users} title="关键人物" count={analysis.people.length}>
          {people.length ? people.map((person) => <Entry key={person.id} title={person.name} meta={person.role || person.motivation || '身份待确认'} />) : <Empty>尚未整理关键人物。</Empty>}
        </DashboardCard>
        <DashboardCard icon={KeyRound} title="未解决线索" count={analysis.clues.length}>
          {clues.length ? clues.map((clue) => <Entry key={clue.id} title={clue.name} meta={clue.discovery || clue.source || '发现方式待确认'} />) : <Empty>尚未整理线索。</Empty>}
        </DashboardCard>
        <DashboardCard icon={Bot} title="DM 备团提醒" count={analysis.prepTips.length}>
          {tips.length ? tips.map((tip) => <Entry key={tip.id} title={tip.title} meta={tip.description} tone={tip.priority === 'high' ? 'warning' : 'normal'} />) : <Empty>当前没有额外提醒。</Empty>}
        </DashboardCard>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink to={`${campaignBasePath}/dm-tools/workshop`} icon={Boxes} title="内容工坊" detail={`${analysis.importCandidates.length} 项候选资源`} />
        <QuickLink to={`${campaignBasePath}/dm-tools/simulation`} icon={Swords} title="遭遇预演" detail={`${analysis.encounters.length} 个遭遇`} />
        <QuickLink to={`${campaignBasePath}/maps`} icon={MapPinned} title="地图编排" detail="几何、灯光与触发器" />
        <QuickLink to={`${campaignBasePath}/communications`} icon={MessageSquareText} title="讲义与日志" detail="团务记录与前情提要" />
      </section>
    </div>
  )
}

function DashboardCard({ icon: Icon, title, count, children }: { icon: typeof Users; title: string; count: number; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-slate-100">{title}</h3><span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-500">{count}</span></div><div className="space-y-2">{children}</div></section>
}

function Entry({ title, meta, tone = 'normal' }: { title: string; meta: string; tone?: 'normal' | 'warning' }) {
  return <div className="rounded-xl border border-white/7 bg-white/[0.018] px-3 py-2.5"><strong className="block truncate text-xs text-slate-200">{title}</strong><p className={`mt-1 line-clamp-2 text-[10px] leading-4 ${tone === 'warning' ? 'text-amber-200/80' : 'text-slate-500'}`}>{meta}</p></div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/8 px-3 py-6 text-center text-xs text-slate-600">{children}</p>
}

function QuickLink({ to, icon: Icon, title, detail }: { to: string; icon: typeof Boxes; title: string; detail: string }) {
  return <Link to={to} className="group rounded-2xl border border-white/8 bg-black/15 p-4 transition hover:border-violet-400/20 hover:bg-violet-500/[0.035]"><Icon className="h-4 w-4 text-cyan-300" /><strong className="mt-3 block text-xs text-slate-200 group-hover:text-white">{title}</strong><span className="mt-1 block text-[10px] text-slate-500">{detail}</span></Link>
}
