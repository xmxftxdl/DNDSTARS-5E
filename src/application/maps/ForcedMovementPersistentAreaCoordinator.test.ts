import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { coordinateForcedMovementPersistentAreas } from './ForcedMovementPersistentAreaCoordinator'

describe('forced movement persistent-area coordinator', () => {
  it('does not settle triggers when the authority snapshot has no matching token pair', async () => {
    const beforeMap = { id: 'map', tokens: [] } as unknown as BattleMap
    const afterMap = { id: 'map', tokens: [] } as unknown as BattleMap
    const settleCandidates = vi.fn()

    const result = await coordinateForcedMovementPersistentAreas({
      beforeMap,
      afterMap,
      characters: [],
      tokenId: 'missing',
      round: 1,
      turnKey: '1:missing',
      settleCandidates,
    })

    expect(result).toEqual({ map: afterMap, characters: [], logs: [] })
    expect(settleCandidates).not.toHaveBeenCalled()
  })
})
