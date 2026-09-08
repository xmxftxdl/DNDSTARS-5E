import { describe, expect, it, vi } from 'vitest'
import { coordinateCombatEnd } from './combatEndCoordinator'

describe('coordinateCombatEnd', () => {
  it('clears the ending combat queue before publishing inactive and opening XP', async () => {
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
      'clear-queues',
      'publish-inactive',
      'open-xp',
    ])
  })

  it('does not publish inactivity or open XP if the queue reset fails', async () => {
    const publishInactiveCombat = vi.fn(async () => {})
    const openExperienceSettlement = vi.fn()

    await expect(coordinateCombatEnd({
      publishInactiveCombat,
      openExperienceSettlement,
      awaitPendingTransactions: async () => {},
      clearMessageQueues: async () => {
        throw new Error('queue-reset-failed')
      },
    })).rejects.toThrow('queue-reset-failed')

    expect(publishInactiveCombat).not.toHaveBeenCalled()
    expect(openExperienceSettlement).not.toHaveBeenCalled()
  })

  it('does not open XP when publishing inactive fails after the queue reset', async () => {
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
    expect(clearMessageQueues).toHaveBeenCalledOnce()
  })
})
