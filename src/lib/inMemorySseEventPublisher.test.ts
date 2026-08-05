import { describe, expect, it } from 'vitest'
import { createInMemorySseEventPublisher } from '../../scripts/adapters/in-memory-sse-event-publisher.mjs'

function fakeResponse() {
  return {
    writes: [] as string[], headers: {} as Record<string, string>,
    destroyed: false, writableEnded: false,
    writeHead(_status: number, headers: Record<string, string>) { this.headers = headers },
    flushHeaders() {},
    write(value: string) { this.writes.push(value) },
  }
}

describe('in-memory SSE EventPublisher adapter', () => {
  it('projects live events and emits an ordered all-channel envelope', () => {
    const clients = new Map<string, Set<ReturnType<typeof fakeResponse>>>()
    const backlog = new Map<string, unknown[]>()
    let sequence = 3
    const publisher = createInMemorySseEventPublisher({
      eventClients: clients,
      eventBacklog: backlog,
      storageKey: (channel: string) => `ROOM:${channel}`,
      projectPayload: (_channel: string, payload: { secret?: string }, viewer: { role: string }) =>
        viewer.role === 'dm' ? payload : { ...payload, secret: undefined },
      replaySlice: (entries: unknown[]) => entries.slice(-10),
      pushBacklog: (entries: unknown[], payload: unknown) => [...entries, payload].slice(-20),
      capChannels: () => undefined,
      channelLimit: 20,
      streamId: 'server-one',
      currentSequence: () => sequence,
      nextSequence: () => ++sequence,
      now: () => 99,
      heartbeatMs: 60_000,
    })
    const response = fakeResponse()
    const unsubscribe = publisher.subscribe('combat', response, { role: 'player' })
    publisher.publish('combat', { id: 'one', secret: 'dm-only' })

    expect(response.headers['X-Accel-Buffering']).toBe('no')
    expect(response.writes.join('')).toContain('"id":"one"')
    expect(response.writes.join('')).not.toContain('dm-only')
    expect(backlog.get('ROOM:_all')).toEqual([{
      channel: 'combat', payload: { id: 'one', secret: 'dm-only' },
      sequence: 4, streamId: 'server-one', emittedAt: 99,
    }])
    unsubscribe()
    expect(clients.size).toBe(0)
  })
})
