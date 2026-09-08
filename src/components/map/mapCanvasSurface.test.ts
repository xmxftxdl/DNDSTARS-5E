import { describe, expect, it } from 'vitest'
import {
  MAP_CANVAS_LIGHT_MATTE_COLOR,
  MAP_CANVAS_MATTE_COLOR,
  MAP_CANVAS_UNMEASURED_SIZE,
  mapCanvasMatteColor,
  mapCanvasViewportCanRender,
  measureMapCanvasViewport,
} from './mapCanvasSurface'

describe('map canvas refresh surface', () => {
  it('starts without a guessed Stage rectangle', () => {
    expect(MAP_CANVAS_UNMEASURED_SIZE).toEqual({ width: 0, height: 0 })
    expect(mapCanvasViewportCanRender(MAP_CANVAS_UNMEASURED_SIZE)).toBe(false)
    expect(mapCanvasViewportCanRender({ width: 1440, height: 900 })).toBe(true)
  })

  it('uses a workspace-colored matte for each application theme', () => {
    expect(MAP_CANVAS_MATTE_COLOR).toBe('#0a0b16')
    expect(MAP_CANVAS_LIGHT_MATTE_COLOR).toBe('#f1f5f9')
    expect(mapCanvasMatteColor('dark')).toBe(MAP_CANVAS_MATTE_COLOR)
    expect(mapCanvasMatteColor('light')).toBe(MAP_CANVAS_LIGHT_MATTE_COLOR)
  })

  it('measures the real container and clamps unavailable dimensions', () => {
    expect(measureMapCanvasViewport({ clientWidth: 1440, clientHeight: 900 })).toEqual({
      width: 1440,
      height: 900,
    })
    expect(measureMapCanvasViewport({ clientWidth: -1, clientHeight: 0 })).toEqual({
      width: 0,
      height: 0,
    })
  })
})
