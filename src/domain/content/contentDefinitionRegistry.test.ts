import { afterEach, describe, expect, it } from 'vitest'
import {
  clearContentDefinitionRegistryForTests,
  listRegisteredContentDefinitionPackages,
  registerContentDefinitionPackage,
  unregisterContentDefinitionPackage,
} from './contentDefinitionRegistry'

describe('content definition registry lifecycle', () => {
  afterEach(clearContentDefinitionRegistryForTests)

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
    registerContentDefinitionPackage(value)

    expect(unregisterContentDefinitionPackage(value.packageId)).toBe(true)
    expect(listRegisteredContentDefinitionPackages()).toEqual([])
    expect(() => registerContentDefinitionPackage(value)).not.toThrow()
  })
})
