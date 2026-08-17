import { describe, expect, it } from 'vitest'
import type { MobileAccountCharacterRecord, MobileRoomRules } from '../../../../packages/mobile-protocol/src'
import { mobileCharacterCompatibilityForRoom } from './mobileCharacterVault'

const rules: MobileRoomRules = {
  schemaVersion: 1, roomId: 'ABC123', rulesetId: 'dnd5e-2014-srd-5.1', revision: 1, hash: 'rules', updatedAt: 1,
  requiredPlugins: [{ id: 'homebrew', version: '1.0.0', integrity: 'sha256-a', stateSchemaVersion: 1 }],
  plugins: [], member: { ready: true, missing: [], mismatched: [] },
}

function record(): MobileAccountCharacterRecord {
  return {
    id: 'hero', name: '英雄', updatedAt: 1, character: { id: 'hero', ownerAccountId: 'account' },
    compatibility: {
      rulesetId: 'dnd5e-2014-srd-5.1', characterSchemaVersion: 1,
      minimumGameProtocolVersion: 5, lastSavedGameProtocolVersion: 5,
      requiredPlugins: [{ id: 'homebrew', version: '1.0.0', integrity: 'sha256-a', stateSchemaVersion: 1 }],
    },
  }
}

describe('mobile character vault compatibility', () => {
  it('accepts an exact rules and plugin match', () => {
    expect(mobileCharacterCompatibilityForRoom(record(), rules).compatible).toBe(true)
  })

  it('fails closed when the room plugin hash differs', () => {
    const changed = { ...rules, requiredPlugins: [{ ...rules.requiredPlugins[0], integrity: 'sha256-b' }] }
    const result = mobileCharacterCompatibilityForRoom(record(), changed)
    expect(result.compatible).toBe(false)
    expect(result.errors.join(' ')).toContain('哈希')
  })
})
