import { describe, expect, it } from 'vitest'
import { validateContentDefinitionIdentity } from './contentDefinition'

describe('content definition identity', () => {
  it('accepts stable namespaced content identity', () => {
    expect(validateContentDefinitionIdentity({
      schemaVersion: 1,
      id: 'ember-burst',
      namespace: 'local.dm.rules',
      version: '1.2.0',
      name: '余烬爆发',
    })).toEqual([])
  })

  it('rejects display names and unversioned identities as ids', () => {
    expect(validateContentDefinitionIdentity({
      schemaVersion: 1,
      id: '余烬爆发',
      namespace: 'Local Rules',
      version: 'latest',
      name: '',
    })).toEqual([
      'invalid content id',
      'invalid content namespace',
      'invalid content version',
      'invalid content name',
    ])
  })
})
