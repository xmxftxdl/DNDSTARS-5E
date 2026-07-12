import { describe, expect, it, vi } from 'vitest'
import { DmActionTransactionCoordinator } from './dmActionTransactionCoordinator'

describe('DmActionTransactionCoordinator', () => {
  it('serializes actions and waits for each commit barrier', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const order: string[] = []
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    const first = coordinator.enqueue(async () => {
      order.push('first-start')
      await barrier
      order.push('first-commit')
    }, async () => undefined)
    const second = coordinator.enqueue(async () => { order.push('second') }, async () => undefined)
    await Promise.resolve()
    expect(order).toEqual(['first-start'])
    release()
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-commit', 'second'])
  })

  it('recovers a failed transaction and keeps the queue usable', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const recover = vi.fn(async () => undefined)
    await expect(coordinator.enqueue(async () => { throw new Error('failed') }, recover)).rejects.toThrow('failed')
    expect(recover).toHaveBeenCalledOnce()
    await expect(coordinator.enqueue(async () => undefined, recover)).resolves.toBeUndefined()
  })
})
