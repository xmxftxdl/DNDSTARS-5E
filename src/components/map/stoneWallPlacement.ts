import type { BattleMap } from '../../store/maps'
import type { StoneWallPanel } from '../../rulesets/dnd5e/stoneWall'

export function stoneWallPanelPlacement(panel: StoneWallPanel, map: Pick<BattleMap, 'gridSize' | 'gridOffsetX' | 'gridOffsetY'>) {
  const start = { x: map.gridOffsetX + (panel.start.col + .5) * map.gridSize, y: map.gridOffsetY + (panel.start.row + .5) * map.gridSize }
  const end = { x: map.gridOffsetX + (panel.end.col + .5) * map.gridSize, y: map.gridOffsetY + (panel.end.row + .5) * map.gridSize }
  return { start, end, x: (start.x + end.x) / 2, y: (start.y + end.y) / 2,
    length: Math.hypot(end.x - start.x, end.y - start.y), angle: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI }
}

