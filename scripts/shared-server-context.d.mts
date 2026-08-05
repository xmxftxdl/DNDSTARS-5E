export interface SharedServerContextOptions {
  sharedRoot: string
  legacyRoot?: string
  serverInstanceId?: string
  serverStartedAt?: number
  serverBuildId: string
  telemetry?: import('./ports/server-telemetry.mjs').ServerTelemetryPort
}

export function createSharedServerContext(options: SharedServerContextOptions): {
  sharedRoot: string
  lobbyRoot: string
  stateRoot: string
  imageRoot: string
  quarantineRoot: string
  snapshotRoot: string
  legacyStateRoot: string
  legacyImageRoot: string
  eventClients: Map<string, Set<any>>
  eventBacklog: Map<string, unknown[]>
  eventSequences: Map<string, number>
  storage: import('./ports/server-storage.mjs').ServerStoragePorts
  telemetry: import('./ports/server-telemetry.mjs').ServerTelemetryPort
  serverInstanceId: string
  serverStartedAt: number
  serverBuildId: string
}
