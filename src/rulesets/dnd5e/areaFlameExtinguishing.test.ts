import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { normalizeMapGeometryEntity, type MapGeometryLight } from '../../lib/mapGeometry'
import { extinguishDnd5eAreaFlames } from './areaFlameExtinguishing'

function fixture() {
  const light = { enabled: true, flame: true, sourceKind: 'custom' as const,
    brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ff8000' }
  const map: BattleMap = { id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50,
    feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: ['exposed','protected','outside','not-fire'].map(id => ({ id, label: id, type: 'enemy',
      x: 25, y: 25, size: 1, color: '', emoji: '', lightSource: { ...light,
        flame: id !== 'not-fire', flameProtected: id === 'protected' } })) }
  const lights: MapGeometryLight[] = map.tokens.map(token => ({ ...token.lightSource!,
    id: token.id, kind: 'light', label: token.id, points: [{ x: 25, y: 25 }], elevationFeet: 0, createdAt: 1,
    controlledFlame: { id: token.id, burning: true, magical: false, extentFeet: 5, brightRadiusFeet: 20, dimRadiusFeet: 20,
      color: '#ff8000', fuelAvailable: true, alterations: [{ id: 'shape', casterId: 'caster', kind: 'shape',
        appliedAtWorldMinute: 0, expiresAtWorldMinute: 60, shape: 'bird' }] } }))
  return { map, lights, worldMinute: 10, reachesToken: (t: { id: string }) => t.id !== 'outside',
    reachesLight: (l: { id: string }) => l.id !== 'outside' }
}

it('extinguishes both kinds of exposed fire, preserves protected/outside/nonfire and does not mutate inputs', () => {
  const input = fixture(), before = structuredClone({ map: input.map, lights: input.lights })
  const result = extinguishDnd5eAreaFlames(input)
  expect(result.changedTokenIds).toEqual(['exposed']); expect(result.changedLightIds).toEqual(['exposed'])
  expect(result.map.tokens[0].lightSource).toBeUndefined()
  expect(result.lights[0]).toMatchObject({ enabled: false, controlledFlame: { burning: false, fuelAvailable: true, alterations: [] } })
  expect({ map: input.map, lights: input.lights }).toEqual(before)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
  const lights = result.lights.map(light => normalizeMapGeometryEntity(JSON.parse(JSON.stringify(light))) as MapGeometryLight)
  expect(map.tokens[0].lightSource).toBeUndefined()
  expect(lights[0].controlledFlame).toMatchObject({ burning: false, alterations: [] })
  const repeated = extinguishDnd5eAreaFlames({ ...input, map, lights })
  expect(repeated.changedTokenIds).toEqual([]); expect(repeated.changedLightIds).toEqual([])
  expect(repeated.map).toBe(map); expect(repeated.lights).toBe(lights)
})

it('uses explicit flame facts rather than color or a magical/nonmagical guess', () => {
  const input = fixture()
  input.lights[0].controlledFlame!.magical = true
  const result = extinguishDnd5eAreaFlames(input)
  expect(result.changedLightIds).toEqual(['exposed'])
  expect(result.lights[3].enabled).toBe(true)
  expect(() => extinguishDnd5eAreaFlames({ ...input, worldMinute: Number.NaN })).toThrow('invalid-flame-clock')
})
