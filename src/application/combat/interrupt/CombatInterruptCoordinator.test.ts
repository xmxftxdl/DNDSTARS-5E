import { describe, expect, it, vi } from 'vitest'
import { CombatInterruptCoordinator } from './CombatInterruptCoordinator'

interface TestInterrupt { id: string }
interface TestQueue { mapId: string; interrupts: TestInterrupt[] }

function setup(currentMapId = 'map-1') {
  const calls: string[] = []
  const queue: TestQueue = { mapId: 'map-1', interrupts: [{ id: 'interrupt-1' }] }
  const coordinator = new CombatInterruptCoordinator<TestInterrupt, TestQueue>({
    currentMapId: () => currentMapId || undefined,
    queueMapId: (value) => value.mapId,
    queueInterrupts: (value) => value.interrupts,
    interruptId: (value) => value.id,
    loadQueue: vi.fn(async () => queue),
    beforePublish: vi.fn(async () => { calls.push('before') }),
    publish: vi.fn(async () => { calls.push('publish') }),
    answer: vi.fn(async () => { calls.push('answer') }),
    finish: vi.fn(async () => { calls.push('finish') }),
    waitForDm: vi.fn(async () => { calls.push('wait') }),
    rollback: vi.fn(async () => { calls.push('rollback') }),
  })
  return { coordinator, calls }
}

describe('CombatInterruptCoordinator', () => {
  it('keeps pre-publish activation ordered before persistence', async () => {
    const { coordinator, calls } = setup()
    await coordinator.publish({ id: 'interrupt-1' })
    expect(calls).toEqual(['before', 'publish'])
  })

  it('loads only an interrupt in the current map projection', async () => {
    expect(await setup().coordinator.load('interrupt-1')).toEqual({ id: 'interrupt-1' })
    expect(await setup('map-2').coordinator.load('interrupt-1')).toBeUndefined()
  })

  it('commits answers and rolls expired windows back', async () => {
    const answered = setup()
    await answered.coordinator.settle('interrupt-1', { accepted: true }, 'answered')
    expect(answered.calls).toEqual(['finish'])

    const expired = setup()
    await expired.coordinator.settle('interrupt-1', undefined, 'expired')
    expect(expired.calls).toEqual(['rollback'])
  })

  it('fails closed when there is no active map', async () => {
    const { coordinator, calls } = setup('')
    expect(await coordinator.answer('interrupt-1', {})).toBe(false)
    expect(calls).toEqual([])
  })
})
