import { useEffect, useRef } from 'react'
import { Group, Image as KonvaImage } from 'react-konva'
import Konva from 'konva'
import type { MapProjectile } from './mapCanvasContracts'

export interface MovingFireTextureEffectProps {
  projectile: MapProjectile
  fireImage: HTMLImageElement
  explosionImage?: HTMLImageElement
  spriteSize: number
  impactDiameter: number
  arcHeight?: number
  clipImpactToCircle?: boolean
}

export function MovingFireTextureEffect({
  projectile,
  fireImage,
  explosionImage,
  spriteSize,
  impactDiameter,
  arcHeight = 0,
  clipImpactToCircle = false,
}: MovingFireTextureEffectProps) {
  const projectileRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)

  useEffect(() => {
    const sprite = projectileRef.current
    const impact = impactRef.current
    const layer = sprite?.getLayer()
    if (!sprite || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    sprite.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const travelEnd = 0.7
      const travelRaw = Math.min(1, raw / travelEnd)
      const travel = 1 - Math.pow(1 - travelRaw, 2.1)
      sprite.position({
        x: projectile.from.x + dx * travel,
        y: projectile.from.y + dy * travel - Math.sin(travel * Math.PI) * arcHeight,
      })
      sprite.opacity(raw < 0.05 ? raw / 0.05 : raw < travelEnd ? 1 : 0)
      sprite.scale({
        x: 0.86 + Math.sin(elapsed * 0.045) * 0.08,
        y: 0.9 + Math.cos(elapsed * 0.052) * 0.09,
      })
      const impactRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
      if (impact) {
        impact.visible(impactRaw > 0 && !!explosionImage)
        impact.opacity(Math.sin(impactRaw * Math.PI))
        impact.scale({ x: 0.22 + impactRaw * 0.95, y: 0.22 + impactRaw * 0.95 })
        impact.rotation(impactRaw * 28)
      }
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [arcHeight, explosionImage, projectile])

  return (
    <>
      <Group ref={projectileRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
        <KonvaImage
          image={fireImage}
          x={-spriteSize * 0.86}
          y={-spriteSize * 0.32}
          width={spriteSize}
          height={spriteSize * 0.64}
          shadowColor="#f97316"
          shadowBlur={20}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
        clipFunc={clipImpactToCircle ? (context) => {
          context.beginPath()
          context.arc(0, 0, impactDiameter / 2, 0, Math.PI * 2, false)
          context.closePath()
        } : undefined}
      >
        {explosionImage && (
          <KonvaImage
            image={explosionImage}
            x={-impactDiameter / 2}
            y={-impactDiameter / 2}
            width={impactDiameter}
            height={impactDiameter}
            shadowColor="#ef4444"
            shadowBlur={28}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
    </>
  )
}
