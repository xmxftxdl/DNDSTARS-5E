import {
  ArrowRight,
  FlaskConical,
  Map as MapIcon,
  Users,
  Swords,
  Bot,
  Dices,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import CampaignAdvancedAnalyticsPanel from '../components/CampaignAdvancedAnalyticsPanel'
import RoomPartyOverview from '../components/RoomPartyOverview'

interface DashboardProps {
  onCreateCampaign?: () => void
  creatingCampaign?: boolean
}

const stats = [
  { label: '已上传地图', value: '0', icon: MapIcon, color: 'text-sky-300' },
  { label: '角色卡', value: '0', icon: Users, color: 'text-emerald-300' },
  { label: '敌人模板', value: '0', icon: Bot, color: 'text-rose-300' },
  { label: '进行中战斗', value: '0', icon: Swords, color: 'text-amber-300' },
]

export default function Dashboard({ onCreateCampaign, creatingCampaign = false }: DashboardProps) {
  const { campaignId } = useParams()
  const simulationPath = campaignId
    ? `/campaign/${encodeURIComponent(campaignId)}/simulation`
    : '/simulation'

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="欢迎回来，地下城主"
        description="在这里管理你的战役、地图、角色与战斗。"
        actions={
          <button
            type="button"
            onClick={onCreateCampaign}
            disabled={!onCreateCampaign || creatingCampaign}
            aria-label="新建战役"
            className="glow-arcane flex items-center gap-2 rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60 disabled:hover:scale-100"
          >
            <Dices className="h-4 w-4" />
            {creatingCampaign ? '正在退出当前战役…' : '新建战役'}
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-100">{value}</p>
              </div>
              <Icon className={`h-8 w-8 ${color}`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <RoomPartyOverview />
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
        遭遇战术模拟
      </h3>
      <Card className="border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] to-cyan-500/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-300">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-100">战斗 AI 模拟器</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                选择当前队伍和怪物，批量运行带随机种子的遭遇模拟，并查看胜率、存活率、平均伤害与自动化覆盖程度。
              </p>
            </div>
          </div>
          <Link
            to={simulationPath}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400"
          >
            打开模拟器
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
        战役进阶数据
      </h3>
      <CampaignAdvancedAnalyticsPanel />
    </div>
  )
}
