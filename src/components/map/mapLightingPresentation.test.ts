import { describe, expect, it } from 'vitest'
import {
  mapLightingAmbientOpacity,
  mapLightingGlowOpacity,
  mapLightingRadiusFromDrag,
  mapLightingShouldRender,
} from './mapLightingPresentation'

describe('map lighting presentation', () => {
  it('renders dim and dark environments even when dynamic vision is handled separately', () => {
    expect(mapLightingShouldRender('bright', false)).toBe(false)
    expect(mapLightingShouldRender('dim', false)).toBe(true)
    expect(mapLightingShouldRender('darkness', false)).toBe(true)
    expect(mapLightingShouldRender('bright', true)).toBe(true)
  })

  it('keeps the DM map readable while preserving a visible darkness difference', () => {
    expect(mapLightingAmbientOpacity('bright', true)).toBe(0)
    expect(mapLightingAmbientOpacity('dim', true)).toBeGreaterThan(0)
    expect(mapLightingAmbientOpacity('darkness', true)).toBeGreaterThan(
      mapLightingAmbientOpacity('dim', true),
    )
    expect(mapLightingAmbientOpacity('darkness', true)).toBeLessThan(
      mapLightingAmbientOpacity('darkness', false),
    )
    expect(mapLightingGlowOpacity('bright', 'darkness', true)).toBeGreaterThan(
      mapLightingGlowOpacity('dim', 'darkness', true),
    )
  })

  it('places a useful default light on click and derives its radius from a drag', () => {
    expect(mapLightingRadiusFromDrag({ distancePixels: 0, gridSize: 50, feetPerCell: 5 })).toBe(20)
    expect(mapLightingRadiusFromDrag({ distancePixels: 300, gridSize: 50, feetPerCell: 5 })).toBe(30)
  })
})
