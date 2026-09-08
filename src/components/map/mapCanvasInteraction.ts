import type { FogTool } from '../../lib/fogOfWar'
import { clampGridSize, type GridCell } from '../../lib/gridCombat'
import type { MapGeometryTool } from '../../lib/mapGeometry'
import type { MapTabletopTool } from '../../lib/mapTabletop'

export interface MapCanvasViewportDatasetTarget {
  dataset: {
    viewportX?: string
    viewportY?: string
    viewportScale?: string
  }
}

/**
 * Publishes Konva's live viewport transform without forcing a React render.
 * DOM overlays can read this during a drag instead of waiting for the final
 * state commit on pointer release.
 */
export function syncMapCanvasViewportDataset(
  target: MapCanvasViewportDatasetTarget | null,
  viewport: { x: number; y: number; scale: number },
): void {
  if (!target) return
  target.dataset.viewportX = String(viewport.x)
  target.dataset.viewportY = String(viewport.y)
  target.dataset.viewportScale = String(viewport.scale)
}

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
  movementTargeting = false,
): 'consume-area-click' | 'select-movement-destination' | 'select-token' {
  if (movementTargeting) return 'select-movement-destination'
  return areaTargeting ? 'consume-area-click' : 'select-token'
}

/**
 * Effect-token areas are persisted as both a Token and an area snapshot. During
 * a drag (and briefly while the area snapshot catches up after the Token save),
 * render the area at the Token's visual position without mutating either source
 * of authority.
 */
export function mapCanvasEffectTokenAreaRenderOffset(input: {
  anchorMode?: string
  areaAnchorPosition?: { x: number; y: number }
  anchorTokenPosition?: { x: number; y: number }
  dragPreviewPosition?: { x: number; y: number }
}): { x: number; y: number } {
  if (input.anchorMode !== 'effect-token' || !input.areaAnchorPosition) {
    return { x: 0, y: 0 }
  }
  const visualPosition = input.dragPreviewPosition ?? input.anchorTokenPosition
  if (
    !visualPosition ||
    ![
      input.areaAnchorPosition.x,
      input.areaAnchorPosition.y,
      visualPosition.x,
      visualPosition.y,
    ].every(Number.isFinite)
  ) {
    return { x: 0, y: 0 }
  }
  return {
    x: visualPosition.x - input.areaAnchorPosition.x,
    y: visualPosition.y - input.areaAnchorPosition.y,
  }
}

export function mapCanvasGeometryDrawShouldStart(
  tool: MapGeometryTool,
  openingAttachedToWall: boolean,
): boolean {
  return (tool !== 'door' && tool !== 'window') || openingAttachedToWall
}

/**
 * Geometry visibility is independent from geometry interaction. Players must
 * always see the server-projected walls, doors, and windows even when their
 * current mode does not allow clicking those entities.
 */
export function mapCanvasGeometryOverlayVisible(input: {
  isDM: boolean
  hasGeometry: boolean
  hasDraft: boolean
}): boolean {
  return input.isDM || input.hasGeometry || input.hasDraft
}

/**
 * Geometry tools reserve the primary button for selecting and drawing. Holding
 * the secondary button temporarily switches the canvas to viewport panning,
 * without changing the selected entity or the active geometry tool.
 */
export function mapCanvasGeometryRightButtonPanShouldStart(input: {
  button: number
  geometryEditMode: boolean
}): boolean {
  return input.geometryEditMode && input.button === 2
}

/** Grid calibration re-snaps authoritative Token coordinates on every step. */
export function mapCanvasTokenUsesInstantPosition(input: {
  gridAdjustMode: boolean
  gridSizePreview: boolean
  hasDragPreview: boolean
}): boolean {
  return input.gridAdjustMode || input.gridSizePreview || input.hasDragPreview
}

/**
 * Wheel events can arrive faster than React can echo the controlled map prop.
 * Always accumulate them from the imperative interaction value instead of the
 * last rendered value, otherwise several notches collapse into one and appear
 * to bounce backwards.
 */
export function mapCanvasGridSizeAfterWheel(input: {
  currentGridSize: number
  mapWidth: number
  deltaY: number
  shiftKey: boolean
}): number {
  const step = input.shiftKey ? 3 : 1
  const delta = input.deltaY > 0 ? -step : step
  return clampGridSize(input.currentGridSize + delta, { width: input.mapWidth })
}

/** Grid calibration hotkeys must not steal arrows from native form controls. */
export function mapCanvasGridHotkeyUsesEditableTarget(target: EventTarget | null): boolean {
  const candidate = target as {
    tagName?: string
    isContentEditable?: boolean
  } | null
  const tagName = candidate?.tagName?.toLowerCase()
  return candidate?.isContentEditable === true ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
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
