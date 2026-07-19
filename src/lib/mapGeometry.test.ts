import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import {
  createEmptyMapGeometry,
  mapGeometryCanSeeToken,
  mapGeometryCoverBetween,
  mapGeometryIlluminationAtPoint,
  mapGeometryMovementBlocked,
  mapGeometryVisibilityPolygon,
  normalizeSharedMapGeometry,
  type MapGeometryState,
} from './mapGeometry'

const token = (id: string, x: number, y: number, patch: Partial<Token> = {}): Token => ({
  id, label: id, x, y, color: '#fff', emoji: 'T', size: 1, type: 'player', ...patch,
})

const map: BattleMap = {
  id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [],
}

const geometry = (): MapGeometryState => ({
  ...createEmptyMapGeometry(map.id, 1),
  vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
  walls: [{
    id: 'wall', kind: 'wall', label: '墙', points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
  }],
  obstacles: [{
    id: 'crate', kind: 'obstacle', label: '木箱',
    points: [{ x: 200, y: 20 }, { x: 240, y: 20 }, { x: 240, y: 80 }, { x: 200, y: 80 }],
    blocksVision: false, blocksMovement: true, blocksLineOfEffect: false, cover: 'three-quarters',
    baseHeightFeet: 0, heightFeet: 5, createdAt: 1,
  }],
})

describe('map geometry', () => {
  it('blocks movement and line of sight with closed walls but allows elevated creatures to pass over them', () => {
    const g = geometry()
    expect(mapGeometryMovementBlocked({ geometry: g, map, token: token('a', 50, 50), to: { x: 150, y: 50 } }))
      .toMatchObject({ blocked: true, entityId: 'wall' })
    expect(mapGeometryMovementBlocked({
      geometry: g, map, token: token('flying', 50, 50, { elevationFeet: 15 }), to: { x: 150, y: 50 },
    }).blocked).toBe(false)
    expect(mapGeometryCanSeeToken({ geometry: g, map, viewer: token('a', 50, 50), target: token('b', 150, 50) }))
      .toBe(false)
    expect(mapGeometryCanSeeToken({
      geometry: g, map, viewer: token('a', 50, 50), target: token('high', 150, 50, { elevationFeet: 20 }),
    })).toBe(true)
    expect(mapGeometryCanSeeToken({
      geometry: g, map, viewer: token('a', 50, 50), target: token('low', 150, 50, { elevationFeet: 10 }),
    })).toBe(false)
  })

  it('treats open doors as passable and closed or locked doors as blocking', () => {
    const base = geometry()
    base.walls = []
    base.doors = [{
      id: 'door', kind: 'door', label: '门', points: [{ x: 100, y: 0 }, { x: 100, y: 100 }],
      state: 'open', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    expect(mapGeometryMovementBlocked({ geometry: base, map, token: token('a', 50, 50), to: { x: 150, y: 50 } }).blocked)
      .toBe(false)
    base.doors[0].state = 'locked'
    expect(mapGeometryMovementBlocked({ geometry: base, map, token: token('a', 50, 50), to: { x: 150, y: 50 } }).blocked)
      .toBe(true)
  })

  it('returns D&D 5e cover bonuses and total-cover line-of-effect blocking', () => {
    const g = geometry()
    expect(mapGeometryCoverBetween(g, token('a', 150, 50), token('b', 300, 50)))
      .toMatchObject({ cover: 'three-quarters', armorClassBonus: 5, blocksLineOfEffect: false })
    expect(mapGeometryCoverBetween(g, token('a', 50, 50), token('b', 150, 50)))
      .toMatchObject({ cover: 'total', blocksLineOfEffect: true, sourceEntityId: 'wall' })
  })

  it('builds a bounded visibility polygon and rejects malformed shared geometry', () => {
    const g = geometry()
    expect(mapGeometryVisibilityPolygon({ geometry: g, map, viewer: token('a', 50, 50) }).length).toBeGreaterThan(90)
    const shared = { schemaVersion: 1, maps: [g], updatedAt: 1 }
    expect(normalizeSharedMapGeometry(shared)?.maps).toHaveLength(1)
    expect(normalizeSharedMapGeometry({ ...shared, maps: [{ ...g, doors: [{ id: 'broken' }] }] })).toBeUndefined()
  })

  it('applies darkness, darkvision, and token light sources to visibility', () => {
    const g = geometry()
    g.walls = []
    g.vision.ambientLight = 'darkness'
    const viewer = token('viewer', 50, 50)
    const target = token('target', 100, 50, { type: 'enemy' })
    const darkMap = { ...map, tokens: [viewer, target] }
    expect(mapGeometryCanSeeToken({ geometry: g, map: darkMap, viewer, target })).toBe(false)
    expect(mapGeometryCanSeeToken({ geometry: g, map: darkMap, viewer: { ...viewer, darkvisionRangeFeet: 60 }, target })).toBe(true)

    const torch = token('torch', 50, 50, {
      lightSource: { enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fbbf24' },
    })
    const litMap = { ...map, tokens: [viewer, target, torch] }
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map: litMap, point: target })).toBe('bright')
    expect(mapGeometryCanSeeToken({ geometry: g, map: litMap, viewer, target })).toBe(true)
  })
})
