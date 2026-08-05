import type { PresenceStorePort, ServerStoragePorts } from '../ports/server-storage.mjs'

export function createInMemoryPresenceStore(options?: {
  now?: () => number
  defaultTtlMs?: number
}): PresenceStorePort

export function createFileSystemServerStorage(options: {
  lobbyRoot: string
  campaignRoot: string
  stateRoot: string
  assetRoot: string
  pluginRoot: string
  snapshotRoot: string
  presenceStore?: PresenceStorePort
  now?: () => number
  defaultTtlMs?: number
}): ServerStoragePorts
