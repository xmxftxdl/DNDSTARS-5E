import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import { normalizeCharacter } from '../store/characters'
import type { SharedCombatState, SharedPlayerActionAckState } from './sharedCombatTypes'
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
  it('commits rest receipts, effects and the checked clock at their frozen revisions', async () => {
    const campaignTime = { schemaVersion: 2 as const, worldMinute: 480, displayMode: 'campaign-day' as const, displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 123 }
    const receipt = { schemaVersion: 1 as const, characterId: 'hero', eventId: 'rest:long-rest-complete:480', event: 'long-rest-complete' as const, completedWorldMinute: 480, receipts: { '["test.rest","bless"]': 'used' as const } }
    const character = normalizeCharacter({ id: 'hero', dnd5eRestActivityWindow: receipt })
    const commitSharedResources = vi.fn(async () => ({ revisions: { characters: 5, maps: 8, 'campaign-time': 10 } }))
    const saveSharedResource = vi.fn(), publishAck = vi.fn()
    await publishPlayerActionAckWithSnapshots({ ack: makeAck('accepted'), snapshots: { characters: [character], maps: [], updatedAt: 123, campaignTime }, expectedRevisions: { characters: 4, maps: 7, 'campaign-time': 9 }, commitSharedResources, saveSharedResource, publishAck })
    expect(commitSharedResources).toHaveBeenCalledTimes(1)
    expect(commitSharedResources).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'characters', expectedRevision: 4, data: expect.objectContaining({ characters: [character] }) }),
      expect.objectContaining({ name: 'maps', expectedRevision: 7 }),
      { name: 'campaign-time', expectedRevision: 9, data: campaignTime },
      { name: 'player-action-ack', data: makeAck('accepted') },
    ]), expect.anything())
    expect(saveSharedResource).not.toHaveBeenCalled()
    expect(publishAck).toHaveBeenCalledTimes(1)
  })

  it.each(['combat', 'campaign-time', 'characters', 'maps', 'map-geometry', 'scene-orchestration'])('does not rebase a settlement after a frozen %s conflict', async (resource) => {
    const commitSharedResources = vi.fn(async () => { throw Error(`shared-state-transaction-conflict:${resource}`) })
    const loadSharedResource = vi.fn(async () => null), saveSharedResource = vi.fn(), publishAck = vi.fn()
    await expect(publishPlayerActionAckWithSnapshots({ ack: makeAck('accepted'), snapshots: { characters: [], maps: [], updatedAt: 123 }, expectedRevisions: { combat: 3, 'campaign-time': 4, characters: 5, maps: 6, 'map-geometry': 7, 'scene-orchestration': 8 }, commitSharedResources, loadSharedResource, saveSharedResource, publishAck })).rejects.toThrow(`conflict:${resource}`)
    expect(commitSharedResources).toHaveBeenCalledTimes(1)
    expect(loadSharedResource).toHaveBeenCalledWith('player-action-ack')
    expect(saveSharedResource).not.toHaveBeenCalled()
    expect(publishAck).not.toHaveBeenCalled()
    expect(commitSharedResources).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      readRevisions: { combat: 3, 'campaign-time': 4, 'map-geometry': 7, 'scene-orchestration': 8 },
    }))
  })

  it('refuses sequential writes when a caller requires a frozen authority snapshot', async () => {
    const saveSharedResource = vi.fn(), publishAck = vi.fn()
    await expect(publishPlayerActionAckWithSnapshots({ ack: makeAck('accepted'), expectedRevisions: { characters: 1 }, saveSharedResource, publishAck })).rejects.toThrow('authoritative-atomic-commit-required')
    expect(saveSharedResource).not.toHaveBeenCalled()
    expect(publishAck).not.toHaveBeenCalled()
  })

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
      updatedAt: 123,
    }
    const commitSharedResources = vi.fn(async () => ({
      status: 'committed' as const,
      revisions: { characters: 4, maps: 7, combat: 8, 'player-action-ack': 9 },
    }))
    const saveSharedResource = vi.fn(async () => ({ status: 'saved' as const, revision: 1 }))
    const publishAck = vi.fn(async () => undefined)
    const campaignTime = {
      schemaVersion: 2 as const,
      worldMinute: 540,
      displayMode: 'campaign-day' as const,
      displayMinuteOffset: 0,
      timers: [],
      advances: [],
      updatedAt: 123,
    }
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
        campaignTime,
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
        { name: 'campaign-time', data: campaignTime },
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

  it('accepts a durable ACK when the atomic response is lost after commit', async () => {
    const ack = makeAck('accepted')
    const persisted = {
      ...ack,
      authorityRevisions: { characters: 4, maps: 7, combat: 8, 'player-action-ack': 9 },
    }
    const commitSharedResources = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const loadSharedResourceMock = vi.fn(async (name: string) => {
      void name
      return persisted
    })
    const loadSharedResource = async <T,>(name: string): Promise<T | null> =>
      await loadSharedResourceMock(name) as T
    const publishAck = vi.fn(async () => undefined)

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
      },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      loadSharedResource,
      publishAck,
    })).resolves.toBeUndefined()

    expect(commitSharedResources).toHaveBeenCalledTimes(1)
    expect(loadSharedResourceMock).toHaveBeenCalledWith('player-action-ack')
    expect(publishAck).toHaveBeenCalledWith(persisted)
  })

  it('retries once when a transport failure happened before the authority received the transaction', async () => {
    const ack = makeAck('accepted')
    const commitSharedResources = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        revisions: { characters: 4, maps: 7, 'player-action-ack': 9 },
      })
    const loadSharedResource = vi.fn(async () => null)
    const publishAck = vi.fn(async () => undefined)

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
      },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      loadSharedResource,
      publishAck,
    })).resolves.toBeUndefined()

    expect(commitSharedResources).toHaveBeenCalledTimes(2)
    expect(commitSharedResources.mock.calls[0]?.[1]).toEqual(commitSharedResources.mock.calls[1]?.[1])
    expect(publishAck).toHaveBeenCalledWith(expect.objectContaining({
      ...ack,
      authorityRevisions: { characters: 4, maps: 7, 'player-action-ack': 9 },
    }))
  })

  it('does not retry a semantic authority rejection', async () => {
    const commitSharedResources = vi.fn(async () => {
      throw new Error('shared-state-transaction-invalid:characters')
    })

    await expect(publishPlayerActionAckWithSnapshots({
      ack: makeAck('accepted'),
      snapshots: { characters: [], maps: [], updatedAt: 123 },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      loadSharedResource: vi.fn(async () => null),
      publishAck: vi.fn(),
    })).rejects.toThrow('shared-state-transaction-invalid:characters')

    expect(commitSharedResources).toHaveBeenCalledTimes(1)
  })

  it('accepts an already-durable matching ACK after a CAS conflict', async () => {
    const ack = makeAck('accepted')
    const persisted = {
      ...ack,
      authorityRevisions: { characters: 5, maps: 8, 'player-action-ack': 10 },
    }
    const commitSharedResources = vi.fn(async () => {
      throw new Error('shared-state-transaction-conflict')
    })
    const loadSharedResourceMock = vi.fn(async (name: string) => {
      void name
      return persisted
    })
    const loadSharedResource = async <T,>(name: string): Promise<T | null> =>
      await loadSharedResourceMock(name) as T
    const publishAck = vi.fn(async () => undefined)

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
      },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      loadSharedResource,
      publishAck,
    })).resolves.toBeUndefined()

    expect(commitSharedResources).toHaveBeenCalledTimes(1)
    expect(loadSharedResourceMock).toHaveBeenCalledWith('player-action-ack')
    expect(publishAck).toHaveBeenCalledWith(persisted)
  })

  it('refreshes and retries a combat-only CAS conflict at the same initiative boundary', async () => {
    const ack = makeAck('accepted')
    const combat: SharedCombatState = {
      mapId: 'map-1',
      combatId: 'combat-1',
      active: true,
      round: 2,
      initiativeIndex: 1,
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: 'H', color: '#fff', roll: 18 },
        { tokenId: 'goblin-token', label: 'Goblin', emoji: 'G', color: '#f00', roll: 12 },
      ],
      updatedAt: 123,
    }
    const commitSharedResources = vi.fn()
      .mockRejectedValueOnce(new Error('state-transaction-conflict:combat'))
      .mockResolvedValueOnce({ revisions: { combat: 8, 'player-action-ack': 9 } })
    const loadSharedResourceMock = vi.fn(async (name: string) =>
      name === 'combat' ? { ...combat, updatedAt: 122 } : null)
    const loadSharedResource = async <T,>(name: string): Promise<T | null> =>
      await loadSharedResourceMock(name) as T | null
    const publishAck = vi.fn(async () => undefined)

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        combat,
        updatedAt: 123,
      },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      loadSharedResource,
      publishAck,
    })).resolves.toBeUndefined()

    expect(commitSharedResources).toHaveBeenCalledTimes(2)
    expect(loadSharedResourceMock).toHaveBeenCalledWith('combat')
    expect(publishAck).toHaveBeenCalledWith(expect.objectContaining({
      ...ack,
      authorityRevisions: { combat: 8, 'player-action-ack': 9 },
    }))
  })

  it('does not retry a combat CAS conflict after the initiative boundary changed', async () => {
    const ack = makeAck('accepted')
    const combat: SharedCombatState = {
      mapId: 'map-1',
      combatId: 'combat-1',
      active: true,
      round: 2,
      initiativeIndex: 1,
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: 'H', color: '#fff', roll: 18 },
        { tokenId: 'goblin-token', label: 'Goblin', emoji: 'G', color: '#f00', roll: 12 },
      ],
      updatedAt: 123,
    }
    const commitSharedResources = vi.fn(async () => {
      throw new Error('state-transaction-conflict:combat')
    })
    const loadSharedResource = async <T,>(name: string): Promise<T | null> =>
      name === 'combat' ? { ...combat, initiativeIndex: 0, updatedAt: 124 } as T : null

    await expect(publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: { characters: [], maps: [], combat, updatedAt: 123 },
      saveSharedResource: vi.fn(),
      commitSharedResources,
      loadSharedResource,
      publishAck: vi.fn(),
    })).rejects.toThrow('state-transaction-conflict:combat')

    expect(commitSharedResources).toHaveBeenCalledTimes(1)
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
