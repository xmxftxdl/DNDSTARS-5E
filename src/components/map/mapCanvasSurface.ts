export interface MapCanvasViewportSize {
  width: number
  height: number
}

/** The dark tabletop matte remains unchanged for the dark theme. */
export const MAP_CANVAS_MATTE_COLOR = '#0a0b16'

/**
 * Empty space outside the map image belongs to the application shell. In the
 * light theme it should blend into the surrounding workspace instead of
 * leaving a dark frame around the map and combat toolbar.
 */
export const MAP_CANVAS_LIGHT_MATTE_COLOR = '#f1f5f9'

export function mapCanvasMatteColor(theme: 'dark' | 'light'): string {
  return theme === 'light' ? MAP_CANVAS_LIGHT_MATTE_COLOR : MAP_CANVAS_MATTE_COLOR
}

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
