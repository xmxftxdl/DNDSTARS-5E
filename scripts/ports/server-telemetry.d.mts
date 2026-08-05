export interface ServerOperationMetric {
  operation: string
  durationMs: number
  outcome: 'success' | 'failure'
  observedAt: number
  attributes?: Record<string, string | number | boolean>
}
export interface ServerTelemetryPort {
  observe(event: ServerOperationMetric): void
}
export function assertServerTelemetryPort<T extends ServerTelemetryPort>(value: T): T
export function observeServerOperation(telemetry: ServerTelemetryPort | undefined, event: ServerOperationMetric): void
