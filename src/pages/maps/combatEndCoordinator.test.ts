import { describe, expect, it, vi } from 'vitest'
import { coordinateCombatEnd } from './combatEndCoordinator'

describe('coordinateCombatEnd', () => {
  it('starts the inactive publish and opens XP before waiting for cleanup', async () => {
    const events: string[] = []
    let finishPublish = () => {}
    const publishPending = new Promise<void>((resolve) => {
      finishPublish = resolve
    })

    const task = coordinateCombatEnd({
      publishInactiveCombat: () => {
        events.push('publish-inactive')
        return publishPending
      },
      openExperienceSettlement: () => events.push('open-xp'),
      awaitPendingTransactions: async () => {
        events.push('pending-transactions')
      },
      clearMessageQueues: async () => {
        events.push('clear-queues')
      },
    })

    expect(events).toEqual(['publish-inactive', 'open-xp'])
    finishPublish()
    await task
    expect(events).toEqual([
      'publish-inactive',
      'open-xp',
      'pending-transactions',
      'clear-queues',
    ])
  })

  it('still clears local queues when publishing the inactive snapshot fails', async () => {
    const clearMessageQueues = vi.fn(async () => {})

    await expect(coordinateCombatEnd({
      publishInactiveCombat: async () => {
        throw new Error('offline')
      },
      openExperienceSettlement: () => {},
      awaitPendingTransactions: async () => {},
      clearMessageQueues,
    })).rejects.toThrow('offline')

    expect(clearMessageQueues).toHaveBeenCalledOnce()
  })
})
