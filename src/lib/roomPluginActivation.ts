import type {
  Dnd5eRulesPluginHost,
  Dnd5eRulesPluginManifest,
} from '../rulesets/dnd5e'
import {
  activateStagedRoomPlugin,
  loadRoomPluginMigrationState,
  stageRoomPlugin,
} from './roomApi'
import type { RoomRulesSnapshot, RoomSession } from './roomSession'

export interface RoomPluginPackage {
  bytes: ArrayBuffer
  fileName: string
  integrity: string
  manifest: Dnd5eRulesPluginManifest
}

/**
 * Stages, migrates and atomically activates one exact plugin package.
 * Keeping this outside React ensures the account library and legacy settings
 * page use the same DM-authoritative upgrade path.
 */
export async function activateRoomPluginPackage(input: {
  session: RoomSession
  host: Dnd5eRulesPluginHost
  package: RoomPluginPackage
}): Promise<RoomRulesSnapshot> {
  if (input.session.role !== 'dm') throw new Error('只有 DM 可以发布房间规则包')
  const plugin = input.package
  const stateSchemaVersion = plugin.manifest.stateSchemaVersion ?? 1
  await stageRoomPlugin({
    session: input.session,
    id: plugin.manifest.id,
    version: plugin.manifest.version,
    stateSchemaVersion,
    integrity: plugin.integrity,
    name: plugin.manifest.name,
    publisher: plugin.manifest.publisher,
    license: plugin.manifest.license,
    fileName: plugin.fileName,
    bytes: plugin.bytes,
  })
  const previous = await loadRoomPluginMigrationState(input.session, plugin.manifest.id)
  let data = previous.data
  if (previous.hasState && stateSchemaVersion !== previous.stateSchemaVersion) {
    const migrated = await input.host.migrateState({
      bytes: plugin.bytes,
      fromVersion: previous.stateSchemaVersion,
      state: previous.data,
    })
    if (migrated.toVersion !== stateSchemaVersion) {
      throw new Error('规则包状态迁移没有到达目标版本')
    }
    data = migrated.state
  }
  return activateStagedRoomPlugin({
    session: input.session,
    pluginId: plugin.manifest.id,
    expectedRulesRevision: previous.rulesRevision,
    expectedActive: previous.active,
    stagedVersion: plugin.manifest.version,
    stagedIntegrity: plugin.integrity,
    stateSchemaVersion,
    data,
  })
}
