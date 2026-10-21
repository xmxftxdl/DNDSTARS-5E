import { expect, it } from 'vitest'
import { projectMapsForPlayer } from '../../scripts/shared-server-core.mjs'
import { isFlameLight } from '../../shared/flame-light-concealment.mjs'
import { createEmptyMapGeometry, mapGeometryIlluminationAtPoint, mapGeometryCanSeeToken, mapGeometryLightPolygon,
  mapGeometryConcealedFlamePolygon, normalizeMapGeometryEntity } from './mapGeometry'
import { migrateMapsState, type BattleMap, type Token, type Dnd5ePluginArea } from '../store/maps'

function fixture() {
  const viewer: Token = { id: 'hero', characterId: 'hero', type: 'player', label: 'Hero', x: 175, y: 25, size: 1, color: '#fff', emoji: '' }
  const target: Token = { ...viewer, id: 'target', characterId: undefined, type: 'enemy', x: 75 }
  const area: Dnd5ePluginArea = { id: 'ward', pluginId: 'test', featureId: 'shelter', label: 'Shelter', color: '#fff',
    sourceCharacterId: 'secret-caster', sourceTokenId: 'target', createdRound: 1, expiresAfterRound: 100,
    cells: [0, 1, 2].map(col => ({ col, row: 0 })), anchorCell: { col: 1, row: 0 }, anchorMode: 'fixed',
    concealsFlameLightFromOutside: true, hiddenFromPlayers: true }
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 200, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [viewer, target], dnd5ePluginAreas: [area] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.vision = { enabled: true, ambientLight: 'darkness', defaultRangeFeet: 60, sharePartyVision: false }
  geometry.lights = [{ id: 'fire', kind: 'light', label: 'Fire', points: [{ x: 75, y: 25 }], enabled: true, flame: true,
    sourceKind: 'custom', brightRadiusFeet: 30, dimRadiusFeet: 10, color: '#ffffff', elevationFeet: 0, createdAt: 1 }]
  const canSee = (nextMap = map) => mapGeometryCanSeeToken({ geometry, map: nextMap, viewer: nextMap.tokens[0], target: nextMap.tokens[1], forceEnabled: true })
  const projected = (nextMap = map) => projectMapsForPlayer({ maps: [nextMap] }, { maps: [geometry] }, 'hero')
  return { map, geometry, viewer, target, area, canSee, projected }
}

it('requires explicit flame provenance for custom light and supports existing flame presets', () => {
  for (const sourceKind of ['torch', 'candle', 'lamp', 'hooded-lantern']) expect(isFlameLight({ sourceKind })).toBe(true)
  expect(isFlameLight({ sourceKind: 'spell' })).toBe(false)
  expect(isFlameLight({ sourceKind: 'custom' })).toBe(false)
  expect(isFlameLight({ sourceKind: 'custom', flame: true })).toBe(true)
  expect(isFlameLight({ sourceKind: 'torch', flame: false })).toBe(false)
})

it('agrees in Host and browser: outsiders cannot use concealed fire, insiders can, and ending restores it', () => {
  const { map, canSee, projected } = fixture()
  expect(canSee()).toBe(false)
  expect(projected().maps[0].tokens.map((t: Token) => t.id)).not.toContain('target')
  const inside = { ...map, tokens: map.tokens.map(token => token.id === 'hero' ? { ...token, x: 125 } : token) }
  expect(canSee(inside)).toBe(true)
  expect(projected(inside).maps[0].tokens.map((t: Token) => t.id)).toContain('target')
  const ended = { ...map, dnd5ePluginAreas: [] }
  expect(canSee(ended)).toBe(true)
  expect(projected(ended).maps[0].tokens.map((t: Token) => t.id)).toContain('target')
})

it('clips rendered light at the same boundary and retains anonymous lighting data when the caster is hidden', () => {
  const { map, geometry, viewer, projected } = fixture()
  const light = geometry.lights![0], source = { ...light.points[0], elevationFeet: 0 }
  const polygon = mapGeometryLightPolygon({ geometry, map, source, radiusFeet: 30 })
  expect(mapGeometryConcealedFlamePolygon({ map, geometry, light, source, polygon, viewers: [viewer] })).toEqual([])
  const visiblePolygon = mapGeometryConcealedFlamePolygon({ map, geometry, light, source, polygon, viewers: [{ ...viewer, x: 125 }] })
  expect(visiblePolygon.length).toBeGreaterThan(3)
  expect(Math.max(...visiblePolygon.map(point => point.x))).toBeLessThanOrEqual(150.001)
  const redacted = projected().maps[0].dnd5ePluginAreas![0]
  expect(redacted).toMatchObject({ lightingOnly: true, sourceCharacterId: '', sourceTokenId: '', label: '' })
  const archive = migrateMapsState(JSON.parse(JSON.stringify(projected())))
  expect(archive.maps[0].dnd5ePluginAreas?.[0].lightingOnly).toBe(true)
  expect(mapGeometryConcealedFlamePolygon({ map: archive.maps[0], geometry, light, source, polygon, viewers: [viewer] })).toEqual([])
})

