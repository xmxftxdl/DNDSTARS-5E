import { describe, expect, it, vi } from 'vitest'
import {
  buildPlayerActionRequestQueueState,
  buildSharedPlayerAction,
  consumePlayerActionAck,
  createSharedPlayerActionEnvelope,
  hydratedProcessedPlayerActionIdsForDm,
  isAuthoritativeActionSnapshotReady,
  loadDmPlayerActionBatch,
  publishPlayerActionRequest,
  queuedPlayerActionsForDm,
  resolvePlayerActionAckDecision,
  shouldClearPendingPlayerActionAfterAck,
  submitPlayerActionRequestWithLock,
  syncAuthoritativePlayerActionState,
  waitForAuthoritativeActionSnapshot,
} from './playerActionSync'

describe('player action sync barrier', () => {
  it('is ready when no authoritative appliedAt barrier is provided', () => {
    expect(isAuthoritativeActionSnapshotReady(undefined, undefined, undefined)).toBe(true)
  })

  it('waits until both maps and characters reach the DM appliedAt watermark', () => {
    expect(isAuthoritativeActionSnapshotReady(1000, 1000, 999)).toBe(false)
    expect(isAuthoritativeActionSnapshotReady(1000, 999, 1000)).toBe(false)
    expect(isAuthoritativeActionSnapshotReady(1000, 1000, 1000)).toBe(true)
    expect(isAuthoritativeActionSnapshotReady(1000, 1200, 1100)).toBe(true)
  })

  it('builds canonical player and DM action envelopes', () => {
    expect(
      buildSharedPlayerAction({
        mapId: 'map-1',
        combatId: 'combat-1',
        sourceMode: 'player',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 2,
        initiativeIndex: 1,
        seq: 7,
        now: 1234,
        patch: { type: 'move-token', targetPosition: { x: 10, y: 20 } },
      }),
    ).toMatchObject({
      id: 'map-1:player-action:1234:7',
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      status: 'pending',
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 10, y: 20 },
      round: 2,
      initiativeIndex: 1,
      seq: 7,
      updatedAt: 1234,
    })

    expect(
      buildSharedPlayerAction({
        mapId: 'map-1',
        sourceMode: 'dm',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 1,
        initiativeIndex: 0,
        seq: 1,
        now: 99,
        patch: { type: 'end-turn' },
      }).id,
    ).toBe('map-1:dm-action:99:1')
  })

  it('creates a shared player action envelope from valid UI context', () => {
    let seq = 0

    expect(
      createSharedPlayerActionEnvelope({
        mapId: 'map-1',
        combatId: 'combat-1',
        sourceMode: 'player',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 2,
        initiativeIndex: 1,
        nextSeq: () => {
          seq += 1
          return seq
        },
        now: () => 1234,
        patch: { type: 'move-token', targetPosition: { x: 10, y: 20 } },
      }),
    ).toMatchObject({
      id: 'map-1:player-action:1234:1',
      type: 'move-token',
      targetPosition: { x: 10, y: 20 },
    })
    expect(seq).toBe(1)
  })

  it('does not consume a sequence number when required action context is missing', () => {
    const nextSeq = vi.fn(() => 1)

    expect(
      createSharedPlayerActionEnvelope({
        mapId: undefined,
        sourceMode: 'player',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 1,
        initiativeIndex: 0,
        nextSeq,
        now: () => 1234,
        patch: { type: 'end-turn' },
      }),
    ).toBeNull()
    expect(nextSeq).not.toHaveBeenCalled()
  })

  it('merges queued player action requests without replaying duplicates or stale combat actions', () => {
    const action = buildSharedPlayerAction({
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 4,
      now: 4000,
      patch: { type: 'end-turn' },
    })
    const oldLive = { ...action, id: 'old-live', seq: 1, updatedAt: 1000 }
    const staleCombat = { ...action, id: 'stale-combat', combatId: 'combat-old', seq: 2, updatedAt: 2000 }
    const duplicate = { ...action, seq: 3, updatedAt: 3000 }

    const queue = buildPlayerActionRequestQueueState({
      action,
      current: {
        mapId: 'map-1',
        combatId: 'combat-1',
        requests: [oldLive, staleCombat, duplicate],
        updatedAt: 3000,
      },
      updatedAt: 5000,
    })

    expect(queue.requests.map((item) => item.id)).toEqual(['old-live', action.id])
    expect(queue.updatedAt).toBe(5000)
  })

  it('returns queued DM actions in deterministic order and skips processed ids', () => {
    const base = {
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player' as const,
      status: 'pending' as const,
      type: 'end-turn' as const,
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
    }
    const queued = queuedPlayerActionsForDm({
      mapId: 'map-1',
      combatId: 'combat-1',
      processedActionIds: new Set(['done']),
      queue: {
        mapId: 'map-1',
        combatId: 'combat-1',
        updatedAt: 5000,
        requests: [
          { ...base, id: 'late', seq: 2, updatedAt: 2000 },
          { ...base, id: 'done', seq: 1, updatedAt: 1000 },
          { ...base, id: 'early', seq: 1, updatedAt: 1000 },
          { ...base, id: 'other-map', mapId: 'map-2', seq: 3, updatedAt: 3000 },
        ],
      },
    })

    expect(queued.map((action) => action.id)).toEqual(['early', 'late'])
  })

  it('hydrates processed action ids only for the current map and combat', () => {
    expect(
      hydratedProcessedPlayerActionIdsForDm({
        mapId: 'map-1',
        combatId: 'combat-1',
        processed: { mapId: 'map-1', combatId: 'combat-1', actionIds: ['a', 'b'] },
      }),
    ).toEqual(new Set(['a', 'b']))

    expect(
      hydratedProcessedPlayerActionIdsForDm({
        mapId: 'map-1',
        combatId: 'combat-1',
        processed: { mapId: 'map-2', combatId: 'combat-1', actionIds: ['a'] },
      }),
    ).toBeUndefined()

    expect(
      hydratedProcessedPlayerActionIdsForDm({
        mapId: 'map-1',
        combatId: 'combat-1',
        processed: { mapId: 'map-1', combatId: 'combat-old', actionIds: ['a'] },
      }),
    ).toBeUndefined()
  })

  it('loads the DM player-action batch from processed ids, queued requests, and latest fallback', async () => {
    const base = buildSharedPlayerAction({
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      now: 1000,
      patch: { type: 'end-turn' },
    })
    const processed = { ...base, id: 'processed', seq: 1, updatedAt: 1000 }
    const queued = { ...base, id: 'queued', seq: 2, updatedAt: 2000 }
    const latest = { ...base, id: 'latest', seq: 3, updatedAt: 3000 }

    const batch = await loadDmPlayerActionBatch({
      mapId: 'map-1',
      combatId: 'combat-1',
      currentProcessedActionIds: new Set(),
      loadProcessed: async () => ({
        mapId: 'map-1',
        combatId: 'combat-1',
        actionIds: ['processed'],
        updatedAt: 4000,
      }),
      loadQueue: async () => ({
        mapId: 'map-1',
        combatId: 'combat-1',
        requests: [processed, queued],
        updatedAt: 4000,
      }),
      loadLatestAction: async () => latest,
    })

    expect(batch.processedActionIds).toEqual(new Set(['processed']))
    expect(batch.actions.map((action) => action.id)).toEqual(['queued', 'latest'])
  })

  it('publishes a player action by appending the queue before broadcasting the event', async () => {
    const action = buildSharedPlayerAction({
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 2,
      now: 2000,
      patch: { type: 'end-turn' },
    })
    const calls: string[] = []
    let savedQueueIds: string[] = []
    let publishedActionId = ''

    await publishPlayerActionRequest({
      action,
      now: () => 3000,
      loadQueue: async () => {
        calls.push('load')
        return {
          mapId: 'map-1',
          combatId: 'combat-1',
          requests: [{ ...action, id: 'old-action', seq: 1, updatedAt: 1000 }],
          updatedAt: 1000,
        }
      },
      saveQueue: async (queue) => {
        calls.push('save')
        savedQueueIds = queue.requests.map((item) => item.id)
        expect(queue.updatedAt).toBe(3000)
      },
      publishAction: async (eventAction) => {
        calls.push('publish')
        publishedActionId = eventAction.id
      },
    })

    expect(calls).toEqual(['load', 'save', 'publish'])
    expect(savedQueueIds).toEqual(['old-action', action.id])
    expect(publishedActionId).toBe(action.id)
  })

  it('locks the pending player action before publishing the request', async () => {
    const action = buildSharedPlayerAction({
      mapId: 'map-1',
      sourceMode: 'player',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      now: 1000,
      patch: { type: 'end-turn' },
    })
    const calls: string[] = []

    await submitPlayerActionRequestWithLock({
      action,
      label: '结束回合',
      lockPendingAction: (pending) => {
        calls.push(`lock:${pending.id}:${pending.label}`)
      },
      loadQueue: async () => {
        calls.push('load')
        return null
      },
      saveQueue: async () => {
        calls.push('save')
      },
      publishAction: async () => {
        calls.push('publish')
      },
      now: () => 2000,
    })

    expect(calls).toEqual([`lock:${action.id}:结束回合`, 'load', 'save', 'publish'])
  })

  it('decides whether a player ack should be consumed by the current pending action', () => {
    const ack = {
      id: 'ack-1',
      mapId: 'map-1',
      combatId: 'combat-1',
      actionId: 'action-1',
      status: 'accepted' as const,
      appliedAt: 1234,
      round: 1,
      initiativeIndex: 0,
      updatedAt: 1234,
    }

    expect(
      resolvePlayerActionAckDecision({
        ack: null,
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({ status: 'ignored' })

    expect(
      resolvePlayerActionAckDecision({
        ack: { ...ack, mapId: 'other-map' },
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({ status: 'ignored' })

    expect(
      resolvePlayerActionAckDecision({
        ack,
        mapId: 'map-1',
        seenAckIds: new Set(['ack-1']),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({ status: 'ignored' })

    expect(
      resolvePlayerActionAckDecision({
        ack,
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'other-action' },
      }),
    ).toEqual({ status: 'ignored', markSeenAckId: 'ack-1' })

    expect(
      resolvePlayerActionAckDecision({
        ack,
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({
      status: 'handle',
      markSeenAckId: 'ack-1',
      actionId: 'action-1',
      waitForAppliedAt: 1234,
    })
  })

  it('does not wait for authoritative snapshots on rejected acks but still clears matching pending action', () => {
    const decision = resolvePlayerActionAckDecision({
      ack: {
        id: 'ack-2',
        mapId: 'map-1',
        actionId: 'action-2',
        status: 'rejected',
        reason: 'stale-turn',
        round: 1,
        initiativeIndex: 0,
        updatedAt: 2000,
      },
      mapId: 'map-1',
      seenAckIds: new Set(),
      pendingAction: { id: 'action-2' },
    })

    expect(decision).toEqual({
      status: 'handle',
      markSeenAckId: 'ack-2',
      actionId: 'action-2',
      waitForAppliedAt: undefined,
    })
    expect(shouldClearPendingPlayerActionAfterAck({ id: 'action-2' }, 'action-2')).toBe(true)
    expect(shouldClearPendingPlayerActionAfterAck({ id: 'other' }, 'action-2')).toBe(false)
  })

  it('consumes an accepted ack after authoritative sync and the unlock delay', async () => {
    const seenAckIds = new Set<string>()
    let pendingAction: { id: string; label?: string } | null = { id: 'action-1' }
    const calls: string[] = []

    const result = await consumePlayerActionAck({
      ack: {
        id: 'ack-1',
        mapId: 'map-1',
        actionId: 'action-1',
        status: 'accepted',
        appliedAt: 1234,
        round: 1,
        initiativeIndex: 0,
        updatedAt: 1234,
      },
      mapId: 'map-1',
      seenAckIds,
      getPendingAction: () => pendingAction,
      waitForAuthoritativeSync: async (appliedAt) => {
        calls.push(`sync:${appliedAt}`)
      },
      sleep: async (ms) => {
        calls.push(`sleep:${ms}`)
      },
      clearPendingAction: () => {
        calls.push('clear')
        pendingAction = null
      },
    })

    expect(result).toBe('handled')
    expect([...seenAckIds]).toEqual(['ack-1'])
    expect(calls).toEqual(['sync:1234', 'sleep:100', 'clear'])
    expect(pendingAction).toBeNull()
  })

  it('does not clear a different pending action after an ack wait', async () => {
    let pendingAction: { id: string; label?: string } | null = { id: 'action-1' }
    const clearPendingAction = vi.fn()

    const result = await consumePlayerActionAck({
      ack: {
        id: 'ack-1',
        mapId: 'map-1',
        actionId: 'action-1',
        status: 'accepted',
        appliedAt: 1234,
        round: 1,
        initiativeIndex: 0,
        updatedAt: 1234,
      },
      mapId: 'map-1',
      seenAckIds: new Set(),
      getPendingAction: () => pendingAction,
      waitForAuthoritativeSync: async () => {
        pendingAction = { id: 'action-2' }
      },
      sleep: async () => undefined,
      clearPendingAction,
    })

    expect(result).toBe('handled')
    expect(clearPendingAction).not.toHaveBeenCalled()
  })

  it('stops ack consumption when the caller is cancelled', async () => {
    const clearPendingAction = vi.fn()

    const result = await consumePlayerActionAck({
      ack: {
        id: 'ack-1',
        mapId: 'map-1',
        actionId: 'action-1',
        status: 'accepted',
        appliedAt: 1234,
        round: 1,
        initiativeIndex: 0,
        updatedAt: 1234,
      },
      mapId: 'map-1',
      seenAckIds: new Set(),
      getPendingAction: () => ({ id: 'action-1' }),
      waitForAuthoritativeSync: async () => undefined,
      sleep: async () => undefined,
      clearPendingAction,
      isCancelled: () => true,
    })

    expect(result).toBe('cancelled')
    expect(clearPendingAction).not.toHaveBeenCalled()
  })

  it('waits for authoritative snapshots before resolving', async () => {
    let now = 0
    let mapsUpdatedAt = 0
    let charactersUpdatedAt = 0
    let sleeps = 0

    await waitForAuthoritativeActionSnapshot({
      appliedAt: 100,
      now: () => now,
      pollMs: 10,
      timeoutMs: 100,
      loadMapsUpdatedAt: async () => mapsUpdatedAt,
      loadCharactersUpdatedAt: async () => charactersUpdatedAt,
      sleep: async (ms) => {
        sleeps += 1
        now += ms
        if (sleeps === 2) {
          mapsUpdatedAt = 100
          charactersUpdatedAt = 100
        }
      },
    })

    expect(sleeps).toBe(2)
  })

  it('reloads authoritative player action state after the snapshot barrier', async () => {
    let now = 0
    let mapsUpdatedAt = 0
    let charactersUpdatedAt = 0
    const calls: string[] = []

    await syncAuthoritativePlayerActionState({
      appliedAt: 100,
      now: () => now,
      pollMs: 10,
      timeoutMs: 100,
      loadMapsUpdatedAt: async () => {
        calls.push('watermark:maps')
        return mapsUpdatedAt
      },
      loadCharactersUpdatedAt: async () => {
        calls.push('watermark:characters')
        return charactersUpdatedAt
      },
      sleep: async (ms) => {
        now += ms
        mapsUpdatedAt = 100
        charactersUpdatedAt = 100
      },
      loadMaps: async () => {
        calls.push('reload:maps')
      },
      loadCharacters: async () => {
        calls.push('reload:characters')
      },
    })

    expect(calls.slice(-2).sort()).toEqual(['reload:characters', 'reload:maps'])
  })
})
