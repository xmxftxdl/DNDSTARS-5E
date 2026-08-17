import { useEffect, useRef } from 'react'
import {
  sceneWeatherHasAudio,
  sceneWeatherFlowVector,
  sceneWeatherParticleBudget,
  sceneWeatherSeed,
  sunnySceneComposition,
  type SceneWeatherConfig,
} from '../../lib/sceneWeather'
import {
  startSceneWeatherAudio,
  type SceneWeatherAudioHandle,
} from '../../lib/sceneWeatherAudio'

interface SceneWeatherLayerProps {
  sceneId: string
  weather: SceneWeatherConfig
  mapWidth: number
  mapHeight: number
}

interface WeatherParticle {
  x: number
  y: number
  depth: number
  size: number
  phase: number
}

function seededRandom(initialSeed: number): () => number {
  let seed = initialSeed || 1
  return () => {
    seed += 0x6D2B79F5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createFogSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = 256
  sprite.height = 160
  const context = sprite.getContext('2d')
  if (!context) return sprite
  const gradient = context.createRadialGradient(128, 80, 8, 128, 80, 124)
  gradient.addColorStop(0, 'rgba(226,235,241,0.34)')
  gradient.addColorStop(0.38, 'rgba(205,219,229,0.22)')
  gradient.addColorStop(0.75, 'rgba(184,202,215,0.08)')
  gradient.addColorStop(1, 'rgba(170,190,205,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, sprite.width, sprite.height)
  return sprite
}

function createDustSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = 256
  sprite.height = 150
  const context = sprite.getContext('2d')
  if (!context) return sprite
  const gradient = context.createRadialGradient(128, 75, 6, 128, 75, 124)
  gradient.addColorStop(0, 'rgba(222,174,96,0.3)')
  gradient.addColorStop(0.42, 'rgba(181,126,62,0.18)')
  gradient.addColorStop(0.78, 'rgba(118,76,40,0.07)')
  gradient.addColorStop(1, 'rgba(89,55,32,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, sprite.width, sprite.height)
  return sprite
}

function adaptiveQualityScale(reducedMotion: boolean): number {
  if (reducedMotion) return 0.24
  const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 4
  if (cores <= 2) return 0.4
  if (cores <= 4) return 0.62
  return 1
}

function lightningIntensity(sceneSeed: number, now: number): { alpha: number; boltSeed: number } {
  const windowMs = 5_000
  const windowIndex = Math.floor(now / windowMs)
  const phase = now - windowIndex * windowMs
  const boltSeed = sceneWeatherSeed(`${sceneSeed}:${windowIndex}`)
  if (boltSeed % 3 !== 0 || phase > 280) return { alpha: 0, boltSeed }
  if (phase < 65) return { alpha: 0.7, boltSeed }
  if (phase < 120) return { alpha: 0.08, boltSeed }
  if (phase < 185) return { alpha: 0.42, boltSeed }
  return { alpha: Math.max(0, 0.3 * (1 - (phase - 185) / 95)), boltSeed }
}

function drawLightningBolt(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  alpha: number,
) {
  const random = seededRandom(seed)
  let x = width * (0.18 + random() * 0.64)
  let y = -20
  const endY = height * (0.38 + random() * 0.28)
  context.save()
  context.strokeStyle = `rgba(224,237,255,${Math.min(0.95, alpha + 0.18)})`
  context.lineWidth = 1.5 + alpha * 2
  context.shadowColor = 'rgba(142,183,255,0.95)'
  context.shadowBlur = 16
  context.beginPath()
  context.moveTo(x, y)
  while (y < endY) {
    y += 22 + random() * 34
    x += (random() - 0.5) * 42
    context.lineTo(x, y)
    if (random() > 0.72) {
      context.moveTo(x, y)
      context.lineTo(x + (random() - 0.5) * 70, y + 34 + random() * 52)
      context.moveTo(x, y)
    }
  }
  context.stroke()
  context.restore()
}

export default function SceneWeatherLayer({
  sceneId,
  weather,
  mapWidth,
  mapHeight,
}: SceneWeatherLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<SceneWeatherAudioHandle | null>(null)

  useEffect(() => {
    if (!weather.soundEnabled || !sceneWeatherHasAudio(weather.kind)) return
    const handle = startSceneWeatherAudio({
      sceneId,
      kind: weather.kind,
      intensity: 0,
      volume: 0,
    })
    audioRef.current = handle
    return () => {
      handle?.stop()
      if (audioRef.current === handle) audioRef.current = null
    }
  }, [sceneId, weather.kind, weather.soundEnabled])

  useEffect(() => {
    audioRef.current?.setMix(weather.intensity, weather.soundVolume)
  }, [weather.intensity, weather.soundVolume])

  useEffect(() => {
    if (weather.kind === 'none') return
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const context = canvas?.getContext('2d')
    if (!canvas || !container || !context) return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedMotionQuery.matches
    let width = 1
    let height = 1
    let deviceScale = 1
    let particles: WeatherParticle[] = []
    let animationFrame = 0
    let lastFrameAt = performance.now()
    let lastRenderedAt = 0
    let disposed = false
    let pageVisible = document.visibilityState !== 'hidden'
    const sceneSeed = sceneWeatherSeed(`${sceneId}:${weather.kind}`)
    const random = seededRandom(sceneSeed)
    const fogSprite = createFogSprite()
    const dustSprite = createDustSprite()
    let sunPhase = (sceneSeed % 360) * Math.PI / 180

    const rebuildParticles = () => {
      const count = sceneWeatherParticleBudget({
        kind: weather.kind,
        width,
        height,
        intensity: weather.intensity,
        qualityScale: adaptiveQualityScale(reducedMotion),
      })
      particles = Array.from({ length: count }, () => ({
        x: random() * width,
        y: random() * height,
        depth: 0.25 + random() * 0.75,
        size: 0.45 + random() * 1.35,
        phase: random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      deviceScale = Math.min(window.devicePixelRatio || 1, reducedMotion ? 1 : 1.5)
      canvas.width = Math.max(1, Math.round(width * deviceScale))
      canvas.height = Math.max(1, Math.round(height * deviceScale))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      rebuildParticles()
    }

    const wrapParticle = (particle: WeatherParticle, margin = 80) => {
      if (particle.y > height + margin) particle.y = -margin
      if (particle.x > width + margin) particle.x = -margin
      if (particle.x < -margin) particle.x = width + margin
    }

    const drawSunny = (deltaSeconds: number) => {
      sunPhase += deltaSeconds * 0.13 * weather.speed
      const mapCanvas = container.parentElement?.querySelector<HTMLElement>(
        '[data-testid="map-canvas"]',
      )
      const composition = sunnySceneComposition({
        viewportWidth: width,
        viewportHeight: height,
        mapWidth,
        mapHeight,
        viewportX: Number(mapCanvas?.dataset.viewportX ?? 0),
        viewportY: Number(mapCanvas?.dataset.viewportY ?? 0),
        viewportScale: Number(mapCanvas?.dataset.viewportScale ?? 1),
      })
      const mapScreenWidth = composition.mapRight - composition.mapLeft
      const mapScreenHeight = composition.mapBottom - composition.mapTop
      const pulse = reducedMotion ? 1 : 0.985 + Math.sin(sunPhase) * 0.015
      const rayAlpha = (0.025 + weather.intensity * 0.045) * pulse

      // Restrict the illumination to the uploaded map. The light source remains
      // outside its upper-right edge, but no literal sun disc is rendered.
      context.save()
      context.beginPath()
      context.rect(
        composition.mapLeft,
        composition.mapTop,
        mapScreenWidth,
        mapScreenHeight,
      )
      context.clip()

      const warmth = 0.035 + weather.intensity * 0.075
      const wash = context.createLinearGradient(
        composition.sunX,
        composition.sunY,
        composition.mapLeft,
        composition.mapBottom,
      )
      wash.addColorStop(0, `rgba(255,246,211,${warmth * 1.18})`)
      wash.addColorStop(0.42, `rgba(255,214,139,${warmth * 0.72})`)
      wash.addColorStop(1, `rgba(255,181,79,${warmth * 0.12})`)
      context.fillStyle = wash
      context.fillRect(
        composition.mapLeft,
        composition.mapTop,
        mapScreenWidth,
        mapScreenHeight,
      )

      context.save()
      context.globalCompositeOperation = 'screen'
      for (let index = 0; index < 4; index += 1) {
        const startOffset = (index - 1.5) * composition.sunRadius * 0.3
        const reachX = composition.mapLeft + mapScreenWidth * (0.12 + index * 0.14)
        const reachY = composition.mapBottom + mapScreenHeight * (0.08 + index * 0.06)
        const spread = Math.max(44, mapScreenWidth * (0.09 + index * 0.014))
        const beam = context.createLinearGradient(
          composition.sunX,
          composition.sunY,
          reachX,
          reachY,
        )
        beam.addColorStop(0, `rgba(255,250,221,${rayAlpha * 1.45})`)
        beam.addColorStop(0.54, `rgba(255,225,163,${rayAlpha})`)
        beam.addColorStop(1, 'rgba(255,207,118,0)')
        context.beginPath()
        context.moveTo(composition.sunX + startOffset, composition.sunY)
        context.lineTo(reachX - spread, reachY)
        context.lineTo(reachX + spread, reachY)
        context.closePath()
        context.fillStyle = beam
        context.fill()
      }
      context.restore()

      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.22 + particle.depth * 0.28) * weather.speed
        particle.x += Math.sin(particle.phase) * (1.5 + particle.depth * 2.5) * deltaSeconds
        particle.y -= (2 + particle.depth * 5) * deltaSeconds * weather.speed
        if (particle.y < -12) particle.y = height + 12
        const radius = 0.35 + particle.size * 0.7
        context.beginPath()
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(255,242,198,${(0.06 + particle.depth * 0.16) * weather.intensity})`
        context.fill()
      }
      context.restore()
    }

    const drawCloudy = (deltaSeconds: number) => {
      context.fillStyle = `rgba(58,70,86,${0.08 + weather.intensity * 0.16})`
      context.fillRect(0, 0, width, height)
      const drift = (4 + weather.intensity * 9) * weather.speed
      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.04 + particle.depth * 0.05)
        particle.x += drift * (0.35 + particle.depth * 0.55) * deltaSeconds
        particle.y += Math.sin(particle.phase) * 0.8 * deltaSeconds
        const cloudWidth = (360 + particle.depth * 520) * particle.size
        const cloudHeight = cloudWidth * 0.44
        if (particle.x > width + cloudWidth * 0.55) particle.x = -cloudWidth * 0.55
        context.globalAlpha = (0.035 + particle.depth * 0.055) * (0.5 + weather.intensity * 0.5)
        context.drawImage(
          fogSprite,
          particle.x - cloudWidth / 2,
          particle.y - cloudHeight / 2,
          cloudWidth,
          cloudHeight,
        )
      }
      context.globalAlpha = 1
    }

    const drawNight = () => {
      const moonlight = context.createLinearGradient(0, 0, width, height)
      moonlight.addColorStop(0, `rgba(24,42,78,${0.2 + weather.intensity * 0.25})`)
      moonlight.addColorStop(0.52, `rgba(5,13,35,${0.16 + weather.intensity * 0.24})`)
      moonlight.addColorStop(1, `rgba(1,4,15,${0.22 + weather.intensity * 0.28})`)
      context.fillStyle = moonlight
      context.fillRect(0, 0, width, height)
      const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18, width / 2, height / 2, Math.max(width, height) * 0.72)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, `rgba(0,2,12,${0.18 + weather.intensity * 0.24})`)
      context.fillStyle = vignette
      context.fillRect(0, 0, width, height)
    }

    const drawCave = (deltaSeconds: number) => {
      context.fillStyle = `rgba(9,13,18,${0.16 + weather.intensity * 0.24})`
      context.fillRect(0, 0, width, height)
      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.12 + particle.depth * 0.12) * weather.speed
        particle.x += Math.sin(particle.phase) * (1.4 + particle.depth * 3) * deltaSeconds
        particle.y += Math.cos(particle.phase * 0.7) * (0.5 + particle.depth) * deltaSeconds
        const radius = 0.35 + particle.size * 0.55
        context.beginPath()
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(185,170,139,${(0.035 + particle.depth * 0.11) * weather.intensity})`
        context.fill()
      }
      const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.12, width / 2, height / 2, Math.max(width, height) * 0.72)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(0.68, `rgba(1,3,5,${0.07 + weather.intensity * 0.09})`)
      vignette.addColorStop(1, `rgba(0,1,2,${0.3 + weather.intensity * 0.32})`)
      context.fillStyle = vignette
      context.fillRect(0, 0, width, height)
    }

    const drawRain = (deltaSeconds: number, thunderstorm: boolean) => {
      const angle = weather.windAngleDegrees * Math.PI / 180
      const stormMultiplier = thunderstorm ? 1.22 : 1
      const fallSpeed = (620 + weather.intensity * 360) * weather.speed * stormMultiplier
      const drift = Math.sin(angle) * fallSpeed
      const tintAlpha = thunderstorm
        ? 0.18 + weather.intensity * 0.16
        : 0.07 + weather.intensity * 0.1
      context.fillStyle = `rgba(5,12,25,${tintAlpha})`
      context.fillRect(0, 0, width, height)

      for (const foreground of [false, true]) {
        context.beginPath()
        for (const particle of particles) {
          if ((particle.depth >= 0.62) !== foreground) continue
          const speed = fallSpeed * (0.55 + particle.depth * 0.75)
          particle.x += drift * deltaSeconds * (0.45 + particle.depth * 0.55)
          particle.y += speed * deltaSeconds
          wrapParticle(particle, 100)
          const length = (9 + particle.depth * 22) * (0.8 + weather.intensity * 0.55)
          context.moveTo(particle.x, particle.y)
          context.lineTo(particle.x - Math.sin(angle) * length, particle.y - Math.cos(angle) * length)
        }
        context.strokeStyle = foreground
          ? `rgba(205,226,255,${0.34 + weather.intensity * 0.34})`
          : `rgba(145,184,226,${0.16 + weather.intensity * 0.2})`
        context.lineWidth = foreground ? 1.25 : 0.7
        context.stroke()
      }

      if (!thunderstorm || reducedMotion) return
      const lightning = lightningIntensity(sceneSeed, Date.now())
      if (lightning.alpha <= 0) return
      context.fillStyle = `rgba(198,220,255,${lightning.alpha * (0.55 + weather.intensity * 0.35)})`
      context.fillRect(0, 0, width, height)
      if (lightning.alpha > 0.35) {
        drawLightningBolt(context, width, height, lightning.boltSeed, lightning.alpha)
      }
    }

    const drawHail = (deltaSeconds: number) => {
      const angle = weather.windAngleDegrees * Math.PI / 180
      const fallSpeed = (520 + weather.intensity * 430) * weather.speed
      const drift = Math.sin(angle) * fallSpeed * 0.72
      context.fillStyle = `rgba(18,29,43,${0.08 + weather.intensity * 0.11})`
      context.fillRect(0, 0, width, height)
      for (const particle of particles) {
        const speed = fallSpeed * (0.58 + particle.depth * 0.72)
        particle.x += drift * deltaSeconds * (0.55 + particle.depth * 0.45)
        particle.y += speed * deltaSeconds
        if (particle.y > height + 18) particle.y = -18 - particle.size * 8
        if (particle.x > width + 40) particle.x = -40
        if (particle.x < -40) particle.x = width + 40
      }
      for (const foreground of [false, true]) {
        context.beginPath()
        for (const particle of particles) {
          if ((particle.depth >= 0.62) !== foreground) continue
          const radius = particle.size * (0.75 + particle.depth * 1.25)
          context.moveTo(particle.x, particle.y - radius * 3.4)
          context.lineTo(particle.x - Math.sin(angle) * radius * 2.6, particle.y - radius)
        }
        context.strokeStyle = foreground
          ? `rgba(204,232,251,${0.35 + weather.intensity * 0.25})`
          : `rgba(166,205,233,${0.18 + weather.intensity * 0.12})`
        context.lineWidth = foreground ? 1.1 : 0.65
        context.stroke()

        context.beginPath()
        for (const particle of particles) {
          if ((particle.depth >= 0.62) !== foreground) continue
          const radius = particle.size * (0.75 + particle.depth * 1.25)
          context.moveTo(particle.x + radius, particle.y)
          context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        }
        context.fillStyle = foreground
          ? 'rgba(237,248,255,0.82)'
          : 'rgba(213,235,250,0.52)'
        context.shadowColor = 'rgba(158,213,255,0.72)'
        context.shadowBlur = foreground ? 5 : 2
        context.fill()
      }
      context.beginPath()
      for (const particle of particles) {
        if (particle.y > height - 14) {
          const radius = particle.size * (0.75 + particle.depth * 1.25)
          const rebound = Math.max(0, 14 - (height - particle.y))
          context.moveTo(particle.x + drift * 0.018 + radius * 0.65, height - rebound * 0.4)
          context.arc(particle.x + drift * 0.018, height - rebound * 0.4, radius * 0.65, 0, Math.PI * 2)
        }
      }
      context.globalAlpha = 0.34
      context.fillStyle = 'rgba(231,245,255,0.8)'
      context.fill()
      context.globalAlpha = 1
      context.shadowBlur = 0
    }

    const drawSnow = (deltaSeconds: number) => {
      const angle = weather.windAngleDegrees * Math.PI / 180
      const fallSpeed = (42 + weather.intensity * 62) * weather.speed
      context.fillStyle = `rgba(205,220,235,${0.025 + weather.intensity * 0.045})`
      context.fillRect(0, 0, width, height)
      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.7 + particle.depth)
        particle.x += (
          Math.sin(angle) * fallSpeed * 0.8 +
          Math.sin(particle.phase) * (10 + particle.depth * 18)
        ) * deltaSeconds
        particle.y += fallSpeed * (0.55 + particle.depth * 0.8) * deltaSeconds
        wrapParticle(particle, 24)
        const radius = particle.size * (1.15 + particle.depth * 1.9)
        context.beginPath()
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(245,250,255,${0.38 + particle.depth * 0.48})`
        context.shadowColor = 'rgba(210,232,255,0.65)'
        context.shadowBlur = particle.depth > 0.7 ? 5 : 2
        context.fill()
      }
      context.shadowBlur = 0
    }

    const drawBlizzard = (deltaSeconds: number) => {
      const flow = sceneWeatherFlowVector(
        weather.windAngleDegrees,
        (390 + weather.intensity * 500) * weather.speed,
      )
      const perpendicularX = flow.unitY
      const perpendicularY = -flow.unitX
      context.fillStyle = `rgba(188,210,226,${0.12 + weather.intensity * 0.2})`
      context.fillRect(0, 0, width, height)
      const cloudCount = Math.min(18, particles.length)
      for (let index = 0; index < cloudCount; index += 1) {
        const particle = particles[index]
        particle.phase += deltaSeconds * (0.22 + particle.depth * 0.18)
        const cloudWidth = (240 + particle.depth * 340) * particle.size
        const cloudHeight = cloudWidth * 0.44
        context.globalAlpha = (0.07 + weather.intensity * 0.13) * particle.depth
        context.drawImage(
          fogSprite,
          particle.x - cloudWidth / 2,
          particle.y - cloudHeight / 2,
          cloudWidth,
          cloudHeight,
        )
      }
      context.globalAlpha = 1
      context.beginPath()
      for (const particle of particles) {
        const speedScale = 0.52 + particle.depth * 0.85
        const turbulence = Math.sin(particle.phase) * (10 + particle.depth * 18)
        particle.x += (flow.x * speedScale + perpendicularX * turbulence) * deltaSeconds
        particle.y += (flow.y * speedScale + perpendicularY * turbulence) * deltaSeconds
        wrapParticle(particle, 70)
        const length = (7 + particle.depth * 24) * (0.75 + weather.intensity * 0.65)
        context.moveTo(particle.x, particle.y)
        context.lineTo(
          particle.x - flow.unitX * length,
          particle.y - flow.unitY * length,
        )
      }
      context.strokeStyle = `rgba(244,250,255,${0.28 + weather.intensity * 0.48})`
      context.lineWidth = 1.05
      context.shadowColor = 'rgba(207,232,255,0.62)'
      context.shadowBlur = 4
      context.stroke()
      context.shadowBlur = 0
    }

    const drawFog = (deltaSeconds: number) => {
      const drift = (13 + weather.intensity * 19) * weather.speed *
        (weather.windAngleDegrees < 0 ? -1 : 1)
      context.fillStyle = `rgba(177,194,205,${0.045 + weather.intensity * 0.1})`
      context.fillRect(0, 0, width, height)
      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.08 + particle.depth * 0.1)
        particle.x += drift * (0.45 + particle.depth * 0.75) * deltaSeconds
        particle.y += Math.sin(particle.phase) * 2.5 * deltaSeconds
        const cloudWidth = (210 + particle.depth * 330) * particle.size
        const cloudHeight = cloudWidth * 0.5
        if (particle.x > width + cloudWidth * 0.6) particle.x = -cloudWidth * 0.6
        if (particle.x < -cloudWidth * 0.6) particle.x = width + cloudWidth * 0.6
        context.globalAlpha = (0.12 + particle.depth * 0.15) * (0.45 + weather.intensity * 0.75)
        context.drawImage(
          fogSprite,
          particle.x - cloudWidth / 2,
          particle.y - cloudHeight / 2,
          cloudWidth,
          cloudHeight,
        )
      }
      context.globalAlpha = 1
    }

    const drawSandstorm = (deltaSeconds: number) => {
      const flow = sceneWeatherFlowVector(
        weather.windAngleDegrees,
        (260 + weather.intensity * 430) * weather.speed,
      )
      const perpendicularX = flow.unitY
      const perpendicularY = -flow.unitX
      context.fillStyle = `rgba(126,79,35,${0.14 + weather.intensity * 0.24})`
      context.fillRect(0, 0, width, height)
      const cloudCount = Math.min(24, particles.length)
      for (let index = 0; index < cloudCount; index += 1) {
        const particle = particles[index]
        const cloudWidth = (250 + particle.depth * 420) * particle.size
        const cloudHeight = cloudWidth * 0.46
        context.globalAlpha = (0.1 + weather.intensity * 0.19) * (0.55 + particle.depth * 0.45)
        context.drawImage(
          dustSprite,
          particle.x - cloudWidth / 2,
          particle.y - cloudHeight / 2,
          cloudWidth,
          cloudHeight,
        )
      }
      context.globalAlpha = 1
      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.7 + particle.depth)
        const speedScale = 0.45 + particle.depth * 0.75
        const turbulence = Math.sin(particle.phase) * (12 + particle.depth * 26)
        particle.x += (flow.x * speedScale + perpendicularX * turbulence) * deltaSeconds
        particle.y += (flow.y * speedScale + perpendicularY * turbulence) * deltaSeconds
        wrapParticle(particle, 90)
      }
      context.beginPath()
      for (const particle of particles) {
        const length = 4 + particle.depth * 18
        context.moveTo(particle.x, particle.y)
        context.lineTo(
          particle.x - flow.unitX * length,
          particle.y - flow.unitY * length,
        )
      }
      context.strokeStyle = `rgba(238,190,112,${0.14 + weather.intensity * 0.34})`
      context.lineWidth = 0.65 + weather.intensity * 0.45
      context.stroke()
    }

    const drawWind = (deltaSeconds: number) => {
      const direction = weather.windAngleDegrees < 0 ? -1 : 1
      const horizontalSpeed = (190 + weather.intensity * 360) * weather.speed * direction
      const slope = Math.sin(Math.abs(weather.windAngleDegrees) * Math.PI / 180)
      context.fillStyle = `rgba(176,202,214,${0.012 + weather.intensity * 0.025})`
      context.fillRect(0, 0, width, height)
      for (const particle of particles) {
        particle.phase += deltaSeconds * (0.9 + particle.depth * 1.4)
        particle.x += horizontalSpeed * (0.42 + particle.depth * 0.85) * deltaSeconds
        particle.y += (
          slope * horizontalSpeed * direction * 0.2 + Math.sin(particle.phase) * 20
        ) * deltaSeconds
        wrapParticle(particle, 120)
      }
      for (const foreground of [false, true]) {
        context.beginPath()
        for (const particle of particles) {
          if ((particle.depth >= 0.6) !== foreground) continue
          const length = 24 + particle.depth * 86
          const curve = Math.sin(particle.phase) * (4 + particle.depth * 10)
          context.moveTo(particle.x, particle.y)
          context.bezierCurveTo(
            particle.x - direction * length * 0.32,
            particle.y - curve,
            particle.x - direction * length * 0.72,
            particle.y + curve,
            particle.x - direction * length,
            particle.y,
          )
        }
        context.strokeStyle = foreground
          ? `rgba(218,239,245,${0.15 + weather.intensity * 0.12})`
          : `rgba(187,216,226,${0.07 + weather.intensity * 0.07})`
        context.lineWidth = foreground ? 1.1 : 0.65
        context.stroke()
      }
    }

    const drawEmbers = (deltaSeconds: number) => {
      const horizontalDrift = Math.sin(weather.windAngleDegrees * Math.PI / 180) *
        (34 + weather.intensity * 48) * weather.speed
      const riseSpeed = (42 + weather.intensity * 78) * weather.speed
      context.fillStyle = `rgba(37,11,5,${0.025 + weather.intensity * 0.055})`
      context.fillRect(0, 0, width, height)
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]
        particle.phase += deltaSeconds * (0.85 + particle.depth * 1.3)
        particle.x += (horizontalDrift + Math.sin(particle.phase) * (12 + particle.depth * 24)) * deltaSeconds
        particle.y -= riseSpeed * (0.5 + particle.depth * 0.85) * deltaSeconds
        if (particle.y < -30) particle.y = height + 30
        if (particle.x > width + 30) particle.x = -30
        if (particle.x < -30) particle.x = width + 30
      }
      for (const glowing of [false, true]) {
        context.beginPath()
        for (let index = 0; index < particles.length; index += 1) {
          const particle = particles[index]
          const isGlowing = (index + Math.floor(particle.phase * 2)) % 5 !== 0
          if (isGlowing !== glowing) continue
          const radius = particle.size * (glowing ? 0.65 + particle.depth * 1.1 : 0.45 + particle.depth * 0.65)
          context.moveTo(particle.x + radius, particle.y)
          context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        }
        context.fillStyle = glowing ? 'rgba(255,147,55,0.72)' : 'rgba(151,142,133,0.26)'
        context.shadowColor = glowing ? 'rgba(255,92,28,0.9)' : 'transparent'
        context.shadowBlur = glowing ? 8 : 0
        context.fill()
      }
      context.shadowBlur = 0
    }

    const render = (now: number) => {
      if (disposed) return
      animationFrame = window.requestAnimationFrame(render)
      if (!pageVisible) return
      const highMotionWeather = weather.kind === 'rain' ||
        weather.kind === 'thunderstorm' ||
        weather.kind === 'hail' ||
        weather.kind === 'blizzard' ||
        weather.kind === 'sandstorm'
      const targetFrameMs = weather.kind === 'sunny'
        ? 15
        : reducedMotion
          ? 100
          : highMotionWeather
            ? 22
            : 34
      if (now - lastRenderedAt < targetFrameMs) return
      const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - lastFrameAt) / 1000))
      lastFrameAt = now
      lastRenderedAt = now
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0)
      context.clearRect(0, 0, width, height)
      if (weather.kind === 'sunny') drawSunny(deltaSeconds)
      else if (weather.kind === 'cloudy') drawCloudy(deltaSeconds)
      else if (weather.kind === 'night') drawNight()
      else if (weather.kind === 'cave') drawCave(deltaSeconds)
      else if (weather.kind === 'fog') drawFog(deltaSeconds)
      else if (weather.kind === 'snow') drawSnow(deltaSeconds)
      else if (weather.kind === 'rain' || weather.kind === 'thunderstorm') {
        drawRain(deltaSeconds, weather.kind === 'thunderstorm')
      } else if (weather.kind === 'hail') drawHail(deltaSeconds)
      else if (weather.kind === 'blizzard') drawBlizzard(deltaSeconds)
      else if (weather.kind === 'sandstorm') drawSandstorm(deltaSeconds)
      else if (weather.kind === 'wind') drawWind(deltaSeconds)
      else if (weather.kind === 'embers') drawEmbers(deltaSeconds)
    }

    const handleVisibility = () => {
      pageVisible = document.visibilityState !== 'hidden'
      lastFrameAt = performance.now()
    }
    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      resize()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    reducedMotionQuery.addEventListener('change', handleReducedMotion)
    document.addEventListener('visibilitychange', handleVisibility)
    resize()
    animationFrame = window.requestAnimationFrame(render)

    return () => {
      disposed = true
      observer.disconnect()
      reducedMotionQuery.removeEventListener('change', handleReducedMotion)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.cancelAnimationFrame(animationFrame)
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [
    mapHeight,
    mapWidth,
    sceneId,
    weather.intensity,
    weather.kind,
    weather.speed,
    weather.windAngleDegrees,
  ])

  if (weather.kind === 'none') return null
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[18] overflow-hidden rounded-2xl"
      data-testid="scene-weather-layer"
      data-weather-kind={weather.kind}
      data-weather-intensity={weather.intensity}
      data-weather-sound={weather.soundEnabled && sceneWeatherHasAudio(weather.kind) ? 'on' : 'off'}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
