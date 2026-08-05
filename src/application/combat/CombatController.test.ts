import { describe, expect, it, vi } from 'vitest'
import { CombatController } from './CombatController'

describe('CombatController', () => {
  it('hides the combat resource transport key from presentation', async () => {
    const rooms = {
      loadSharedResource: vi.fn(async () => ({ round: 2 })),
      saveSharedResource: vi.fn(async () => undefined),
      appendSharedPlayerActionRequest: vi.fn(async () => undefined),
    }
    const controller = new CombatController(rooms as never)
    await expect(controller.loadAuthorityState()).resolves.toEqual({ round: 2 })
    await controller.saveAuthorityState({ round: 3 })
    expect(rooms.loadSharedResource).toHaveBeenCalledWith('combat')
    expect(rooms.saveSharedResource).toHaveBeenCalledWith('combat', { round: 3 }, undefined)
  })

  it('projects transport errors before they reach presentation', async () => {
    const rooms = {
      loadSharedResource: vi.fn(),
      saveSharedResource: vi.fn(async () => { throw new Error('revision-conflict') }),
      appendSharedPlayerActionRequest: vi.fn(),
    }
    const controller = new CombatController(rooms as never)
    await expect(controller.saveAuthorityState({})).rejects.toMatchObject({
      kind: 'conflict', retryable: true,
    })
  })
})
