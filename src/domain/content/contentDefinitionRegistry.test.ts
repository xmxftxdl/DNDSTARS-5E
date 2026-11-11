import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearContentDefinitionRegistryForTests,
  contentDefinitionRegistryRevision,
  getRegisteredContentDefinitionPackageIdentity,
  listRegisteredContentDefinitionPackages,
  registerContentDefinitionPackage,
  unregisterContentDefinitionPackage,
} from './contentDefinitionRegistry'

describe('content definition registry lifecycle', () => {
  afterEach(clearContentDefinitionRegistryForTests)

  it('reads current package identity without copying payloads or retaining replaced versions', () => {
    const packageId = 'test.version-lookup'
    const value = { packageId, packageVersion: '1.0.0', definitions: [] }
    const first = registerContentDefinitionPackage(value)
    value.packageVersion = 'caller-mutation'
    const clone = vi.spyOn(globalThis, 'structuredClone')
    try {
      const identity = getRegisteredContentDefinitionPackageIdentity(packageId)!
      expect(identity.packageVersion).toBe('1.0.0')
      identity.packageVersion = 'external-mutation'
      expect(getRegisteredContentDefinitionPackageIdentity(packageId)?.packageVersion).toBe('1.0.0')
      expect(getRegisteredContentDefinitionPackageIdentity('missing')).toBeUndefined()
      expect(clone).not.toHaveBeenCalled()
    } finally { clone.mockRestore() }
    first.dispose()
    expect(getRegisteredContentDefinitionPackageIdentity(packageId)).toBeUndefined()
    const second = registerContentDefinitionPackage({ packageId, packageVersion: '2.0.0', definitions: [] })
    first.dispose()
    expect(getRegisteredContentDefinitionPackageIdentity(packageId)?.packageVersion).toBe('2.0.0')
    second.dispose()
    expect(getRegisteredContentDefinitionPackageIdentity(packageId)).toBeUndefined()
  })

  it('can remove an orphaned package by plugin identity before reactivation', () => {
    const value = {
      packageId: 'local.room.test',
      packageVersion: '1.0.0',
      definitions: [{
        schemaVersion: 1 as const,
        id: 'test-feature',
        namespace: 'local.room.test',
        version: '1.0.0',
        kind: 'feature' as const,
        name: '测试特性',
        payload: {},
        automation: {
          schemaVersion: 1 as const,
          level: 'display-only' as const,
          supportedPhases: [],
          manualPhases: [
            'eligibility', 'cost', 'targeting', 'attack-roll', 'saving-throw', 'damage',
            'healing', 'effects', 'duration', 'interrupt', 'persistence',
          ] as const,
          limitations: ['测试内容不执行自动结算。'],
        },
      }],
    }
    const before = contentDefinitionRegistryRevision()
    registerContentDefinitionPackage(value)
    expect(contentDefinitionRegistryRevision()).toBeGreaterThan(before)

    const registered = contentDefinitionRegistryRevision()
    expect(unregisterContentDefinitionPackage(value.packageId)).toBe(true)
    expect(contentDefinitionRegistryRevision()).toBeGreaterThan(registered)
    expect(listRegisteredContentDefinitionPackages()).toEqual([])
    expect(() => registerContentDefinitionPackage(value)).not.toThrow()
  })
})
