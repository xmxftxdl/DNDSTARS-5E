import { describe, expect, it } from 'vitest'
import {
  mapSavingThrowMarkerDiameter,
  mapSavingThrowMarkerUsesCompactLabel,
} from './mapSavingThrowMarker'

describe('map saving-throw marker', () => {
  it('shrinks with a zoomed-out Token instead of retaining the old 52px ring', () => {
    const diameter = mapSavingThrowMarkerDiameter({ gridSize: 50, tokenSize: 1, viewScale: 0.25 })
    expect(diameter).toBe(14)
    expect(mapSavingThrowMarkerUsesCompactLabel(diameter)).toBe(true)
  })

  it('continues to surround large Tokens at normal zoom', () => {
    const diameter = mapSavingThrowMarkerDiameter({ gridSize: 50, tokenSize: 3, viewScale: 1 })
    expect(diameter).toBe(152)
    expect(mapSavingThrowMarkerUsesCompactLabel(diameter)).toBe(false)
  })

  it('uses the actual half-cell portrait diameter instead of its nominal footprint', () => {
    const diameter = mapSavingThrowMarkerDiameter({ gridSize: 50, tokenSize: 0.5, viewScale: 1 })
    expect(diameter).toBe(22)
    expect(mapSavingThrowMarkerUsesCompactLabel(diameter)).toBe(true)
  })
})
