import { useEffect, useMemo, useRef } from 'react'
import { Circle, Group, Image as KonvaImage, Line } from 'react-konva'
import Konva from 'konva'
import { THUNDERWAVE_ANIMATION_DURATION_MS } from '../../lib/combatPresentation'
import WallOfFireRingVisual from './WallOfFireRingVisual'
import { areaSeed, nextAreaRandom } from './deterministicAreaRandom'
import { FLAMING_SPHERE_VISUAL_DIAMETER_GRID_FACTOR } from './flamingSphereHandoff'
import { usePrefersReducedMotion, useTokenBadgeImage } from './mapEffectHooks'
import type { MapProjectile } from './mapCanvasContracts'
import { DirectionalSpriteAtlasEffect, DirectionalTextureEffect, MovingFireTextureEffect, TargetSpriteAtlasEffect } from './MapEffectPrimitives'
interface BurningHandsSparkSpec {
  start: number
  speed: number
  vertical: number
  drift: number
  radius: number
  warm: boolean
}
interface BurningHandsSmokeSpec {
  start: number
  x: number
  y: number
  drift: number
  radius: number
}
export function MagicMissileProjectile({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const missileRef = useRef<Konva.Group>(null)
  const trailGlowRef = useRef<Konva.Line>(null)
  const trailRef = useRef<Konva.Line>(null)
  const spiralTrailRefs = useRef<Array<Konva.Line | null>>([])
  const launchRef = useRef<Konva.Circle>(null)
  const launchSigilRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const impactSigilRef = useRef<Konva.Group>(null)
  const ribbonRefs = useRef<Array<Konva.Line | null>>([])
  const auraRefs = useRef<Array<Konva.Circle | null>>([])
  const wispRefs = useRef<Array<Konva.Circle | null>>([])
  const sparkRefs = useRef<Array<Konva.Circle | null>>([])
  const image = useTokenBadgeImage('/assets/vfx/magic-missile-fluid.png')
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const sequenceMatch = projectile.id.match(/:(\d+)$/)
  const sequenceIndex = sequenceMatch ? Number(sequenceMatch[1]) : 0
  const curveDirection = sequenceIndex % 2 === 0 ? -1 : 1
  const curveStrength = Math.min(
    54,
    Math.max(18, distance * (0.09 + (sequenceIndex % 3) * 0.022)),
  ) * curveDirection
  const normalX = -dy / distance
  const normalY = dx / distance
  const control = {
    x: (projectile.from.x + projectile.to.x) / 2 + normalX * curveStrength,
    y: (projectile.from.y + projectile.to.y) / 2 + normalY * curveStrength,
  }
  const missileWidth = Math.min(44, Math.max(30, distance * 0.105))
  const missileHeight = missileWidth * 0.56

  useEffect(() => {
    const effect = effectRef.current
    const missile = missileRef.current
    const trailGlow = trailGlowRef.current
    const trail = trailRef.current
    const launch = launchRef.current
    const launchSigil = launchSigilRef.current
    const impact = impactRef.current
    const impactRing = impactRingRef.current
    const impactSigil = impactSigilRef.current
    const layer = effect?.getLayer()
    if (
      !effect || !missile || !trailGlow || !trail || !launch || !launchSigil ||
      !impact || !impactRing || !impactSigil || !image || !layer
    ) return
    const duration = Math.max(1, projectile.durationMs ?? 300)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const pointAt = (time: number) => {
      const inverse = 1 - time
      return {
        x: inverse * inverse * projectile.from.x +
          2 * inverse * time * control.x +
          time * time * projectile.to.x,
        y: inverse * inverse * projectile.from.y +
          2 * inverse * time * control.y +
          time * time * projectile.to.y,
      }
    }
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const travelRaw = Math.min(1, raw / 0.72)
      const travel = 1 - Math.pow(1 - travelRaw, 2.15)
      const impactRaw = Math.max(0, Math.min(1, (raw - 0.66) / 0.24))
      const point = pointAt(travel)
      const tangentTime = Math.min(1, travel + 0.018)
      const tangent = pointAt(tangentTime)
      missile.position(point)
      missile.rotation(Math.atan2(tangent.y - point.y, tangent.x - point.x) * 180 / Math.PI)
      missile.scale({
        x: 0.82 + Math.sin(elapsed * 0.035) * 0.08,
        y: 0.88 + Math.cos(elapsed * 0.031) * 0.07,
      })
      missile.opacity((raw < 0.045 ? raw / 0.045 : 1) * (1 - impactRaw))

      const trailStart = Math.max(0, travel - 0.115)
      const trailPoints: number[] = []
      for (let index = 0; index < 9; index += 1) {
        const sample = pointAt(trailStart + (travel - trailStart) * index / 8)
        trailPoints.push(sample.x, sample.y)
      }
      trailGlow.points(trailPoints)
      trailGlow.opacity(Math.min(0.5, travelRaw * 2.4) * (1 - impactRaw))
      trail.points(trailPoints)
      trail.opacity(Math.min(0.9, travelRaw * 3.5) * (1 - impactRaw * 0.72))
      trail.dashOffset(-elapsed * 0.17)
      spiralTrailRefs.current.forEach((spiral, spiralIndex) => {
        if (!spiral) return
        const spiralPoints: number[] = []
        for (let index = 0; index < 13; index += 1) {
          const sampleTime = trailStart + (travel - trailStart) * index / 12
          const sample = pointAt(sampleTime)
          const next = pointAt(Math.min(1, sampleTime + 0.012))
          const tangentLength = Math.max(0.001, Math.hypot(next.x - sample.x, next.y - sample.y))
          const sampleNormal = {
            x: -(next.y - sample.y) / tangentLength,
            y: (next.x - sample.x) / tangentLength,
          }
          const phase = elapsed * 0.055 + index * 0.92 + spiralIndex * Math.PI
          const orbit = Math.sin(phase) * missileHeight * 0.34
          spiralPoints.push(
            sample.x + sampleNormal.x * orbit,
            sample.y + sampleNormal.y * orbit,
          )
        }
        spiral.points(spiralPoints)
        spiral.opacity(Math.min(0.76, travelRaw * 2.8) * (1 - impactRaw))
        spiral.dashOffset((spiralIndex === 0 ? -1 : 1) * elapsed * 0.09)
      })
      launch.radius(missileWidth * (0.14 + travelRaw * 0.36))
      launch.opacity(Math.max(0, 1 - travelRaw * 1.5) * 0.88)
      launchSigil.rotation(sequenceIndex * 29 + elapsed * 0.32)
      launchSigil.scale({
        x: 0.72 + travelRaw * 0.5,
        y: 0.72 + travelRaw * 0.5,
      })
      launchSigil.opacity(Math.max(0, 1 - travelRaw * 1.7) * 0.82)

      ribbonRefs.current.forEach((ribbon, index) => {
        if (!ribbon) return
        const phase = elapsed * (0.058 + index * 0.004) + index * Math.PI / 2
        const spread = 0.24 + index * 0.035
        ribbon.points([
          -missileWidth * 0.42, Math.sin(phase) * missileHeight * spread,
          -missileWidth * 0.18, Math.sin(phase + 1.25) * missileHeight * (spread + 0.13),
          missileWidth * 0.08, Math.sin(phase + 2.5) * missileHeight * (spread + 0.08),
          missileWidth * 0.34, Math.sin(phase + 3.75) * missileHeight * 0.18,
        ])
        ribbon.opacity((0.7 - index * 0.065) * (1 - impactRaw))
      })
      auraRefs.current.forEach((aura, index) => {
        if (!aura) return
        const phase = elapsed * (0.045 + index * 0.002) + index * 1.47
        aura.position({
          x: -missileWidth * 0.05 + Math.cos(phase) * missileWidth * (0.24 + (index % 2) * 0.06),
          y: Math.sin(phase) * missileHeight * (0.4 + (index % 3) * 0.08),
        })
        aura.radius(Math.max(0.8, missileHeight * (0.045 + (index % 2) * 0.02)))
        aura.opacity((0.48 + Math.sin(phase) * 0.28) * (1 - impactRaw))
      })
      wispRefs.current.forEach((wisp, index) => {
        if (!wisp) return
        const lag = 0.012 + index * 0.009
        const sampleTime = Math.max(0, travel - lag)
        const sample = pointAt(sampleTime)
        const next = pointAt(Math.min(1, sampleTime + 0.012))
        const tangentLength = Math.max(0.001, Math.hypot(next.x - sample.x, next.y - sample.y))
        const sampleNormal = {
          x: -(next.y - sample.y) / tangentLength,
          y: (next.x - sample.x) / tangentLength,
        }
        const phase = elapsed * 0.052 + index * 1.26
        const orbit = Math.sin(phase) * missileHeight * (0.44 + (index % 3) * 0.15)
        wisp.position({
          x: sample.x + sampleNormal.x * orbit,
          y: sample.y + sampleNormal.y * orbit,
        })
        wisp.radius(Math.max(0.75, missileHeight * (0.035 + (index % 3) * 0.014)))
        wisp.opacity(
          Math.max(0, Math.min(1, travelRaw * 5 - index * 0.08)) *
          (0.42 + Math.cos(phase) * 0.28) *
          (1 - impactRaw),
        )
      })

      impact.opacity(Math.sin(impactRaw * Math.PI) * 0.95)
      impactRing.radius(missileWidth * (0.15 + impactRaw * 0.68))
      impactRing.opacity((1 - impactRaw) * 0.86)
      impactSigil.rotation(elapsed * -0.38 + sequenceIndex * 17)
      impactSigil.scale({
        x: 0.42 + impactRaw * 0.76,
        y: 0.42 + impactRaw * 0.76,
      })
      impactSigil.opacity(Math.sin(impactRaw * Math.PI) * 0.78)
      sparkRefs.current.forEach((spark, index) => {
        if (!spark) return
        const angle = index * Math.PI / 3 + sequenceIndex * 0.31
        const spread = missileWidth * impactRaw * (0.46 + (index % 2) * 0.22)
        spark.position({
          x: Math.cos(angle) * spread,
          y: Math.sin(angle) * spread,
        })
        spark.opacity(Math.sin(impactRaw * Math.PI) * 0.9)
      })
      effect.opacity(raw < 0.94 ? 1 : Math.max(0, (1 - raw) / 0.06))
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
    control.x,
    control.y,
    image,
    missileHeight,
    missileWidth,
    projectile.durationMs,
    projectile.from.x,
    projectile.from.y,
    projectile.issuedAt,
    projectile.to.x,
    projectile.to.y,
    sequenceIndex,
  ])

  return (
    <Group ref={effectRef} listening={false}>
      <Circle
        ref={launchRef}
        x={projectile.from.x}
        y={projectile.from.y}
        radius={missileWidth * 0.14}
        stroke="#ede9fe"
        strokeWidth={Math.max(1.2, missileHeight * 0.08)}
        shadowColor="#8b5cf6"
        shadowBlur={15}
        perfectDrawEnabled={false}
        listening={false}
      />
      <Group
        ref={launchSigilRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Circle
          radius={missileWidth * 0.42}
          stroke="#67e8f9"
          strokeWidth={Math.max(0.8, missileHeight * 0.045)}
          dash={[missileWidth * 0.12, missileWidth * 0.08]}
          shadowColor="#8b5cf6"
          shadowBlur={10}
          perfectDrawEnabled={false}
        />
        <Line
          points={[
            0, -missileWidth * 0.32,
            missileWidth * 0.25, 0,
            0, missileWidth * 0.32,
            -missileWidth * 0.25, 0,
          ]}
          closed
          stroke="#c4b5fd"
          strokeWidth={Math.max(0.7, missileHeight * 0.04)}
          perfectDrawEnabled={false}
        />
      </Group>
      <Line
        ref={trailGlowRef}
        points={[projectile.from.x, projectile.from.y]}
        stroke="#38bdf8"
        strokeWidth={Math.max(5, missileHeight * 0.38)}
        lineCap="round"
        lineJoin="round"
        tension={0.46}
        shadowColor="#c084fc"
        shadowBlur={20}
        opacity={0}
        perfectDrawEnabled={false}
        listening={false}
      />
      <Line
        ref={trailRef}
        points={[projectile.from.x, projectile.from.y]}
        stroke="#f0abfc"
        strokeWidth={Math.max(2.2, missileHeight * 0.15)}
        lineCap="round"
        lineJoin="round"
        tension={0.46}
        dash={[missileWidth * 0.28, missileWidth * 0.12]}
        shadowColor="#8b5cf6"
        shadowBlur={13}
        perfectDrawEnabled={false}
        listening={false}
      />
      {[0, 1].map((index) => (
        <Line
          key={`magic-missile-spiral-trail:${index}`}
          ref={(node) => { spiralTrailRefs.current[index] = node }}
          points={[projectile.from.x, projectile.from.y]}
          stroke={index === 0 ? '#67e8f9' : '#f0abfc'}
          strokeWidth={Math.max(0.9, missileHeight * 0.065)}
          lineCap="round"
          lineJoin="round"
          tension={0.5}
          dash={[missileWidth * 0.14, missileWidth * 0.09]}
          shadowColor={index === 0 ? '#22d3ee' : '#8b5cf6'}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <Circle
          key={`magic-missile-wisp:${index}`}
          ref={(node) => { wispRefs.current[index] = node }}
          radius={1}
          fill={index % 3 === 0 ? '#ffffff' : index % 3 === 1 ? '#67e8f9' : '#c4b5fd'}
          shadowColor={index % 2 === 0 ? '#8b5cf6' : '#22d3ee'}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      <Group ref={missileRef} listening={false}>
      {[0, 1, 2, 3].map((index) => (
        <Line
            key={`magic-missile-ribbon:${index}`}
            ref={(node) => { ribbonRefs.current[index] = node }}
            points={[-missileWidth * 0.42, 0, missileWidth * 0.34, 0]}
            stroke={['#67e8f9', '#f0abfc', '#fde68a', '#a5b4fc'][index]}
            strokeWidth={Math.max(0.8, missileHeight * (0.048 + (index % 2) * 0.012))}
            lineCap="round"
            lineJoin="round"
            tension={0.58}
            shadowColor={['#22d3ee', '#ec4899', '#f59e0b', '#8b5cf6'][index]}
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        ))}
        {image ? (
          <KonvaImage
            image={image}
            x={-missileWidth * 0.58}
            y={-missileHeight / 2}
            width={missileWidth}
            height={missileHeight}
            shadowColor="#a78bfa"
            shadowBlur={16}
            perfectDrawEnabled={false}
          />
        ) : null}
        <Line
          points={[
            missileWidth * 0.05, -missileHeight * 0.18,
            missileWidth * 0.48, 0,
            missileWidth * 0.05, missileHeight * 0.18,
            -missileWidth * 0.08, 0,
          ]}
          closed
          tension={0.18}
          fill="#ffffff"
          stroke="#ede9fe"
          strokeWidth={Math.max(0.8, missileHeight * 0.055)}
          lineJoin="round"
          shadowColor="#ddd6fe"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
        {Array.from({ length: 10 }, (_, index) => (
          <Circle
            key={`magic-missile-aura:${index}`}
            ref={(node) => { auraRefs.current[index] = node }}
            radius={1}
            fill={['#ffffff', '#67e8f9', '#f0abfc', '#fde68a', '#a5b4fc'][index % 5]}
            shadowColor={['#22d3ee', '#ec4899', '#f59e0b', '#8b5cf6'][index % 4]}
            shadowBlur={9}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
      <Group ref={impactRef} x={projectile.to.x} y={projectile.to.y} opacity={0} listening={false}>
        <Circle
          ref={impactRingRef}
          radius={missileWidth * 0.15}
          stroke="#ede9fe"
          strokeWidth={Math.max(1.4, missileHeight * 0.09)}
          shadowColor="#8b5cf6"
          shadowBlur={14}
          perfectDrawEnabled={false}
        />
        <Group ref={impactSigilRef} listening={false}>
          <Circle
            radius={missileWidth * 0.43}
            stroke="#67e8f9"
            strokeWidth={Math.max(0.8, missileHeight * 0.045)}
            dash={[missileWidth * 0.09, missileWidth * 0.07]}
            perfectDrawEnabled={false}
          />
          <Line
            points={[
              0, -missileWidth * 0.34,
              missileWidth * 0.24, 0,
              0, missileWidth * 0.34,
              -missileWidth * 0.24, 0,
            ]}
            closed
            stroke="#c4b5fd"
            strokeWidth={Math.max(0.8, missileHeight * 0.05)}
            shadowColor="#8b5cf6"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
        </Group>
        {Array.from({ length: 6 }, (_, index) => (
          <Circle
            key={`magic-missile-impact:${index}`}
            ref={(node) => { sparkRefs.current[index] = node }}
            radius={Math.max(1.1, missileHeight * (0.07 + (index % 2) * 0.025))}
            fill={index % 2 === 0 ? '#ffffff' : '#c4b5fd'}
            shadowColor="#8b5cf6"
            shadowBlur={7}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

export function MaterialSpellProjectile({ projectile }: { projectile: MapProjectile }) {
  const config: {
    asset: string
    heightRatio: number
    minHeight: number
    maxHeight: number
    revealEnd: number
    fadeStart: number
    shadowColor: string
    sprite?: boolean
    particleColor?: string
    particleHighlight?: string
  } = projectile.kind === 'scorching-ray'
      ? {
          asset: '/assets/vfx/scorching-ray-sprite-v2.png',
          heightRatio: 0.3,
          minHeight: 70,
          maxHeight: 132,
          revealEnd: 0.4,
          fadeStart: 0.7,
          shadowColor: '#f97316',
          sprite: true,
          particleColor: '#fb923c',
          particleHighlight: '#fff7c2',
        }
      : projectile.kind === 'guiding-bolt'
        ? {
            asset: '/assets/vfx/guiding-bolt-sprite-v2.png',
            heightRatio: 0.31,
            minHeight: 72,
            maxHeight: 136,
            revealEnd: 0.44,
            fadeStart: 0.72,
            shadowColor: '#facc15',
            sprite: true,
            particleColor: '#fde68a',
            particleHighlight: '#ffffff',
          }
        : projectile.kind === 'healing-word'
          ? {
              asset: '/assets/vfx/healing-word-sprite-v2.png',
              heightRatio: 0.26,
              minHeight: 62,
              maxHeight: 116,
              revealEnd: 0.46,
              fadeStart: 0.72,
              shadowColor: '#fde68a',
              sprite: true,
              particleColor: '#86efac',
              particleHighlight: '#fef3c7',
            }
          : projectile.kind === 'inflict-wounds'
            ? {
                asset: '/assets/vfx/inflict-wounds-sprite-v2.png',
                heightRatio: 0.34,
                minHeight: 76,
                maxHeight: 144,
                revealEnd: 0.42,
                fadeStart: 0.7,
                shadowColor: '#7c3aed',
                sprite: true,
                particleColor: '#6d28d9',
                particleHighlight: '#c4b5fd',
              }
            : projectile.kind === 'chain-lightning'
              ? {
                  asset: '/assets/vfx/chain-lightning-sprite-v2.png',
                  heightRatio: 0.28,
                  minHeight: 68,
                  maxHeight: 126,
                  revealEnd: 0.38,
                  fadeStart: 0.72,
                  shadowColor: '#38bdf8',
                  sprite: true,
                  particleColor: '#60a5fa',
                  particleHighlight: '#ffffff',
                }
              : projectile.kind === 'disintegrate'
                ? {
                    asset: '/assets/vfx/disintegrate-sprite-v2.png',
                    heightRatio: 0.31,
                    minHeight: 72,
                    maxHeight: 138,
                    revealEnd: 0.4,
                    fadeStart: 0.72,
                    shadowColor: '#4ade80',
                    sprite: true,
                    particleColor: '#22c55e',
                    particleHighlight: '#ecfccb',
                  }
                : {
            asset: '/assets/vfx/acid-arrow-sprite-v2.png',
            heightRatio: 0.3,
            minHeight: 70,
            maxHeight: 134,
            revealEnd: 0.45,
            fadeStart: 0.7,
            shadowColor: '#84cc16',
            sprite: true,
            particleColor: '#a3e635',
            particleHighlight: '#f7fee7',
                  }
  const image = useTokenBadgeImage(config.asset)
  if (!image) return null
  if (config.sprite) {
    return (
      <DirectionalSpriteAtlasEffect
        projectile={projectile}
        image={image}
        heightRatio={config.heightRatio}
        minHeight={config.minHeight}
        maxHeight={config.maxHeight}
        shadowColor={config.shadowColor}
        particleColor={config.particleColor ?? config.shadowColor}
        particleHighlight={config.particleHighlight ?? '#ffffff'}
      />
    )
  }
  return (
    <DirectionalTextureEffect
      projectile={projectile}
      image={image}
      heightRatio={config.heightRatio}
      minHeight={config.minHeight}
      maxHeight={config.maxHeight}
      revealEnd={config.revealEnd}
      fadeStart={config.fadeStart}
      shadowColor={config.shadowColor}
    />
  )
}

export function MaterialTargetSpellEffect({ projectile }: { projectile: MapProjectile }) {
  const materialKind = String(projectile.kind)
  const isCureWounds = projectile.kind === 'cure-wounds'
  const isBlight = projectile.kind === 'blight'
  const isFingerOfDeath = projectile.kind === 'finger-of-death'
  const isPowerWordStun = projectile.kind === 'power-word-stun'
  const isPowerWordKill = projectile.kind === 'power-word-kill'
  const isFalseLife = projectile.kind === 'false-life'
  const isHypnoticPattern = materialKind === 'hypnotic-pattern'
  const isSlow = materialKind === 'slow'
  const isPhantasmalKiller = materialKind === 'phantasmal-killer'
  const isBanishment = materialKind === 'banishment'
  const isMistyStep = materialKind === 'misty-step'
  const isHoldMonster = materialKind === 'hold-monster'
  const isCounterspell = materialKind === 'counterspell'
  const isDispelMagic = materialKind === 'dispel-magic'
  const isShield = materialKind === 'shield'
  const isLesserRestoration = materialKind === 'lesser-restoration'
  const image = useTokenBadgeImage(
    isCureWounds
      ? '/assets/vfx/cure-wounds-sprite-v2.png'
      : isBlight
        ? '/assets/vfx/blight-sprite-v2.png'
        : isFingerOfDeath
          ? '/assets/vfx/finger-of-death-sprite-v2.png'
          : isPowerWordStun
            ? '/assets/vfx/power-word-stun-sprite-v2.png'
            : isPowerWordKill
              ? '/assets/vfx/power-word-kill-sprite-v2.png'
              : isFalseLife
                ? '/assets/vfx/false-life-sprite-v2.png'
              : isHypnoticPattern
                ? '/assets/vfx/hypnotic-pattern-sprite-v2.png'
              : isSlow
                ? '/assets/vfx/slow-sprite-v2.png'
              : isPhantasmalKiller
                ? '/assets/vfx/phantasmal-killer-sprite-v2.png'
              : isBanishment
                ? '/assets/vfx/banishment-sprite-v2.png'
              : isMistyStep
                ? '/assets/vfx/misty-step-sprite-v2.png'
              : isHoldMonster
                ? '/assets/vfx/hold-monster-sprite-v2.png'
              : isCounterspell
                ? '/assets/vfx/counterspell-sprite-v2.png'
              : isDispelMagic
                ? '/assets/vfx/dispel-magic-sprite-v2.png'
              : isShield
                ? '/assets/vfx/shield-sprite-v2.png'
              : isLesserRestoration
                ? '/assets/vfx/lesser-restoration-sprite-v2.png'
                : '/assets/vfx/hellish-rebuke-sprite-v2.png',
  )
  if (!image) return null
  const radius = Math.max(24, projectile.radiusPx ?? 42)
  if (isCureWounds) {
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * 3.15}
        shadowColor="#4ade80"
        particleColor="#86efac"
        particleHighlight="#fef3c7"
      />
    )
  }
  if (isBlight) {
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * 3.45}
        shadowColor="#581c87"
        particleColor="#a3e635"
        particleHighlight="#d9f99d"
      />
    )
  }
  if (isFingerOfDeath || isPowerWordStun || isPowerWordKill) {
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (isFingerOfDeath ? 4.2 : 3.65)}
        shadowColor={isFingerOfDeath ? '#65a30d' : isPowerWordStun ? '#a855f7' : '#dc2626'}
        particleColor={isFingerOfDeath ? '#a3e635' : isPowerWordStun ? '#f0abfc' : '#ef4444'}
        particleHighlight={isFingerOfDeath ? '#ecfccb' : '#ffffff'}
      />
    )
  }
  if (isFalseLife) {
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * 3.35}
        shadowColor="#7c3aed"
        particleColor="#a78bfa"
        particleHighlight="#e0e7ff"
      />
    )
  }
  if (
    isHypnoticPattern || isSlow || isPhantasmalKiller || isBanishment ||
    isMistyStep || isHoldMonster || isCounterspell || isDispelMagic ||
    isShield || isLesserRestoration
  ) {
    const palette = isHypnoticPattern
      ? ['#f0abfc', '#67e8f9', '#fef3c7']
      : isSlow
        ? ['#7c3aed', '#f59e0b', '#ddd6fe']
        : isPhantasmalKiller
          ? ['#312e81', '#8b5cf6', '#67e8f9']
        : isBanishment
          ? ['#312e81', '#f59e0b', '#fff7ed']
        : isMistyStep
          ? ['#6d28d9', '#67e8f9', '#ddd6fe']
        : isHoldMonster
          ? ['#7c3aed', '#f59e0b', '#fef3c7']
        : isCounterspell
          ? ['#4338ca', '#22d3ee', '#f0abfc']
        : isDispelMagic
          ? ['#6d28d9', '#fbbf24', '#bfdbfe']
        : isShield
          ? ['#0284c7', '#67e8f9', '#ffffff']
          : ['#0f766e', '#f59e0b', '#fef3c7']
    return <TargetSpriteAtlasEffect
      projectile={projectile}
      image={image}
      diameter={radius * (isPhantasmalKiller ? 4.1 : isShield ? 3.35 : 3.65)}
      shadowColor={palette[0]}
      particleColor={palette[1]}
      particleHighlight={palette[2]}
    />
  }
  return (
    <TargetSpriteAtlasEffect
      projectile={projectile}
      image={image}
      diameter={radius * 3.5}
      shadowColor="#ef4444"
      particleColor="#f97316"
      particleHighlight="#fef3c7"
    />
  )
}

export function ThunderwaveMaterialEffect({
  projectile,
  image,
  distance,
  areaWidth,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  distance: number
  areaWidth: number
}) {
  const effectRef = useRef<Konva.Group>(null)
  const trailRef = useRef<Konva.Group>(null)
  const frontRef = useRef<Konva.Group>(null)
  const bandRefs = useRef<Array<Konva.Group | null>>([])
  const debrisRefs = useRef<Array<Konva.Line | null>>([])

  useEffect(() => {
    const effect = effectRef.current
    const trail = trailRef.current
    const front = frontRef.current
    const layer = effect?.getLayer()
    if (!effect || !trail || !front || !layer) return
    const duration = Math.max(
      1,
      projectile.durationMs ?? THUNDERWAVE_ANIMATION_DURATION_MS,
    )
    const initialElapsed = Math.max(
      0,
      Date.now() - (projectile.issuedAt ?? Date.now()),
    )
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const travelRaw = Math.min(1, raw / 0.76)
      const travel = 1 - Math.pow(1 - travelRaw, 3)
      const frontX = distance * travel
      const fade = raw < 0.82 ? 1 : Math.max(0, (1 - raw) / 0.18)
      effect.opacity(fade)
      trail.clipWidth(Math.max(areaWidth * 0.08, frontX + areaWidth * 0.18))
      trail.opacity(0.26 + Math.sin(elapsed * 0.021) * 0.06)
      front.x(frontX)
      front.scaleX(0.78 + Math.sin(elapsed * 0.025) * 0.08)
      front.scaleY(0.94 + Math.sin(elapsed * 0.019) * 0.07)
      front.opacity(raw < 0.08 ? raw / 0.08 : fade)
      bandRefs.current.forEach((band, index) => {
        if (!band) return
        const delay = index * 0.075
        const bandRaw = Math.max(0, Math.min(1, (travelRaw - delay) / Math.max(0.01, 1 - delay)))
        band.x(distance * (1 - Math.pow(1 - bandRaw, 2.6)))
        band.opacity(Math.sin(bandRaw * Math.PI) * (0.58 - index * 0.09))
        band.scaleX(0.7 + bandRaw * 0.45)
      })
      debrisRefs.current.forEach((debris, index) => {
        if (!debris) return
        const lag = areaWidth * (0.2 + (index % 4) * 0.12)
        debris.x(Math.max(0, frontX - lag))
        debris.y(Math.sin(elapsed * (0.009 + index * 0.0017) + index) * areaWidth * 0.34)
        debris.rotation(-22 + index * 17 + raw * 160)
        debris.opacity(Math.min(0.9, travelRaw * 2.5) * fade)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    // Remote events can arrive halfway through their lifetime. Keep the
    // material fully visible before the first animation frame is requested.
    effect.opacity(1)
    layer.batchDraw()
    animation.start()
    return () => {
      animation.stop()
    }
  }, [areaWidth, distance, projectile.durationMs, projectile.issuedAt])

  return (
    <Group
      ref={effectRef}
      x={projectile.from.x}
      y={projectile.from.y}
      rotation={Math.atan2(
        projectile.to.y - projectile.from.y,
        projectile.to.x - projectile.from.x,
      ) * 180 / Math.PI}
      listening={false}
    >
      <Group
        ref={trailRef}
        clip={{ x: -areaWidth * 0.08, y: -areaWidth * 0.55, width: areaWidth * 0.08, height: areaWidth * 1.1 }}
        listening={false}
      >
        <KonvaImage
          image={image}
          x={-distance * 0.055}
          y={-areaWidth * 0.5}
          width={distance * 1.14}
          height={areaWidth}
          opacity={0.82}
          shadowColor="#38bdf8"
          shadowBlur={20}
          perfectDrawEnabled={false}
        />
      </Group>
      {[0, 1, 2].map((index) => (
        <Group
          key={`thunderwave-band:${index}`}
          ref={(node) => { bandRefs.current[index] = node }}
          opacity={0}
          listening={false}
        >
          <Line
            points={[
              0, -areaWidth * (0.48 - index * 0.04),
              areaWidth * (0.1 + index * 0.025), -areaWidth * 0.24,
              -areaWidth * (0.045 + index * 0.015), 0,
              areaWidth * (0.1 + index * 0.025), areaWidth * 0.24,
              0, areaWidth * (0.48 - index * 0.04),
            ]}
            stroke={index === 0 ? '#e0f2fe' : '#7dd3fc'}
            strokeWidth={Math.max(2, areaWidth * (0.045 - index * 0.008))}
            lineCap="round"
            lineJoin="round"
            shadowColor="#38bdf8"
            shadowBlur={14 - index * 2}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <Line
          key={`thunderwave-air-streak:${index}`}
          ref={(node) => { debrisRefs.current[index] = node }}
          points={[
            -areaWidth * (0.11 + (index % 3) * 0.018), areaWidth * 0.025,
            -areaWidth * 0.035, -areaWidth * (0.035 + (index % 2) * 0.018),
            areaWidth * 0.045, areaWidth * 0.018,
            areaWidth * (0.1 + (index % 2) * 0.025), -areaWidth * 0.012,
          ]}
          tension={0.58}
          stroke={index % 3 === 0 ? '#ffffff' : index % 3 === 1 ? '#bae6fd' : '#7dd3fc'}
          strokeWidth={Math.max(1, areaWidth * (0.014 + (index % 2) * 0.006))}
          lineCap="round"
          lineJoin="round"
          dash={index % 2 === 0 ? [areaWidth * 0.055, areaWidth * 0.04] : undefined}
          shadowColor="#38bdf8"
          shadowBlur={5}
          opacity={0}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      <Group ref={frontRef} listening={false}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => (
          <Circle
            key={`thunderwave-dust:${index}`}
            x={-areaWidth * (0.08 + (index % 4) * 0.075)}
            y={areaWidth * (-0.42 + (index % 6) * 0.16)}
            radius={Math.max(0.8, areaWidth * (0.012 + (index % 3) * 0.005))}
            fill={index % 2 === 0 ? '#e0f2fe' : '#7dd3fc'}
            opacity={0.42 + (index % 3) * 0.14}
            shadowColor="#38bdf8"
            shadowBlur={4}
            perfectDrawEnabled={false}
          />
        ))}
        {[0, 1, 2].map((index) => {
          const offset = -areaWidth * index * 0.075
          return (
          <Line
            key={`thunderwave-front:${index}`}
            points={[
              offset - areaWidth * 0.02, -areaWidth * 0.5,
              offset + areaWidth * 0.09, -areaWidth * 0.36,
              offset - areaWidth * 0.045, -areaWidth * 0.2,
              offset + areaWidth * 0.1, 0,
              offset - areaWidth * 0.045, areaWidth * 0.2,
              offset + areaWidth * 0.09, areaWidth * 0.36,
              offset - areaWidth * 0.02, areaWidth * 0.5,
            ]}
            stroke={index === 0 ? '#ffffff' : index === 1 ? '#bae6fd' : '#38bdf8'}
            strokeWidth={Math.max(1.6, areaWidth * (0.04 - index * 0.008))}
            lineCap="round"
            lineJoin="round"
            tension={0.34}
            opacity={0.96 - index * 0.18}
            shadowColor={index === 0 ? '#e0f2fe' : '#38bdf8'}
            shadowBlur={18 - index * 3}
            perfectDrawEnabled={false}
          />
          )
        })}
      </Group>
    </Group>
  )
}

export function BurningHandsSpriteEffect({
  projectile,
  image,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
}) {
  const effectRef = useRef<Konva.Group>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const launchGlowRef = useRef<Konva.Circle>(null)
  const frontGlowRef = useRef<Konva.Circle>(null)
  const sparkRefs = useRef<Array<Konva.Circle | null>>([])
  const smokeRefs = useRef<Array<Konva.Circle | null>>([])
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const width = distance * 1.14
  const areaWidth = Math.max(28, projectile.areaWidthPx ?? 70)
  const height = areaWidth * 1.04
  const imageX = -distance * 0.055
  const columns = 4
  const rows = 4
  const frameCount = columns * rows
  const frameWidth = (image.naturalWidth || image.width) / columns
  const frameHeight = (image.naturalHeight || image.height) / rows

  const sparkSpecs = useMemo(() => {
    return Array.from({ length: 20 }, (_, index): BurningHandsSparkSpec => {
      const random = (field: string) => nextAreaRandom(
        areaSeed(`${projectile.id}:burning-hands:sparks:${index}:${field}`),
      )[1]
      const start = 0.08 + random('start') * 0.34
      const speed = 0.76 + random('speed') * 0.42
      const vertical = (random('vertical') - 0.5) * height * 0.72
      const drift = (random('drift') - 0.5) * height * 0.22
      const radius = Math.max(1.1, height * (0.014 + random('radius') * 0.016))
      return { start, speed, vertical, drift, radius, warm: index % 3 !== 0 }
    })
  }, [height, projectile.id])

  const smokeSpecs = useMemo(() => {
    return Array.from({ length: 5 }, (_, index): BurningHandsSmokeSpec => {
      const random = (field: string) => nextAreaRandom(
        areaSeed(`${projectile.id}:burning-hands:smoke:${index}:${field}`),
      )[1]
      const start = 0.48 + random('start') * 0.18
      const x = width * (0.48 + random('x') * 0.48)
      const y = (random('y') - 0.5) * height * 0.52
      const drift = (random('drift') - 0.5) * height * 0.2
      const radius = height * (0.055 + random('radius') * 0.045)
      return { start, x, y, drift, radius }
    })
  }, [height, projectile.id, width])

  useEffect(() => {
    const effect = effectRef.current
    const sprite = spriteRef.current
    const launchGlow = launchGlowRef.current
    const frontGlow = frontGlowRef.current
    const layer = effect?.getLayer()
    if (!effect || !sprite || !launchGlow || !frontGlow || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_150)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)

    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const spriteRaw = Math.min(1, raw / 0.82)
      const frameIndex = Math.min(frameCount - 1, Math.floor(spriteRaw * frameCount))
      const column = frameIndex % columns
      const row = Math.floor(frameIndex / columns)
      const fade = raw < 0.78 ? 1 : Math.max(0, (1 - raw) / 0.22)
      const ignition = Math.min(1, raw / 0.055)

      sprite.crop({
        x: column * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })
      sprite.opacity(ignition * fade)
      sprite.scaleY(0.985 + Math.sin(elapsed * 0.022) * 0.025)

      launchGlow.radius(height * (0.1 + Math.min(1, raw * 7) * 0.16))
      launchGlow.opacity(Math.sin(Math.min(1, raw * 6) * Math.PI) * 0.8)
      const frontRaw = Math.max(0, Math.min(1, (raw - 0.24) / 0.42))
      frontGlow.position({ x: width * (0.64 + frontRaw * 0.27), y: 0 })
      frontGlow.scale({ x: 1.5 + frontRaw * 1.2, y: 0.7 + frontRaw * 0.5 })
      frontGlow.opacity(Math.sin(frontRaw * Math.PI) * 0.3 * fade)

      sparkRefs.current.forEach((spark, index) => {
        if (!spark) return
        const spec = sparkSpecs[index]
        const local = Math.max(0, Math.min(1, (raw - spec.start) / (0.58 - spec.start * 0.25)))
        const eased = 1 - Math.pow(1 - local, 1.7)
        spark.position({
          x: imageX + width * Math.min(1.04, eased * spec.speed),
          y: spec.vertical * (0.15 + eased * 0.85) + spec.drift * Math.sin(local * Math.PI),
        })
        spark.radius(spec.radius * (1 - local * 0.48))
        spark.opacity(Math.sin(local * Math.PI) * 0.92 * fade)
      })

      smokeRefs.current.forEach((smoke, index) => {
        if (!smoke) return
        const spec = smokeSpecs[index]
        const local = Math.max(0, Math.min(1, (raw - spec.start) / (1 - spec.start)))
        smoke.position({
          x: imageX + spec.x + local * height * 0.14,
          y: spec.y + spec.drift * local - height * local * 0.08,
        })
        smoke.radius(spec.radius * (0.7 + local * 0.8))
        smoke.opacity(Math.sin(local * Math.PI) * 0.14)
      })

      effect.opacity(raw < 0.98 ? 1 : Math.max(0, (1 - raw) / 0.02))
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
    columns,
    dx,
    dy,
    frameCount,
    frameHeight,
    frameWidth,
    height,
    imageX,
    projectile.durationMs,
    projectile.issuedAt,
    smokeSpecs,
    sparkSpecs,
    width,
  ])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Circle
        ref={launchGlowRef}
        x={0}
        y={0}
        fill="#fff7c2"
        shadowColor="#fb923c"
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <KonvaImage
        ref={spriteRef}
        image={image}
        x={imageX}
        y={-height / 2}
        width={width}
        height={height}
        shadowColor="#f97316"
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={frontGlowRef}
        radius={height * 0.12}
        fill="#fff7c2"
        shadowColor="#fb923c"
        shadowBlur={20}
        perfectDrawEnabled={false}
      />
      {sparkSpecs.map((spec, index) => (
        <Circle
          key={`burning-hands-spark:${index}`}
          ref={(node) => { sparkRefs.current[index] = node }}
          radius={spec.radius}
          fill={spec.warm ? '#fde68a' : '#fb923c'}
          shadowColor={spec.warm ? '#facc15' : '#ef4444'}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
        />
      ))}
      {smokeSpecs.map((spec, index) => (
        <Circle
          key={`burning-hands-smoke:${index}`}
          ref={(node) => { smokeRefs.current[index] = node }}
          radius={spec.radius}
          fill="#4b2b25"
          shadowColor="#7c2d12"
          shadowBlur={16}
          opacity={0}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

export function MaterialAreaSpellEffect({
  projectile,
}: {
  projectile: MapProjectile
}) {
  const isShatter = projectile.kind === 'shatter'
  const isFlameStrike = projectile.kind === 'flame-strike'
  const isSunburst = projectile.kind === 'sunburst'
  const isConeOfCold = projectile.kind === 'cone-of-cold'
  const isCircleOfDeath = projectile.kind === 'circle-of-death'
  const isIceStorm = projectile.kind === 'ice-storm'
  const isFreezingSphere = projectile.kind === 'freezing-sphere'
  const isColorSpray = projectile.kind === 'color-spray'
  const isFaerieFire = projectile.kind === 'faerie-fire'
  const isSleep = projectile.kind === 'sleep'
  const isEntangle = projectile.kind === 'entangle'
  const isGrease = projectile.kind === 'grease'
  const isDarkness = projectile.kind === 'darkness'
  const isFlamingSphere = projectile.kind === 'flaming-sphere'
  const isMoonbeam = projectile.kind === 'moonbeam'
  const isDaylight = projectile.kind === 'daylight'
  const isBlackTentacles = projectile.kind === 'black-tentacles'
  const isSpikeGrowth = projectile.kind === 'spike-growth'
  const isMageHand = projectile.kind === 'mage-hand'
  const isSpiritualWeapon = projectile.kind === 'spiritual-weapon'
  const isSpiritGuardians = projectile.kind === 'spirit-guardians'
  const isCallLightning = projectile.kind === 'call-lightning'
  const isCallLightningStrike = projectile.kind === 'call-lightning-strike'
  const isInsectPlague = projectile.kind === 'insect-plague'
  const isCloudkill = projectile.kind === 'cloudkill'
  const isWallOfFire = projectile.kind === 'wall-of-fire'
  const isBladeBarrier = projectile.kind === 'blade-barrier'
  const asset = projectile.kind === 'burning-hands'
    ? '/assets/vfx/burning-hands-sprite-v2.png'
    : projectile.kind === 'thunderwave'
      ? '/assets/vfx/thunderwave-fluid.webp'
      : isShatter
        ? '/assets/vfx/shatter-sprite-v2.png'
        : isFlameStrike
          ? '/assets/vfx/flame-strike-sprite-v2.png'
          : isSunburst
            ? '/assets/vfx/sunburst-sprite-v2.png'
            : isConeOfCold
              ? '/assets/vfx/cone-of-cold-sprite-v2.png'
              : isCircleOfDeath
                ? '/assets/vfx/circle-of-death-sprite-v2.png'
                : isIceStorm
                  ? '/assets/vfx/ice-storm-sprite-v2.png'
                  : isFreezingSphere
                    ? '/assets/vfx/freezing-sphere-sprite-v2.png'
                    : isColorSpray
                      ? '/assets/vfx/color-spray-sprite-v2.png'
                      : isFaerieFire
                        ? '/assets/vfx/faerie-fire-sprite-v2.png'
                        : isSleep
                          ? '/assets/vfx/sleep-sprite-v2.png'
                          : isEntangle
                            ? '/assets/vfx/entangle-sprite-v2.png'
                            : isGrease
                              ? '/assets/vfx/grease-sprite-v2.png'
                              : isDarkness
                                ? '/assets/vfx/darkness-sprite-v2.png'
                                : isFlamingSphere
                                  ? '/assets/vfx/flaming-sphere-sprite-v2.png'
                                  : isMoonbeam
                                    ? '/assets/vfx/moonbeam-sprite-v2.png'
                                    : isDaylight
                                      ? '/assets/vfx/daylight-sprite-v2.png'
                                      : isBlackTentacles
                                        ? '/assets/vfx/black-tentacles-sprite-v2.png'
                                        : isSpikeGrowth
                                          ? '/assets/vfx/spike-growth-sprite-v2.png'
                                          : isMageHand
                                            ? '/assets/vfx/mage-hand-sprite-v2.png'
                                            : isSpiritualWeapon
                                              ? '/assets/vfx/spiritual-weapon-sprite-v2.png'
                                              : isSpiritGuardians
                                                ? '/assets/vfx/spirit-guardians-sprite-v2.png'
                                                : isCallLightning
                                                  ? '/assets/vfx/call-lightning-sprite-v2.png'
                                                  : isCallLightningStrike
                                                    ? '/assets/vfx/call-lightning-strike-sprite-v2.png'
                                                  : isInsectPlague
                                                  ? '/assets/vfx/insect-plague-sprite-v2.png'
                                                  : isCloudkill
                                                    ? '/assets/vfx/cloudkill-sprite-v2.png'
                                                    : isWallOfFire
                                                      ? '/assets/vfx/wall-of-fire-sprite-v2.png'
                                                      : isBladeBarrier
                                                        ? '/assets/vfx/blade-barrier-sprite-v2.png'
                                                        : '/assets/vfx/lightning-bolt-sprite-v2.png'
  const loadedImage = useTokenBadgeImage(asset)
  const image = loadedImage
  const reducedMotion = usePrefersReducedMotion()
  if (!image) return null
  if (isWallOfFire && projectile.areaShape === 'ring') {
    return (
      <WallOfFireRingVisual
        image={image}
        x={projectile.to.x} y={projectile.to.y}
        radius={Math.max(30, projectile.radiusPx ?? 70)} reducedMotion={reducedMotion}
        persistent={false}
        issuedAt={projectile.issuedAt}
        durationMs={projectile.durationMs}
      />
    )
  }
  if (projectile.kind === 'burning-hands') {
    return <BurningHandsSpriteEffect projectile={projectile} image={image} />
  }
  if (isShatter) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * 2.45}
        shadowColor="#8b5cf6"
        particleColor="#60a5fa"
        particleHighlight="#ede9fe"
      />
    )
  }
  if (isFlameStrike || isSunburst) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (isSunburst ? 2.08 : 2.5)}
        shadowColor={isSunburst ? '#fef08a' : '#f97316'}
        particleColor={isSunburst ? '#fde68a' : '#fb923c'}
        particleHighlight="#ffffff"
      />
    )
  }
  if (isCircleOfDeath || isIceStorm || isFreezingSphere) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (isIceStorm ? 2.35 : 2.08)}
        shadowColor={isCircleOfDeath ? '#7c3aed' : '#38bdf8'}
        particleColor={isCircleOfDeath ? '#84cc16' : '#93c5fd'}
        particleHighlight={isCircleOfDeath ? '#d9f99d' : '#ffffff'}
      />
    )
  }
  if (isFaerieFire || isSleep || isEntangle || isGrease) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (isFaerieFire ? 2.05 : isSleep ? 2.18 : 2.06)}
        shadowColor={isFaerieFire ? '#d946ef' : isSleep ? '#6366f1' : isEntangle ? '#65a30d' : '#d97706'}
        particleColor={isFaerieFire ? '#67e8f9' : isSleep ? '#c4b5fd' : isEntangle ? '#84cc16' : '#f59e0b'}
        particleHighlight={isFaerieFire ? '#fde68a' : isSleep ? '#fef3c7' : isEntangle ? '#d9f99d' : '#fef3c7'}
      />
    )
  }
  if (isDarkness || isFlamingSphere || isMoonbeam) {
    const radius = isFlamingSphere
      ? Math.max(1, projectile.radiusPx ?? 70)
      : Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (
          isMoonbeam
            ? 3.4
            : isFlamingSphere
              ? FLAMING_SPHERE_VISUAL_DIAMETER_GRID_FACTOR
              : 2.08
        )}
        shadowColor={isDarkness ? '#581c87' : isFlamingSphere ? '#f97316' : '#bfdbfe'}
        particleColor={isDarkness ? '#8b5cf6' : isFlamingSphere ? '#fb923c' : '#e0f2fe'}
        particleHighlight={isDarkness ? '#c4b5fd' : isFlamingSphere ? '#fef3c7' : '#ffffff'}
      />
    )
  }
  if (isDaylight || isBlackTentacles || isSpikeGrowth) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (isBlackTentacles ? 2.08 : 2.05)}
        shadowColor={isDaylight ? '#fde68a' : isBlackTentacles ? '#581c87' : '#65a30d'}
        particleColor={isDaylight ? '#fef3c7' : isBlackTentacles ? '#a855f7' : '#84cc16'}
        particleHighlight={isDaylight ? '#ffffff' : isBlackTentacles ? '#ddd6fe' : '#d9f99d'}
      />
    )
  }
  if (isMageHand || isSpiritualWeapon || isSpiritGuardians || isCallLightning || isCallLightningStrike || isInsectPlague || isCloudkill) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={radius * (isMageHand ? 2.05 : isSpiritualWeapon ? 2.55 : isCallLightningStrike ? 2.7 : 2.08)}
        shadowColor={isMageHand ? '#22d3ee' : isSpiritualWeapon ? '#c4b5fd' : isSpiritGuardians ? '#fde68a' : isCallLightning || isCallLightningStrike ? '#38bdf8' : isCloudkill ? '#84cc16' : '#d6a94d'}
        particleColor={isMageHand ? '#67e8f9' : isSpiritualWeapon ? '#ddd6fe' : isSpiritGuardians ? '#fef3c7' : isCallLightning || isCallLightningStrike ? '#60a5fa' : isCloudkill ? '#bef264' : '#a16207'}
        particleHighlight={isInsectPlague ? '#fde68a' : isCloudkill ? '#ecfccb' : '#ffffff'}
      />
    )
  }
  if (isWallOfFire || isBladeBarrier) {
    const width = Math.max(60, projectile.areaWidthPx ?? 120)
    const height = Math.max(34, (projectile.areaHeightPx ?? 20) * (isWallOfFire ? 2.2 : 1.8))
    const angle = Math.atan2(
      projectile.to.y - projectile.from.y,
      projectile.to.x - projectile.from.x,
    ) * 180 / Math.PI
    return (
      <TargetSpriteAtlasEffect
        projectile={projectile}
        image={image}
        diameter={height}
        width={width}
        height={height}
        rotation={angle}
        shadowColor={isWallOfFire ? '#ef4444' : '#67e8f9'}
        particleColor={isWallOfFire ? '#fb923c' : '#bae6fd'}
        particleHighlight="#ffffff"
      />
    )
  }
  const distance = Math.max(
    1,
    Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y),
  )
  const areaWidth = Math.max(28, projectile.areaWidthPx ?? 70)
  if (isConeOfCold) {
    return (
      <DirectionalSpriteAtlasEffect
        projectile={projectile}
        image={image}
        heightRatio={areaWidth / distance}
        minHeight={areaWidth * 0.98}
        maxHeight={areaWidth * 1.02}
        shadowColor="#7dd3fc"
        particleColor="#bfdbfe"
        particleHighlight="#ffffff"
      />
    )
  }
  if (isColorSpray) {
    return (
      <DirectionalSpriteAtlasEffect
        projectile={projectile}
        image={image}
        heightRatio={areaWidth / distance}
        minHeight={areaWidth * 0.98}
        maxHeight={areaWidth * 1.02}
        shadowColor="#f472b6"
        particleColor="#67e8f9"
        particleHighlight="#fef08a"
      />
    )
  }
  if (projectile.kind === 'lightning-bolt') {
    return (
      <DirectionalSpriteAtlasEffect
        projectile={projectile}
        image={image}
        heightRatio={areaWidth / distance}
        minHeight={areaWidth * 0.98}
        maxHeight={areaWidth * 1.02}
        shadowColor="#38bdf8"
        particleColor="#60a5fa"
        particleHighlight="#ffffff"
      />
    )
  }
  if (projectile.kind === 'thunderwave') {
    return <ThunderwaveMaterialEffect
      projectile={projectile}
      image={image}
      distance={distance}
      areaWidth={areaWidth}
    />
  }
  return (
    <DirectionalTextureEffect
      projectile={projectile}
      image={image}
      heightRatio={areaWidth / distance}
      minHeight={areaWidth * 0.98}
      maxHeight={areaWidth * 1.02}
      revealEnd={0.46}
      fadeStart={0.72}
      shadowColor="#22d3ee"
    />
  )
}

