import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { nearestWallEndpoint, snapGeometryDrawingPoint } from './wallEndpointSnap'

const geometry = createEmptyMapGeometry('map')
geometry.walls.push({ id: 'wall', kind: 'wall', label: 'wall', createdAt: 1, points: [{ x: 103, y: 107 }, { x: 203, y: 207 }, { x: 303, y: 307 }], blocksVision: true, blocksMovement: true, blocksLineOfEffect: true })
const options = { geometry, tool: 'wall' as const, scale: 1, snapToGrid: false, gridSize: 50 }
describe('wall endpoint snapping', () => {
  it('connects to exact off-grid wall vertices with grid snapping disabled or enabled', () => {
    for (const snapToGrid of [false, true]) expect(snapGeometryDrawingPoint({ x: 108, y: 110 }, { ...options, snapToGrid })).toEqual({ x: 103, y: 107 })
    expect(nearestWallEndpoint({ x: 205, y: 209 }, geometry, 1)).toEqual({ x: 203, y: 207 })
  })
  it('uses a constant ten screen pixel radius at every zoom', () => {
    for (const scale of [0.25, 1, 4]) {
      expect(nearestWallEndpoint({ x: 103 + 9 / scale, y: 107 }, geometry, scale)).toEqual({ x: 103, y: 107 })
      expect(nearestWallEndpoint({ x: 103 + 11 / scale, y: 107 }, geometry, scale)).toBeUndefined()
    }
  })
  it('leaves distant points free and preserves optional grid offsets and other tools', () => {
    const point = { x: 148, y: 164 }
    expect(snapGeometryDrawingPoint(point, options)).toEqual(point)
    expect(snapGeometryDrawingPoint(point, { ...options, snapToGrid: true, gridOffsetX: 3, gridOffsetY: 7 })).toEqual({ x: 153, y: 157 })
    expect(snapGeometryDrawingPoint({ x: 108, y: 110 }, { ...options, tool: 'obstacle' })).toEqual({ x: 108, y: 110 })
  })
})
