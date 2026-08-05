export interface CommandTelemetryIdentity {
  commandId: string
  commandType: string
  aggregateIds: readonly string[]
}

export interface CommandTelemetryQueued extends CommandTelemetryIdentity {
  queuedAt: number
}

export interface CommandTelemetryStarted extends CommandTelemetryIdentity {
  queuedAt: number
  startedAt: number
  queueDurationMs: number
}

export interface CommandTelemetryFinished extends CommandTelemetryStarted {
  finishedAt: number
  executionDurationMs: number
  totalDurationMs: number
  outcome: 'success' | 'failure'
}

/** Application-facing observability port. Domain/application code never reads browser APIs directly. */
export interface CommandTelemetryPort {
  queued(event: CommandTelemetryQueued): void
  started(event: CommandTelemetryStarted): void
  finished(event: CommandTelemetryFinished): void
}

export const NOOP_COMMAND_TELEMETRY: CommandTelemetryPort = Object.freeze({
  queued: () => undefined,
  started: () => undefined,
  finished: () => undefined,
})
