import { describe, expect, it, vi } from 'vitest'
import { coordinateCombatEnd } from './combatEndCoordinator'

describe('coordinateCombatEnd', () => {
  it('waits for accepted settlements before publishing inactive and then opens XP', async () => {
    const events: string[] = []
    let finishPending = () => {}
    const settlementPending = new Promise<void>((resolve) => {
      finishPending = resolve
    })

    const task = coordinateCombatEnd({
      publishInactiveCombat: () => {
        events.push('publish-inactive')
        return Promise.resolve()
      },
      openExperienceSettlement: () => events.push('open-xp'),
      awaitPendingTransactions: () => {
        events.push('pending-transactions')
        return settlementPending
      },
      clearMessageQueues: async () => {
        events.push('clear-queues')
      },
    })

    expect(events).toEqual(['pending-transactions'])
    finishPending()
    await task
    expect(events).toEqual([
      'pending-transactions',
      'publish-inactive',
      'open-xp',
      'clear-queues',
    ])
  })

  it('preserves queues and XP state when publishing inactive fails', async () => {
    const clearMessageQueues = vi.fn(async () => {})
    const openExperienceSettlement = vi.fn()

    await expect(coordinateCombatEnd({
      publishInactiveCombat: async () => {
        throw new Error('offline')
      },
      openExperienceSettlement,
      awaitPendingTransactions: async () => {},
      clearMessageQueues,
    })).rejects.toThrow('offline')

    expect(openExperienceSettlement).not.toHaveBeenCalled()
    expect(clearMessageQueues).not.toHaveBeenCalled()
  })
})
