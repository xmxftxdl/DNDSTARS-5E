import { expect, it } from 'vitest'
import { migrateMapsState } from '../../store/maps'
import { authorizeDnd5eRemoteSensorPlacement } from './remoteSensorPlacement'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

function fixture() {
  const room = { maps: migrateMapsState({ maps: [
    { id: 'source', name: 'Source', width: 500, height: 500, gridSize: 50, dnd5ePlane: 'material', tokens: [
      { id: 'actor', type: 'enemy', x: 25, y: 25, size: 1, label: 'Caster', emoji: '', color: '#fff', hp: 30, maxHp: 30 },
    ] },
    { id: 'destination', name: 'Destination', width: 500, height: 500, gridSize: 50, dnd5ePlane: 'material', tokens: [] },
  ] }).maps, characters: [] }
  return { room, request: { actorMapId: 'source', actorTokenId: 'actor', actionId: 'cast', packageId: 'test.sensor', activityId: 'eyes',
    location: { mapId: 'destination', col: 3, row: 3, elevationFeet: 0 } } }
}

it.each(['unknown-plane', 'different-plane', 'missing-map', 'duplicate-map', 'duplicate-actor', 'outside-map', 'fractional-cell', 'invalid-height'] as const)(
  'rejects %s before asking the DM or mutating room data', async scenario => {
    const input = fixture()
    if (scenario === 'unknown-plane') input.room.maps[1].dnd5ePlane = undefined
    if (scenario === 'different-plane') input.room.maps[1].dnd5ePlane = 'elsewhere'
    if (scenario === 'missing-map') input.room.maps.pop()
    if (scenario === 'duplicate-map') input.room.maps.push(structuredClone(input.room.maps[1]))
    if (scenario === 'duplicate-actor') input.room.maps[0].tokens.push(structuredClone(input.room.maps[0].tokens[0]))
    if (scenario === 'outside-map') input.request.location.col = 10
    if (scenario === 'fractional-cell') input.request.location.col = 1.5
    if (scenario === 'invalid-height') input.request.location.elevationFeet = NaN
    const before = structuredClone(input); let prompts = 0
    const result = await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory: async () => { prompts++; return true } })
    expect(result.ok).toBe(false)
    expect(prompts).toBe(0)
    expect(input).toEqual(before)
  },
)

it('does not issue a receipt when the DM declines or the scene changes during the question', async () => {
  const input = fixture(), before = structuredClone(input)
  expect(await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory: async () => false }))
    .toEqual({ ok: false, reason: 'sensor-location-not-known' })
  expect(input).toEqual(before)
  expect(await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory: async () => { input.room.maps[1].width = 400; return true } }))
    .toEqual({ ok: false, reason: 'sensor-placement-conflict' })
})

it('binds a bounded cross-scene range ruling and rejects denial or changing room state', async () => {
  const input = fixture()
  let memoryCalls = 0
  const confirmMemory = async () => { memoryCalls++; return true }
  const declined = await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory,
    crossMapRange: { maximumFeet: 5280, confirmWithinRange: async () => false } })
  expect(declined).toEqual({ ok: false, reason: 'sensor-out-of-range' })
  expect(memoryCalls).toBe(0)
  const range = { maximumFeet: 5280, confirmWithinRange: async (maximum: number) => {
    expect(maximum).toBe(5280); range.maximumFeet = 100000; return true
  } }
  const accepted = await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory, crossMapRange: range })
  expect(accepted.ok).toBe(true)
  if (accepted.ok) expect(accepted.receipt.maximumDistanceFeet).toBe(5280)
  const changed = await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory,
    crossMapRange: { maximumFeet: 5280, confirmWithinRange: async () => { input.room.maps[1].width = 450; return true } } })
  expect(changed).toEqual({ ok: false, reason: 'sensor-placement-conflict' })
})

it('allows a same-scene location without inventing a plane name', async () => {
  const input = fixture()
  input.request.location.mapId = 'source'
  input.room.maps[0].dnd5ePlane = undefined
  expect((await authorizeDnd5eRemoteSensorPlacement({ ...input, confirmMemory: async () => true })).ok).toBe(true)
})

it('only authorizes a declared single granted sensor and requires a bounded memory question', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'eyes', name: 'Eyes', target: { kind: 'self' }, activation: { kind: 'action' },
    requiresEffectGrant: true, automation: automationCapabilityFromLegacyStatus('full'), outcomes: [{ id: 'sensor', when: { kind: 'always' },
      operations: [{ id: 'sensor', kind: 'create-persistent-area', label: 'Sensor', durationRounds: 100, concentration: true,
        effectToken: { label: 'Sensor', hiddenBody: true, shareVisionWithSource: true, visionFromSource: true, remotePlacement: { memoryPrompt: 'Known in life?' } } }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const ungranted = structuredClone(activity); delete ungranted.requiresEffectGrant
  expect(validateDnd5eActivityDefinitionV1(ungranted).some(issue => issue.includes('remotePlacement'))).toBe(true)
  for (const memoryPrompt of ['', 'x'.repeat(1001)]) {
    const malformed = structuredClone(activity), operation = malformed.outcomes[0].operations[0]
    if (operation.kind !== 'create-persistent-area') throw Error('Unexpected operation')
    operation.effectToken!.remotePlacement!.memoryPrompt = memoryPrompt
    expect(validateDnd5eActivityDefinitionV1(malformed).some(issue => issue.includes('remotePlacement'))).toBe(true)
  }
})
