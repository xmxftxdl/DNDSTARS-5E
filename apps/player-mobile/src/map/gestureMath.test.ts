import { describe, expect, it } from 'vitest'
import { cameraForPinch, mobileTouchMetrics } from './gestureMath'

describe('mobile map pinch math', () => {
  it('uses view-local touch coordinates when available', () => {
    expect(mobileTouchMetrics([
      { pageX: 110, pageY: 220, locationX: 10, locationY: 20 },
      { pageX: 210, pageY: 220, locationX: 110, locationY: 20 },
    ])).toEqual({ centerX: 60, centerY: 20, distance: 100 })
  })

  it('zooms around the two-finger centre without moving its world anchor', () => {
    const next = cameraForPinch(
      { x: 20, y: 10, scale: 1 },
      { centerX: 120, centerY: 110, distance: 100 },
      { centerX: 140, centerY: 120, distance: 200 },
      .035,
      3,
    )
    expect(next).toEqual({ x: -60, y: -80, scale: 2 })
    expect((140 - next.x) / next.scale).toBe(100)
    expect((120 - next.y) / next.scale).toBe(100)
  })
})
