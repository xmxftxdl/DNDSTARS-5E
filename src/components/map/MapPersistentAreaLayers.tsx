import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Circle, Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import Konva from 'konva'
import { cellKey, cellTopLeft, tokenCenterForAnchorCell } from '../../lib/gridCombat'
import { collectMapDifficultTerrainCells } from '../../lib/mapDifficultTerrain'
import { dnd5ePersistentAreaPresentationVisual } from '../../rulesets/dnd5e/persistentAreaPresentation'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { MapGeometryPoint, MapGeometryState } from '../../lib/mapGeometry'
import WallOfFireRingVisual from './WallOfFireRingVisual'
import { toxicCloudPuffs } from './toxicCloudPresentation'
import {
  FLAMING_SPHERE_VISUAL_DIAMETER_GRID_FACTOR,
  schedulePersistentAreaVisualReady,
} from './flamingSphereHandoff'
import { geometryEntityPoints } from './mapCanvasGeometryUtils'
import { usePrefersReducedMotion, useStatusAnimation, useTokenBadgeImage } from './mapEffectHooks'
import { mapCanvasEffectTokenAreaRenderOffset } from './mapCanvasInteraction'
import { persistentAreaAtlasLoopFrames } from './persistentAreaAtlasFrames'

interface Point {
  x: number
  y: number
}



