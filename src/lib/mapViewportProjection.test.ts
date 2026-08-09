import { describe, expect, it } from 'vitest'
import { mapWorldPointToViewport } from './mapViewportProjection'

describe('map viewport projection', () => {
  it('keeps a DOM overlay attached to its world point while the stage pans', () => {
    const point = { x: 280, y: 480 }

    expect(mapWorldPointToViewport(point, { x: 0, y: 0, scale: 1 })).toEqual({
      left: 280,
      top: 480,
    })
    expect(mapWorldPointToViewport(point, { x: -80, y: -25, scale: 1 })).toEqual({
      left: 200,
      top: 455,
    })
  })

  it('projects with the live stage scale', () => {
    expect(mapWorldPointToViewport(
      { x: 120, y: 90 },
      { x: 15, y: -20, scale: 1.5 },
    )).toEqual({ left: 195, top: 115 })
  })
})
