import { describe, expect, it } from 'vitest'
import { RoomCommandBus, type RoomCommandEnvelope } from './roomCommandBus'

interface TestCommand extends RoomCommandEnvelope {
  value: number
}

describe('RoomCommandBus', () => {
  it('reports queue and execution latency through the telemetry port', async () => {
    const events: Array<{ kind: string; value: unknown }> = []
    const timestamps = [10, 14, 21]
    const bus = new RoomCommandBus<TestCommand, number>(
      (command) => command.value,
      {
        now: () => timestamps.shift() ?? 21,
        telemetry: {
          queued: (value) => events.push({ kind: 'queued', value }),
          started: (value) => events.push({ kind: 'started', value }),
          finished: (value) => events.push({ kind: 'finished', value }),
        },
      },
    )

    await expect(bus.dispatch({
      id: 'observed', type: 'test', aggregateId: 'character:a', issuedAt: 1, value: 3,
    })).resolves.toBe(3)
    expect(events).toMatchObject([
      { kind: 'queued', value: { commandId: 'observed', queuedAt: 10 } },
      { kind: 'started', value: { queueDurationMs: 4 } },
      { kind: 'finished', value: { executionDurationMs: 7, totalDurationMs: 11, outcome: 'success' } },
    ])
  })

  it('serializes commands that target the same aggregate', async () => {
    const events: string[] = []
    const resolvers: Array<() => void> = []
    const bus = new RoomCommandBus<TestCommand, number>(async (command) => {
      events.push(`start:${command.value}`)
      await new Promise<void>((resolve) => resolvers.push(resolve))
      events.push(`end:${command.value}`)
      return command.value
    })

    const first = bus.dispatch({ id: 'one', type: 'test', aggregateId: 'room:a', issuedAt: 1, value: 1 })
    const second = bus.dispatch({ id: 'two', type: 'test', aggregateId: 'room:a', issuedAt: 2, value: 2 })
    expect(events).toEqual(['start:1'])
    resolvers.shift()?.()
    await first
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['start:1', 'end:1', 'start:2'])
    resolvers.shift()?.()
    await expect(second).resolves.toBe(2)
  })

  it('runs commands for unrelated aggregates without waiting on each other', async () => {
    const events: string[] = []
    const resolvers = new Map<number, () => void>()
    const bus = new RoomCommandBus<TestCommand, number>(async (command) => {
      events.push(`start:${command.value}`)
      await new Promise<void>((resolve) => resolvers.set(command.value, resolve))
      events.push(`end:${command.value}`)
      return command.value
    })

    const first = bus.dispatch({
      id: 'one',
      type: 'test',
      aggregateId: 'character:a',
      issuedAt: 1,
      value: 1,
    })
    const second = bus.dispatch({
      id: 'two',
      type: 'test',
      aggregateId: 'character:b',
      issuedAt: 2,
      value: 2,
    })

    expect(events).toEqual(['start:1', 'start:2'])
    resolvers.get(1)?.()
    resolvers.get(2)?.()
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2])
  })

  it('serializes commands that overlap on any related aggregate', async () => {
    const events: string[] = []
    const resolvers = new Map<number, () => void>()
    const bus = new RoomCommandBus<TestCommand, number>(async (command) => {
      events.push(`start:${command.value}`)
      await new Promise<void>((resolve) => resolvers.set(command.value, resolve))
      events.push(`end:${command.value}`)
      return command.value
    })

    const first = bus.dispatch({
      id: 'character-and-token',
      type: 'test',
      aggregateId: 'character:a',
      relatedAggregateIds: ['map:a:token:one'],
      issuedAt: 1,
      value: 1,
    })
    const overlapping = bus.dispatch({
      id: 'same-token',
      type: 'test',
      aggregateId: 'map:a:token:one',
      issuedAt: 2,
      value: 2,
    })
    const unrelated = bus.dispatch({
      id: 'other-character',
      type: 'test',
      aggregateId: 'character:b',
      issuedAt: 3,
      value: 3,
    })

    expect(events).toEqual(['start:1', 'start:3'])
    resolvers.get(3)?.()
    await expect(unrelated).resolves.toBe(3)
    expect(events).toEqual(['start:1', 'start:3', 'end:3'])

    resolvers.get(1)?.()
    await expect(first).resolves.toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['start:1', 'start:3', 'end:3', 'end:1', 'start:2'])

    resolvers.get(2)?.()
    await expect(overlapping).resolves.toBe(2)
  })

  it('returns the same result for a replayed command ID', async () => {
    let calls = 0
    const bus = new RoomCommandBus<TestCommand, number>((command) => {
      calls += 1
      return command.value
    })
    const command = { id: 'same', type: 'test', aggregateId: 'room:a', issuedAt: 1, value: 7 }
    await expect(Promise.all([bus.dispatch(command), bus.dispatch(command)])).resolves.toEqual([7, 7])
    expect(calls).toBe(1)
  })

  it('does not retain rejected command IDs', async () => {
    let calls = 0
    const bus = new RoomCommandBus<TestCommand, number>(() => {
      calls += 1
      if (calls === 1) throw new Error('retry')
      return 9
    })
    const command = { id: 'retryable', type: 'test', aggregateId: 'room:a', issuedAt: 1, value: 9 }
    await expect(bus.dispatch(command)).rejects.toThrow('retry')
    await expect(bus.dispatch(command)).resolves.toBe(9)
  })

  it('keeps only the latest queued value without changing aggregate order', async () => {
    const events: string[] = []
    const resolvers = new Map<number, () => void>()
    const bus = new RoomCommandBus<TestCommand, number>(async (command) => {
      events.push(`start:${command.value}`)
      await new Promise<void>((resolve) => resolvers.set(command.value, resolve))
      events.push(`end:${command.value}`)
      return command.value
    })

    const first = bus.dispatch({ id: 'one', type: 'test', aggregateId: 'room:a', issuedAt: 1, value: 1 })
    const stale = bus.dispatchLatest(
      { id: 'two', type: 'test', aggregateId: 'room:a', issuedAt: 2, value: 2 },
      'latest:room:a',
    )
    const latest = bus.dispatchLatest(
      { id: 'three', type: 'test', aggregateId: 'room:a', issuedAt: 3, value: 3 },
      'latest:room:a',
    )
    const after = bus.dispatch({ id: 'four', type: 'test', aggregateId: 'room:a', issuedAt: 4, value: 4 })
    const newest = bus.dispatchLatest(
      { id: 'five', type: 'test', aggregateId: 'room:a', issuedAt: 5, value: 5 },
      'latest:room:a',
    )

    expect(stale).toBe(latest)
    expect(newest).not.toBe(latest)
    expect(events).toEqual(['start:1'])
    resolvers.get(1)?.()
    await expect(first).resolves.toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['start:1', 'end:1', 'start:3'])

    resolvers.get(3)?.()
    await expect(Promise.all([stale, latest])).resolves.toEqual([3, 3])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['start:1', 'end:1', 'start:3', 'end:3', 'start:4'])

    resolvers.get(4)?.()
    await expect(after).resolves.toBe(4)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual([
      'start:1', 'end:1',
      'start:3', 'end:3',
      'start:4', 'end:4',
      'start:5',
    ])

    resolvers.get(5)?.()
    await expect(newest).resolves.toBe(5)
    expect(events).not.toContain('start:2')
  })
})