function Dnd5eToxicCloudAreaOverlay({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  const groupRef = useRef<Konva.Group>(null)
  const boundaryRef = useRef<Konva.Group>(null)
  const puffRefs = useRef<Array<Konva.Circle | null>>([])
  const reducedMotion = usePrefersReducedMotion()
  const puffs = useMemo(() => toxicCloudPuffs(area, map), [area, map])
  const bounds = useMemo(() => {
    const points = area.cells.map((cell) => cellTopLeft(cell, map))
    const minX = Math.min(...points.map((point) => point.x))
    const minY = Math.min(...points.map((point) => point.y))
    const maxX = Math.max(...points.map((point) => point.x)) + grid
    return { minX, minY, maxX }
  }, [area.cells, grid, map])
  const opacityScale = area.visual?.intensity === 'subtle' ? 0.7 : area.visual?.intensity === 'strong' ? 1.18 : 1
  const animationPhaseMs = useMemo(() => stableAnimationPhaseMs(area.id, 12_000), [area.id])

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    () => {
      const seconds = (Date.now() + animationPhaseMs) / 1000
      puffRefs.current.forEach((node, index) => {
        const puff = puffs[index]
        if (!node || !puff) return
        const wave = seconds * puff.speed + puff.phase
        node.x(puff.x + Math.sin(wave) * puff.drift)
        node.y(puff.y + Math.cos(wave * 0.73) * puff.drift * 0.62)
        node.scale({ x: 0.88 + Math.sin(wave * 1.19) * 0.12, y: 0.9 + Math.cos(wave) * 0.1 })
        node.opacity(Math.max(0.1, (0.2 + Math.sin(wave * 0.91) * 0.07) * opacityScale))
      })
      boundaryRef.current?.opacity(0.56 + Math.sin(seconds * 1.35) * 0.18)
      boundaryRef.current?.getChildren().forEach((node) => {
        if (node instanceof Konva.Rect) node.dashOffset(-seconds * 8)
      })
    },
    { active: !reducedMotion, fps: 12 },
  )

  const labelWidth = Math.min(Math.max(grid * 1.6, area.label.length * Math.max(7, grid * 0.14) + 34), Math.max(grid * 1.6, bounds.maxX - bounds.minX))
  return (
    <Group ref={groupRef} listening={false}>
      {area.cells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return <Rect key={`cloud-fill:${cellKey(cell)}`} x={x} y={y} width={grid} height={grid} fill={area.color} opacity={0.16 * opacityScale} listening={false} />
      })}
      {puffs.map((puff, index) => (
        <Circle
          key={`cloud-puff:${index}`}
          ref={(node) => { puffRefs.current[index] = node }}
          x={puff.x}
          y={puff.y}
          radius={puff.radius}
          fill={puff.color}
          opacity={0.2 * opacityScale}
          shadowColor="#1a2e05"
          shadowBlur={puff.radius * 0.7}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
      <Group ref={boundaryRef} listening={false}>
        {area.cells.map((cell) => {
          const { x, y } = cellTopLeft(cell, map)
          return <Rect key={`cloud-boundary:${cellKey(cell)}`} x={x} y={y} width={grid} height={grid} stroke="#bef264" strokeWidth={2.5} dash={[10, 6]} listening={false} />
        })}
      </Group>
      <Group x={bounds.minX + 6} y={Math.max(4, bounds.minY + 6)} listening={false}>
        <Rect width={labelWidth} height={Math.max(24, grid * 0.34)} fill="rgba(8,15,4,0.82)" stroke="rgba(190,242,100,0.7)" strokeWidth={1} cornerRadius={7} />
        <Text
          x={8}
          y={Math.max(5, grid * 0.08)}
          width={labelWidth - 16}
          text={`☁ ${area.label}`}
          fontSize={Math.max(11, Math.min(15, grid * 0.18))}
          fontStyle="bold"
          fill="#ecfccb"
          ellipsis
          wrap="none"
        />
      </Group>
    </Group>
  )
}



function Dnd5eStaticPluginAreaOverlay({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  return <>{area.cells.map((cell, index) => {
    const { x, y } = cellTopLeft(cell, map)
    return (
      <Group key={`${area.id}:${cellKey(cell)}`} listening={false}>
        <Rect x={x} y={y} width={grid} height={grid} fill={area.color} opacity={0.18} stroke={area.color} strokeWidth={2} dash={[9, 5]} />
        {index === 0 && <Text x={x} y={y + grid * 0.18} width={grid} text="✦" align="center" fontSize={Math.max(12, grid * 0.4)} fill={area.color} shadowBlur={5} shadowColor="rgba(0,0,0,0.9)" />}
      </Group>
    )
  })}</>
}



const CORE_AREA_VISUALS: Readonly<Record<string, { icon: string; glow: string }>> = {
  'dancing-lights': { icon: '✦', glow: '#a5f3fc' },
  'mage-hand': { icon: '✋', glow: '#67e8f9' },
  grease: { icon: '≋', glow: '#fde68a' },
  daylight: { icon: '☀', glow: '#fef3c7' },
  darkness: { icon: '●', glow: '#8b5cf6' },
  moonbeam: { icon: '☾', glow: '#eff6ff' },
  'call-lightning': { icon: '⚡', glow: '#93c5fd' },
  'spirit-guardians': { icon: '✦', glow: '#fef3c7' },
  'spike-growth': { icon: '✣', glow: '#bef264' },
  'flaming-sphere': { icon: '🔥', glow: '#fdba74' },
  'spiritual-weapon': { icon: '⚔', glow: '#c4b5fd' },
  entangle: { icon: '🌿', glow: '#a3e635' },
  'black-tentacles': { icon: '⌁', glow: '#a78bfa' },
  'wall-of-fire': { icon: '🔥', glow: '#fb7185' },
  'insect-plague': { icon: '✦', glow: '#d6a94d' },
  'blade-barrier': { icon: '✧', glow: '#bae6fd' },
  cloudkill: { icon: '☁', glow: '#bef264' },
  'ice-storm-ground': { icon: '❄', glow: '#dbeafe' },
  'fog-cloud': { icon: '☁', glow: '#cbd5e1' }, web: { icon: '⌘', glow: '#e2e8f0' }, silence: { icon: '∅', glow: '#a5b4fc' },
  'sleet-storm': { icon: '❄', glow: '#bfdbfe' }, 'stinking-cloud': { icon: '☁', glow: '#fde047' }, 'wind-wall': { icon: '≋', glow: '#bae6fd' },
  'wall-of-force': { icon: '◇', glow: '#c4b5fd' }, 'wall-of-stone': { icon: '▦', glow: '#a8a29e' }, 'wall-of-ice': { icon: '❄', glow: '#bae6fd' }, 'wall-of-thorns': { icon: '✣', glow: '#a3e635' },
}



const PERSISTENT_AREA_SPRITE_ASSETS: Readonly<Record<string, string>> = {
  'mage-hand': '/assets/vfx/mage-hand-sprite-v2.png',
  darkness: '/assets/vfx/darkness-sprite-v2.png',
  daylight: '/assets/vfx/daylight-sprite-v2.png',
  entangle: '/assets/vfx/entangle-sprite-v2.png',
  'black-tentacles': '/assets/vfx/black-tentacles-sprite-v2.png',
  'spiritual-weapon': '/assets/vfx/spiritual-weapon-sprite-v2.png',
  'spike-growth': '/assets/vfx/spike-growth-sprite-v2.png',
  'spirit-guardians': '/assets/vfx/spirit-guardians-sprite-v2.png',
  moonbeam: '/assets/vfx/moonbeam-sprite-v2.png',
  'call-lightning': '/assets/vfx/call-lightning-sprite-v2.png',
  'wall-of-fire': '/assets/vfx/wall-of-fire-sprite-v2.png',
  'insect-plague': '/assets/vfx/insect-plague-sprite-v2.png',
  'blade-barrier': '/assets/vfx/blade-barrier-sprite-v2.png',
  cloudkill: '/assets/vfx/sequence-toxic-cloud-sprite-v3.png',
  'stinking-cloud': '/assets/vfx/sequence-toxic-cloud-sprite-v3.png',
  'fog-cloud': '/assets/vfx/sequence-fog-cloud-sprite-v1.png',
  'sleet-storm': '/assets/vfx/sequence-sleet-storm-sprite-v1.png',
  'wind-wall': '/assets/vfx/sequence-wind-wall-sprite-v1.png',
  'wall-of-force': '/assets/vfx/sequence-wall-of-force-sprite-v1.png',
  'wall-of-stone': '/assets/vfx/sequence-wall-of-stone-sprite-v1.png',
  'wall-of-ice': '/assets/vfx/sequence-wall-of-ice-sprite-v1.png',
  'wall-of-thorns': '/assets/vfx/sequence-wall-of-thorns-sprite-v1.png',
  'ice-storm-ground': '/assets/vfx/ice-storm-ground-sprite-v2.png',
}



const PERSISTENT_STRIP_PRESETS = new Set([
  'wall-of-fire', 'blade-barrier', 'wind-wall', 'wall-of-force',
  'wall-of-stone', 'wall-of-ice', 'wall-of-thorns',
])

function stableAnimationPhaseMs(value: string, periodMs: number): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % Math.max(1, periodMs)
}

function spriteAtlasCrop(
  frameIndex: number,
  frameWidth: number,
  frameHeight: number,
  cropInset: number,
) {
  return {
    x: (frameIndex % 4) * frameWidth + cropInset,
    y: Math.floor(frameIndex / 4) * frameHeight + cropInset,
    width: frameWidth - cropInset * 2,
    height: frameHeight - cropInset * 2,
  }
}


function PersistentAreaSpriteAtlas({
  image,
  x,
  y,
  width,
  height,
  rotation = 0,
  opacity,
  glow,
  reducedMotion,
  preset,
  animationId,
  onReady,
}: {
  image: HTMLImageElement
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity: number
  glow: string
  reducedMotion: boolean
  preset: string
  animationId: string
  onReady?: () => void
}) {
  const groupRef = useRef<Konva.Group>(null)
  const primarySpriteRef = useRef<Konva.Image>(null)
  const secondarySpriteRef = useRef<Konva.Image>(null)
  const frameWidth = (image.naturalWidth || image.width) / 4
  const frameHeight = (image.naturalHeight || image.height) / 4
  const loopFrames = persistentAreaAtlasLoopFrames(preset)
  const cropInset = Math.max(0.5, Math.min(frameWidth, frameHeight) * 0.004)
  const isSlowCloud = preset === 'cloudkill' || preset === 'stinking-cloud'
  const frameHoldMs = isSlowCloud ? 1_350 : 165
  const crossfadeMs = isSlowCloud ? 440 : 70
  const animationPhaseMs = useMemo(
    () => stableAnimationPhaseMs(animationId, frameHoldMs * loopFrames.length),
    [animationId, frameHoldMs, loopFrames.length],
  )

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    () => {
      const elapsedMs = Date.now() + animationPhaseMs
      const step = Math.floor(elapsedMs / frameHoldMs)
      const stepProgressMs = elapsedMs % frameHoldMs
      const primaryFrame = loopFrames[step % loopFrames.length]
      const secondaryFrame = loopFrames[(step + 1) % loopFrames.length]
      const crossfadeStartMs = frameHoldMs - crossfadeMs
      const linearMix = Math.max(0, Math.min(1, (stepProgressMs - crossfadeStartMs) / crossfadeMs))
      const smoothMix = linearMix * linearMix * (3 - 2 * linearMix)
      primarySpriteRef.current?.crop(spriteAtlasCrop(primaryFrame, frameWidth, frameHeight, cropInset))
      secondarySpriteRef.current?.crop(spriteAtlasCrop(secondaryFrame, frameWidth, frameHeight, cropInset))
      primarySpriteRef.current?.opacity(opacity * (1 - smoothMix))
      secondarySpriteRef.current?.opacity(opacity * smoothMix)
    },
    { active: !reducedMotion, fps: isSlowCloud ? 12 : 20 },
  )

  useEffect(() => {
    if (!onReady) return
    return schedulePersistentAreaVisualReady({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
      drawLayer: () => { const layer = groupRef.current?.getLayer(); if (!layer) return false; layer.draw(); return true },
      onReady,
    })
  }, [image, onReady])

  const initialFrame = loopFrames[0]
  return (
    <Group
      ref={groupRef}
      name={`persistent-area-sprite-atlas persistent-area-${preset}`}
      x={x}
      y={y}
      rotation={rotation}
      listening={false}
    >
      <KonvaImage
        ref={primarySpriteRef}
        image={image}
        crop={spriteAtlasCrop(initialFrame, frameWidth, frameHeight, cropInset)}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        opacity={opacity}
        shadowColor={glow}
        shadowBlur={Math.min(width, height) * 0.12}
        listening={false}
        perfectDrawEnabled={false}
      />
      <KonvaImage
        ref={secondarySpriteRef}
        image={image}
        crop={spriteAtlasCrop(loopFrames[1] ?? initialFrame, frameWidth, frameHeight, cropInset)}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        opacity={0}
        shadowColor={glow}
        shadowBlur={Math.min(width, height) * 0.12}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

function PersistentSilenceField({
  areaId,
  x,
  y,
  radius,
  reducedMotion,
}: {
  areaId: string
  x: number
  y: number
  radius: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<Konva.Group>(null)
  const innerRingRef = useRef<Konva.Circle>(null)
  const middleRingRef = useRef<Konva.Circle>(null)
  const outerRingRef = useRef<Konva.Circle>(null)
  const phaseMs = useMemo(() => stableAnimationPhaseMs(areaId, 20_000), [areaId])

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    () => {
      const seconds = (Date.now() + phaseMs) / 1000
      innerRingRef.current?.rotation(seconds * 4)
      middleRingRef.current?.rotation(seconds * 2.6 + 48)
      outerRingRef.current?.rotation(seconds * 1.7 + 112)
      innerRingRef.current?.opacity(0.34 + Math.sin(seconds * 0.8) * 0.045)
      middleRingRef.current?.opacity(0.28 + Math.sin(seconds * 0.64 + 1.4) * 0.04)
      outerRingRef.current?.opacity(0.22 + Math.sin(seconds * 0.52 + 2.6) * 0.035)
    },
    { active: !reducedMotion, fps: 12 },
  )

  return (
    <Group ref={groupRef} x={x} y={y} listening={false}>
      <Circle
        radius={radius}
        fillRadialGradientStartPoint={{ x: 0, y: 0 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientEndRadius={radius}
        fillRadialGradientColorStops={[
          0, 'rgba(15,23,42,0.34)',
          0.68, 'rgba(49,46,129,0.2)',
          1, 'rgba(129,140,248,0.04)',
        ]}
        shadowColor="#818cf8"
        shadowBlur={radius * 0.14}
        perfectDrawEnabled={false}
      />
      <Circle ref={innerRingRef} radius={radius * 0.36} stroke="#c7d2fe" strokeWidth={2} dash={[radius * 0.12, radius * 0.17]} opacity={0.34} />
      <Circle ref={middleRingRef} radius={radius * 0.64} stroke="#a5b4fc" strokeWidth={2.2} dash={[radius * 0.19, radius * 0.12]} opacity={0.28} />
      <Circle ref={outerRingRef} radius={radius * 0.9} stroke="#818cf8" strokeWidth={2.4} dash={[radius * 0.25, radius * 0.16]} opacity={0.22} />
      <Circle radius={radius * 0.09} fill="#0f172a" stroke="#e0e7ff" strokeWidth={2} opacity={0.82} shadowColor="#a5b4fc" shadowBlur={10} />
    </Group>
  )
}



function persistentAreaSpritePlacement(
  area: Dnd5ePluginArea,
  map: BattleMap,
  preset: string,
): { x: number; y: number; width: number; height: number; rotation: number } | undefined {
  const grid = Math.max(1, map.gridSize)
  const cells = area.cells.length > 0 ? area.cells : area.anchorCell ? [area.anchorCell] : []
  if (cells.length === 0) return undefined
  const centers = cells.map((cell) => {
    const point = cellTopLeft(cell, map)
    return { x: point.x + grid / 2, y: point.y + grid / 2 }
  })
  const x = centers.reduce((sum, point) => sum + point.x, 0) / centers.length
  const y = centers.reduce((sum, point) => sum + point.y, 0) / centers.length

  if (PERSISTENT_STRIP_PRESETS.has(preset)) {
    if ((preset === 'wall-of-fire' || preset === 'blade-barrier') && area.wallOfFireGeometry?.shape === 'line' && area.anchorCell) {
      const anchor = cellTopLeft(area.anchorCell, map)
      return {
        x: anchor.x + grid / 2,
        y: anchor.y + grid / 2,
        width: grid * ((area.wallOfFireGeometry.lengthFeet ?? (preset === 'blade-barrier' ? 100 : 60)) / 5 + 0.05),
        height: grid * 1.12,
        rotation: area.wallOfFireGeometry.angleDegrees,
      }
    }
    const covariance = centers.reduce((sum, point) => ({
      xx: sum.xx + (point.x - x) ** 2,
      yy: sum.yy + (point.y - y) ** 2,
      xy: sum.xy + (point.x - x) * (point.y - y),
    }), { xx: 0, yy: 0, xy: 0 })
    const angle = Math.atan2(2 * covariance.xy, covariance.xx - covariance.yy) / 2
    const projections = centers.map((point) =>
      (point.x - x) * Math.cos(angle) + (point.y - y) * Math.sin(angle),
    )
    const length = Math.max(...projections) - Math.min(...projections) + grid * 1.25
    return {
      x,
      y,
      width: Math.max(grid * 1.25, length),
      height: grid * (preset === 'wall-of-fire' ? 1.12 : 1.65),
      rotation: angle * 180 / Math.PI,
    }
  }

  const anchor = area.anchorCell ?? cells[0]
  if (preset === 'mage-hand' || preset === 'spiritual-weapon') {
    const point = cellTopLeft(anchor, map)
    const size = grid * (preset === 'spiritual-weapon' ? 1.5 : 1.65)
    return { x: point.x + grid / 2, y: point.y + grid / 2, width: size, height: size, rotation: 0 }
  }

  const points = cells.map((cell) => cellTopLeft(cell, map))
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x + grid))
  const maxY = Math.max(...points.map((point) => point.y + grid))
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    width: Math.max(grid, maxX - minX) * 1.04,
    height: Math.max(grid, maxY - minY) * 1.04,
    rotation: 0,
  }
}



function PersistentFlamingSphereAtlas({
  image,
  x,
  y,
  size,
  reducedMotion,
  onReady,
}: {
  image: HTMLImageElement
  x: number
  y: number
  size: number
  reducedMotion: boolean
  onReady?: () => void
}) {
  const groupRef = useRef<Konva.Group>(null)
  const auraRef = useRef<Konva.Circle>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const frameWidth = (image.naturalWidth || image.width) / 4
  const frameHeight = (image.naturalHeight || image.height) / 4
  // Frames 0-7 build the sphere and 12-15 destroy it. The persistent overlay
  // must only idle across the fully formed frames until concentration ends.
  const loopFrames = [8, 9, 10, 11, 10, 9] as const

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const seconds = (frame?.time ?? 0) / 1000
      const frameIndex = loopFrames[Math.floor(seconds * 8) % loopFrames.length]
      spriteRef.current?.crop({
        x: (frameIndex % 4) * frameWidth,
        y: Math.floor(frameIndex / 4) * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })
      const pulse = 1 + Math.sin(seconds * 4.1) * 0.035
      spriteRef.current?.scale({ x: pulse, y: pulse })
      spriteRef.current?.rotation(Math.sin(seconds * 1.7) * 2.5)
      auraRef.current?.radius(size * (0.37 + Math.sin(seconds * 3.2) * 0.018))
      auraRef.current?.opacity(0.25 + Math.sin(seconds * 3.2) * 0.08)
    },
    { active: !reducedMotion, fps: 16 },
  )

  useEffect(() => {
    if (!onReady) return
    return schedulePersistentAreaVisualReady({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
      drawLayer: () => {
        const layer = groupRef.current?.getLayer()
        if (!layer) return false
        layer.draw()
        return true
      },
      onReady,
    })
  }, [image, onReady])

  const initialFrame = loopFrames[0]
  return (
    <Group ref={groupRef} x={x} y={y} listening={false}>
      <Circle
        ref={auraRef}
        radius={size * 0.37}
        fill="rgba(249,115,22,0.16)"
        shadowColor="#fb923c"
        shadowBlur={size * 0.32}
        opacity={0.25}
        listening={false}
        perfectDrawEnabled={false}
      />
      <KonvaImage
        ref={spriteRef}
        image={image}
        crop={{
          x: (initialFrame % 4) * frameWidth,
          y: Math.floor(initialFrame / 4) * frameHeight,
          width: frameWidth,
          height: frameHeight,
        }}
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        shadowColor="#f97316"
        shadowBlur={size * 0.18}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}



