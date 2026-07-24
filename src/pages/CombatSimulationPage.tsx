import PageHeader from '../components/PageHeader'
import Dnd5eCombatSimulationPanel from '../components/Dnd5eCombatSimulationPanel'

export default function CombatSimulationPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="战斗 AI 模拟"
        description="批量模拟当前队伍与怪物的遭遇，评估胜率、存活率、平均伤害和自动化覆盖程度。模拟只读，不会改写战役或地图状态。"
      />
      <Dnd5eCombatSimulationPanel />
    </div>
  )
}
