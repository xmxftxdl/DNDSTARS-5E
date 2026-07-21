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

    await expect(runMapsPlayerActionTransaction({
      coordinator,
      action,
      run: async () => undefined,
      waitForAuthorityCommit: async () => undefined,
      readOutcome: () => undefined,
      clearOutcome: () => undefined,
      setTransactionActive: () => undefined,
      recover,
      now: 1,
    })).rejects.toThrow('missing-player-action-authority-outcome')

    expect(recover).toHaveBeenCalledOnce()
    expect(coordinator.transaction('action-1')?.status).toBe('rolled-back')
  })
})
