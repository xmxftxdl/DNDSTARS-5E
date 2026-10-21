import { Group, Text } from 'react-konva'
import { cellTopLeft } from '../../lib/gridCombat'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'

/** Cloud lettering stays fixed at the authored area, never follows its caster. */
export function cloudTextLayout(area: Dnd5ePluginArea, map: BattleMap) {
  if (!area.cells.length) return undefined
  const points = area.cells.map(cell => cellTopLeft(cell, map))
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y))
  const width = Math.max(...points.map(p => p.x)) + map.gridSize - x
  const height = Math.max(...points.map(p => p.y)) + map.gridSize - y
  return { x, y, width, height, text: area.label,
    fontSize: Math.max(8, Math.min(height * 0.4, width * 0.24, 48,
      Math.sqrt(width * height / (Math.max(1, Array.from(area.label).length) * 1.4)))) }
}

export function CloudTextArea({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const layout = cloudTextLayout(area, map)
  if (!layout) return null
  return <Group name="persistent-cloud-text" listening={false}>
    <Text {...layout} name="cloud-text-halo" align="center" verticalAlign="middle" wrap="word"
      fill="#ffffff" opacity={0.42} stroke="#ffffff" strokeWidth={layout.fontSize * 0.1}
      shadowColor="#ffffff" shadowBlur={layout.fontSize * 0.3} listening={false}/>
    <Text {...layout} name="cloud-text-letters" align="center" verticalAlign="middle" wrap="word"
      fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.4}
      shadowColor="#64748b" shadowBlur={2} shadowOffsetY={1} listening={false}/>
  </Group>
}
