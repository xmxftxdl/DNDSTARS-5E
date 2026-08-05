export interface MapCanvasViewportSize {
  width: number
  height: number
}

/**
 * The tabletop is an image-compositing surface, not an application panel.
 * Keep its matte stable across themes so transparent Konva frames never reveal
 * the light-theme panel background while the map bitmap is being decoded.
 */
export const MAP_CANVAS_MATTE_COLOR = '#0a0b16'

/** A zero-sized first frame avoids painting a guessed 800 x 600 Stage. */
export const MAP_CANVAS_UNMEASURED_SIZE: Readonly<MapCanvasViewportSize> = Object.freeze({
  width: 0,
  height: 0,
})

export function measureMapCanvasViewport(
  element: Pick<HTMLElement, 'clientWidth' | 'clientHeight'>,
): MapCanvasViewportSize {
  return {
    width: Math.max(0, element.clientWidth),
    height: Math.max(0, element.clientHeight),
  }
}

/** Konva must not mount a zero-sized Stage because cached shapes may draw immediately. */
export function mapCanvasViewportCanRender(size: MapCanvasViewportSize): boolean {
  return size.width > 0 && size.height > 0
}
