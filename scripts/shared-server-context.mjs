import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createFileSystemServerStorage } from './adapters/file-system-server-storage.mjs'
import { createInMemoryServerTelemetry } from './adapters/in-memory-server-telemetry.mjs'

/** Composition root for shared-server adapters and mutable transport state. */
export function createSharedServerContext(options) {
  const sharedRoot = path.resolve(options.sharedRoot)
  const legacyRoot = path.resolve(options.legacyRoot ?? path.join(process.cwd(), '.stars-shared'))
  const lobbyRoot = path.join(sharedRoot, 'lobby')
  const stateRoot = path.join(sharedRoot, 'state')
  const imageRoot = path.join(sharedRoot, 'images')
  const snapshotRoot = path.join(sharedRoot, 'snapshots')
  const telemetry = options.telemetry ?? createInMemoryServerTelemetry()
  const storage = createFileSystemServerStorage({
    lobbyRoot,
    campaignRoot: path.join(lobbyRoot, 'campaigns'),
    stateRoot,
    assetRoot: imageRoot,
    pluginRoot: path.join(sharedRoot, 'plugins'),
    snapshotRoot,
    telemetry,
  })
  return {
    sharedRoot,
    lobbyRoot,
    stateRoot,
    imageRoot,
    quarantineRoot: path.join(sharedRoot, 'quarantine'),
    snapshotRoot,
    legacyStateRoot: path.join(legacyRoot, 'state'),
    legacyImageRoot: path.join(legacyRoot, 'images'),
    eventClients: new Map(),
    eventBacklog: new Map(),
    eventSequences: new Map(),
    storage,
    telemetry,
    serverInstanceId: options.serverInstanceId ?? randomUUID(),
    serverStartedAt: options.serverStartedAt ?? Date.now(),
    serverBuildId: options.serverBuildId,
  }
}
