import { useMemo, useRef } from 'react'
import Konva from 'konva'
import { Group, Rect, Shape } from 'react-konva'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { usePrefersReducedMotion, useStatusAnimation, useTokenBadgeImage } from './mapEffectHooks'

/** Real flame atlas, crossfaded with a shared clock and staggered cell phases. */
export function WebBurningCells({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const root = useRef<Konva.Group>(null)
  const time = useRef(0)
  const flame = useTokenBadgeImage('/assets/vfx/wall-of-fire-sprite-v2.webp')
  const reducedMotion = usePrefersReducedMotion()
  const grid = Math.max(1, map.gridSize)
  const cells = useMemo(() => {
    const remaining = new Set(area.cells.map(cell => `${cell.col}:${cell.row}`))
    return (area.webState?.burningCells ?? []).filter(cell => remaining.has(`${cell.col}:${cell.row}`))
  }, [area.cells, area.webState?.burningCells])
  useStatusAnimation(() => root.current?.getLayer() ?? null, frame => {
    time.current = frame?.time ?? 0
  }, { active: !reducedMotion && cells.length > 0 && !!flame, fps: 24 })

  if (!cells.length) return null
  return <Group ref={root} listening={false} name="web-burning-cells">
    {cells.map(cell => <Group key={`${cell.col}:${cell.row}`}
      x={map.gridOffsetX + cell.col * grid} y={map.gridOffsetY + cell.row * grid}>
      <Rect width={grid} height={grid} fill="#9a350d" opacity={0.2} />
      {flame && <Shape listening={false} perfectDrawEnabled={false} sceneFunc={context => {
        const ctx = context._context
        const fw = flame.naturalWidth / 4
        const fh = flame.naturalHeight / 4
        const phase = ((cell.col * 137 + cell.row * 251) % 1120 + 1120) % 1120
        const elapsed = (reducedMotion ? 0 : time.current) + phase
        const step = Math.floor(elapsed / 140)
        const mix = (elapsed % 140) / 140
        const blend = mix * mix * (3 - 2 * mix)
        ctx.save()
        ctx.beginPath()
        ctx.rect(1, 1, Math.max(1, grid - 2), Math.max(1, grid - 2))
        ctx.clip()
        // Crop the mature flame body; omit the atlas's empty upper margin.
        // The two passes blend actual successive flame silhouettes, not scaled icons.
        for (let pass = 0; pass < 2; pass++) {
          const frame = 8 + ((step + pass) % 8)
          ctx.globalAlpha = pass === 0 ? 1 - blend : blend
          ctx.drawImage(flame,
            (frame % 4) * fw + fw * 0.16, Math.floor(frame / 4) * fh + fh * 0.29,
            fw * 0.68, fh * 0.5,
            0, grid * 0.02, grid, grid * 0.96)
        }
        ctx.restore()
      }} />}
      <Rect x={0.75} y={0.75} width={Math.max(1, grid - 1.5)} height={Math.max(1, grid - 1.5)}
        stroke="#f4a348" opacity={0.8} strokeWidth={1} />
    </Group>)}
  </Group>
}
