import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import {
  createEmptyMapGeometry,
  DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  mapGeometryAttachOpeningToWall,
  mapGeometryCanSeeToken,
  mapGeometryCoverBetween,
  mapGeometryIlluminationAtPoint,
  mapGeometryMovementBlocked,
  mapGeometrySegments,
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

  it('snaps doors into a wall opening and removes the underlying wall blocker', () => {
    const g = geometry()
    const attachment = mapGeometryAttachOpeningToWall(g, { x: 94, y: 50 }, { x: 106, y: 150 }, 20)
    expect(attachment).toMatchObject({
      parentWallId: 'wall',
      parentWallSegmentIndex: 0,
      points: [{ x: 100, y: 50 }, { x: 100, y: 150 }],
    })
    g.doors = [{
      id: 'embedded-door', kind: 'door', label: '门', points: attachment!.points,
      parentWallId: attachment!.parentWallId, parentWallSegmentIndex: attachment!.parentWallSegmentIndex,
      state: 'open', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    expect(mapGeometrySegments(g).filter((segment) => segment.entityId === 'wall')).toHaveLength(2)
    expect(mapGeometryMovementBlocked({
      geometry: g, map, token: token('a', 50, 100), to: { x: 150, y: 100 },
    }).blocked).toBe(false)
    g.doors[0].state = 'closed'
    expect(mapGeometryMovementBlocked({
      geometry: g, map, token: token('a', 50, 100), to: { x: 150, y: 100 },
    })).toMatchObject({ blocked: true, entityId: 'embedded-door' })
  })

  it('lets an embedded window expose vision while retaining its movement and effect-line rules', () => {
    const g = geometry()
    g.windows = [{
      id: 'window', kind: 'window', label: '玻璃窗', points: [{ x: 100, y: 50 }, { x: 100, y: 150 }],
      parentWallId: 'wall', parentWallSegmentIndex: 0, windowType: 'glass',
      blocksVision: false, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    const viewer = token('viewer', 50, 100)
    const target = token('target', 150, 100, { type: 'enemy' })
    expect(mapGeometryCanSeeToken({ geometry: g, map, viewer, target })).toBe(true)
    expect(mapGeometryMovementBlocked({ geometry: g, map, token: viewer, to: target }))
      .toMatchObject({ blocked: true, entityId: 'window' })
    expect(mapGeometryCoverBetween(g, viewer, target))
      .toMatchObject({ cover: 'total', blocksLineOfEffect: true, sourceEntityId: 'window' })
    g.windows[0].windowState = 'broken'
    g.windows[0].cover = 'half'
    expect(mapGeometryCanSeeToken({ geometry: g, map, viewer, target })).toBe(true)
    expect(mapGeometryCoverBetween(g, viewer, target))
      .toMatchObject({ cover: 'half', armorClassBonus: 2, blocksLineOfEffect: false, sourceEntityId: 'window' })
    expect(mapGeometryMovementBlocked({ geometry: g, map, token: viewer, to: target }))
      .toMatchObject({ blocked: true, entityId: 'window' })
  })

  it('returns D&D 5e cover bonuses and total-cover line-of-effect blocking', () => {
    const g = geometry()
    expect(mapGeometryCoverBetween(g, token('a', 150, 50), token('b', 300, 50)))
      .toMatchObject({ cover: 'three-quarters', armorClassBonus: 5, blocksLineOfEffect: false })
    expect(mapGeometryCoverBetween(g, token('a', 50, 50), token('b', 150, 50)))
      .toMatchObject({ cover: 'total', blocksLineOfEffect: true, sourceEntityId: 'wall' })
  })

  it('treats another creature between attacker and target as half cover', () => {
    const attacker = token('attacker', 50, 100)
    const target = token('target', 250, 100, { type: 'enemy' })
    const ally = token('ally', 150, 100, { type: 'player' })
    const openMap = { ...map, gridSize: 50, tokens: [attacker, ally, target] }

    expect(mapGeometryCoverBetween(undefined, attacker, target, openMap)).toMatchObject({
      cover: 'half',
      armorClassBonus: 2,
      blocksLineOfEffect: false,
      sourceEntityId: 'creature:ally',
    })
    expect(mapGeometryCoverBetween(undefined, attacker, target, {
      ...openMap,
      tokens: [attacker, { ...ally, y: 220 }, target],
    })).toMatchObject({ cover: 'none', armorClassBonus: 0 })
  })

  it('does not grant creature cover when the attack ray passes above it', () => {
    const attacker = token('attacker', 50, 100, { elevationFeet: 15 })
    const target = token('target', 250, 100, { type: 'enemy', elevationFeet: 15 })
    const lowCreature = token('low', 150, 100, { type: 'npc', elevationFeet: 0 })
    expect(mapGeometryCoverBetween(undefined, attacker, target, {
      ...map,
      gridSize: 50,
      tokens: [attacker, lowCreature, target],
    })).toMatchObject({ cover: 'none', armorClassBonus: 0 })
  })

  it('builds a bounded visibility polygon and rejects malformed shared geometry', () => {
    const g = geometry()
    expect(mapGeometryVisibilityPolygon({ geometry: g, map, viewer: token('a', 50, 50) }).length).toBeGreaterThan(90)
    const shared = { schemaVersion: 1, maps: [g], updatedAt: 1 }
    expect(normalizeSharedMapGeometry(shared)?.maps).toHaveLength(1)
    expect(normalizeSharedMapGeometry({ ...shared, maps: [{ ...g, doors: [{ id: 'broken' }] }] })).toBeUndefined()
  })

  it('uses a 30-foot default and cuts filled fog even when dynamic vision is disabled', () => {
    const fresh = createEmptyMapGeometry(map.id, 1)
    expect(fresh.vision.defaultRangeFeet).toBe(DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET)
    const viewer = token('viewer', 250, 250)
    const polygon = mapGeometryVisibilityPolygon({
      geometry: fresh,
      map,
      viewer,
      forceEnabled: true,
      fallbackRangeFeet: DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
    })
    expect(polygon.length).toBeGreaterThan(90)
    const radiusPx = DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET / (map.feetPerCell ?? 5) * map.gridSize
    expect(Math.max(...polygon.map((point) => Math.hypot(point.x - viewer.x, point.y - viewer.y))))
      .toBeLessThanOrEqual(radiusPx + 0.001)
  })

  it('clips forced fog vision at a closed door and reveals through it after opening', () => {
    const g = createEmptyMapGeometry(map.id, 1)
    g.doors = [{
      id: 'vision-door', kind: 'door', label: '门',
      points: [{ x: 300, y: 0 }, { x: 300, y: 500 }], state: 'closed', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    const viewer = token('viewer', 250, 250)
    const eastPoint = () => mapGeometryVisibilityPolygon({
      geometry: g, map, viewer, forceEnabled: true,
      fallbackRangeFeet: DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
    }).reduce((nearest, point) => (
      Math.abs(Math.atan2(point.y - viewer.y, point.x - viewer.x)) <
      Math.abs(Math.atan2(nearest.y - viewer.y, nearest.x - viewer.x)) ? point : nearest
    ))
    expect(eastPoint().x).toBeCloseTo(300, 3)
    g.doors[0].state = 'open'
    expect(eastPoint().x).toBeCloseTo(map.width, 3)
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

  it('stops timed token lights from illuminating after their campaign expiry', () => {
    const g = geometry()
    g.walls = []
    g.vision.ambientLight = 'darkness'
    const viewer = token('viewer', 50, 50)
    const target = token('target', 100, 50, { type: 'enemy' })
    const torch = token('torch', 50, 50, {
      lightSource: {
        enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fbbf24',
        sourceKind: 'torch', startedAtWorldMinute: 480, durationMinutes: 60, expiresAtWorldMinute: 540,
      },
    })
    const litMap = { ...map, tokens: [viewer, target, torch] }
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map: litMap, point: target, worldMinute: 539 })).toBe('bright')
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map: litMap, point: target, worldMinute: 540 })).toBe('darkness')
    expect(mapGeometryCanSeeToken({ geometry: g, map: litMap, viewer, target, worldMinute: 540 })).toBe(false)
  })

  it('keeps the normal terrain envelope in darkness while creature visibility still requires light', () => {
    const g = geometry()
    g.walls = []
    g.vision.ambientLight = 'darkness'
    g.vision.defaultRangeFeet = 10
    const viewer = token('viewer', 250, 250)
    const polygon = mapGeometryVisibilityPolygon({ geometry: g, map, viewer })
    expect(polygon.length).toBeGreaterThan(90)
    expect(Math.max(...polygon.map((point) => Math.hypot(point.x - viewer.x, point.y - viewer.y))))
      .toBeLessThanOrEqual(100.001)
    expect(mapGeometryCanSeeToken({
      geometry: g,
      map: { ...map, tokens: [viewer] },
      viewer,
      target: token('unlit', 300, 250, { type: 'enemy' }),
    })).toBe(false)
  })

  it('supports independent scene lights with wall shadows and legacy geometry migration', () => {
    const g = geometry()
    g.vision.ambientLight = 'darkness'
    g.lights = [{
      id: 'sconce', kind: 'light', label: '壁灯', points: [{ x: 50, y: 50 }], enabled: true,
      brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fbbf24', elevationFeet: 5, createdAt: 1,
    }]
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map, point: { x: 75, y: 50 } })).toBe('bright')
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map, point: { x: 150, y: 50 } })).toBe('darkness')

    const normalized = normalizeSharedMapGeometry({
      schemaVersion: 1,
      maps: [{ ...g, lights: undefined }],
      updatedAt: 1,
    })
    expect(normalized?.maps[0].lights).toEqual([])
    expect(normalized?.maps[0].windows).toEqual([])
    expect(normalized?.maps[0].walls[0].material).toBe('stone')
  })

  it('migrates V1 openings to explicit wall attachments and always emits Schema V2', () => {
    const g = geometry()
    g.doors = [{
      id: 'legacy-door', kind: 'door', label: '旧门', points: [{ x: 100, y: 40 }, { x: 100, y: 80 }],
      state: 'closed', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    const normalized = normalizeSharedMapGeometry({ schemaVersion: 1, maps: [g], updatedAt: 2 })
    expect(normalized).toMatchObject({ schemaVersion: 2 })
    expect(normalized?.maps[0].doors[0]).toMatchObject({
      parentWallId: 'wall',
      parentWallSegmentIndex: 0,
      points: [{ x: 100, y: 40 }, { x: 100, y: 80 }],
    })
    expect(normalizeSharedMapGeometry({ schemaVersion: '1', maps: [g], updatedAt: 2 })).toBeUndefined()
    expect(normalizeSharedMapGeometry({ schemaVersion: 3, maps: [g], updatedAt: 2 })).toBeUndefined()
  })
})
