/** Fail-open server observability port. Telemetry must never alter authority. */
export function assertServerTelemetryPort(value) {
  if (!value || typeof value.observe !== 'function') throw new TypeError('invalid ServerTelemetry port')
  return value
}

export function observeServerOperation(telemetry, event) {
  try {
    telemetry?.observe(event)
  } catch {
    // Diagnostic adapters are deliberately isolated from authoritative work.
  }
}
