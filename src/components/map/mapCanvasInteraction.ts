import type { FogTool } from '../../lib/fogOfWar'
import type { GridCell } from '../../lib/gridCombat'
import type { MapGeometryTool } from '../../lib/mapGeometry'
import type { MapTabletopTool } from '../../lib/mapTabletop'

export function mapCanvasAoeGridCell(
  point: { x: number; y: number },
  grid: { gridSize: number; gridOffsetX: number; gridOffsetY: number },
): GridCell {
  const size = Math.max(1, grid.gridSize)
  return {
    col: Math.round((point.x - grid.gridOffsetX) / size - 0.5),
    row: Math.round((point.y - grid.gridOffsetY) / size - 0.5),
  }
}

export function mapCanvasTokenClickAction(
  areaTargeting: boolean,
): 'consume-area-click' | 'select-token' {
  return areaTargeting ? 'consume-area-click' : 'select-token'
}

export function mapCanvasGeometryDrawShouldStart(
  tool: MapGeometryTool,
  openingAttachedToWall: boolean,
): boolean {
  return (tool !== 'door' && tool !== 'window') || openingAttachedToWall
}

export function mapCanvasStageCanPan(input: {
  tabletopTool: MapTabletopTool
  measureMode: boolean
  moveSelectMode: boolean
  aoeSelectMode: boolean
  gridAdjustMode: boolean
  deleteSelectMode: boolean
  fogEditMode: boolean
  fogTool: FogTool
  geometryEditMode: boolean
  geometryTool: MapGeometryTool
  geometrySearchMode: boolean
  sceneEditMode: boolean
}): boolean {
  return input.tabletopTool === 'none' &&
    !input.measureMode &&
    !input.moveSelectMode &&
    !input.aoeSelectMode &&
    !input.gridAdjustMode &&
    !input.deleteSelectMode &&
    (!input.fogEditMode || input.fogTool === 'pan') &&
    // 门窗只在拖动起点贴近墙段时接管指针；从地图空白处开始拖动仍用于平移视口。
    (!input.geometryEditMode || ['select', 'door', 'window'].includes(input.geometryTool)) &&
    !input.geometrySearchMode &&
    !input.sceneEditMode
}
