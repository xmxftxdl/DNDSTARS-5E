import { describe, expect, it, vi } from 'vitest'
import { DmActionTransactionCoordinator } from './dmActionTransactionCoordinator'

const transactionInput = {
  id: 'action-1',
  mapId: 'map-1',
  combatId: 'combat-1',
  actorId: 'hero-1',
  actionId: 'action-1',
  actionKind: 'dnd5e-weapon-attack',
  now: 1,
}

describe('DmActionTransactionCoordinator combat lifecycle', () => {
  it('commits an accepted authoritative action', async () => {
    const coordinator = new DmActionTransactionCoordinator()

    await coordinator.enqueueCombatTransaction(
      transactionInput,
      async (transaction) => {
        expect(transaction.status).toBe('preparing')
        return { status: 'accepted' }
      },
      async () => undefined,
    )

    expect(coordinator.transaction('action-1')?.status).toBe('committed')
  })

  it('rolls back a rejected authoritative action with its reason', async () => {
    const coordinator = new DmActionTransactionCoordinator()

    await coordinator.enqueueCombatTransaction(
      transactionInput,
      async () => ({ status: 'rejected', reason: 'out-of-range' }),
      async () => undefined,
    )

    expect(coordinator.transaction('action-1')).toMatchObject({
      status: 'rolled-back',
      rollbackReason: 'out-of-range',
    })
  })

  it('rolls back before invoking recovery when authority execution throws', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const recover = vi.fn(async (_error: unknown, transaction: { status: string }) => {
      expect(transaction.status).toBe('rolled-back')
    })

    await expect(coordinator.enqueueCombatTransaction(
      transactionInput,
      async () => { throw new Error('boom') },
      recover,
    )).rejects.toThrow('boom')

    expect(recover).toHaveBeenCalledOnce()
    expect(coordinator.transaction('action-1')).toMatchObject({
      status: 'rolled-back',
      rollbackReason: 'authority-execution-failed',
    })
  })
})
