import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { coordinateForcedMovementPersistentAreas } from './ForcedMovementPersistentAreaCoordinator'

describe('forced movement persistent-area coordinator', () => {
  it.each([undefined, 'teleport'] as const)('settles only actual travel for mode %s', async transportMode => {
    const token = { id: 'actor', type: 'enemy' as const, label: 'Actor', x: 25, y: 25,
      hp: 10, maxHp: 10, size: 1, emoji: '', color: '' }
    const beforeMap: BattleMap = { id: 'map', name: '', width: 500, height: 500, gridSize: 50,
      feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token],
      dnd5ePluginAreas: [1, 2].map(col => ({
        id: `area-${col}`, pluginId: 'audit', featureId: 'audit:area', label: 'Area', color: '#fff',
        sourceCharacterId: 'source', sourceTokenId: 'source', relation: 'any' as const,
        cells: [{ col, row: 0 }], createdRound: 1, expiresAfterRound: 10,
        triggers: [{ id: 'enter', label: 'Enter', timing: 'on-enter' as const }],
      })) }
    const afterMap = { ...beforeMap, tokens: [{ ...token, x: 125 }] }
    const before = structuredClone({ beforeMap, afterMap })
    const settleCandidates = vi.fn(async (request: Parameters<Parameters<typeof coordinateForcedMovementPersistentAreas>[0]['settleCandidates']>[0]) => ({
      map: request.map, characters: [...request.characters], logs: ['settled'],
    }))
    const result = await coordinateForcedMovementPersistentAreas({
      beforeMap, afterMap, characters: [], tokenId: token.id, round: 1, turnKey: '1:actor',
      transportMode, settleCandidates,
    })
    expect(settleCandidates).toHaveBeenCalledTimes(1)
    expect(settleCandidates.mock.calls[0][0].candidates.map(candidate => candidate.area.id))
      .toEqual(transportMode === 'teleport' ? ['area-2'] : ['area-1', 'area-2'])
    expect(result.logs).toEqual(['settled'])
    expect({ beforeMap, afterMap }).toEqual(before)
  })

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
