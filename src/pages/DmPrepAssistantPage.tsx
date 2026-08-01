import { BookOpenText, Bot, Hammer, MapPinned, MessageSquareText, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

const prepEntries = [
  {
    id: 'scene',
    title: '地图与场景',
    description: '准备地图、几何、光照、迷雾、互动点和预设遭遇。',
    icon: MapPinned,
    path: 'maps',
    status: '可用',
  },
  {
    id: 'handouts',
    title: '讲义与战役日志',
    description: '整理线索、共享手记、私密讲义和下一次团务的前情提要。',
    icon: MessageSquareText,
    path: 'communications',
    status: '可用',
  },
  {
    id: 'encounter',
    title: '遭遇预演',
    description: '用确定性战术 AI 批量模拟遭遇，检查胜率和自动化覆盖。',
    icon: Bot,
    path: 'dm-tools/simulation',
    status: '可用',
  },
  {
    id: 'content',
    title: '自定义内容',
    description: '为本次战役制作怪物、子职、法术、装备和其他规则内容。',
    icon: Hammer,
    path: 'dm-tools/workshop',
    status: '可用',
  },
] as const

export default function DmPrepAssistantPage() {
  const { campaignId = 'local' } = useParams()
  const campaignBasePath = `/campaign/${encodeURIComponent(campaignId)}`

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="备团助手"
        description="把地图、场景、讲义、自定义内容和遭遇预演集中到一条 DM 备团流程中。"
      />

      <section className="mb-5 rounded-2xl border border-arcane-400/15 bg-arcane-500/[0.045] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-arcane-500/15 p-2.5 text-arcane-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">当前阶段：统一备团入口</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              这里先汇总现有的权威工具。后续 PDF 解析、人物关系图、剧情提要和素材自动归档会在独立的 AI 导入事务中接入，未经确认不会直接修改战役数据。
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {prepEntries.map(({ id, title, description, icon: Icon, path, status }) => (
          <Link
            key={id}
            to={`${campaignBasePath}/${path}`}
            className="group rounded-2xl border border-white/8 bg-black/15 p-5 transition hover:border-arcane-400/25 hover:bg-arcane-500/[0.045]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5 text-slate-400 transition group-hover:text-arcane-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-400/15 bg-emerald-500/8 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                {status}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-5">
        <div className="flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-slate-500" />
          <h3 className="font-semibold text-slate-100">建议备团顺序</h3>
        </div>
        <ol className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
          {['整理讲义与线索', '设置地图与互动点', '准备怪物和规则内容', '运行遭遇预演'].map((label, index) => (
            <li key={label} className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3">
              <span className="mr-2 font-semibold text-arcane-300">{index + 1}.</span>{label}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
