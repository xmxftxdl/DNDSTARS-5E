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

  it('coalesces duplicate transaction ids while an interrupt keeps the action open', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    let executions = 0
    const first = coordinator.enqueueTransaction('action-1', async () => {
      executions += 1
      await barrier
    }, async () => undefined)
    const duplicate = coordinator.enqueueTransaction('action-1', async () => {
      executions += 1
    }, async () => undefined)
    expect(duplicate).toBe(first)
    expect(coordinator.isLocked('action-1')).toBe(true)
    release()
    await first
    expect(executions).toBe(1)
    expect(coordinator.isLocked('action-1')).toBe(false)
  })

  it('preserves the completed transaction when a delivered action is later ignored as a replay', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const input = {
      id: 'action-1',
      mapId: 'map-1',
      combatId: 'combat-1',
      actorId: 'hero-1',
      actionId: 'action-1',
      actionKind: 'dnd5e-weapon-attack',
      now: 1,
    }

    await coordinator.enqueueCombatTransaction(input, async () => ({ status: 'accepted' }), async () => undefined)
    const committed = coordinator.transaction('action-1')
    await coordinator.enqueueCombatTransaction(input, async () => ({ status: 'ignored' }), async () => undefined)

    expect(committed?.status).toBe('committed')
    expect(coordinator.transaction('action-1')).toBe(committed)
  })
})