export function FireballProjectile({ projectile }: { projectile: MapProjectile }) {
  const projectileRef = useRef<Konva.Group>(null)
  const tailRef = useRef<Konva.Line>(null)
  const outerOrbRef = useRef<Konva.Circle>(null)
  const innerOrbRef = useRef<Konva.Circle>(null)
  const blastRef = useRef<Konva.Group>(null)
  const blastCoreRef = useRef<Konva.Circle>(null)
  const blastRingRef = useRef<Konva.Circle>(null)
  const shockwaveRef = useRef<Konva.Circle>(null)
  const fireImage = useTokenBadgeImage('/assets/vfx/fire-projectile-fluid.png')
  const explosionImage = useTokenBadgeImage('/assets/vfx/fireball-explosion-fluid.png')

  useEffect(() => {
    const projectileNode = projectileRef.current
    const layer = projectileNode?.getLayer()
    if (!projectileNode || !layer) return
    const tail = tailRef.current
    const outerOrb = outerOrbRef.current
    const innerOrb = innerOrbRef.current
    const blast = blastRef.current
    const blastCore = blastCoreRef.current
    const blastRing = blastRingRef.current
    const shockwave = shockwaveRef.current
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const duration = Math.max(900, projectile.durationMs ?? 1_750)
    const radius = Math.max(24, projectile.radiusPx ?? 120)
    const orbRadius = Math.max(7, Math.min(14, radius * 0.065))
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    projectileNode.rotation((Math.atan2(dy, dx) * 180) / Math.PI)
    blast?.position(projectile.to)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const chargeEnd = 0.08
      const travelEnd = 0.48
      const travelRaw = Math.max(0, Math.min(1, (raw - chargeEnd) / (travelEnd - chargeEnd)))
      const travel = 1 - Math.pow(1 - travelRaw, 2.4)
      const perpendicularX = -dy / distance
      const perpendicularY = dx / distance
      const wobble = Math.sin(travelRaw * Math.PI * 6) * orbRadius * 0.22 * (1 - travelRaw)
      projectileNode.x(projectile.from.x + dx * travel + perpendicularX * wobble)
      projectileNode.y(projectile.from.y + dy * travel + perpendicularY * wobble)
      projectileNode.visible(raw < travelEnd)
      projectileNode.opacity(raw < chargeEnd ? Math.max(0.2, raw / chargeEnd) : 1)
      const pulse = 1 + Math.sin(elapsed * 0.055) * 0.18
      outerOrb?.radius(orbRadius * pulse)
      innerOrb?.radius(orbRadius * 0.46 * (2 - pulse))
      if (tail) {
        const tailLength = orbRadius * (2.8 + Math.sin(elapsed * 0.045) * 0.35)
        tail.points([-tailLength, 0, -orbRadius * 0.5, 0])
      }

      if (blast) {
        const explosionRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
        const expansion = 1 - Math.pow(1 - explosionRaw, 3)
        const fade = explosionRaw < 0.62 ? 1 : Math.max(0, (1 - explosionRaw) / 0.38)
        blast.visible(explosionRaw > 0)
        blast.opacity(fade)
        blast.scale({ x: 0.08 + expansion * 0.94, y: 0.08 + expansion * 0.94 })
        blastCore?.radius(radius * (0.72 + Math.sin(elapsed * 0.038) * 0.055))
        blastRing?.radius(radius * (0.55 + expansion * 0.48))
        blastRing?.opacity(Math.max(0, 0.9 - explosionRaw * 0.75))
        shockwave?.radius(radius * (0.35 + expansion * 0.95))
        shockwave?.opacity(Math.max(0, 0.82 - explosionRaw * 0.82))
      }
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  const radius = Math.max(24, projectile.radiusPx ?? 120)
  const orbRadius = Math.max(7, Math.min(14, radius * 0.065))
  const flameClouds = Array.from({ length: 14 }, (_, index) => {
    const angle = index / 14 * Math.PI * 2
    const ring = index % 2 === 0 ? 0.48 : 0.68
    return {
      x: Math.cos(angle) * radius * ring,
      y: Math.sin(angle) * radius * ring,
      radius: radius * (index % 3 === 0 ? 0.29 : 0.23),
      fill: index % 3 === 0
        ? 'rgba(239,68,68,0.58)'
        : index % 2 === 0
          ? 'rgba(249,115,22,0.66)'
          : 'rgba(251,191,36,0.56)',
    }
  })

  if (fireImage) {
    return (
      <MovingFireTextureEffect
        projectile={projectile}
        fireImage={fireImage}
        explosionImage={explosionImage}
        spriteSize={92}
        impactDiameter={radius * 2.15}
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
          points={[-orbRadius * 3, 0, -orbRadius * 0.5, 0]}
          stroke="rgba(220,38,38,0.72)"
          strokeWidth={orbRadius * 1.65}
          lineCap="round"
          shadowColor="#ef4444"
          shadowBlur={orbRadius * 1.8}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-orbRadius * 2.2, 0, -orbRadius * 0.35, 0]}
          stroke="rgba(251,146,60,0.95)"
          strokeWidth={orbRadius * 0.88}
          lineCap="round"
          shadowColor="#f97316"
          shadowBlur={orbRadius}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={outerOrbRef}
          radius={orbRadius}
          fill="#f97316"
          stroke="#fed7aa"
          strokeWidth={1.4}
          shadowColor="#ef4444"
          shadowBlur={orbRadius * 2}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={innerOrbRef}
          radius={orbRadius * 0.46}
          fill="#fff7c2"
          shadowColor="#fde047"
          shadowBlur={orbRadius}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group
        ref={blastRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={shockwaveRef}
          radius={radius * 0.35}
          stroke="rgba(254,240,138,0.92)"
          strokeWidth={Math.max(3, radius * 0.035)}
          shadowColor="#f97316"
          shadowBlur={Math.max(12, radius * 0.16)}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={blastCoreRef}
          radius={radius * 0.72}
          fill="rgba(220,38,38,0.32)"
          shadowColor="#ef4444"
          shadowBlur={Math.max(20, radius * 0.24)}
          perfectDrawEnabled={false}
        />
        {flameClouds.map((cloud, index) => (
          <Circle
            key={index}
            x={cloud.x}
            y={cloud.y}
            radius={cloud.radius}
            fill={cloud.fill}
            shadowColor={index % 2 === 0 ? '#ef4444' : '#f59e0b'}
            shadowBlur={Math.max(8, radius * 0.1)}
            perfectDrawEnabled={false}
          />
        ))}
        <Circle
          radius={radius * 0.42}
          fill="rgba(254,215,170,0.82)"
          shadowColor="#facc15"
          shadowBlur={Math.max(14, radius * 0.18)}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={blastRingRef}
          radius={radius * 0.55}
          stroke="rgba(254,215,170,0.96)"
          strokeWidth={Math.max(3, radius * 0.045)}
          shadowColor="#f97316"
          shadowBlur={Math.max(12, radius * 0.13)}
          perfectDrawEnabled={false}
        />
        {Array.from({ length: 20 }, (_, index) => {
          const rotation = index * 18
          const inner = radius * (0.5 + (index % 3) * 0.05)
          const outer = radius * (0.82 + (index % 4) * 0.05)
          return (
            <Line
              key={rotation}
              points={[inner, 0, outer, 0]}
              rotation={rotation}
              stroke={index % 2 === 0 ? '#fde68a' : '#fb923c'}
              strokeWidth={Math.max(2, radius * 0.022)}
              lineCap="round"
              shadowColor="#ef4444"
              shadowBlur={Math.max(4, radius * 0.045)}
              perfectDrawEnabled={false}
            />
          )
        })}
      </Group>
    </>
  )
}
