import {
  missingDnd5eRulesPluginRequirements,
  roomActiveDnd5eRulesPluginRequirements,
} from '../rulesets/dnd5e/pluginApi'
import { downloadRoomPlugin, heartbeatRoom } from './roomApi'
import type { RoomRulesSnapshot, RoomSession } from './roomSession'

export interface RoomPluginSyncResult {
  rules: RoomRulesSnapshot
  installedPluginIds: string[]
}

let activeSync: Promise<RoomPluginSyncResult> | null = null

async function runRoomPluginSync(
  session: RoomSession,
  rules: RoomRulesSnapshot,
): Promise<RoomPluginSyncResult> {
  const host = window.DNDSTARS_5E_RULES_PLUGINS
  if (!host) throw new Error('规则插件加载器尚未初始化')
  for (const installed of host.listInstalled()) {
    if (installed.source !== 'ephemeral') continue
    const required = rules.requiredPlugins.find((requirement) =>
      requirement.id === installed.id && requirement.integrity === installed.integrity)
    if (!required) await host.remove(installed.id)
  }
  const missing = missingDnd5eRulesPluginRequirements(
    rules.requiredPlugins,
    roomActiveDnd5eRulesPluginRequirements(),
  )
  if (missing.length === 0) return { rules, installedPluginIds: [] }

  const installedPluginIds: string[] = []
  for (const requirement of missing) {
    if (!requirement.integrity) throw new Error(`房间规则包 ${requirement.id} 缺少 SHA-256`)
    const downloaded = await downloadRoomPlugin({
      session,
      requirement: {
        ...requirement,
        integrity: requirement.integrity,
        stateSchemaVersion: requirement.stateSchemaVersion ?? 1,
      },
    })
    const metadata = rules.plugins.find((candidate) => candidate.id === requirement.id)
    if (!metadata) throw new Error(`房间规则包 ${requirement.id} 缺少分发策略元数据`)
    const install = metadata.distributionPolicy === 'room-ephemeral'
      ? host.installEphemeralBytes.bind(host)
      : host.installBytes.bind(host)
    await install({
      id: requirement.id,
      version: requirement.version,
      integrity: requirement.integrity,
      fileName: downloaded.fileName,
      bytes: downloaded.bytes,
    })
    installedPluginIds.push(requirement.id)
  }

  const refreshed = await heartbeatRoom(session, roomActiveDnd5eRulesPluginRequirements())
  if (!refreshed.member.ready) throw new Error('规则包已下载，但房间版本校验仍未通过')
  return { rules: refreshed, installedPluginIds }
}

export function synchronizeRoomPlugins(
  session: RoomSession,
  rules: RoomRulesSnapshot,
): Promise<RoomPluginSyncResult> {
  if (activeSync) return activeSync
  activeSync = runRoomPluginSync(session, rules).finally(() => {
    activeSync = null
  })
  return activeSync
}
