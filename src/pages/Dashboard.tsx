import { Link } from 'react-router-dom'
import {
  Map as MapIcon,
  Users,
  Swords,
  Bot,
  Scroll,
  Dices,
  ChevronRight,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import CampaignSafetyPanel from '../components/CampaignSafetyPanel'
import { SharedSyncDiagnosticsPanel } from '../components/SharedSyncStatus'
import RoomManagementPanel from '../components/RoomManagementPanel'
import Dnd5eEffectDiagnosticsPanel from '../components/Dnd5eEffectDiagnosticsPanel'

const stats = [
  { label: '已上传地图', value: '0', icon: MapIcon, color: 'text-sky-300' },
  { label: '角色卡', value: '0', icon: Users, color: 'text-emerald-300' },
  { label: '敌人模板', value: '0', icon: Bot, color: 'text-rose-300' },
  { label: '进行中战斗', value: '0', icon: Swords, color: 'text-amber-300' },
]

const quickActions = [
  { to: '/maps', label: '上传地图', desc: '导入战斗地图并设置网格', icon: MapIcon },
  { to: '/characters', label: '创建角色', desc: '录入冒险者的属性与技能', icon: Users },
  { to: '/maps', label: '开始战斗', desc: '在地图中启动 D&D 5e Headless 战斗', icon: Swords },
]

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="欢迎回来，地下城主"
        description="在这里管理你的战役、地图、角色与战斗。"
        actions={
          <button className="glow-arcane flex items-center gap-2 rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]">
            <Dices className="h-4 w-4" />
            新建战役
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

      {/* Quick actions */}
      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
        快速开始
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quickActions.map(({ to, label, desc, icon: Icon }) => (
          <Link key={`${label}:${to}`} to={to}>
            <Card className="group flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-arcane-500/15 text-arcane-300 transition-colors group-hover:bg-arcane-500/25">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-100">{label}</p>
                <p className="text-sm text-slate-400">{desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-arcane-300" />
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">
        最近动态
      </h3>
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Scroll className="h-10 w-10 text-slate-600" />
          <p className="text-slate-400">还没有任何战役记录</p>
          <p className="text-sm text-slate-500">创建你的第一个战役，开启冒险吧。</p>
        </div>
      </Card>
      <CampaignSafetyPanel />
      <RoomManagementPanel />
      <SharedSyncDiagnosticsPanel />
      <Dnd5eEffectDiagnosticsPanel />
    </div>
  )
}
