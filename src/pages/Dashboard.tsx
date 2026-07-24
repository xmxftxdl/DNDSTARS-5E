import {
  Map as MapIcon,
  Users,
  Swords,
  Bot,
  Dices,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import CampaignAdvancedAnalyticsPanel from '../components/CampaignAdvancedAnalyticsPanel'
import RoomPartyOverview from '../components/RoomPartyOverview'
import Dnd5eCombatSimulationPanel from '../components/Dnd5eCombatSimulationPanel'

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
      <Dnd5eCombatSimulationPanel />

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
        战役进阶数据
      </h3>
      <CampaignAdvancedAnalyticsPanel />
    </div>
  )
}
