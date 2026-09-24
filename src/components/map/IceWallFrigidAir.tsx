import { memo, useRef } from 'react'
import Konva from 'konva'
import { Group, Shape } from 'react-konva'
import type { BattleMap } from '../../store/maps'
import type { StoneWallPanel } from '../../rulesets/dnd5e/stoneWall'
import { stoneWallPanelPlacement } from './stoneWallPlacement'
import { usePrefersReducedMotion, useStatusAnimation } from './mapEffectHooks'

let vapourTexture: HTMLCanvasElement | undefined
/** Cache soft multiscale density once; animation only composites small textures. */
function getVapourTexture() {
  if (vapourTexture) return vapourTexture
  const canvas = document.createElement('canvas')
  canvas.width = 192; canvas.height = 128
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(canvas.width, canvas.height)
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx
    const b = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx
    return a * (1 - sy) + b * sy
  }
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const nx = (x / canvas.width - .5) * 2, ny = (y / canvas.height - .5) * 2
    const edge = Math.max(0, 1 - nx * nx - ny * ny)
    const warp = noise(x / 37, y / 37) * 18
    const density = noise((x + warp) / 31, (y - warp) / 31) * .5 +
      noise(x / 14 + 12, y / 14) * .28 + noise(x / 6, y / 6 + 9) * .15 + noise(x / 3, y / 3) * .07
    const alpha = Math.pow(edge, 1.1) * Math.max(0, (density - .23) * 1.75)
    const shade = 193 + density * 60, offset = (y * canvas.width + x) * 4
    pixels.data[offset] = shade; pixels.data[offset + 1] = shade + 7
    pixels.data[offset + 2] = Math.min(255, shade + 12); pixels.data[offset + 3] = alpha * 240
  }
  context.putImageData(pixels, 0, 0)
  vapourTexture = canvas
  return canvas
}

export const IceWallFrigidAir = memo(function IceWallFrigidAir({ panel, map }: { panel: StoneWallPanel; map: BattleMap }) {
  const node = useRef<Konva.Shape>(null)
  const time = useRef(0)
  const reducedMotion = usePrefersReducedMotion()
  useStatusAnimation(() => node.current?.getLayer() ?? null, frame => {
    time.current = (frame?.time ?? 0) / 1000
  }, { active: !reducedMotion, fps: 20 })
  const placement = stoneWallPanelPlacement(panel, map)
  const width = map.gridSize * 1.1
  return <Group x={placement.x} y={placement.y} rotation={placement.angle} listening={false}>
    <Shape ref={node} listening={false} perfectDrawEnabled={false} sceneFunc={context => {
      const c = context._context, t = time.current, length = placement.length, texture = getVapourTexture()
      c.save()
      // A cool shaded base separates white vapour from bright grass and stone.
      const base = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      base.addColorStop(0, 'rgba(42,75,90,.24)'); base.addColorStop(1, 'rgba(42,75,90,0)')
      c.save(); c.scale(length * .58, width * .48); c.fillStyle = base
      c.fillRect(-1, -1, 2, 2); c.restore()
      // Opposing layers roll slowly rather than sweeping like luminous ribbons.
      for (let i = 0; i < 12; i++) {
        const phase = (t * (.045 + (i % 3) * .007) + i * .618034) % 1
        const envelope = Math.sin(phase * Math.PI)
        const direction = i % 2 ? 1 : -1
        const x = (phase - .5) * length * direction
        const y = Math.sin(i * 2.39 + t * .28) * width * .14
        const puffWidth = length * (.65 + (i % 3) * .09)
        const puffHeight = width * (.65 + (i % 4) * .08)
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * .18 + i) * .12)
        c.globalAlpha = envelope * (.54 + (i % 3) * .1)
        if (i % 2) c.scale(-1, 1)
        c.drawImage(texture, -puffWidth / 2, -puffHeight / 2, puffWidth, puffHeight)
        c.restore()
      }
      c.restore()
    }}/>
  </Group>
})
