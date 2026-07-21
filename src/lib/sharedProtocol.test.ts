import { describe, expect, it } from 'vitest'
import {
  CLIENT_SHARED_PROTOCOL_VERSION,
  parseSharedServerMeta,
  sharedProtocolCompatible,
} from './sharedProtocol'

describe('shared server protocol metadata', () => {
  const meta = {
    service: 'dndstars-5e-shared' as const,
    rulesetId: 'dnd5e-2014-srd-5.1' as const,
    protocolVersion: CLIENT_SHARED_PROTOCOL_VERSION,
    minimumClientProtocol: CLIENT_SHARED_PROTOCOL_VERSION,
    buildId: 'test',
    startedAt: 123,
  }

  it('accepts the current protocol and rejects malformed metadata', () => {
    expect(parseSharedServerMeta(meta)).toEqual(meta)
    expect(sharedProtocolCompatible(meta)).toBe(true)
    expect(parseSharedServerMeta({ ...meta, service: 'another-repo' })).toBeNull()
    expect(parseSharedServerMeta({ ...meta, protocolVersion: '2' })).toBeNull()
  })

  it('rejects old or future-incompatible servers', () => {
    expect(sharedProtocolCompatible({ ...meta, protocolVersion: 1 })).toBe(false)
    expect(sharedProtocolCompatible({ ...meta, protocolVersion: 5, minimumClientProtocol: 5 })).toBe(false)
  })
})
