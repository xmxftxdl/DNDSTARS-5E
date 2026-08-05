import { Group, Rect, Text } from 'react-konva'
import { cellKey, cellTopLeft } from '../../lib/gridCombat'
import type { BattleMap } from '../../store/maps'

const ITEM_AREA_PRESENTATION = {
  'ball-bearings': {
    icon: '●',
    fill: 'rgba(148, 163, 184, 0.24)',
    stroke: 'rgba(203, 213, 225, 0.72)',
  },
  caltrops: {
    icon: '▲',
    fill: 'rgba(245, 158, 11, 0.22)',
    stroke: 'rgba(251, 191, 36, 0.78)',
  },
  'hunting-trap': {
    icon: '⌁',
    fill: 'rgba(239, 68, 68, 0.22)',
    stroke: 'rgba(248, 113, 113, 0.82)',
  },
} as const

export default function Dnd5eItemAreaOverlays({ map }: { map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  return <>{(map.dnd5eItemAreas ?? []).flatMap((area) => {
    const style = ITEM_AREA_PRESENTATION[area.kind]
    return area.cells.map((cell, index) => {
      const { x, y } = cellTopLeft(cell, map)
      return (
        <Group key={`${area.id}:${cellKey(cell)}`} listening={false} opacity={area.armed ? 1 : 0.48}>
          <Rect
            x={x}
            y={y}
            width={grid}
            height={grid}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={2}
            dash={area.armed ? [7, 5] : [3, 6]}
          />
          {index === 0 && (
            <Text
              x={x}
              y={y + grid * 0.18}
              width={grid}
              text={style.icon}
              align="center"
              fontSize={Math.max(12, grid * 0.42)}
              fill={style.stroke}
              shadowBlur={4}
              shadowColor="rgba(0,0,0,0.8)"
            />
          )}
        </Group>
      )
    })
  })}</>
}
