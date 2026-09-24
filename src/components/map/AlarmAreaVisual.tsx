import { memo, useMemo, useRef } from 'react'
import Konva from 'konva'
import { Circle, Group, Line, Path, Rect } from 'react-konva'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { cellTopLeft } from '../../lib/gridCombat'
import { usePrefersReducedMotion, useStatusAnimation } from './mapEffectHooks'

/** Quiet ward animation. Rings indicate an armed area, not an actual alarm trigger. */
export const AlarmAreaVisual = memo(function AlarmAreaVisual({ area, map }: {
  area: Dnd5ePluginArea; map: BattleMap
}) {
  const boundary = useRef<Konva.Group>(null)
  const bell = useRef<Konva.Group>(null)
  const waves = useRef<Array<Konva.Circle | null>>([])
  const reducedMotion = usePrefersReducedMotion()
  const grid = Math.max(1, map.gridSize)
  const geometry = useMemo(() => {
    const occupied = new Set(area.cells.map(cell => `${cell.col},${cell.row}`))
    const points = area.cells.map(cell => cellTopLeft(cell, map))
    const edges: number[][] = []
    area.cells.forEach((cell, index) => {
      const { x, y } = points[index]
      if (!occupied.has(`${cell.col},${cell.row - 1}`)) edges.push([x, y, x + grid, y])
      if (!occupied.has(`${cell.col + 1},${cell.row}`)) edges.push([x + grid, y, x + grid, y + grid])
      if (!occupied.has(`${cell.col},${cell.row + 1}`)) edges.push([x + grid, y + grid, x, y + grid])
      if (!occupied.has(`${cell.col - 1},${cell.row}`)) edges.push([x, y + grid, x, y])
    })
    if (!points.length) return null
    const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y))
    const width = Math.max(...points.map(p => p.x)) + grid - left
    const height = Math.max(...points.map(p => p.y)) + grid - top
    return { points, edges, x: left + width / 2, y: top + height / 2, radius: Math.hypot(width, height) / 2 }
  }, [area.cells, grid, map.gridOffsetX, map.gridOffsetY])
  useStatusAnimation(() => boundary.current?.getLayer() ?? null, frame => {
    const seconds = (frame?.time ?? 0) / 1000
    boundary.current?.opacity(0.65 + Math.sin(seconds * 1.1) * 0.12)
    bell.current?.opacity(0.85 + Math.sin(seconds * 1.1) * 0.1)
    waves.current.forEach((wave, index) => {
      const phase = (seconds / 5 + index / 3) % 1
      wave?.radius((geometry?.radius ?? grid) * phase)
      wave?.opacity(Math.sin(phase * Math.PI) * 0.24)
    })
  }, { active: !reducedMotion && !!geometry, fps: 16 })
  if (!geometry) return null
  return <Group listening={false} name="alarm-ward-visual">
    <Group clipFunc={context => {
      context.beginPath()
      for (const point of geometry.points) context.rect(point.x, point.y, grid, grid)
    }}>
      {geometry.points.map((point, i) => <Rect key={i} {...point} width={grid} height={grid} fill="#f59e0b" opacity={0.035} />)}
      {[0, 1, 2].map(index => <Circle key={index} ref={node => { waves.current[index] = node }}
        x={geometry.x} y={geometry.y} radius={geometry.radius * (index + 1) / 4}
        stroke="#fde68a" strokeWidth={1.2} opacity={0.15} />)}
    </Group>
    <Group ref={boundary} opacity={0.75}>
      {geometry.edges.map((points, index) => <Group key={index}>
        <Line points={points} stroke="#78350f" strokeWidth={4} opacity={0.7} />
        <Line points={points} stroke="#fcd34d" strokeWidth={1.4} shadowColor="#f59e0b" shadowBlur={3} />
        <Line x={(points[0] + points[2]) / 2} y={(points[1] + points[3]) / 2}
          points={[0, -grid * 0.055, grid * 0.045, 0, 0, grid * 0.055, -grid * 0.045, 0]}
          closed fill="#fef3c7" stroke="#fbbf24" strokeWidth={0.6} />
      </Group>)}
    </Group>
    <Group ref={bell} x={geometry.x} y={geometry.y} scaleX={grid / 64} scaleY={grid / 64}>
      <Circle radius={18} fill="#291d10" opacity={0.8} stroke="#fbbf24" strokeWidth={1} />
      <Circle radius={22} stroke="#fcd34d" strokeWidth={0.7} dash={[3, 5]} opacity={0.6} />
      <Path data="M -10 7 L -7 2 L -7 -5 Q -7 -12 0 -12 Q 7 -12 7 -5 L 7 2 L 10 7 Z M -3 10 Q 0 15 3 10 M 0 -12 L 0 -15"
        stroke="#fef3c7" strokeWidth={1.7} lineCap="round" lineJoin="round" />
    </Group>
  </Group>
})
