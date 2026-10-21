import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryLineOfEffectBlocked, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './activities/dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { BattleMap } from '../../store/maps'
import { resolveDnd5ePointProjectileImpact } from './pointProjectileImpact'

function fixture() {
  const map: BattleMap = { id: 'impact', name: 'Impact', width: 400, height: 200,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'stone', kind: 'obstacle', label: 'Stone',
    points: [{ x: 150, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 200 }, { x: 150, y: 200 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, cover: 'total', createdAt: 1 })
  return { map, geometry, from: { x: 25, y: 75, elevationFeet: 2 }, to: { x: 325, y: 75, elevationFeet: 2 } }
}

it('explodes at the first solid with propagation on the incoming side, without mutating the map', () => {
  const input = fixture(), before = structuredClone(input)
  const result = resolveDnd5ePointProjectileImpact(input)
  expect(result.entityId).toBe('stone')
  expect(result.point.x).toBeCloseTo(150, 6)
  expect(result.effectOrigin.x).toBeLessThan(150)
  expect(mapGeometryLineOfEffectBlocked({ ...input, from: result.effectOrigin, to: { x: 125, y: 75 }, fromElevationFeet: 2, toElevationFeet: 2 })).toBe(false)
  expect(mapGeometryLineOfEffectBlocked({ ...input, from: result.effectOrigin, to: { x: 175, y: 75 }, fromElevationFeet: 2, toElevationFeet: 2 })).toBe(true)
  expect(input).toEqual(before)
})

it('keeps the chosen destination when the trajectory passes above the barrier', () => {
  const input = fixture()
  input.from.elevationFeet = input.to.elevationFeet = 15
  expect(resolveDnd5ePointProjectileImpact(input)).toEqual({ point: input.to, effectOrigin: input.to })
})

it('interpolates elevation at contact instead of using the requested destination height', () => {
  const input = fixture()
  input.to.elevationFeet = 8
  expect(resolveDnd5ePointProjectileImpact(input).point).toEqual({ x: 150, y: 75, elevationFeet: 4.5 })
})

it('recomputes Host area occupants at impact and preserves the requested anchor for range validation', () => {
  const input = fixture()
  const caster = { id: 'caster', type: 'player' as const, label: 'Caster', x: 25, y: 75, size: 1, color: '', emoji: '', elevationFeet: 2 }
  input.map.tokens = [caster, { ...caster, id: 'near', x: 125 }, { ...caster, id: 'behind', x: 175 }, { ...caster, id: 'destination', x: 325 }]
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'projectile', name: 'Projectile',
    activation: { kind: 'free' }, target: { kind: 'area', origin: 'point', shape: 'sphere', relation: 'any',
      placeRangeFeet: 120, radiusFeet: 5, includeSelf: true, projectileImpact: 'first-solid' },
    outcomes: [], automation: automationCapabilityFromLegacyStatus('full') }
  setMapGeometryRuntime([input.geometry])
  try {
    const selected = resolveDnd5eActivityAreaMapSelectionV1({ map: input.map, actorToken: caster, activity, anchorCell: { col: 6, row: 1 }, targetElevationFeet: 2 })
    expect(selected?.areaPlacement).toMatchObject({ x: 150, y: 75, elevationFeet: 2 })
    expect(selected?.anchorCell).toEqual({ col: 6, row: 1 })
    expect(selected?.targetIds).toEqual(['near'])
    expect(selected?.cells.some(cell => cell.col === 6)).toBe(false)
    expect(resolveDnd5eActivityAreaMapSelectionV1({ map: input.map, actorToken: caster, activity, anchorCell: { col: 30, row: 1 } })).toBeUndefined()
    expect(resolveDnd5eActivityAreaMapSelectionV1({ map: input.map, actorToken: caster, activity, anchorCell: { col: 6, row: 1 }, targetElevationFeet: 200 })).toBeUndefined()
  } finally { setMapGeometryRuntime([]) }
})
