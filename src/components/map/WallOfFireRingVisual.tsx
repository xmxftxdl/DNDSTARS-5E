import { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Circle, Group, Image as KonvaImage } from 'react-konva'
import { scheduleFlamingSphereVisualReady } from './flamingSphereHandoff'

interface Props {
  image: HTMLImageElement
  x: number
  y: number
  radius: number
  reducedMotion: boolean
  persistent: boolean
  issuedAt?: number
  durationMs?: number
  onReady?: () => void
}

/** Warps the original animated Wall of Fire atlas into one seamless closed ring. */
export default function WallOfFireRingVisual({
  image, x, y, radius, reducedMotion, persistent, issuedAt, durationMs = 1_500, onReady,
}: Props) {
  const groupRef = useRef<Konva.Group>(null)
  const textureRef = useRef<Konva.Image>(null)
  const glowRef = useRef<Konva.Circle>(null)
  const flameHeight = Math.max(34, radius * 0.72)
  const textureSize = Math.ceil((radius + flameHeight * 0.78) * 2)

  useEffect(() => {
    const group = groupRef.current
    const texture = textureRef.current
    if (!group || !texture) return
    const frameWidth = Math.floor((image.naturalWidth || image.width) / 4)
    const frameHeight = Math.floor((image.naturalHeight || image.height) / 4)
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = frameWidth
    sampleCanvas.height = frameHeight
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
    const ringCanvas = document.createElement('canvas')
    ringCanvas.width = textureSize
    ringCanvas.height = textureSize
    const ringContext = ringCanvas.getContext('2d')
    if (!sampleContext || !ringContext) return
    const center = textureSize / 2
    const innerRadius = radius - flameHeight * 0.22
    const sourceOffsets = new Int32Array(textureSize * textureSize).fill(-1)
    for (let py = 0; py < textureSize; py += 1) for (let px = 0; px < textureSize; px += 1) {
      const dx = px + 0.5 - center
      const dy = py + 0.5 - center
      const radial = Math.hypot(dx, dy)
      const heightProgress = (radial - innerRadius) / flameHeight
      if (heightProgress < 0 || heightProgress > 1) continue
      const angleProgress = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)
      const sourceX = Math.min(frameWidth - 1, Math.floor(angleProgress * frameWidth))
      const sourceY = Math.min(frameHeight - 1, Math.floor((1 - heightProgress) * frameHeight))
      sourceOffsets[py * textureSize + px] = (sourceY * frameWidth + sourceX) * 4
    }
    const renderFrame = (frameIndex: number) => {
      sampleContext.clearRect(0, 0, frameWidth, frameHeight)
      sampleContext.drawImage(image, (frameIndex % 4) * frameWidth, Math.floor(frameIndex / 4) * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight)
      const source = sampleContext.getImageData(0, 0, frameWidth, frameHeight).data
      const output = ringContext.createImageData(textureSize, textureSize)
      for (let pixel = 0; pixel < sourceOffsets.length; pixel += 1) {
        const sourceOffset = sourceOffsets[pixel]
        if (sourceOffset < 0) continue
        const outputOffset = pixel * 4
        output.data[outputOffset] = source[sourceOffset]
        output.data[outputOffset + 1] = source[sourceOffset + 1]
        output.data[outputOffset + 2] = source[sourceOffset + 2]
        output.data[outputOffset + 3] = source[sourceOffset + 3]
      }
      ringContext.putImageData(output, 0, 0)
      texture.image(ringCanvas)
      texture.opacity(1)
    }
    let frameId = 0
    let lastPaintAt = 0
    const startedAt = performance.now()
    const startedWallTime = Date.now()
    const initialElapsed = persistent ? durationMs : Math.max(0, issuedAt ? startedWallTime - issuedAt : 0)
    const animate = (now: number) => {
      if (now - lastPaintAt >= 66) {
        lastPaintAt = now
        const elapsed = initialElapsed + now - startedAt
        const formed = persistent ? 1 : Math.min(1, elapsed / Math.max(1, durationMs * 0.62))
        const entranceFrame = Math.min(15, Math.floor(formed * 16))
        const frameIndex = formed < 1 ? entranceFrame : 8 + Math.floor(elapsed / 90) % 8
        renderFrame(frameIndex)
        const pulse = 1 + Math.sin(elapsed / 190) * 0.018
        group.scale({ x: (0.7 + formed * 0.3) * pulse, y: (0.7 + formed * 0.3) * pulse })
        group.opacity(Math.min(1, formed * 1.9))
        group.rotation(elapsed / 260)
        glowRef.current?.opacity(0.48 + Math.sin(elapsed / 160) * 0.13)
        group.getLayer()?.batchDraw()
      }
      frameId = window.requestAnimationFrame(animate)
    }
    if (reducedMotion) { renderFrame(15); group.opacity(1); group.getLayer()?.batchDraw() }
    else frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [durationMs, flameHeight, image, issuedAt, persistent, radius, reducedMotion, textureSize])

  useEffect(() => {
    if (!onReady) return
    return scheduleFlamingSphereVisualReady({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
      drawLayer: () => { const layer = groupRef.current?.getLayer(); if (!layer) return false; layer.draw(); return true },
      onReady,
    })
  }, [image, onReady])

  return <Group ref={groupRef} name="wall-of-fire-ring-visual" x={x} y={y} opacity={persistent || reducedMotion ? 1 : 0} listening={false}>
    <Circle ref={glowRef} radius={radius + flameHeight * 0.18} stroke="#fb4b16" strokeWidth={flameHeight * 0.5} shadowColor="#ff5a1f" shadowBlur={flameHeight * 0.62} opacity={0.55} />
    <KonvaImage ref={textureRef} image={image} x={-textureSize / 2} y={-textureSize / 2} width={textureSize} height={textureSize} opacity={0} perfectDrawEnabled={false} listening={false} />
    <Circle radius={innerRadiusSafe(radius, flameHeight)} stroke="#fff2a8" strokeWidth={Math.max(2, flameHeight * 0.055)} shadowColor="#fbbf24" shadowBlur={flameHeight * 0.16} opacity={0.82} />
  </Group>
}

function innerRadiusSafe(radius: number, flameHeight: number) {
  return Math.max(1, radius - flameHeight * 0.21)
}
