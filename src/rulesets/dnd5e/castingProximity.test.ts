import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { captureDnd5eCastingProximity, observeDnd5eCastingProximity, verifyDnd5eCastingProximity,
  validDnd5eCastingConstraints, type Dnd5eCastingProximityBinding, type Dnd5eCastingProximityReceipt } from './castingProximity'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { dnd5eActivityHeadlessCompatibility } from './activities/dnd5eActivityHeadlessCompiler'
const binding: Dnd5eCastingProximityBinding = { requestId: 'cast', spellId: 'test:ceremony', activityId: 'ceremony',
  mapId: 'scene', actorTokenId: 'caster', targetTokenIds: ['recipient'], maximumTargetDistanceFeet: 10,
  choices: { rite: 'coming-of-age' } }
function fixture(): BattleMap {
  const token = (id: string, x: number): Token => ({ id, label: id, x, y: 25, size: 1, type: 'enemy', color: '', emoji: '' })
  return { id: 'scene', name: 'Scene', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token('caster', 25), token('recipient', 125)] }
}
it('keeps a witnessed excursion invalid after returning; caster motion and deletion also invalidate', () => {
  const map = fixture(), receipt = captureDnd5eCastingProximity(binding, map)!
  expect(receipt).toBeTruthy()
  expect(verifyDnd5eCastingProximity(receipt, binding, map)).toBe(true)
  map.tokens[1].x = 175
  expect(observeDnd5eCastingProximity(receipt, map)).toBe(false)
  map.tokens[1].x = 125
  expect(verifyDnd5eCastingProximity(receipt, binding, map)).toBe(false)
  const casterReceipt = captureDnd5eCastingProximity(binding, map)!
  map.tokens[0].x = 325
  expect(observeDnd5eCastingProximity(casterReceipt, map)).toBe(false)
  const missing = fixture(), removedReceipt = captureDnd5eCastingProximity(binding, missing)!
  missing.tokens.pop()
  expect(observeDnd5eCastingProximity(removedReceipt, missing)).toBe(false)
})
it('measures actual footprints, grid scale and vertical intervals, including map point targets', () => {
  const map = fixture()
  map.tokens[1].x = 175
  expect(captureDnd5eCastingProximity(binding, map)).toBeUndefined()
  map.tokens[0].size = 2
  expect(captureDnd5eCastingProximity(binding, map)).toBeTruthy()
  const vertical = fixture()
  vertical.tokens[1].elevationFeet = 15
  expect(captureDnd5eCastingProximity(binding, vertical)).toBeTruthy()
  vertical.tokens[1].elevationFeet = 15.01
  expect(captureDnd5eCastingProximity(binding, vertical)).toBeUndefined()
  const point = { ...binding, targetTokenIds: [], targetCell: { col: 2, row: 0 }, targetElevationFeet: 15 }
  expect(captureDnd5eCastingProximity(point, fixture())).toBeTruthy()
  expect(captureDnd5eCastingProximity({ ...point, targetElevationFeet: 15.01 }, fixture())).toBeUndefined()
  const scaled = fixture(); scaled.feetPerCell = 10
  expect(captureDnd5eCastingProximity(binding, scaled)).toBeUndefined()
})
it('binds evidence to the exact cast and refuses serialized, forged, duplicate or malformed inputs', () => {
  const map = fixture(), receipt = captureDnd5eCastingProximity(binding, map)!
  for (const changed of [{ ...binding, requestId: 'other' }, { ...binding, spellId: 'other' },
    { ...binding, choices: { rite: 'wedding' } }, { ...binding, maximumTargetDistanceFeet: 20 }]) {
    expect(verifyDnd5eCastingProximity(receipt, changed, map)).toBe(false)
  }
  expect(verifyDnd5eCastingProximity(JSON.parse(JSON.stringify(receipt)) as Dnd5eCastingProximityReceipt, binding, map)).toBe(false)
  const duplicate = fixture(); duplicate.tokens.push({ ...duplicate.tokens[1] })
  expect(captureDnd5eCastingProximity(binding, duplicate)).toBeUndefined()
  expect(observeDnd5eCastingProximity(receipt, undefined)).toBe(false)
  for (const value of [{ maximumTargetDistanceFeet: -1 }, { maximumTargetDistanceFeet: NaN },
    { maximumTargetDistanceFeet: 10, proof: true }, { maximumTargetDistanceFeet: '10' }]) expect(validDnd5eCastingConstraints(value)).toBe(false)
  const definition = { schemaVersion: 1 as const, id: 'cast', name: 'Cast', activation: { kind: 'action' as const, cost: 1 },
    target: { kind: 'self' as const }, outcomes: [{ id: 'noop', when: { kind: 'always' as const },
      operations: [{ id: 'stabilize', kind: 'stabilize' as const, target: 'actor' as const }] }], automation: automationCapabilityFromLegacyStatus('full'),
    castingConstraints: { maximumTargetDistanceFeet: 10 } }
  expect(validateDnd5eActivityDefinitionV1(definition).some(error => error.includes('castingConstraints'))).toBe(true)
  expect(validateDnd5eActivityDefinitionV1({ ...definition, legacySource: { kind: 'spell', id: 'cast' } }).some(error => error.includes('castingConstraints'))).toBe(false)
  const spellActivity = { ...definition, legacySource: { kind: 'spell' as const, id: 'cast' } }
  expect(dnd5eActivityHeadlessCompatibility(spellActivity).supported).toBe(false)
  const compatibility = dnd5eActivityHeadlessCompatibility(spellActivity, { outerSpellTransaction: true })
  expect(compatibility.supported, compatibility.reasons.join(' | ')).toBe(true)
})
