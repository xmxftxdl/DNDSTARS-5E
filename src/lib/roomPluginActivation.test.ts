import { describe, expect, it } from 'vitest'
import type { Dnd5eRulesPluginHost } from '../rulesets/dnd5e'
import { activateRoomPluginPackage } from './roomPluginActivation'
import type { RoomSession } from './roomSession'

const session: RoomSession = {
  roomId: 'ABC234',
  roomName: 'Test',
  rulesetId: 'dnd5e-2014-srd-5.1',
  memberId: 'dm',
  roomToken: 'x'.repeat(32),
  clientId: 'client',
  role: 'dm',
  displayName: 'DM',
  createdAt: 1,
}

describe('room plugin activation policy', () => {
  it('rejects local-only content before any room API request', async () => {
    await expect(activateRoomPluginPackage({
      session,
      host: {} as Dnd5eRulesPluginHost,
      package: {
        bytes: new Uint8Array([1]).buffer,
        fileName: 'local.dndstars5e',
        integrity: `sha256-${btoa('synthetic')}`,
        manifest: {
          id: 'com.example.local',
          name: 'Local',
          version: '1.0.0',
          apiVersion: 2,
          rulesetId: 'dnd5e-2014-srd-5.1',
          publisher: 'Tests',
          license: 'CC0-1.0',
          distributionPolicy: 'local-only',
        },
      },
    })).rejects.toThrow('room-distributable')
  })
})
