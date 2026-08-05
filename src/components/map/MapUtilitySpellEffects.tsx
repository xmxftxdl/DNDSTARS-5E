import { useEffect, useRef } from 'react'
import { Circle, Group, Line, Rect } from 'react-konva'
import Konva from 'konva'
import type { MapProjectile } from './mapCanvasContracts'
const NEW_MANIFESTATION_HEALING_IDS = new Set([
  'heal', 'mass-cure-wounds', 'mass-heal', 'mass-healing-word', 'prayer-of-healing',
])

export function NewSpellManifestation({ projectile }: { projectile: MapProjectile }) {
  const rootRef = useRef<Konva.Group>(null)
  const orbitRef = useRef<Konva.Group>(null)
  const pulseRef = useRef<Konva.Circle>(null)
  const moteRefs = useRef<Array<Konva.Circle | null>>([])
  const kind = String(projectile.kind)
  const healing = NEW_MANIFESTATION_HEALING_IDS.has(kind)
  const radius = Math.max(24, projectile.radiusPx ?? 38) * (kind === 'mass-heal' ? 1.25 : kind.startsWith('mass-') ? 1.12 : 1)
  const accent = projectile.accentColor ?? (healing ? '#22c55e' : kind === 'dancing-lights' ? '#60a5fa' : kind === 'minor-illusion' ? '#a78bfa' : kind === 'thaumaturgy' ? '#f59e0b' : '#84cc16')
  const glow = projectile.glowColor ?? (healing ? '#fde68a' : kind === 'dancing-lights' ? '#c4b5fd' : kind === 'minor-illusion' ? '#e9d5ff' : kind === 'thaumaturgy' ? '#fef3c7' : '#bef264')

  useEffect(() => {
    const root = rootRef.current
    const orbit = orbitRef.current
    const layer = root?.getLayer()
    if (!root || !orbit || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_250)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const enter = 1 - Math.pow(1 - Math.min(1, raw / 0.22), 3)
      const fade = raw < 0.76 ? 1 : Math.max(0, (1 - raw) / 0.24)
      root.position(projectile.to)
      root.opacity(enter * fade)
      root.scale({ x: 0.55 + enter * 0.45, y: 0.55 + enter * 0.45 })
      orbit.rotation(elapsed * (kind === 'minor-illusion' ? -0.045 : 0.035))
      pulseRef.current?.radius(radius * (0.28 + (raw % 0.48) * 1.05))
      pulseRef.current?.opacity(Math.max(0, 0.62 - (raw % 0.48) * 0.62))
      moteRefs.current.forEach((mote, index) => {
        if (!mote) return
        const phase = (raw * (healing ? 1.35 : 1.05) + index * 0.137) % 1
        const angle = index * 1.31 + elapsed * (kind === 'dancing-lights' ? 0.0038 : 0.0018)
        mote.position({
          x: Math.cos(angle) * radius * (0.24 + phase * 0.72),
          y: healing
            ? radius * 0.6 - phase * radius * 1.55 + Math.sin(angle) * radius * 0.08
            : Math.sin(angle) * radius * (0.24 + phase * 0.72),
        })
        mote.opacity(Math.sin(phase * Math.PI) * 0.9)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [healing, kind, projectile, radius])

  return (
    <Group ref={rootRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle radius={radius * 0.82} fill={accent} opacity={0.1} shadowColor={glow} shadowBlur={radius * 0.95} perfectDrawEnabled={false} />
      <Circle ref={pulseRef} radius={radius * 0.25} stroke={glow} strokeWidth={2.2} shadowColor={glow} shadowBlur={14} perfectDrawEnabled={false} />
      <Group ref={orbitRef}>
        <Circle radius={radius * 0.72} stroke={accent} strokeWidth={2.2} dash={[radius * 0.18, radius * 0.1]} shadowColor={glow} shadowBlur={12} perfectDrawEnabled={false} />
        <Circle radius={radius * 0.5} stroke={glow} strokeWidth={1.4} opacity={0.78} perfectDrawEnabled={false} />
        {healing ? (
          <>
            <Line points={[-radius * 0.34, 0, radius * 0.34, 0]} stroke={glow} strokeWidth={radius * 0.13} lineCap="round" shadowColor={accent} shadowBlur={12} perfectDrawEnabled={false} />
            <Line points={[0, -radius * 0.34, 0, radius * 0.34]} stroke={glow} strokeWidth={radius * 0.13} lineCap="round" shadowColor={accent} shadowBlur={12} perfectDrawEnabled={false} />
            {kind === 'prayer-of-healing' && [0, 120, 240].map((rotation) => <Line key={rotation} rotation={rotation} points={[radius * 0.76, 0, radius * 1.02, 0]} stroke="#fde68a" strokeWidth={2.4} lineCap="round" />)}
          </>
        ) : kind === 'dancing-lights' ? (
          [0, 90, 180, 270].map((rotation, index) => <Circle key={rotation} rotation={rotation} x={radius * 0.56} radius={radius * 0.12} fill={index % 2 ? '#c4b5fd' : glow} shadowColor={accent} shadowBlur={15} />)
        ) : kind === 'minor-illusion' ? (
          <Rect x={-radius * 0.27} y={-radius * 0.27} width={radius * 0.54} height={radius * 0.54} rotation={45} offsetX={radius * 0.27} offsetY={radius * 0.27} fill={accent} opacity={0.28} stroke={glow} strokeWidth={2.2} shadowColor={accent} shadowBlur={18} />
        ) : kind === 'thaumaturgy' ? (
          [0, 60, 120, 180, 240, 300].map((rotation) => <Line key={rotation} rotation={rotation} points={[radius * 0.28, 0, radius * 0.64, 0]} stroke={glow} strokeWidth={3} lineCap="round" shadowColor={accent} shadowBlur={10} />)
        ) : (
          <>
            <Line points={[-radius * 0.12, radius * 0.52, radius * 0.1, -radius * 0.54]} stroke="#713f12" strokeWidth={radius * 0.16} lineCap="round" shadowColor={accent} shadowBlur={10} />
            <Line points={[0, radius * 0.12, radius * 0.28, -radius * 0.12, radius * 0.14, -radius * 0.36]} stroke={glow} strokeWidth={radius * 0.07} lineCap="round" lineJoin="round" />
          </>
        )}
      </Group>
      {Array.from({ length: healing ? 14 : 10 }, (_, index) => (
        <Circle key={index} ref={(node) => { moteRefs.current[index] = node }} radius={1.7 + (index % 3) * 0.65} fill={index % 3 === 0 ? glow : accent} shadowColor={glow} shadowBlur={8} perfectDrawEnabled={false} />
      ))}
    </Group>
  )
}

