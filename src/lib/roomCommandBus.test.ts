import { describe, expect, it } from 'vitest'
import { RoomCommandBus, type RoomCommandEnvelope } from './roomCommandBus'

interface TestCommand extends RoomCommandEnvelope {
  value: number
}

describe('RoomCommandBus', () => {
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
})
