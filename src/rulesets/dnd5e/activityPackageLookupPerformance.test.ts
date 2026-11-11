import { expect, it, vi } from 'vitest'
import { registerContentDefinitionPackage } from '../../domain/content/contentDefinitionRegistry'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import {
  getRegisteredDnd5eActivityPackageIdentity,
  getRegisteredDnd5eActivityPackage,
  listRegisteredDnd5eActivityPackages,
} from './activities/dnd5eActivityRegistry'

it('damage version checks avoid copying 2,000 unrelated activities and package reads copy only the requested activities', () => {
  const registrations: { dispose(): void }[] = []
  try {
    for (let pack = 0; pack < 40; pack++) {
      const packageId = `test.performance.${pack}`
      registrations.push(registerContentDefinitionPackage({
        packageId, packageVersion: '1.0.0',
        definitions: Array.from({ length: 50 }, (_, index) => ({
          schemaVersion: 1 as const, id: `feature.${index}`, namespace: packageId,
          version: '1.0.0', kind: 'feature' as const, name: `Feature ${index}`,
          source: { packageId, packageVersion: '1.0.0' }, payload: {},
          automation: automationCapabilityFromLegacyStatus('full'),
          activities: [{
            schemaVersion: 1, id: `activity.${index}`, name: `Activity ${index}`,
            activation: { kind: 'action', cost: 1 }, target: { kind: 'self' },
            outcomes: [], automation: automationCapabilityFromLegacyStatus('full'),
          }],
        })),
      }))
    }
    const packageId = 'test.performance.39'
    const iterations = 20
    const baselineStart = performance.now()
    for (let index = 0; index < iterations; index++) {
      expect(listRegisteredDnd5eActivityPackages().find(pack => pack.packageId === packageId)?.packageVersion).toBe('1.0.0')
    }
    const baselineMs = performance.now() - baselineStart
    const directStart = performance.now()
    for (let index = 0; index < iterations; index++) {
      expect(getRegisteredDnd5eActivityPackageIdentity(packageId)?.packageVersion).toBe('1.0.0')
    }
    const directMs = performance.now() - directStart
    const expected = listRegisteredDnd5eActivityPackages().find(pack => pack.packageId === packageId)
    expect(getRegisteredDnd5eActivityPackage(packageId)).toEqual(expected)
    const clone = vi.spyOn(globalThis, 'structuredClone')
    try {
      for (let index = 0; index < iterations; index++) {
        expect(getRegisteredDnd5eActivityPackageIdentity(packageId)?.packageVersion).toBe('1.0.0')
      }
      expect(clone).not.toHaveBeenCalled()
      const selected = getRegisteredDnd5eActivityPackage(packageId)!
      expect(clone).toHaveBeenCalledTimes(50)
      selected.activities[0].name = 'caller-mutation'
      expect(getRegisteredDnd5eActivityPackage(packageId)).toEqual(expected)
      expect(getRegisteredDnd5eActivityPackage('missing')).toBeUndefined()
    } finally { clone.mockRestore() }
    // Timings are diagnostic, never a machine-dependent pass/fail threshold.
    console.info(JSON.stringify({ catalogActivities: 2000, iterations, baselineMs, directMs }))
  } finally {
    for (const registration of registrations.reverse()) registration.dispose()
  }
}, 60_000)
