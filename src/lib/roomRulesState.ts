import type { RoomPluginRequirement, RoomRulesSnapshot } from './roomSession'

let snapshot: RoomRulesSnapshot | null = null
let pluginSyncError: string | null = null
const listeners = new Set<() => void>()

export function getRoomRulesSnapshot(): RoomRulesSnapshot | null {
  return snapshot
}

export function setRoomRulesSnapshot(next: RoomRulesSnapshot | null): void {
  if (JSON.stringify(snapshot) === JSON.stringify(next)) return
  snapshot = next
  for (const listener of [...listeners]) listener()
}

export function getRoomPluginSyncError(): string | null {
  return pluginSyncError
}

export function setRoomPluginSyncError(next: string | null): void {
  if (pluginSyncError === next) return
  pluginSyncError = next
  for (const listener of [...listeners]) listener()
}

export function subscribeRoomRules(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function roomAllowsPlugin(
  pluginId: string,
  rules: RoomRulesSnapshot | null = snapshot,
): boolean {
  if (!rules) return true
  return rules.requiredPlugins.some((plugin) => plugin.id === pluginId)
}

export function roomPluginRequirement(
  pluginId: string,
  rules: RoomRulesSnapshot | null = snapshot,
): RoomPluginRequirement | undefined {
  return rules?.requiredPlugins.find((plugin) => plugin.id === pluginId)
}
