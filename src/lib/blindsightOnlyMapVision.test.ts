import { expect, it } from 'vitest'
import { mapGeometryCanSeePoint, mapGeometryVisibilityPolygon } from './mapGeometry'
import { applyDnd5eEffectiveVisionProfile, compileDnd5eEffectiveVisionProfile } from '../../shared/dnd5e-vision-profile.mjs'
import type { BattleMap, Token } from '../store/maps'

const map: BattleMap = { id: 'map', name: 'map', width: 3000, height: 3000, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [] }
const original: Token = { id: 'servant', label: 'servant', x: 1000, y: 1000, size: 1,
  type: 'enemy', color: '', emoji: '' }
const viewer: Token = JSON.parse(JSON.stringify(applyDnd5eEffectiveVisionProfile(original,
  compileDnd5eEffectiveVisionProfile({ monster: { senses: [{ name: '盲视', distanceFeet: 60, blindBeyond: true }] } }))))

it('retains the imported blind-beyond limit in the serialized map token and recompiled profile', () => {
  expect(viewer.blindBeyondBlindsight).toBe(true)
  expect(compileDnd5eEffectiveVisionProfile({ token: viewer }).blindBeyondBlindsight).toBe(true)
})

it('limits bright-light point perception to sixty feet even with dynamic vision off', () => {
  expect(mapGeometryCanSeePoint({ map, viewer, point: { x: 1600, y: 1000 } })).toBe(true)
  expect(mapGeometryCanSeePoint({ map, viewer, point: { x: 1650, y: 1000 } })).toBe(false)
  expect(mapGeometryCanSeePoint({ map, viewer: original, point: { x: 1650, y: 1000 } })).toBe(true)
})

it('clips the rendered polygon despite ambient light and an oversized range override', () => {
  const polygon = mapGeometryVisibilityPolygon({ map, viewer, forceEnabled: true, rangeOverrideFeet: 500 })
  expect(polygon.length).toBeGreaterThanOrEqual(3)
  expect(polygon.every(point => Math.hypot(point.x - viewer.x, point.y - viewer.y) <= 600.001)).toBe(true)
})
