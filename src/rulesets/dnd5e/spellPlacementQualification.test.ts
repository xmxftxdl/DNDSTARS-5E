import { expect, it } from 'vitest'
import { authorizeDnd5eSpellPlacement, dnd5eSpellPlacementQualified } from './spellPlacementQualification'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { PreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

function activity(): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: 'sensor', name: 'Sensor', legacySource: { kind: 'spell', id: 'sensor' },
    activation: { kind: 'action' }, automation: automationCapabilityFromLegacyStatus('full'),
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'circle', radiusFeet: 5,
      placementQualification: { prompt: 'Is this place known?' } }, outcomes: [] }
}
it('rejects unsupported and malformed placement qualifications', () => {
  for (const qualification of [true, [], {}, { prompt: '' }, { prompt: 'x'.repeat(1001) }, { prompt: 'Known?', trusted: true }]) {
    const candidate: any = activity(); candidate.target.placementQualification = qualification
    expect(validateDnd5eActivityDefinitionV1(candidate).some(error => error.includes('placementQualification'))).toBe(true)
  }
  const feature = activity(); feature.legacySource = { kind: 'feature', id: 'sensor' }
  expect(validateDnd5eActivityDefinitionV1(feature).some(error => error.includes('placementQualification'))).toBe(true)
})
it('does not install a receipt if the selected point changes while Host confirmation is pending', async () => {
  const cast = { action: { id: 'cast' }, map: { id: 'map', name: 'Map' }, actor: { id: 'owner' },
    actorToken: { id: 'token' }, spell: { id: 'sensor' }, activity: activity(), activityTargetCell: { col: 1, row: 2 },
    payload: {}, slotLevel: 3 } as unknown as PreparedDnd5ePluginSpellCast
  expect(await authorizeDnd5eSpellPlacement(cast, async () => {
    cast.activityTargetCell = { col: 3, row: 2 }; return true
  })).toBe(false)
  expect(dnd5eSpellPlacementQualified(cast)).toBe(false)
  expect(await authorizeDnd5eSpellPlacement(cast, async () => true)).toBe(true)
  cast.payload.activityWillingTargetIds = []
  expect(dnd5eSpellPlacementQualified(cast)).toBe(true)
  cast.payload.activityChoices = { sense: 'hearing' }
  expect(dnd5eSpellPlacementQualified(cast)).toBe(false)
})
