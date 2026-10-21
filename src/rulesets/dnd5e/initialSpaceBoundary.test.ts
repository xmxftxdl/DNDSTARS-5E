import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eInitialSpaceContainsPoint, dnd5eInitialSpaceContainsVolume, normalizeDnd5eInitialSpaceBoundary } from './initialSpaceBoundary'

const boundary = { mapId: 'map', x: 125, y: 75, halfWidthUnits: 25, bottomFeet: 0, topFeet: 5 }

it('preserves original space through the real active-effect save/load path without aliasing input', () => {
  const effect = { ...createDnd5eMechanicalEffect({ definitionId: 'test:prison', label: 'Prison',
    source: { kind: 'spell', actorId: 'caster' }, targetId: 'victim' }), initialSpaceBoundary: { ...boundary } }
  const saved = JSON.parse(JSON.stringify([effect]))
  const restored = normalizeDnd5eActiveEffects(saved)
  expect(validateDnd5eActiveEffectsStrict(saved).ok).toBe(true)
  expect(restored[0].initialSpaceBoundary).toEqual(boundary)
  saved[0].initialSpaceBoundary.x = 900
  expect(restored[0].initialSpaceBoundary?.x).toBe(125)
})

it.each([{ ...boundary, mapId: '   ' }, { ...boundary, topFeet: 0 },
  { ...boundary, followActorId: 'victim' }])('rejects malformed boundary on the authoritative effect validation path', invalid => {
  const effect = { ...createDnd5eMechanicalEffect({ definitionId: 'test:prison', label: 'Prison',
    source: { kind: 'spell', actorId: 'caster' }, targetId: 'victim' }), initialSpaceBoundary: invalid }
  expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(false)
  expect(normalizeDnd5eActiveEffects([effect])[0].initialSpaceBoundary).toBeUndefined()
})

it('keeps the captured space after serialization and rejects other-map coordinates', () => {
  const saved = normalizeDnd5eInitialSpaceBoundary(JSON.parse(JSON.stringify(boundary)))!
  expect(saved).toEqual(boundary)
  expect(dnd5eInitialSpaceContainsPoint(saved, { mapId: 'map', x: 130, y: 80, elevationFeet: 2 })).toBe(true)
  expect(dnd5eInitialSpaceContainsPoint(saved, { mapId: 'other', x: 130, y: 80, elevationFeet: 2 })).toBe(false)
  expect(dnd5eInitialSpaceContainsPoint(saved, { mapId: 'map', x: 175, y: 80, elevationFeet: 2 })).toBe(false)
  expect(dnd5eInitialSpaceContainsPoint(saved, { mapId: 'map', x: 130, y: 80, elevationFeet: 6 })).toBe(false)
})

it('detects a crossing by any occupied portion even while the center remains inside', () => {
  expect(dnd5eInitialSpaceContainsVolume(boundary, boundary)).toBe(true)
  expect(dnd5eInitialSpaceContainsPoint(boundary, { mapId: 'map', x: 130, y: 75, elevationFeet: 0 })).toBe(true)
  expect(dnd5eInitialSpaceContainsVolume(boundary, { ...boundary, x: 130 })).toBe(false)
  expect(dnd5eInitialSpaceContainsVolume(boundary, { ...boundary, bottomFeet: 1, topFeet: 6 })).toBe(false)
  expect(dnd5eInitialSpaceContainsVolume(boundary, { ...boundary, halfWidthUnits: 50 })).toBe(false)
})

it.each([{...boundary, x: NaN}, {...boundary, halfWidthUnits: 0}, {...boundary, topFeet: -1},
  {...boundary, mapId: ''}, {...boundary, followActorId: 'forged'}])('rejects malformed or movable boundary metadata', value => {
  expect(normalizeDnd5eInitialSpaceBoundary(value)).toBeUndefined()
})
