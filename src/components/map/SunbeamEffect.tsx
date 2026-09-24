import { useEffect, useRef } from 'react'
import { Circle, Group, Line, Rect } from 'react-konva'
import Konva from 'konva'
import { usePrefersReducedMotion } from './mapEffectHooks'
import type { MapProjectile } from './mapCanvasContracts'

/** A connected shaft of sunlight, timed from the shared cast event. */
export function SunbeamEffect({ projectile }: { projectile: MapProjectile }) {
  const root = useRef<Konva.Group>(null)
  const reducedMotion = usePrefersReducedMotion()
  const length = Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y)
  const width = Math.max(1, projectile.areaWidthPx ?? 40)
  const rotation = Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x) * 180 / Math.PI

  useEffect(() => {
    const group = root.current
    const layer = group?.getLayer()
    if (!group || !layer) return
    const issuedAt = projectile.issuedAt ?? Date.now()
    const duration = projectile.durationMs ?? 1800
    const beam = group.findOne<Konva.Group>('.sunbeam-shaft')!
    const corona = group.findOne<Konva.Group>('.sunbeam-corona')!
    const motes = group.find<Konva.Line>('.sunbeam-mote')
    const draw = () => {
      const elapsed = Date.now() - issuedAt
      const t = Math.max(0, Math.min(1, elapsed / duration))
      const fade = Math.min(1, (1 - t) / 0.25)
      group.opacity(elapsed < 0 ? 0 : Math.min(1, t / 0.1) * fade)
      const reach = reducedMotion ? 1 : Math.max(0, Math.min(1, (t - 0.12) / 0.16))
      beam.scaleX(reach)
      beam.opacity(reducedMotion ? 0.8 : Math.min(1, reach * 3) * (0.94 + 0.06 * Math.sin(t * 24)))
      const charge = reducedMotion ? 1 : 0.4 + Math.min(1, t / 0.18) * 0.6
      corona.scale({ x: charge, y: charge })
      motes.forEach((mote, index) => {
        const phase = (index * 0.618034 + (reducedMotion ? 0 : t * 0.9)) % 1
        mote.x(phase * Math.max(0, length - width * 0.4))
        mote.y(Math.sin(index * 2.39996 + (reducedMotion ? 0 : t * 3)) * width * 0.36)
        mote.opacity(reducedMotion ? 0.25 : Math.sin(phase * Math.PI) * 0.75)
      })
      return elapsed >= duration
    }
    const animation = new Konva.Animation(() => { if (draw()) animation.stop() }, layer)
    if (!draw()) animation.start()
    layer.batchDraw()
    return () => { animation.stop() }
  }, [projectile.issuedAt, projectile.durationMs, length, width, reducedMotion])

  return <Group ref={root} x={projectile.from.x} y={projectile.from.y} rotation={rotation} listening={false} opacity={0} name="sunbeam-effect">
    <Group name="sunbeam-shaft" scaleX={0}>
      <Rect width={length} height={width} y={-width / 2}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: width }}
        fillLinearGradientColorStops={[0, 'rgba(255,186,55,0)', 0.22, 'rgba(255,194,67,0.35)', 0.5, 'rgba(255,247,190,0.9)', 0.78, 'rgba(255,194,67,0.35)', 1, 'rgba(255,186,55,0)']} />
      <Line points={[0, 0, length, 0]} stroke="#ffd766" strokeWidth={width * 0.3} opacity={0.7} shadowColor="#ffcb46" shadowBlur={width * 0.45} />
      <Line points={[0, 0, length, 0]} stroke="#fff5c6" strokeWidth={width * 0.13} />
      <Line points={[0, 0, length, 0]} stroke="#ffffff" strokeWidth={width * 0.045} />
      {Array.from({ length: 22 }, (_, index) => <Line key={index} name="sunbeam-mote"
        points={[0, 0, width * (0.12 + index % 3 * 0.07), 0]} stroke={index % 3 ? '#fff7d1' : '#ffd36a'}
        strokeWidth={Math.max(1, width * 0.025)} lineCap="round" />)}
    </Group>
    <Group name="sunbeam-corona">
      <Circle radius={width * 0.65} fillRadialGradientStartRadius={0} fillRadialGradientEndRadius={width * 0.65}
        fillRadialGradientColorStops={[0, '#fffef0', 0.2, 'rgba(255,238,163,0.9)', 0.55, 'rgba(255,195,61,0.3)', 1, 'rgba(255,195,61,0)']} />
      <Circle radius={width * 0.14} fill="#fffef4" shadowColor="#ffe698" shadowBlur={width * 0.3} />
      <Line points={[0, -width * 0.4, 0, width * 0.4]} stroke="#fff4c1" strokeWidth={width * 0.035} opacity={0.7} />
    </Group>
  </Group>
}
