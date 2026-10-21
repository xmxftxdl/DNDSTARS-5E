import { Arrow, Circle, Group, Text } from 'react-konva'
import type { Dnd5eMapObjectFlightPlan } from '../../rulesets/dnd5e/mapObjectFlight'

export function ObjectFlightPreview({ plan, valid, gridSize, visibleTokenIds }: {
  plan: Dnd5eMapObjectFlightPlan; valid: boolean; gridSize: number; visibleTokenIds: ReadonlySet<string>
}) {
  const color = valid ? '#67e8f9' : '#fb7185'
  const radius = Math.max(5, gridSize * .12)
  const altitude = `${Math.round(plan.elevationFeet * 10) / 10} → ${Math.round(plan.destinationElevationFeet * 10) / 10} 尺`
  return <Group listening={false}>
    <Circle x={plan.from.x} y={plan.from.y} radius={gridSize * .48} stroke={color} strokeWidth={3} />
    <Arrow points={[plan.from.x, plan.from.y, plan.to.x, plan.to.y]} stroke={color} fill={color}
      strokeWidth={3} dash={[9, 5]} pointerLength={10} pointerWidth={9} />
    {plan.creatures.filter(contact => visibleTokenIds.has(contact.tokenId)).map((contact, index) => <Group key={contact.tokenId} x={contact.point.x} y={contact.point.y}>
      <Circle radius={radius} fill="#0f172a" stroke="#fbbf24" strokeWidth={2} />
      <Text x={-radius} y={-6} width={radius * 2} align="center" text={String(index + 1)} fontSize={12} fill="#fef3c7" />
    </Group>)}
    <Circle x={plan.to.x} y={plan.to.y} radius={radius} stroke={color} strokeWidth={2} />
    <Text x={plan.from.x + 12} y={plan.from.y - gridSize * .7} text={`飞行高度 ${altitude}\n虚线为可能路径，豁免失败处停止${plan.stop?.kind === 'map-boundary' ? '\n若飞出地图，将保存剩余轨迹，由 DM 选择后续到达点' : ''}`}
      fontSize={12} fill={color} stroke="#0f172a" strokeWidth={.5} />
  </Group>
}
