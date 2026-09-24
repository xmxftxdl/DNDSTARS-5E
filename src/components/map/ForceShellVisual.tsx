import { memo, useRef } from 'react'
import Konva from 'konva'
import { Group, Shape } from 'react-konva'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { usePrefersReducedMotion, useStatusAnimation } from './mapEffectHooks'

/** A fixed footprint with light moving over its curved surface. */
export const ForceShellVisual = memo(function ForceShellVisual({ area, map }: {
  area: Dnd5ePluginArea; map: BattleMap
}) {
  const node = useRef<Konva.Shape>(null)
  const time = useRef(0)
  const reducedMotion = usePrefersReducedMotion()
  useStatusAnimation(() => node.current?.getLayer() ?? null, frame => {
    time.current = (frame?.time ?? 0) / 1000
  }, { active: !reducedMotion, fps: 20 })
  if (!area.forceShell || !area.anchorCell) return null
  const radius = area.forceShell.radiusFeet / Math.max(1, map.feetPerCell ?? 5) * map.gridSize
  const sphere = area.forceShell.shape === 'sphere'
  return <Group x={map.gridOffsetX + (area.anchorCell.col + .5) * map.gridSize}
    y={map.gridOffsetY + (area.anchorCell.row + .5) * map.gridSize} listening={false}>
    <Shape ref={node} listening={false} perfectDrawEnabled={false} sceneFunc={context => {
      const c = context._context
      const t = time.current
      c.save()
      c.scale(radius / 100, radius / 100)
      // Fresnel-like edge reflection: the centre stays clear over creatures.
      const shell = c.createRadialGradient(-15, -22, 8, 0, 0, 100)
      shell.addColorStop(0, 'rgba(213,244,255,.015)')
      shell.addColorStop(.55, 'rgba(105,143,241,.055)')
      shell.addColorStop(.83, 'rgba(115,151,255,.13)')
      shell.addColorStop(.95, 'rgba(148,183,255,.30)')
      shell.addColorStop(1, 'rgba(213,234,255,.42)')
      c.beginPath(); c.arc(0, 0, 100, 0, Math.PI * 2); c.fillStyle = shell; c.fill()
      c.save(); c.clip()
      // A single low-contrast lattice, warped onto the curved dome.
      const project = (x: number, y: number) => {
        const d = Math.hypot(x, y) / 100
        const scale = d > .0001 ? Math.sin(Math.min(1, d) * Math.PI / 2) / d : Math.PI / 2
        return [x * scale, y * scale]
      }
      c.beginPath()
      for (let row = -5; row <= 5; row++) for (let col = -5; col <= 5; col++) {
        const x = col * 21 + (Math.abs(row) % 2) * 10.5, y = row * 18.2
        if (Math.hypot(x, y) > 89) continue
        for (let k = 0; k <= 6; k++) {
          const a = k * Math.PI / 3 + Math.PI / 6
          const p = project(x + Math.cos(a) * 12.1, y + Math.sin(a) * 12.1)
          if (k === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1])
        }
      }
      c.lineWidth = .55; c.strokeStyle = 'rgba(185,213,255,.15)'; c.stroke()
      const sheen = c.createRadialGradient(-32, -43, 0, -25, -35, 63)
      sheen.addColorStop(0, 'rgba(229,248,255,.19)'); sheen.addColorStop(.5, 'rgba(167,218,255,.065)'); sheen.addColorStop(1, 'rgba(167,218,255,0)')
      c.fillStyle = sheen; c.fillRect(-100, -100, 200, 200)
      // A travelling reflection, never an expanding area/entrance animation.
      const a = t * .18 - 2.3
      c.beginPath(); c.ellipse(0, 0, 91, sphere ? 57 : 38, -.45, a, a + 1.65)
      c.strokeStyle = 'rgba(198,226,255,.30)'; c.lineWidth = .8; c.stroke()
      if (sphere) {
        c.beginPath(); c.ellipse(0, 0, 91, 57, .75, a + Math.PI, a + Math.PI + 1.3)
        c.strokeStyle = 'rgba(179,191,255,.18)'; c.stroke()
      }
      c.restore()
      c.beginPath(); c.arc(0, 0, 100, 0, Math.PI * 2)
      c.strokeStyle = 'rgba(181,208,255,.75)'; c.lineWidth = 1.1
      c.shadowColor = '#8faeff'; c.shadowBlur = 5; c.stroke(); c.shadowBlur = 0
      // Broken specular highlights lend thickness without a second flat ring.
      for (const [start, end, opacity] of [[3.7, 4.65, .85], [.45, 1.28, .40]]) {
        c.beginPath(); c.arc(-.5, -.5, 98.3, start, end)
        c.strokeStyle = `rgba(235,251,255,${opacity})`; c.lineWidth = 1.7; c.lineCap = 'round'; c.stroke()
      }
      c.restore()
    }} />
  </Group>
})
