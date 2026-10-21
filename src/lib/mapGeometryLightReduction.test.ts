import { expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../store/maps'
import { migrateMapsState } from '../store/maps'
import { createEmptyMapGeometry, mapGeometryIlluminationAtPoint, mapGeometryCanSeeToken } from './mapGeometry'
import { normalizeDnd5ePersistentAreaLighting } from '../rulesets/dnd5e/persistentAreaTypes'
import { resolveDnd5eCoreSpellLightingConflicts } from '../rulesets/dnd5e/coreSpellAreas'
import { persistentAreaLightReductionPolygons } from '../components/map/persistentAreaLightPresentation'
import { projectMapsForPlayer } from '../../scripts/shared-server-core.mjs'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'

const area: Dnd5ePluginArea = {
  id: 'shadows', pluginId: 'test', featureId: 'shadows', label: 'Shadows', color: '#111111',
  sourceCharacterId: 'caster', sourceTokenId: 'caster', anchorTokenId: 'caster',
  cells: [{ col: 0, row: 0 }], createdRound: 1, expiresAfterRound: 11,
  lighting: { kind: 'reduce-light', radiusFeet: 10, spellLevel: 4 },
}
const map: BattleMap = {
  id: 'test', name: 'test', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
  tokens: [{ id: 'caster', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '#ffffff', emoji: 'T' }],
  dnd5ePluginAreas: [area],
}
it.each(['bright', 'dim', 'darkness'] as const)('reduces resolved %s once, within the moving 10-foot source radius', ambient => {
  const geometry = createEmptyMapGeometry('test', 1)
  geometry.vision.ambientLight = ambient
  const expected = ambient === 'bright' ? 'dim' : 'darkness'
  const current = structuredClone(map)
  current.dnd5ePluginAreas!.push({ ...area, id: 'second' })
  const read = (x: number, elevationFeet = 0) => mapGeometryIlluminationAtPoint({ geometry, map: current, point: { x, y: 25 }, elevationFeet })
  expect(read(125)).toBe(expected)
  expect(read(126)).toBe(ambient)
  expect(read(25, 11)).toBe(ambient)
  current.tokens[0].x = 225
  expect(read(25)).toBe(ambient)
  expect(read(225)).toBe(expected)
  current.tokens = []
  expect(read(25)).toBe(ambient)
})
it('reduces bright lamp illumination to dim even in ambient darkness and restores it when removed', () => {
  const geometry = createEmptyMapGeometry('test', 1)
  geometry.vision.ambientLight = 'darkness'
  const current = structuredClone(map)
  current.tokens[0].lightSource = { enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffffff', sourceKind: 'spell' }
  const read = () => mapGeometryIlluminationAtPoint({ geometry, map: current, point: { x: 75, y: 25 } })
  expect(read()).toBe('dim')
  current.dnd5ePluginAreas = []
  expect(read()).toBe('bright')
})
it('round trips the explicit lighting declaration and rejects unsupported suppression flags', () => {
  expect(normalizeDnd5ePersistentAreaLighting(JSON.parse(JSON.stringify(area.lighting)))).toEqual(area.lighting)
  expect(normalizeDnd5ePersistentAreaLighting({ ...area.lighting, suppressesMagicalLightThroughLevel: 9 })).toBeUndefined()
})
it('draws the live shadow volume and removes the drawing when its bound source is absent', () => {
  const geometry = createEmptyMapGeometry('test', 1)
  const current = structuredClone(map)
  const polygons = persistentAreaLightReductionPolygons(current, geometry)
  expect(polygons).toHaveLength(1)
  expect(Math.max(...polygons[0].map(point => point.x))).toBeCloseTo(125)
  current.tokens[0].x = 225
  expect(Math.max(...persistentAreaLightReductionPolygons(current, geometry)[0].map(point => point.x))).toBeCloseTo(325)
  current.tokens = []
  expect(persistentAreaLightReductionPolygons(current, geometry)).toEqual([])
})
it('projects anonymous illumination for a hidden caster without exposing its identity or interactions', () => {
  const geometry = createEmptyMapGeometry('test', 1)
  geometry.vision.enabled = true
  geometry.vision.ambientLight = 'bright'
  geometry.vision.sharePartyVision = false
  const current = structuredClone(map)
  current.tokens[0].type = 'enemy'
  current.tokens[0].x = 27
  current.tokens.push({ ...current.tokens[0], id: 'viewer', type: 'player', characterId: 'viewer-character', x: 175 })
  current.dnd5ePluginAreas![0].obscuration = { kind: 'heavy', scope: 'source-token' }
  current.dnd5ePluginAreas![0].anchorMode = 'source-token'
  const payload = JSON.parse(JSON.stringify(projectMapsForPlayer({ maps: [current] },
    { schemaVersion: 2, maps: [geometry], updatedAt: 1 }, 'viewer-character')))
  expect(validateAndMigrateSharedResource('maps', payload).status).not.toBe('invalid')
  for (const patch of [{ lightingOnly: false }, { pluginId: 'ordinary-plugin' },
    { lightingOrigin: { x: null, y: 0, elevationFeet: 0 } },
    { obscuration: { kind: 'heavy' } }, { interactions: [{ kind: 'damage' }] }]) {
    const invalid = structuredClone(payload)
    Object.assign(invalid.maps[0].dnd5ePluginAreas[0], patch)
    expect(validateAndMigrateSharedResource('maps', invalid).status).toBe('invalid')
  }
  const projected = migrateMapsState(payload).maps[0]
  expect(projected.tokens.map(token => token.id)).not.toContain('caster')
  const lighting = projected.dnd5ePluginAreas![0]
  expect(lighting.lightingOnly).toBe(true)
  expect(lighting.sourceTokenId).toBe('')
  expect(lighting.sourceCharacterId).toBe('')
  expect(lighting.obscuration).toBeUndefined()
  expect(lighting.lightingOrigin?.x).toBe(27)
  expect(mapGeometryIlluminationAtPoint({ map: projected, geometry, point: { x: 27, y: 25 } })).toBe('dim')
  expect(persistentAreaLightReductionPolygons(projected, geometry)).toHaveLength(1)
})
it('follows the source-token anchor when an imported area omits an explicit anchorTokenId', () => {
  const geometry = createEmptyMapGeometry('test', 1)
  geometry.vision.ambientLight = 'bright'
  const current = structuredClone(map)
  current.dnd5ePluginAreas![0].anchorMode = 'source-token'
  delete current.dnd5ePluginAreas![0].anchorTokenId
  current.tokens[0].x = 325
  expect(mapGeometryIlluminationAtPoint({ geometry, map: current, point: { x: 325, y: 25 } })).toBe('dim')
  expect(mapGeometryIlluminationAtPoint({ geometry, map: current, point: { x: 25, y: 25 } })).toBe('bright')
})
it('does not let daylight dispel a light reduction as though it were a darkness spell', () => {
  const daylight: Dnd5ePluginArea = { ...area, id: 'daylight', lighting: { kind: 'light',
    brightRadiusFeet: 60, dimRadiusFeet: 60, color: '#ffffff', spellLevel: 3, suppressesMagicalDarknessThroughLevel: 9 } }
  expect(resolveDnd5eCoreSpellLightingConflicts([daylight], area).areas).toHaveLength(2)
  expect(resolveDnd5eCoreSpellLightingConflicts([area], daylight).areas).toHaveLength(2)
})
it('keeps existing magical darkness and does not spread reductions through a wall', () => {
  const geometry = createEmptyMapGeometry('test', 1)
  geometry.vision.ambientLight = 'bright'
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }]
  expect(mapGeometryIlluminationAtPoint({ geometry, map, point: { x: 75, y: 25 } })).toBe('bright')
  const current = structuredClone(map)
  current.dnd5ePluginAreas!.push({ ...area, id: 'darkness', lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 } })
  expect(mapGeometryIlluminationAtPoint({ geometry, map: current, point: { x: 25, y: 25 } })).toBe('magical-darkness')
})
it('obscures only the source, allows its outward sight and blindsight, and does not obscure bystanders', () => {
  const geometry = createEmptyMapGeometry('test', 1)
  geometry.vision.ambientLight = 'bright'
  geometry.vision.enabled = true
  const current = structuredClone(map)
  current.dnd5ePluginAreas![0].lighting = undefined
  current.dnd5ePluginAreas![0].obscuration = { kind: 'heavy', scope: 'source-token' }
  const caster = current.tokens[0]
  const viewer = { ...caster, id: 'viewer', x: 75 }
  const bystander = { ...caster, id: 'bystander', x: 25 }
  current.tokens.push(viewer, bystander)
  const see = (from: typeof viewer, to: typeof viewer) => mapGeometryCanSeeToken({ geometry, map: current, viewer: from, target: to })
  expect(see(viewer, caster)).toBe(false)
  expect(see(caster, viewer)).toBe(true)
  expect(see(viewer, bystander)).toBe(true)
  expect(see({ ...viewer, blindsightRangeFeet: 10 }, caster)).toBe(true)
  expect(see({ ...viewer, truesightRangeFeet: 10 }, caster)).toBe(false)
  current.dnd5ePluginAreas = []
  expect(see(viewer, caster)).toBe(true)
})
