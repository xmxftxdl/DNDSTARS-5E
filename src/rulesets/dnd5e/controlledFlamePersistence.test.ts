import { expect, it } from 'vitest'
import { normalizeControlledFlameState } from '../../../shared/controlled-flame-state.mjs'
import { validateSharedStateShape, projectMapGeometryForPlayer } from '../../../scripts/shared-server-core.mjs'
import { createEmptyMapGeometry, normalizeMapGeometryEntity, mapGeometryIlluminationAtPoint } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { changeDnd5eNonmagicalFlame, projectDnd5eControlledFlame, type Dnd5ePhysicalFlame } from './controlledFlame'

function fixture() {
  const flame: Dnd5ePhysicalFlame = { id: 'fire', magical: false, burning: true, extentFeet: 5,
    positionFeet: { x: 5, y: 5, z: 0 }, fuelAvailable: true,
    brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffaa00', alterations: [] }
  const result = changeDnd5eNonmagicalFlame({ flames: [flame], flameId: 'fire', casterId: 'caster', actionId: 'cast',
    worldMinute: 480, distanceFeet: 30, visible: true, change: { kind: 'illumination', multiplier: 2, color: '#ff0000' } })
  if (!result.ok) throw Error(result.reason)
  return { id: 'fire', kind: 'light' as const, label: 'Fire', enabled: true, flame: true, points: [{ x: 50, y: 50 }],
    brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffaa00', elevationFeet: 0, createdAt: 1, controlledFlame: result.flames[0] }
}
const payload = (entity: unknown) => ({ schemaVersion: 3, maps: [{ ...createEmptyMapGeometry('map', 1), lights: [entity] }], updatedAt: 1 })

it('uses the same temporary illumination in browser visibility and server player geometry, restoring the base at expiry', () => {
  const light = normalizeMapGeometryEntity(fixture())
  if (light?.kind !== 'light') throw Error('missing light')
  const geometry = { ...createEmptyMapGeometry('map', 1), lights: [light], vision: { enabled: true, ambientLight: 'darkness' as const, defaultRangeFeet: 120, sharePartyVision: true } }
  const map: BattleMap = { id: 'map', name: 'map', width: 1000, height: 1000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [] }
  for (const [worldMinute, near, far, bright] of [[539, 'bright', 'dim', 40], [540, 'dim', 'darkness', 20]] as const) {
    expect(mapGeometryIlluminationAtPoint({ map, geometry, point: { x: 400, y: 50 }, worldMinute })).toBe(near)
    expect(mapGeometryIlluminationAtPoint({ map, geometry, point: { x: 650, y: 50 }, worldMinute })).toBe(far)
    const projected = projectMapGeometryForPlayer({ schemaVersion: 3, maps: [geometry], updatedAt: 1 }, null, worldMinute)
    expect(projected.maps[0].lights[0].brightRadiusFeet).toBe(bright)
    // Browser receiving already projected geometry must not multiply the radius again.
    expect(mapGeometryIlluminationAtPoint({ map, geometry: projected.maps[0], point: { x: 950, y: 50 }, worldMinute })).toBe('darkness')
    const persistedFlame = projected.maps[0].lights[0].controlledFlame
    if (!persistedFlame) throw Error('Player projection lost the original flame state')
    expect(persistedFlame.brightRadiusFeet).toBe(20)
  }
})

it('persists base light and bounded temporary alteration through server validation and browser normalization', () => {
  const source = fixture()
  expect(validateSharedStateShape('map-geometry', payload(source))).toEqual({ ok: true })
  const normalized = normalizeMapGeometryEntity(JSON.parse(JSON.stringify(source)))
  expect(normalized?.kind).toBe('light')
  if (normalized?.kind !== 'light' || !normalized.controlledFlame) throw Error('lost flame')
  expect(normalized.controlledFlame).toEqual(source.controlledFlame)
  expect(projectDnd5eControlledFlame(normalized.controlledFlame, 539)).toMatchObject({ brightRadiusFeet: 40, color: '#ff0000' })
  expect(projectDnd5eControlledFlame(normalized.controlledFlame, 540)).toMatchObject({ brightRadiusFeet: 20, color: '#ffaa00' })
})

it.each(['foreign-id', 'wrong-duration', 'duplicate-effect', 'invalid-color', 'nan-position', 'negative-radius'] as const)('rejects %s consistently instead of silently dropping flame state', reason => {
  const source = fixture(), state = source.controlledFlame
  if (reason === 'foreign-id') state.id = 'other'
  if (reason === 'wrong-duration') state.alterations[0].expiresAtWorldMinute++
  if (reason === 'duplicate-effect') state.alterations.push({ ...state.alterations[0] })
  if (reason === 'invalid-color') state.alterations[0].color = 'not-a-color'
  if (reason === 'nan-position') state.positionFeet!.x = NaN
  if (reason === 'negative-radius') state.brightRadiusFeet = -1
  expect(normalizeMapGeometryEntity(source)).toBeUndefined()
  expect(validateSharedStateShape('map-geometry', payload(source)).ok).toBe(false)
})

it('keeps ordinary geometry lights compatible and clones accepted flame records', () => {
  const { controlledFlame, ...ordinary } = fixture()
  expect(normalizeMapGeometryEntity(ordinary)?.kind).toBe('light')
  expect(validateSharedStateShape('map-geometry', payload(ordinary))).toEqual({ ok: true })
  const copy = normalizeControlledFlameState(controlledFlame)!
  copy.alterations[0].color = '#ffffff'
  expect(controlledFlame.alterations[0].color).toBe('#ff0000')
})
