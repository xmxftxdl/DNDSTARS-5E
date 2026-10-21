import { expect, it } from 'vitest'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { normalizeMapGeometryEntity, type MapGeometryLight } from '../../lib/mapGeometry'
import { prepareStrongWindGeometryFlames, settleStrongWindGeometryFlame } from './strongWindGeometryFlames'
import { reconcileStrongWindFlameReceipts } from './strongWindFlames'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'

function fixture() {
  const map: BattleMap = { id: 'wind-map', name: 'map', width: 500, height: 500, gridSize: 50,
    feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
    dnd5ePluginAreas: [{ id: 'gust', pluginId: 'test.grove', featureId: 'test.grove:grove', label: 'Gust',
      color: '#ffffff', sourceTokenId: 'caster', sourceCharacterId: 'caster', strongWind: true,
      cells: [{ col: 1, row: 1 }], vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
      createdRound: 1, expiresAfterRound: 14400 }],
  }
  const light: MapGeometryLight = { id: 'lamp', kind: 'light', label: 'Lamp', points: [{ x: 75, y: 75 }],
    enabled: true, brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#ffffff', elevationFeet: 1, createdAt: 0,
    sourceKind: 'hooded-lantern', startedAtWorldMinute: 1, durationMinutes: 360, expiresAtWorldMinute: 361 }
  return { map, lights: [light], worldMinute: 5, round: 1 }
}
it.each([1, 50, 51, 100])('saves map light d100=%i without creating a Token', d100 => {
  const input = fixture(), candidate = prepareStrongWindGeometryFlames(input).candidates[0]
  const result = settleStrongWindGeometryFlame({ ...input, candidate, d100, transactionId: 'light' })!
  expect(result.lights[0].enabled).toBe(d100 > 50)
  expect(result.map.tokens).toHaveLength(0)
  const map = migrateMapsState({ maps: [JSON.parse(JSON.stringify(result.map))] }).maps[0]
  const lights = result.lights.map(l => normalizeMapGeometryEntity(JSON.parse(JSON.stringify(l))) as MapGeometryLight)
  expect(validateAndMigrateSharedResource('maps', { maps: [map] }).status).not.toBe('invalid')
  expect(map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
  expect(reconcileStrongWindFlameReceipts(map).dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
  expect(prepareStrongWindGeometryFlames({ ...input, map, lights }).candidates).toHaveLength(0)
  expect(input.lights[0].enabled).toBe(true)
})
it('uses point coordinates and actual height, not a creature footprint', () => {
  const input = fixture()
  input.lights[0].points = [{ x: 49, y: 75 }]
  expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(0)
  input.lights[0].points = [{ x: 50, y: 75 }]
  input.lights[0].elevationFeet = 10
  expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(0)
  input.lights[0].elevationFeet = 9
  expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(1)
})
it('ignores expired lights, non-flame overrides and ended wind', () => {
  const input = fixture()
  expect(prepareStrongWindGeometryFlames({ ...input, worldMinute: 361 }).candidates).toHaveLength(0)
  input.lights[0].flame = false
  expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(0)
  input.lights[0].flame = true
  input.map.dnd5ePluginAreas![0].expiresAtWorldMinute = 5
  expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(0)
})
it('extinguishes physical custom flames and clears alterations while preserving fuel', () => {
  const input = fixture(), light = input.lights[0]
  light.sourceKind = 'custom'
  light.controlledFlame = { id: light.id, magical: false, burning: true, extentFeet: 1,
    brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#ffffff', fuelAvailable: true, alterations: [] }
  const result = prepareStrongWindGeometryFlames(input)
  expect(result.lights[0]).toMatchObject({ enabled: false, controlledFlame: { burning: false, fuelAvailable: true } })
  expect(result.candidates).toHaveLength(0)
  expect(prepareStrongWindGeometryFlames({ ...input, lights: result.lights }).lights[0]).toBe(result.lights[0])
})
it('ends the exposure receipt after moving the light out; relighting changes identity', () => {
  const input = fixture(), candidate = prepareStrongWindGeometryFlames(input).candidates[0]
  const result = settleStrongWindGeometryFlame({ ...input, candidate, d100: 51, transactionId: 'light' })!
  result.lights[0] = { ...result.lights[0], points: [{ x: 200, y: 75 }] }
  const outside = prepareStrongWindGeometryFlames({ ...input, ...result })
  expect(outside.map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(0)
  expect(prepareStrongWindGeometryFlames({ ...input, map: outside.map }).candidates).toHaveLength(1)
  input.lights[0].startedAtWorldMinute = 2
  expect(prepareStrongWindGeometryFlames({ ...input, map: result.map }).candidates).toHaveLength(1)
})
