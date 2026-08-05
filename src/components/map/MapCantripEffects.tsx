import { useEffect, useRef } from 'react'
import { Circle, Group, Image as KonvaImage, Line, Rect } from 'react-konva'
import Konva from 'konva'
import { MAP_SPELL_STATUS_ICONS } from './mapSpellStatusIcons'
import { useTokenBadgeImage } from './mapEffectHooks'
import type { MapSpellStatusId } from './tokenStatusTooltip'
import type { MapProjectile } from './mapCanvasContracts'
import { DirectionalSpriteAtlasEffect, MovingFireTextureEffect, TargetSpriteAtlasEffect, TargetTextureManifestation } from './MapEffectPrimitives'
export { NewSpellManifestation } from './MapUtilitySpellEffects'
export function SpareTheDyingEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const haloRef = useRef<Konva.Circle>(null)
  const pulseRef = useRef<Konva.Circle>(null)
  const moteRefs = useRef<Array<Konva.Circle | null>>([])
  const radius = Math.max(20, projectile.radiusPx ?? 32)
  const accent = projectile.accentColor ?? '#22c55e'
  const glow = projectile.glowColor ?? '#86efac'

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_100)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const fade = raw < 0.12 ? raw / 0.12 : raw > 0.78 ? (1 - raw) / 0.22 : 1
      effect.position(projectile.to)
      effect.opacity(Math.max(0, fade))
      haloRef.current?.radius(radius * (0.82 + raw * 0.28))
      haloRef.current?.opacity(0.3 + Math.sin(elapsed * 0.018) * 0.12)
      pulseRef.current?.radius(radius * (0.28 + (raw % 0.52) * 0.72))
      pulseRef.current?.opacity(Math.max(0, 0.52 - (raw % 0.52)))
      moteRefs.current.forEach((mote, index) => {
        if (!mote) return
        const phase = (raw * 1.2 + index * 0.17) % 1
        const angle = index * 1.73 + elapsed * 0.0015
        mote.position({
          x: Math.cos(angle) * radius * (0.18 + phase * 0.62),
          y: radius * 0.45 - phase * radius * 1.55 + Math.sin(angle) * radius * 0.12,
        })
        mote.opacity(Math.sin(phase * Math.PI) * 0.82)
        mote.radius(1.5 + (index % 3) * 0.7)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        radius={radius * 0.88}
        fill="#22c55e"
        opacity={0.1}
        shadowColor="#4ade80"
        shadowBlur={radius * 0.9}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={haloRef}
        radius={radius * 0.9}
        stroke={accent}
        strokeWidth={2.4}
        dash={[radius * 0.18, radius * 0.12]}
        shadowColor={glow}
        shadowBlur={14}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={pulseRef}
        radius={radius * 0.3}
        stroke="#86efac"
        strokeWidth={2}
        shadowColor={glow}
        shadowBlur={12}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: 9 }, (_, index) => (
        <Circle
          key={index}
          ref={(node) => { moteRefs.current[index] = node }}
          radius={2}
          fill={index % 3 === 0 ? accent : index % 2 === 0 ? '#bbf7d0' : '#4ade80'}
          shadowColor={index % 3 === 0 ? glow : '#22c55e'}
          shadowBlur={8}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

export function AcidSplashEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const trailRef = useRef<Konva.Group>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const frontRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const dropletRefs = useRef<Array<Konva.Circle | null>>([])
  const fluidImage = useTokenBadgeImage('/assets/vfx/acid-splash-sprite-v2.png')
  const glow = projectile.glowColor ?? '#bef264'
  const accent = projectile.accentColor ?? '#84cc16'
  const distance = Math.max(
    1,
    Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y),
  )
  const fluidWidth = distance * 1.16
  const fluidHeight = Math.min(160, Math.max(82, distance * 0.36))
  const fluidX = -distance * 0.055
  const impactSize = Math.min(132, Math.max(72, fluidHeight * 0.92))
  const frameWidth = fluidImage ? (fluidImage.naturalWidth || fluidImage.width) / 4 : 1
  const frameHeight = fluidImage ? (fluidImage.naturalHeight || fluidImage.height) / 4 : 1

  useEffect(() => {
    const effect = effectRef.current
    const trail = trailRef.current
    const front = frontRef.current
    const impact = impactRef.current
    const impactRing = impactRingRef.current
    const sprite = spriteRef.current
    const layer = effect?.getLayer()
    if (!effect || !trail || !front || !impact || !impactRing || !sprite || !fluidImage || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_050)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    effect.position(projectile.from)
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const travelRaw = Math.min(1, raw / 0.64)
      const travel = 1 - Math.pow(1 - travelRaw, 2.7)
      const frontX = distance * travel
      const impactRaw = Math.max(0, Math.min(1, (raw - 0.48) / 0.24))
      const fade = raw < 0.82 ? 1 : Math.max(0, (1 - raw) / 0.18)
      const pulse = Math.sin(elapsed * 0.021)
      const spriteRaw = Math.min(1, raw / 0.9)
      const frameIndex = Math.min(15, Math.floor(spriteRaw * 16))
      sprite.crop({
        x: (frameIndex % 4) * frameWidth,
        y: Math.floor(frameIndex / 4) * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })

      trail.clipWidth(fluidWidth)
      trail.opacity(Math.min(1, raw / 0.075) * fade * 0.9)
      trail.scaleY(0.94 + pulse * 0.065)
      trail.y(Math.sin(elapsed * 0.013) * fluidHeight * 0.035)

      front.visible(false)
      front.x(frontX)
      front.y(Math.sin(elapsed * 0.016) * fluidHeight * 0.075)
      front.scale({
        x: 0.7 + travelRaw * 0.32 + pulse * 0.045,
        y: 0.82 + travelRaw * 0.22 - pulse * 0.06,
      })
      front.opacity((raw < 0.06 ? raw / 0.06 : 1) * (1 - impactRaw * 0.72) * fade)

      impact.opacity(Math.sin(impactRaw * Math.PI * 0.82) * fade)
      impact.scale({
        x: 0.36 + impactRaw * 0.88,
        y: 0.46 + impactRaw * 0.78,
      })
      impactRing.radius(impactSize * (0.18 + impactRaw * 0.62))
      impactRing.opacity((1 - impactRaw) * 0.78)
      dropletRefs.current.forEach((droplet, index) => {
        if (!droplet) return
        const angle = -1.35 + index * 0.47
        const spread = impactSize * (0.16 + impactRaw * (0.35 + (index % 4) * 0.11))
        droplet.position({
          x: Math.cos(angle) * spread - impactSize * 0.08,
          y: Math.sin(angle) * spread,
        })
        droplet.scaleY(1.2 + impactRaw * 1.1)
        droplet.rotation(angle * 180 / Math.PI)
        droplet.opacity(Math.sin(impactRaw * Math.PI) * (0.72 + (index % 3) * 0.08))
      })
      effect.y(projectile.from.y + Math.sin(elapsed * 0.011) * 1.8)
      if (raw >= 1) animation.stop()
    }, layer)
    effect.opacity(1)
    trail.opacity(0.01)
    front.opacity(0.01)
    impact.opacity(0)
    layer.batchDraw()
    animation.start()
    return () => {
      animation.stop()
    }
  }, [distance, fluidHeight, fluidImage, fluidWidth, frameHeight, frameWidth, impactSize, projectile])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Group
        ref={trailRef}
        clipX={fluidX}
        clipY={-fluidHeight * 0.58}
        clipWidth={0}
        clipHeight={fluidHeight * 1.16}
        listening={false}
      >
        {fluidImage && (
          <KonvaImage
            ref={spriteRef}
            image={fluidImage}
            crop={{ x: 0, y: 0, width: frameWidth, height: frameHeight }}
            x={fluidX}
            y={-fluidHeight / 2}
            width={fluidWidth}
            height={fluidHeight}
            shadowColor={glow}
            shadowBlur={24}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
      {fluidImage ? (
        <Group ref={frontRef} visible={false} listening={false}>
          <KonvaImage
            image={fluidImage}
            crop={{ x: 760, y: 80, width: 760, height: 870 }}
            x={-impactSize * 0.6}
            y={-impactSize * 0.52}
            width={impactSize * 1.05}
            height={impactSize * 1.04}
            shadowColor={glow}
            shadowBlur={22}
            perfectDrawEnabled={false}
          />
          <Circle
            x={-impactSize * 0.08}
            radius={impactSize * 0.11}
            fill="#d9f99d"
            opacity={0.46}
            shadowColor={accent}
            shadowBlur={14}
            perfectDrawEnabled={false}
          />
        </Group>
      ) : null}
      <Group
        ref={impactRef}
        x={distance}
        listening={false}
      >
        {fluidImage ? (
          <KonvaImage
            image={fluidImage}
            crop={{ x: frameWidth * 3, y: frameHeight * 2, width: frameWidth, height: frameHeight }}
            x={-impactSize * 0.64}
            y={-impactSize * 0.57}
            width={impactSize * 1.22}
            height={impactSize * 1.14}
            shadowColor={glow}
            shadowBlur={28}
            perfectDrawEnabled={false}
          />
        ) : null}
        <Circle
          ref={impactRingRef}
          radius={impactSize * 0.18}
          stroke="#d9f99d"
          strokeWidth={Math.max(1.5, impactSize * 0.028)}
          shadowColor={glow}
          shadowBlur={15}
          perfectDrawEnabled={false}
        />
        {Array.from({ length: 12 }, (_, index) => (
          <Circle
            key={`acid-impact-droplet:${index}`}
            ref={(node) => { dropletRefs.current[index] = node }}
            radius={Math.max(1.4, impactSize * (0.024 + (index % 3) * 0.008))}
            fill={index % 4 === 0 ? glow : index % 2 === 0 ? '#d9f99d' : '#84cc16'}
            shadowColor={index % 4 === 0 ? glow : accent}
            shadowBlur={7}
            opacity={0}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

export function PoisonSprayEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const fluidRef = useRef<Konva.Group>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const fluidImage = useTokenBadgeImage('/assets/vfx/poison-spray-sprite-v2.png')
  const glow = projectile.glowColor ?? '#86efac'
  const distance = Math.max(
    1,
    Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y),
  )
  const fluidWidth = distance * 1.15
  const fluidHeight = Math.min(190, Math.max(104, distance * 0.5))
  const fluidX = -distance * 0.06
  const frameWidth = fluidImage ? (fluidImage.naturalWidth || fluidImage.width) / 4 : 1
  const frameHeight = fluidImage ? (fluidImage.naturalHeight || fluidImage.height) / 4 : 1

  useEffect(() => {
    const effect = effectRef.current
    const fluid = fluidRef.current
    const sprite = spriteRef.current
    const layer = effect?.getLayer()
    if (!effect || !fluid || !sprite || !fluidImage || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_150)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    effect.position(projectile.from)
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const fade = raw < 0.8 ? 1 : Math.max(0, (1 - raw) / 0.2)
      const spriteRaw = Math.min(1, raw / 0.9)
      const frameIndex = Math.min(15, Math.floor(spriteRaw * 16))
      sprite.crop({
        x: (frameIndex % 4) * frameWidth,
        y: Math.floor(frameIndex / 4) * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })
      fluid.clipWidth(fluidWidth)
      fluid.opacity(Math.min(1, raw / 0.1) * fade)
      fluid.scaleY(0.94 + Math.sin(elapsed * 0.009) * 0.075)
      fluid.x(Math.sin(elapsed * 0.006) * 2.5)
      effect.y(projectile.from.y + Math.cos(elapsed * 0.008) * 2)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [fluidImage, fluidWidth, frameHeight, frameWidth, projectile])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Group
        ref={fluidRef}
        clipX={fluidX}
        clipY={-fluidHeight * 0.58}
        clipWidth={0}
        clipHeight={fluidHeight * 1.16}
      >
        {fluidImage && (
          <KonvaImage
            ref={spriteRef}
            image={fluidImage}
            crop={{ x: 0, y: 0, width: frameWidth, height: frameHeight }}
            x={fluidX}
            y={-fluidHeight / 2}
            width={fluidWidth}
            height={fluidHeight}
            shadowColor={glow}
            shadowBlur={28}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
    </Group>
  )
}

export function ViciousMockeryEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const mouthRef = useRef<Konva.Group>(null)
  const soundRefs = useRef<Array<Konva.Line | null>>([])
  const accent = projectile.accentColor ?? '#d946ef'
  const glow = projectile.glowColor ?? '#e879f9'

  useEffect(() => {
    const effect = effectRef.current
    const mouth = mouthRef.current
    const layer = effect?.getLayer()
    if (!effect || !mouth || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_100)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const appear = Math.min(1, raw / 0.16)
      const fade = raw > 0.8 ? Math.max(0, (1 - raw) / 0.2) : 1
      effect.position({ x: projectile.to.x, y: projectile.to.y - 20 })
      effect.opacity(appear * fade)
      effect.scale({ x: 0.72 + appear * 0.28, y: 0.72 + appear * 0.28 })
      const opening = 0.55 + Math.abs(Math.sin(elapsed * 0.026)) * 0.72
      mouth.scaleY(opening)
      mouth.rotation(Math.sin(elapsed * 0.008) * 5)
      soundRefs.current.forEach((line, index) => {
        if (!line) return
        const wave = (raw * 1.7 + index * 0.24) % 1
        line.x(26 + wave * 24)
        line.scaleX(0.65 + wave * 0.7)
        line.opacity(Math.sin(wave * Math.PI) * 0.8)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y - 20} listening={false}>
      <Circle
        radius={30}
        fill={accent}
        opacity={0.12}
        shadowColor={glow}
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <Group ref={mouthRef}>
        <Line
          points={[-24, 0, -12, -12, 0, -15, 12, -12, 24, 0, 12, 13, 0, 17, -12, 13]}
          closed
          fill="#19051f"
          stroke={accent}
          strokeWidth={3}
          lineJoin="round"
          shadowColor={glow}
          shadowBlur={14}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-16, -2, -8, -7, 0, -8, 8, -7, 16, -2]}
          stroke="#fff1ff"
          strokeWidth={3}
          lineCap="round"
          tension={0.3}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-15, 5, -7, 10, 0, 11, 7, 10, 15, 5]}
          stroke={glow}
          strokeWidth={2.4}
          lineCap="round"
          tension={0.35}
          perfectDrawEnabled={false}
        />
      </Group>
      {Array.from({ length: 3 }, (_, index) => (
        <Line
          key={index}
          ref={(node) => { soundRefs.current[index] = node }}
          x={28 + index * 8}
          y={-9 + index * 9}
          points={[0, 0, 6, -4, 12, 0]}
          stroke={index % 2 === 0 ? accent : glow}
          strokeWidth={2.2}
          lineCap="round"
          lineJoin="round"
          shadowColor={glow}
          shadowBlur={7}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

export function SacredFlameEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const columnRef = useRef<Konva.Group>(null)
  const descendingRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)
  const ringRef = useRef<Konva.Circle>(null)
  const flameRefs = useRef<Array<Konva.Line | null>>([])
  const sacredFlameImage = useTokenBadgeImage('/assets/vfx/sacred-flame-sprite-v2.png')
  const radius = Math.max(20, projectile.radiusPx ?? 32)

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_200)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const strength = 1
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const descent = 1 - Math.pow(1 - Math.min(1, raw / 0.38), 3)
      const fade = raw > 0.72 ? Math.max(0, (1 - raw) / 0.28) : 1
      effect.position(projectile.to)
      columnRef.current?.opacity(
        (raw < 0.08 ? raw / 0.08 : fade) * (0.6 + strength * 0.4),
      )
      descendingRef.current?.position({
        x: 0,
        y: -radius * 2.8 * (1 - descent),
      })
      descendingRef.current?.scale({
        x: 0.58 + descent * 0.42,
        y: 0.58 + descent * 0.42,
      })
      descendingRef.current?.opacity(fade * (0.62 + strength * 0.38))
      flameRefs.current.forEach((flame, index) => {
        if (!flame) return
        const sway = Math.sin(elapsed * 0.035 + index * 1.7) * radius * 0.08
        flame.x(sway)
        flame.scaleY(0.9 + Math.sin(elapsed * 0.042 + index) * 0.14)
      })

      const impactRaw = Math.max(0, Math.min(1, (raw - 0.3) / 0.7))
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, fade * strength))
        impactRef.current.scale({
          x: 0.25 + impactRaw * (0.95 + strength * 0.35),
          y: 0.25 + impactRaw * (0.95 + strength * 0.35),
        })
      }
      ringRef.current?.radius(radius * (0.28 + impactRaw * 0.92))
      ringRef.current?.opacity(Math.max(0, (1 - impactRaw * 0.72) * strength))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  const flameShapes = [
    [-0.42, 0.34, -0.3, -0.42, -0.08, -1.08, 0.02, -0.36, 0.18, -0.86, 0.39, -0.18, 0.34, 0.38],
    [-0.26, 0.38, -0.18, -0.22, 0.02, -0.72, 0.12, -0.16, 0.28, 0.12, 0.22, 0.4],
    [-0.16, 0.36, -0.08, -0.08, 0.03, -0.45, 0.18, 0.02, 0.16, 0.36],
  ]
  if (sacredFlameImage) {
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={sacredFlameImage}
        diameter={radius * 5.1}
        shadowColor="#facc15"
        particleColor="#fde68a"
        particleHighlight="#ffffff"
      />
    )
  }
  return (
    <Group
      ref={effectRef}
      x={projectile.to.x}
      y={projectile.to.y}
      listening={false}
    >
      <Group ref={columnRef}>
        <Rect
          x={-radius * 0.48}
          y={-radius * 3.2}
          width={radius * 0.96}
          height={radius * 3.25}
          cornerRadius={radius * 0.42}
          fillLinearGradientStartPoint={{ x: 0, y: -radius * 3.2 }}
          fillLinearGradientEndPoint={{ x: 0, y: 0 }}
          fillLinearGradientColorStops={[
            0, 'rgba(255,255,255,0)',
            0.24, 'rgba(254,249,195,0.34)',
            0.72, 'rgba(253,224,71,0.6)',
            1, 'rgba(255,255,255,0.82)',
          ]}
          shadowColor="#facc15"
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-radius * 0.13, -radius * 3.1, -radius * 0.08, -radius * 0.3]}
          stroke="#ffffff"
          strokeWidth={radius * 0.15}
          lineCap="round"
          opacity={0.78}
          shadowColor="#fde047"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group ref={descendingRef} y={-radius * 2.8}>
        <Circle
          radius={radius * 0.52}
          fill="rgba(254,249,195,0.7)"
          stroke="#fef08a"
          strokeWidth={2.5}
          shadowColor="#facc15"
          shadowBlur={24}
          perfectDrawEnabled={false}
        />
        {flameShapes.map((shape, index) => (
          <Line
            key={index}
            ref={(node) => { flameRefs.current[index] = node }}
            points={shape.map((value) => value * radius)}
            closed
            fill={index === 0 ? '#fde047' : index === 1 ? '#fef08a' : '#ffffff'}
            stroke="#fff7d6"
            strokeWidth={1.4}
            opacity={0.88}
            shadowColor="#eab308"
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
      <Group ref={impactRef} visible={false}>
        <Circle
          ref={ringRef}
          radius={radius * 0.28}
          stroke="#fef08a"
          strokeWidth={3}
          dash={[5, 6]}
          shadowColor="#facc15"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={radius * 0.42}
          fill="rgba(254,240,138,0.48)"
          shadowColor="#fde047"
          shadowBlur={radius}
          perfectDrawEnabled={false}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, index) => (
          <Line
            key={rotation}
            points={[
              radius * 0.34, 0,
              radius * (0.72 + (index % 2) * 0.18), 0,
            ]}
            rotation={rotation}
            stroke={index % 2 === 0 ? '#ffffff' : '#fde047'}
            strokeWidth={2.5}
            lineCap="round"
            shadowColor="#eab308"
            shadowBlur={9}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

export function SacredGuidanceSigil({ radius }: { radius: number }) {
  return (
    <>
      <Circle
        radius={radius}
        stroke="rgba(253,230,138,0.92)"
        strokeWidth={2.4}
        dash={[radius * 0.18, radius * 0.1]}
        shadowColor="#facc15"
        shadowBlur={12}
        perfectDrawEnabled={false}
      />
      <Circle
        radius={radius * 0.72}
        stroke="rgba(254,249,195,0.68)"
        strokeWidth={1.4}
        dash={[3, 6]}
        shadowColor="#fde047"
        shadowBlur={7}
        perfectDrawEnabled={false}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, index) => (
        <Group key={rotation} rotation={rotation}>
          <Line
            points={[
              radius * 0.78, 0,
              radius * 0.9, -radius * 0.09,
              radius * 1.08, 0,
              radius * 0.9, radius * 0.09,
            ]}
            closed
            fill={index % 2 === 0 ? 'rgba(254,240,138,0.88)' : 'rgba(255,255,255,0.78)'}
            stroke="#fef9c3"
            strokeWidth={1.2}
            shadowColor="#eab308"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
      {[0, 90, 180, 270].map((rotation) => (
        <Group key={`cross:${rotation}`} rotation={rotation}>
          <Line
            points={[radius * 0.48, 0, radius * 0.64, 0]}
            stroke="#fff7d6"
            strokeWidth={3}
            lineCap="round"
            shadowColor="#facc15"
            shadowBlur={6}
            perfectDrawEnabled={false}
          />
          <Circle
            x={radius * 0.56}
            radius={2.4}
            fill="#ffffff"
            shadowColor="#fde047"
            shadowBlur={7}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
    </>
  )
}

export function ResistanceShieldGlyph(input: {
  size: number
  accentColor: string
  glowColor: string
}) {
  const size = input.size
  return (
    <Group listening={false}>
      <Line
        points={[
          0, -size,
          size * 0.82, -size * 0.62,
          size * 0.68, size * 0.35,
          0, size,
          -size * 0.68, size * 0.35,
          -size * 0.82, -size * 0.62,
        ]}
        closed
        fill={input.accentColor}
        stroke={input.glowColor}
        strokeWidth={Math.max(1.5, size * 0.14)}
        lineJoin="round"
        shadowColor={input.glowColor}
        shadowBlur={size * 0.9}
        shadowOpacity={0.9}
        perfectDrawEnabled={false}
      />
      <Line
        points={[0, -size * 0.66, 0, size * 0.56]}
        stroke="rgba(255,255,255,0.82)"
        strokeWidth={Math.max(1, size * 0.11)}
        lineCap="round"
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

export function SanctuaryWardGlyph({ size }: { size: number }) {
  return (
    <Group listening={false}>
      <Circle
        radius={size}
        fill="rgba(224,242,254,0.9)"
        stroke="#f8fafc"
        strokeWidth={Math.max(1.2, size * 0.13)}
        shadowColor="#7dd3fc"
        shadowBlur={size * 1.15}
        shadowOpacity={0.95}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          0, -size * 0.72,
          size * 0.58, -size * 0.18,
          size * 0.4, size * 0.58,
          0, size * 0.82,
          -size * 0.4, size * 0.58,
          -size * 0.58, -size * 0.18,
        ]}
        closed
        fill="rgba(59,130,246,0.38)"
        stroke="#ffffff"
        strokeWidth={Math.max(1, size * 0.1)}
        lineJoin="round"
        perfectDrawEnabled={false}
      />
      <Line
        points={[-size * 0.3, 0, size * 0.3, 0, 0, -size * 0.45, 0, size * 0.5]}
        stroke="#ffffff"
        strokeWidth={Math.max(1, size * 0.09)}
        lineCap="round"
        lineJoin="round"
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

export function SanctuaryManifestation({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const orbitRef = useRef<Konva.Group>(null)
  const radius = Math.max(34, projectile.radiusPx ?? 58)

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.42), 3)
      effect.position(projectile.to)
      effect.opacity(raw < 0.14
        ? raw / 0.14
        : raw > 0.82
          ? Math.max(0, (1 - raw) / 0.18)
          : 1)
      effect.scale({
        x: 0.38 + arrival * 0.62,
        y: 0.38 + arrival * 0.62,
      })
      orbitRef.current?.rotation(52 + raw * 320)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        radius={radius * 0.96}
        fill="rgba(125,211,252,0.08)"
        stroke="rgba(224,242,254,0.9)"
        strokeWidth={2.4}
        dash={[3, 8]}
        shadowColor="#38bdf8"
        shadowBlur={18}
        perfectDrawEnabled={false}
      />
      <Circle
        radius={radius * 1.08}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.4}
        dash={[11, 13]}
        perfectDrawEnabled={false}
      />
      <Group ref={orbitRef}>
        {[0, 120, 240].map((rotation) => (
          <Group key={rotation} rotation={rotation}>
            <Group x={radius}>
              <SanctuaryWardGlyph size={Math.max(8, radius * 0.13)} />
            </Group>
          </Group>
        ))}
      </Group>
    </Group>
  )
}

export function ResistanceManifestation({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const orbitRef = useRef<Konva.Group>(null)
  const shieldRef = useRef<Konva.Group>(null)
  const radius = Math.max(22, projectile.radiusPx ?? 34)
  const accentColor = projectile.accentColor ?? '#94a3b8'
  const glowColor = projectile.glowColor ?? '#e2e8f0'

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.38), 3)
      const rotation = 22.5 + raw * 400
      effect.position(projectile.to)
      effect.opacity(raw < 0.12
        ? raw / 0.12
        : raw > 0.78
          ? Math.max(0, (1 - raw) / 0.22)
          : 1)
      effect.scale({ x: 0.35 + arrival * 0.65, y: 0.35 + arrival * 0.65 })
      orbitRef.current?.rotation(rotation)
      shieldRef.current?.rotation(-rotation)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        radius={radius}
        stroke={accentColor}
        strokeWidth={2}
        dash={[4, 7]}
        opacity={0.38}
        shadowColor={glowColor}
        shadowBlur={14}
        perfectDrawEnabled={false}
      />
      <Group ref={orbitRef}>
        <Group ref={shieldRef} x={radius}>
          <ResistanceShieldGlyph
            size={Math.max(8, radius * 0.17)}
            accentColor={accentColor}
            glowColor={glowColor}
          />
        </Group>
      </Group>
    </Group>
  )
}

export function GuidanceManifestation({ projectile }: { projectile: MapProjectile }) {
  const manifestationRef = useRef<Konva.Group>(null)
  const burstRef = useRef<Konva.Circle>(null)
  const radius = Math.max(20, projectile.radiusPx ?? 32)

  useEffect(() => {
    const manifestation = manifestationRef.current
    const layer = manifestation?.getLayer()
    if (!manifestation || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.62), 3)
      manifestation.position(projectile.to)
      manifestation.rotation(-35 + arrival * 80)
      manifestation.scale({
        x: 0.25 + arrival * 0.9,
        y: 0.25 + arrival * 0.9,
      })
      manifestation.opacity(raw < 0.12
        ? raw / 0.12
        : raw > 0.72
          ? Math.max(0, (1 - raw) / 0.28)
          : 1)
      burstRef.current?.radius(radius * (0.28 + arrival * 0.95))
      burstRef.current?.opacity(Math.max(0, 0.76 - raw * 0.7))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group
      ref={manifestationRef}
      x={projectile.to.x}
      y={projectile.to.y}
      listening={false}
    >
      <Circle
        ref={burstRef}
        radius={radius * 0.28}
        fill="rgba(254,249,195,0.3)"
        stroke="#fef08a"
        strokeWidth={3}
        shadowColor="#facc15"
        shadowBlur={26}
        perfectDrawEnabled={false}
      />
      <SacredGuidanceSigil radius={radius} />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((rotation) => (
        <Line
          key={rotation}
          points={[radius * 0.32, 0, radius * 0.55, 0]}
          rotation={rotation}
          stroke="#fff7d6"
          strokeWidth={2}
          lineCap="round"
          shadowColor="#fde047"
          shadowBlur={7}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

export function StatusSpellManifestation({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const pulseRef = useRef<Konva.Circle>(null)
  const statusId = projectile.kind as Extract<
    MapSpellStatusId,
    | 'bless'
    | 'bane'
    | 'shield-of-faith'
    | 'mage-armor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'hunters-mark'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness'
  >
  const image = useTokenBadgeImage(MAP_SPELL_STATUS_ICONS[statusId].asset)
  const radius = Math.max(22, projectile.radiusPx ?? 38)
  const accentColor = projectile.accentColor ?? '#a78bfa'
  const glowColor = projectile.glowColor ?? '#ddd6fe'

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.42), 3)
      const fade = raw < 0.1
        ? raw / 0.1
        : raw > 0.76
          ? Math.max(0, (1 - raw) / 0.24)
          : 1
      effect.position(projectile.to)
      effect.opacity(fade)
      effect.scale({ x: 0.28 + arrival * 0.82, y: 0.28 + arrival * 0.82 })
      effect.rotation((statusId === 'bane' ? -1 : 1) * (1 - arrival) * 28)
      pulseRef.current?.radius(radius * (0.72 + arrival * 0.7))
      pulseRef.current?.opacity(Math.max(0, 0.68 - raw * 0.58))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius, statusId])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        ref={pulseRef}
        radius={radius * 0.72}
        fill={accentColor}
        opacity={0.18}
        stroke={glowColor}
        strokeWidth={2.4}
        shadowColor={glowColor}
        shadowBlur={24}
      />
      <Circle
        radius={radius * 0.72}
        fill={accentColor}
        stroke={glowColor}
        strokeWidth={2.2}
        shadowColor={glowColor}
        shadowBlur={18}
      />
      {image ? (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(0, 0, radius * 0.67, 0, Math.PI * 2)
            context.closePath()
          }}
        >
          <KonvaImage
            image={image}
            x={-radius * 0.69}
            y={-radius * 0.69}
            width={radius * 1.38}
            height={radius * 1.38}
          />
        </Group>
      ) : null}
    </Group>
  )
}

export function ShockingGraspEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const haloRef = useRef<Konva.Circle>(null)
  const flashRef = useRef<Konva.Circle>(null)
  const boltRefs = useRef<Array<Konva.Line | null>>([])
  const radius = Math.max(18, projectile.radiusPx ?? 31)

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const fade = raw < 0.12
        ? raw / 0.12
        : raw > 0.78
          ? Math.max(0, (1 - raw) / 0.22)
          : 1
      const crackle = 0.78 + Math.sin(elapsed * 0.075) * 0.16
      effect.position(projectile.to)
      effect.rotation(elapsed * 0.16)
      effect.opacity(fade)
      haloRef.current?.radius(radius * (0.98 + Math.sin(elapsed * 0.035) * 0.08))
      haloRef.current?.opacity(0.42 + crackle * 0.25)
      flashRef.current?.radius(radius * (0.34 + (1 - raw) * 0.16))
      flashRef.current?.opacity(Math.max(0, (1 - raw * 1.7) * 0.72))
      boltRefs.current.forEach((bolt, index) => {
        if (!bolt) return
        const phase = elapsed * (0.01 + index * 0.0007) + index * 1.9
        const inner = radius * (0.72 + Math.sin(phase * 1.7) * 0.08)
        const outer = radius * (1.22 + Math.cos(phase) * 0.12)
        const sweep = Math.sin(phase * 2.3) * radius * 0.22
        bolt.points([
          inner, 0,
          radius * 0.92, sweep,
          radius * 1.04, -sweep * 0.55,
          outer, 0,
        ])
        bolt.opacity(index % 2 === 0
          ? 0.68 + Math.sin(phase * 6) * 0.28
          : 0.54 + Math.cos(phase * 5) * 0.3)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group
      ref={effectRef}
      x={projectile.to.x}
      y={projectile.to.y}
      listening={false}
    >
      <Circle
        ref={flashRef}
        radius={radius * 0.5}
        fill="rgba(224,242,254,0.72)"
        shadowColor="#38bdf8"
        shadowBlur={radius * 0.9}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={haloRef}
        radius={radius}
        stroke="rgba(125,211,252,0.9)"
        strokeWidth={3}
        dash={[radius * 0.26, radius * 0.12]}
        shadowColor="#0ea5e9"
        shadowBlur={14}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: 11 }, (_, index) => (
        <Line
          key={index}
          ref={(node) => { boltRefs.current[index] = node }}
          points={[radius * 0.72, 0, radius * 0.92, 5, radius * 1.04, -3, radius * 1.22, 0]}
          rotation={index * (360 / 11)}
          stroke={index % 3 === 0 ? '#f0f9ff' : index % 2 === 0 ? '#7dd3fc' : '#38bdf8'}
          strokeWidth={index % 3 === 0 ? 3.2 : 2.3}
          lineCap="round"
          lineJoin="round"
          shadowColor="#0284c7"
          shadowBlur={9}
          perfectDrawEnabled={false}
        />
      ))}
      <Circle
        radius={radius * 0.78}
        stroke="rgba(186,230,253,0.62)"
        strokeWidth={1.5}
        dash={[3, 7]}
        shadowColor="#38bdf8"
        shadowBlur={8}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

