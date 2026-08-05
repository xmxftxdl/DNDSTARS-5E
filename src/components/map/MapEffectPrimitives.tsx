import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Circle, Group, Image as KonvaImage, Line } from 'react-konva'
import Konva from 'konva'
import { areaSeed, nextAreaRandom } from './deterministicAreaRandom'
import { targetSpriteAtlasPlaybackState } from './targetSpriteAtlasPlayback'
import type { MapProjectile } from './mapCanvasContracts'

export function ProjectileArrow({ projectile }: { projectile: MapProjectile }) {
  const groupRef = useRef<Konva.Group>(null)
  const arrowRef = useRef<Konva.Arrow>(null)
  const glowRef = useRef<Konva.Arrow>(null)
  const pathRef = useRef<Konva.Line>(null)
  const chargeRef = useRef<Konva.Circle>(null)

  useEffect(() => {
    const group = groupRef.current
    const arrow = arrowRef.current
    const glow = glowRef.current
    const path = pathRef.current
    const charge = chargeRef.current
    const layer = group?.getLayer()
    if (!group || !arrow || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const focus = projectile.kind === 'focus'
    const trail = focus ? Math.min(68, Math.max(28, dist * 0.22)) : Math.min(42, Math.max(18, dist * 0.16))
    group.position(projectile.from)
    group.rotation(angle)
    arrow.points([-trail, 0, 0, 0])
    glow?.points([-trail * 1.05, 0, 0, 0])
    path?.points([0, 0, dist, 0])
    const duration = focus ? 780 : 460
    const anim = new Konva.Animation((frame) => {
      const elapsed = frame?.time ?? 0
      const raw = Math.min(1, elapsed / duration)
      const chargePhase = focus ? 0.28 : 0
      const travelRaw = chargePhase > 0 ? Math.max(0, (raw - chargePhase) / (1 - chargePhase)) : raw
      const p = 1 - Math.pow(1 - travelRaw, 2.4)
      const fade = raw < 0.78 ? 1 : Math.max(0, (1 - raw) / 0.22)
      if (focus && charge) {
        const pulse = raw < chargePhase ? 0.65 + Math.sin(raw * 44) * 0.2 : Math.max(0, 1 - travelRaw)
        charge.radius(10 + pulse * 12)
        charge.opacity(Math.max(0, pulse))
      }
      if (focus && path) {
        const pulse = raw < chargePhase ? 0.72 + Math.sin(raw * 38) * 0.18 : Math.max(0.18, 1 - travelRaw * 0.7)
        path.opacity(pulse)
      }
      group.x(projectile.from.x + dx * p)
      group.y(projectile.from.y + dy * p)
      group.opacity(fade)
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [projectile])

  return (
    <>
      {projectile.kind === 'focus' && (
        <Group
          x={projectile.from.x}
          y={projectile.from.y}
          rotation={(Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x) * 180) / Math.PI}
          listening={false}
        >
          <Circle
            ref={chargeRef}
            radius={12}
            fill="rgba(168,85,247,0.22)"
            stroke="rgba(216,180,254,0.95)"
            strokeWidth={2}
            shadowBlur={18}
            shadowColor="#a855f7"
          />
          <Line
            ref={pathRef}
            points={[0, 0, 60, 0]}
            stroke="rgba(167,139,250,0.95)"
            strokeWidth={18}
            lineCap="round"
            shadowBlur={28}
            shadowColor="#a855f7"
          />
          <Line
            points={[0, 0, Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y), 0]}
            stroke="rgba(56,189,248,0.62)"
            strokeWidth={8}
            lineCap="round"
            shadowBlur={18}
            shadowColor="#38bdf8"
          />
        </Group>
      )}
    <Group ref={groupRef} listening={false}>
      <Arrow
        ref={glowRef}
        points={[-24, 0, 0, 0]}
        stroke={projectile.kind === 'focus' ? 'rgba(168,85,247,0.55)' : 'rgba(250, 204, 21, 0.36)'}
        strokeWidth={projectile.kind === 'focus' ? 10 : 7}
        pointerLength={projectile.kind === 'focus' ? 14 : 10}
        pointerWidth={projectile.kind === 'focus' ? 14 : 10}
        lineCap="round"
        lineJoin="round"
        shadowBlur={10}
        shadowColor={projectile.kind === 'focus' ? '#a855f7' : '#facc15'}
      />
      <Arrow
        ref={arrowRef}
        points={[-24, 0, 0, 0]}
        stroke={projectile.kind === 'focus' ? '#ddd6fe' : '#f8fafc'}
        fill={projectile.kind === 'focus' ? '#c084fc' : '#f8fafc'}
        strokeWidth={projectile.kind === 'focus' ? 3.4 : 2.2}
        pointerLength={projectile.kind === 'focus' ? 13 : 9}
        pointerWidth={projectile.kind === 'focus' ? 12 : 8}
        lineCap="round"
        lineJoin="round"
        shadowBlur={4}
        shadowColor={projectile.kind === 'focus' ? '#7c3aed' : 'rgba(15,23,42,0.65)'}
      />
    </Group>
    </>
  )
}

export function DirectionalTextureEffect({
  projectile,
  image,
  heightRatio,
  minHeight,
  maxHeight,
  revealEnd = 0.58,
  fadeStart = 0.72,
  shadowColor,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  heightRatio: number
  minHeight: number
  maxHeight: number
  revealEnd?: number
  fadeStart?: number
  shadowColor: string
}) {
  const effectRef = useRef<Konva.Group>(null)
  const fluidRef = useRef<Konva.Group>(null)
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const width = distance * 1.14
  const height = Math.min(maxHeight, Math.max(minHeight, distance * heightRatio))
  const imageX = -distance * 0.055

  useEffect(() => {
    const effect = effectRef.current
    const fluid = fluidRef.current
    const layer = effect?.getLayer()
    if (!effect || !fluid || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const revealRaw = Math.min(1, raw / revealEnd)
      const reveal = 1 - Math.pow(1 - revealRaw, 2.35)
      const fade = raw < fadeStart ? 1 : Math.max(0, (1 - raw) / (1 - fadeStart))
      fluid.clipWidth(width * reveal)
      fluid.opacity(Math.min(1, raw / 0.07) * fade)
      fluid.scaleY(0.96 + Math.sin(elapsed * 0.018) * 0.05)
      return raw
    }
    // Draw the event's current frame synchronously. Remote events can arrive
    // partway through their lifetime, and waiting for the first RAF would
    // otherwise leave a blank frame (or the whole effect blank during rapid
    // presentation-state refreshes).
    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      const raw = drawFrame(initialElapsed + (frame?.time ?? 0))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    dx,
    dy,
    fadeStart,
    projectile.durationMs,
    projectile.issuedAt,
    revealEnd,
    width,
  ])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Group
        ref={fluidRef}
        clipX={imageX}
        clipY={-height * 0.58}
        clipHeight={height * 1.16}
      >
        <KonvaImage
          image={image}
          x={imageX}
          y={-height / 2}
          width={width}
          height={height}
          shadowColor={shadowColor}
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
      </Group>
    </Group>
  )
}

export function DirectionalSpriteAtlasEffect({
  projectile,
  image,
  heightRatio,
  minHeight,
  maxHeight,
  shadowColor,
  particleColor,
  particleHighlight,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  heightRatio: number
  minHeight: number
  maxHeight: number
  shadowColor: string
  particleColor: string
  particleHighlight: string
}) {
  const effectRef = useRef<Konva.Group>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const particleRefs = useRef<Array<Konva.Circle | null>>([])
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const width = distance * 1.14
  const height = Math.min(maxHeight, Math.max(minHeight, distance * heightRatio))
  const imageX = -distance * 0.055
  const frameWidth = (image.naturalWidth || image.width) / 4
  const frameHeight = (image.naturalHeight || image.height) / 4
  const particles = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const random = (field: string) => nextAreaRandom(
      areaSeed(`${projectile.id}:directional-sprite:${index}:${field}`),
    )[1]
    return {
      angle: random('angle') * Math.PI * 2,
      distance: height * (0.16 + random('distance') * 0.42),
      radius: Math.max(1.1, height * (0.014 + random('radius') * 0.014)),
      delay: random('delay') * 0.16,
    }
  }), [height, projectile.id])

  useEffect(() => {
    const effect = effectRef.current
    const sprite = spriteRef.current
    const layer = effect?.getLayer()
    if (!effect || !sprite || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const spriteRaw = Math.min(1, raw / 0.9)
      const frameIndex = Math.min(15, Math.floor(spriteRaw * 16))
      const fade = raw < 0.82 ? 1 : Math.max(0, (1 - raw) / 0.18)
      sprite.crop({
        x: (frameIndex % 4) * frameWidth,
        y: Math.floor(frameIndex / 4) * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })
      sprite.opacity(Math.min(1, raw / 0.055) * fade)
      sprite.scaleY(0.985 + Math.sin(elapsed * 0.025) * 0.025)
      particleRefs.current.forEach((particle, index) => {
        if (!particle) return
        const spec = particles[index]
        const local = Math.max(0, Math.min(1, (raw - 0.42 - spec.delay) / 0.46))
        const spread = spec.distance * (0.25 + local)
        particle.position({
          x: imageX + width * (0.91 + local * 0.08) + Math.cos(spec.angle) * spread,
          y: Math.sin(spec.angle) * spread,
        })
        particle.radius(spec.radius * (1 - local * 0.38))
        particle.opacity(Math.sin(local * Math.PI) * 0.86 * fade)
      })
      return raw
    }
    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      if (drawFrame(initialElapsed + (frame?.time ?? 0)) >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    dx,
    dy,
    frameHeight,
    frameWidth,
    imageX,
    particles,
    projectile.durationMs,
    projectile.issuedAt,
    width,
  ])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <KonvaImage
        ref={spriteRef}
        image={image}
        crop={{ x: 0, y: 0, width: frameWidth, height: frameHeight }}
        x={imageX}
        y={-height / 2}
        width={width}
        height={height}
        shadowColor={shadowColor}
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      {particles.map((particle, index) => (
        <Circle
          key={`directional-sprite-particle:${index}`}
          ref={(node) => { particleRefs.current[index] = node }}
          radius={particle.radius}
          fill={index % 3 === 0 ? particleHighlight : particleColor}
          shadowColor={shadowColor}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

export function MovingFireTextureEffect({
  projectile,
  fireImage,
  explosionImage,
  spriteSize,
  impactDiameter,
  arcHeight = 0,
}: {
  projectile: MapProjectile
  fireImage: HTMLImageElement
  explosionImage?: HTMLImageElement
  spriteSize: number
  impactDiameter: number
  arcHeight?: number
}) {
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
        impact.scale({
          x: 0.22 + impactRaw * 0.95,
          y: 0.22 + impactRaw * 0.95,
        })
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

export function TargetTextureManifestation({
  projectile,
  image,
  width,
  height,
  y,
  shadowColor,
  descend = 0,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  width: number
  height: number
  y: number
  shadowColor: string
  descend?: number
}) {
  const effectRef = useRef<Konva.Group>(null)
  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrive = 1 - Math.pow(1 - Math.min(1, raw / 0.38), 3)
      const fade = raw < 0.76 ? 1 : Math.max(0, (1 - raw) / 0.24)
      effect.y(projectile.to.y + y - descend * (1 - arrive))
      effect.opacity(Math.min(1, raw / 0.08) * fade)
      effect.scale({
        x: 0.55 + arrive * 0.45,
        y: 0.55 + arrive * 0.45,
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [descend, projectile, y])
  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y + y - descend} listening={false}>
      <KonvaImage
        image={image}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        shadowColor={shadowColor}
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

export function TargetSpriteAtlasEffect({
  projectile,
  image,
  diameter,
  width = diameter,
  height = diameter,
  rotation = 0,
  shadowColor,
  particleColor,
  particleHighlight,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  diameter: number
  width?: number
  height?: number
  rotation?: number
  shadowColor: string
  particleColor: string
  particleHighlight: string
}) {
  const effectRef = useRef<Konva.Group>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const particleRefs = useRef<Array<Konva.Circle | null>>([])
  const [declarativeFrameIndex, setDeclarativeFrameIndex] = useState(0)
  const holdMatureFrame = !!projectile.handoffAreaId
  const frameWidth = (image.naturalWidth || image.width) / 4
  const frameHeight = (image.naturalHeight || image.height) / 4
  const duration = Math.max(1, projectile.durationMs ?? 1_000)
  // The presentation coordinator intentionally re-projects active events every
  // 125ms. React-Konva reapplies declarative props on each of those renders, so
  // a hard-coded frame-zero crop would overwrite the mature frame after the
  // imperative entrance animation stops. Mirror only the discrete atlas frame
  // into React state, so later parent renders preserve it without driving a
  // 60fps React render loop.
  const particles = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const random = (field: string) => nextAreaRandom(
      areaSeed(`${projectile.id}:target-sprite:${index}:${field}`),
    )[1]
    return {
      angle: random('angle') * Math.PI * 2,
      distance: diameter * (0.18 + random('distance') * 0.3),
      radius: Math.max(1.1, diameter * (0.008 + random('radius') * 0.008)),
      delay: random('delay') * 0.15,
    }
  }), [diameter, projectile.id])

  useEffect(() => {
    const effect = effectRef.current
    const sprite = spriteRef.current
    const layer = effect?.getLayer()
    if (!effect || !sprite || !layer) return
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const drawFrame = (elapsed: number) => {
      const playback = targetSpriteAtlasPlaybackState({
        elapsedMs: elapsed,
        durationMs: duration,
        holdMatureFrame,
      })
      const { raw, frameIndex, fade, spriteOpacity } = playback
      setDeclarativeFrameIndex((current) => current === frameIndex ? current : frameIndex)
      sprite.crop({
        x: (frameIndex % 4) * frameWidth,
        y: Math.floor(frameIndex / 4) * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })
      sprite.opacity(spriteOpacity)
      sprite.scale({
        x: 0.98 + Math.sin(elapsed * 0.022) * 0.025,
        y: 0.98 + Math.cos(elapsed * 0.019) * 0.025,
      })
      particleRefs.current.forEach((particle, index) => {
        if (!particle) return
        const spec = particles[index]
        const local = Math.max(0, Math.min(1, (raw - 0.46 - spec.delay) / 0.42))
        const spread = spec.distance * (0.32 + local)
        particle.position({
          x: Math.cos(spec.angle) * spread,
          y: Math.sin(spec.angle) * spread - diameter * local * 0.08,
        })
        particle.radius(spec.radius * (1 - local * 0.35))
        particle.opacity(Math.sin(local * Math.PI) * 0.82 * fade)
      })
      effect.opacity(fade)
      return raw
    }
    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      if (drawFrame(initialElapsed + (frame?.time ?? 0)) >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [diameter, duration, frameHeight, frameWidth, holdMatureFrame, particles, projectile.issuedAt])

  return (
    <Group
      ref={effectRef}
      name={`target-sprite-atlas target-sprite-atlas-${projectile.kind ?? 'unknown'}`}
      x={projectile.to.x}
      y={projectile.to.y}
      rotation={rotation}
      listening={false}
    >
      <KonvaImage
        ref={spriteRef}
        name="target-sprite-atlas-image"
        image={image}
        crop={{
          x: (declarativeFrameIndex % 4) * frameWidth,
          y: Math.floor(declarativeFrameIndex / 4) * frameHeight,
          width: frameWidth,
          height: frameHeight,
        }}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        shadowColor={shadowColor}
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      {particles.map((particle, index) => (
        <Circle
          key={`target-sprite-particle:${index}`}
          ref={(node) => { particleRefs.current[index] = node }}
          radius={particle.radius}
          fill={index % 3 === 0 ? particleHighlight : particleColor}
          shadowColor={shadowColor}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}
