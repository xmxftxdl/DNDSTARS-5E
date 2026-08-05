import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
  clearDnd5eActivityRegistryForTests,
  getRegisteredDnd5eActivity,
  listRegisteredDnd5eActivityPackages,
  registerDnd5eActivityPackage,
} from './dnd5eActivityRegistry'

const activity = {
  schemaVersion: 1 as const,
  id: 'test-action',
  name: 'Test Action',
  activation: { kind: 'action' as const, cost: 1 },
  target: { kind: 'self' as const },
  outcomes: [{
    id: 'resolve',
    when: { kind: 'always' as const },
    operations: [{ id: 'heal', kind: 'healing' as const, target: 'actor' as const, amount: { kind: 'constant' as const, value: 1 } }],
  }],
  automation: automationCapabilityFromLegacyStatus('full'),
}

afterEach(clearDnd5eActivityRegistryForTests)

describe('Dnd5e Activity registry', () => {
  it('validates, isolates, resolves, and unloads package Activities', () => {
    const registration = registerDnd5eActivityPackage({ packageId: 'test.package', packageVersion: '1.0.0', activities: [activity] })
    expect(getRegisteredDnd5eActivity('test.package', 'test-action')).toMatchObject({ name: 'Test Action' })
    expect(listRegisteredDnd5eActivityPackages()).toHaveLength(1)
    registration.dispose()
    expect(getRegisteredDnd5eActivity('test.package', 'test-action')).toBeUndefined()
  })

  it('rejects duplicate package registrations', () => {
    registerDnd5eActivityPackage({ packageId: 'test.package', packageVersion: '1.0.0', activities: [activity] })
    expect(() => registerDnd5eActivityPackage({ packageId: 'test.package', packageVersion: '1.0.1', activities: [activity] }))
      .toThrow(/already registered/)
  })
})
