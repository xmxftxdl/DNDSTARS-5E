import { memo, useRef } from 'react'
import Konva from 'konva'
import { Circle, Ellipse, Group, Line } from 'react-konva'
import { tokenCenterForAnchorCell } from '../../lib/gridCombat'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { usePrefersReducedMotion, useStatusAnimation } from './mapEffectHooks'

/** Top-down hemisphere: fixed footprint with a gently breathing shell. */
export const TinyHutVisual = memo(function TinyHutVisual({ area, map }: {
  area: Dnd5ePluginArea; map: BattleMap
}) {
  const shell = useRef<Konva.Group>(null)
  const glints = useRef<Konva.Group>(null)
  const reducedMotion = usePrefersReducedMotion()
  useStatusAnimation(() => shell.current?.getLayer() ?? null, frame => {
    const seconds = (frame?.time ?? 0) / 1000
    shell.current?.opacity(0.8 + Math.sin(seconds * 1.2) * 0.1)
    glints.current?.rotation(seconds * 4)
  }, { active: !reducedMotion, fps: 16 })
  const anchor = area.anchorCell ?? area.cells[0]
  if (!anchor) return null
  const point = tokenCenterForAnchorCell(anchor, { size: 1 }, map)
  const radius = 10 / Math.max(1, map.feetPerCell ?? 5) * map.gridSize
  return <Group x={point.x} y={point.y} scaleX={radius / 100} scaleY={radius / 100} listening={false}>
    <Circle radius={100} fillRadialGradientStartPoint={{ x: -26, y: -32 }}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={100}
      fillRadialGradientColorStops={[0, 'rgba(224,231,255,0.04)', 0.65, 'rgba(99,102,241,0.08)', 0.9, 'rgba(139,92,246,0.20)', 1, 'rgba(196,181,253,0.30)']} />
    <Circle radius={100} stroke="#c4b5fd" strokeWidth={1.8}
      shadowColor="#8b5cf6" shadowBlur={9} shadowOpacity={0.5} />
    <Circle radius={96} stroke="#818cf8" strokeWidth={0.6} opacity={0.65} />
    <Group ref={shell} opacity={0.8}>
      {[0, 60, 120].map(rotation => <Ellipse key={rotation} radiusX={42} radiusY={99}
        rotation={rotation} stroke="#c7d2fe" strokeWidth={0.65} opacity={0.27} />)}
      <Ellipse x={-28} y={-38} radiusX={24} radiusY={8} rotation={-35}
        fill="#e0e7ff" opacity={0.10} />
      <Line points={[-67, -62, -53, -76, -32, -86, -11, -90]} tension={0.5}
        stroke="#eef2ff" strokeWidth={2} lineCap="round" opacity={0.55} />
    </Group>
    <Group ref={glints}>
      {[0, 72, 144, 216, 288].map(rotation => <Group key={rotation} rotation={rotation}>
        <Line points={[0, -98, 2, -93, 0, -88, -2, -93]} closed
          fill="#ddd6fe" opacity={0.7} />
      </Group>)}
    </Group>
  </Group>
})
