import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import {
  createEmptyMapGeometry,
  DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  mapGeometryAttachOpeningToWall,
  mapGeometryCanSeeToken,
  mapGeometryCoverBetween,
  mapGeometryIlluminationAtPoint,
  mapGeometryLineOfEffectBlocked,
  mapGeometryLineOfSightBlocked,
  mapGeometryGridSelectionBoundary,
  dnd5ePersistentAreaTeleportationBlocker,
  dnd5ePersistentAreaTeleportationBoundary,
  mapGeometryMovementBlocked,
  mapGeometryOrdinaryProjectileBlocked,
  mapGeometrySegments,
  mapGeometrySimplifyTerrainRegionPoints,
  mapGeometryTokenElevation,
  mapGeometryVisibilityPolygon,
  mapGeometryVisibleTargets,
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

  it('opens only the mapped barrier volume covered by a persistent passage', () => {
    const g = geometry()
    const walker = token('walker', 50, 75)
    const passageMap: BattleMap = {
      ...map,
      tokens: [walker],
      dnd5ePluginAreas: [{
        id: 'passwall-opening', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:passwall',
        sourceKind: 'core-spell', coreSpellId: 'passwall', label: '穿墙术', color: '#a78bfa',
        sourceCharacterId: 'caster', sourceTokenId: walker.id,
        cells: [{ col: 2, row: 1 }], anchorCell: { col: 2, row: 1 }, anchorMode: 'fixed',
        createdRound: 1, expiresAfterRound: 600,
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 8 },
        blocking: { suppressesMappedBarriers: true },
      }],
    }
    expect(mapGeometryMovementBlocked({
      geometry: g, map: passageMap, token: walker, to: { x: 150, y: 75 },
    }).blocked).toBe(false)
    expect(mapGeometryLineOfSightBlocked({
      geometry: g, map: passageMap, from: walker, to: { x: 150, y: 75 },
    })).toBe(false)
    expect(mapGeometryLineOfEffectBlocked({
      geometry: g, map: passageMap, from: walker, to: { x: 150, y: 75 },
    })).toBe(false)

    expect(mapGeometryMovementBlocked({
      geometry: g, map: passageMap, token: token('outside-opening', 50, 150), to: { x: 150, y: 150 },
    })).toMatchObject({ blocked: true, entityId: 'wall' })
  })

  it('treats persistent wall declarations as authoritative movement, vision and effect-line blockers', () => {
    const viewer = token('viewer', 25, 25)
    const target = token('target', 125, 25, { type: 'enemy' })
    const wallMap: BattleMap = {
      ...map,
      tokens: [viewer, target],
      dnd5ePluginAreas: [{
        id: 'force-wall', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:wall-of-stone',
        sourceKind: 'core-spell', coreSpellId: 'wall-of-stone', label: '石墙术', color: '#78716c',
        sourceCharacterId: 'caster', sourceTokenId: viewer.id,
        cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, anchorMode: 'fixed',
        createdRound: 1, expiresAfterRound: 100,
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
        blocking: { movement: true, vision: true, lineOfEffect: true },
      }],
    }
    expect(mapGeometryMovementBlocked({ map: wallMap, token: viewer, to: target }))
      .toMatchObject({ blocked: true, entityId: 'force-wall' })
    expect(mapGeometryCoverBetween(undefined, viewer, target, wallMap))
      .toMatchObject({ cover: 'total', blocksLineOfEffect: true, sourceEntityId: 'force-wall' })
    expect(mapGeometryCanSeeToken({ map: wallMap, viewer, target, forceEnabled: true })).toBe(false)
    const visibility = mapGeometryVisibilityPolygon({ map: wallMap, viewer, forceEnabled: true })
    const forwardPoints = visibility.filter((point) => Math.abs(point.y - viewer.y) < 1)
    expect(Math.max(...forwardPoints.map((point) => point.x))).toBeLessThanOrEqual(50.001)
    expect(mapGeometryMovementBlocked({
      map: wallMap,
      token: { ...viewer, elevationFeet: 15 },
      to: { x: target.x, y: target.y },
      fromElevationFeet: 15,
      toElevationFeet: 15,
    }).blocked).toBe(false)
  })

  it('supports typed directional ward boundaries without trapping creatures already inside', () => {
    const caster = token('caster', 75, 25)
    const livingOutside = token('living', 25, 25, { type: 'enemy', creatureTypes: ['类人生物'] })
    const livingInside = token('inside', 75, 25, { type: 'enemy', creatureTypes: ['类人生物'] })
    const undead = token('undead', 25, 25, { type: 'enemy', creatureTypes: ['亡灵'] })
    const wardMap: BattleMap = {
      ...map,
      tokens: [caster, livingOutside, livingInside, undead],
      dnd5ePluginAreas: [{
        id: 'antilife-shell', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:antilife-shell',
        sourceKind: 'core-spell', coreSpellId: 'antilife-shell', label: '防生物力场', color: '#8b5cf6',
        sourceCharacterId: 'caster-character', sourceTokenId: caster.id,
        cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, anchorMode: 'source-token',
        createdRound: 1, expiresAfterRound: 100,
        blocking: {
          movement: true, movementMode: 'enter', excludeSourceToken: true,
          excludedCreatureTypes: ['construct', 'undead'],
        },
      }],
    }
    expect(mapGeometryMovementBlocked({ map: wardMap, token: livingOutside, to: { x: 75, y: 25 } }))
      .toMatchObject({ blocked: true, entityId: 'antilife-shell' })
    expect(mapGeometryMovementBlocked({ map: wardMap, token: livingInside, to: { x: 25, y: 25 } }).blocked)
      .toBe(false)
    expect(mapGeometryMovementBlocked({ map: wardMap, token: undead, to: { x: 75, y: 25 } }).blocked)
      .toBe(false)
    expect(mapGeometryMovementBlocked({ map: wardMap, token: caster, to: { x: 25, y: 25 } }).blocked)
      .toBe(false)
  })

  it('blocks teleport entry and exit from persistent-area boundary declarations without treating teleport as a path', () => {
    const outside = token('outside', 25, 25)
    const inside = token('inside', 75, 25)
    const wardMap: BattleMap = {
      ...map,
      tokens: [outside, inside],
      dnd5ePluginAreas: [{
        id: 'private-sanctum', pluginId: 'srd-5.1', featureId: 'spell:private-sanctum',
        sourceKind: 'core-spell', coreSpellId: 'private-sanctum', label: '秘法圣所', color: '#8b5cf6',
        sourceCharacterId: 'caster', sourceTokenId: 'caster', cells: [{ col: 1, row: 0 }],
        createdRound: 1, expiresAfterRound: 100,
        blocking: { blocksTeleportationEntry: true, blocksTeleportationExit: true },
      }],
    }
    expect(dnd5ePersistentAreaTeleportationBlocker({
      map: wardMap, token: outside, from: outside, to: inside,
    })).toBe('private-sanctum')
    expect(dnd5ePersistentAreaTeleportationBlocker({
      map: wardMap, token: inside, from: inside, to: outside,
    })).toBe('private-sanctum')
    expect(dnd5ePersistentAreaTeleportationBlocker({
      map: wardMap, token: outside, from: outside, to: { x: 125, y: 25 },
    })).toBeUndefined()
  })

  it('returns a bounded saving-throw contract for teleporting out of a ward', () => {
    const inside = token('inside', 75, 25)
    const outside = token('outside', 125, 25)
    const wardMap: BattleMap = {
      ...map,
      tokens: [inside],
      dnd5ePluginAreas: [{
        id: 'forcecage', pluginId: 'srd-5.1', featureId: 'spell:forcecage',
        sourceKind: 'core-spell', coreSpellId: 'forcecage', label: '力场囚笼', color: '#8b5cf6',
        sourceCharacterId: 'caster', sourceTokenId: 'caster', cells: [{ col: 1, row: 0 }],
        createdRound: 1, expiresAfterRound: 600,
        blocking: {
          blocksTeleportationExit: true,
          teleportationExitSavingThrow: { ability: 'cha', dc: 17 },
        },
      }],
    }
    expect(dnd5ePersistentAreaTeleportationBoundary({
      map: wardMap, token: inside, from: inside, to: outside,
    })).toEqual({
      areaId: 'forcecage', areaLabel: '力场囚笼',
      savingThrow: { ability: 'cha', dc: 17 },
    })
    expect(dnd5ePersistentAreaTeleportationBlocker({
      map: wardMap, token: inside, from: inside, to: outside,
    })).toBe('forcecage')
  })

  it('enforces Tiny Hut occupant permissions and directional spell/vision boundaries', () => {
    const authorized = token('authorized', 25, 25)
    const outsider = token('outsider', 25, 75, { type: 'enemy' })
    const inside = { x: 75, y: 25 }
    const hutMap: BattleMap = {
      ...map,
      tokens: [authorized, outsider],
      dnd5ePluginAreas: [{
        id: 'tiny-hut', pluginId: 'srd-5.1', featureId: 'spell:tiny-hut',
        sourceKind: 'core-spell', coreSpellId: 'tiny-hut', label: '小屋', color: '#8b5cf6',
        sourceCharacterId: 'caster', sourceTokenId: 'authorized', cells: [{ col: 1, row: 0 }],
        createdRound: 1, expiresAfterRound: 4_800,
        illuminationOverride: 'darkness',
        blocking: {
          movement: true,
          movementMode: 'enter',
          entryPermission: 'occupants-at-creation',
          authorizedTokenIds: ['authorized'],
          blocksTeleportationEntry: true,
          vision: true,
          visionMode: 'outside-in',
          lineOfEffect: true,
          lineOfEffectMode: 'boundary',
        },
      }],
    }

    expect(mapGeometryMovementBlocked({ map: hutMap, token: authorized, to: inside }).blocked).toBe(false)
    expect(mapGeometryMovementBlocked({ map: hutMap, token: outsider, to: inside }))
      .toMatchObject({ blocked: true, entityId: 'tiny-hut' })
    expect(dnd5ePersistentAreaTeleportationBlocker({
      map: hutMap, token: authorized, from: authorized, to: inside,
    })).toBeUndefined()
    expect(dnd5ePersistentAreaTeleportationBlocker({
      map: hutMap, token: outsider, from: outsider, to: inside,
    })).toBe('tiny-hut')

    expect(mapGeometryLineOfEffectBlocked({
      map: hutMap, from: { x: 60, y: 25 }, to: { x: 90, y: 25 },
    })).toBe(false)
    expect(mapGeometryLineOfEffectBlocked({ map: hutMap, from: inside, to: { x: 125, y: 25 } })).toBe(true)
    expect(mapGeometryLineOfEffectBlocked({ map: hutMap, from: { x: 25, y: 25 }, to: inside })).toBe(true)
    expect(mapGeometryLineOfSightBlocked({ map: hutMap, from: inside, to: { x: 125, y: 25 } })).toBe(false)
    expect(mapGeometryLineOfSightBlocked({ map: hutMap, from: { x: 25, y: 25 }, to: inside })).toBe(true)
    expect(mapGeometryIlluminationAtPoint({ map: hutMap, point: inside })).toBe('darkness')
    expect(mapGeometryIlluminationAtPoint({ map: hutMap, point: { x: 125, y: 25 } })).toBe('bright')
    expect(mapGeometryIlluminationAtPoint({
      map: {
        ...hutMap,
        dnd5ePluginAreas: hutMap.dnd5ePluginAreas?.map((area) => ({
          ...area,
          illuminationOverride: 'dim' as const,
        })),
      },
      point: inside,
    })).toBe('dim')
  })

  it('blocks ordinary sight through a heavy-obscuration persistent area, including when both endpoints are outside', () => {
    const viewer = token('viewer', 25, 25)
    const target = token('target', 125, 25, { type: 'enemy' })
    const fogMap: BattleMap = {
      ...map,
      tokens: [viewer, target],
      dnd5ePluginAreas: [{
        id: 'fog', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:fog-cloud',
        sourceKind: 'core-spell', coreSpellId: 'fog-cloud', label: '云雾术', color: '#94a3b8',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
        cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, anchorMode: 'fixed',
        createdRound: 1, expiresAfterRound: 600,
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 40 },
        obscuration: { kind: 'heavy' },
      }],
    }
    expect(mapGeometryCanSeeToken({ map: fogMap, viewer, target, forceEnabled: true })).toBe(false)
    const visibility = mapGeometryVisibilityPolygon({ map: fogMap, viewer, forceEnabled: true })
    expect(Math.max(...visibility.filter((point) => Math.abs(point.y - viewer.y) < 1).map((point) => point.x)))
      .toBeLessThanOrEqual(50.001)
    expect(mapGeometryCanSeeToken({
      map: fogMap,
      viewer: { ...viewer, blindsightRangeFeet: 30 },
      target,
      forceEnabled: true,
    })).toBe(true)
  })

  it('keeps elevated authoritative targets visible even when the ground-plane mask stops at a wall', () => {
    const g = geometry()
    const viewer = token('viewer', 50, 50)
    const groundTarget = token('ground', 150, 50, { type: 'enemy' })
    const flyingTarget = token('flying', 150, 50, { type: 'enemy', elevationFeet: 20 })
    const visible = mapGeometryVisibleTargets({
      geometry: g,
      map: { ...map, tokens: [viewer, groundTarget, flyingTarget] },
      viewers: [viewer],
    })
    expect(visible.map((target) => target.id)).toContain('flying')
    expect(visible.map((target) => target.id)).not.toContain('ground')
    const polygon = mapGeometryVisibilityPolygon({ geometry: g, map, viewer })
    expect(Math.max(...polygon.filter((point) => Math.abs(point.y - viewer.y) < 1).map((point) => point.x)))
      .toBeLessThanOrEqual(100.001)
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

  it('samples cover rays at each entity body height', () => {
    const lowWall = geometry()
    lowWall.walls = [{
      ...lowWall.walls[0],
      points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
      heightFeet: 8,
    }]
    lowWall.obstacles = []
    const mediumAttacker = token('medium-attacker', 10, 50)
    const mediumTarget = token('medium-target', 90, 50, { type: 'enemy' })
    const tallAttacker = { ...mediumAttacker, id: 'tall-attacker', size: 4 }
    const tallTarget = { ...mediumTarget, id: 'tall-target', size: 4 }
    const mediumRayMap = { ...map, gridSize: 10, tokens: [mediumAttacker, mediumTarget] }
    const tallRayMap = { ...map, gridSize: 10, tokens: [tallAttacker, tallTarget] }

    expect(mapGeometryCoverBetween(lowWall, mediumAttacker, mediumTarget, mediumRayMap))
      .toMatchObject({ cover: 'total', blocksLineOfEffect: true, sourceEntityId: 'wall' })
    expect(mapGeometryCoverBetween(lowWall, tallAttacker, tallTarget, tallRayMap))
      .toMatchObject({ cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false })
    expect(mapGeometryLineOfSightBlocked({
      geometry: lowWall,
      from: mediumAttacker,
      to: mediumTarget,
    })).toBe(true)
    expect(mapGeometryLineOfSightBlocked({
      geometry: lowWall,
      from: tallAttacker,
      to: tallTarget,
    })).toBe(false)

    lowWall.walls = []
    lowWall.obstacles = [{
      id: 'low-barricade',
      kind: 'obstacle',
      label: 'Low barricade',
      points: [{ x: 45, y: 0 }, { x: 55, y: 0 }, { x: 55, y: 100 }, { x: 45, y: 100 }],
      cover: 'three-quarters',
      blocksVision: false,
      blocksMovement: true,
      blocksLineOfEffect: false,
      baseHeightFeet: 0,
      heightFeet: 5,
      createdAt: 1,
    }]
    expect(mapGeometryCoverBetween(lowWall, mediumAttacker, mediumTarget, mediumRayMap))
      .toMatchObject({ cover: 'three-quarters', armorClassBonus: 5 })
    expect(mapGeometryCoverBetween(lowWall, tallAttacker, tallTarget, tallRayMap))
      .toMatchObject({ cover: 'none', armorClassBonus: 0 })
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

  it('blocks ordinary projectiles and only Small airborne or gaseous creatures at Wind Wall', () => {
    const wall = {
      id: 'wind-wall-area', sourceKind: 'core-spell' as const, coreSpellId: 'wind-wall',
      pluginId: 'srd-5.1', featureId: 'spell:wind-wall', color: '#ffffff',
      label: 'Wind Wall', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 3, sourceSpellSaveDc: 15, createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'fixed' as const, cells: [{ col: 2, row: 0 }],
      vertical: { mode: 'volume' as const, baseElevationFeet: 0, heightFeet: 15 },
      blocking: { movement: true, movementMode: 'boundary' as const },
    }
    const attacker = token('attacker', 25, 25)
    const target = token('target', 225, 25, { type: 'enemy' })
    const wallMap = { ...map, tokens: [attacker, target], dnd5ePluginAreas: [wall] }
    expect(mapGeometryOrdinaryProjectileBlocked({ map: wallMap, from: attacker, to: target })).toBe(true)

    expect(mapGeometryMovementBlocked({
      map: wallMap,
      token: token('medium-flyer', 25, 25, { elevationFeet: 5 }),
      to: { x: 225, y: 25 }, fromElevationFeet: 5, toElevationFeet: 5,
    }).blocked).toBe(false)
    expect(mapGeometryMovementBlocked({
      map: wallMap,
      token: token('small-flyer', 25, 25, { creatureSize: '小型', elevationFeet: 5 }),
      to: { x: 225, y: 25 }, fromElevationFeet: 5, toElevationFeet: 5,
    })).toMatchObject({ blocked: true, entityId: 'wind-wall-area' })
    expect(mapGeometryMovementBlocked({
      map: wallMap,
      token: token('mist', 25, 25, {
        dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:gaseous-form', label: 'Gaseous Form',
          source: { kind: 'spell', rulesId: 'gaseous-form', magical: true }, targetId: 'mist',
        })] },
      }),
      to: { x: 225, y: 25 },
    })).toMatchObject({ blocked: true, entityId: 'wind-wall-area' })
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

  it('extends line of sight to the map boundary in every ambient light mode', () => {
    const g = geometry()
    g.walls = []
    g.vision.defaultRangeFeet = 30
    const wideMap = { ...map, width: 2_000, tokens: [] }
    const viewer = token('viewer', 25, 250)
    const target = token('far-target', 1_750, 250, { type: 'enemy' })

    g.vision.ambientLight = 'bright'
    expect(mapGeometryCanSeeToken({ geometry: g, map: wideMap, viewer, target })).toBe(true)
    expect(Math.max(...mapGeometryVisibilityPolygon({ geometry: g, map: wideMap, viewer }).map((point) => point.x)))
      .toBeCloseTo(wideMap.width, 3)

    g.vision.ambientLight = 'dim'
    expect(mapGeometryCanSeeToken({ geometry: g, map: wideMap, viewer, target })).toBe(true)

    g.vision.ambientLight = 'darkness'
    expect(mapGeometryCanSeeToken({ geometry: g, map: wideMap, viewer, target })).toBe(false)
    expect(Math.max(...mapGeometryVisibilityPolygon({ geometry: g, map: wideMap, viewer }).map((point) => point.x)))
      .toBeCloseTo(wideMap.width, 3)

    const distantLitTarget = {
      ...target,
      lightSource: { enabled: true, brightRadiusFeet: 10, dimRadiusFeet: 10, color: '#fbbf24' },
    }
    expect(mapGeometryCanSeeToken({
      geometry: g,
      map: { ...wideMap, tokens: [viewer, distantLitTarget] },
      viewer,
      target: distantLitTarget,
    })).toBe(true)
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

  it('keeps map-wide terrain line of sight in darkness while creature visibility still requires light', () => {
    const g = geometry()
    g.walls = []
    g.vision.ambientLight = 'darkness'
    g.vision.defaultRangeFeet = 10
    const viewer = token('viewer', 250, 250)
    const polygon = mapGeometryVisibilityPolygon({ geometry: g, map, viewer })
    expect(polygon.length).toBeGreaterThan(90)
    expect(Math.max(...polygon.map((point) => Math.hypot(point.x - viewer.x, point.y - viewer.y))))
      .toBeGreaterThan(300)
    expect(mapGeometryCanSeeToken({
      geometry: g,
      map: { ...map, tokens: [viewer] },
      viewer,
      target: token('unlit', 300, 250, { type: 'enemy' }),
    })).toBe(false)
  })

  it('suppresses ordinary light and darkvision inside magical darkness', () => {
    const g = geometry()
    g.walls = []
    g.obstacles = [{
      id: 'darkness', kind: 'obstacle', label: '黑暗术', magicalDarkness: true, darknessSpellLevel: 2,
      points: [{ x: 50, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }, { x: 50, y: 100 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
    }]
    const viewer = token('viewer', 25, 50, { darkvisionRangeFeet: 60 })
    const target = token('target', 100, 50, { type: 'enemy', lightSource: { enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fff' } })
    const litMap = { ...map, tokens: [viewer, target] }
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map: litMap, point: target })).toBe('magical-darkness')
    expect(mapGeometryCanSeeToken({ geometry: g, map: litMap, viewer, target })).toBe(false)
    expect(mapGeometryCanSeeToken({ geometry: g, map: litMap, viewer: { ...viewer, canSeeMagicalDarkness: true }, target })).toBe(true)
    expect(mapGeometryCanSeeToken({
      geometry: g,
      map: litMap,
      viewer: { ...viewer, magicalDarknessSightRangeFeet: 60 },
      target,
    })).toBe(true)
  })

  it('uses core spell areas as authoritative light and magical-darkness sources', () => {
    const g = geometry()
    g.walls = []
    g.obstacles = []
    g.vision.ambientLight = 'darkness'
    const daylight = {
      id: 'daylight', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:daylight',
      sourceKind: 'core-spell' as const, coreSpellId: 'daylight', label: '昼明术', color: '#fde68a',
      sourceCharacterId: 'cleric', sourceTokenId: 'cleric-token', cells: [{ col: 1, row: 1 }],
      anchorCell: { col: 1, row: 1 }, createdRound: 1, expiresAfterRound: 601,
      lighting: {
        kind: 'light' as const, brightRadiusFeet: 60, dimRadiusFeet: 60,
        color: '#fef3c7', spellLevel: 3, suppressesMagicalDarknessThroughLevel: 3,
      },
    }
    const darkness = {
      id: 'darkness', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:darkness',
      sourceKind: 'core-spell' as const, coreSpellId: 'darkness', label: '黑暗术', color: '#312e81',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 3, row: 1 }],
      anchorCell: { col: 3, row: 1 }, createdRound: 1, expiresAfterRound: 101,
      lighting: {
        kind: 'magical-darkness' as const, radiusFeet: 15, spellLevel: 2,
        suppressesMagicalLightThroughLevel: 2,
      },
    }
    const target = { x: 175, y: 75 }
    expect(mapGeometryIlluminationAtPoint({
      geometry: g, map: { ...map, dnd5ePluginAreas: [darkness] }, point: target,
    })).toBe('magical-darkness')
    expect(mapGeometryIlluminationAtPoint({
      geometry: g,
      map: { ...map, dnd5ePluginAreas: [darkness] },
      point: target,
      elevationFeet: 20,
    })).not.toBe('magical-darkness')
    expect(mapGeometryIlluminationAtPoint({
      geometry: g, map: { ...map, dnd5ePluginAreas: [darkness, daylight] }, point: target,
    })).toBe('bright')
    expect(mapGeometryIlluminationAtPoint({
      geometry: g, map: { ...map, dnd5ePluginAreas: [daylight] }, point: { x: 975, y: 75 },
    })).toBe('dim')

    g.obstacles = [{
      id: 'legacy-darkness', kind: 'obstacle', label: '魔法黑暗', magicalDarkness: true,
      darknessSpellLevel: 2,
      points: [{ x: 140, y: 40 }, { x: 210, y: 40 }, { x: 210, y: 110 }, { x: 140, y: 110 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
    }]
    expect(mapGeometryIlluminationAtPoint({
      geometry: g, map: { ...map, dnd5ePluginAreas: [daylight] }, point: target,
    })).toBe('bright')
  })

  it('applies light blockers and magical darkness only across matching height intervals', () => {
    const g = geometry()
    g.vision.ambientLight = 'darkness'
    const highTorch = token('high-torch', 50, 50, {
      elevationFeet: 20,
      lightSource: { enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fff' },
    })
    const highTarget = token('high-target', 150, 50, { type: 'enemy', elevationFeet: 20 })
    expect(mapGeometryIlluminationAtPoint({
      geometry: g,
      map: { ...map, tokens: [highTorch, highTarget] },
      point: highTarget,
      elevationFeet: 20,
    })).toBe('bright')
    expect(mapGeometryIlluminationAtPoint({
      geometry: g,
      map: { ...map, tokens: [{ ...highTorch, elevationFeet: 0 }, highTarget] },
      point: { x: highTarget.x, y: highTarget.y },
      elevationFeet: 0,
    })).toBe('darkness')

    g.vision.ambientLight = 'bright'
    g.walls = []
    g.obstacles = [{
      id: 'ground-darkness', kind: 'obstacle', label: '地面黑暗', magicalDarkness: true,
      points: [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
    }]
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map, point: highTarget, elevationFeet: 0 }))
      .toBe('magical-darkness')
    expect(mapGeometryIlluminationAtPoint({ geometry: g, map, point: highTarget, elevationFeet: 50 }))
      .toBe('bright')
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

  it('normalizes authoritative weather and overhead space for environmental spell rules', () => {
    const g = geometry()
    const explicit = normalizeSharedMapGeometry({
      schemaVersion: 3,
      maps: [{ ...g, weather: 'storm', overheadSpace: 'confined' }],
      updatedAt: 2,
    })
    expect(explicit?.maps[0]).toMatchObject({ weather: 'storm', overheadSpace: 'confined' })

    const legacy = normalizeSharedMapGeometry({ schemaVersion: 1, maps: [g], updatedAt: 2 })
    expect(legacy?.maps[0]).toMatchObject({ weather: 'normal', overheadSpace: 'open' })
  })

  it('uses terrain as the minimum absolute elevation for legacy or stale tokens', () => {
    const g = geometry()
    g.obstacles.push({
      id: 'plateau',
      kind: 'obstacle',
      label: 'Plateau',
      points: [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 90 }, { x: 0, y: 90 }],
      blocksVision: false,
      blocksMovement: false,
      blocksLineOfEffect: false,
      cover: 'none',
      baseHeightFeet: 0,
      heightFeet: 0,
      terrainRegion: true,
      terrainElevationFeet: 20,
      createdAt: 2,
    })

    expect(mapGeometryTokenElevation(g, token('legacy', 50, 50))).toBe(20)
    expect(mapGeometryTokenElevation(g, token('stale', 50, 50, { elevationFeet: 0 }))).toBe(20)
    expect(mapGeometryTokenElevation(g, token('flying', 50, 50, { elevationFeet: 35 }))).toBe(35)
  })

  it('does not let a legacy ground difficult-terrain overlay replace platform elevation', () => {
    const g = geometry()
    g.obstacles.push({
      id: 'plateau', kind: 'obstacle', label: 'Plateau',
      points: [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 90 }, { x: 0, y: 90 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1,
    }, {
      id: 'legacy-grease', kind: 'obstacle', label: 'Legacy grease',
      points: [{ x: 10, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 80 }, { x: 10, y: 80 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 0,
      terrainCostMultiplier: 2, traversal: 'ground', createdAt: 2,
    })

    expect(mapGeometryTokenElevation(g, token('grounded', 50, 50))).toBe(20)
  })

  it('simplifies a dense height-brush loop into an editable closed-region outline', () => {
    const denseLoop = [
      ...Array.from({ length: 101 }, (_, index) => ({ x: index, y: Math.sin(index) * 0.4 })),
      ...Array.from({ length: 101 }, (_, index) => ({ x: 100 + Math.sin(index) * 0.4, y: index })),
      ...Array.from({ length: 101 }, (_, index) => ({ x: 100 - index, y: 100 + Math.sin(index) * 0.4 })),
      ...Array.from({ length: 101 }, (_, index) => ({ x: Math.sin(index) * 0.4, y: 100 - index })),
      { x: 0, y: 0 },
    ]
    const simplified = mapGeometrySimplifyTerrainRegionPoints(denseLoop, 2, 48)

    expect(simplified.length).toBeGreaterThanOrEqual(4)
    expect(simplified.length).toBeLessThanOrEqual(48)
    expect(Math.min(...simplified.map((point) => point.x))).toBeLessThanOrEqual(1)
    expect(Math.max(...simplified.map((point) => point.x))).toBeGreaterThanOrEqual(99)
    expect(Math.min(...simplified.map((point) => point.y))).toBeLessThanOrEqual(1)
    expect(Math.max(...simplified.map((point) => point.y))).toBeGreaterThanOrEqual(99)
    expect(simplified.at(-1)).not.toEqual(simplified[0])
  })

  it('filters invalid and duplicate height-brush samples before storing the outline', () => {
    expect(mapGeometrySimplifyTerrainRegionPoints([
      { x: 0, y: 0 },
      { x: 0.1, y: 0.1 },
      { x: Number.NaN, y: 5 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
      { x: 0, y: 0 },
    ], 1)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ])
  })

  it('merges selected height cells into an outer grid boundary without internal edges', () => {
    expect(mapGeometryGridSelectionBoundary([
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ], 50, 5, 10)).toEqual([
      { x: 55, y: 60 },
      { x: 155, y: 60 },
      { x: 155, y: 160 },
      { x: 55, y: 160 },
    ])
  })

  it('keeps the concave outline of an L-shaped height-cell selection', () => {
    const boundary = mapGeometryGridSelectionBoundary([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ], 40)
    expect(boundary).toHaveLength(6)
    expect(boundary).toContainEqual({ x: 40, y: 40 })
    expect(boundary).not.toContainEqual({ x: 40, y: 0 })
  })

  it('migrates V1 openings to stable wall-edge attachments and always emits Schema V3', () => {
    const g = geometry()
    g.obstacles[0].terrainElevationFeet = 15
    g.obstacles[0].terrainRegion = true
    g.doors = [{
      id: 'legacy-door', kind: 'door', label: '旧门', points: [{ x: 100, y: 40 }, { x: 100, y: 80 }],
      state: 'closed', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    const normalized = normalizeSharedMapGeometry({ schemaVersion: 1, maps: [g], updatedAt: 2 })
    expect(normalized).toMatchObject({ schemaVersion: 3 })
    expect(normalized?.maps[0].doors[0]).toMatchObject({
      parentWallId: 'wall',
      parentWallSegmentIndex: 0,
      wallEdgeId: 'edge:wall:0',
      startT: 0.2,
      endT: 0.4,
      openState: 'closed',
      lockState: 'unlocked',
      physicalState: 'intact',
      points: [{ x: 100, y: 40 }, { x: 100, y: 80 }],
    })
    expect(normalized?.maps[0].obstacles[0].terrainElevationFeet).toBe(15)
    expect(normalized?.maps[0].obstacles[0].terrainRegion).toBe(true)
    expect(normalizeSharedMapGeometry({
      schemaVersion: 2,
      maps: [{ ...g, obstacles: [{ ...g.obstacles[0], terrainElevationFeet: 20_000 }] }],
      updatedAt: 2,
    })).toBeUndefined()
    expect(normalizeSharedMapGeometry({ schemaVersion: '1', maps: [g], updatedAt: 2 })).toBeUndefined()
    expect(normalizeSharedMapGeometry({ schemaVersion: 4, maps: [g], updatedAt: 2 })).toBeUndefined()
  })

  it('does not block adjacent attacks when both tokens are on the same side of a closed door', () => {
    const liveMap: BattleMap = {
      ...map,
      id: 'roper-map',
      width: 1024,
      height: 1024,
      gridSize: 25,
      tokens: [],
    }
    const liveGeometry: MapGeometryState = {
      ...createEmptyMapGeometry(liveMap.id, 1),
      walls: [{
        id: 'door-wall', kind: 'wall', label: '墙',
        points: [{ x: 840, y: 490 }, { x: 840, y: 560 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [{
        id: 'door', kind: 'door', label: '门',
        points: [{ x: 840, y: 492.5 }, { x: 840, y: 560 }],
        state: 'closed', openState: 'closed', lockState: 'unlocked',
        physicalState: 'intact', secret: false,
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
    }
    const roper = token('roper', 900, 500, { type: 'enemy', size: 2 })
    const gaseousTarget = token('gaseous-target', 862.5, 562.5)
    expect(mapGeometryLineOfEffectBlocked({
      geometry: liveGeometry,
      map: liveMap,
      from: roper,
      to: gaseousTarget,
      fromElevationFeet: 0,
      toElevationFeet: 0,
    })).toBe(false)
  })
})