export function SpectralSkeletalHand({ radius }: { radius: number }) {
  const scale = Math.max(0.55, radius / 31)
  const fingers = [
    { rotation: -47, points: [-6, -8, -14, -20, -16, -31] },
    { rotation: -23, points: [-3, -10, -7, -27, -6, -40] },
    { rotation: 0, points: [0, -11, 0, -30, 2, -44] },
    { rotation: 22, points: [4, -9, 8, -26, 11, -37] },
    { rotation: 49, points: [7, -5, 16, -16, 20, -26] },
  ]
  return (
    <Group scaleX={scale} scaleY={scale} rotation={-18}>
      <Circle
        radius={19}
        fill="rgba(15,23,42,0.44)"
        shadowColor="#67e8f9"
        shadowBlur={18}
        perfectDrawEnabled={false}
      />
      <Line
        points={[-12, 8, -10, -8, -5, -15, 5, -15, 11, -7, 12, 9, 6, 18, -5, 18]}
        closed
        fill="rgba(207,250,254,0.34)"
        stroke="#a5f3fc"
        strokeWidth={2.6}
        lineJoin="round"
        shadowColor="#22d3ee"
        shadowBlur={10}
        perfectDrawEnabled={false}
      />
      <Line
        points={[-7, 8, -3, 14, 0, 23, 4, 14, 8, 8]}
        stroke="#cffafe"
        strokeWidth={3.2}
        lineCap="round"
        lineJoin="round"
        shadowColor="#06b6d4"
        shadowBlur={7}
        perfectDrawEnabled={false}
      />
      {fingers.map((finger, index) => (
        <Group key={index} rotation={finger.rotation * 0.12}>
          <Line
            points={finger.points}
            stroke={index % 2 === 0 ? '#ecfeff' : '#a5f3fc'}
            strokeWidth={index === 2 ? 3.2 : 2.7}
            lineCap="round"
            lineJoin="round"
            shadowColor="#22d3ee"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
          <Circle
            x={finger.points[2]}
            y={finger.points[3]}
            radius={2.3}
            fill="#cffafe"
            shadowColor="#06b6d4"
            shadowBlur={5}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
      <Circle
        radius={5}
        fill="rgba(8,47,73,0.7)"
        stroke="#67e8f9"
        strokeWidth={1.5}
        shadowColor="#22d3ee"
        shadowBlur={9}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

export function ChillTouchPersistentMark(input: { x: number; y: number; radius: number }) {
  const handImage = useTokenBadgeImage('/assets/vfx/chill-touch-hand.png')
  return (
    <Group
      x={input.x + input.radius * 0.18}
      y={input.y + input.radius * 0.12}
      opacity={0.88}
      listening={false}
    >
      <Circle
        radius={input.radius * 0.94}
        stroke="rgba(103,232,249,0.36)"
        strokeWidth={2}
        dash={[4, 8]}
        shadowColor="#0891b2"
        shadowBlur={10}
        perfectDrawEnabled={false}
      />
      {handImage ? (
        <KonvaImage
          image={handImage}
          x={-input.radius}
          y={-input.radius * 1.12}
          width={input.radius * 2}
          height={input.radius * 2}
          shadowColor="#22d3ee"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
      ) : <SpectralSkeletalHand radius={input.radius} />}
    </Group>
  )
}

export function ChillTouchManifestation({ projectile }: { projectile: MapProjectile }) {
  const manifestationRef = useRef<Konva.Group>(null)
  const ringRef = useRef<Konva.Circle>(null)
  const handImage = useTokenBadgeImage('/assets/vfx/chill-touch-hand.png')
  const radius = Math.max(18, projectile.radiusPx ?? 29)

  useEffect(() => {
    const manifestation = manifestationRef.current
    const layer = manifestation?.getLayer()
    if (!manifestation || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.7), 3)
      manifestation.position({
        x: projectile.to.x + radius * 0.18,
        y: projectile.to.y - radius * (0.9 - arrival * 1.02),
      })
      manifestation.scale({
        x: 0.28 + arrival * 0.72,
        y: 0.28 + arrival * 0.72,
      })
      manifestation.opacity(raw < 0.14 ? raw / 0.14 : Math.max(0, (1 - raw) / 0.18))
      manifestation.rotation(-12 + Math.sin(elapsed * 0.025) * 7 * (1 - arrival))
      ringRef.current?.radius(radius * (0.3 + arrival * 0.82))
      ringRef.current?.opacity(Math.max(0, 0.85 - raw * 0.7))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  if (handImage) {
    return (
      <TargetTextureManifestation
        projectile={projectile}
        image={handImage}
        width={radius * 2.45}
        height={radius * 2.45}
        y={-radius * 0.28}
        descend={radius * 1.2}
        shadowColor="#22d3ee"
      />
    )
  }
  return (
    <Group
      ref={manifestationRef}
      x={projectile.to.x}
      y={projectile.to.y - radius * 0.9}
      listening={false}
    >
      <Circle
        ref={ringRef}
        radius={radius * 0.3}
        stroke="#67e8f9"
        strokeWidth={3}
        dash={[5, 7]}
        shadowColor="#06b6d4"
        shadowBlur={20}
        perfectDrawEnabled={false}
      />
      <Circle
        radius={radius * 0.66}
        fill="rgba(8,47,73,0.28)"
        shadowColor="#22d3ee"
        shadowBlur={radius}
        perfectDrawEnabled={false}
      />
      <SpectralSkeletalHand radius={radius} />
      {[-72, -25, 18, 63, 112, 158, 205].map((rotation, index) => (
        <Line
          key={rotation}
          points={[radius * 0.54, 0, radius * (0.78 + (index % 2) * 0.18), 0]}
          rotation={rotation}
          stroke={index % 2 === 0 ? '#cffafe' : '#22d3ee'}
          strokeWidth={2}
          lineCap="round"
          shadowColor="#06b6d4"
          shadowBlur={7}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

export function ProduceFlameProjectile({ projectile }: { projectile: MapProjectile }) {
  const orbRef = useRef<Konva.Group>(null)
  const shellRef = useRef<Konva.Circle>(null)
  const coreRef = useRef<Konva.Circle>(null)
  const blobRefs = useRef<Array<Konva.Circle | null>>([])
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const fireImage = useTokenBadgeImage('/assets/vfx/fire-projectile-fluid.png')
  const explosionImage = useTokenBadgeImage('/assets/vfx/fireball-explosion-fluid.png')

  useEffect(() => {
    const orb = orbRef.current
    const layer = orb?.getLayer()
    if (!orb || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const duration = Math.max(1, projectile.durationMs ?? 1_100)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const arcHeight = Math.max(18, Math.min(42, distance * 0.16))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const chargeEnd = 0.22
      const travelEnd = 0.72
      const travelRaw = Math.max(0, Math.min(1, (raw - chargeEnd) / (travelEnd - chargeEnd)))
      const travel = 1 - Math.pow(1 - travelRaw, 2.05)
      const arc = -Math.sin(travel * Math.PI) * arcHeight
      orb.position({
        x: projectile.from.x + dx * travel,
        y: projectile.from.y + dy * travel + arc,
      })
      const chargeScale = raw < chargeEnd
        ? 0.3 + (raw / chargeEnd) * 0.7
        : 1
      orb.scale({
        x: chargeScale * (1 + Math.sin(elapsed * 0.065) * 0.08),
        y: chargeScale * (1 + Math.cos(elapsed * 0.058) * 0.07),
      })
      orb.opacity(raw < 0.06 ? raw / 0.06 : raw < travelEnd ? 1 : 0)
      shellRef.current?.radius(13 + Math.sin(elapsed * 0.052) * 1.4)
      coreRef.current?.radius(6.5 + Math.cos(elapsed * 0.071) * 0.8)
      blobRefs.current.forEach((blob, index) => {
        if (!blob) return
        const angle = elapsed * (0.0028 + index * 0.00025) + index * 1.26
        const orbit = 7.5 + (index % 2) * 2.2
        blob.position({
          x: Math.cos(angle) * orbit,
          y: Math.sin(angle) * orbit,
        })
        blob.radius(4.8 + Math.sin(elapsed * 0.045 + index) * 1.1)
      })

      const impactRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
      const strength = 1
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, (1 - impactRaw) * strength))
        impactRef.current.scale({
          x: 0.28 + impactRaw * 1.8,
          y: 0.28 + impactRaw * 1.8,
        })
        impactRef.current.rotation(impactRaw * 35)
      }
      impactRingRef.current?.radius(9 + impactRaw * 22)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  if (fireImage) {
    return (
      <MovingFireTextureEffect
        projectile={projectile}
        fireImage={fireImage}
        explosionImage={explosionImage}
        spriteSize={78}
        impactDiameter={82}
        arcHeight={28}
      />
    )
  }
  return (
    <>
      <Group
        ref={orbRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Circle
          ref={shellRef}
          radius={13}
          fill="rgba(249,115,22,0.92)"
          stroke="#fdba74"
          strokeWidth={1.8}
          shadowColor="#ea580c"
          shadowBlur={24}
          perfectDrawEnabled={false}
        />
        {[0, 1, 2, 3, 4].map((index) => (
          <Circle
            key={index}
            ref={(node) => { blobRefs.current[index] = node }}
            x={Math.cos(index * 1.26) * 8}
            y={Math.sin(index * 1.26) * 8}
            radius={5}
            fill={index % 2 === 0 ? '#fb923c' : '#facc15'}
            opacity={0.78}
            shadowColor="#f97316"
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        ))}
        <Circle
          ref={coreRef}
          radius={6.5}
          fill="#fef3c7"
          stroke="#fde68a"
          strokeWidth={1.2}
          shadowColor="#facc15"
          shadowBlur={13}
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
        <Circle
          ref={impactRingRef}
          radius={9}
          stroke="#fde68a"
          strokeWidth={3.2}
          shadowColor="#f97316"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={12}
          fill="rgba(254,215,170,0.84)"
          shadowColor="#ea580c"
          shadowBlur={26}
          perfectDrawEnabled={false}
        />
        {[-70, -28, 14, 52, 93, 137, 181, 226].map((rotation, index) => (
          <Circle
            key={rotation}
            x={Math.cos(rotation * Math.PI / 180) * (19 + (index % 2) * 7)}
            y={Math.sin(rotation * Math.PI / 180) * (19 + (index % 2) * 7)}
            radius={3.5 + (index % 3)}
            fill={index % 2 === 0 ? '#fbbf24' : '#f97316'}
            shadowColor="#ef4444"
            shadowBlur={9}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </>
  )
}

export function EldritchBlastProjectile({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const auraRef = useRef<Konva.Line>(null)
  const beamRef = useRef<Konva.Line>(null)
  const coreRef = useRef<Konva.Line>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactCoreRef = useRef<Konva.Circle>(null)
  const fluidImage = useTokenBadgeImage('/assets/vfx/eldritch-blast-sprite-v2.png')

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const perpendicularX = -dy / distance
    const perpendicularY = dx / distance
    const duration = Math.max(1, projectile.durationMs ?? 900)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const hash = [...projectile.id].reduce(
      (value, character) => ((value * 31) + character.charCodeAt(0)) | 0,
      0,
    )
    const arcDirection = (hash & 1) === 0 ? 1 : -1
    const arcStrength = 4 + Math.abs(hash % 5)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const extension = 1 - Math.pow(1 - Math.min(1, raw / 0.3), 3.2)
      const opacity = raw < 0.07
        ? raw / 0.07
        : raw > 0.62
          ? Math.max(0, (1 - raw) / 0.38)
          : 1
      const points: number[] = [projectile.from.x, projectile.from.y]
      for (let step = 1; step <= 9; step += 1) {
        const fraction = extension * step / 9
        const envelope = Math.sin(fraction * Math.PI)
        const arc = envelope * arcStrength * arcDirection
        const crackle = Math.sin(elapsed * 0.055 + step * 2.65 + hash) * 3.8
        points.push(
          projectile.from.x + dx * fraction + perpendicularX * (arc + crackle),
          projectile.from.y + dy * fraction + perpendicularY * (arc + crackle),
        )
      }
      auraRef.current?.points(points)
      auraRef.current?.opacity(opacity * 0.72)
      beamRef.current?.points(points)
      beamRef.current?.opacity(opacity)
      coreRef.current?.points(points)
      coreRef.current?.opacity(opacity * (0.76 + Math.sin(elapsed * 0.09) * 0.2))

      const impactRaw = Math.max(0, Math.min(1, (raw - 0.22) / 0.78))
      const impactStrength = 1
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, (1 - impactRaw * 0.82) * impactStrength))
        impactRef.current.scale({
          x: 0.2 + impactRaw * 1.45,
          y: 0.2 + impactRaw * 1.45,
        })
        impactRef.current.rotation(hash % 90 + impactRaw * 105 * arcDirection)
      }
      impactCoreRef.current?.radius(11 + Math.sin(elapsed * 0.08) * 3)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  if (fluidImage) {
    return (
      <DirectionalSpriteAtlasEffect
        projectile={projectile}
        image={fluidImage}
        heightRatio={0.31}
        minHeight={72}
        maxHeight={142}
        shadowColor="#a855f7"
        particleColor="#a855f7"
        particleHighlight="#f3e8ff"
      />
    )
  }
  return (
    <Group ref={effectRef} listening={false}>
      <Line
        ref={auraRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="rgba(126,34,206,0.68)"
        strokeWidth={18}
        lineCap="round"
        lineJoin="round"
        shadowColor="#7e22ce"
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <Line
        ref={beamRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#a855f7"
        strokeWidth={7}
        lineCap="round"
        lineJoin="round"
        shadowColor="#c026d3"
        shadowBlur={13}
        perfectDrawEnabled={false}
      />
      <Line
        ref={coreRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#f3e8ff"
        strokeWidth={2.4}
        lineCap="round"
        lineJoin="round"
        shadowColor="#e879f9"
        shadowBlur={7}
        perfectDrawEnabled={false}
      />
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={impactCoreRef}
          radius={11}
          fill="rgba(216,180,254,0.82)"
          shadowColor="#9333ea"
          shadowBlur={26}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={18}
          stroke="#c084fc"
          strokeWidth={3}
          dash={[3, 5]}
          shadowColor="#7e22ce"
          shadowBlur={14}
          perfectDrawEnabled={false}
        />
        {[-78, -37, 5, 43, 81, 126, 171, 218].map((rotation, index) => (
          <Line
            key={rotation}
            points={[8, 0, 18 + (index % 3) * 5, index % 2 === 0 ? -3 : 3, 27 + (index % 2) * 5, 0]}
            rotation={rotation}
            stroke={index % 2 === 0 ? '#e9d5ff' : '#a855f7'}
            strokeWidth={2.6}
            lineCap="round"
            lineJoin="round"
            shadowColor="#9333ea"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

export function RayOfFrostProjectile({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const glowRef = useRef<Konva.Line>(null)
  const coreRef = useRef<Konva.Line>(null)
  const filamentRef = useRef<Konva.Line>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const fluidImage = useTokenBadgeImage('/assets/vfx/ray-of-frost-sprite-v2.png')

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const perpendicularX = -dy / distance
    const perpendicularY = dx / distance
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const extension = 1 - Math.pow(1 - Math.min(1, raw / 0.34), 3)
      const beamOpacity = raw < 0.1
        ? raw / 0.1
        : raw > 0.68
          ? Math.max(0, (1 - raw) / 0.32)
          : 1
      const endX = projectile.from.x + dx * extension
      const endY = projectile.from.y + dy * extension
      const straightPoints = [projectile.from.x, projectile.from.y, endX, endY]
      glowRef.current?.points(straightPoints)
      glowRef.current?.opacity(beamOpacity * 0.72)
      coreRef.current?.points(straightPoints)
      coreRef.current?.opacity(beamOpacity)

      const filamentPoints: number[] = [projectile.from.x, projectile.from.y]
      for (let step = 1; step <= 7; step += 1) {
        const fraction = extension * step / 7
        const wave = Math.sin(elapsed * 0.045 + step * 1.8) * 3.2
        filamentPoints.push(
          projectile.from.x + dx * fraction + perpendicularX * wave,
          projectile.from.y + dy * fraction + perpendicularY * wave,
        )
      }
      filamentRef.current?.points(filamentPoints)
      filamentRef.current?.opacity(beamOpacity * 0.86)

      const impactRaw = Math.max(0, Math.min(1, (raw - 0.26) / 0.74))
      const impactStrength = 1
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, (1 - impactRaw * 0.78) * impactStrength))
        impactRef.current.scale({
          x: 0.35 + impactRaw * 1.05,
          y: 0.35 + impactRaw * 1.05,
        })
        impactRef.current.rotation(impactRaw * 55)
      }
      impactRingRef.current?.radius(7 + impactRaw * 19)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  if (fluidImage) {
    return (
      <DirectionalSpriteAtlasEffect
        projectile={projectile}
        image={fluidImage}
        heightRatio={0.3}
        minHeight={70}
        maxHeight={138}
        shadowColor="#38bdf8"
        particleColor="#7dd3fc"
        particleHighlight="#ffffff"
      />
    )
  }
  return (
    <Group ref={effectRef} listening={false}>
      <Line
        ref={glowRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="rgba(56,189,248,0.72)"
        strokeWidth={15}
        lineCap="round"
        lineJoin="round"
        shadowColor="#0ea5e9"
        shadowBlur={22}
        perfectDrawEnabled={false}
      />
      <Line
        ref={coreRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#e0f2fe"
        strokeWidth={5.5}
        lineCap="round"
        lineJoin="round"
        shadowColor="#7dd3fc"
        shadowBlur={10}
        perfectDrawEnabled={false}
      />
      <Line
        ref={filamentRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#ffffff"
        strokeWidth={1.8}
        lineCap="round"
        lineJoin="round"
        shadowColor="#bae6fd"
        shadowBlur={6}
        perfectDrawEnabled={false}
      />
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={impactRingRef}
          radius={7}
          stroke="#e0f2fe"
          strokeWidth={3}
          dash={[4, 5]}
          shadowColor="#0ea5e9"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={10}
          fill="rgba(224,242,254,0.56)"
          shadowColor="#38bdf8"
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
        {[0, 60, 120, 180, 240, 300].map((rotation) => (
          <Group key={rotation} rotation={rotation}>
            <Line
              points={[7, 0, 25, 0]}
              stroke="#bae6fd"
              strokeWidth={2.6}
              lineCap="round"
              shadowColor="#38bdf8"
              shadowBlur={7}
              perfectDrawEnabled={false}
            />
            <Line
              points={[17, 0, 12, -5, 17, 0, 12, 5]}
              stroke="#e0f2fe"
              strokeWidth={1.7}
              lineCap="round"
              lineJoin="round"
              perfectDrawEnabled={false}
            />
          </Group>
        ))}
      </Group>
    </Group>
  )
}

export function FireBoltProjectile({ projectile }: { projectile: MapProjectile }) {
  const projectileRef = useRef<Konva.Group>(null)
  const outerFlameRef = useRef<Konva.Circle>(null)
  const innerFlameRef = useRef<Konva.Circle>(null)
  const tailRef = useRef<Konva.Line>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const impactCoreRef = useRef<Konva.Circle>(null)
  const fireImage = useTokenBadgeImage('/assets/vfx/fire-projectile-fluid.png')
  const explosionImage = useTokenBadgeImage('/assets/vfx/fireball-explosion-fluid.png')

  useEffect(() => {
    const group = projectileRef.current
    const layer = group?.getLayer()
    if (!group || !layer) return
    const outerFlame = outerFlameRef.current
    const innerFlame = innerFlameRef.current
    const tail = tailRef.current
    const impact = impactRef.current
    const impactRing = impactRingRef.current
    const impactCore = impactCoreRef.current
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const duration = Math.max(400, projectile.durationMs ?? 980)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    group.rotation((Math.atan2(dy, dx) * 180) / Math.PI)
    impact?.position(projectile.to)
    const anim = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const chargeEnd = 0.13
      const travelEnd = 0.76
      const travelRaw = Math.max(0, Math.min(1, (raw - chargeEnd) / (travelEnd - chargeEnd)))
      const travel = 1 - Math.pow(1 - travelRaw, 2.15)
      const pulse = 1 + Math.sin(elapsed * 0.045) * 0.14
      const wobble = Math.sin(travelRaw * Math.PI * 5) * 2.2 * (1 - travelRaw)
      group.x(projectile.from.x + dx * travel - (dy / distance) * wobble)
      group.y(projectile.from.y + dy * travel + (dx / distance) * wobble)
      group.scale({ x: pulse, y: pulse })
      group.opacity(raw < chargeEnd ? Math.max(0.25, raw / chargeEnd) : raw < travelEnd ? 1 : 0)
      outerFlame?.radius(8.5 + Math.sin(elapsed * 0.06) * 1.5)
      innerFlame?.radius(4.2 + Math.sin(elapsed * 0.075 + 1) * 0.8)
      if (tail) {
        const tailLength = 26 + Math.sin(elapsed * 0.055) * 5
        tail.points([-tailLength, 0, -7, 0])
        tail.opacity(0.65 + Math.sin(elapsed * 0.04) * 0.16)
      }

      if (impact) {
        const impactRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
        const strength = 1
        impact.visible(impactRaw > 0)
        impact.opacity(Math.max(0, (1 - impactRaw) * strength))
        impact.scale({ x: 0.35 + impactRaw * 1.8, y: 0.35 + impactRaw * 1.8 })
        impactRing?.radius(8 + impactRaw * 17)
        impactCore?.radius(10 - impactRaw * 4)
      }
      if (raw >= 1) anim.stop()
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [projectile])

  if (fireImage) {
    return (
      <MovingFireTextureEffect
        projectile={projectile}
        fireImage={fireImage}
        explosionImage={explosionImage}
        spriteSize={70}
        impactDiameter={72}
      />
    )
  }
  return (
    <>
      <Group
        ref={projectileRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Line
          ref={tailRef}
          points={[-30, 0, -7, 0]}
          stroke="rgba(239,68,68,0.64)"
          strokeWidth={13}
          lineCap="round"
          shadowColor="#dc2626"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-22, 0, -4, 0]}
          stroke="rgba(251,146,60,0.92)"
          strokeWidth={7}
          lineCap="round"
          shadowColor="#f97316"
          shadowBlur={10}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={outerFlameRef}
          radius={9}
          fill="#f97316"
          stroke="rgba(254,215,170,0.9)"
          strokeWidth={1.2}
          shadowColor="#ef4444"
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={innerFlameRef}
          radius={4.5}
          fill="#fef3c7"
          shadowColor="#facc15"
          shadowBlur={12}
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
        <Circle
          ref={impactRingRef}
          radius={8}
          stroke="#fde68a"
          strokeWidth={3}
          shadowColor="#ef4444"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={impactCoreRef}
          radius={10}
          fill="rgba(254,215,170,0.88)"
          shadowColor="#f97316"
          shadowBlur={24}
          perfectDrawEnabled={false}
        />
        {[-42, -12, 18, 48, 78, 132, 168, 210].map((rotation, index) => (
          <Line
            key={rotation}
            points={[7, 0, 18 + (index % 3) * 4, 0]}
            rotation={rotation}
            stroke={index % 2 === 0 ? '#fbbf24' : '#fb7185'}
            strokeWidth={2.5}
            lineCap="round"
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </>
  )
}