it('leaves ambient illumination and non-flame magic alone and blocks light from leaking outside', () => {
  const { map, geometry, viewer, target, canSee, projected } = fixture()
  expect(mapGeometryIlluminationAtPoint({ map, geometry, point: target })).toBe('bright')
  expect(mapGeometryIlluminationAtPoint({ map, geometry, point: viewer })).toBe('darkness')
  geometry.lights![0] = { ...geometry.lights![0], flame: false, sourceKind: 'spell' }
  expect(canSee()).toBe(true)
  expect(projected().maps[0].tokens.map((t: Token) => t.id)).toContain('target')
  geometry.lights![0].flame = true
  geometry.vision.ambientLight = 'bright'
  expect(canSee()).toBe(true)
})

it('persists explicit custom flame labels and rejects malformed scene metadata', () => {
  const { map, geometry } = fixture()
  expect(normalizeMapGeometryEntity(JSON.parse(JSON.stringify(geometry.lights![0])))).toMatchObject({ flame: true })
  expect(normalizeMapGeometryEntity({ ...geometry.lights![0], flame: 'true' })).toBeUndefined()
  map.tokens[0].lightSource = { enabled: true, flame: true, sourceKind: 'custom', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffffff' }
  expect(migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0].tokens[0].lightSource?.flame).toBe(true)
})

it('preserves anchor occlusion on anonymous lighting archives and agrees on solid walls', () => {
  const { map, geometry, area, canSee, projected } = fixture()
  area.occupantModifiers = { requiresLineOfEffectFromAnchor: true }
  area.anchorCell = { col: 0, row: 0 }
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }]
  // The flame and target are on the same side as the viewer, outside the ward's reachable volume.
  expect(canSee()).toBe(true)
  expect(projected().maps[0].tokens.map((token: Token) => token.id)).toContain('target')
  const archive = migrateMapsState(JSON.parse(JSON.stringify(projected())))
  expect(archive.maps[0].dnd5ePluginAreas?.[0].occupantModifiers?.requiresLineOfEffectFromAnchor).toBe(true)
  expect(mapGeometryIlluminationAtPoint({ map: archive.maps[0], geometry, point: map.tokens[0] })).toBe('bright')
})

it.each(['panel', 'sphere', 'hemisphere', 'volume'] as const)('matches dynamic %s barriers between the ward anchor and flame', shape => {
  const { map, area, canSee, projected } = fixture()
  area.occupantModifiers = { requiresLineOfEffectFromAnchor: true }
  area.anchorCell = { col: 0, row: 0 }
  const barrier: Dnd5ePluginArea = { ...area, id: 'barrier', concealsFlameLightFromOutside: undefined,
    occupantModifiers: undefined, blocking: { lineOfEffect: true, lineOfEffectMode: 'boundary', vision: false },
    cells: [{ col: 0, row: 0 }], vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 } }
  if (shape === 'panel') barrier.forceWall = { mode: 'thick', start: { col: 0.5, row: -1 }, angles: [90] }
  else if (shape === 'sphere' || shape === 'hemisphere') {
    barrier.forceShell = { shape, radiusFeet: 3 }
    barrier.vertical = { mode: 'volume', baseElevationFeet: shape === 'sphere' ? -3 : 0, heightFeet: 6 }
  }
  map.dnd5ePluginAreas = [area, barrier]
  // The transparent barrier interrupts the shelter volume, not ordinary light or vision.
  expect(canSee()).toBe(true)
  expect(projected().maps[0].tokens.map((token: Token) => token.id)).toContain('target')
  barrier.vertical = { mode: 'volume', baseElevationFeet: 20, heightFeet: 10 }
  expect(canSee()).toBe(false)
  expect(projected().maps[0].tokens.map((token: Token) => token.id)).not.toContain('target')
  map.dnd5ePluginAreas = [area]
  expect(canSee()).toBe(false)
})
