import { describe, expect, it, vi } from 'vitest'
import { DmActionTransactionCoordinator } from '../../lib/dmActionTransactionCoordinator'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { runMapsPlayerActionTransaction } from './runMapsPlayerActionTransaction'

const action = {
  id: 'action-1',
  mapId: 'map-1',
  combatId: 'combat-1',
  actorTokenId: 'token-1',
  characterId: 'hero-1',
  type: 'dnd5e-weapon-attack',
} as SharedPlayerActionState

describe('runMapsPlayerActionTransaction', () => {
  it('commits only after the authority snapshot commit resolves', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const activity: Array<[boolean, string | null]> = []
    let outcome: { status: 'accepted' } | undefined

    await runMapsPlayerActionTransaction({
      coordinator,
      action,
      run: async () => { outcome = { status: 'accepted' } },
      waitForAuthorityCommit: async () => undefined,
      readOutcome: () => outcome,
      clearOutcome: () => { outcome = undefined },
      setTransactionActive: (active, id) => activity.push([active, id]),
      recover: async () => undefined,
      now: 1,
    })

    expect(activity).toEqual([[true, 'action-1'], [false, null]])
    expect(coordinator.transaction('action-1')?.status).toBe('committed')
  })

  it('rolls back and recovers when a rules branch forgets to acknowledge', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const recover = vi.fn(async () => undefined)
    const rejectAfterRecovery = vi.fn(async () => undefined)

    await expect(runMapsPlayerActionTransaction({
      coordinator,
      action,
      run: async () => undefined,
      waitForAuthorityCommit: async () => undefined,
      readOutcome: () => undefined,
      clearOutcome: () => undefined,
      setTransactionActive: () => undefined,
      recover,
      rejectAfterRecovery,
      now: 1,
    })).rejects.toThrow('missing-player-action-authority-outcome')

    expect(recover).toHaveBeenCalledOnce()
    expect(rejectAfterRecovery).toHaveBeenCalledOnce()
    expect(coordinator.transaction('action-1')?.status).toBe('rolled-back')
  })

  it('silently drops an authority replay without recovery or a new transaction', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    const recover = vi.fn(async () => undefined)
    let outcome: { status: 'ignored' } | undefined

    await runMapsPlayerActionTransaction({
      coordinator,
      action,
      run: async () => { outcome = { status: 'ignored' } },
      waitForAuthorityCommit: async () => undefined,
      readOutcome: () => outcome,
      clearOutcome: () => { outcome = undefined },
      setTransactionActive: () => undefined,
      recover,
      now: 1,
    })

    expect(recover).not.toHaveBeenCalled()
    expect(coordinator.transaction('action-1')).toBeUndefined()
  })

  it('does not clear the first outcome when an in-flight SSE replay is coalesced', async () => {
    const coordinator = new DmActionTransactionCoordinator()
    let outcome: { status: 'accepted' } | undefined
    let release!: () => void
    const authorityCommit = new Promise<void>((resolve) => { release = resolve })
    const clearOutcome = vi.fn(() => { outcome = undefined })
    const input = {
      coordinator,
      action,
      run: async () => { outcome = { status: 'accepted' } },
      waitForAuthorityCommit: () => authorityCommit,
      readOutcome: () => outcome,
      clearOutcome,
      setTransactionActive: () => undefined,
      recover: async () => undefined,
      now: 1,
    }

    const first = runMapsPlayerActionTransaction(input)
    await vi.waitFor(() => expect(outcome).toEqual({ status: 'accepted' }))
    const replay = runMapsPlayerActionTransaction(input)
    expect(replay).toBe(first)
    expect(clearOutcome).toHaveBeenCalledOnce()

    release()
    await Promise.all([first, replay])
    expect(clearOutcome).toHaveBeenCalledTimes(2)
    expect(coordinator.transaction('action-1')?.status).toBe('committed')
  })
})