function PersistentGreasePoolAtlas({
  image,
  x,
  y,
  width,
  height,
  reducedMotion,
}: {
  image: HTMLImageElement
  x: number
  y: number
  width: number
  height: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<Konva.Group>(null)
  const quadrantSpriteRefs = useRef<Array<Konva.Image | null>>([])
  const frameWidth = (image.naturalWidth || image.width) / 4
  const frameHeight = (image.naturalHeight || image.height) / 4
  const loopFrames = [8, 9, 10, 11, 10, 9] as const
  // All mature source frames share this centered content window. Keeping the
  // crop fixed prevents the oil pool from drifting as its reflections change.
  const cropInsetX = frameWidth * 0.11
  const cropInsetTop = frameHeight * 0.185
  const cropInsetBottom = frameHeight * 0.17
  const contentWidth = frameWidth - cropInsetX * 2
  const contentHeight = frameHeight - cropInsetTop - cropInsetBottom

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const seconds = (frame?.time ?? 0) / 1000
      const frameIndex = loopFrames[Math.floor(seconds * 5) % loopFrames.length]
      const crop = {
        x: (frameIndex % 4) * frameWidth + cropInsetX,
        y: Math.floor(frameIndex / 4) * frameHeight + cropInsetTop,
        width: contentWidth,
        height: contentHeight,
      }
      const opacity = 0.7 + Math.sin(seconds * 1.9) * 0.045
      quadrantSpriteRefs.current.forEach((sprite) => {
        sprite?.crop(crop)
        sprite?.opacity(opacity)
      })
    },
    { active: !reducedMotion, fps: 12 },
  )

  const initialFrame = loopFrames[0]
  return (
    <Group ref={groupRef} x={x} y={y} listening={false}>
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fillRadialGradientStartPoint={{ x: width / 2, y: height / 2 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: width / 2, y: height / 2 }}
        fillRadialGradientEndRadius={Math.max(width, height) * 0.72}
        fillRadialGradientColorStops={[
          0, 'rgba(111,76,20,0.9)',
          0.46, 'rgba(58,38,12,0.88)',
          1, 'rgba(24,16,7,0.92)',
        ]}
        listening={false}
        perfectDrawEnabled={false}
      />
      {[
        { clipX: -width / 2, clipY: -height / 2, imageX: -width * 0.54, imageY: -height * 0.54, scaleX: 1, scaleY: 1 },
        { clipX: 0, clipY: -height / 2, imageX: width * 0.54, imageY: -height * 0.54, scaleX: -1, scaleY: 1 },
        { clipX: -width / 2, clipY: 0, imageX: -width * 0.54, imageY: height * 0.54, scaleX: 1, scaleY: -1 },
        { clipX: 0, clipY: 0, imageX: width * 0.54, imageY: height * 0.54, scaleX: -1, scaleY: -1 },
      ].map((quadrant, index) => (
        <Group
          key={`grease-quadrant:${index}`}
          clipX={quadrant.clipX}
          clipY={quadrant.clipY}
          clipWidth={width / 2}
          clipHeight={height / 2}
          listening={false}
        >
          <KonvaImage
            ref={(node) => { quadrantSpriteRefs.current[index] = node }}
            image={image}
            crop={{
              x: (initialFrame % 4) * frameWidth + cropInsetX,
              y: Math.floor(initialFrame / 4) * frameHeight + cropInsetTop,
              width: contentWidth,
              height: contentHeight,
            }}
            x={quadrant.imageX}
            y={quadrant.imageY}
            width={width * 1.08}
            height={height * 1.08}
            scaleX={quadrant.scaleX}
            scaleY={quadrant.scaleY}
            opacity={0.72}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
    </Group>
  )
}



export function Dnd5eCoreSpellAreaOverlay({
  area,
  map,
  onPersistentVisualReady,
}: {
  area: Dnd5ePluginArea
  map: BattleMap
  onPersistentVisualReady?: (areaId: string) => void
}) {
  const grid = Math.max(1, map.gridSize)
  const groupRef = useRef<Konva.Group>(null)
  const boundaryRef = useRef<Konva.Group>(null)
  const iconRef = useRef<Konva.Text>(null)
  const reducedMotion = usePrefersReducedMotion()
  const areaVisual = dnd5ePersistentAreaPresentationVisual(area)
  const preset = areaVisual?.preset ?? ''
  const persistentFlamingSphereImage = useTokenBadgeImage(
    preset === 'flaming-sphere' ? '/assets/vfx/flaming-sphere-sprite-v2.png' : undefined,
  )
  const persistentGreaseImage = useTokenBadgeImage(
    preset === 'grease' ? '/assets/vfx/grease-sprite-v2.png' : undefined,
  )
  const persistentSpriteAsset = PERSISTENT_AREA_SPRITE_ASSETS[preset]
  const persistentAreaImage = useTokenBadgeImage(persistentSpriteAsset)
  const visual = CORE_AREA_VISUALS[preset] ?? { icon: '✦', glow: area.color }
  const areaCellKeys = new Set(area.cells.map(cellKey))
  const triggerOnlyCells = [...new Map(
    (area.triggers ?? []).flatMap((trigger) => trigger.cells ?? [])
      .filter((cell) => !areaCellKeys.has(cellKey(cell)))
      .map((cell) => [cellKey(cell), cell]),
  ).values()]
  const firstCell = area.anchorCell ?? area.cells[0]
  const iconPoint = firstCell ? cellTopLeft(firstCell, map) : { x: 0, y: 0 }
  const areaPixelBounds = area.cells.reduce((bounds, cell) => {
    const point = cellTopLeft(cell, map)
    return {
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x + grid),
      maxY: Math.max(bounds.maxY, point.y + grid),
    }
  }, { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY })
  const intensity = areaVisual?.intensity === 'strong' ? 1.18 : areaVisual?.intensity === 'subtle' ? 0.72 : 1
  const animationPhaseMs = useMemo(() => stableAnimationPhaseMs(area.id, 30_000), [area.id])
  const spritePlacement = persistentAreaImage
    ? persistentAreaSpritePlacement(area, map, preset)
    : undefined
  const persistentSpriteOpacity = preset === 'daylight'
    ? 0.5
    : preset === 'darkness'
      ? 0.76
      : preset === 'call-lightning'
        ? 0.68
        : preset === 'spirit-guardians'
          ? 0.9
          : preset === 'insect-plague'
            ? 0.76
            : 0.82
  const hasMaterialVisual = preset === 'grease' || preset === 'flaming-sphere' || preset === 'silence' || !!persistentSpriteAsset
  const reportPersistentVisualReady = useCallback(
    () => onPersistentVisualReady?.(area.id),
    [area.id, onPersistentVisualReady],
  )

  const persistentVisualAssetsReady = preset === 'flaming-sphere'
    ? !!persistentFlamingSphereImage
    : preset === 'grease'
      ? !!persistentGreaseImage
      : persistentSpriteAsset
        ? !!persistentAreaImage
        : true

  useEffect(() => {
    if (!onPersistentVisualReady || !persistentVisualAssetsReady) return
    return schedulePersistentAreaVisualReady({
      requestFrame: window.requestAnimationFrame.bind(window),
      cancelFrame: window.cancelAnimationFrame.bind(window),
      drawLayer: () => {
        const layer = groupRef.current?.getLayer()
        if (!layer) return false
        layer.batchDraw()
        return true
      },
      onReady: reportPersistentVisualReady,
    })
  }, [onPersistentVisualReady, persistentVisualAssetsReady, reportPersistentVisualReady])

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    () => {
      const seconds = (Date.now() + animationPhaseMs) / 1000
      groupRef.current?.opacity(
        hasMaterialVisual
          ? 1
          : (0.84 + Math.sin(seconds * 2.1) * 0.12) * intensity,
      )
      boundaryRef.current?.getChildren().forEach((node) => {
        if (node instanceof Konva.Rect) node.dashOffset(-seconds * (preset === 'flaming-sphere' ? 18 : 10))
      })
      const iconScale = 1 + Math.sin(seconds * (preset === 'flaming-sphere' ? 4.4 : 2.4)) * 0.08
      iconRef.current?.scale({ x: iconScale, y: iconScale })
      if (preset === 'spirit-guardians') iconRef.current?.rotation(Math.sin(seconds * 1.4) * 8)
    },
    { active: !reducedMotion, fps: 16 },
  )

  return (
    <Group ref={groupRef} listening={false}>
      {preset === 'dancing-lights' ? area.cells.map((cell, index) => {
        const point = cellTopLeft(cell, map)
        return <Group key={`dancing-light:${area.id}:${cellKey(cell)}`}>
          <Circle x={point.x + grid / 2} y={point.y + grid / 2} radius={grid * 0.22} fill={index % 2 ? '#f0abfc' : '#a5f3fc'} opacity={0.92} shadowColor={index % 2 ? '#e879f9' : '#67e8f9'} shadowBlur={grid * 0.45} />
          <Circle x={point.x + grid / 2} y={point.y + grid / 2} radius={grid * 0.08} fill="#ffffff" opacity={0.96} />
        </Group>
      }) : null}
      {triggerOnlyCells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return (
          <Rect
            key={`core-trigger-fill:${area.id}:${cellKey(cell)}`}
            x={x}
            y={y}
            width={grid}
            height={grid}
            fill={preset === 'wall-of-fire' ? '#dc2626' : area.color}
            opacity={preset === 'wall-of-fire' ? 0.24 : 0.09}
            stroke={preset === 'wall-of-fire' ? '#fb7185' : visual.glow}
            strokeWidth={preset === 'wall-of-fire' ? 1.8 : 1}
            dash={preset === 'wall-of-fire' ? [5, 3] : [2, 5]}
            listening={false}
          />
        )
      })}
      {area.cells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return (
          <Rect
            key={`core-fill:${area.id}:${cellKey(cell)}`}
            x={x}
            y={y}
            width={grid}
            height={grid}
            fill={area.color}
            opacity={
              hasMaterialVisual
                ? 0.035
                : preset === 'spike-growth' || preset === 'entangle' || preset === 'black-tentacles'
                ? 0.22
                : preset === 'wall-of-fire' ? 0.28 : 0.16
            }
            shadowColor={visual.glow}
            shadowBlur={preset === 'flaming-sphere' || preset === 'moonbeam' ? grid * 0.18 : grid * 0.08}
            listening={false}
          />
        )
      })}
      {!hasMaterialVisual && <Group ref={boundaryRef} listening={false}>
        {area.cells.map((cell) => {
          const { x, y } = cellTopLeft(cell, map)
          return (
            <Rect
              key={`core-boundary:${area.id}:${cellKey(cell)}`}
              x={x}
              y={y}
              width={grid}
              height={grid}
              stroke={visual.glow}
              strokeWidth={2.5}
              dash={
                preset === 'spike-growth' || preset === 'entangle' || preset === 'black-tentacles'
                  ? [4, 4]
                  : preset === 'wall-of-fire' ? [3, 2] : [10, 6]
              }
              listening={false}
            />
          )
        })}
      </Group>}
      {area.cells.length > 0 && preset === 'grease' && persistentGreaseImage ? (
        <PersistentGreasePoolAtlas
          image={persistentGreaseImage}
          x={(areaPixelBounds.minX + areaPixelBounds.maxX) / 2}
          y={(areaPixelBounds.minY + areaPixelBounds.maxY) / 2}
          width={areaPixelBounds.maxX - areaPixelBounds.minX}
          height={areaPixelBounds.maxY - areaPixelBounds.minY}
          reducedMotion={reducedMotion}
        />
      ) : firstCell && preset === 'flaming-sphere' && persistentFlamingSphereImage ? (
        <PersistentFlamingSphereAtlas
          image={persistentFlamingSphereImage}
          x={iconPoint.x + grid / 2}
          y={iconPoint.y + grid / 2}
          size={grid * FLAMING_SPHERE_VISUAL_DIAMETER_GRID_FACTOR}
          reducedMotion={reducedMotion}
        />
      ) : area.cells.length > 0 && preset === 'silence' ? (
        <PersistentSilenceField
          areaId={area.id}
          x={(areaPixelBounds.minX + areaPixelBounds.maxX) / 2}
          y={(areaPixelBounds.minY + areaPixelBounds.maxY) / 2}
          radius={Math.max(grid * 0.5, Math.min(
            areaPixelBounds.maxX - areaPixelBounds.minX,
            areaPixelBounds.maxY - areaPixelBounds.minY,
          ) / 2)}
          reducedMotion={reducedMotion}
        />
      ) : persistentAreaImage && (preset === 'wall-of-fire' || preset === 'blade-barrier') && area.wallOfFireGeometry?.shape === 'ring' && area.anchorCell ? (
        <WallOfFireRingVisual
          image={persistentAreaImage}
          x={cellTopLeft(area.anchorCell, map).x + grid / 2} y={cellTopLeft(area.anchorCell, map).y + grid / 2}
          radius={grid * ((area.wallOfFireGeometry.diameterFeet ?? (preset === 'blade-barrier' ? 60 : 20)) / 10)} reducedMotion={reducedMotion} persistent
        />
      ) : persistentAreaImage && spritePlacement ? (
        <PersistentAreaSpriteAtlas
          image={persistentAreaImage}
          {...spritePlacement}
          opacity={persistentSpriteOpacity}
          glow={visual.glow}
          reducedMotion={reducedMotion}
          preset={preset}
          animationId={area.id}
        />
      ) : firstCell && (
        <Text
          ref={iconRef}
          x={iconPoint.x}
          y={iconPoint.y + grid * 0.13}
          width={grid}
          height={grid}
          text={visual.icon}
          align="center"
          fontSize={Math.max(14, grid * 0.48)}
          fill={visual.glow}
          shadowColor={visual.glow}
          shadowBlur={8}
          offsetX={0}
          offsetY={0}
          listening={false}
        />
      )}
    </Group>
  )
}

