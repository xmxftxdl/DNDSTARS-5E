import { useEffect, useRef } from 'react'
import { Circle, Group, Line, RegularPolygon } from 'react-konva'
import Konva from 'konva'
import { usePrefersReducedMotion } from './mapEffectHooks'
import type { MapProjectile } from './mapCanvasContracts'

/** Shared event time drives the rise, so DM and players see the same phase. */
export function ReverseGravityEffect({ projectile, persistent = false }: { projectile: MapProjectile; persistent?: boolean }) {
  const root = useRef<Konva.Group>(null)
  const reducedMotion = usePrefersReducedMotion()
  const radius = Math.max(24, projectile.radiusPx ?? 100)
  useEffect(() => {
    const group = root.current
    const layer = group?.getLayer()
    if (!group || !layer) return
    const issuedAt = projectile.issuedAt ?? Date.now()
    const duration = projectile.durationMs ?? 1800
    const draw = () => {
      const progress = persistent ? (Date.now() % 4800) / 4800 : Math.max(0, Math.min(1, (Date.now() - issuedAt) / duration))
      group.opacity(persistent ? 1 : Math.min(1, progress * 7) * Math.min(1, (1 - progress) * 5))
      group.find<Konva.Circle>('.gravity-ring').forEach((ring, index) => {
        const phase = (progress * 1.5 + index / 3) % 1
        ring.scale({ x: reducedMotion ? 1 : 0.75 + phase * 0.25, y: reducedMotion ? 1 : 0.75 + phase * 0.25 })
        ring.y(reducedMotion ? 0 : -phase * radius * 0.55)
        ring.opacity(reducedMotion ? 0.35 : (1 - phase) * 0.6)
      })
      group.find<Konva.Group>('.gravity-debris').forEach((particle, index) => {
        const phase = (progress * 1.4 + index / 18) % 1
        particle.offsetY(reducedMotion ? 0 : phase * radius * 0.8)
        particle.opacity(Math.sin(phase * Math.PI) * 0.9)
        particle.rotation(reducedMotion ? 0 : phase * 70)
      })
    }
    const animation = new Konva.Animation(draw, layer)
    draw()
    animation.start()
    return () => { animation.stop() }
  }, [projectile.issuedAt, projectile.durationMs, radius, reducedMotion, persistent])
  return <Group ref={root} x={projectile.to.x} y={projectile.to.y} listening={false} name="reverse-gravity-effect">
    <Circle radius={radius} fill="#6045b8" opacity={0.09} />
    <Circle radius={radius} stroke="#c4b5fd" strokeWidth={2} opacity={0.65} dash={[8, 5]} />
    {[0, 1, 2].map(index => <Circle key={index} name="gravity-ring" radius={radius * (0.8 + index * 0.06)} stroke={index === 1 ? '#a5f3fc' : '#c4b5fd'} strokeWidth={1.5} shadowColor="#a78bfa" shadowBlur={12} />)}
    {Array.from({ length: 18 }, (_, index) => {
      const angle = index * 2.399963
      const distance = radius * Math.sqrt((index + 1) / 20) * 0.82
      return <Group key={index} name="gravity-debris" x={Math.cos(angle) * distance} y={Math.sin(angle) * distance}>
        <Line points={[0, 22, 0, 0]} stroke="#a5f3fc" strokeWidth={1} opacity={0.45} />
        <RegularPolygon sides={index % 2 ? 4 : 3} radius={3 + index % 4} fill={index % 3 ? '#b9a6e5' : '#a5f3fc'} stroke="#e9d5ff" strokeWidth={0.7} shadowColor="#a78bfa" shadowBlur={6} />
      </Group>
    })}
  </Group>
}

