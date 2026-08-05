import { assertServerTelemetryPort } from '../ports/server-telemetry.mjs'

export function createInMemoryServerTelemetry(options = {}) {
  const limit = Math.max(10, Number(options.limit) || 1_000)
  const metrics = []
  return assertServerTelemetryPort({
    observe(event) {
      metrics.push(Object.freeze({ ...event, attributes: event.attributes ? { ...event.attributes } : undefined }))
      if (metrics.length > limit) metrics.splice(0, metrics.length - limit)
    },
    recent(operation) {
      return metrics.filter((entry) => !operation || entry.operation === operation)
    },
  })
}