// Viewport zoom lives in MapCanvas state. Re-rendering these descendants for
// a scale-only update would make react-konva reapply their declarative initial
// crop/opacity between two imperative animation frames, producing a visible
// one-frame snap. Keep the live Konva nodes mounted across viewport updates.
const ZoomStableToxicCloudAreaOverlay = memo(Dnd5eToxicCloudAreaOverlay)
const ZoomStableCoreSpellAreaOverlay = memo(Dnd5eCoreSpellAreaOverlay)



export function Dnd5ePluginAreaOverlays({
  map,
  isDM,
  onVisibilityToggle,
  onAreaClick,
  dragPreviewPositions,
  registerEffectTokenAreaOverlay,
  onPersistentVisualReady,
}: {
  map: BattleMap
  isDM: boolean
  onVisibilityToggle?: (areaId: string) => void
  onAreaClick?: (areaId: string) => void
  dragPreviewPositions: Readonly<Record<string, Point>>
  registerEffectTokenAreaOverlay?: (
    areaId: string,
    tokenId: string | undefined,
    areaAnchorPosition: Point | undefined,
    node: Konva.Group | null,
  ) => void
  onPersistentVisualReady?: (areaId: string) => void
}) {
  return <>{(map.dnd5ePluginAreas ?? []).map((area) => {
    const preset = dnd5ePersistentAreaPresentationVisual(area)?.preset ?? ''
    const overlay = preset === 'toxic-cloud'
      ? <ZoomStableToxicCloudAreaOverlay area={area} map={map} />
      : CORE_AREA_VISUALS[preset]
        ? <ZoomStableCoreSpellAreaOverlay
            area={area}
            map={map}
            onPersistentVisualReady={onPersistentVisualReady}
          />
        : <Dnd5eStaticPluginAreaOverlay area={area} map={map} />
    const anchor = area.anchorCell ?? area.cells[0]
    const center = anchor ? tokenCenterForAnchorCell(anchor, { size: 1 } as Token, map) : undefined
    const anchorToken = area.anchorMode === 'effect-token' && area.anchorTokenId
      ? map.tokens.find((token) => token.id === area.anchorTokenId)
      : undefined
    const areaAnchorPosition = anchor
      ? tokenCenterForAnchorCell(anchor, anchorToken ?? ({ size: 1 } as Token), map)
      : undefined
    const renderOffset = mapCanvasEffectTokenAreaRenderOffset({
      anchorMode: area.anchorMode,
      areaAnchorPosition,
      anchorTokenPosition: anchorToken ? { x: anchorToken.x, y: anchorToken.y } : undefined,
      dragPreviewPosition: area.anchorTokenId
        ? dragPreviewPositions[area.anchorTokenId]
        : undefined,
    })
    return <Group
      key={area.id}
      name={`dnd5e-plugin-area dnd5e-plugin-area-${preset || 'static'}`}
      ref={(node) => registerEffectTokenAreaOverlay?.(
        area.id,
        area.anchorMode === 'effect-token' ? area.anchorTokenId : undefined,
        areaAnchorPosition,
        node,
      )}
      x={renderOffset.x}
      y={renderOffset.y}
      onClick={isDM && onAreaClick ? (event) => { event.cancelBubble = true; onAreaClick(area.id) } : undefined}
      onTap={isDM && onAreaClick ? (event) => { event.cancelBubble = true; onAreaClick(area.id) } : undefined}
    >
      {overlay}
      {isDM && onAreaClick && area.cells.map((cell) => { const point = cellTopLeft(cell, map); return <Rect key={`persistent-area-hit:${area.id}:${cellKey(cell)}`} x={point.x} y={point.y} width={map.gridSize} height={map.gridSize} fill="rgba(255,255,255,0.001)" /> })}
      {isDM && area.coreSpellId === 'spike-growth' && center && onVisibilityToggle && <Group
        x={center.x}
        y={center.y}
        onClick={(event) => { event.cancelBubble = true; onVisibilityToggle(area.id) }}
        onTap={(event) => { event.cancelBubble = true; onVisibilityToggle(area.id) }}
      >
        <Rect x={-34} y={-13} width={68} height={26} cornerRadius={8} fill="rgba(2,6,23,0.88)" stroke={area.hiddenFromPlayers ? '#f59e0b' : '#22c55e'} strokeWidth={1.5} />
        <Text x={-31} y={-5} width={62} align="center" text={area.hiddenFromPlayers ? '仅 DM' : '已揭示'} fill="#f8fafc" fontSize={11} />
      </Group>}
    </Group>
  })}</>
}



