import { describe, expect, it } from 'vitest'
import { createInMemoryServerTelemetry } from '../../scripts/adapters/in-memory-server-telemetry.mjs'
import { createInMemorySseEventPublisher } from '../../scripts/adapters/in-memory-sse-event-publisher.mjs'

describe('server telemetry port', () => {
  it('bounds retained metrics and records SSE propagation without changing delivery', () => {
    const telemetry = createInMemoryServerTelemetry({ limit: 10 })
    for (let index = 0; index < 12; index += 1) {
      telemetry.observe({
        operation: 'seed', durationMs: index, outcome: 'success', observedAt: index,
      })
    }
    expect(telemetry.recent('seed')).toHaveLength(10)

    const publisher = createInMemorySseEventPublisher({
      eventClients: new Map(),
      eventBacklog: new Map(),
      storageKey: (channel: string) => channel,
      projectPayload: (_channel: string, payload: unknown) => payload,
      replaySlice: (entries: unknown[]) => entries,
      pushBacklog: (entries: unknown[], payload: unknown) => [...entries, payload],
      capChannels: () => undefined,
      channelLimit: 10,
      streamId: 'test',
      currentSequence: () => 0,
      nextSequence: () => 1,
      now: () => 42,
      telemetry,
    })
    publisher.publish('combat', { id: 'event' })

    const observations = telemetry.recent('sse.publish')
    expect(observations).toHaveLength(2)
    expect(observations.every((event) => event.outcome === 'success')).toBe(true)
    expect(observations.map((event) => event.attributes?.channel)).toEqual(['combat', '_all'])
  })
})
