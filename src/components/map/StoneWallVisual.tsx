import { memo } from 'react'
import { Circle, Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import type { BattleMap } from '../../store/maps'
import type { StoneWallPanel } from '../../rulesets/dnd5e/stoneWall'
import { useTokenBadgeImage } from './mapEffectHooks'

import { stoneWallPanelPlacement } from './stoneWallPlacement'

/** Old saves contain occupied cells but no recoverable panel endpoints.
 * Keep their existing footprint exactly; never infer a stretched strip from it. */
export const LegacyStoneWallVisual = memo(function LegacyStoneWallVisual({ cells, map }: {
  cells: readonly { col: number; row: number }[]; map: BattleMap
}) {
  const image = useTokenBadgeImage('/assets/vfx/sequence-wall-of-stone-sprite-v1.png')
  const fw = image ? (image.naturalWidth || image.width) / 4 : 0
  const fh = image ? (image.naturalHeight || image.height) / 4 : 0
  const side = fh * .29
  return <Group listening={false}>
    {cells.map(cell => <Group key={`${cell.col},${cell.row}`}
      x={map.gridOffsetX + cell.col * map.gridSize} y={map.gridOffsetY + cell.row * map.gridSize}>
      <Rect width={map.gridSize} height={map.gridSize} fill="#78716c" />
      {image && <KonvaImage image={image}
        crop={{ x: fw * 2.065 + ((cell.col + cell.row) % 4 + 4) % 4 * side, y: fh * 2.365, width: side, height: side }}
        width={map.gridSize} height={map.gridSize} perfectDrawEnabled={false} />}
      <Rect x={.5} y={.5} width={map.gridSize - 1} height={map.gridSize - 1}
        stroke="rgba(41,37,36,0.45)" strokeWidth={1} />
    </Group>)}
  </Group>
})

/** Placement and persisted walls use identical endpoints and material bounds. */
export const StoneWallVisual = memo(function StoneWallVisual({ panels, map, preview = false, draftPanelId }: {
  panels: readonly StoneWallPanel[]; map: BattleMap; preview?: boolean; draftPanelId?: string
}) {
  const image = useTokenBadgeImage('/assets/vfx/sequence-wall-of-stone-sprite-v1.png')
  const thickness = Math.max(3, map.gridSize * .16)
  // The old full-frame crop included dust and large top/bottom margins.
  // Sample only the solid masonry in the mature frame, not its cast-in canvas.
  const fw = image ? (image.naturalWidth || image.width) / 4 : 0
  const fh = image ? (image.naturalHeight || image.height) / 4 : 0
  const crop = { x: fw * 2.065, y: fh * 2.365, width: fw * .87, height: fh * .29 }
  return <Group listening={false}>
    {panels.filter(panel => panel.hitPoints > 0).map((panel, index) => {
      const p = stoneWallPanelPlacement(panel, map)
      const draft = panel.id === draftPanelId
      return <Group key={panel.id}>
        <Group x={p.x} y={p.y} rotation={p.angle} opacity={draft ? .45 : 1}>
          <Line points={[-p.length / 2, 0, p.length / 2, 0]} stroke="#57534e" strokeWidth={thickness} lineCap="butt" />
          {image && <KonvaImage image={image} crop={crop} x={-p.length / 2} y={-thickness / 2}
            width={p.length} height={thickness} listening={false} perfectDrawEnabled={false} />}
          {preview && <Line points={[-p.length / 2, -thickness / 2 - 1, p.length / 2, -thickness / 2 - 1]}
            stroke={draft ? '#7dd3fc' : '#fcd34d'} strokeWidth={1.5} dash={draft ? [5, 4] : undefined} />}
        </Group>
        {preview && <>
          <Circle x={p.start.x} y={p.start.y} radius={2.5} fill="#fcd34d" />
          <Circle x={p.end.x} y={p.end.y} radius={2.5} fill={draft ? '#7dd3fc' : '#fcd34d'} />
        </>}
        <Text x={p.x - 20} y={p.y - thickness / 2 - 15} width={40} align="center"
          text={draft ? '预览' : panel.id.replace('panel-', '') || String(index + 1)} fontSize={11}
          fill={draft ? '#7dd3fc' : '#fff7ed'} stroke="#292524" strokeWidth={.4} />
      </Group>
    })}
  </Group>
})
