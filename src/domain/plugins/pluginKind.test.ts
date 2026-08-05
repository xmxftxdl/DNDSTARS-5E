import { describe, expect, it } from 'vitest'
import { dnd5ePluginTrustProfile, resolveDnd5ePluginKind } from './pluginKind'

describe('D&D 5e plugin trust boundary', () => {
  it('keeps legacy JSON packages declarative', () => {
    expect(resolveDnd5ePluginKind(undefined, 'content-v2')).toBe('content-package')
    expect(resolveDnd5ePluginKind(undefined, 'unified-v1')).toBe('content-package')
    expect(dnd5ePluginTrustProfile(undefined, 'declarative-v1')).toEqual({
      schemaVersion: 1,
      kind: 'content-package',
      executesImportedCode: false,
      requiresWorkerSandbox: false,
      hostCompilesDeclarativeData: true,
    })
  })

  it('requires the Worker sandbox for module automation', () => {
    expect(dnd5ePluginTrustProfile('automation-plugin', 'worker-module')).toMatchObject({
      kind: 'automation-plugin',
      executesImportedCode: true,
      requiresWorkerSandbox: true,
    })
  })

  it('rejects a declaration that contradicts the actual bytes', () => {
    expect(() => resolveDnd5ePluginKind('content-package', 'worker-module')).toThrow(
      'does not match artifact source',
    )
    expect(() => resolveDnd5ePluginKind('automation-plugin', 'content-v2')).toThrow(
      'does not match artifact source',
    )
  })
})