export function DifficultTerrainCellOverlays({
  map,
  cells,
}: {
  map: BattleMap
  cells: ReturnType<typeof collectMapDifficultTerrainCells>
}) {
  const grid = Math.max(1, map.gridSize)
  const badgeWidth = Math.max(20, Math.min(34, grid * 0.46))
  const badgeHeight = Math.max(14, Math.min(22, grid * 0.3))
  const inset = Math.max(2, Math.min(5, grid * 0.06))
  const fontSize = Math.max(8, Math.min(13, grid * 0.18))
  return (
    <Group listening={false}>
      {cells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        const formattedMultiplier = Number.isInteger(cell.multiplier)
          ? String(cell.multiplier)
          : cell.multiplier.toFixed(1).replace(/\.0$/, '')
        return (
          <Group key={`difficult-terrain:${cellKey(cell)}`} listening={false}>
            <Rect
              x={x + 1}
              y={y + 1}
              width={Math.max(0, grid - 2)}
              height={Math.max(0, grid - 2)}
              fill="rgba(245,158,11,0.07)"
              stroke="rgba(251,191,36,0.48)"
              strokeWidth={1}
              dash={[Math.max(3, grid * 0.1), Math.max(2, grid * 0.07)]}
            />
            <Group x={x + grid - badgeWidth - inset} y={y + inset} listening={false}>
              <Rect
                width={badgeWidth}
                height={badgeHeight}
                cornerRadius={Math.min(6, badgeHeight * 0.32)}
                fill="rgba(2,6,23,0.82)"
                stroke="rgba(251,191,36,0.9)"
                strokeWidth={1}
              />
              <Text
                width={badgeWidth}
                height={badgeHeight}
                text={`×${formattedMultiplier}`}
                align="center"
                verticalAlign="middle"
                fontSize={fontSize}
                fontStyle="bold"
                fill="#fef3c7"
              />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}



export function TerrainElevationContours({
  geometry,
  inv,
}: {
  geometry?: MapGeometryState
  inv: number
}) {
  const regions = (geometry?.obstacles ?? []).filter((obstacle) =>
    obstacle.terrainRegion === true || (obstacle.terrainElevationFeet ?? 0) !== 0,
  )
  return <Group listening={false}>{regions.map((region) => {
    const elevationFeet = region.terrainElevationFeet ?? 0
    const labelAnchor = region.points.reduce<{
      point: MapGeometryPoint
      lengthSquared: number
    }>((longest, point, index) => {
      const next = region.points[(index + 1) % region.points.length]
      const lengthSquared = (next.x - point.x) ** 2 + (next.y - point.y) ** 2
      return lengthSquared > longest.lengthSquared
        ? {
            point: { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 },
            lengthSquared,
          }
        : longest
    }, { point: region.points[0] ?? { x: 0, y: 0 }, lengthSquared: -1 }).point
    const color = elevationFeet < 0 ? '#38bdf8' : '#fbbf24'
    const label = `${elevationFeet > 0 ? '+' : ''}${elevationFeet} 尺`
    return (
      <Group key={`terrain-contour:${region.id}`}>
        <Line
          points={geometryEntityPoints(region)}
          closed
          stroke="rgba(2,6,23,0.92)"
          strokeWidth={5 * inv}
          lineJoin="round"
        />
        <Line
          points={geometryEntityPoints(region)}
          closed
          stroke={color}
          strokeWidth={2 * inv}
          lineJoin="round"
          opacity={0.95}
        />
        <Group x={labelAnchor.x} y={labelAnchor.y}>
          <Rect
            x={-25 * inv}
            y={-9 * inv}
            width={50 * inv}
            height={18 * inv}
            cornerRadius={6 * inv}
            fill="rgba(2,6,23,0.82)"
            stroke={color}
            strokeWidth={inv}
          />
          <Text
            x={-25 * inv}
            y={-5.5 * inv}
            width={50 * inv}
            text={label}
            align="center"
            fontSize={10 * inv}
            fontStyle="bold"
            fill="#f8fafc"
          />
        </Group>
      </Group>
    )
  })}</Group>
}
