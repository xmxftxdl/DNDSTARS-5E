import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { originalPlaneSceneView } from './originalPlaneSceneView'

function fixture() {
  const map: BattleMap = { id: 'phase', name: 'Phase', width: 2000, height: 2000,
    gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'hero', characterId: 'hero', type: 'player', label: 'Hero',
      x: 1000, y: 1000, size: 1, color: '', emoji: '' }] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.vision.enabled = false
  return { map, geometry, viewerCharacterId: 'hero', materialSightRangeFeet: 60, isDM: false, worldMinute: 0 }
}

it('clips bright original-plane scenery at 60 feet even with dynamic vision disabled', () => {
  const input = fixture()
  const polygon = originalPlaneSceneView(input)![0]
  expect(polygon.length).toBeGreaterThan(3)
  expect(Math.max(...polygon.map(point => Math.hypot(point.x - 1000, point.y - 1000)))).toBeCloseTo(600)
  expect(input.geometry.vision.enabled).toBe(false)
})

it('retains wall clipping and does not use another character as a scenery viewer', () => {
  const input = fixture()
  input.map.tokens.push({ ...input.map.tokens[0], id: 'other', characterId: 'other', x: 1700 })
  input.geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', createdAt: 1,
    points: [{ x: 1100, y: 0 }, { x: 1100, y: 2000 }],
    baseHeightFeet: 0, heightFeet: 100, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true }]
  const polygons = originalPlaneSceneView(input)!
  expect(polygons).toHaveLength(1)
  expect(Math.max(...polygons[0].map(point => point.x))).toBeLessThanOrEqual(1100.001)
})

it('removes the scenery restriction on effect expiry and leaves the DM view unchanged', () => {
  const input = fixture()
  expect(originalPlaneSceneView({ ...input, materialSightRangeFeet: undefined })).toBeUndefined()
  expect(originalPlaneSceneView({ ...input, isDM: true })).toBeUndefined()
  expect(originalPlaneSceneView({ ...input, map: { ...input.map, tokens: [] } })).toEqual([])
})
