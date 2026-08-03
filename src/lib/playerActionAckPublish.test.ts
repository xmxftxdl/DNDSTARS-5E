import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionAckState } from './sharedCombatTypes'
import { publishPlayerActionAckWithSnapshots } from './playerActionAckPublish'

function makeAck(status: SharedPlayerActionAckState['status']): SharedPlayerActionAckState {
  return {
    id: `ack-${status}`,
    mapId: 'map-1',
    actionId: 'action-1',
    status,
    round: 1,
    initiativeIndex: 0,
    updatedAt: 100,
  }
}

describe('publishPlayerActionAckWithSnapshots', () => {
  it('saves accepted authoritative snapshots before publishing the ack', async () => {
    const calls: string[] = []
    const character = { id: 'char-1' } as Character
    const map = { id: 'map-1' } as BattleMap
    const saveSharedResource = vi.fn(async (name: string) => {
      calls.push(`save:${name}`)
      return { status: 'saved' as const, revision: 1 }
    })
    const publishAck = vi.fn(async () => {
      calls.push('publish:ack')
    })

    await publishPlayerActionAckWithSnapshots({
      ack: makeAck('accepted'),
      snapshots: {
        characters: [character],
        characterSelectedId: character.id,
        maps: [map],
        mapSelectedId: map.id,
        updatedAt: 123,
        combat: {
          mapId: 'map-1',
          active: true,
          round: 1,
          initiativeIndex: 0,
          initiativeOrder: [],
          updatedAt: 123,
        },
      },
      saveSharedResource,
      publishAck,
    })

    const undoOptions = {
      undoGroupId: 'player-action:action-1',
      undoLabel: '结算玩家行动',
    }
    expect(saveSharedResource).toHaveBeenCalledWith('characters', {
      characters: [character],
      selectedId: 'char-1',
      updatedAt: 123,
    }, undoOptions)
    expect(saveSharedResource).toHaveBeenCalledWith('maps', {
      maps: [map],
      selectedId: 'map-1',
      updatedAt: 123,
    }, undoOptions)
    expect(saveSharedResource).toHaveBeenCalledWith('combat', {
      mapId: 'map-1',
      active: true,
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: [],
      updatedAt: 123,
    }, undoOptions)
    expect(saveSharedResource).toHaveBeenCalledWith('player-action-ack', makeAck('accepted'))
    expect(publishAck).toHaveBeenCalledWith(makeAck('accepted'))
    expect(calls.slice(-2)).toEqual(['save:player-action-ack', 'publish:ack'])
  })

  it('publishes rejected acknowledgements without saving snapshots', async () => {
    const saveSharedResource = vi.fn(async () => ({ status: 'saved' as const, revision: 1 }))
    const publishAck = vi.fn(async () => undefined)
    const ack = makeAck('rejected')

    await publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
      },
      saveSharedResource,
      publishAck,
    })

    expect(saveSharedResource).toHaveBeenCalledTimes(1)
    expect(saveSharedResource).toHaveBeenCalledWith('player-action-ack', ack)
    expect(publishAck).toHaveBeenCalledWith(ack)
  })

  it('does not publish an accepted ack when an authoritative snapshot conflicts', async () => {
    const saveSharedResource = vi.fn(async (name: string) => (
      name === 'maps'
        ? { status: 'conflict' as const, expectedRevision: 4, currentRevision: 5 }
        : { status: 'saved' as const, revision: 5 }
    ))
    const publishAck = vi.fn(async () => undefined)

    await expect(publishPlayerActionAckWithSnapshots({
      ack: makeAck('accepted'),
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
        mapGeometry: {
          schemaVersion: 3,
          maps: [],
          updatedAt: 123,
        },
      },
      saveSharedResource,
      publishAck,
    })).rejects.toThrow('authoritative-resource-save-rejected:maps:conflict')

    expect(saveSharedResource).not.toHaveBeenCalledWith('player-action-ack', expect.anything())
    expect(publishAck).not.toHaveBeenCalled()
  })

  it('does not publish an ack event when the ack resource itself is rejected', async () => {
    const ack = makeAck('rejected')
    const saveSharedResource = vi.fn(async () => ({ status: 'failed' as const }))
    const publishAck = vi.fn(async () => undefined)

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      saveSharedResource,
      publishAck,
    })).rejects.toThrow('authoritative-resource-save-rejected:player-action-ack:failed')

    expect(publishAck).not.toHaveBeenCalled()
  })

  it('includes accepted snapshots and the acknowledgement in one atomic commit', async () => {
    const ack = makeAck('accepted')
    const combat = {
      mapId: 'map-1',
      combatId: 'combat-1',
      active: true,
      round: 1,
      initiativeIndex: 1,
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: 'H', color: '#fff', roll: 18 },
        { tokenId: 'goblin-token', label: 'Goblin', emoji: 'G', color: '#f00', roll: 12 },
      ],
      monsterTurnProgress: {
        schemaVersion: 1 as const,
        status: 'starting' as const,
        combatId: 'combat-1',
        round: 1,
        initiativeIndex: 1,
        initiativeSlotId: 'goblin-token',
        tokenId: 'goblin-token',
        requestId: ack.actionId,
        startedAt: 123,
        updatedAt: 123,
        expiresAt: 60_123,
      },
      updatedAt: 123,
    }
    const commitSharedResources = vi.fn(async () => ({
      status: 'committed' as const,
      revisions: { characters: 4, maps: 7, combat: 8, 'player-action-ack': 9 },
    }))
    const saveSharedResource = vi.fn(async () => ({ status: 'saved' as const, revision: 1 }))
    const publishAck = vi.fn(async () => undefined)
    await publishPlayerActionAckWithSnapshots({
      ack,
      roomJournalMutations: [{
        operation: 'add-shared-note',
        kind: 'task',
        title: '找到出口',
        body: '',
        authorityReceiptId: 'interaction:task:1',
      }],
      processed: {
        mapId: 'map-1',
        actionIds: ['action-1'],
        updatedAt: 123,
      },
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
        combat,
        mapGeometry: {
          schemaVersion: 3,
          maps: [],
          updatedAt: 123,
        },
      },
      saveSharedResource,
      commitSharedResources,
      publishAck,
    })
    expect(commitSharedResources).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'characters' }),
        expect.objectContaining({ name: 'maps' }),
        { name: 'combat', data: combat },
        expect.objectContaining({ name: 'map-geometry' }),
        expect.objectContaining({ name: 'player-action-processed' }),
        { name: 'player-action-ack', data: ack },
      ]),
      expect.objectContaining({
        transactionId: 'player-action:action-1',
        roomJournalMutations: [expect.objectContaining({
          operation: 'add-shared-note',
          authorityReceiptId: 'interaction:task:1',
        })],
      }),
    )
    expect(saveSharedResource).not.toHaveBeenCalled()
    expect(publishAck).toHaveBeenCalledWith(expect.objectContaining({
      ...ack,
      authorityRevisions: { characters: 4, maps: 7, combat: 8, 'player-action-ack': 9 },
    }))
  })

  it('keeps a durable commit successful when live ACK delivery fails', async () => {
    const ack = makeAck('accepted')
    const commitSharedResources = vi.fn(async () => ({
      revisions: { maps: 8, combat: 9, 'player-action-ack': 10 },
    }))
    const publishAck = vi.fn(async () => {
      throw new Error('sse-disconnected-after-commit')
    })

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
      },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      publishAck,
    })).resolves.toBeUndefined()

    expect(commitSharedResources).toHaveBeenCalledTimes(1)
    expect(publishAck).toHaveBeenCalledTimes(1)
  })

  it('commits a rejected acknowledgement and its replay receipt atomically', async () => {
    const ack = makeAck('rejected')
    const commitSharedResources = vi.fn(async () => ({
      revisions: { 'player-action-processed': 3, 'player-action-ack': 4 },
    }))
    const publishAck = vi.fn(async () => undefined)
    await publishPlayerActionAckWithSnapshots({
      ack,
      processed: { mapId: 'map-1', actionIds: ['action-1'], updatedAt: 100 },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      publishAck,
    })
    expect(commitSharedResources).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'player-action-processed' }),
      { name: 'player-action-ack', data: ack },
    ], expect.objectContaining({ transactionId: 'player-action:action-1' }))
    expect(publishAck).toHaveBeenCalledWith(expect.objectContaining({
      authorityRevisions: { 'player-action-processed': 3, 'player-action-ack': 4 },
    }))
  })
})
