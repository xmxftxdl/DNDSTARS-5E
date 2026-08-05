import type {
  CommandTelemetryFinished,
  CommandTelemetryPort,
  CommandTelemetryQueued,
  CommandTelemetryStarted,
} from '../../ports/commandTelemetry'

export const ROOM_COMMAND_METRIC_EVENT = 'astraltrace:room-command-metric'

function safeMark(name: string, detail: object): void {
  try {
    globalThis.performance?.mark(name, { detail })
  } catch {
    // Performance marks are diagnostic only and must never affect authority writes.
  }
}

export class PerformanceCommandTelemetry implements CommandTelemetryPort {
  queued(event: CommandTelemetryQueued): void {
    safeMark(`room-command:${event.commandId}:queued`, event)
  }

  started(event: CommandTelemetryStarted): void {
    safeMark(`room-command:${event.commandId}:started`, event)
  }

  finished(event: CommandTelemetryFinished): void {
    safeMark(`room-command:${event.commandId}:finished`, event)
    try {
      globalThis.dispatchEvent?.(new CustomEvent(ROOM_COMMAND_METRIC_EVENT, { detail: event }))
    } catch {
      // CustomEvent is absent in non-browser tests and optional in older WebViews.
    }
  }
}

export const browserRoomCommandTelemetry = new PerformanceCommandTelemetry()
