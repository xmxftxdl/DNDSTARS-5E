import { describe, expect, it, vi } from 'vitest'
import {
  characterCompatibilityForRoom,
  uploadAccountPlugin,
  type AccountCharacterRecord,
} from './accountApi'
import type { RoomRulesSnapshot } from './roomSession'

const plugin = {
  id: 'com.example.character-rules',
  version: '1.2.0',
  integrity: 'sha256-YWJjZA==',
  stateSchemaVersion: 2,
}

function record(overrides: Partial<AccountCharacterRecord['compatibility']> = {}) {
  return {
    compatibility: {
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      characterSchemaVersion: 1,
      minimumGameProtocolVersion: 3,
      lastSavedGameProtocolVersion: 3,
      requiredPlugins: [plugin],
      ...overrides,
    },
  }
}

function rules(requiredPlugins = [plugin]): RoomRulesSnapshot {
  return {
    schemaVersion: 1, roomId: 'ABC234', rulesetId: 'dnd5e-2014-srd-5.1', revision: 1,
    hash: 'sha256-test', updatedAt: 1, houseRules: {},
    requiredPlugins, plugins: [], member: { ready: true, missing: [], mismatched: [] },
  }
}

describe('账号角色兼容性核对', () => {
  it('允许房间提供角色所需的完全一致插件，并允许房间包含额外插件', () => {
    expect(characterCompatibilityForRoom(record(), rules([
      plugin,
      { id: 'com.example.extra', version: '1.0.0', integrity: 'sha256-ZGVmZw==', stateSchemaVersion: 1 },
    ]))).toMatchObject({ compatible: true, errors: [] })
  })

  it('阻止缺失插件、哈希不一致和过新的游戏协议', () => {
    expect(characterCompatibilityForRoom(record(), rules([])).compatible).toBe(false)
    expect(characterCompatibilityForRoom(record(), rules([{ ...plugin, integrity: 'sha256-ZGVmZw==' }])).errors[0])
      .toContain('版本或文件哈希')
    expect(characterCompatibilityForRoom(record({ minimumGameProtocolVersion: 99 }), rules()).errors[0])
      .toContain('游戏协议')
  })

  it('没有房间规则快照时拒绝启用角色', () => {
    expect(characterCompatibilityForRoom(record(), null)).toMatchObject({ compatible: false })
  })
})

describe('账号插件本地隐私边界', () => {
  it('在发起 fetch 前拒绝 local-only 包', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      await expect(uploadAccountPlugin({
        manifest: {
          id: 'local.example.private',
          name: 'Private local package',
          version: '1.0.0',
          apiVersion: 2,
          rulesetId: 'dnd5e-2014-srd-5.1',
          publisher: 'Local user',
          license: 'Private local copy',
          distributionPolicy: 'local-only',
        },
        fileName: 'private.dndstars5e',
        integrity: 'sha256-YWJjZA==',
        bytes: new TextEncoder().encode('{}').buffer,
      })).rejects.toMatchObject({
        code: 'plugin-local-only',
        status: 409,
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('在发起 fetch 前拒绝 room-ephemeral 包', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      await expect(uploadAccountPlugin({
        manifest: {
          id: 'local.example.ephemeral',
          name: 'Room ephemeral package',
          version: '1.0.0',
          apiVersion: 2,
          rulesetId: 'dnd5e-2014-srd-5.1',
          publisher: 'Local user',
          license: 'Private local copy',
          distributionPolicy: 'room-ephemeral',
        },
        fileName: 'ephemeral.dndstars5e',
        integrity: 'sha256-YWJjZA==',
        bytes: new TextEncoder().encode('{}').buffer,
      })).rejects.toMatchObject({
        code: 'plugin-ephemeral-room-only',
        status: 409,
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
