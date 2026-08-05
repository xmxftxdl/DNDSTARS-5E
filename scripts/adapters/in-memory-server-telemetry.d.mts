import type { ServerOperationMetric, ServerTelemetryPort } from '../ports/server-telemetry.mjs'
export interface InMemoryServerTelemetry extends ServerTelemetryPort {
  recent(operation?: string): readonly ServerOperationMetric[]
}
export function createInMemoryServerTelemetry(options?: { limit?: number }): InMemoryServerTelemetry
